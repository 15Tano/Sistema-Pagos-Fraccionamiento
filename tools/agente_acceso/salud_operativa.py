"""Evaluacion candidata, sin IO/SDK: vigencias y componentes por separado."""
from control_operativo import identity, stamp


def result(status, reason=None):
    return {'status': status, 'reason': reason}


def assess_vigencias(state, since, now, *, minutes=5, task_state='Unknown',
                     maintenance_active=None, process_pid=None):
    if type(minutes) is not int or not 3 <= minutes <= 60:
        raise ValueError('Umbral de vigilancia invalido.')
    if task_state == 'Disabled' and maintenance_active is True:
        return result('mantenimiento')
    if task_state == 'Disabled':
        return result('desconocido', 'disabled_without_confirmed_maintenance')
    if maintenance_active is True:
        return result('desconocido', 'maintenance_task_mismatch')
    if task_state not in ('Running', 'Ready'):
        return result('desconocido', 'task_unavailable')
    if maintenance_active is not None and type(maintenance_active) is not bool:
        return result('desconocido', 'invalid_maintenance_record')
    try:
        baseline = stamp(since)
        if baseline > now:
            raise ValueError('Referencia de vigilancia futura.')
        if state is None:
            return result('alerta', 'missing_state') if (now - baseline).total_seconds() > minutes * 60 else result('iniciando')
        current = identity(state, allow_legacy=True)
        if type(process_pid) is not int or process_pid != current['pid']:
            return result('desconocido', 'process_identity_unconfirmed')
        if state['phase'] in ('stopped', 'fault'):
            return result('alerta', 'unexpected_stop')
        if state.get('heartbeat_utc') is None:
            return result('desconocido', 'missing_heartbeat')
        for key, reason in (('heartbeat_utc', 'stale_heartbeat'), ('last_ok_utc', 'no_recent_successful_cycle')):
            value = stamp(state[key]) if state.get(key) is not None else baseline
            if value > now:
                raise ValueError('Fecha futura.')
            if (now - max(baseline, value)).total_seconds() > minutes * 60:
                return result('alerta', reason)
        errors = state.get('consecutive_errors')
        if type(errors) is not int or errors < 0:
            raise ValueError('Contador invalido.')
        if errors:
            return result('degradado', 'cycle_errors')
        if state.get('last_ok_utc') is None:
            return result('iniciando', 'no_successful_cycle_yet')
        return result('correcto')
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
        return result('desconocido', 'invalid_state_or_clock')


def _reader_health(reader, phase, now, minutes):
    try:
        if not isinstance(reader, dict) or (reader.get('error') is not None and type(reader['error']) is not str):
            raise ValueError('Estado de lector invalido.')
        if reader.get('error'):
            return result('degradado', 'reader_error')
        if reader.get('state') == 'paused' and phase == 'cycle':
            return result('pausado', 'vigencias_turn')
        if reader.get('state') in ('catching_up', 'status_observed'):
            age = (now - stamp(reader['checked_at_utc'])).total_seconds()
            return result('correcto') if 0 <= age <= minutes * 60 else result('desconocido', 'stale_reader')
        return result('desconocido', 'reader_not_observed')
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
        return result('desconocido', 'invalid_reader')


def _sender_health(sender, now, minutes):
    try:
        if not isinstance(sender, dict):
            raise ValueError('Estado de emisor invalido.')
        pending, oldest = sender['pending_count'], sender['oldest_pending_utc']
        if type(pending) is not int or pending < 0 or type(sender.get('paused')) is not str:
            raise ValueError('Estado pendiente invalido.')
        if pending == 0 and oldest is not None:
            raise ValueError('Fecha pendiente sin pendientes.')
        age = (now - stamp(sender['checked_at_utc'])).total_seconds()
        if not 0 <= age <= minutes * 60:
            return result('desconocido', 'stale_sender')
        if sender['paused']:
            return result('degradado', 'sender_paused')
        if pending:
            age = (now - stamp(oldest)).total_seconds()
            if age < 0:
                raise ValueError('Pendiente futuro.')
            return result('degradado' if age > minutes * 60 else 'pendiente', 'pending_delivery')
        return result('sin_pendientes')
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
        return result('desconocido', 'invalid_sender')


def assess_components(state, components, now, *, minutes=5):
    unknown = lambda reason: {'reader': result('desconocido', reason), 'sender': result('desconocido', reason)}
    if type(minutes) is not int or not 3 <= minutes <= 60:
        raise ValueError('Umbral de componentes invalido.')
    if components is None:
        return unknown('components_absent')
    try:
        current = identity(state, allow_legacy=True)
        if 'run_id' not in current:
            return unknown('legacy_run_without_components_identity')
        if not isinstance(components, dict):
            return unknown('invalid_components')
        if (type(components.get('pid')) is not int or components.get('pid') != current['pid'] or
                components.get('run_id') != current['run_id'] or components.get('mode') != 'operativo'):
            return unknown('components_not_available_for_current_run')
        age = (now - stamp(components['heartbeat_utc'])).total_seconds()
        if not 0 <= age <= minutes * 60:
            return unknown('stale_components')
        if state['phase'] in ('stopped', 'fault'):
            return unknown('execution_stopped')
        return {'reader': _reader_health(components.get('reader'), state['phase'], now, minutes),
                'sender': _sender_health(components.get('sender'), now, minutes)}
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
        return unknown('invalid_components')
