"""Ciclo integrado: API primero, existentes solamente, respaldos y aplicador cerrado."""
import json
from pathlib import Path
import uuid

import aplicacion_vigencias as app
import aplicador_integrado as integrated
import respaldo_ciclo
import vigencias_candidato as core


class CycleInterrupted(RuntimeError):
    pass


class Cycle:
    def __init__(self, fetch_api, access_inventory, sdk, *, guard, stop=lambda: False,
                 access_factory=None, prepare=None, authorize=None, evidence=None):
        self.fetch_api, self.inventory, self.sdk = fetch_api, access_inventory, sdk
        self.guard, self.stop = guard, stop
        self.access_factory, self.prepare, self.authorize = access_factory, prepare, authorize
        self.evidence = Path(evidence) if evidence is not None else None
        self.applying = authorize is not None
        if self.applying and (not callable(access_factory) or not callable(prepare) or evidence is None):
            raise ValueError('Aplicacion requiere Access transaccional, respaldos y evidencia.')

    def checked(self):
        self.guard()
        if self.stop():
            raise CycleInterrupted('Parada entre operaciones; no iniciar otra escritura.')

    def __call__(self):
        self.checked()
        if self.applying:
            integrated.check_runs(self.evidence)
        rows = self.fetch_api()
        expected = app.api_values(rows)
        if not expected:
            raise ValueError('API vacia; no abrir Access ni SDK.')
        # El adaptador abre/cierra Access aqui; no conservar una conexion durante la copia exclusiva.
        access = {}
        for raw in self.inventory():
            card = str(raw[1]).strip()
            if card in expected:
                if card in access:
                    raise RuntimeError('Tag duplicado en Access.')
                access[card] = app.access_snapshot(tuple(raw))
        self.checked()
        run_id = str(uuid.uuid4())
        child, folder = self.sdk.read_child(next(iter(expected)), run_id)
        panel = integrated.accept_child(child, folder, {'mode': 'read'}, self.sdk.gate,
                                       self.sdk.ledger, run_id, set())
        if not panel:
            raise RuntimeError('Inventario C3 vacio; no aplicar.')
        plans, missing = [], 0
        api_hash = app.digest({key: app.date_text(value) for key, value in expected.items()})
        for card in expected:
            if card not in access or card not in panel:
                missing += 1
                continue
            plan = app.make_plan(card, [{'card_no': card, 'expiration': app.date_text(expected[card])}],
                                 access[card], panel[card])
            plan['api_sha256'] = api_hash
            plans.append(plan)
        pending = [p for p in plans if p['access_change'] or p['c3_change']]
        summary = {'mode': 'apply' if self.applying else 'readonly', 'api_rows': len(expected),
                   'access_changes': sum(p['access_change'] for p in pending),
                   'c3_changes': sum(p['c3_change'] for p in pending), 'not_found': missing,
                   'absent_api_unchanged': len(set(panel) - set(expected)), 'verified': 0}
        if not self.applying:
            return summary | {'status': 'compared', 'plan_sha256': app.digest(plans)}
        if pending:
            self.checked()
            # Copia compartida y TODOS los perfiles antes de emitir alcances de escritura.
            bundles = self.prepare(pending, run_id)
            if set(bundles) != {p['card'] for p in pending}:
                raise app.ScopeRejected('Respaldos incompletos del ciclo.')
            for plan in pending:
                self.checked()
                bundle = bundles[plan['card']]
                if not isinstance(bundle, respaldo_ciclo.CycleBundle):
                    raise app.ScopeRejected('Se requiere copia compartida del ciclo.')
                bundle.check(plan)
                scope = self.authorize(json.loads(core.encoded(plan)))
                if not isinstance(scope, app.Approval) or scope.check() != plan:
                    raise app.ScopeRejected('Alcance no autorizado para este plan.')
                with self.access_factory() as access_dates:
                    result = integrated.execute(scope, self.fetch_api, access_dates,
                        self.sdk.read_child, self.sdk.apply_child, self.evidence, self.sdk.ledger,
                        bundle, gate=self.sdk.gate, guard=self.guard)
                if result['status'] != 'verified':
                    raise core.ReviewRequired('Aplicacion no verificada.')
                summary['verified'] += 1
        return summary | {'status': 'verified'}


def access_inventory(path, password):
    """Lectura x64 de las cinco columnas r2; cerrar antes de devolver datos."""
    from respaldo_mdb import connect_copy
    connection = connect_copy(path, password)
    try:
        cursor = connection.cursor()
        try:
            rows = cursor.execute('SELECT USERID, CardNo, acc_startdate, acc_enddate, set_valid_time FROM USERINFO').fetchall()
            return [tuple(row) for row in rows]
        finally:
            cursor.close()
    finally:
        try:
            connection.rollback()
        finally:
            connection.close()
