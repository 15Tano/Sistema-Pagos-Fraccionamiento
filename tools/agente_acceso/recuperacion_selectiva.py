"""Plan de conciliacion contra API actual. Sin SDK, borrados o restauracion CLI."""
import copy
import respaldo_protegido as protected
import aplicacion_vigencias as app
import vigencias_candidato as core


def review(store,snapshot_id,api_rows,access,user,permits):
    if not isinstance(store,protected.Store): raise ValueError('Almacen protegido requerido.')
    snapshot=store.open(snapshot_id)  # Volver a autenticar/descifrar, no usar un dict mutable del llamador.
    previous=snapshot['plan'];card=previous['card']
    base={'snapshot_id':snapshot['snapshot_id'],'card':card,'serial':core.SERIAL,
          'source_plan_sha256':app.digest(previous),'approval_issued':False,'reasons':[]}
    official=app.api_values(api_rows)
    if card not in official:
        return base|{'status':'blocked','reasons':['missing_in_api']}
    if access is None or user is None:
        return base|{'status':'blocked','reasons':['missing_in_access_or_c3']}
    reasons=[]
    if (access.get('card')!=card or access.get('userid')!=previous['access_before']['userid'] or
            user.get('CardNo')!=card or user.get('Pin')!=snapshot['user']['Pin']):
        return base|{'status':'blocked','reasons':['identity_changed']}
    if set(user)!=core.USER_FIELDS or not all(core.text(v) for v in user.values()):
        return base|{'status':'blocked','reasons':['invalid_user_schema']}
    changed=sorted(k for k in core.USER_FIELDS-{'StartTime','EndTime'} if user[k]!=snapshot['user'][k])
    if changed: reasons.append('protected_fields_changed')
    if protected.permissions(permits,user['Pin'])!=snapshot['permissions']: reasons.append('permissions_changed')
    if reasons:
        # Nombres de campos, nunca Password/Group/valores anteriores o actuales.
        return base|{'status':'blocked','reasons':reasons,'changed_field_names':changed}
    current={key:user[key] for key in core.FIELDS}
    plan=app.make_plan(card,api_rows,access,current)
    return base|{'status':'needs_api_reconciliation' if plan['access_change'] or plan['c3_change'] else 'already_consistent',
                 'plan':copy.deepcopy(plan),'plan_sha256':app.digest(plan),
                 'meaning':'Plan nuevo con API actual; no restaura vigencia antigua ni resuelve marcadores automaticamente.'}
