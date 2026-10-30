"""Politicas puras del candidato: limites de envio y disponibilidad observada.

Sin SDK, red, credenciales ni autoridad de vigencias. No interpreta pagos.
"""
from collections import deque
import csv
import datetime as dt
import io
import time


class RequestBudget:
    """Ventana movil; incluye estados, lotes y todos los reintentos HTTP."""
    def __init__(self, maximum=90, period=60, *, clock=time.monotonic):
        if type(maximum) is not int or not 1 <= maximum <= 90 or period < 60:
            raise ValueError('Presupuesto fuera del candidato.')
        self.maximum,self.period,self.clock=maximum,period,clock
        self.attempts=deque()

    def delay(self):
        current=self.clock()
        while self.attempts and self.attempts[0] <= current-self.period:
            self.attempts.popleft()
        return max(0,self.attempts[0]+self.period-current) if len(self.attempts)>=self.maximum else 0

    def consume(self):
        if self.delay()>0:
            raise RuntimeError('Presupuesto HTTP agotado.')
        self.attempts.append(self.clock())


def payload_kind(raw):
    try:
        rows=list(csv.reader(io.StringIO(raw.decode('utf-8'))))
        rows=[r for r in rows if r]
        if not rows or any(len(r)!=7 or not r[4].isascii() or not r[4].isdigit() for r in rows):
            return 'unknown'
        for row in rows:
            dt.datetime.strptime(row[0],'%Y-%m-%d %H:%M:%S')
        return 'status' if all(int(r[4])==255 for r in rows) else 'event'
    except (ValueError,UnicodeError,csv.Error):
        return 'unknown'


class ReaderObservation:
    """Dos estados vacios por conexion; no confundir cada evento con backlog.

    status_observed conserva su sentido literal: se observo 255 recientemente.
    checked_at_utc sigue siendo el instante REAL de esa observacion, no el del
    HTTP ni el evento posterior. Un hueco largo exige volver a drenar.
    """
    def __init__(self, *, clock=time.monotonic, grace=2, max_gap=1.5):
        self.clock,self.grace,self.max_gap=clock,grace,max_gap
        self.reset()

    def reset(self):
        self.first_empty=None
        self.last_empty=None
        self.empty_stamp=None
        self.last_read=None
        self.confirmed=False

    def observe(self,item):
        current=self.clock()
        if self.last_read is not None and current-self.last_read>self.max_gap:
            self.reset()
        self.last_read=current
        kind=payload_kind(item['raw'])
        if item['sdk_return_code']<0 or not item['terminated'] or kind=='unknown':
            self.reset()
            return {'state':'paused','checked_at_utc':item['ended_utc']}
        if kind=='status':
            if self.first_empty is None:
                self.first_empty=current
            elif current-self.first_empty>=.3:
                self.confirmed=True
            self.last_empty=current
            self.empty_stamp=item['ended_utc']
        elif not self.confirmed:
            self.first_empty=None  # Estados deben ser consecutivos antes de confirmar.
        if self.confirmed and self.last_empty is not None and current-self.last_empty<=self.grace:
            return {'state':'status_observed','checked_at_utc':self.empty_stamp}
        if kind=='event':
            self.reset()
            self.last_read=current
        return {'state':'catching_up','checked_at_utc':item['ended_utc']}


class BatchPolicy:
    """Micro-lote de respuestas completas; estados 255 se agrupan sin perderlos."""
    def __init__(self,box,*,clock=time.monotonic,coalesce=.15,status_wait=5,min_gap=1.25):
        if coalesce<.1 or status_wait<1 or min_gap<1.25:
            raise ValueError('Cadencias fuera del candidato.')
        self.box,self.clock=box,clock
        self.coalesce,self.status_wait,self.min_gap=coalesce,status_wait,min_gap
        self.head=None
        self.since=0
        self.last=-float('inf')

    def tick(self):
        if self.box.health()['paused']:
            return None
        rows=self.box.db.execute('SELECT id,raw FROM responses WHERE message_id IS NULL ORDER BY rowid LIMIT 20').fetchall()
        if not rows:
            self.head=None
            return None
        current=self.clock()
        if rows[0]['id']!=self.head:
            self.head,self.since=rows[0]['id'],current
        urgent=any(payload_kind(row['raw'])!='status' for row in rows)
        due=self.coalesce if urgent else self.status_wait
        if current-self.last<self.min_gap or current-self.since<due:
            return None
        value=self.box.build_batch()
        if value is not None:
            self.last=current
            self.head=None
        return value
