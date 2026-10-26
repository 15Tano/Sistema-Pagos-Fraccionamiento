"""Preparar instalacion/reversion del punto de entrada, sin ejecutar tareas ni SDK.

API de biblioteca: aplicar requiere consentimiento del hash exacto y guard del
adaptador nativo. No hay CLI de instalacion/activacion en esta preparacion.
"""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import uuid

import respaldo_protegido as protected
import referencia_vigencias as reference
from emisor_servicio import read, save
from sesion_operativa import require_locked

ENTRY = 'sincronizar_vigencias.py'
ROOT_FILES = reference.EXPECTED | {
    'iniciar_oculto.ps1':'d63567bfc5259d78505f8ffcc9e1a07c5b46b32c84ea6c49444409d08bdbbc92',
    'vigilar_sync.py':'204fc781b9d632c0decc7e11122ebcf6b9d1729191467e26d3ce67ebfcc4c1cd',
}
GESTOR_FILES = {
    'gt_backend.py':'5ded829ecd5467f4f08553baf44698d3dd21afdbbf0970a8fffe8735e5e74749',
    'mantenimiento.ps1':'840c500933e644fb9545c88091a287416a018b7c3e16434d634138531b97b4f4',
}
GESTOR_CANDIDATE = (*GESTOR_FILES, 'gt_guard_operativo.py')

WRAPPER = '''"""Entrada de transicion: r2 por defecto; activacion integrada requiere aceptacion."""
import hashlib, importlib.util, json, sys, uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def main():
    if (ROOT/'revision_instalacion.json').exists(): raise RuntimeError('Instalacion pendiente de revision.')
    value=json.loads((ROOT/'enlace-integrado.json').read_text(encoding='utf-8'))
    if set(value)!={'protocol','installation_id','mode','release_sha256'} or type(value['protocol']) is not int or value['protocol']!=1: raise ValueError('Enlace invalido.')
    key=value['installation_id']
    if str(uuid.UUID(key))!=key: raise ValueError('Instalacion ajena.')
    if value['mode']=='r2':
        path=ROOT/'instalaciones'/key/'r2'/'sincronizar_vigencias.py'
        if hashlib.sha256(path.read_bytes()).hexdigest()!='581dfa4cd428830321e3aa879812d9d8bdc09c785b3497bb97cc39b689915e35': raise ValueError('Referencia r2 alterada.')
        spec=importlib.util.spec_from_file_location('_r2_instalado',path)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        module.ROOT=ROOT
        return module.main()
    if value['mode']!='integrado': raise ValueError('Modo invalido.')
    digest=value['release_sha256']
    if not isinstance(digest,str) or len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest): raise ValueError('Release invalido.')
    release=ROOT/'integrado'/digest
    manifest=release/'OPERATIVA_SHA256SUMS.json'
    if hashlib.sha256(manifest.read_bytes()).hexdigest()!=digest: raise ValueError('Release sustituido.')
    sys.path.insert(0,str(release))
    from runner_operativo import main as run
    return run(root=ROOT)
if __name__=='__main__':
    try: raise SystemExit(main())
    except Exception: raise SystemExit(1)
'''.encode('utf-8')

MONITOR = '''"""Mantener vigilancia r2 y agregar componentes solo al activar integrado."""
import hashlib, importlib.util, json, sys, uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def main():
    if (ROOT/'revision_instalacion.json').exists(): return 1
    value=json.loads((ROOT/'enlace-integrado.json').read_text(encoding='utf-8'))
    key=value['installation_id']
    if str(uuid.UUID(key))!=key: raise ValueError('Instalacion ajena.')
    path=ROOT/'instalaciones'/key/'r2'/'vigilar_sync.py'
    if hashlib.sha256(path.read_bytes()).hexdigest()!='204fc781b9d632c0decc7e11122ebcf6b9d1729191467e26d3ce67ebfcc4c1cd': raise ValueError('Vigilancia r2 alterada.')
    spec=importlib.util.spec_from_file_location('_vigilancia_r2',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.ROOT=ROOT
    module.main()
    if value['mode']=='r2': return 0
    if value['mode']!='integrado': raise ValueError('Modo invalido.')
    digest=value['release_sha256']
    if not isinstance(digest,str) or len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest): raise ValueError('Release invalido.')
    release=ROOT/'integrado'/digest
    if hashlib.sha256((release/'OPERATIVA_SHA256SUMS.json').read_bytes()).hexdigest()!=digest: raise ValueError('Release alterado.')
    sys.path.insert(0,str(release))
    from vigilancia_operativa import run
    run(ROOT)
    return 0
if __name__=='__main__':
    try: raise SystemExit(main())
    except Exception: raise SystemExit(1)
'''.encode('utf-8')


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()).hexdigest()


def sha(path):
    path=protected.checked_path(path)
    if path.stat().st_size>4*1024*1024: raise ValueError('Fuente excedida.')
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_files(payload):
    payload=protected.checked_path(payload)
    manifest=read(payload/'OPERATIVA_SHA256SUMS.json')
    files={}
    for row in manifest['files']:
        name=row['name'];parts=PurePosixPath(name)
        if (not name or parts.as_posix()!=name or parts.is_absolute() or '..' in parts.parts or '\\' in name or ':' in name or
                name in files or parts.suffix.lower() not in ('.py','.ps1','.json','.md','.php','.xml')):
            raise ValueError('Fuente de instalacion fuera de alcance.')
        path=protected.checked_path(payload/name)
        if sha(path)!=row['sha256']: raise ValueError('Fuente de release distinta.')
        files[name]=row['sha256']
    required={'runner_operativo.py','sesion_operativa.py','almacen_operativo.py','config_operativa.py','vigilancia_operativa.py'}
    required.update('gestor_candidato/'+name for name in GESTOR_CANDIDATE)
    if len(files)>200 or not required<=files.keys():
        raise ValueError('Release operativo incompleto/excedido.')
    return files,sha(payload/'OPERATIVA_SHA256SUMS.json')


def prepare(root,payload,task_xml,*,guard,expected=ROOT_FILES):
    root=protected.checked_path(root);guard()
    if expected!=ROOT_FILES: raise ValueError('Referencias distintas de r2 aceptado.')
    if (root/'revision_instalacion.json').exists(): raise PermissionError('Revision de instalacion pendiente.')
    observed={name:sha(root/name) for name in expected}
    if observed!=expected: raise ValueError('Instalacion r2 distinta de referencias aceptadas.')
    gestor=protected.checked_path(root.parent/'GestionTags')
    gestor_before={name:sha(gestor/name) for name in GESTOR_FILES}
    if gestor_before!=GESTOR_FILES: raise ValueError('Gestor instalado distinto; comparar antes de parchear.')
    if (gestor/'gt_guard_operativo.py').exists(): raise PermissionError('Guardia previa requiere revision.')
    if not isinstance(task_xml,dict) or set(task_xml)!={'SanIsidro-Vigencias','SanIsidro-Vigilancia'}:
        raise ValueError('Conservar XML de ambas tareas.')
    # El adaptador nativo valida acciones/principal/estado; el plan conserva XML exacto.
    for value in task_xml.values():
        if not isinstance(value,str) or not 1<=len(value.encode('utf-8'))<=131072: raise ValueError('XML de tarea invalido/excedido.')
    files,release=source_files(payload)
    return {'protocol':1,'purpose':'stage_integrated_entry','root':str(root.resolve()),'before':observed,
        'task_xml_sha256':{key:hashlib.sha256(value.encode('utf-8')).hexdigest() for key,value in task_xml.items()},
        'release_sha256':release,'files':files,'entry_after_sha256':hashlib.sha256(WRAPPER).hexdigest(),
        'monitor_after_sha256':hashlib.sha256(MONITOR).hexdigest(),
        'gestor_before':gestor_before,
        'gestor_after':{name:files['gestor_candidato/'+name] for name in GESTOR_CANDIDATE},
        'changes_gestor':True,
        'initial_mode':'r2','changes_tasks':False,'changes_credentials':False,'changes_mdb':False,
        'changes_existing_outbox':False}


class Consent:
    def __init__(self,plan,*,confirmed=False,approved_sha256=None):
        if confirmed is not True or approved_sha256!=digest(plan): raise PermissionError('Confirmar plan de instalacion exacto.')
        self.value=json.loads(json.dumps(plan));self.sha256=approved_sha256;self.used=False

    def consume(self,plan):
        if self.used or digest(plan)!=self.sha256 or self.value!=plan: raise PermissionError('Consentimiento ajeno/reutilizado.')
        self.used=True


def durable(path,raw):
    path=protected.checked_path(path);path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('xb') as stream: stream.write(raw);stream.flush();os.fsync(stream.fileno())


def replace(path,raw):
    path=protected.checked_path(path);temp=path.with_name(path.name+'.'+str(uuid.uuid4())+'.tmp')
    try:
        durable(temp,raw);os.replace(temp,path)
    finally:
        if temp.exists(): temp.unlink()


def stage(plan,payload,task_xml,consent,*,guard,private):
    """Llamador debe retener sync.lock y mantener tarea deshabilitada todo el tiempo."""
    root=protected.checked_path(plan['root']);guard();require_locked(root/'sync.lock')
    current=prepare(root,payload,task_xml,guard=guard)
    if current!=plan: raise PermissionError('Plan cambio desde revision.')
    if not isinstance(consent,Consent): raise PermissionError('Consentimiento requerido.')
    consent.consume(plan)
    key=str(uuid.uuid4());backup=root/'instalaciones'/key;private(backup)
    for name in plan['before']: durable(backup/'r2'/name,(root/name).read_bytes())
    gestor=protected.checked_path(root.parent/'GestionTags')
    for name in plan['gestor_before']: durable(backup/'gestor'/name,(gestor/name).read_bytes())
    for name,xml in task_xml.items(): durable(backup/'tareas'/(name+'.xml'),xml.encode('utf-8'))
    durable(backup/'plan.json',json.dumps(plan,indent=2).encode())
    state={'protocol':1,'installation_id':key,'plan_sha256':digest(plan),'phase':'applying'}
    save(root/'revision_instalacion.json',state)
    try:
        guard()
        release=root/'integrado'/plan['release_sha256']
        files=plan['files']|{'OPERATIVA_SHA256SUMS.json':plan['release_sha256']}
        for name,expected in files.items():
            path=protected.checked_path(release/name)
            if path.exists():
                if sha(path)!=expected: raise PermissionError('Release previo sustituido.')
            else: durable(path,(Path(payload)/name).read_bytes())
            if sha(path)!=expected: raise PermissionError('Copia de release incompleta.')
        guard()
        save(root/'enlace-integrado.json',{'protocol':1,'installation_id':key,'mode':'r2','release_sha256':plan['release_sha256']})
        replace(root/ENTRY,WRAPPER)
        replace(root/'vigilar_sync.py',MONITOR)
        # Guardia primero: las dos entradas parcheadas solo se habilitan con su dependencia presente.
        for name in ('gt_guard_operativo.py',*GESTOR_FILES):
            replace(gestor/name,(release/'gestor_candidato'/name).read_bytes())
        if any(sha(gestor/name)!=expected for name,expected in plan['gestor_after'].items()):
            raise PermissionError('Parche de gestor incompleto.')
        if sha(root/ENTRY)!=plan['entry_after_sha256']: raise PermissionError('Entrada copiada distinta.')
        if sha(root/'vigilar_sync.py')!=plan['monitor_after_sha256']: raise PermissionError('Vigilancia copiada distinta.')
        save(backup/'resultado.json',state|{'phase':'staged','mode':'r2','dates_applied':False})
        marker=read(root/'revision_instalacion.json')
        if marker!=state: raise PermissionError('Marca de instalacion sustituida.')
        (root/'revision_instalacion.json').unlink()  # Solo nuestra marca exacta; datos conservados.
        return {'status':'staged_r2_preserved','installation_id':key,'release_sha256':plan['release_sha256'],
                'dates_applied':False,'tasks_changed':False}
    except BaseException:
        save(backup/'resultado.json',state|{'phase':'requires_review','dates_applied':False})
        raise


def rollback_plan(root,key,*,guard):
    root=protected.checked_path(root);guard()
    if str(uuid.UUID(key))!=key: raise ValueError('UUID de instalacion requerido.')
    backup=protected.checked_path(root/'instalaciones'/key)
    plan=read(backup/'plan.json')
    state=read(backup/'resultado.json')
    if state.get('phase')!='staged' or state.get('plan_sha256')!=digest(plan): raise PermissionError('Instalacion sin confirmar; revisar manualmente.')
    for name,expected in plan['before'].items():
        if sha(backup/'r2'/name)!=expected: raise PermissionError('Respaldo r2 alterado.')
    if sha(root/ENTRY)!=plan['entry_after_sha256']: raise PermissionError('Entrada actual modificada; no sobrescribir.')
    if sha(root/'vigilar_sync.py')!=plan['monitor_after_sha256']: raise PermissionError('Vigilancia actual modificada.')
    gestor=protected.checked_path(root.parent/'GestionTags')
    for name,expected in plan['gestor_before'].items():
        if sha(backup/'gestor'/name)!=expected: raise PermissionError('Respaldo de gestor alterado.')
    for name,expected in plan['gestor_after'].items():
        if sha(gestor/name)!=expected: raise PermissionError('Gestor actual modificado; no sobrescribir.')
    return {'protocol':1,'purpose':'restore_r2_entry','root':str(root.resolve()),'installation_id':key,
        'entry_before_sha256':plan['entry_after_sha256'],'entry_after_sha256':plan['before'][ENTRY],
        'monitor_before_sha256':plan['monitor_after_sha256'],'monitor_after_sha256':plan['before']['vigilar_sync.py'],
        'gestor_before':plan['gestor_after'],'gestor_after':plan['gestor_before'],
        'preserve_all_data':True,'changes_tasks':False}


def rollback(plan,consent,*,guard):
    root=protected.checked_path(plan['root']);guard();require_locked(root/'sync.lock')
    if rollback_plan(root,plan['installation_id'],guard=guard)!=plan: raise PermissionError('Reversion cambio.')
    if not isinstance(consent,Consent): raise PermissionError('Confirmacion de reversion requerida.')
    consent.consume(plan)
    state={'protocol':1,'installation_id':plan['installation_id'],'plan_sha256':digest(plan),'phase':'reverting'}
    save(root/'revision_instalacion.json',state)
    path=root/'instalaciones'/plan['installation_id']/'r2'/ENTRY
    replace(root/ENTRY,path.read_bytes())
    replace(root/'vigilar_sync.py',(path.parent/'vigilar_sync.py').read_bytes())
    gestor=protected.checked_path(root.parent/'GestionTags')
    for name in plan['gestor_after']:
        replace(gestor/name,(path.parent.parent/'gestor'/name).read_bytes())
    if any(sha(gestor/name)!=expected for name,expected in plan['gestor_after'].items()):
        raise PermissionError('Reversion de gestor incompleta.')
    if sha(root/ENTRY)!=plan['entry_after_sha256']: raise PermissionError('Reversion incompleta.')
    if sha(root/'vigilar_sync.py')!=plan['monitor_after_sha256']: raise PermissionError('Reversion de vigilancia incompleta.')
    save(root/'instalaciones'/plan['installation_id']/'reversion.json',state|{'phase':'reverted'})
    if read(root/'revision_instalacion.json')!=state: raise PermissionError('Marca sustituida.')
    (root/'revision_instalacion.json').unlink()
    return {'status':'r2_restored','dates_applied':False,'data_preserved':True}
