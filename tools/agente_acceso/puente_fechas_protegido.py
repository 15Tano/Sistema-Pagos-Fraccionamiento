"""Aplicador candidato: snapshot DPAPI verificado antes del SetDeviceData."""
import copy

import vigencias_candidato as core
from aplicacion_vigencias import ScopeRejected
from puente_sdk_fechas import DatesPanel
from respaldo_protegido import Store


class ProtectedDatesPanel(DatesPanel):
    def __init__(self,approval,evidence,store,diagnostic=None):
        if not isinstance(store,Store): raise ScopeRejected('Almacen protegido requerido.')
        self.store=store;self.before_user=None;self.before_permissions=None;self.protected_ref=None
        super().__init__(approval,evidence,diagnostic)

    def user(self,card):
        value=super().user(card)
        if self.protected_ref is None: self.before_user=copy.deepcopy(value)
        return value

    def permissions(self,pin):
        value=super().permissions(pin)
        if self.protected_ref is None: self.before_permissions=copy.deepcopy(value)
        return value

    def write_dates(self,values):
        plan=self.approval.check()
        if (self.protected_ref is not None or (self.evidence/'write_attempt.json').exists() or
                (self.evidence/'protected_backup.json').exists()):
            raise ScopeRejected('Intento/respaldo ya utilizado.')
        if self.before_user is None or self.before_permissions is None:
            raise ScopeRejected('Leer registro y permisos antes de escribir.')
        meta=self.store.seal(plan,self.before_user,self.before_permissions)
        core.durable(self.evidence/'protected_backup.json',core.encoded(meta))
        self.protected_ref=meta
        super().write_dates(values)
