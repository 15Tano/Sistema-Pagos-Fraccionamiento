"""Una copia MDB por ciclo y perfiles protegidos por tag; fuentes anteriores intactas."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import uuid

import aplicacion_vigencias as app
import aplicador_integrado as integrated
import adaptadores_cierre as closures
import respaldo_mdb as mdb
import respaldo_protegido as protected
import transporte_aplicador as transport
import vigencias_candidato as core

MAX_INDEX = 1024 * 1024


class CycleBundle(integrated.Bundle):
    def check(self, plan):
        app.validate_plan(plan)
        meta = closures.bounded_json(protected.checked_path(self.path), 8192)
        keys = {'protocol', 'plan_sha256', 'mdb_backup_id', 'snapshot_id',
                'mdb_receipt_sha256', 'cycle_index_sha256'}
        if (set(meta) != keys or type(meta['protocol']) is not int or meta['protocol'] != 1 or
                meta['plan_sha256'] != app.digest(plan)):
            raise app.ScopeRejected('Referencia de ciclo ajena al plan.')
        for key in ('mdb_backup_id', 'snapshot_id'):
            if str(uuid.UUID(meta[key])) != meta[key]:
                raise app.ScopeRejected('UUID de respaldo invalido.')
        folder = protected.checked_path(self.mdb_root / meta['mdb_backup_id'])
        receipt = closures.bounded_json(protected.checked_path(folder / 'manifest.json'), 16384)
        index_path = self.path.parent.parent / 'indices' / (folder.name + '.json')
        index = closures.bounded_json(protected.checked_path(index_path), MAX_INDEX)
        path = protected.checked_path(folder / 'Database_PRO_antes.mdb')
        if (app.digest(receipt) != meta['mdb_receipt_sha256'] or type(receipt.get('protocol')) is not int or receipt['protocol'] != 1 or
                receipt.get('backup_id') != folder.name or receipt.get('serial') != plan['serial'] or
                receipt.get('status') != 'copy_verified' or receipt.get('approval_issued') is not False or
                type(receipt.get('mdb_bytes')) is not int or not 0 < receipt['mdb_bytes'] <= mdb.MAX_MDB_BYTES or
                path.stat().st_size != receipt['mdb_bytes'] or mdb.file_hash(path) != receipt.get('mdb_sha256')):
            raise app.ScopeRejected('Copia MDB del ciclo no confirmada.')
        if (set(index) != {'protocol', 'backup_id', 'receipt_sha256', 'plans'} or
                type(index['protocol']) is not int or index['protocol'] != 1 or
                app.digest(index) != meta['cycle_index_sha256'] or index['backup_id'] != folder.name or
                index['receipt_sha256'] != app.digest(receipt) or not isinstance(index['plans'], dict) or
                index['plans'].get(app.digest(plan)) != app.digest(plan['access_before']) or
                index['plans'].get(receipt['plan_sha256']) != receipt['validation']['access_before_sha256']):
            raise app.ScopeRejected('Indice del ciclo ajeno o alterado.')
        snapshot = self.store.open(meta['snapshot_id'], plan_sha256=app.digest(plan))
        if snapshot['plan'] != plan:
            raise app.ScopeRejected('Perfil de otro alcance.')
        return meta, snapshot


def prepare(plans, source, mdb_root, password, sdk, run_id, bundle_root, *, guard,
            copy=mdb.create_backup, validate=mdb.validate_copy):
    """Cerrar Access antes de llamar. Todos los respaldos preceden cualquier Approval."""
    plans = json.loads(core.encoded(plans))
    if not plans or len(plans) > 1024 or len({p['card'] for p in plans}) != len(plans):
        raise app.ScopeRejected('Alcance vacio, duplicado o excedido.')
    for plan in plans:
        app.validate_plan(plan)
        if not (plan['access_change'] or plan['c3_change']):
            raise app.ScopeRejected('Respaldar solo cambios concretos.')
    guard()
    receipt = copy(source, mdb_root, password, plans[0], guard=guard)
    folder = protected.checked_path(Path(mdb_root) / receipt['backup_id'])
    path = folder / 'Database_PRO_antes.mdb'
    bindings = {app.digest(plans[0]): app.digest(plans[0]['access_before'])}
    for plan in plans[1:]:
        guard()
        result = validate(path, password, plan)
        if result['access_before_sha256'] != app.digest(plan['access_before']):
            raise app.ScopeRejected('Copia distinta del plan de ciclo.')
        bindings[app.digest(plan)] = result['access_before_sha256']
    if mdb.file_hash(path) != receipt['mdb_sha256']:
        raise app.ScopeRejected('La validacion altero la copia MDB.')
    index = {'protocol': 1, 'backup_id': receipt['backup_id'],
             'receipt_sha256': app.digest(receipt), 'plans': bindings}
    if len(core.encoded(index)) > MAX_INDEX:
        raise app.ScopeRejected('Indice excedido.')
    indices = protected.checked_path(Path(bundle_root) / 'indices')
    indices.mkdir(parents=True, exist_ok=True)
    core.durable(indices / (folder.name + '.json'), core.encoded(index))
    bundles = {}
    for plan in plans:
        guard()
        captured = sdk.capture_profile(plan, run_id)
        target = protected.checked_path(Path(bundle_root) / str(uuid.uuid4()))
        target.mkdir(parents=True, exist_ok=False)
        meta = {'protocol': 1, 'plan_sha256': app.digest(plan), 'mdb_backup_id': receipt['backup_id'],
                'snapshot_id': captured['snapshot_id'], 'mdb_receipt_sha256': app.digest(receipt),
                'cycle_index_sha256': app.digest(index)}
        core.durable(target / 'bundle.json', core.encoded(meta))
        bundle = CycleBundle(target / 'bundle.json', mdb_root, sdk.store)
        bundle.check(plan)
        bundles[plan['card']] = bundle
    return bundles


class CycleTransport(transport.Transport):
    def __init__(self, root, python32, **kwargs):
        kwargs.setdefault('command_factory', lambda folder, digest: [str(python32), '-B',
            str(Path(__file__).resolve()), '--worker', str(folder), '--sha256', digest])
        super().__init__(root, python32, **kwargs)


def worker(folder, digest, diagnostic=None):
    request, operation = transport.read_operation(folder, digest)
    if operation['mode'] != 'apply':
        return transport.worker(folder, digest, diagnostic)
    scope, evidence, previous = transport.approval_at(Path(folder), request, digest)
    bundle = CycleBundle(previous.path, previous.mdb_root, previous.store)
    return integrated.run_worker(folder, digest, scope, evidence, bundle, diagnostic)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    args = parser.parse_args()
    try:
        if struct.calcsize('P') != 4:
            raise RuntimeError('Trabajador SDK requiere x86.')
        from paquete_servicio import verify_package
        verify_package()
        return worker(args.worker, args.sha256)
    except BaseException:
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
