"""Candidato con SQLite real temporal y reloj/HTTP/SDK ficticios; sin caseta."""
import base64
import datetime as dt
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock
import uuid

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from outbox import Outbox
from emisor import Sender
from latencia_politicas import BatchPolicy,ReaderObservation,RequestBudget
from servicio_latencia import LatencyService
from servicio_integrado import SDKGate,Service,UnsafeClosure
from emisor_latencia import TraceTransport,loop
import test_agente as fixture
from test_coordinador import OBSERVED

STATUS=b'2026-10-28 18:00:00,0,0,0,255,0,0\r\n'
EVENT=b'2026-10-28 18:00:00,123,99000177,1,0,0,4\r\n'


class Clock:
    def __init__(self):
        self.value=0.
        self.callbacks=[]
    def __call__(self):
        return self.value
    def advance(self,value):
        end=self.value+value
        while self.value<end-1e-9:
            self.value=min(end,self.value+.05)
            for callback in self.callbacks:
                callback()
        self.value=end
    def utc(self):
        return (dt.datetime(2026,10,28,18,tzinfo=dt.timezone.utc)+dt.timedelta(seconds=self.value)).isoformat()


def item(clock,raw=EVENT):
    return {'response_id':str(uuid.uuid4()),'raw':raw,'buffer':raw+b'\0'*(65536-len(raw)),
        'terminated':True,'sdk_return_code':0,'started_utc':clock.utc(),'ended_utc':clock.utc(),
        'pc_local_time':None,'windows_timezone':None}


class API:
    def __init__(self,clock):
        self.clock=clock
        self.bodies={}
        self.visible={}
        self.calls=[]
        self.fail_after_accept=False
        self.http_errors=[]
    def send(self,endpoint,body):
        self.calls.append((self.clock(),endpoint,body))
        if self.http_errors:
            return self.http_errors.pop(0),None,'2'
        payload=json.loads(body)
        key=payload.get('batch_id') or (payload['session_id'],payload['sequence'])
        if key in self.bodies and self.bodies[key]!=body:
            return 409,None,None
        replay=key in self.bodies
        self.bodies[key]=body
        ack={'protocol_version':1,'status':'accepted','agent_id':payload['agent_id'],
            'content_sha256':hashlib.sha256(body).hexdigest(),'server_received_at_utc':self.clock.utc()}
        if endpoint=='lotes':
            rows=[]
            for response in payload['responses']:
                rows.extend(base64.b64decode(response['raw_payload_base64']).decode().splitlines())
                self.visible.setdefault(response['response_id'],self.clock())
            statuses=sum(line.split(',')[4]=='255' for line in rows)
            ack.update(batch_id=key,responses_stored=len(payload['responses']),rows_stored=len(rows),
                events_stored=len(rows)-statuses,statuses_stored=statuses,responses_pending_interpretation=0)
        else:
            ack.update(session_id=payload['session_id'],sequence=payload['sequence'])
        if self.fail_after_accept:
            self.fail_after_accept=False
            raise OSError('ACK perdido ficticio')
        return (200 if replay else 201),ack,None


class StorageTests(unittest.TestCase):
    def setUp(self):
        folder=ROOT/'datos'/'pruebas_latencia'
        folder.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=folder)
        self.clock=Clock()
        self.box=Outbox(Path(self.temp.name)/'outbox.sqlite',fixture.AGENT,fixture.SERIAL,clock=self.clock)
        self.api=API(self.clock)
        self.traces=[]
        self.budget=RequestBudget(clock=self.clock)
        self.sender=Sender(self.box,TraceTransport(self.api,self.budget,self.traces.append,clock=self.clock,stamp=self.clock.utc),random_fraction=lambda:0)
        self.batcher=BatchPolicy(self.box,clock=self.clock)
    def tearDown(self):
        self.box.close()
        self.temp.cleanup()
    def capture(self,raw=EVENT):
        value=item(self.clock,raw)
        self.box.capture(value['raw'],'rt',0,value['started_utc'],value['ended_utc'],response_id=value['response_id'])
        return value['response_id']

    def test_event_is_batched_after_short_coalescence_not_five_seconds(self):
        identifier=self.capture()
        self.assertIsNone(self.batcher.tick())
        self.clock.advance(.14)
        self.assertIsNone(self.batcher.tick())
        self.clock.advance(.02)
        self.assertIsNotNone(self.batcher.tick())
        self.assertEqual('acked',self.sender.once())
        self.assertLess(self.api.visible[identifier],.25)
        self.assertEqual(1,self.box.health()['responses'])

    def test_multiple_rows_responses_are_preserved_without_semantic_dedup(self):
        first=self.capture(EVENT+EVENT)
        second=self.capture(EVENT)
        self.batcher.tick()
        self.clock.advance(.2)
        self.batcher.tick()
        self.assertEqual('acked',self.sender.once())
        self.assertEqual({first,second},set(self.api.visible))
        ack=json.loads(self.box.db.execute('SELECT ack FROM messages').fetchone()[0])
        self.assertEqual(3,ack['rows_stored'])

    def test_status_only_buffers_are_preserved_and_coalesced(self):
        identifiers=[self.capture(STATUS) for _ in range(4)]
        self.batcher.tick()
        self.clock.advance(4.9)
        self.assertIsNone(self.batcher.tick())
        self.clock.advance(.2)
        self.assertIsNotNone(self.batcher.tick())
        self.sender.once()
        self.assertEqual(set(identifiers),set(self.api.visible))

    def test_event_behind_status_triggers_same_ordered_batch(self):
        first=self.capture(STATUS)
        second=self.capture(EVENT)
        self.batcher.tick()
        self.clock.advance(.2)
        self.batcher.tick()
        payload=json.loads(self.box.db.execute('SELECT body FROM messages').fetchone()[0])
        self.assertEqual([first,second],[v['response_id'] for v in payload['responses']])

    def test_microbatch_minimum_gap_prevents_one_request_per_burst_row(self):
        self.capture()
        self.batcher.tick()
        self.clock.advance(.2)
        self.batcher.tick()
        for _ in range(5):
            self.capture()
            self.batcher.tick()
            self.clock.advance(.1)
        self.assertEqual(1,self.box.db.execute('SELECT COUNT(*) FROM messages').fetchone()[0])
        self.clock.advance(1)
        self.assertIsNotNone(self.batcher.tick())

    def test_lost_ack_retries_same_body_and_keeps_all_originals(self):
        identifier=self.capture()
        self.box.build_batch()
        original=self.box.db.execute('SELECT body FROM messages').fetchone()[0]
        self.api.fail_after_accept=True
        self.assertEqual('retry',self.sender.once())
        self.assertEqual('idle',self.sender.once())
        self.clock.advance(2.1)
        self.assertEqual('acked',self.sender.once())
        self.assertEqual([original,original],[c[2] for c in self.api.calls])
        self.assertEqual({identifier},set(self.api.visible))
        self.assertEqual(1,self.box.health()['responses'])

    def test_429_and_server_errors_keep_body_and_retry_after(self):
        self.capture()
        self.box.build_batch()
        self.api.http_errors=[429,503]
        self.assertEqual('retry',self.sender.once())
        self.assertEqual('idle',self.sender.once())
        self.clock.advance(2.1)
        self.assertEqual('retry',self.sender.once())
        self.clock.advance(4.1)
        self.assertEqual('acked',self.sender.once())
        self.assertEqual(1,len({c[2] for c in self.api.calls}))

    def test_trace_failure_after_http_does_not_immediately_repeat_request(self):
        self.capture()
        self.box.build_batch()
        calls=[]
        def trace(value):
            calls.append(value)
            if value['phase']=='http_finished':
                raise RuntimeError('Disco de traza ficticio')
        sender=Sender(self.box,TraceTransport(self.api,self.budget,trace,clock=self.clock,stamp=self.clock.utc))
        with self.assertRaises(RuntimeError):
            sender.once()
        self.assertEqual(1,len(self.api.calls))
        self.assertEqual('idle',sender.once())  # Lease sigue retenido; no repetir por log.

    def test_trace_does_not_include_card_pin_payload_or_token(self):
        self.capture()
        self.box.build_batch()
        self.sender.once()
        text=json.dumps(self.traces)
        self.assertNotIn('99000177',text)
        self.assertNotIn('raw_payload',text)
        self.assertEqual(['http_started','http_finished'],[t['phase'] for t in self.traces])

    def test_invalid_ack_cannot_inject_text_into_clock_trace(self):
        self.capture();self.box.build_batch()
        original=self.api.send
        def changed(endpoint,body):
            status,ack,retry=original(endpoint,body)
            ack['server_received_at_utc']='private_fake_response'
            return status,ack,retry
        self.api.send=changed
        self.assertEqual('blocked',self.sender.once())
        self.assertNotIn('private_fake_response',json.dumps(self.traces))
        self.assertFalse(self.traces[-1]['ack_valid'])

    def test_measurement_counts_pending_separately_and_uses_same_pc_ack(self):
        from resumen_latencia import summarize
        first=self.capture();self.box.build_batch()
        self.clock.advance(.7);self.sender.once()
        self.clock.advance(.2);self.capture()
        folder=Path(self.temp.name)/'session';(folder/'emisor').mkdir(parents=True)
        (folder/'emisor'/'http.jsonl').write_text('\n'.join(json.dumps(v) for v in self.traces))
        (folder/'transiciones.jsonl').write_text(json.dumps({'phase':'cycle_started','pc_utc':item(Clock())['started_utc'],'monotonic_s':0})+'\n')
        result=summarize(self.box,folder,{'heartbeat_utc':self.clock.utc()})
        self.assertEqual(2,result['responses_this_run'])
        self.assertEqual(1,result['responses_with_confirmed_http_timing'])
        self.assertEqual(.7,result['capture_end_to_http_ack']['p50_s'])
        self.assertEqual(1,result['queue']['unbatched'])
        self.assertEqual(0,result['negative_time_deltas'])

    def test_summary_does_not_mix_deliberately_batched_status_with_event_latency(self):
        from resumen_latencia import summarize
        self.capture(EVENT);self.box.build_batch()
        self.clock.advance(.8);self.sender.once()
        self.capture(STATUS);self.box.build_batch()
        self.clock.advance(5.5);self.sender.once()
        folder=Path(self.temp.name)/'session';(folder/'emisor').mkdir(parents=True)
        (folder/'emisor'/'http.jsonl').write_text('\n'.join(json.dumps(v) for v in self.traces))
        (folder/'transiciones.jsonl').write_text(json.dumps({'phase':'cycle_started','pc_utc':Clock().utc(),'monotonic_s':0})+'\n')
        groups=summarize(self.box,folder,{'heartbeat_utc':self.clock.utc()})['groups']
        self.assertEqual(.8,groups['event']['capture_to_http_ack']['p95_s'])
        self.assertEqual(5.5,groups['status']['capture_to_http_ack']['p95_s'])
        self.assertEqual(0,groups['unknown']['responses'])

    def test_worker_metrics_separate_inventory_and_flag_clock_inversion_without_faking_health(self):
        from resumen_latencia import worker_statistics
        def stamp(seconds):
            return (dt.datetime(2026,10,28,18,tzinfo=dt.timezone.utc)+dt.timedelta(seconds=seconds)).isoformat()
        def record(role,start,end):
            return {'role':role,'started_utc':stamp(start),'ended_utc':stamp(end),'closed':True,'operation_ok':True}
        records=[record('rt',0,1),record('vigencias',1.5,3.5),record('rt',4.5,6)]
        value=worker_statistics(records)
        self.assertEqual(2,value['inventory_worker_wall']['max_s'])
        self.assertEqual(3.5,value['between_rt_workers']['max_s'])
        inversion=worker_statistics([record('rt',0,3),record('rt',2,4)])
        self.assertEqual(1,inversion['negative_worker_time_deltas'])
        self.assertEqual(0,inversion['between_rt_workers']['samples'])
        failed=dict(record('vigencias',1,2),operation_ok=False)
        self.assertEqual(1,worker_statistics([failed])['workers_failed_operation'])

    def test_batch_failure_does_not_reassign_response_or_http(self):
        self.capture()
        self.batcher.tick()
        self.clock.advance(.2)
        original=self.box.build_batch
        self.box.build_batch=Mock(side_effect=OSError('Disco ficticio'))
        with self.assertRaises(OSError):
            self.batcher.tick()
        self.assertEqual(1,self.box.health()['unbatched'])
        self.assertEqual([],self.api.calls)
        self.box.build_batch=original

    def test_shutdown_groups_tail_without_http_after_stop(self):
        self.capture()
        states=[]
        loop(self.box,self.sender,self.batcher,self.budget,states.append,lambda:True,
            clock=self.clock,sleep=self.clock.advance,stamp=self.clock.utc)
        self.assertEqual([],self.api.calls)
        self.assertEqual(0,self.box.health()['unbatched'])
        self.assertEqual(1,self.box.health()['pending_count'])
        self.assertIsNone(states[-1]['last_ack_utc'])

    def test_grouping_still_occurs_while_parent_is_in_long_cycle(self):
        self.capture()
        busy=[False]
        def pump():
            if busy[0]:return
            busy[0]=True
            try:
                self.batcher.tick()
                if self.budget.delay()==0:self.sender.once()
            finally:busy[0]=False
        self.clock.callbacks.append(pump)
        self.clock.advance(23)
        self.assertEqual(1,len(self.api.visible))
        self.assertLess(next(iter(self.api.visible.values())),.3)

    def test_real_service_closes_sdk_before_cycle_and_sends_fresh_states(self):
        gate=SDKGate()
        events=[]
        owner=self
        reads=[STATUS,STATUS,EVENT,STATUS,STATUS]
        class RT:
            def connect(self):gate.acquire('rt');events.append('connect')
            def read(self):
                events.append('read')
                return item(owner.clock,reads.pop(0) if reads else STATUS)
            def close(self):events.append('close');gate.release('rt',clean=True)
        def cycle():
            self.assertIsNone(gate.active)
            events.append('cycle')
            self.clock.advance(.1)
            return {'mode':'readonly','status':'compared'}
        state=[]
        emitter=types.SimpleNamespace(start=Mock(),close=Mock(return_value=True),snapshot=lambda:{'phase':'idle'})
        service=LatencyService(cycle,self.box,RT,emitter,gate,applying=False,observed=lambda:dict(OBSERVED),
            clock=self.clock,sleep=self.clock.advance,utc=self.clock.utc,cycle_interval=4,publish=state.append)
        result=service.run(10)
        self.assertTrue(result['closures_confirmed'])
        self.assertGreaterEqual(result['cycle']['completed'],2)
        self.assertIsNone(gate.active)
        for index,value in enumerate(events):
            if value=='cycle' and index:self.assertEqual('close',events[index-1])
        payloads=[json.loads(r[0]) for r in self.box.db.execute("SELECT body FROM messages WHERE endpoint='estado'")]
        self.assertTrue(any(p['reader']['state']=='status_observed' for p in payloads))
        self.assertTrue(all(p['vigencias']==OBSERVED for p in payloads))
        self.assertTrue(all(p['agent_version'].startswith('latencia-candidata') for p in payloads))


class ReadinessTests(unittest.TestCase):
    def setUp(self):self.clock=Clock();self.tracker=ReaderObservation(clock=self.clock)
    def observe(self,raw):return self.tracker.observe(item(self.clock,raw))
    def ready(self):
        self.assertEqual('catching_up',self.observe(STATUS)['state'])
        self.clock.advance(.5)
        self.assertEqual('status_observed',self.observe(STATUS)['state'])
    def test_backlog_is_not_live_before_two_empty_states(self):
        self.assertEqual('catching_up',self.observe(EVENT)['state'])
        self.assertEqual('catching_up',self.observe(STATUS)['state'])
        self.clock.advance(.5)
        self.assertEqual('catching_up',self.observe(EVENT)['state'])
        self.assertEqual('catching_up',self.observe(STATUS)['state'])
    def test_two_tags_close_together_keep_recent_empty_observation(self):
        self.ready()
        empty_stamp=self.tracker.empty_stamp
        for _ in range(2):
            self.clock.advance(.5)
            value=self.observe(EVENT)
            self.assertEqual('status_observed',value['state'])
            self.assertEqual(empty_stamp,value['checked_at_utc'])
    def test_long_reader_gap_resets_readiness(self):
        self.ready()
        self.clock.advance(3)
        self.assertEqual('catching_up',self.observe(EVENT)['state'])
    def test_continuous_events_without_recent_status_degrade(self):
        self.ready()
        for _ in range(5):
            self.clock.advance(.5)
            value=self.observe(EVENT)
        self.assertEqual('catching_up',value['state'])
    def test_reconnect_reset_never_inherits_prior_ready(self):
        self.ready();self.tracker.reset()
        self.assertEqual('catching_up',self.observe(EVENT)['state'])
    def test_unknown_or_negative_is_paused(self):
        self.ready()
        value=item(self.clock,b'bad response')
        self.assertEqual('paused',self.tracker.observe(value)['state'])
        value=item(self.clock,STATUS);value['sdk_return_code']=-2
        self.assertEqual('paused',self.tracker.observe(value)['state'])


class BudgetTests(unittest.TestCase):
    def test_ninety_actual_attempts_per_sliding_minute(self):
        clock=Clock();budget=RequestBudget(clock=clock)
        for _ in range(90):budget.consume()
        with self.assertRaises(RuntimeError):budget.consume()
        clock.advance(59)
        self.assertAlmostEqual(1,budget.delay())
        clock.advance(1)
        budget.consume()
        self.assertEqual(0,budget.delay())
    def test_cannot_configure_budget_above_candidate_limit(self):
        with self.assertRaises(ValueError):RequestBudget(120)


if __name__=='__main__':unittest.main()
