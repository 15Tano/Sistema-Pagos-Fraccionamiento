"""Emisor real contra API ficticia: SQLite/archivos reales; sin SDK o red."""
from datetime import datetime,timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from almacen_operativo import HotOutbox,Originals
from emisor_servicio import save
import produccion_config as config
import produccion_emisor as sender
import test_produccion_r2 as fixtures


class ProductionSenderTests(unittest.TestCase):
    def test_sender_delivers_and_archives_one_original_without_touching_sdk_or_secret(self):
        base=ROOT/'datos'/'pruebas_produccion';base.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base) as temporary:
            root=Path(temporary);data=root/'acceso-datos';data.mkdir();session=root/'emisor';session.mkdir()
            # Configuracion temporal con identidad publica, sin credenciales reales.
            fixture=fixtures.ProductionConfigTests();fixture.setUp()
            try:
                for name in ('servicio-config.json','activacion-integrada.json'):
                    (root/name).write_bytes((fixture.root/name).read_bytes())
            finally: fixture.tearDown()
            save(session/'request.json',{'protocol':1,'run_id':str(uuid.uuid4()),'base':str(root.resolve())})
            raw=b'2026-10-30 12:00:00,123,99000177,1,0,0,4\r\n'
            original=Originals(data/'originals.sqlite',config.AGENT,config.SERIAL)
            stamp=datetime.now(timezone.utc).isoformat()
            key=original.put(raw+b'\0'*(65536-len(raw)),0,stamp,stamp,None,None)
            box=HotOutbox(data/'outbox.sqlite',config.AGENT,config.SERIAL)
            from almacen_operativo import Archives
            archives=Archives(data/'ack_archivados',original);original.recover(box,archives)
            box.close();original.close();calls=[]
            class API:
                def send(self,endpoint,body):
                    value=json.loads(body);calls.append(body)
                    ack={'protocol_version':1,'status':'accepted','agent_id':value['agent_id'],
                        'content_sha256':hashlib.sha256(body).hexdigest(),'server_received_at_utc':stamp,
                        'batch_id':value['batch_id'],'responses_stored':1,'rows_stored':1,
                        'events_stored':1,'statuses_stored':0,'responses_pending_interpretation':0}
                    return 201,ack,None
            ticks=[0]
            def stopped(): ticks[0]+=1;return len(calls)>=1 or ticks[0]>100
            with patch.object(sender.credencial,'load',side_effect=AssertionError('No real credential expected.')):
                code=sender.worker(session,root=root,transport=API(),stop=stopped)
            self.assertEqual(0,code);self.assertEqual(1,len(calls))
            result=json.loads((session/'closed.json').read_bytes())
            self.assertEqual('stopped',result['report']['phase'])
            self.assertEqual(1,len(list((data/'ack_archivados').glob('*.json.gz'))))
            reopened=Originals(data/'originals.sqlite')
            try: self.assertEqual(raw,reopened.receipt(key)['raw'])
            finally: reopened.close()

    def test_emisor_import_does_not_load_sdk_or_access_modules(self):
        code="import sys;sys.path.insert(0,sys.argv[1]);import produccion_emisor;assert not {'sdk_operativo','adaptadores_cierre','pyodbc','captura_rt'} & set(sys.modules)"
        result=subprocess.run([sys.executable,'-B','-c',code,str(ROOT)],capture_output=True,timeout=20)
        self.assertEqual(0,result.returncode,result.stderr.decode(errors='replace'))


if __name__=='__main__': unittest.main(verbosity=2)
