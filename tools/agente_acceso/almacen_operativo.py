"""Originales RT comprimidos sin perdida y archivo de mensajes con ACK validado.

Almacen NUEVO de operacion: nunca migrar, vaciar o renombrar la outbox del ensayo.
No borra originales ni archivos. Solo retira de la cola caliente copias con ACK
y archivo durable verificado; conserva secuencias, cuerpos, ACK y cada respuesta.
"""
import base64
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import uuid
import zlib

import outbox as previous
import protocolo as protocol
from rutas_operativas import checked_path

APP_ID = 0x53495241
MAX_ARCHIVE = 8 * 1024 * 1024
RESERVE = 64 * 1024 * 1024


def directory_usage(path):
    """Contar archivos con metadatos de enumeracion, sin releer cada ruta en Windows.

    No cachear totales entre llamadas ni omitir errores de acceso/capacidad.
    Los archivos de ACK son inmutables; se conservan sus verificaciones completas.
    """
    with os.scandir(path) as entries:
        return sum(entry.stat().st_size for entry in entries if entry.is_file())


def capture(box,item):
    return box.capture(item['raw'],'rt',item['sdk_return_code'],item['started_utc'],item['ended_utc'],
        response_id=item['response_id'],pc_local_time=item['pc_local_time'],windows_timezone=item['windows_timezone'])


def expand(raw, limit, *, gzip_format=False):
    decoder = zlib.decompressobj(31 if gzip_format else zlib.MAX_WBITS)
    value = decoder.decompress(raw, limit + 1)
    if len(value) > limit or not decoder.eof or decoder.unconsumed_tail or decoder.unused_data:
        raise ValueError('Original comprimido invalido/excedido.')
    return value


class Originals:
    def __init__(self, path, agent_id=None, serial=None, *, max_bytes=2 * 1024**3):
        self.path = checked_path(path)
        self.max_bytes = max_bytes
        if not self.path.exists() and agent_id is None:
            raise ValueError('Almacen de originales no inicializado.')
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.path, isolation_level=None, timeout=5)
        self.db.row_factory = sqlite3.Row
        try:
            app = self.db.execute('PRAGMA application_id').fetchone()[0]
            tables = self.db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            if app not in (0, APP_ID) or (app == 0 and tables):
                raise ValueError('SQLite ajeno a originales.')
            self.db.execute('PRAGMA journal_mode=WAL')
            self.db.execute('PRAGMA synchronous=FULL')
            self.db.execute('PRAGMA foreign_keys=ON')
            with self.transaction():
                if not tables:
                    if agent_id is None or not isinstance(serial,str) or not re.fullmatch('[A-Za-z0-9_.:-]{1,64}',serial):
                        raise ValueError('Identidad explicita requerida.')
                    self.db.execute('CREATE TABLE identity (agent_id TEXT NOT NULL, serial TEXT NOT NULL)')
                    self.db.execute('INSERT INTO identity VALUES (?,?)',(protocol.identifier(agent_id),serial))
                    self.db.execute('CREATE TABLE archives (id TEXT PRIMARY KEY, sha256 TEXT NOT NULL, endpoint TEXT NOT NULL, sequence INTEGER NOT NULL, ack BLOB NOT NULL)')
                    self.db.execute('CREATE TABLE originals (id TEXT PRIMARY KEY, buffer_z BLOB NOT NULL, metadata BLOB NOT NULL, archive_id TEXT REFERENCES archives(id))')
                    self.db.execute('PRAGMA application_id='+str(APP_ID))
                    self.db.execute('PRAGMA user_version=1')
                if self.db.execute('PRAGMA user_version').fetchone()[0]!=1:
                    raise ValueError('Version de originales incompatible.')
                rows=self.db.execute('SELECT * FROM identity').fetchall()
                if len(rows)!=1:
                    raise ValueError('Identidad de originales inconsistente.')
                self.identity=dict(rows[0])
                if agent_id is not None and self.identity!={'agent_id':protocol.identifier(agent_id),'serial':serial}:
                    raise ValueError('Originales de otro agente/controlador.')
        except BaseException:
            self.db.close();raise

    transaction=previous.Outbox.transaction

    def close(self): self.db.close()

    def capacity(self):
        size=sum(p.stat().st_size for p in (self.path,Path(str(self.path)+'-wal'),Path(str(self.path)+'-shm')) if p.exists())
        if size+3*65536>self.max_bytes or shutil.disk_usage(self.path.parent).free<RESERVE+3*65536:
            raise OSError('Sin capacidad para conservar otro original.')

    def put(self, raw_buffer, code, started, ended, local=None, timezone=None, *, response_id=None):
        if not isinstance(raw_buffer,bytes) or not 0<len(raw_buffer)<=65536 or type(code) is not int or not -2**31<=code<2**31:
            raise ValueError('Buffer/codigo RT invalido.')
        if protocol.utc(ended)<protocol.utc(started): raise ValueError('Captura temporal invalida.')
        key=protocol.identifier(response_id or str(uuid.uuid4()))
        payload=raw_buffer.split(b'\0',1)[0]
        meta={'response_id':key,'sdk_return_code':code,'started_utc':started,'ended_utc':ended,
            'pc_local_time':local,'windows_timezone':timezone,'terminated':b'\0' in raw_buffer,
            'payload_sha256':protocol.digest(payload),'buffer_sha256':protocol.digest(raw_buffer),'buffer_bytes':len(raw_buffer)}
        encoded=protocol.json_bytes(meta)
        with self.transaction():
            old=self.db.execute('SELECT buffer_z,metadata FROM originals WHERE id=?',(key,)).fetchone()
            if old:
                if old['metadata']!=encoded or expand(old['buffer_z'],65536)!=raw_buffer:
                    raise ValueError('UUID RT reutilizado con otros bytes.')
                return key
            self.capacity()
            self.db.execute('INSERT INTO originals(id,buffer_z,metadata) VALUES (?,?,?)',(key,zlib.compress(raw_buffer,6),encoded))
        return key  # COMMIT FULL antes de responder por IPC.

    def receipt(self, key):
        key=protocol.identifier(key)
        row=self.db.execute('SELECT buffer_z,metadata FROM originals WHERE id=?',(key,)).fetchone()
        if row is None: raise ValueError('Falta original durable.')
        meta=json.loads(row['metadata']);buffer=expand(row['buffer_z'],65536);payload=buffer.split(b'\0',1)[0]
        if (meta.get('response_id')!=key or len(buffer)!=meta.get('buffer_bytes') or
                protocol.digest(buffer)!=meta.get('buffer_sha256') or protocol.digest(payload)!=meta.get('payload_sha256') or
                meta.get('terminated') is not (b'\0' in buffer)):
            raise ValueError('Original alterado.')
        return meta|{'raw':payload,'buffer':buffer}

    def mark_archive(self, message, ids, digest):
        with self.transaction():
            existing=self.db.execute('SELECT sha256 FROM archives WHERE id=?',(message['id'],)).fetchone()
            if existing and existing['sha256']!=digest: raise ValueError('Archivo de ACK sustituido.')
            self.db.execute('INSERT OR IGNORE INTO archives VALUES (?,?,?,?,?)',
                (message['id'],digest,message['endpoint'],message['sequence'],message['ack']))
            for key in ids:
                old=self.db.execute('SELECT archive_id FROM originals WHERE id=?',(key,)).fetchone()
                if old is None or old['archive_id'] not in (None,message['id']):
                    raise ValueError('Original ajeno al archivo.')
                self.db.execute('UPDATE originals SET archive_id=? WHERE id=?',(message['id'],key))

    def recover(self, box, archives):
        archives.verify_catalog()
        count=0
        for row in self.db.execute('SELECT id FROM originals WHERE archive_id IS NULL ORDER BY rowid'):
            item=self.receipt(row['id']);box.ensure_capture_capacity();capture(box,item);count+=1
        return count


class HotOutbox(previous.Outbox):
    def _envelope(self, endpoint):
        result=super()._envelope(endpoint)
        stored=self.db.execute('SELECT value FROM meta WHERE key=?',('archived_sequence_'+endpoint,)).fetchone()
        if stored:
            result['sequence']=max(result['sequence'],int(stored['value'])+1)
        if result['sequence']>2147483647: raise ValueError('Secuencia agotada.')
        return result


class Archives:
    def __init__(self, root, originals, *, max_bytes=4 * 1024**3):
        self.root=checked_path(root);self.originals=originals;self.max_bytes=max_bytes

    def path(self, key): return checked_path(self.root/(protocol.identifier(key)+'.json.gz'))

    def decode(self, path, expected=None):
        path=checked_path(path)
        if path.stat().st_size>MAX_ARCHIVE: raise ValueError('Archivo de ACK excedido.')
        raw=path.read_bytes()
        if expected and protocol.digest(raw)!=expected: raise ValueError('Archivo de ACK alterado.')
        value=json.loads(expand(raw,MAX_ARCHIVE,gzip_format=True))
        if set(value)!={'protocol','message','responses'} or value['protocol']!=1:
            raise ValueError('Archivo de ACK desconocido.')
        message={**value['message']}
        for field in ('body','ack'): message[field]=base64.b64decode(message[field],validate=True)
        payload=json.loads(message['body']);ack=json.loads(message['ack'])
        if message['state']!='acked' or protocol.digest(message['body'])!=message['sha256'] or protocol.json_bytes(payload)!=message['body']:
            raise ValueError('Mensaje no confirmado/alterado.')
        protocol.validate_ack(200,ack,payload,message['sha256'])
        if message['id']!=path.name.removesuffix('.json.gz'):
            raise ValueError('Archivo de otro mensaje.')
        if payload['agent_id']!=self.originals.identity['agent_id'] or payload['device_serial']!=self.originals.identity['serial']:
            raise ValueError('Archivo de otra identidad.')
        expected_ids=[r['response_id'] for r in payload.get('responses',[])]
        if [row['id'] for row in value['responses']]!=expected_ids:
            raise ValueError('Archivo sin todas las respuestas.')
        for row,item in zip(value['responses'],payload.get('responses',[])):
            raw_payload=base64.b64decode(row['raw'],validate=True)
            metadata=base64.b64decode(row['metadata'],validate=True)
            if json.loads(metadata)!=item or protocol.digest(raw_payload)!=item['sha256'] or base64.b64encode(raw_payload).decode()!=item['raw_payload_base64']:
                raise ValueError('Original de archivo distinto del lote.')
            original=self.originals.receipt(row['id'])
            if original['raw']!=raw_payload or original['payload_sha256']!=item['sha256']:
                raise ValueError('Buffer RT y archivo no coinciden.')
        return value,message,protocol.digest(raw)

    def verify_catalog(self):
        if not self.root.exists() and self.originals.db.execute('SELECT 1 FROM archives LIMIT 1').fetchone():
            raise ValueError('Catalogo sin archivos.')
        for row in self.originals.db.execute('SELECT id,sha256 FROM archives'):
            self.decode(self.path(row['id']),row['sha256'])

    def archive_one(self, box, *, after_mark=lambda:None):
        if box.identity['agent_id']!=self.originals.identity['agent_id'] or box.identity['device_serial']!=self.originals.identity['serial']:
            raise ValueError('Cola de otra identidad.')
        if box.health()['paused']:
            return False
        with box.transaction():
            row=box.db.execute("SELECT * FROM messages WHERE state='acked' ORDER BY rowid LIMIT 1").fetchone()
            if row is None: return False
            message=dict(row)
            payload=json.loads(message['body'])
            expected=[r['response_id'] for r in payload.get('responses',[])]
            rows=[dict(box.db.execute('SELECT * FROM responses WHERE id=? AND message_id=?',(key,message['id'])).fetchone() or {}) for key in expected]
            if any(not item for item in rows): raise ValueError('Lote sin originales completos.')
            data={'protocol':1,'message':message,'responses':rows}
            for field in ('body','ack'): data['message'][field]=base64.b64encode(message[field]).decode()
            for item in rows:
                for field in ('raw','metadata'): item[field]=base64.b64encode(item[field]).decode()
            # Contiene tiempos SQLite float de leases/backoff; no es un payload HTTP.
            raw=json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode('utf-8')
            if len(raw)>MAX_ARCHIVE: raise ValueError('Archivo de ACK demasiado grande.')
            packed=gzip.compress(raw,compresslevel=6,mtime=0)
            self.root.mkdir(parents=True,exist_ok=True)
            target=self.path(message['id'])
            needed=0 if target.exists() else len(packed)
            total=directory_usage(self.root)
            if total+needed>self.max_bytes or shutil.disk_usage(self.root).free<RESERVE+needed:
                raise OSError('Archivo de ACK sin capacidad; conservar cola caliente.')
            if not target.exists():
                with target.open('xb') as stream:
                    stream.write(packed);stream.flush();os.fsync(stream.fileno())
            _,verified,digest=self.decode(target)
            # En reintento de archivo local, intentos/lease pueden variar; cuerpo/ACK deben ser identicos.
            if any(verified[key]!=base64.b64decode(message[key]) if key in ('body','ack') else verified[key]!=message[key]
                   for key in ('id','body','ack','sha256','endpoint','sequence')):
                raise ValueError('Archivo distinto del mensaje caliente.')
            self.originals.mark_archive(verified,expected,digest)  # Antes de borrar copias de cola.
            after_mark()  # Frontera de corte simulado; no es una accion SDK/HTTP.
            box.db.execute('INSERT INTO meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
                ('archived_sequence_'+verified['endpoint'],str(max(verified['sequence'],int((box.db.execute(
                    'SELECT value FROM meta WHERE key=?',('archived_sequence_'+verified['endpoint'],)).fetchone() or ['-1'])[0])))))
            box.db.execute('DELETE FROM responses WHERE message_id=?',(verified['id'],))
            box.db.execute('DELETE FROM messages WHERE id=?',(verified['id'],))
        return True
