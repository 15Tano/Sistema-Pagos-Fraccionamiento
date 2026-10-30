"""Archivo sin perdida de recibos SDK ya cerrados y reconocidos por el padre.

El ZIP no sustituye un Disconnect: primero se verifica el ledger activo. Ante
corte al retirar copias calientes, el catalogo durable permite terminar esa
misma retirada comparando cada archivo; nunca tocar un trabajador nuevo/ajeno.
"""
import base64
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import uuid

import aplicador_integrado as integrated
import vigencias_candidato as core
from almacen_operativo import expand, RESERVE
from respaldo_protegido import checked_path
from trabajador_controlado import SDKGate

MAX_BYTES=128*1024*1024
APP_ID=0x53494C41
NAMES={'request.json','operation.json','r2_operation.json','profile_operation.json','response.json','closed.json',
       'parent_ack.json','grant.dpapi','owner_grant.dpapi','protected_backup.json','write_attempt.json'}


class LedgerArchive:
    def __init__(self,data,*,max_bytes=2*1024**3):
        self.data=checked_path(data);self.data.mkdir(parents=True,exist_ok=True)
        self.ledger=self.data/'cierres';self.root=self.data/'cierres_archivados';self.max_bytes=max_bytes
        self.db=sqlite3.connect(self.data/'archivo_cierres.sqlite',isolation_level=None,timeout=5)
        self.db.row_factory=sqlite3.Row
        try:
            app=self.db.execute('PRAGMA application_id').fetchone()[0]
            tables=self.db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            if app not in (0,APP_ID) or (app==0 and tables): raise ValueError('Catalogo SQLite ajeno.')
            self.db.execute('PRAGMA journal_mode=WAL');self.db.execute('PRAGMA synchronous=FULL')
            self.db.execute('CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, sha256 TEXT NOT NULL)')
            self.db.execute('PRAGMA application_id='+str(APP_ID))
        except BaseException:
            self.db.close();raise

    def close(self): self.db.close()

    def path(self,key):
        if str(uuid.UUID(key))!=key: raise ValueError('UUID de archivo invalido.')
        return checked_path(self.root/(key+'.json.gz'))

    def load(self,key,digest):
        path=self.path(key)
        if path.stat().st_size>MAX_BYTES: raise ValueError('Archivo de recibos excedido.')
        packed=path.read_bytes()
        if hashlib.sha256(packed).hexdigest()!=digest: raise ValueError('Archivo de recibos alterado.')
        value=json.loads(expand(packed,MAX_BYTES,gzip_format=True))
        if (set(value)!={'protocol','snapshot_id','workers'} or type(value['protocol']) is not int or
                value['protocol']!=1 or value['snapshot_id']!=key or not isinstance(value['workers'],dict)):
            raise ValueError('Archivo de recibos ajeno.')
        for worker,files in value['workers'].items():
            if str(uuid.UUID(worker))!=worker or not isinstance(files,dict) or not {'request.json','closed.json','parent_ack.json'}<=files.keys() or not files.keys()<=NAMES:
                raise ValueError('Trabajador archivado invalido.')
            for raw in files.values():
                if len(base64.b64decode(raw,validate=True))>core.closures.MAX_RESPONSE:
                    raise ValueError('Archivo de trabajador excedido.')
        return value

    def prune(self,value,*,after_file=lambda:None):
        ledger=checked_path(self.ledger).resolve()
        retired=checked_path(self.data/'cierres_retirados')
        retired.mkdir(exist_ok=True)
        for worker,files in value['workers'].items():
            folder=checked_path(self.ledger/worker)
            if folder.parent.resolve()!=ledger: raise ValueError('Trabajador fuera de ledger.')
            target=checked_path(retired/worker)
            # Ambos destinos absolutos deben quedar dentro del almacen, sin junctions.
            if not folder.resolve().is_relative_to(self.data.resolve()) or not target.resolve().is_relative_to(self.data.resolve()):
                raise ValueError('Traslado fuera del almacen.')
            if folder.exists():
                if target.exists(): raise ValueError('Dos copias calientes del trabajador; revisar.')
                current=list(folder.iterdir())
                if {p.name for p in current}!=set(files): raise ValueError('Trabajador caliente incompleto antes de traslado.')
                for path in current:
                    if not path.is_file() or checked_path(path).read_bytes()!=base64.b64decode(files[path.name],validate=True):
                        raise ValueError('Trabajador caliente modificado antes de traslado.')
                # Renombrar directorio entero evita un ledger parcialmente borrado ante corte.
                folder.rename(target)
            if not target.exists(): continue
            folder=target
            remaining=list(folder.iterdir())
            if any(not p.is_file() or p.name not in files for p in remaining):
                raise ValueError('Directorio de trabajador modificado; conservar.')
            for path in remaining:
                path=checked_path(path)
                if path.read_bytes()!=base64.b64decode(files[path.name],validate=True):
                    raise ValueError('Trabajador caliente difiere del archivo.')
            for path in remaining:
                checked_path(path).unlink();after_file()
            folder.rmdir()

    def recover(self):
        for row in self.db.execute('SELECT * FROM snapshots ORDER BY rowid'):
            self.prune(self.load(row['id'],row['sha256']))

    def archive(self,gate,transactions,*,guard,after_file=lambda:None):
        guard()
        if not isinstance(gate,SDKGate) or gate.active is not None or gate.fault:
            raise PermissionError('Archivar solo con SDK libre y cerrado.')
        integrated.check_runs(transactions);core.check_operations(self.ledger)
        if any(self.ledger.glob('*/r2_operation.json')):
            from produccion_r2 import check_ledger
            check_ledger(self.ledger)
        folders=list(self.ledger.iterdir()) if self.ledger.exists() else []
        if not folders: return False
        workers={}
        for folder in folders:
            folder=checked_path(folder)
            if str(uuid.UUID(folder.name))!=folder.name or not folder.is_dir(): raise ValueError('Ledger ajeno.')
            files={}
            for path in folder.iterdir():
                path=checked_path(path)
                if not path.is_file() or path.name not in NAMES or path.stat().st_size>core.closures.MAX_RESPONSE:
                    raise ValueError('Archivo de ledger ajeno/excedido.')
                files[path.name]=base64.b64encode(path.read_bytes()).decode('ascii')
            workers[folder.name]=files
        key=str(uuid.uuid4());value={'protocol':1,'snapshot_id':key,'workers':workers}
        raw=core.encoded(value)
        if len(raw)>MAX_BYTES: raise ValueError('Archivo de ledger excedido.')
        packed=gzip.compress(raw,mtime=0);self.root.mkdir(exist_ok=True)
        total=sum(p.stat().st_size for p in self.root.iterdir() if p.is_file())
        if total+len(packed)>self.max_bytes or shutil.disk_usage(self.root).free<RESERVE+len(packed):
            raise OSError('Sin capacidad de archivo; no retirar recibos calientes.')
        path=self.path(key);core.durable(path,packed);digest=hashlib.sha256(packed).hexdigest()
        loaded=self.load(key,digest)
        if loaded!=value: raise ValueError('Archivo distinto del ledger.')
        guard()
        self.db.execute('INSERT INTO snapshots VALUES (?,?)',(key,digest))  # FULL antes de retirar copias.
        self.prune(loaded,after_file=after_file)
        return True
