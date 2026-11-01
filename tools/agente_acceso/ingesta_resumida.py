"""Política local acotada: salud actual, 255 agregados y retiro de archivos ACK.

No llama al SDK ni a la red. Ninguna lectura pendiente se retira.
"""
import csv
import datetime as dt
import io
import json
import time
import uuid
import zlib

import protocolo as protocol
from almacen_operativo import HotOutbox, expand
from servicio_latencia import LatencyService
from emisor import Sender

STATUS_KEYS = ('status_observations_epoch', 'statuses_observed_total',
               'status_responses_total', 'status_last_observed_utc')


class MaintenanceService(LatencyService):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault('state_interval', 30)
        super().__init__(*args, **kwargs)

    def queue_state(self, *, urgent=False):
        if not urgent and self.clock() - self.last_health < 30:
            return
        super().queue_state(urgent=urgent)


def status_rows(buffer, code):
    """Solo resumir texto RT completo y conocido; mixtos/errores quedan íntegros."""
    if type(code) is not int or code < 0 or not isinstance(buffer, bytes) or not 0 < len(buffer) <= 65536 or b'\0' not in buffer:
        return 0
    try:
        raw = buffer.split(b'\0', 1)[0].decode('utf-8')
        rows = [r for r in csv.reader(io.StringIO(raw), strict=True) if r]
        if not rows or len(rows) > 2000:
            return 0
        for row in rows:
            if len(row) != 7 or any(len(value.encode('utf-8')) > 64 for value in row):
                return 0
            date = dt.datetime.strptime(row[0], '%Y-%m-%d %H:%M:%S')
            if date.strftime('%Y-%m-%d %H:%M:%S') != row[0]:
                return 0
            if row[4] != '255' or any(len(row[i].encode('utf-8')) > 32 for i in (3, 5, 6)):
                return 0
        return len(rows)
    except (ValueError, UnicodeError, csv.Error):
        return 0


def store_status(originals, buffer, code, started, ended, local=None, timezone=None):
    count = status_rows(buffer, code)
    if not count:
        return None
    if protocol.utc(ended) < protocol.utc(started):
        raise ValueError('Captura temporal inválida.')
    with originals.transaction():
        originals.db.execute('''CREATE TABLE IF NOT EXISTS rt_status_summary (
            id INTEGER PRIMARY KEY CHECK(id=1), epoch TEXT NOT NULL,
            responses INTEGER NOT NULL, statuses INTEGER NOT NULL,
            buffer_z BLOB NOT NULL, metadata BLOB NOT NULL)''')
        old = originals.db.execute('SELECT epoch,responses,statuses FROM rt_status_summary WHERE id=1').fetchone()
        epoch = old['epoch'] if old else str(uuid.uuid4())
        responses = (old['responses'] if old else 0) + 1
        statuses = (old['statuses'] if old else 0) + count
        item = {'response_id': str(uuid.uuid4()), 'sdk_return_code': code, 'started_utc': started,
                'ended_utc': ended, 'pc_local_time': local, 'windows_timezone': timezone,
                'terminated': True, 'status_summary': True,
                'buffer_sha256': protocol.digest(buffer), 'payload_sha256': protocol.digest(buffer.split(b'\0', 1)[0]),
                'status_statistics': dict(zip(STATUS_KEYS, (epoch, statuses, responses, ended)))}
        originals.db.execute('''INSERT INTO rt_status_summary VALUES(1,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET responses=excluded.responses,statuses=excluded.statuses,
            buffer_z=excluded.buffer_z,metadata=excluded.metadata''',
            (epoch, responses, statuses, zlib.compress(buffer, 6), protocol.json_bytes(item)))
    return responses


def status_receipt(originals, expected):
    row = originals.db.execute('SELECT * FROM rt_status_summary WHERE id=1').fetchone()
    if row is None or row['responses'] != expected:
        raise ValueError('Resumen RT no coincide con el recibo IPC.')
    buffer = expand(row['buffer_z'], 65536)
    item = json.loads(row['metadata'])
    if (not status_rows(buffer, item['sdk_return_code']) or protocol.digest(buffer) != item['buffer_sha256']
            or protocol.digest(buffer.split(b'\0', 1)[0]) != item['payload_sha256']
            or item['status_statistics'] != dict(zip(STATUS_KEYS, (row['epoch'], row['statuses'], row['responses'], item['ended_utc'])))):
        raise ValueError('Resumen RT alterado.')
    return dict(item, raw=buffer.split(b'\0', 1)[0], buffer=buffer)


class SummaryOutbox(HotOutbox):
    """Solo la salud no enviada es reemplazable; los lotes nunca se tocan."""
    def enqueue_state(self, snapshot):
        required = {'reported_at_utc', 'agent_version', 'pid', 'vigencias', 'sdk', 'reader', 'sender'}
        if not isinstance(snapshot, dict) or not required <= snapshot.keys() or snapshot.keys() - (required | {'worker_version', 'watchdog'}):
            raise ValueError('Snapshot incompleto.')
        protocol.utc(snapshot['reported_at_utc'])
        if any(not isinstance(snapshot[key], dict) or not snapshot[key] for key in ('vigencias', 'sdk', 'reader', 'sender')):
            raise ValueError('Snapshots explícitos requeridos.')
        with self.transaction():
            payload = self._envelope('estado') | snapshot
            # Calcular secuencia ANTES de retirar reportes; reservar incluso si
            # se retiró el último mensaje y no existía ningún archivo ACK.
            old = self.db.execute("SELECT value FROM meta WHERE key='superseded_state_sequence'").fetchone()
            payload['sequence'] = max(payload['sequence'], int(old[0]) + 1 if old else 0)
            if payload['sequence'] > 2147483647:
                raise ValueError('Secuencia agotada.')
            self.db.execute("DELETE FROM messages WHERE endpoint='estado' AND state='pending' AND (lease IS NULL OR lease_until<=?)", (self.clock(),))
            key = str(uuid.uuid4())
            self._insert('estado', payload, key)
            self.db.execute("INSERT INTO meta VALUES('superseded_state_sequence',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (str(payload['sequence']),))
        return key


class ResilientSender(Sender):
    def terminal(self, message, status):
        # Un estado de salud vencido NO es una lectura vehicular ni un ACK.
        # Retirarlo no debe impedir entregar lotes válidos tras una desconexión.
        if status != 410 or message['endpoint'] != 'estado':
            return None
        with self.outbox.transaction():
            removed = self.outbox.db.execute("DELETE FROM messages WHERE id=? AND lease=? AND state='pending' AND endpoint='estado'", (message['id'], message['lease'])).rowcount
            if not removed:
                return 'lease_reassigned'
            for key, value in (('superseded_state_sequence', message['sequence']), ('expired_health_count', 1)):
                old = self.outbox.db.execute('SELECT value FROM meta WHERE key=?', (key,)).fetchone()
                previous = int(old[0]) if old else -1 if key == 'superseded_state_sequence' else 0
                next_value = max(previous, value) if key == 'superseded_state_sequence' else previous + value
                self.outbox.db.execute('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, str(next_value)))
        return 'expired_health'


class ArchiveRetention:
    """Retiro recuperable tras cortes: catálogo primero, archivo después.

    Solo se retiran archivos verificados con ACK antiguo y sin copia caliente.
    Las marcas se conservan hasta confirmar la eliminación del archivo físico.
    """
    def __init__(self, archives, box, *, days=7, clock=time.time):
        if days != 7:
            raise ValueError('Retención local fuera del contrato.')
        self.archives, self.box, self.days, self.clock = archives, box, days, clock
        self.last = -float('inf')
        db = archives.originals.db
        db.execute('''CREATE TABLE IF NOT EXISTS archive_retention (
            id TEXT PRIMARY KEY, expires REAL NOT NULL, deleting INTEGER NOT NULL DEFAULT 0,
            sha256 TEXT NOT NULL)''')
        db.execute('CREATE INDEX IF NOT EXISTS archive_retention_due ON archive_retention(deleting,expires)')

    def tick(self, *, force=False, after_mark=lambda: None):
        current = self.clock()
        if not force and current - self.last < 30:
            return 0
        self.last = current
        originals = self.archives.originals
        db = originals.db
        # Incorporación gradual del catálogo previo; nunca recorre todo por tick.
        for row in db.execute('''SELECT a.id,a.sha256,a.ack FROM archives a
            WHERE NOT EXISTS(SELECT 1 FROM archive_retention r WHERE r.id=a.id) LIMIT 20''').fetchall():
            ack = json.loads(row['ack'])
            expires = protocol.utc(ack['server_received_at_utc']).timestamp() + self.days * 86400
            db.execute('INSERT INTO archive_retention(id,expires,sha256) VALUES(?,?,?)', (row['id'], expires, row['sha256']))
        removed = 0
        for row in db.execute('SELECT * FROM archive_retention WHERE deleting=1 OR expires<? ORDER BY deleting DESC,expires LIMIT 20', (current,)).fetchall():
            if self.box.db.execute('SELECT 1 FROM messages WHERE id=?', (row['id'],)).fetchone():
                continue
            path = self.archives.path(row['id'])
            if not row['deleting']:
                self.archives.decode(path, row['sha256'])
                with originals.transaction():
                    db.execute('UPDATE archive_retention SET deleting=1 WHERE id=?', (row['id'],))
                    db.execute('DELETE FROM originals WHERE archive_id=?', (row['id'],))
                    db.execute('DELETE FROM archives WHERE id=?', (row['id'],))
                after_mark()
            if path.exists():
                if path.stat().st_size > 8 * 1024 * 1024 or protocol.digest(path.read_bytes()) != row['sha256']:
                    raise ValueError('Archivo de retiro alterado; conservar evidencia.')
                path.unlink()
            db.execute('DELETE FROM archive_retention WHERE id=? AND deleting=1', (row['id'],))
            removed += 1
        return removed


class MaintainingSender:
    def __init__(self, sender, archives, box):
        self.sender = sender
        self.retention = ArchiveRetention(archives, box)

    def once(self):
        self.retention.tick()
        return self.sender.once()


def backend_ready(root):
    """Preflight de instalación: HTTPS sin redirects, credencial DPAPI existente."""
    from pathlib import Path
    import urllib.request
    import credencial
    import produccion_config as config
    from emisor import HttpTransport
    transport = HttpTransport(config.URL, credencial.load(Path(root)/'acceso-datos'/'credencial-ingesta.dpapi'))
    request = urllib.request.Request(config.URL + '/capacidades', method='GET',
        headers={'Authorization': 'Bearer ' + transport.token, 'Accept': 'application/json',
                 'Content-Type': 'application/json'})
    with transport.opener.open(request, timeout=10) as response:
        raw = response.read(16385)
        if response.code != 200 or len(raw) > 16384:
            raise PermissionError('Backend de resúmenes no confirmado.')
    value = json.loads(raw)
    if value != {'storage_policy': 'summary-v1', 'retention_enabled': True, 'retry_window_days': 7, 'technical_days': 1, 'event_days': 90}:
        raise PermissionError('Activar y verificar primero la política resumida del backend.')
    return value
