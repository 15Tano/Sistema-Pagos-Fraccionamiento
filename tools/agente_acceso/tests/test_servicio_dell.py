"""Controles de entrada/parada/cierre sin recursos instalados ni tareas reales."""
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import uuid
from unittest.mock import Mock, patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import servicio_integrado_dell as entry
import emisor_servicio as emitter


class EntryTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_servicio_entrada';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.folder=Path(self.temp.name)
        self.stack=contextlib.ExitStack();self.stack.enter_context(patch.object(entry,'ROOT',self.folder))

    def tearDown(self):
        self.stack.close();self.temp.cleanup()

    def test_stop_file_requires_current_pid_and_run_uuid(self):
        import threading
        run=str(uuid.uuid4());event=threading.Event()
        def reader(path):
            if Path(path).name=='mantenimiento.json': return {'active':True}
            return request[0]
        request=[{'pid':os.getpid(),'run_id':str(uuid.uuid4())}]
        with patch.object(emitter,'read',side_effect=reader):
            self.assertFalse(entry.stopped(run,event))
            request[0]={'pid':os.getpid()+1,'run_id':run}
            self.assertFalse(entry.stopped(run,event))
            request[0]={'pid':os.getpid(),'run_id':run}
            self.assertTrue(entry.stopped(run,event))

    def test_missing_maintenance_state_requests_stop(self):
        import threading
        with patch.object(emitter,'read',side_effect=FileNotFoundError):
            self.assertTrue(entry.stopped(str(uuid.uuid4()),threading.Event()))

    def test_cli_cannot_enable_writes_or_unbounded_operation(self):
        for args in (['--aplicar'],['--continuo']):
            with patch.object(sys,'argv',['service',*args]),patch('sys.stderr',io.StringIO()):
                with self.assertRaises(SystemExit) as error: entry.main()
            self.assertEqual(2,error.exception.code)

    def test_cli_preflight_has_no_hidden_sdk_or_manual_call(self):
        with patch.object(sys,'argv',['service','--preflight']),patch.object(entry,'verify_package'), \
                patch.object(entry,'preflight',return_value={'status':'preflight_ok'}), \
                patch.object(entry,'manual') as manual,patch('sys.stdout',io.StringIO()):
            self.assertEqual(0,entry.main())
        manual.assert_not_called()

    def test_invalid_trial_uuid_never_calls_runtime(self):
        with patch.object(sys,'argv',['service','--mantenimiento','--run-id','wrong']), \
                patch.object(entry,'verify_package'),patch.object(entry,'manual') as manual, \
                patch('sys.stdout',io.StringIO()):
            self.assertEqual(1,entry.main())
        manual.assert_not_called()

    def test_foreign_pointer_blocks_final_verification_before_sdk_lock(self):
        run=str(uuid.uuid4())
        with patch.object(entry,'preflight'),patch.object(emitter,'read',return_value={
                'run_id':str(uuid.uuid4()),'phase':'stopped','pid':123}):
            with self.assertRaises(RuntimeError): entry.verify_closed(run)

    def test_fault_state_cannot_be_presented_as_confirmed_closure(self):
        run=str(uuid.uuid4())
        with patch.object(entry,'preflight'),patch.object(emitter,'read',return_value={
                'run_id':run,'phase':'fault','pid':123}):
            with self.assertRaises(RuntimeError): entry.verify_closed(run)

    def test_stop_request_copies_exact_current_identity_without_enabling_tasks(self):
        run=str(uuid.uuid4())
        emitter.save(self.folder/'estado_servicio.json',{'pid':1234,'run_id':run,'phase':'idle'})
        with patch('sys.stdout',io.StringIO()): self.assertEqual(0,entry.request_stop())
        self.assertEqual({'pid':1234,'run_id':run},emitter.read(self.folder/'detener_servicio.json'))

    def test_actual_entry_wiring_runs_readonly_cycle_rt_and_real_sender_then_final_proof(self):
        import types
        import adaptadores_cierre as closures
        import ciclo_operativo
        import respaldo_ciclo
        import respaldo_real_mdb as previous
        import entregar_coordinador as delivery
        import captura_rt
        from outbox import Outbox
        import test_agente as box_fixture
        import test_coordinador as rt_fixture
        import test_ciclo_operativo as cycle_fixture
        harness=cycle_fixture.CycleTests('runTest');harness.setUp()
        self.addCleanup(harness.doCleanups)
        h=harness.h;data=h.folder
        h.ledger=data/'cierres';h.ledger.mkdir()
        sync=data/'sync';(sync/'registros').mkdir(parents=True)
        official=sync/'registros'/'estado.json';emitter.save(official,rt_fixture.OBSERVED)
        untouched=official.read_bytes()
        box=Outbox(data/'outbox.sqlite',box_fixture.AGENT,box_fixture.SERIAL)
        pub=types.SimpleNamespace(own_lock=lambda _:contextlib.nullcontext(),read=emitter.read,
            save=emitter.save,now=emitter.utc)
        diag=types.SimpleNamespace(maintenance_lock=contextlib.nullcontext,maintenance_guard=Mock())
        def sdk(root,python,*,gate,guard,timeout):
            h.gate=gate
            return types.SimpleNamespace(gate=gate,ledger=h.ledger,read_child=h.read_child)
        class RT:
            def __init__(self,gate,ledger,python,run_id):
                self.gate=gate;self.run_id=run_id;self.folder=None
            def connect(self):
                self.gate.acquire('rt');self.folder=closures.new_session(h.ledger,self.run_id,'rt')
            def read(self):
                originals=data/'originales';originals.mkdir(exist_ok=True)
                key=captura_rt.persist_receipt(originals,rt_fixture.EVENT+b'\0',1,
                    rt_fixture.START,rt_fixture.END,None,None)
                return captura_rt.receipt(originals,key)
            def close(self):
                request=closures.request_at(self.folder/'request.json')
                closures.write_closure(self.folder,request,started=closures.now(),closed=True,
                    operation_ok=True,sdk_sha256=closures.SDK_HASH,error_type=None)
                closures.acknowledge(self.folder,os.getpid());self.gate.release('rt',clean=True)
        sender_class=emitter.ProcessSender
        def sender(folder,base):
            command=[sys.executable,'-B',str(ROOT/'tests'/'servicio_proceso_ficticio.py'),'--sender',str(folder)]
            return sender_class(folder,data,command=command)
        response=contextlib.closing(io.BytesIO(json.dumps(cycle_fixture.f.API).encode()))
        run=str(uuid.uuid4())
        with contextlib.ExitStack() as stack:
            for obj,name,value in ((entry,'DATA',data),(entry,'BASE',data),(entry,'SYNC',sync),
                    (entry,'preflight',Mock()),(entry,'stopped',lambda *_:False),
                    (previous,'quiet',Mock()),(previous,'revisions',Mock()),(previous,'pub',lambda:pub),
                    (closures,'diagnostic_module',lambda:diag),(closures,'SafeRTClient',RT),
                    (respaldo_ciclo,'CycleTransport',sdk),(delivery,'Delivery',lambda _:types.SimpleNamespace(box=box)),
                    (ciclo_operativo,'access_inventory',lambda *_:harness.inventory()),
                    (emitter,'ProcessSender',sender)):
                # Guardar clase original: el factory no debe recursar al parchear el modulo.
                stack.enter_context(patch.object(obj,name,value))
            stack.enter_context(patch.object(entry.urllib.request,'urlopen',return_value=response))
            stack.enter_context(patch.dict(os.environ,{'SANISIDRO_ACCESS_PASSWORD':'fixture_only'}))
            with patch('sys.stdout',io.StringIO()):
                self.assertEqual(0,entry.manual(5,run))
                self.assertEqual(0,entry.verify_closed(run))
        result=emitter.read(self.folder/'datos'/'sesiones'/run/'resultado.json')
        self.assertTrue(result['trial_passed']);self.assertFalse(result['dates_applied'])
        self.assertTrue(result['closures_confirmed']);self.assertEqual(1,result['cycle']['completed'])
        self.assertGreater(len(result['worker_receipts']),1)
        h.access.update.assert_not_called()
        self.assertEqual(untouched,official.read_bytes())


if __name__=='__main__': unittest.main()
