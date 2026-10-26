"""Preparacion operativa consolidada. CLI solo verifica, simula o lee preflight.

No instalar, activar, desplegar, cargar SDK ni descifrar credenciales desde aqui.
"""
import argparse
import hashlib
import json
from pathlib import Path,PurePosixPath

ROOT=Path(__file__).resolve().parent
RELEASE='2026.10.26-1'
CRITICAL={'runner_operativo.py','sdk_operativo.py','emisor_operativo.py','almacen_operativo.py',
          'archivo_cierres.py','sesion_operativa.py','config_operativa.py','instalacion_operativa.py',
          'vigilancia_operativa.py','operacion_nativa.py','preparar_operacion.py','rutas_operativas.py',
          'guardia_gestor_operativo.py','gestor_candidato/gt_backend.py',
          'gestor_candidato/mantenimiento.ps1','gestor_candidato/gt_guard_operativo.py'}


def verify_package():
    path=ROOT/'OPERATIVA_SHA256SUMS.json'
    if path.stat().st_size>131072: raise ValueError('Manifiesto excedido.')
    value=json.loads(path.read_bytes());names=[row['name'] for row in value['files']]
    if value['release']!=RELEASE or not CRITICAL<=set(names) or len(names)!=len(set(names)) or not 130<=len(names)<=200:
        raise ValueError('Manifiesto operativo inesperado.')
    for row in value['files']:
        name=row['name'];parts=PurePosixPath(name)
        if (not name or parts.as_posix()!=name or parts.is_absolute() or '..' in parts.parts or ':' in name or '\\' in name or
                hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=row['sha256']): raise ValueError('Fuente/ruta diferente.')
    return value


def preflight():
    import instalacion_operativa as install
    import operacion_nativa as native
    from emisor_servicio import read
    root=native.SYNC
    sources={name:{'sha256':install.sha(root/name),'matches_r2':install.sha(root/name)==digest}
             for name,digest in install.ROOT_FILES.items()}
    tasks=native.inventory(root)
    gestor={name:{'sha256':install.sha(root.parent/'GestionTags'/name),
                  'matches_reference':install.sha(root.parent/'GestionTags'/name)==digest}
            for name,digest in install.GESTOR_FILES.items()}
    state=read(root/'registros'/'estado.json')
    allowed={'protocol','pid','phase','last_ok_utc','consecutive_errors','heartbeat_utc','last_error_type'}
    import shutil
    return {'status':'preflight_readonly','scope':'metadatos_y_tareas_sin_sdk_red_mdb_ni_credenciales',
        'sources':sources,'gestor':gestor,'tasks':tasks['tasks'],'vigencias':{key:value for key,value in state.items() if key in allowed},
        'free_bytes':shutil.disk_usage(root).free,'installed_link':(root/'enlace-integrado.json').exists(),
        'production_config_exists':(root/'servicio-config.json').exists(),
        'activation_record_exists':(root/'activacion-integrada.json').exists(),
        'can_activate':False,'requires_review':['real_date_application','manager_stop_resume','rollback','definitive_https','capacity'],
        'dates_applied':False,'tasks_changed':False,'credential_read':False}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--preflight',action='store_true');mode.add_argument('--simular',action='store_true')
    parser.add_argument('--python32',type=Path)
    args=parser.parse_args()
    try:
        verify_package()
        if args.simular:
            from simular_operacion_preparada import main as simulate
            return simulate(args.python32)
        print(json.dumps(preflight(),indent=2));return 0
    except Exception as exc:
        print('PREPARACION NO CONFIRMADA: '+type(exc).__name__+'. No se modificaron tareas desde esta CLI.')
        return 1


if __name__=='__main__': raise SystemExit(main())
