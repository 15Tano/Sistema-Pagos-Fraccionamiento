"""Contrato candidato de mantenimiento. No descubre ni modifica procesos/tareas."""
import datetime as dt
import json
import os
from pathlib import Path
import uuid


def stamp(value):
    if not isinstance(value, str):
        raise ValueError('Fecha UTC ausente.')
    result = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None or result.utcoffset() != dt.timedelta(0):
        raise ValueError('Se requiere fecha UTC explicita.')
    return result


def identity(state, *, allow_legacy=False):
    if (not isinstance(state, dict) or type(state.get('protocol')) is not int or state['protocol'] != 2 or
            type(state.get('pid')) is not int or state['pid'] < 1 or
            state.get('phase') not in ('starting', 'cycle', 'idle', 'stopped', 'fault')):
        raise ValueError('Estado de control invalido.')
    run_id = state.get('run_id')
    if run_id is None and allow_legacy:
        return {'pid': state['pid']}
    if not isinstance(run_id, str) or str(uuid.UUID(run_id)) != run_id:
        raise ValueError('Identidad de ejecucion ausente/invalida.')
    return {'pid': state['pid'], 'run_id': run_id}


def make_stop_request(state, *, allow_legacy=False):
    result = identity(state, allow_legacy=allow_legacy)
    if state['phase'] in ('stopped', 'fault'):
        raise ValueError('Ejecucion detenida o pendiente de revision.')
    return result


def matches_stop(state, request, *, allow_legacy=False):
    try:
        expected = identity(state, allow_legacy=allow_legacy)
        return (isinstance(request, dict) and set(request) == set(expected) and
                type(request.get('pid')) is int and request == expected)
    except (TypeError, ValueError, AttributeError):
        return False


def write_stop(folder, state, *, allow_legacy=False):
    """Solo para futuro adaptador autorizado; el inspector no llama esta funcion."""
    data = make_stop_request(state, allow_legacy=allow_legacy)
    target = Path(folder) / 'detener.sync.json'
    temporary = target.with_name(target.name + '.' + str(os.getpid()) + '.tmp')
    with temporary.open('x', encoding='utf-8') as stream:
        json.dump(data, stream)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, target)
    return data


def _target_identity(value, *, allow_legacy=False):
    allowed = ({'pid'}, {'pid', 'run_id'}) if allow_legacy else ({'pid', 'run_id'},)
    if not isinstance(value, dict) or set(value) not in allowed:
        raise ValueError('Identidad de referencia no confirmada.')
    return identity({'protocol': 2, 'phase': 'stopped'} | value, allow_legacy=allow_legacy)


def resume_check(state, runtime, previous_identity, process_pid, now, *, max_age=15,
                 allow_legacy_previous=False):
    """Proceso/ruta se validan por el adaptador; lock confirmado por runtime nuevo."""
    try:
        current = identity(state)
        if type(max_age) is not int or not 1 <= max_age <= 60:
            return 'invalid_freshness_limit'
        try:
            previous = _target_identity(previous_identity, allow_legacy=allow_legacy_previous)
        except (TypeError, ValueError, AttributeError):
            return 'previous_identity_unconfirmed'
        if type(process_pid) is not int or current['pid'] != process_pid:
            return 'process_identity_mismatch'
        if current['run_id'] == previous.get('run_id'):
            return 'previous_execution'
        if state['phase'] not in ('starting', 'cycle', 'idle'):
            return 'not_running'
        if (not isinstance(runtime, dict) or runtime.get('mode') != 'operativo' or
                type(runtime.get('pid')) is not int or
                runtime.get('pid') != current['pid'] or runtime.get('run_id') != current['run_id']):
            return 'runtime_identity_or_mode_mismatch'
        if runtime.get('lock_acquired') is not True or runtime.get('sdk_closure') != 'clean':
            return 'lock_or_sdk_not_confirmed'
        for value in (state['heartbeat_utc'], runtime['heartbeat_utc']):
            age = (now - stamp(value)).total_seconds()
            if age < 0 or age > max_age:
                return 'stale_state'
        return 'ready'
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
        return 'invalid_or_legacy_state'


def pause_check(state, expected_identity, *, process_present, lock_free, sdk_closure, revision_pending):
    if revision_pending is not False:
        return 'revision_pending_or_unknown'
    if process_present is not False:
        return 'process_still_present_or_unknown'
    if sdk_closure != 'clean':
        return 'sdk_not_confirmed'
    try:
        if identity(state) != _target_identity(expected_identity):
            return 'stop_identity_mismatch'
        if state['phase'] != 'stopped':
            return 'not_stopped'
    except (ValueError, TypeError, AttributeError):
        return 'invalid_or_legacy_state'
    return 'ready' if lock_free is True else 'lock_not_confirmed_free'
