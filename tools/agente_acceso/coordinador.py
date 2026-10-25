"""Coordinacion de ensayo readonly: ciclo primero, RT cerrado antes del siguiente.

No instala tareas, no envia HTTP y no aplica fechas. La fuente de vigencias es
un snapshot observado, separado del resultado del ciclo de comparacion.
"""
import csv
import datetime as dt
import io
import json
import os
import time
import uuid

from captura_rt import UnsafeClosure, capture_in_outbox
from protocolo import now

VERSION = 'coordinador-ensayo-2026.10.24-1'


def classify(item):
    if item['sdk_return_code'] < 0:
        return 'paused'
    if not item['terminated']:
        return 'unknown'
    try:
        rows = [row for row in csv.reader(io.StringIO(item['raw'].decode('utf-8'))) if row]
        if not rows:
            return 'unknown'
        for row in rows:
            if len(row) != 7 or not row[4].strip().isascii() or not row[4].strip().isdigit():
                return 'unknown'
            dt.datetime.strptime(row[0].strip(), '%Y-%m-%d %H:%M:%S')
        return 'status_observed' if all(int(row[4]) == 255 for row in rows) else 'catching_up'
    except (ValueError, UnicodeError, csv.Error):
        return 'unknown'


class Coordinator:
    def __init__(self, box, cycle_probe, rt_factory, *, before_rt=lambda: None,
                 stop=lambda: False, observed_state=lambda: None, sink=lambda state: None,
                 clock=time.monotonic, sleep=time.sleep, utc_now=now,
                 cycle_interval=60, rt_interval=1, state_interval=30):
        if cycle_interval < 1 or rt_interval < .2 or state_interval < 1:
            raise ValueError('Intervalos fuera del ensayo.')
        self.box, self.cycle_probe, self.rt_factory = box, cycle_probe, rt_factory
        self.before_rt, self.stop, self.observed_state, self.sink = before_rt, stop, observed_state, sink
        self.clock, self.sleep, self.utc = clock, sleep, utc_now
        self.cycle_interval, self.rt_interval, self.state_interval = cycle_interval, rt_interval, state_interval
        self.rt = None
        self.reader_paused = False
        self.state = {
            'scope': 'ensayo_coordinador_sin_escrituras_sdk', 'version': VERSION, 'pid': os.getpid(),
            'started_utc': self.utc(), 'run_id': str(uuid.uuid4()), 'phase': 'starting', 'stop_reason': None,
            'cycle_probe': {'mode': 'readonly', 'phase': 'waiting', 'completed': 0,
                            'consecutive_errors': 0, 'total_errors': 0,
                            'last_completed_utc': None, 'last_error_type': None},
            'sdk': {'last_ok_utc': None, 'last_error_code': None},
            'reader': {'state': 'unknown', 'checked_at_utc': None},
            'reader_error': None, 'storage_error': None,
        }

    def _publish(self):
        self.state['heartbeat_utc'] = self.utc()
        try:
            self.state['sender'] = self.box.health()
        except Exception as exc:
            self.state['storage_error'] = type(exc).__name__
        try:
            self.sink(json.loads(json.dumps(self.state)))
        except OSError as exc:
            # Estado del ensayo degradado, nunca last_ok de vigencias ficticio.
            self.state['storage_error'] = type(exc).__name__
            self.reader_paused = True

    def _close_rt(self):
        if self.rt is not None:
            client, self.rt = self.rt, None
            client.close()  # Debe confirmar Disconnect + salida antes de otro SDK.

    def _storage_fault(self, exc):
        self.reader_paused = True
        self.state['storage_error'] = type(exc).__name__
        self.state['reader']['state'] = 'paused'
        self._close_rt()

    def _cycle(self):
        self._close_rt()
        if self.stop():
            return False
        probe = self.state['cycle_probe']
        self.state['phase'], probe['phase'] = 'cycle_probe', 'running'
        self.state['reader']['state'] = 'paused'
        self._publish()
        try:
            self.cycle_probe()  # Adaptador de ensayo exige apply=False.
            probe['completed'] += 1
            probe['consecutive_errors'] = 0
            probe['last_completed_utc'], probe['last_error_type'] = self.utc(), None
        except UnsafeClosure:
            raise
        except Exception as exc:
            probe['consecutive_errors'] += 1
            probe['total_errors'] += 1
            probe['last_error_type'] = type(exc).__name__
        # Ni este exito ni RT actualizan last_ok_utc de vigencias observadas.
        probe['phase'] = 'waiting'
        self.state['phase'] = 'waiting'
        self._publish()
        return True

    def _read(self):
        try:
            self.box.ensure_capture_capacity()  # Antes de consumir RT.
            self.before_rt()  # Reserva adicional del archivo de originales.
        except Exception as exc:
            self._storage_fault(exc)
            return
        try:
            if self.rt is None:
                self.rt = self.rt_factory()
                self.rt.connect()
            if self.stop():
                self._close_rt()
                return
            self.state['phase'] = 'reading'
            item = self.rt.read()
        except UnsafeClosure:
            raise
        except Exception as exc:
            self.reader_paused = True
            self.state['reader_error'] = type(exc).__name__
            self.state['reader']['state'] = 'paused'
            self._close_rt()
            return
        try:
            capture_in_outbox(self.box, item)
        except Exception as exc:
            # Archivo original ya guardado por trabajador, recuperable al reiniciar.
            self._storage_fault(exc)
            return
        self.state['reader'] = {'state': classify(item), 'checked_at_utc': item['ended_utc']}
        if item['sdk_return_code'] < 0:
            self.state['sdk']['last_error_code'] = item['sdk_return_code']
            self.state['reader_error'] = 'sdk_error'
            self.reader_paused = True
        elif not item['terminated'] or self.state['reader']['state'] == 'unknown':
            self.state['reader_error'] = 'unknown_or_empty_rt'
            self.reader_paused = True
        else:
            self.state['sdk'] = {'last_ok_utc': item['ended_utc'], 'last_error_code': None}
        if self.reader_paused:
            self._close_rt()
        self.state['phase'] = 'waiting'

    def _queue_state(self):
        observed = self.observed_state()
        if observed is None:
            return
        # Mantener solo claves del estado protocol 2, sin reescribir sus fechas/PID.
        allowed = {'protocol', 'pid', 'run_started_utc', 'phase', 'last_ok_utc',
                   'consecutive_errors', 'heartbeat_utc', 'cycle_started_utc',
                   'cycle_finished_utc', 'last_error_type'}
        snapshot = {key: value for key, value in observed.items() if key in allowed}
        if (snapshot.get('protocol') != 2 or type(snapshot.get('pid')) is not int or
                snapshot['pid'] < 1 or snapshot.get('phase') not in ('starting', 'cycle', 'idle', 'stopped') or
                type(snapshot.get('consecutive_errors')) is not int or snapshot['consecutive_errors'] < 0):
            self.state['observed_state_error'] = 'invalid_snapshot'
            return
        self.state['observed_vigencias'] = snapshot
        health = self.box.health()
        self.box.enqueue_state({'reported_at_utc': self.utc(), 'agent_version': VERSION,
            'worker_version': VERSION, 'pid': os.getpid(), 'vigencias': snapshot,
            'sdk': dict(self.state['sdk']), 'reader': dict(self.state['reader']),
            'sender': {'pending_count': health['pending_count'],
                       'oldest_pending_at_utc': health['oldest_pending_utc']}})

    def run(self, seconds=150):
        if not 1 <= seconds <= 180:
            raise ValueError('Ensayo acotado a un maximo de 180 segundos.')
        start = self.clock()
        deadline, next_cycle, next_rt, next_state, next_batch = start + seconds, start, start, start, start
        try:
            while self.clock() < deadline:
                if self.stop():
                    self.state['stop_reason'] = 'requested'
                    break
                instant = self.clock()
                if instant >= next_cycle:
                    if not self._cycle():
                        self.state['stop_reason'] = 'requested'
                        break
                    next_cycle = self.clock() + self.cycle_interval
                    continue
                if instant >= next_batch:
                    try:
                        self.box.build_batch()  # Local; HTTP siempre fuera de este proceso.
                    except Exception as exc:
                        self._storage_fault(exc)
                    next_batch = self.clock() + 5
                if instant >= next_state:
                    try:
                        self._queue_state()
                    except Exception as exc:
                        self._storage_fault(exc)
                    next_state = self.clock() + self.state_interval
                # Reconsultar plazo/parada despues de persistir y antes de tocar SDK.
                if self.stop() or self.clock() >= min(deadline, next_cycle):
                    continue
                if not self.reader_paused and self.clock() >= next_rt:
                    self._read()
                    next_rt = self.clock() + self.rt_interval
                self._publish()
                self.sleep(min(.25, max(0, min(deadline, next_cycle) - self.clock())))
            self.state['stop_reason'] = self.state['stop_reason'] or 'limit'
        except BaseException as exc:
            self.state['stop_reason'] = type(exc).__name__
            raise
        finally:
            try:
                self._close_rt()
            except UnsafeClosure:
                self.state['stop_reason'] = 'UnsafeClosure'
                raise
            finally:
                self.state['phase'] = 'fault' if self.state['stop_reason'] == 'UnsafeClosure' else 'stopped'
                self.state['reader']['state'] = 'paused'
                self._publish()
        return self.state
