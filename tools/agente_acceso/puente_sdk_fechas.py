"""Binding candidato de fechas existentes. Sin CLI ni permisos emitidos aqui."""
import csv
import ctypes
import io
import hashlib
import json
from pathlib import Path

import adaptadores_cierre as closures
import vigencias_candidato as core
from aplicacion_vigencias import Approval, ScopeRejected, parse_date
from puente_sdk_readonly import ReadOnlyPanel


class DatesPanel(ReadOnlyPanel):
    def __init__(self, approval, evidence, diagnostic=None):
        if not isinstance(approval, Approval):
            raise ScopeRejected('Aprobacion de alcance requerida.')
        self.approval, self.evidence = approval, Path(evidence)
        self.serial_verified = False
        super().__init__(diagnostic)

    def open(self):
        if self.approval.check()['c3_change'] is not True:
            raise ScopeRejected('El plan no autoriza cambios C3.')
        if self.sdk is not None or self.directory is not None or self.handle:
            raise RuntimeError('Panel ya abierto.')
        self.diag.maintenance_guard()
        self.sdk, self.directory, info = self.diag.load_sdk()
        self.sdk_sha256 = info['sha256']
        if self.sdk_sha256 != closures.SDK_HASH:
            raise closures.ControllerIdentityError('Biblioteca distinta.')
        # Misma ABI de cuatro argumentos del c3_panel r2 instalado; antes de Connect.
        self.sdk.SetDeviceData.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p]
        self.sdk.SetDeviceData.restype = ctypes.c_int
        self.handle = self.sdk.Connect(self.diag.CONNECTION)
        if not self.handle:
            raise RuntimeError('Conexion rechazada.')

    def serial(self):
        value = super().serial()
        self.serial_verified = value == core.SERIAL
        return value

    def read_table(self, table, condition):
        if not self.serial_verified or not self.handle:
            raise ScopeRejected('Controlador no confirmado.')
        buffer = ctypes.create_string_buffer(4 * 1024 * 1024)
        code = self.sdk.GetDeviceData(self.handle, buffer, len(buffer), table.encode('ascii'), b'*', condition.encode('ascii'), b'')
        if code < 0 or b'\0' not in buffer.raw:
            raise ValueError('Lectura SDK incompleta.')
        reader = csv.DictReader(io.StringIO(buffer.value.decode('utf-8', errors='strict')))
        rows = list(reader)
        if (reader.fieldnames is None or len(reader.fieldnames) != len(set(reader.fieldnames)) or
                len(rows) != code or any(None in row or any(v is None for v in row.values()) for row in rows)):
            raise ValueError('Recuento/campos SDK distintos.')
        return rows

    def user(self, card):
        self.approval.check(card)
        rows = self.read_table('user', 'CardNo=' + card)
        if (len(rows) != 1 or set(rows[0]) != core.USER_FIELDS or rows[0]['CardNo'] != card or
                not all(core.text(v) for v in rows[0].values())):
            raise ValueError('Usuario no unico/incompatible.')
        return rows[0]

    def permissions(self, pin):
        plan = self.approval.check()
        if pin != plan['c3_before']['Pin'] or not core.number(pin):
            raise ScopeRejected('Pin ajeno al plan.')
        rows = self.read_table('userauthorize', 'Pin=' + pin)
        for row in rows:
            if set(row) != {'Pin','AuthorizeTimezoneId','AuthorizeDoorId'} or row['Pin'] != pin or not all(core.number(v) for v in row.values()):
                raise ValueError('Permisos incompatibles.')
        if len({core.encoded(row) for row in rows}) != len(rows):
            raise ValueError('Permisos duplicados.')
        return sorted(rows, key=core.encoded)

    def write_dates(self, values):
        plan = self.approval.check()
        end = parse_date(plan['api_end'])
        expected = {'CardNo': plan['card'], 'Pin': plan['c3_before']['Pin'], 'StartTime':'20200101', 'EndTime':end.strftime('%Y%m%d')}
        if not self.serial_verified or not self.handle or values != expected or set(values) != core.FIELDS:
            raise ScopeRejected('Escritura fuera del alcance confirmado.')
        # Exclusivo/fsync antes del intento: no repetir un SetDeviceData tras corte.
        core.durable(self.evidence / 'write_attempt.json', core.encoded({'plan_sha256':self.approval.sha256,
            'serial':core.SERIAL,'card':plan['card'],'started_utc':closures.now()}))
        self.approval.consume('c3')
        raw = '\t'.join(key + '=' + values[key] for key in ('CardNo','Pin','StartTime','EndTime')).encode('utf-8')
        if self.sdk.SetDeviceData(self.handle,b'user',raw,b'') != 0:
            raise RuntimeError('Escritura SDK no confirmada.')


def run_scoped_worker(folder, digest, approval, backup_dir, diagnostic=None):
    """Entrada para futuro padre autorizado. No hay CLI que emita Approval."""
    if not isinstance(approval, Approval):
        raise ScopeRejected('Aprobacion requerida.')
    plan = approval.check()
    if any((Path(folder) / name).exists() for name in ('write_attempt.json','closed.json','parent_ack.json','response.json')):
        raise ScopeRejected('Trabajador ya intentado/cerrado; no repetir.')
    path = Path(folder) / 'operation.json'
    if path.stat().st_size > closures.MAX_RESPONSE:
        raise ScopeRejected('Solicitud excedida.')
    raw = path.read_bytes()
    expected = {'mode':'apply','changes':[{'card':plan['card'],'before':plan['c3_before'],'end':parse_date(plan['api_end']).strftime('%Y%m%d')}]}
    if hashlib.sha256(raw).hexdigest() != digest or json.loads(raw) != expected or not plan['c3_change']:
        raise ScopeRejected('Solo se permite el cambio exacto de un tag confirmado.')
    root = Path(backup_dir)
    backed_plan = json.loads((root / 'plan.json').read_bytes())
    backed = json.loads((root / 'backup.json').read_bytes())
    intent = json.loads((root / 'intent_c3.json').read_bytes())
    if (core.encoded(backed_plan) != approval.raw or backed.get('plan_sha256') != approval.sha256 or
            backed.get('access_before') != plan['access_before'] or backed.get('c3_before') != plan['c3_before'] or
            backed.get('serial') != core.SERIAL or backed.get('card') != plan['card'] or
            intent.get('plan_sha256') != approval.sha256 or intent.get('component') != 'c3'):
        raise ScopeRejected('Respaldo/intencion no vinculados al alcance aprobado.')
    return core.worker(folder, digest, lambda: DatesPanel(approval, folder, diagnostic))
