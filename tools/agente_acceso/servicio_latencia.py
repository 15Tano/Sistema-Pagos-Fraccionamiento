"""Candidato opt-in: lectura .5s, salud oportuna y agrupacion en el emisor.

Reutiliza el ciclo y cierre existentes. No permite otra conexion SDK en paralelo.
No instala ni autoriza aplicar vigencias. El runner anterior conserva defaults.
"""
import copy

from latencia_politicas import ReaderObservation
from servicio_integrado import Service

VERSION='latencia-candidata-2026.10.28-2'


class LatencyService(Service):
    version=VERSION

    def __init__(self,*args,**kwargs):
        kwargs.setdefault('rt_interval',.5)
        kwargs.setdefault('state_interval',2)
        kwargs.setdefault('tick_interval',.1)
        super().__init__(*args,**kwargs)
        self.observation=ReaderObservation(clock=self.clock)
        self.last_health=-float('inf')
        self.last_emit=-float('inf')
        self.emit_key=None

    def form_batch(self):
        pass  # Un unico agrupador: proceso emisor, aun durante un ciclo lento.

    def queue_state(self,*,urgent=False):
        if self.clock()-self.last_health<2 and not urgent:
            return
        super().queue_state()
        self.last_health=self.clock()

    def health(self,*,urgent=False):
        if self.state['storage_error']:
            return
        try:
            self.queue_state(urgent=urgent)
        except Exception as exc:
            self.storage_fault(exc)

    def run_cycle(self):
        self.observation.reset()
        self.state['reader']={'state':'paused','checked_at_utc':self.utc()}
        self.health(urgent=True)
        return super().run_cycle()

    def close_rt(self):
        super().close_rt()
        if hasattr(self,'observation'):
            self.observation.reset()

    def read(self):
        if self.rt is None:
            self.observation.reset()
        previous=copy.deepcopy(self.state['reader'])
        item=super().read()
        if item is None or self.paused:
            self.observation.reset()
            if self.state['reader_error']:
                self.health(urgent=True)
            return
        self.state['reader']=self.observation.observe(item)
        changed=previous['state']!=self.state['reader']['state']
        # Primera recuperacion y degradacion se publican pronto. No un estado
        # extra por cada evento de una cola que ya estaba recientemente vacia.
        self.health(urgent=changed)
        return item

    def emit(self):
        key=(self.state['phase'],self.state['reader_error'],self.state['storage_error'],
            self.state['sender_error'],self.state['closures_confirmed'])
        if key!=self.emit_key or self.clock()-self.last_emit>=.5:
            super().emit()
            self.last_emit,self.emit_key=self.clock(),key
