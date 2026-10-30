"""Instalador de esta version: copias r2/gestor/tareas, activacion y retorno.

La biblioteca de instalacion se carga aislada. El unico cambio de su wrapper es
seleccionar runner_produccion, conservando su modo r2 predeterminado y guardias.
"""
import hashlib
import importlib.util
import json
from pathlib import Path

from emisor_servicio import save,read,utc
import produccion_config as config
import referencia_vigencias as reference


def installation():
    path=Path(__file__).with_name('instalacion_operativa.py')
    spec=importlib.util.spec_from_file_location('_instalacion_produccion_aislada',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    original=b'from runner_operativo import main as run'
    if module.WRAPPER.count(original)!=1: raise ValueError('Wrapper de referencia distinto.')
    module.WRAPPER=module.WRAPPER.replace(original,b'from runner_produccion import main as run')
    return module


class Installer:
    def __init__(self,root,payload,*,guard,private):
        self.root,self.payload=Path(root),Path(payload)
        self.guard,self.private=guard,private
        self.library=installation()

    def plan(self,task_xml):
        from produccion_paquete import verify_package
        verify_package(self.payload)
        return self.library.prepare(self.root,self.payload,task_xml,guard=self.guard)

    def stage(self,plan,task_xml,*,approved_sha256):
        consent=self.library.Consent(plan,confirmed=True,approved_sha256=approved_sha256)
        return self.library.stage(plan,self.payload,task_xml,consent,guard=self.guard,private=self.private)

    def activate(self,release,*,approved_sha256,credential_check):
        self.guard();self.library.require_locked(self.root/'sync.lock')
        link=read(self.root/'enlace-integrado.json')
        if link['mode']!='r2' or link['release_sha256']!=release or approved_sha256!=release:
            raise PermissionError('Activacion de otro release/modo.')
        if self.library.sha(self.root/self.library.ENTRY)!=hashlib.sha256(self.library.WRAPPER).hexdigest():
            raise PermissionError('Entrada instalada distinta.')
        if self.library.sha(self.root/'vigilar_sync.py')!=hashlib.sha256(self.library.MONITOR).hexdigest():
            raise PermissionError('Vigilancia instalada distinta.')
        credential_check()  # Debe verificar identidad y DPAPI antes de cambiar modo.
        value={'protocol':1,'enabled':True,'agent_id':config.AGENT,'serial':config.SERIAL,'url':config.URL,
            'archive_acknowledged':True,'release_sha256':release,'dates_engine':config.ENGINE}
        path=self.root/'servicio-config.json'
        if path.exists() and read(path)!=value: raise PermissionError('Configuracion previa distinta; conservarla.')
        if not path.exists(): save(path,value)
        settings=config.load(self.root)
        receipt={'protocol':1,'purpose':'production_r2_reference','agent_id':config.AGENT,'serial':config.SERIAL,
            'release_sha256':release,'config_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'dates_engine':config.ENGINE,'reference_sources':reference.EXPECTED,'authorized_utc':utc()}
        marker=self.root/'activacion-integrada.json'
        if marker.exists():
            config.activation(self.root,settings)
        else: save(marker,receipt)
        config.activation(self.root,settings)
        self.guard()
        save(self.root/'enlace-integrado.json',dict(link,mode='integrado'))
        return {'status':'production_activated_waiting_for_manager_resume','dates_engine':config.ENGINE,
            'agent_id':config.AGENT,'serial':config.SERIAL,'dates_applied_by_installer':False,'tasks_changed':False}

    def rollback(self,*,approved_sha256):
        self.guard();self.library.require_locked(self.root/'sync.lock')
        link=read(self.root/'enlace-integrado.json')
        plan=self.library.rollback_plan(self.root,link['installation_id'],guard=self.guard)
        consent=self.library.Consent(plan,confirmed=True,approved_sha256=approved_sha256)
        return self.library.rollback(plan,consent,guard=self.guard)
