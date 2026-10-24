"""Contrato v1; no interpreta eventos ni calcula vigencias."""
import base64
import datetime as dt
import hashlib
import json
import re
import uuid

MAX_BODY = 1048576
MAX_STATE = 16384
MAX_RESPONSE = 524288


def identifier(value):
    return str(uuid.UUID(str(value)))


def utc(value):
    if not isinstance(value, str) or not re.fullmatch(
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)', value):
        raise ValueError('Fecha UTC invalida.')
    result = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.year < 1000:
        raise ValueError('Fecha fuera del contrato.')
    return result


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='microseconds')


def json_bytes(value):
    # El protocolo no utiliza floats. Evita diferencias Python/PHP y NaN/Infinity.
    def validate(item):
        if item is None or type(item) in (str, bool, int):
            return
        if isinstance(item, list):
            for child in item:
                validate(child)
        elif isinstance(item, dict) and all(isinstance(k, str) for k in item):
            for child in item.values():
                validate(child)
        else:
            raise ValueError('Tipo JSON fuera del protocolo.')
    validate(value)
    text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)
    # PHP JSON_UNESCAPED_UNICODE sigue escapando estos dos separadores.
    return text.replace('\u2028', r'\u2028').replace('\u2029', r'\u2029').encode('utf-8')


def digest(body):
    return hashlib.sha256(body).hexdigest()


def response(raw, source, code, started, ended, response_id=None, **context):
    if not isinstance(raw, bytes) or len(raw) > MAX_RESPONSE:
        raise ValueError('La respuesta debe ser bytes de hasta 512 KiB.')
    if source not in ('rt', 'transaction') or type(code) is not int or not -2147483648 <= code <= 2147483647:
        raise ValueError('Origen o retorno SDK invalido.')
    if utc(ended) < utc(started):
        raise ValueError('Fin anterior al inicio.')
    if set(context) - {'pc_local_time', 'windows_timezone'}:
        raise ValueError('Contexto no permitido.')
    for name, limit in [('pc_local_time', 40), ('windows_timezone', 100)]:
        value = context.get(name)
        if value is not None and (not isinstance(value, str) or len(value) > limit):
            raise ValueError('Contexto demasiado largo.')
    return {'response_id': identifier(response_id or uuid.uuid4()), 'source': source,
            'sdk_return_code': code, 'raw_payload_base64': base64.b64encode(raw).decode('ascii'),
            'sha256': digest(raw), 'captured_started_utc': started, 'captured_ended_utc': ended, **context}


def validate_ack(status, ack, payload, content_hash):
    if status not in (200, 201) or not isinstance(ack, dict):
        raise ValueError('ACK ausente o invalido.')
    if (type(ack.get('protocol_version')) is not int or ack['protocol_version'] != 1 or
            ack.get('status') != 'accepted' or ack.get('agent_id') != payload['agent_id'] or
            ack.get('content_sha256') != content_hash):
        raise ValueError('ACK no corresponde al mensaje.')
    utc(ack.get('server_received_at_utc'))
    if 'batch_id' not in payload:
        if (ack.get('session_id') != payload['session_id'] or type(ack.get('sequence')) is not int or
                ack['sequence'] != payload['sequence']):
            raise ValueError('ACK de otro reporte.')
        return
    fields = ('responses_stored', 'rows_stored', 'events_stored', 'statuses_stored',
              'responses_pending_interpretation')
    if any(type(ack.get(k)) is not int or ack[k] < 0 for k in fields):
        raise ValueError('Contadores de ACK invalidos.')
    if (ack.get('batch_id') != payload['batch_id'] or ack['responses_stored'] != len(payload['responses']) or
            ack['rows_stored'] != ack['events_stored'] + ack['statuses_stored'] or ack['rows_stored'] > 2000 or
            ack['responses_pending_interpretation'] > ack['responses_stored']):
        raise ValueError('Identidad o contadores de ACK inconsistentes.')
