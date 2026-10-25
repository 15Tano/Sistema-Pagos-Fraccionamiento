"""Evaluar emisor por identidad y frescura, sin ocultar salud de vigencias."""
import datetime as dt


def utc(value):
    result = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None or result.utcoffset() != dt.timedelta(0):
        raise ValueError('UTC explicito requerido.')
    return result


def assess_sender(state, identity, now, *, expected_stopped=False):
    unknown = lambda reason: {'status': 'desconocido', 'reason': reason}
    try:
        if not isinstance(state, dict) or state.get('protocol') != 1:
            return unknown('missing_or_invalid_state')
        if any(state.get(key) != identity[key] for key in ('pid', 'run_id')):
            return unknown('worker_identity_mismatch')
        age = (now - utc(state['heartbeat_utc'])).total_seconds()
        if not 0 <= age <= 20:
            return unknown('stale_or_future_worker')
        health = state['health']
        pending = health['pending_count']
        if type(pending) is not int or pending < 0 or type(health['paused']) is not bool:
            return unknown('invalid_queue_health')
        if state['phase'] == 'fault':
            return {'status': 'degradado', 'reason': 'sender_fault'}
        if health['paused'] or state['phase'] == 'blocked':
            return {'status': 'degradado', 'reason': 'sender_paused'}
        if state['phase'] == 'stopped':
            return {'status': 'detenido' if expected_stopped else 'degradado',
                    'reason': 'bounded_run_finished' if expected_stopped else 'unexpected_sender_stop'}
        if state['phase'] not in ('starting', 'sending', 'idle', 'backoff'):
            return unknown('invalid_worker_phase')
        if pending:
            age = (now - utc(health['oldest_pending_utc'])).total_seconds()
            if age < 0:
                return unknown('future_pending')
            return {'status': 'degradado' if age > 300 or state.get('last_delivery_outcome') == 'retry' else 'pendiente',
                    'reason': 'pending_delivery'}
        if health['oldest_pending_utc'] is not None:
            return unknown('pending_date_without_pending')
        ack = state.get('last_ack_utc')
        if ack is not None and 0 <= (now - utc(ack)).total_seconds() <= 300:
            return {'status': 'sin_pendientes', 'reason': 'ack_observed_in_this_run'}
        return {'status': 'sin_pendientes', 'reason': 'transport_not_verified_in_this_run'}
    except (KeyError, ValueError, TypeError, AttributeError, OverflowError):
        return unknown('invalid_worker_health')


def combined(operational, worker, identity, now, *, expected_stopped=False):
    # Una alerta de fechas permanece visible aunque el emisor este al dia.
    return {'scope': 'vigilancia_candidata_envio_y_operacion_sin_cambiar_estado_instalado',
            'checked_utc': now.isoformat(), 'operacion_observada': operational,
            'emisor': assess_sender(worker, identity, now, expected_stopped=expected_stopped)}
