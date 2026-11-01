"""Actualizar solo el recorrido de archivos, con mantenimiento, plan exacto y retorno de codigo."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import uuid

import produccion_config as config
import produccion_dell as production
import produccion_paquete as package
import sesion_operativa as ownership
from instalacion_operativa import durable, replace
from rutas_operativas import checked_path

OLD = '3eca5b039d106d5dbe383074b940d321fbe438b5a38a9964569a9316200e1a6e'
BASE_ZIP_SHA = 'e130384297c7c4ea859c2d5a157fea0ed3d9d4732b994fc9bc3930605ea3a812'
RELEASE = '2026.10.31-3'
BINDINGS = ('servicio-config.json', 'activacion-integrada.json', 'enlace-integrado.json')
ADDITIONS = {'LEEME_CORRECCION_ALMACEN.md', 'actualizar_almacen.py', 'tests/test_correccion_almacen.py'}
ALLOWED_DELTA_HASHES = {'almacen_operativo.py': '12165ab5c9b4ad8fe176606efe3f3068367aec2a43732a3806d10e94b5170c10', 'archivo_cierres.py': '07fb7bc472a899021e2884fdb8292289116ab23271aac0018182dfc52c0147b5', 'runner_operativo.py': '5210b5d98b2c6208a9a51cd8428cba3636b1bfebd461276cf1bf3ccbea8aada0', 'tests/test_almacen_operativo.py': '5bb39d532a9c836dc178f0b1f567d2df8c2abb5bbb40f40109dbe70a4de89118', 'produccion_paquete.py': 'de27021a0bba894b0f8ca0b6b7ad2ca83bf6283ad36ae74e6727dcf0c56909a0', 'runner_produccion.py': 'a02eb6b4dc2ebdcae94738a5761b07a2d623c7c8298f4d6be1ae1aed7fda525f'}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(value):
    return (json.dumps(value, indent=2, sort_keys=True) + '\n').encode('ascii')


def digest(value):
    return sha(encoded(value))


def read(path):
    path = checked_path(path)
    if path.stat().st_size > 262144:
        raise ValueError('Archivo de control excedido.')
    value = json.loads(path.read_bytes())
    if not isinstance(value, dict):
        raise ValueError('Objeto de control requerido.')
    return value


def manifest(folder, expected, release):
    folder = checked_path(folder)
    raw = (folder / 'OPERATIVA_SHA256SUMS.json').read_bytes()
    if len(raw) > 131072 or sha(raw) != expected:
        raise ValueError('Manifiesto distinto.')
    value = json.loads(raw)
    rows = value['files']
    names = [r['name'] for r in rows]
    if (value['release'] != release or value['scope'] != 'production_r2_reference' or
            not 170 <= len(names) <= 200 or len(names) != len(set(n.casefold() for n in names)) or
            not package.CRITICAL <= set(names)):
        raise ValueError('Release distinto.')
    for row in rows:
        name = row['name']
        parts = PurePosixPath(name)
        if (not name or parts.as_posix() != name or parts.is_absolute() or '..' in parts.parts or
                any(c in name for c in ('\\', ':', '\0'))):
            raise ValueError('Ruta de release invalida.')
        path = checked_path(folder / name)
        if path.stat().st_size > 16 * 1024 * 1024 or sha(path.read_bytes()) != row['sha256']:
            raise ValueError('Fuente de release distinta.')
    return value


class Update:
    def __init__(self, root, payload, *, guard, private):
        self.root, self.payload = checked_path(root), checked_path(payload)
        self.guard, self.private = guard, private

    def target(self):
        package.verify_package(self.payload)
        target = sha((self.payload / 'OPERATIVA_SHA256SUMS.json').read_bytes())
        current = manifest(self.root / 'integrado' / OLD, OLD, '2026.10.30-2')
        candidate = manifest(self.payload, target, RELEASE)
        old_names = {r['name'] for r in current['files']}
        new_names = {r['name'] for r in candidate['files']}
        if new_names != old_names | ADDITIONS:
            raise ValueError('Alcance de actualizacion distinto.')
        for name in old_names:
            before = (self.root / 'integrado' / OLD / name).read_bytes()
            expected = ALLOWED_DELTA_HASHES.get(name, sha(before))
            if sha((self.payload / name).read_bytes()) != expected:
                raise ValueError('La actualizacion contiene otros cambios.')
        return target, candidate

    def marker(self, key=None):
        path = self.root / 'revision_instalacion.json'
        if not path.exists():
            return None
        value = read(path)
        if (key is None or set(value) != {'protocol', 'purpose', 'update_id', 'plan_sha256'} or
                type(value.get('protocol')) is not int or value['protocol'] != 1 or
                value.get('purpose') != 'storage_scan_update' or value.get('update_id') != key):
            raise PermissionError('Revision de instalacion pendiente; conservar evidencia.')
        return value

    def bindings(self):
        return {name: checked_path(self.root / name).read_bytes() for name in BINDINGS}

    def plan(self):
        self.guard()
        self.marker()
        target, _ = self.target()
        settings = config.load(self.root)
        config.activation(self.root, settings)
        link = read(self.root / 'enlace-integrado.json')
        if (set(link) != {'protocol', 'installation_id', 'mode', 'release_sha256'} or
                type(link['protocol']) is not int or link['protocol'] != 1 or
                str(uuid.UUID(link['installation_id'])) != link['installation_id'] or
                link['mode'] != 'integrado' or settings.release_sha256 != OLD or link['release_sha256'] != OLD):
            raise PermissionError('Instalacion anterior distinta.')
        library = production.installer().library
        if ((self.root / library.ENTRY).read_bytes() != library.WRAPPER or
                (self.root / 'vigilar_sync.py').read_bytes() != library.MONITOR):
            raise PermissionError('Entradas instaladas distintas.')
        return {'protocol': 1, 'purpose': 'storage_scan_update', 'root': str(self.root),
            'before_release': OLD, 'after_release': target,
            'before': {name: sha(raw) for name, raw in self.bindings().items()},
            'scan_policy': 'windows_scandir', 'cross_call_size_cache': False,
            'dates_engine': config.ENGINE, 'sdk_opened': False, 'tasks_changed': False}

    def apply(self, approved):
        self.guard()
        ownership.require_locked(self.root / 'sync.lock')
        plan = self.plan()
        if digest(plan) != approved:
            raise PermissionError('El plan cambio o no fue aprobado.')
        target, candidate = self.target()
        destination = checked_path(self.root / 'integrado' / target)
        if destination.exists():
            raise PermissionError('Destino previo; no sobrescribir ni repetir instalacion.')
        size = sum((self.payload / r['name']).stat().st_size for r in candidate['files'])
        if shutil.disk_usage(self.root).free < size + 64 * 1024 * 1024:
            raise OSError('Sin reserva para actualizacion.')
        key = str(uuid.uuid4())
        backup = checked_path(self.root / 'actualizaciones_almacen' / key)
        self.private(backup)
        before = self.bindings()
        durable(backup / 'plan.json', encoded(plan))
        for name, raw in before.items():
            durable(backup / name, raw)
        self.guard()
        if {name: sha(raw) for name, raw in self.bindings().items()} != plan['before']:
            raise PermissionError('La configuracion cambio antes de aplicar.')
        marker = {'protocol': 1, 'purpose': plan['purpose'], 'update_id': key, 'plan_sha256': approved}
        durable(self.root / 'revision_instalacion.json', encoded(marker))
        try:
            self.private(destination)
            for row in candidate['files']:
                durable(destination / row['name'], (self.payload / row['name']).read_bytes())
            durable(destination / 'OPERATIVA_SHA256SUMS.json', (self.payload / 'OPERATIVA_SHA256SUMS.json').read_bytes())
            manifest(destination, target, RELEASE)
            settings = json.loads(before['servicio-config.json'])
            settings['release_sha256'] = target
            settings_raw = encoded(settings)
            activation = json.loads(before['activacion-integrada.json'])
            activation.update(release_sha256=target, config_sha256=sha(settings_raw),
                authorized_utc=datetime.now(timezone.utc).isoformat())
            link = json.loads(before['enlace-integrado.json'])
            link['release_sha256'] = target
            after = {'servicio-config.json': settings_raw, 'activacion-integrada.json': encoded(activation),
                'enlace-integrado.json': encoded(link)}
            durable(backup / 'intencion.json', encoded({'plan_sha256': approved,
                'after': {name: sha(raw) for name, raw in after.items()}}))
            # Escribir enlaces solo en mantenimiento, con lock y marca que bloquea otro arranque.
            for name in BINDINGS:
                replace(self.root / name, after[name])
            config.activation(self.root, config.load(self.root))
            self.guard()
            result = {'status': 'storage_update_installed_waiting_resume', 'update_id': key,
                'plan_sha256': approved, 'after': {name: sha(raw) for name, raw in after.items()},
                'release_sha256': target, 'sdk_opened': False, 'tasks_changed': False, 'dates_changed': False}
            durable(backup / 'resultado.json', encoded(result))
            if self.marker(key) != marker:
                raise PermissionError('Marca de revision distinta.')
            (self.root / 'revision_instalacion.json').unlink()  # Solo nuestra marca exacta tras verificar.
            return result
        except BaseException as exc:
            # Conservar codigo, datos, respaldo y bloqueo. La reversion exige otro plan exacto.
            durable(backup / ('fallo-' + str(uuid.uuid4()) + '.json'), encoded({'error_type': type(exc).__name__}))
            raise

    def rollback_plan(self, key):
        if str(uuid.UUID(key)) != key:
            raise ValueError('Identificador invalido.')
        self.guard()
        self.marker(key)
        backup = checked_path(self.root / 'actualizaciones_almacen' / key)
        plan = read(backup / 'plan.json')
        if (plan.get('purpose') != 'storage_scan_update' or plan.get('root') != str(self.root) or
                plan.get('before_release') != OLD or set(plan.get('before', {})) != set(BINDINGS)):
            raise ValueError('Respaldo de otra operacion.')
        for name in BINDINGS:
            if sha(checked_path(backup / name).read_bytes()) != plan['before'][name]:
                raise ValueError('Respaldo modificado.')
        config.activation(backup, config.load(backup))
        manifest(self.root / 'integrado' / OLD, OLD, '2026.10.30-2')
        current = {name: sha(raw) for name, raw in self.bindings().items()}
        result = read(backup / 'resultado.json') if (backup / 'resultado.json').exists() else None
        # Tras un fallo parcial se admite volver solo bajo la marca exacta de ese intento.
        marker = self.marker(key)
        if marker and marker.get('plan_sha256') != digest(plan):
            raise ValueError('Plan distinto de la marca de actualizacion.')
        reversal = read(backup / 'reversion_intencion.json') if (backup / 'reversion_intencion.json').exists() else None
        if reversal and (set(reversal) != {'update_id', 'update_plan_sha256', 'restore', 'approved_rollback_sha256'} or
                reversal['update_id'] != key or reversal['update_plan_sha256'] != digest(plan) or
                reversal['restore'] != plan['before']):
            raise ValueError('Intencion de reversion distinta.')
        if result:
            if result.get('update_id') != key or result.get('plan_sha256') != digest(plan):
                raise ValueError('Recibo de actualizacion distinto.')
            if current != result['after']:
                if marker is None or reversal is None or any(
                        value not in {plan['before'][name], result['after'][name]} for name, value in current.items()):
                    raise PermissionError('Configuracion posterior modificada; revisar antes de reversion.')
        else:
            if marker is None:
                raise PermissionError('Actualizacion sin recibo ni marca propia.')
            intention = read(backup / 'intencion.json') if (backup / 'intencion.json').exists() else None
            if intention and (intention.get('plan_sha256') != digest(plan) or set(intention.get('after', {})) != set(BINDINGS)):
                raise ValueError('Intencion de actualizacion distinta.')
            for name, value in current.items():
                allowed = {plan['before'][name]}
                if intention:
                    allowed.add(intention['after'][name])
                if value not in allowed:
                    raise PermissionError('Archivo modificado por otra operacion; no sobrescribir.')
        return {'protocol': 1, 'purpose': 'storage_scan_rollback', 'update_id': key,
            'root': str(self.root), 'current': current, 'restore': plan['before'], 'restore_release': OLD}

    def rollback(self, key, approved):
        ownership.require_locked(self.root / 'sync.lock')
        plan = self.rollback_plan(key)
        if digest(plan) != approved:
            raise PermissionError('Plan de reversion distinto.')
        backup = checked_path(self.root / 'actualizaciones_almacen' / key)
        marker = self.marker(key)
        if marker is None:
            marker = {'protocol': 1, 'purpose': 'storage_scan_update', 'update_id': key,
                'plan_sha256': read(backup / 'resultado.json')['plan_sha256']}
            durable(self.root / 'revision_instalacion.json', encoded(marker))
        intention = backup / 'reversion_intencion.json'
        if not intention.exists():
            durable(intention, encoded({'update_id': key, 'update_plan_sha256': marker['plan_sha256'],
                'restore': plan['restore'], 'approved_rollback_sha256': approved}))
        for name in BINDINGS:
            replace(self.root / name, checked_path(backup / name).read_bytes())
        config.activation(self.root, config.load(self.root))
        self.guard()
        if self.marker(key) != marker:
            raise PermissionError('Marca de reversion distinta.')
        result = {'status': 'previous_storage_release_restored_waiting_resume', 'sdk_opened': False,
            'tasks_changed': False, 'dates_changed': False, 'preserve_all_data': True}
        durable(backup / ('reversion-' + str(uuid.uuid4()) + '.json'), encoded(result))
        (self.root / 'revision_instalacion.json').unlink()
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    for mode in ('verificar-paquete', 'plan', 'aplicar', 'plan-reversion', 'revertir'):
        modes.add_argument('--' + mode, action='store_true')
    parser.add_argument('--plan-sha256')
    parser.add_argument('--actualizacion-id')
    args = parser.parse_args()
    try:
        payload = Path(__file__).resolve().parent
        package.verify_package(payload)
        if args.verificar_paquete:
            value = {'status': 'storage_update_package_verified', 'release': RELEASE,
                'manifest_sha256': sha((payload / 'OPERATIVA_SHA256SUMS.json').read_bytes()), 'sdk_opened': False}
        else:
            production.platform()
            from respaldo_mdb import private_directory
            helper = Update(ownership.SYNC, payload, guard=production.guard, private=private_directory)
            with ownership.sync_lock(ownership.SYNC / 'sync.lock'):
                if args.plan or args.plan_reversion:
                    plan = helper.rollback_plan(args.actualizacion_id) if args.plan_reversion else helper.plan()
                    value = {'plan': plan, 'plan_sha256': digest(plan), 'applied': False}
                elif args.aplicar:
                    value = helper.apply(args.plan_sha256)
                else:
                    value = helper.rollback(args.actualizacion_id, args.plan_sha256)
        print(json.dumps(value, indent=2))
        return 0
    except Exception as exc:
        print(json.dumps({'status': 'storage_update_not_confirmed', 'error_type': type(exc).__name__,
            'note': 'Conservar mantenimiento y evidencia; no borrar marcas ni editar configuracion.'}, indent=2))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
