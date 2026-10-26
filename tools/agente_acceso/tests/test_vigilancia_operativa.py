"""Avisos adicionales separados de last_ok; sin ventanas, red ni tareas reales."""
import datetime as dt
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import vigilancia_operativa as watch


class WatchTests(unittest.TestCase):
    def setUp(self): self.now=dt.datetime(2026,10,26,8,tzinfo=dt.timezone.utc)
    def state(self,at=None,**kwargs):
        return {'phase':'idle','heartbeat_utc':(at or self.now).isoformat(),'closures_confirmed':False,
            'reader_error':None,'storage_error':None,'sender_error':None,'queue':{'pending_count':0,'paused':''}}|kwargs

    def test_reader_paused_during_date_cycle_is_not_a_failure(self):
        self.assertIsNone(watch.assess(self.state(phase='cycle',reader={'state':'paused'}),self.now))

    def test_idle_sender_with_no_pending_and_no_ack_is_not_connection_proof_or_alarm(self):
        self.assertIsNone(watch.assess(self.state(sender={'last_ack_utc':None}),self.now))

    def test_component_error_requires_five_minutes_and_repeats_after_fifteen(self):
        state=self.state(reader_error='RuntimeError')
        first=watch.transition({},state,self.now)
        self.assertFalse(first['notify']);self.assertEqual('pendiente',first['status'])
        later=watch.transition(first,self.state(at=self.now+dt.timedelta(minutes=5),reader_error='RuntimeError'),self.now+dt.timedelta(minutes=5))
        self.assertTrue(later['notify']);self.assertEqual('alerta',later['status'])
        same=watch.transition(later,self.state(at=self.now+dt.timedelta(minutes=10),reader_error='RuntimeError'),self.now+dt.timedelta(minutes=10))
        self.assertFalse(same['notify'])
        repeat=watch.transition(same,self.state(at=self.now+dt.timedelta(minutes=20),reader_error='RuntimeError'),self.now+dt.timedelta(minutes=20))
        self.assertTrue(repeat['notify'])

    def test_confirmed_normal_stop_clears_error_alarm(self):
        result=watch.transition({'bad_since_utc':(self.now-dt.timedelta(minutes=9)).isoformat()},
            self.state(phase='stopped',closures_confirmed=True,reader_error='old error'),self.now)
        self.assertIsNone(result['reason']);self.assertFalse(result['notify'])

    def test_old_pending_messages_do_not_wait_an_additional_five_minutes(self):
        state=self.state(queue={'pending_count':1,'paused':'','oldest_pending_utc':(self.now-dt.timedelta(minutes=7)).isoformat()})
        result=watch.transition({},state,self.now)
        self.assertTrue(result['notify']);self.assertIn('pendientes',result['reason'])

    def test_new_pending_messages_do_not_raise_alarm(self):
        state=self.state(queue={'pending_count':1,'oldest_pending_utc':self.now.isoformat()})
        self.assertIsNone(watch.assess(state,self.now))

    def test_changed_error_does_not_reset_persistent_bad_since(self):
        old=watch.transition({},self.state(storage_error='OSError'),self.now)
        later=watch.transition(old,self.state(at=self.now+dt.timedelta(minutes=6),sender_error='NetworkError'),self.now+dt.timedelta(minutes=6))
        self.assertTrue(later['notify']);self.assertEqual(old['bad_since_utc'],later['bad_since_utc'])

    def test_capacity_warning_is_explicit_without_changing_date_health(self):
        state=self.state(capacity={'warnings':['raw_store_80pct']},vigencias={'last_ok_utc':self.now.isoformat()})
        self.assertIn('capacidad',watch.assess(state,self.now))
        self.assertEqual(self.now.isoformat(),state['vigencias']['last_ok_utc'])


if __name__=='__main__': unittest.main()
