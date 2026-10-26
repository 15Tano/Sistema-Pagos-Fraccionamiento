"""Guardia sin SDK/Access para el gestor: no consultar tras cierre incierto.

Copiar como gt_guard_operativo.py solo mediante instalacion revisada. No elimina
marcas, cierra procesos ni acepta un PID muerto como prueba de Disconnect.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import uuid

SDK_HASH='82bda08dbbab24b918ebe7de68eeb3e4fb952f275eecc992cb9148c5384a413a'


def safe(path):
    path=Path(path)
    for part in (path,*path.parents):
        try: attrs=getattr(part.lstat(),'st_file_attributes',0)
        except FileNotFoundError: attrs=0
        if part.is_symlink() or attrs&0x400: raise ValueError('Ruta redirigida.')
    return path


def load(path,limit=16384):
    path=safe(path)
    if path.stat().st_size>limit: raise ValueError('Recibo excedido.')
    value=json.loads(path.read_text(encoding='utf-8-sig'))
    if not isinstance(value,dict): raise ValueError('Objeto requerido.')
    return value


def require_closed(root=Path(r'C:\SanIsidro\ZKSync'),*,allow_partial_review=True):
    root=safe(root);data=safe(root/'acceso-datos');ledger=safe(data/'cierres')
    if (data/'cierre_inseguro.json').exists(): raise PermissionError('Cierre SDK pendiente de revision.')
    if (data/'revision_vigencias.json').exists():
        marker=load(data/'revision_vigencias.json')
        if marker.get('reason')!='partial_dates_review' or not allow_partial_review:
            raise PermissionError('Identidad/cierre operativo requiere revision.')
    if not allow_partial_review:
        transactions=safe(data/'transacciones')
        if transactions.exists():
            for folder in transactions.iterdir():
                if load(safe(folder)/'transaction.json').get('status')!='verified':
                    raise PermissionError('Aplicacion parcial requiere revision antes de escribir/reanudar.')
    if not ledger.exists(): return
    for folder in ledger.iterdir():
        if folder.is_symlink() or getattr(folder.lstat(),'st_file_attributes',0)&0x400 or not folder.is_dir() or str(uuid.UUID(folder.name))!=folder.name:
            raise PermissionError('Directorio de trabajador no confirmado.')
        request=load(folder/'request.json');closed=load(folder/'closed.json');ack=load(folder/'parent_ack.json')
        keys={'protocol','role','run_id','worker_id','pid','closed','operation_ok','error_type','sdk_sha256',
              'started_utc','ended_utc','response_bytes','response_sha256'}
        if (set(request)!={'protocol','role','run_id','worker_id','receipts_dir'} or
                type(request['protocol']) is not int or request['protocol']!=1 or request['role'] not in ('rt','vigencias') or
                request['worker_id']!=folder.name or str(uuid.UUID(request['run_id']))!=request['run_id'] or
                set(closed)!=keys or type(closed['protocol']) is not int or closed['protocol']!=1 or
                closed['closed'] is not True or type(closed['operation_ok']) is not bool or
                type(closed['pid']) is not int or closed['pid']<1 or closed['sdk_sha256']!=SDK_HASH or
                any(closed[key]!=request[key] for key in ('role','run_id','worker_id')) or
                closed['error_type']=='ControllerIdentityError'):
            raise PermissionError('Disconnect/identidad no confirmados.')
        if ((request['role']=='rt' and request['receipts_dir']!=str((data/'originales').resolve())) or
                (request['role']=='vigencias' and request['receipts_dir'] is not None) or
                (closed['operation_ok'] and closed['error_type'] is not None) or
                (not closed['operation_ok'] and (not isinstance(closed['error_type'],str) or not closed['error_type']))):
            raise PermissionError('Resultado de cierre inconsistente.')
        times=[dt.datetime.fromisoformat(closed[key].replace('Z','+00:00')) for key in ('started_utc','ended_utc')]
        if any(value.tzinfo is None or value.utcoffset()!=dt.timedelta(0) for value in times) or times[1]<times[0]:
            raise PermissionError('Tiempos de cierre no confirmados.')
        if (type(ack.get('protocol')) is not int or type(ack.get('pid')) is not int or type(ack.get('exit_code')) is not int or ack!={'protocol':1,'pid':closed['pid'],'exit_code':0,
                  'closure_sha256':hashlib.sha256((folder/'closed.json').read_bytes()).hexdigest()}):
            raise PermissionError('Falta confirmacion de salida del padre.')
        if closed['operation_ok'] and request['role']=='vigencias':
            path=folder/'response.json'
            if path.stat().st_size>16*1024*1024: raise PermissionError('Respuesta excedida.')
            raw=path.read_bytes()
            if len(raw)!=closed['response_bytes'] or hashlib.sha256(raw).hexdigest()!=closed['response_sha256'] or closed['error_type'] is not None:
                raise PermissionError('Respuesta/cierre alterados.')
        elif closed['response_bytes'] is not None or closed['response_sha256'] is not None:
            raise PermissionError('Respuesta de cierre inesperada.')


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--reanudar',action='store_true');args=parser.parse_args()
    try: require_closed(allow_partial_review=not args.reanudar);return 0
    except Exception:
        print('CIERRE OPERATIVO NO CONFIRMADO. Conservar mantenimiento y evidencia; no consultar SDK ni reanudar.')
        return 1


if __name__=='__main__': raise SystemExit(main())
