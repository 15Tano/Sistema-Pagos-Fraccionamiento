"""Planificador operativo: prioridad de vigencias, RT serializado y emisor independiente.

El nucleo permite ejecucion continua; la entrada Dell candidata solo permite
ensayo readonly acotado. No instala tareas ni concede autorizaciones de fechas.
"""
import copy
import os
import time
import uuid

from captura_rt import UnsafeClosure, capture_in_outbox
from coordinador import classify
from ciclo_operativo import CycleInterrupted
from protocolo import now
from trabajador_controlado import SDKGate, UnsafeSDKClosure
from vigencias_candidato import ReviewRequired

VERSION = 'servicio-integrado-2026.10.26-2'


class StopUnconfirmed(RuntimeError):
    pass


class Service:
    version = VERSION

    def __init__(self, cycle, box, rt_factory, sender, gate, *, applying=False,
                 guard=lambda: None, stop=lambda: False, publish=lambda state: None,
                 publish_official=lambda state: None, observed=lambda: None,
                 before_rt=lambda: None, clock=time.monotonic, sleep=time.sleep,
                 utc=now, cycle_interval=60, rt_interval=1, state_interval=30,
                 tick_interval=.25):
        if (not isinstance(gate, SDKGate) or type(applying) is not bool or
                cycle_interval < 1 or rt_interval < .2 or state_interval < 1 or
                not .05 <= tick_interval <= .25):
            raise ValueError('Configuracion operativa invalida.')
        if hasattr(cycle, 'applying') and cycle.applying is not applying:
            raise ValueError('El modo del ciclo debe coincidir antes de iniciar procesos.')
        self.cycle, self.box, self.rt_factory, self.sender, self.gate = cycle, box, rt_factory, sender, gate
        self.applying, self.guard, self.stop, self.publish, self.publish_official = applying, guard, stop, publish, publish_official
        self.observed, self.before_rt = observed, before_rt
        self.clock, self.sleep, self.utc = clock, sleep, utc
        self.intervals = cycle_interval, rt_interval, state_interval
        self.tick_interval = tick_interval
        self.rt, self.paused = None, False
        started = utc()
        self.official = {'protocol': 2, 'pid': os.getpid(), 'run_started_utc': started,
            'phase': 'starting', 'last_ok_utc': None, 'consecutive_errors': 0,
            'heartbeat_utc': started, 'cycle_started_utc': None,
            'cycle_finished_utc': None, 'last_error_type': None}
        self.state = {'protocol': 1, 'scope': 'servicio_integrado' if applying else 'ensayo_integrado_readonly',
            'pid': os.getpid(), 'run_id': str(uuid.uuid4()), 'phase': 'starting', 'stop_reason': None,
            'mode': 'apply' if applying else 'readonly', 'cycle': {'completed': 0, 'errors': 0, 'last_result': None},
            'reader': {'state': 'paused', 'checked_at_utc': None},
            'sdk': {'last_ok_utc': None, 'last_error_code': None},
            'reader_error': None, 'storage_error': None, 'sender_error': None,
            'closures_confirmed': False}

    def checked(self):
        self.guard()
        if self.gate.fault:
            raise UnsafeSDKClosure('SDK requiere revision.')

    def emit(self):
        stamp = self.utc()
        self.state['heartbeat_utc'] = stamp
        self.state['sdk_gate'] = {'active': self.gate.active, 'fault': self.gate.fault}
        if self.applying:
            self.official['heartbeat_utc'] = stamp
            # Fallar aqui termina el proceso: no seguir escribiendo sin estado oficial durable.
            self.publish_official(copy.deepcopy(self.official))
        try:
            self.state['queue'] = self.box.health()
        except Exception as exc:
            self.storage_fault(exc)
        self.publish(copy.deepcopy(self.state))

    def close_rt(self):
        if self.rt is not None:
            client, self.rt = self.rt, None
            try:
                client.close()
            except BaseException:
                self.gate.fault = True
                raise
        if self.gate.fault or self.gate.active is not None:
            raise UnsafeSDKClosure('No iniciar otro turno sin cierre SDK confirmado.')

    def storage_fault(self, exc):
        self.paused = True
        self.state['storage_error'] = type(exc).__name__
        self.state['reader']['state'] = 'paused'
        self.close_rt()

    def run_cycle(self):
        self.close_rt()
        if self.stop():
            return False
        self.checked()
        self.state['phase'] = 'cycle'
        self.state['reader']['state'] = 'paused'
        if self.applying:
            self.official.update(phase='cycle', cycle_started_utc=self.utc())
        self.emit()
        try:
            result = self.cycle()
            self.checked()
            if self.gate.active is not None:
                raise UnsafeSDKClosure('El ciclo no libero el SDK.')
            status = 'verified' if self.applying else 'compared'
            if not isinstance(result, dict) or result.get('status') != status or result.get('mode') != self.state['mode']:
                raise RuntimeError('Resultado de ciclo incompatible con el modo.')
            self.state['cycle']['completed'] += 1
            self.state['cycle']['last_result'] = copy.deepcopy(result)
            if self.applying:
                self.official.update(last_ok_utc=self.utc(), consecutive_errors=0, last_error_type=None)
        except CycleInterrupted:
            return False
        except (UnsafeClosure, UnsafeSDKClosure, ReviewRequired):
            raise
        except Exception as exc:
            self.state['cycle']['errors'] += 1
            self.state['cycle']['last_error_type'] = type(exc).__name__
            if self.applying:
                self.official['consecutive_errors'] += 1
                self.official['last_error_type'] = type(exc).__name__
            # El callback puede fallar despues de un cierre incierto; verificar aunque no sea su tipo de excepcion.
            self.checked()
            if self.gate.active is not None:
                raise UnsafeSDKClosure('Ciclo fallido con SDK ocupado.') from None
        finally:
            if self.applying:
                self.official.update(cycle_finished_utc=self.utc(), phase='idle')
        self.state['phase'] = 'idle'
        self.emit()
        return True

    def read(self):
        try:
            self.box.ensure_capture_capacity()
            self.before_rt()
        except Exception as exc:
            self.storage_fault(exc)
            return
        self.checked()
        try:
            if self.rt is None:
                self.rt = self.rt_factory()
                self.rt.connect()
            if self.stop():
                self.close_rt()
                return
            item = self.rt.read()  # El trabajador guarda el original antes de responder.
        except (UnsafeClosure, UnsafeSDKClosure):
            raise
        except Exception as exc:
            self.paused = True
            self.state['reader_error'] = type(exc).__name__
            self.close_rt()
            self.state['reader']['state'] = 'paused'
            return
        try:
            capture_in_outbox(self.box, item)
        except Exception as exc:
            self.storage_fault(exc)
            return
        kind = classify(item)
        self.state['reader'] = {'state': kind, 'checked_at_utc': item['ended_utc']}
        if item['sdk_return_code'] < 0 or kind in ('unknown', 'paused'):
            self.paused = True
            self.state['reader_error'] = 'sdk_error' if item['sdk_return_code'] < 0 else 'uninterpreted_response'
            self.state['sdk']['last_error_code'] = item['sdk_return_code']
            self.close_rt()
        else:
            self.state['sdk'] = {'last_ok_utc': item['ended_utc'], 'last_error_code': None}
        return item

    def form_batch(self):
        self.box.build_batch()

    def queue_state(self):
        # Readonly nunca presenta una comparacion candidata como vigencias aplicadas.
        value = self.official if self.applying else self.observed()
        if value is None:
            return
        allowed = set(self.official)
        snapshot = {key: val for key, val in value.items() if key in allowed}
        health = self.box.health()
        self.box.enqueue_state({'reported_at_utc': self.utc(), 'agent_version': self.version,
            'worker_version': self.version, 'pid': os.getpid(), 'vigencias': snapshot,
            'sdk': dict(self.state['sdk']), 'reader': dict(self.state['reader']),
            'sender': {'pending_count': health['pending_count'], 'oldest_pending_at_utc': health['oldest_pending_utc']}})

    def watch_sender(self):
        try:
            self.state['sender'] = self.sender.snapshot()
            if self.state['sender'].get('process_exited'):
                self.state['sender_error'] = 'sender_exited'
        except Exception as exc:
            # La red/emisor no es fuente ni semaforo de vigencias.
            self.state['sender_error'] = type(exc).__name__

    def run(self, seconds=None):
        if seconds is not None and (type(seconds) not in (int, float) or not 1 <= seconds <= 86400):
            raise ValueError('Duracion invalida.')
        start = self.clock()
        deadline = float('inf') if seconds is None else start + seconds
        next_cycle = next_rt = next_batch = next_state = start
        self.checked()
        failed = False
        try:
            self.sender.start()
            self.emit()
            while self.clock() < deadline:
                if self.stop():
                    self.state['stop_reason'] = 'requested'
                    break
                self.checked()
                if self.clock() >= next_cycle:
                    if not self.run_cycle():
                        self.state['stop_reason'] = 'requested'
                        break
                    next_cycle = self.clock() + self.intervals[0]
                    continue
                if self.clock() >= next_batch and not self.paused:
                    try:
                        self.form_batch()
                    except Exception as exc:
                        self.storage_fault(exc)
                    next_batch = self.clock() + 5
                if self.clock() >= next_state and not self.paused:
                    try:
                        self.queue_state()
                    except Exception as exc:
                        self.storage_fault(exc)
                    next_state = self.clock() + self.intervals[2]
                self.watch_sender()
                if not self.stop() and self.clock() < min(deadline, next_cycle) and not self.paused and self.clock() >= next_rt:
                    self.read()
                    next_rt = self.clock() + self.intervals[1]
                self.state['phase'] = 'idle'
                self.emit()
                self.sleep(min(self.tick_interval, max(0, min(deadline, next_cycle) - self.clock())))
            self.state['stop_reason'] = self.state['stop_reason'] or 'limit'
        except CycleInterrupted:
            self.state['stop_reason'] = 'requested'
        except BaseException as exc:
            failed = True
            self.state.update(stop_reason=type(exc).__name__, error_type=type(exc).__name__)
            raise
        finally:
            self.state['phase'] = 'stopping'
            errors = []
            try:
                self.close_rt()
            except BaseException as exc:
                errors.append(exc)
            try:
                # Incluso si RT falla, recoger SOLO nuestro emisor. No habilitar tareas aqui.
                if self.sender.close() is not True:
                    raise StopUnconfirmed('Falta salida/recibo del emisor propio.')
            except BaseException as exc:
                errors.append(exc)
            self.state['closures_confirmed'] = not errors and not self.gate.fault and self.gate.active is None
            self.state['phase'] = 'fault' if failed or not self.state['closures_confirmed'] else 'stopped'
            self.state['reader']['state'] = 'paused'
            if self.applying:
                # Un fallo SDK no se disfraza de stopped protocol2; el watchdog conserva alarma.
                self.official['phase'] = 'stopped' if self.state['phase'] == 'stopped' else 'cycle'
            self.emit()
            if errors:
                raise StopUnconfirmed('Cierre integrado sin confirmar; conservar evidencia.') from None
        return copy.deepcopy(self.state)
