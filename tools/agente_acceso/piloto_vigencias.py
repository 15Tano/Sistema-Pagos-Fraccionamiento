"""Un tag, plan fresco, respaldo y consentimiento. Sin tareas, IO instalado ni CLI."""
import json
import uuid

import aplicacion_vigencias as app
import aplicador_integrado as integrated
import respaldo_ciclo as checkpoint


def phrase(plan):return 'APLICAR '+plan['card']+' '+app.digest(plan)


def panel(sdk,card,run_id):
    child,folder=sdk.read_child(card,run_id)
    values=integrated.accept_child(child,folder,{'mode':'read'},sdk.gate,sdk.ledger,run_id,set())
    if card not in values:raise app.ScopeRejected('Tag ausente en C3; piloto no crea ni recupera.')
    return values[card]


def run(card,fetch_api,read_access,sdk,prepare,access_factory,evidence,*,guard,confirm,
        publish,before_write,stop=lambda:False):
    """El llamador retiene sync.lock; stop solo entre operaciones, nunca mitad de un tag."""
    if not app.core.number(card) or card=='0':raise app.ScopeRejected('Un tag numerico requerido.')
    def between():
        guard()
        if stop():raise app.ScopeRejected('Parada solicitada antes de aplicar.')
    between();run_id=str(uuid.uuid4());rows=fetch_api()
    if card not in app.api_values(rows):raise app.ScopeRejected('Tag ausente de API.')
    access=read_access(card)
    if access is None:raise app.ScopeRejected('Tag ausente de Access.')
    between();c3=panel(sdk,card,run_id);plan=app.make_plan(card,rows,access,c3)
    public={'plan':plan,'plan_sha256':app.digest(plan),'approval_issued':False,'backup_verified':False}
    publish(public)
    if not (plan['access_change'] or plan['c3_change']):
        return public|{'status':'no_changes','dates_applied':False,'components_verified':[]}
    between();bundles=prepare([plan],run_id)
    if set(bundles)!={card} or not isinstance(bundles[card],checkpoint.CycleBundle):
        raise app.ScopeRejected('Respaldo de ciclo requerido.')
    bundle=bundles[card];meta,_=bundle.check(plan)
    public|={'backup_verified':True,'backup_ids':{key:meta[key] for key in ('mdb_backup_id','snapshot_id')}}
    publish(public);between()
    if confirm(json.loads(app.core.encoded(plan)),phrase(plan)) is not True:
        return public|{'status':'declined','dates_applied':False,'components_verified':[]}
    # Revalidar despues de la espera humana ANTES de emitir el alcance de 60 segundos.
    between()
    values=app.api_values(fetch_api())
    if card not in values or app.date_text(values[card])!=plan['api_end'] or read_access(card)!=plan['access_before']:
        raise app.ScopeRejected('API/Access cambiaron; no se emite aprobacion.')
    if panel(sdk,card,str(uuid.uuid4()))!=plan['c3_before']:
        raise app.ScopeRejected('C3 cambio; no se emite aprobacion.')
    bundle.check(plan);between();before_write(plan)
    approval=app.Approval(plan,confirmed=True,approved_sha256=public['plan_sha256'])
    with access_factory() as access_dates:
        value=integrated.execute(approval,fetch_api,access_dates,sdk.read_child,sdk.apply_child,
            evidence,sdk.ledger,bundle,gate=sdk.gate,guard=guard)
    if value['status']!='verified':raise app.core.ReviewRequired('Aplicacion no verificada.')
    return public|{'status':'verified','approval_issued':True,'dates_applied':True,
        'components_verified':sorted(approval.verified|approval.consumed),'application':value}
