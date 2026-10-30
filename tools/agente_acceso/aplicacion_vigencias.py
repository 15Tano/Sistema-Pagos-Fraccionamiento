"""Aplicacion candidata acotada; sin CLI ni autorizacion real emitida aqui.

La API se consulta al preparar y antes de cada componente. Approval solo sirve
para transportar un alcance ya confirmado por el operador; su hash no sustituye
autorizacion humana/backend. Las pruebas crean exclusivamente aprobaciones ficticias.
"""
import datetime as dt
import hashlib
import json
from pathlib import Path
import uuid

import vigencias_candidato as core
from referencia_vigencias import load_reference
from referencia_vigencias import validate_api as validate_reference_api

START = dt.datetime(2020, 1, 1)


class ScopeRejected(PermissionError):
    pass


def utc_now():
    return dt.datetime.now(dt.timezone.utc)


def digest(value):
    return hashlib.sha256(core.encoded(value)).hexdigest()


def date_text(value):
    if value is None:
        return None
    if not isinstance(value, dt.datetime) or value.tzinfo is not None:
        raise ValueError('Fecha Access/API incompatible con r2.')
    return value.isoformat(sep=' ')


def parse_date(value):
    if value is None:
        return None
    parsed = dt.datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
    if date_text(parsed) != value:
        raise ValueError('Fecha no canonica.')
    return parsed


def access_snapshot(row):
    if (not isinstance(row, (list, tuple)) or len(row) != 5 or type(row[0]) is not int or row[0] < 1 or
            not core.number(str(row[1]).strip()) or
            (row[4] is not None and type(row[4]) not in (bool, int)) or row[4] not in (None, False, True, -1)):
        raise ValueError('Registro Access invalido.')
    return {'userid': row[0], 'card': str(row[1]).strip(), 'start': date_text(row[2]),
            'end': date_text(row[3]), 'valid_raw': None if row[4] is None else bool(row[4])}


def api_values(rows):
    # Mismas reglas y fuente r2; ninguna vigencia inventada por el candidato.
    return validate_reference_api(rows)


def make_plan(card, rows, access, c3):
    if not core.number(card) or card == '0':
        raise ScopeRejected('Seleccionar un tag existente.')
    expected = api_values(rows)
    if card not in expected or access is None or c3 is None:
        raise ScopeRejected('Tag ausente de API/Access/C3: no se crea ni recupera.')
    if (set(access) != {'userid', 'card', 'start', 'end', 'valid_raw'} or access['card'] != card or
            access_snapshot([access['userid'], card, parse_date(access['start']), parse_date(access['end']), access['valid_raw']]) != access or
            core.inventory([c3]) != {card: c3}):
        raise ScopeRejected('Identidad/estado anterior no confirmado.')
    end = expected[card]
    return {'protocol': 1, 'serial': core.SERIAL, 'card': card, 'api_end': date_text(end),
            'api_sha256': digest({k: date_text(v) for k, v in expected.items()}),
            'access_before': json.loads(core.encoded(access)), 'c3_before': json.loads(core.encoded(c3)),
            'access_change': access['start'] != date_text(START) or access['end'] != date_text(end) or access['valid_raw'] is not True,
            'c3_change': c3['StartTime'] != '20200101' or c3['EndTime'] != end.strftime('%Y%m%d')}


def validate_plan(plan):
    if (not isinstance(plan, dict) or set(plan) != {'protocol','serial','card','api_end','api_sha256',
            'access_before','c3_before','access_change','c3_change'} or type(plan['protocol']) is not int or
            plan['protocol'] != 1 or plan['serial'] != core.SERIAL or
            not isinstance(plan['api_sha256'], str) or len(plan['api_sha256']) != 64 or
            any(c not in '0123456789abcdef' for c in plan['api_sha256'])):
        raise ScopeRejected('Plan invalido.')
    rebuilt = make_plan(plan['card'], [{'card_no': plan['card'], 'expiration': plan['api_end']}],
                        plan['access_before'], plan['c3_before'])
    if any(plan[k] != rebuilt[k] or type(plan[k]) is not type(rebuilt[k]) for k in plan if k != 'api_sha256'):
        raise ScopeRejected('Plan inconsistente.')


class Approval:
    """Un tag y hash confirmados; no es una firma ni una credencial de backend."""
    def __init__(self, plan, *, confirmed=False, approved_sha256=None, clock=utc_now):
        validate_plan(plan)
        if confirmed is not True or approved_sha256 != digest(plan):
            raise ScopeRejected('Falta confirmacion explicita del plan exacto.')
        self.raw = core.encoded(plan)
        self.sha256, self.clock = digest(plan), clock
        self.created = clock()
        if self.created.tzinfo is None or self.created.utcoffset() != dt.timedelta(0):
            raise ScopeRejected('UTC requerido.')
        self.consumed = set()
        self.verified = set()

    @property
    def plan(self):
        return json.loads(self.raw)

    def check(self, card=None, end=None):
        age = (self.clock() - self.created).total_seconds()
        plan = self.plan
        if not 0 <= age <= 60 or digest(plan) != self.sha256:
            raise ScopeRejected('Aprobacion vencida o alterada.')
        if card is not None and card != plan['card']:
            raise ScopeRejected('Tag fuera del alcance confirmado.')
        if end is not None and end != parse_date(plan['api_end']):
            raise ScopeRejected('Vigencia fuera del alcance confirmado.')
        return plan

    def consume(self, component):
        if component not in ('c3', 'access') or component in self.consumed:
            raise ScopeRejected('Componente ajeno o repetido.')
        self.check()
        self.consumed.add(component)


def backup(folder, plan):
    validate_plan(plan)
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=False)
    raw = core.encoded(plan)
    core.durable(folder / 'plan.json', raw)
    core.durable(folder / 'backup.json', core.encoded({'protocol': 1, 'plan_sha256': digest(plan),
        'serial': core.SERIAL, 'card': plan['card'], 'access_before': plan['access_before'], 'c3_before': plan['c3_before']}))
    # Segundo archivo fsync confirma que ambos estados anteriores se guardaron.
    return digest(plan)


def check_evidence(root):
    """No reintentar tras un corte despues de intencion/escritura, aun sin marker."""
    for path in Path(root).glob('*/intent_*.json'):
        folder = path.parent
        try:
            plan = json.loads((folder / 'plan.json').read_bytes())
            validate_plan(plan)
            backed = json.loads((folder / 'backup.json').read_bytes())
            if backed != {'protocol':1,'plan_sha256':digest(plan),'serial':core.SERIAL,'card':plan['card'],
                          'access_before':plan['access_before'],'c3_before':plan['c3_before']}:
                raise ValueError('Respaldo alterado.')
            for component in ('c3','access'):
                intent_path = folder / ('intent_' + component + '.json')
                if intent_path.exists() != plan[component + '_change']:
                    raise ValueError('Intentos no corresponden al plan.')
                if intent_path.exists():
                    intent = json.loads(intent_path.read_bytes())
                    if intent.get('component') != component or intent.get('plan_sha256') != digest(plan):
                        raise ValueError('Intento alterado.')
            result = json.loads((folder / 'result.json').read_bytes())
            if (result.get('plan_sha256') != digest(plan) or result.get('card') != plan['card'] or
                    result.get('status') != 'verified' or result.get('error_type') is not None or
                    result.get('c3') != ('verified' if plan['c3_change'] else 'unchanged') or
                    result.get('access') != ('verified' if plan['access_change'] else 'unchanged')):
                raise ValueError('Ejecucion no verificada.')
        except (OSError, ValueError, TypeError, KeyError):
            raise core.ReviewRequired('Evidencia previa requiere revision; no repetir escrituras.') from None


class AccessDates:
    """Solo tres columnas USERINFO, con comparacion optimista y lectura posterior."""
    def __init__(self, connection):
        if getattr(connection, 'autocommit', None) is not False:
            raise ScopeRejected('Access requiere transaccion explicita, autocommit=False.')
        self.connection = connection

    def read(self, card):
        if not core.number(card):
            raise ValueError('Tag invalido.')
        cursor = self.connection.cursor()
        try:
            rows = cursor.execute('SELECT USERID, CardNo, acc_startdate, acc_enddate, set_valid_time FROM USERINFO WHERE CardNo = ?', card).fetchall()
        finally:
            cursor.close()
        if not rows:
            return None
        if len(rows) != 1:
            raise ValueError('Tag duplicado en Access.')
        return access_snapshot(tuple(rows[0]))

    def update(self, before, end, approval):
        approval.check(before['card'], end)
        if approval.plan['access_change'] is not True:
            raise ScopeRejected('El plan no autoriza cambios Access.')
        if approval.plan['c3_change'] and 'c3' not in approval.verified:
            raise ScopeRejected('C3 debe estar verificado antes de actualizar Access.')
        if before != approval.plan['access_before'] or self.read(before['card']) != before:
            raise ScopeRejected('Access cambio desde el plan aprobado.')
        where, values = ['USERID = ?', 'CardNo = ?'], [before['userid'], before['card']]
        for name, value in (('acc_startdate', parse_date(before['start'])), ('acc_enddate', parse_date(before['end'])), ('set_valid_time', before['valid_raw'])):
            if value is None:
                where.append(name + ' IS NULL')
            else:
                where.append(name + ' = ?'); values.append(value)
        approval.consume('access')
        cursor = None
        try:
            cursor = self.connection.cursor()
            cursor.execute('UPDATE USERINFO SET acc_startdate = ?, acc_enddate = ?, set_valid_time = ? WHERE ' + ' AND '.join(where),
                           START, end, True, *values)
            if cursor.rowcount == 0:
                raise ScopeRejected('Access cambio antes del UPDATE.')
            expected = dict(before, start=date_text(START), end=date_text(end), valid_raw=True)
            if self.read(before['card']) != expected:
                raise RuntimeError('Verificacion Access fallida.')
            self.connection.commit()
            return expected
        except BaseException:
            self.connection.rollback()
            raise
        finally:
            if cursor is not None:
                cursor.close()


def execute(approval, fetch_api, access, panel_read, panel_apply, evidence_root):
    """Una ejecucion acotada, dependencias inyectadas; no genera aprobaciones."""
    plan = approval.check()
    check_evidence(evidence_root)
    card, end = plan['card'], parse_date(plan['api_end'])
    session = Path(evidence_root) / str(uuid.uuid4())
    def official():
        values = api_values(fetch_api())
        approval.check(card, values.get(card))
        if card not in values or values[card] != end:
            raise ScopeRejected('API cambio; preparar otro plan antes de aplicar.')
        return digest({k: date_text(v) for k, v in values.items()})
    # Toda validacion previa ocurre antes de cualquier escritura.
    first_api_sha = official()
    if access.read(card) != plan['access_before'] or panel_read(card) != plan['c3_before']:
        raise ScopeRejected('Datos cambiaron despues del plan.')
    backup(session, plan)
    result = {'protocol': 1, 'card': card, 'plan_sha256': approval.sha256, 'api_sha256': first_api_sha,
              'c3': 'unchanged', 'access': 'unchanged', 'status': 'running', 'error_type': None}
    attempted = False
    try:
        if plan['c3_change']:
            result['api_sha256'] = official()
            core.durable(session / 'intent_c3.json', core.encoded({'plan_sha256':approval.sha256,'component':'c3','started_utc':utc_now().isoformat()}))
            attempted = True
            result['c3'] = 'unconfirmed'
            response = panel_apply({'mode': 'apply', 'changes': [{'card': card, 'before': plan['c3_before'], 'end': end.strftime('%Y%m%d')}]}, approval, session)
            if response != {card: {'ok': True}}:
                raise core.ReviewRequired('Aplicacion C3 no confirmada.')
            approval.verified.add('c3')  # El callback debe validar recibo/salida antes de devolver ok.
            result['c3'] = 'verified'
        if plan['access_change']:
            result['api_sha256'] = official()
            core.durable(session / 'intent_access.json', core.encoded({'plan_sha256':approval.sha256,'component':'access','started_utc':utc_now().isoformat()}))
            attempted = True
            result['access'] = 'unconfirmed'
            access.update(plan['access_before'], end, approval)
            result['access'] = 'verified'
        result['status'] = 'verified' if attempted else 'no_changes'
        core.durable(session / 'result.json', core.encoded(result))
        return result
    except BaseException as exc:
        result['status'] = 'requires_review' if attempted else 'rejected'
        result['error_type'] = type(exc).__name__
        try:
            core.durable(session / 'result.json', core.encoded(result))
        finally:
            if attempted:
                raise core.ReviewRequired('Escritura parcial/incierta: conservar evidencia y revisar.') from None
        raise
