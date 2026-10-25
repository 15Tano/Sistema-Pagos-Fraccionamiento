"""Bucle acotado del emisor: SQLite/HTTP existentes; sin SDK ni tareas."""
from collections import Counter
import datetime as dt
import time


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def safe_health(box):
    value = box.health()
    return {key: value[key] for key in ('messages', 'responses', 'unbatched', 'pending_count',
            'oldest_pending_utc')} | {'paused': bool(value['paused'])}


def run_sender(delivery, transport, identity, seconds, publish, stop, *, clock=time.monotonic,
               sleep=time.sleep, utc=utc_now):
    if type(seconds) is not int or not 5 <= seconds <= 180:
        raise ValueError('Ensayo permitido5..180s.')
    originals, messages = delivery.originals(), delivery.message_hashes()
    sender = delivery.lib.sender.Sender(delivery.box, transport)
    deadline, counts = clock() + seconds, Counter()
    state = {'protocol': 1, 'scope': 'emisor_backend_aislado_sin_sdk', **identity,
             'phase': 'starting', 'last_attempt_utc': None, 'last_ack_utc': None,
             'last_delivery_outcome': None, 'stop_reason': None}
    def update(phase):
        state.update(phase=phase, heartbeat_utc=utc(), health=safe_health(delivery.box), outcomes=dict(counts))
        publish(dict(state))
    update('starting')
    while clock() < deadline and not stop():
        if delivery.box.health()['paused']:
            state['stop_reason'] = 'blocked'
            break
        delivery.box.build_batch()  # Una transaccion pequena, nunca lectura SDK.
        update('sending')
        if stop() or clock() >= deadline:
            break
        state['last_attempt_utc'] = utc()
        outcome = sender.once()  # Respeta lease, ACK, pausa y esperas persistidas existentes.
        counts[outcome] += 1
        if outcome in ('acked', 'retry', 'blocked', 'lease_reassigned'):
            state['last_delivery_outcome'] = outcome
        if outcome == 'acked':
            state['last_ack_utc'] = utc()
        update('idle' if outcome in ('acked', 'idle') else 'backoff' if outcome in ('retry', 'lease_reassigned') else 'blocked')
        if outcome == 'blocked':
            state['stop_reason'] = 'blocked'
            break
        sleep(.5)  # Acotado a120intentos/minuto; no reinicia next_attempt ni leases.
    state['stop_reason'] = state['stop_reason'] or ('requested' if stop() else 'limit')
    after = {entry['response_id']: entry for entry in delivery.originals()}
    existing_messages = delivery.message_hashes()
    if (any(after.get(entry['response_id']) != entry for entry in originals) or
            any(existing_messages.get(key) != value for key, value in messages.items())):
        raise ValueError('Original o cuerpo existente modificado durante envio.')
    update('blocked' if state['stop_reason'] == 'blocked' else 'stopped')
    return dict(state) | {'originals_before': len(originals), 'originals_preserved': True,
                          'existing_messages_unchanged': True, 'delivery_report': delivery.report()}
