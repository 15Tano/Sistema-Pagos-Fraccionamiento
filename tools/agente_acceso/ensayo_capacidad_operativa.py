"""Carga local repetible de 2400 respuestas; ningun SDK, red o dato instalado."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import time

from almacen_operativo import Originals,HotOutbox,Archives,capture
from emisor import Sender

ROOT=Path(__file__).resolve().parent


def run(count=2400):
    if count!=2400:raise ValueError('Carga de prueba fija.')
    sys.path.insert(0,str(ROOT/'tests'))
    import test_agente as fixture
    base=ROOT/'datos'/'prueba_capacidad_operativa';base.mkdir(parents=True,exist_ok=True)
    started=time.monotonic();keys=[];bodies={};sequences=[]
    with tempfile.TemporaryDirectory(dir=base) as temp:
        folder=Path(temp);raw=Originals(folder/'originals.sqlite',fixture.AGENT,fixture.SERIAL)
        box=HotOutbox(folder/'outbox.sqlite',fixture.AGENT,fixture.SERIAL);archives=Archives(folder/'ack',raw)
        try:
            sender=Sender(box,fixture.FakeTransport())
            buffer=(fixture.RAW+b'\0').ljust(65536,b'\0');digest=hashlib.sha256(buffer).hexdigest()
            for index in range(count):
                key=raw.put(buffer,1,fixture.START,fixture.END);keys.append(key);capture(box,raw.receipt(key))
                if (index+1)%20==0:
                    box.build_batch();message=dict(box.db.execute('SELECT * FROM messages').fetchone())
                    bodies[message['id']]=message['body'];sequences.append(message['sequence'])
                    if sender.once()!='acked' or not archives.archive_one(box):raise AssertionError('ACK/archivo incompleto.')
            raw.db.execute('PRAGMA wal_checkpoint(TRUNCATE)');box.db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
            stored=(folder/'originals.sqlite').stat().st_size
            if sequences!=list(range(count//20)) or box.health()['pending_count']!=0:raise AssertionError('Secuencia/cola alterada.')
            for key in keys:
                if raw.receipt(key)['buffer_sha256']!=digest:raise AssertionError('Original alterado.')
            for row in raw.db.execute('SELECT id,sha256 FROM archives'):
                _,message,_=archives.decode(archives.path(row['id']),row['sha256'])
                if message['body']!=bodies[row['id']]:raise AssertionError('Cuerpo HTTP alterado al archivar.')
            if raw.db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise AssertionError('SQLite inconsistente.')
            raw.close();box.close();raw=Originals(folder/'originals.sqlite');box=HotOutbox(folder/'outbox.sqlite')
            archives=Archives(folder/'ack',raw)
            if raw.recover(box,archives)!=0 or box.health()['pending_count']!=0:raise AssertionError('ACK reencolado.')
            capture(box,raw.receipt(keys[0]));box.build_batch()
            if box.db.execute('SELECT sequence FROM messages').fetchone()[0]!=count//20:raise AssertionError('Secuencia reutilizada.')
            return {'result':'capacity_ok','responses':count,'full_buffer_bytes':count*65536,
                'original_sqlite_bytes':stored,'acked_archives':count//20,'originals_verified':True,
                'http_bodies_unchanged':True,'reopen_does_not_requeue_acked':True,
                'sequence_continues_after_archive':True,'seconds':round(time.monotonic()-started,3),
                'meaning':'Carga sintetica local; no mide caudal real ni vida util de disco en Dell.'}
        finally:raw.close();box.close()


if __name__=='__main__':print(json.dumps(run(),indent=2))
