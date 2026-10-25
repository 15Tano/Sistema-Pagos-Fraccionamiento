"""Nucleo candidato read/apply; sin CLI, DLL, conexion ni lanzador de hardware.

Panel y comando hijo son dependencias obligatorias. La entrada operativa real
queda para la siguiente entrega; aqui solo se prueban contratos y procesos ficticios.
"""
import datetime as dt
import hashlib
import json
import logging
import os
from pathlib import Path
import types

import adaptadores_cierre as closures
from captura_rt import UnsafeClosure
from referencia_vigencias import load_reference
from trabajador_controlado import run_closed_worker

FIELDS = {'CardNo', 'Pin', 'StartTime', 'EndTime'}
USER_FIELDS = FIELDS | {'Password', 'Group', 'SuperAuthorize'}
SERIAL = 'CO2K225060027'


class ReviewRequired(UnsafeClosure):
    """SDK cerrado, pero una escritura requiere revision; no equivale a cierre incierto."""


def encoded(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode('ascii')


def durable(path, raw):
    with Path(path).open('xb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())


def text(value):
    return (isinstance(value, str) and len(value) <= 128 and
            not any(ord(c) < 32 or ord(c) == 127 for c in value))


def number(value):
    return text(value) and 0 < len(value) <= 32 and value.isascii() and value.isdigit()


def validate(payload):
    if not isinstance(payload, dict):
        raise ValueError('Operacion invalida.')
    if payload == {'mode': 'read'}:
        return
    if set(payload) != {'mode', 'changes'} or payload['mode'] != 'apply':
        raise ValueError('Operacion no permitida.')
    if not isinstance(payload['changes'], list) or not 1 <= len(payload['changes']) <= 10000:
        raise ValueError('Lote invalido.')
    seen = set()
    for change in payload['changes']:
        if (not isinstance(change, dict) or set(change) != {'card', 'before', 'end'} or
                not number(change['card']) or change['card'] in seen or
                not isinstance(change['before'], dict) or set(change['before']) != FIELDS or
                change['before']['CardNo'] != change['card'] or not number(change['before']['Pin']) or
                not all(text(v) for v in change['before'].values())):
            raise ValueError('Cambio invalido.')
        end = change['end']
        if not isinstance(end, str) or len(end) != 8 or not end.isascii() or not end.isdigit():
            raise ValueError('Fecha invalida.')
        if dt.datetime.strptime(end, '%Y%m%d') < dt.datetime(2020, 1, 1):
            raise ValueError('Fecha fuera de regla r2.')
        seen.add(change['card'])


def inventory(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError('Inventario vacio/invalido.')
    result = {}
    for row in rows:
        if (not isinstance(row, dict) or not FIELDS <= set(row) or
                not all(text(row[k]) for k in FIELDS) or
                not number(row['CardNo']) or not number(row['Pin']) or row['CardNo'] in result):
            raise ValueError('Inventario incompleto/duplicado.')
        result[row['CardNo']] = {k: row[k] for k in sorted(FIELDS)}
    return result


def apply_dates(panel, changes):
    """Misma secuencia r2; solo cuatro campos enviados, resto verificado intacto."""
    results = {}
    for change in changes:
        card, attempted = change['card'], False
        try:
            row = panel.user(card)
            if (not isinstance(row, dict) or set(row) != USER_FIELDS or
                    not all(text(v) for v in row.values()) or
                    any(row[k] != v for k, v in change['before'].items())):
                raise ValueError('Registro cambio antes de escribir.')
            permissions = panel.permissions(row['Pin'])
            # El adaptador de hardware debera devolver snapshots independientes.
            permissions = json.loads(json.dumps(permissions))
            expected = dict(row, StartTime='20200101', EndTime=change['end'])
            attempted = True
            panel.write_dates({k: expected[k] for k in sorted(FIELDS)})
            if panel.user(card) != expected or panel.permissions(row['Pin']) != permissions:
                raise ValueError('Verificacion posterior fallida.')
            results[card] = {'ok': True}
        except Exception:
            # Nada de str(exc): SDK/ODBC pueden incluir informacion privada.
            results[card] = {'ok': False, 'error': 'write_requires_review' if attempted else 'precondition_failed',
                             'requires_review': attempted}
            break  # No escribir el resto de un lote despues del primer fallo.
    return results


def validate_result(payload, data):
    if payload['mode'] == 'read':
        if not isinstance(data, dict) or inventory(list(data.values())) != data:
            raise ValueError('Resultado de inventario invalido.')
        return
    cards = [c['card'] for c in payload['changes']]
    if not isinstance(data, dict) or not data or set(data) != set(cards[:len(data)]):
        raise ValueError('Resultado no corresponde al lote.')
    failed = False
    for card in cards[:len(data)]:
        item = data[card]
        if failed:
            raise ValueError('Resultado posterior a fallo.')
        if isinstance(item, dict) and set(item) == {'ok'} and item['ok'] is True:
            continue
        if (not isinstance(item, dict) or set(item) != {'ok', 'error', 'requires_review'} or
                item['ok'] is not False or type(item['requires_review']) is not bool or
                item['error'] != ('write_requires_review' if item['requires_review'] else 'precondition_failed')):
            raise ValueError('Fallo de aplicacion invalido.')
        failed = True
    if not failed and len(data) != len(cards):
        raise ValueError('Lote incompleto sin error.')


def worker(folder, expected_sha256, panel_factory):
    """Worker inyectable: panel abre/cierra recursos; no existe factory SDK aqui."""
    folder = Path(folder)
    request = closures.request_at(folder / 'request.json')
    if request['role'] != 'vigencias':
        raise ValueError('Turno ajeno.')
    raw = (folder / 'operation.json').read_bytes()
    if len(raw) > closures.MAX_RESPONSE or hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise ValueError('Operacion alterada.')
    payload = json.loads(raw)
    validate(payload)  # Antes de construir/abrir panel alguno.
    panel, clean, opened, response, error = None, True, False, None, None
    sdk_hash, started = None, closures.now()
    try:
        panel = panel_factory()
        opened = True  # Incluso open fallido debe intentar cerrar recursos parciales.
        panel.open()
        sdk_hash = panel.sdk_sha256
        if sdk_hash != closures.SDK_HASH or panel.serial() != SERIAL:
            raise closures.ControllerIdentityError('Identidad no confirmada.')
        data = inventory(panel.inventory()) if payload['mode'] == 'read' else apply_dates(panel, payload['changes'])
        validate_result(payload, data)
        response = encoded({'operation_sha256': expected_sha256, 'mode': payload['mode'], 'data': data})
        if len(response) > closures.MAX_RESPONSE:
            raise ValueError('Respuesta excedida.')
    except Exception as exc:
        error, response = type(exc).__name__, None
    finally:
        if opened:
            try:
                panel.disconnect()
            except BaseException:
                clean = False
            try:
                panel.close_library()
            except BaseException:
                clean = False
        if response is not None:
            durable(folder / 'response.json', response)
        closures.write_closure(folder, request, started=started, closed=clean,
            operation_ok=response is not None, sdk_sha256=sdk_hash, error_type=error, response=response)
    return 0 if clean else 1


def read_result(folder, digest, payload, closed):
    if not closed['operation_ok']:
        return None
    envelope = closures.bounded_json(folder / 'response.json', closures.MAX_RESPONSE)
    if (set(envelope) != {'operation_sha256', 'mode', 'data'} or
            envelope['operation_sha256'] != digest or envelope['mode'] != payload['mode']):
        raise ValueError('Recibo de otra operacion.')
    validate_result(payload, envelope['data'])
    return envelope['data']


def check_operations(base):
    """Recibos son autoridad aun si fallo guardar la marca adicional de revision."""
    base = Path(base)
    count = closures.check_ledger(base)
    try:
        for path in base.glob('*/operation.json'):
            if path.stat().st_size > closures.MAX_RESPONSE:
                raise UnsafeClosure('Operacion previa excedida.')
            raw = path.read_bytes()
            payload = json.loads(raw)
            validate(payload)
            folder = path.parent
            ack = closures.bounded_json(folder / 'parent_ack.json')
            closed = closures.verified_closure(folder, ack['pid'])
            result = read_result(folder, hashlib.sha256(raw).hexdigest(), payload, closed)
            if (closed['error_type'] == 'ControllerIdentityError' or
                    (payload['mode'] == 'apply' and (result is None or any(i.get('requires_review') for i in result.values())))):
                raise ReviewRequired('Recibo previo requiere revision de aplicacion.')
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        raise UnsafeClosure('Recibos operativos previos no confirmados.') from None
    return count


class Exchange:
    """Turno hijo con recibo: command_factory obligatorio, aun sin launcher real."""
    def __init__(self, gate, base, run_id, command_factory, *, timeout=300):
        self.gate, self.base, self.run_id = gate, Path(base), run_id
        self.command_factory, self.timeout = command_factory, timeout
        self.review = self.base.parent / 'revision_vigencias.json'

    def __call__(self, payload):
        validate(payload)
        if self.review.exists():
            raise ReviewRequired('Aplicacion anterior pendiente de revision.')
        check_operations(self.base)
        folder = closures.new_session(self.base, self.run_id, 'vigencias')
        raw = encoded(payload)
        payload = json.loads(raw)  # Snapshot propio; no depender de un dict mutable del llamador.
        if len(raw) > closures.MAX_RESPONSE:
            raise ValueError('Solicitud excedida.')
        digest = hashlib.sha256(raw).hexdigest()
        durable(folder / 'operation.json', raw)
        def proof(child):
            closed = closures.verified_closure(folder, child.pid)
            read_result(folder, digest, payload, closed)
            closures.acknowledge(folder, child.pid)  # ACK durable ANTES de liberar el gate.
            return True
        try:
            child = run_closed_worker(self.gate, 'vigencias', self.command_factory(folder, digest),
                verify_closed=proof, timeout=self.timeout)
        except BaseException:
            closures.fatal(self.gate, self.base, self.run_id, 'candidate_worker_unconfirmed')
        closed = closures.verified_closure(folder, child.pid)
        if not closed['operation_ok']:
            if closed['error_type'] == 'ControllerIdentityError' or payload['mode'] == 'apply':
                self.mark_review(folder, 'operation_failed')
                raise ReviewRequired('Operacion fallida; revisar evidencia.')
            raise RuntimeError('Inventario fallido con cierre confirmado.')
        result = read_result(folder, digest, payload, closed)
        if payload['mode'] == 'apply' and any(item.get('requires_review') for item in result.values()):
            self.mark_review(folder, 'write_verification_failed')
        return result

    def mark_review(self, folder, reason):
        try:
            closures.atomic_json(self.review, {'run_id': self.run_id, 'worker_id': folder.name,
                                             'reason': reason, 'checked_utc': closures.now()})
        except BaseException:
            closures.fatal(self.gate, self.base, self.run_id, 'review_not_durable')


class ReferenceCycle:
    """Algoritmo r2 intacto; reemplaza solo transporte de inventario/aplicacion."""
    def __init__(self, password, exchange, workdir, *, apply=False):
        if type(apply) is not bool:
            raise ValueError('Modo explicito requerido.')
        self.password, self.exchange, self.apply = password, exchange, apply
        self.module = load_reference()
        def safe_error(message, *args):
            logging.error(message, *(type(value).__name__ if isinstance(value, BaseException) else value for value in args))
        # La logica r2 no cambia; sus errores ODBC no imprimen mensajes de excepcion.
        self.module.logging = types.SimpleNamespace(info=logging.info, error=safe_error)
        self.module.ROOT = Path(workdir)
        for name in ('registros', 'respaldos'):
            (self.module.ROOT / name).mkdir(parents=True, exist_ok=True)
        self.module.worker = self.dispatch

    def dispatch(self, payload):
        if payload.get('mode') == 'apply' and not self.apply:
            raise ValueError('Ciclo readonly no admite aplicar.')
        return self.exchange(payload)

    def __call__(self):
        if self.exchange.review.exists():
            raise ReviewRequired('Aplicacion anterior pendiente de revision.')
        try:
            return self.module.cycle(self.password, self.apply, None)
        finally:
            if self.exchange.review.exists():
                # R2 ya proceso resultados por tag; no abrir RT/otro ciclo despues.
                raise ReviewRequired('Aplicacion requiere revision; SDK cerrado.') from None
