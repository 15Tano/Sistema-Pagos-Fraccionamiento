"""SQLite durable para un agente; llamadas SDK y HTTP quedan fuera de este modulo."""
import contextlib
import json
from pathlib import Path
import re
import shutil
import sqlite3
import time
import uuid

from protocolo import MAX_BODY, MAX_STATE, digest, identifier, json_bytes, now, response, utc

APP_ID = 0x53494341


class Outbox:
    def __init__(self, path, agent_id=None, serial=None, *, clock=time.time,
                 max_bytes=256 * 1024 * 1024, reserve_bytes=64 * 1024 * 1024):
        self.path, self.clock = Path(path).resolve(), clock
        self.max_bytes, self.reserve_bytes = max_bytes, reserve_bytes
        if not self.path.exists() and agent_id is None:
            raise ValueError('Inicializar primero el almacen con identidad explicita.')
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        try:
            app_id = self.db.execute('PRAGMA application_id').fetchone()[0]
            tables = self.db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            if app_id not in (0, APP_ID) or (app_id == 0 and tables):
                raise ValueError('Archivo SQLite ajeno al agente.')
            if app_id == APP_ID and self.db.execute('PRAGMA user_version').fetchone()[0] != 1:
                raise ValueError('Version de almacen no compatible.')
            self.db.execute('PRAGMA journal_mode=WAL')
            self.db.execute('PRAGMA synchronous=FULL')
            self.db.execute('PRAGMA foreign_keys=ON')
            with self.transaction():
                tables = self.db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
                if not tables:
                    if agent_id is None or not isinstance(serial, str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{1,64}', serial):
                        raise ValueError('Identidad invalida.')
                    self.db.execute('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
                    self.db.execute('''CREATE TABLE messages (
                        id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, sequence INTEGER NOT NULL,
                        body BLOB NOT NULL, sha256 TEXT NOT NULL, created_utc TEXT NOT NULL,
                        state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
                        next_attempt REAL NOT NULL DEFAULT 0, lease TEXT, lease_until REAL,
                        error TEXT, ack BLOB, UNIQUE(endpoint, sequence))''')
                    self.db.execute('''CREATE TABLE responses (
                        id TEXT PRIMARY KEY, raw BLOB NOT NULL, metadata BLOB NOT NULL,
                        captured_utc TEXT NOT NULL, message_id TEXT REFERENCES messages(id))''')
                    for key, value in {'agent_id': identifier(agent_id), 'device_serial': serial,
                                       'session_id': str(uuid.uuid4()), 'paused': ''}.items():
                        self.db.execute('INSERT INTO meta VALUES (?,?)', (key, value))
                    self.db.execute(f'PRAGMA application_id={APP_ID}')
                    self.db.execute('PRAGMA user_version=1')
                self.identity = dict(self.db.execute('SELECT key,value FROM meta'))
                if agent_id is not None and (identifier(agent_id) != self.identity['agent_id'] or serial != self.identity['device_serial']):
                    raise ValueError('El almacen pertenece a otro agente/controlador.')
        except BaseException:
            self.db.close()
            raise

    @contextlib.contextmanager
    def transaction(self):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            yield
            self.db.commit()
        except BaseException:
            self.db.rollback()
            raise

    def close(self):
        self.db.close()

    def _capacity(self, extra):
        size = sum(p.stat().st_size for p in [self.path, Path(str(self.path) + '-wal'),
                                            Path(str(self.path) + '-shm')] if p.exists())
        if size + extra * 3 > self.max_bytes or shutil.disk_usage(self.path.parent).free < self.reserve_bytes + extra * 3:
            raise OSError('Capacidad local insuficiente; detener futuras lecturas antes de consumir RT.')

    def ensure_capture_capacity(self):
        # El futuro coordinador debe llamar esto ANTES de consultar RT y conservar
        # el error de capture() si el disco cambia entre ambas operaciones.
        self._capacity(2 * 524288)

    def capture(self, raw, source, code, started, ended, response_id=None, **context):
        item = response(raw, source, code, started, ended, response_id, **context)
        metadata = json_bytes(item)
        with self.transaction():
            existing = self.db.execute('SELECT raw,metadata FROM responses WHERE id=?', (item['response_id'],)).fetchone()
            if existing:
                if existing['raw'] != raw or existing['metadata'] != metadata:
                    raise ValueError('UUID de respuesta reutilizado con otro contenido.')
                return item['response_id']
            self._capacity(len(raw) + len(metadata))
            self.db.execute('INSERT INTO responses(id,raw,metadata,captured_utc) VALUES (?,?,?,?)',
                            (item['response_id'], raw, metadata, now()))
        return item['response_id']

    def _envelope(self, endpoint):
        sequence = self.db.execute('SELECT COALESCE(MAX(sequence),-1)+1 FROM messages WHERE endpoint=?', (endpoint,)).fetchone()[0]
        if sequence > 2147483647:
            raise ValueError('Secuencia agotada; requiere transicion de sesion coordinada.')
        return {'protocol_version': 1, 'agent_id': self.identity['agent_id'],
                'device_serial': self.identity['device_serial'], 'session_id': self.identity['session_id'],
                'sequence': sequence}

    def _insert(self, endpoint, payload, message_id):
        body = json_bytes(payload)
        if len(body) > (MAX_STATE if endpoint == 'estado' else MAX_BODY):
            raise ValueError('Mensaje supera el limite del contrato.')
        self._capacity(len(body))
        self.db.execute('INSERT INTO messages(id,endpoint,sequence,body,sha256,created_utc) VALUES (?,?,?,?,?,?)',
                        (message_id, endpoint, payload['sequence'], body, digest(body), now()))

    def build_batch(self, maximum=20):
        if type(maximum) is not int or not 1 <= maximum <= 100:
            raise ValueError('Maximo de respuestas invalido.')
        with self.transaction():
            candidates = self.db.execute('SELECT id,raw,metadata FROM responses WHERE message_id IS NULL ORDER BY rowid LIMIT ?',
                                         (maximum,)).fetchall()
            if not candidates:
                return None
            message_id = str(uuid.uuid4())
            payload = self._envelope('lotes') | {'batch_id': message_id, 'responses': []}
            selected, lines = [], 0
            for row in candidates:
                item = json.loads(row['metadata'])
                if item['sha256'] != digest(row['raw']):
                    raise ValueError('Original local no coincide con su hash.')
                count = len([line for line in row['raw'].splitlines() if line])
                candidate = payload | {'responses': payload['responses'] + [item]}
                if selected and (len(json_bytes(candidate)) > MAX_BODY or lines + count > 2000):
                    break
                payload = candidate
                selected.append(row['id'])
                lines += count
            self._insert('lotes', payload, message_id)
            self.db.executemany('UPDATE responses SET message_id=? WHERE id=?', [(message_id, key) for key in selected])
        return message_id

    def enqueue_state(self, snapshot):
        required = {'reported_at_utc', 'agent_version', 'pid', 'vigencias', 'sdk', 'reader', 'sender'}
        allowed = required | {'worker_version', 'watchdog'}
        if not isinstance(snapshot, dict) or not required <= snapshot.keys() or snapshot.keys() - allowed:
            raise ValueError('Snapshot de estado incompleto o con campos ajenos.')
        utc(snapshot['reported_at_utc'])
        if any(not isinstance(snapshot[key], dict) or not snapshot[key] for key in ('vigencias', 'sdk', 'reader', 'sender')):
            raise ValueError('Snapshots de salud deben ser objetos con campos explicitos.')
        with self.transaction():
            message_id = str(uuid.uuid4())
            self._insert('estado', self._envelope('estado') | snapshot, message_id)
        return message_id

    def claim(self, seconds=60):
        with self.transaction():
            if self.db.execute("SELECT value FROM meta WHERE key='paused'").fetchone()[0]:
                return None
            instant = self.clock()
            row = self.db.execute('''SELECT * FROM messages WHERE state='pending' AND next_attempt<=?
                AND (lease IS NULL OR lease_until<=?) ORDER BY rowid LIMIT 1''', (instant, instant)).fetchone()
            if row is None:
                return None
            lease = str(uuid.uuid4())
            self.db.execute('UPDATE messages SET lease=?,lease_until=?,attempts=attempts+1 WHERE id=?',
                            (lease, instant + seconds, row['id']))
            return dict(row) | {'lease': lease, 'attempts': row['attempts'] + 1}

    def finish(self, message, *, ack=None, error=None, retry_in=0, blocked=False):
        with self.transaction():
            changed = self.db.execute('''UPDATE messages SET state=?,ack=?,error=?,next_attempt=?,lease=NULL,lease_until=NULL
                WHERE id=? AND lease=? AND state='pending' ''',
                ('acked' if ack is not None else 'blocked' if blocked else 'pending',
                 json_bytes(ack) if ack is not None else None, error, self.clock() + retry_in,
                 message['id'], message['lease'])).rowcount
            if changed and blocked:
                self.db.execute("UPDATE meta SET value=? WHERE key='paused'", (error,))
            return changed == 1

    def resume(self):
        with self.transaction():
            self.db.execute("UPDATE messages SET state='pending',next_attempt=0 WHERE state='blocked'")
            self.db.execute("UPDATE meta SET value='' WHERE key='paused'")

    def health(self):
        counts = {row[0]: row[1] for row in self.db.execute('SELECT state,COUNT(*) FROM messages GROUP BY state')}
        unbatched = self.db.execute('SELECT COUNT(*) FROM responses WHERE message_id IS NULL').fetchone()[0]
        return {'messages': counts, 'responses': self.db.execute('SELECT COUNT(*) FROM responses').fetchone()[0],
                'unbatched': unbatched, 'pending_count': counts.get('pending', 0) + counts.get('blocked', 0) + unbatched,
                'paused': self.db.execute("SELECT value FROM meta WHERE key='paused'").fetchone()[0],
                'oldest_pending_utc': self.db.execute('''SELECT MIN(instant) FROM (
                    SELECT created_utc AS instant FROM messages WHERE state!='acked'
                    UNION ALL SELECT captured_utc AS instant FROM responses WHERE message_id IS NULL)''').fetchone()[0]}
