"""Hijo de pruebas con SDK en memoria; no carga DLL ni usa una IP."""
import argparse
import csv
import io
import json
import os
from pathlib import Path
import struct
import sys
import types
from unittest.mock import Mock

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import sdk_operativo as operation


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--worker',type=Path,required=True)
    parser.add_argument('--sha256',required=True);parser.add_argument('--root',type=Path,required=True)
    args=parser.parse_args();path=args.root/'acceso-datos'/'fixture_sdk.json'
    state=json.loads(path.read_bytes())
    def check():return operation.session.checked_worker(args.worker,args.sha256,root=args.root)
    check()  # Comprobar padre, nacimiento, DPAPI y lock antes del SDK ficticio.
    state.setdefault('children',[]).append({'pid':os.getpid(),'bits':struct.calcsize('P')*8,
        'inherited_secret':any(k.upper().startswith('SANISIDRO_') for k in os.environ)})
    def rows(handle,buffer,size,table,fields,condition,options):
        data=[state['user']] if table==b'user' else state['permits']
        header=list(state['user']) if table==b'user' else ['Pin','AuthorizeTimezoneId','AuthorizeDoorId']
        stream=io.StringIO();writer=csv.DictWriter(stream,fieldnames=header);writer.writeheader();writer.writerows(data)
        buffer.value=stream.getvalue().encode();return len(data)
    def serial(handle,buffer,size,field):
        buffer.value=('~SerialNumber='+('OTHER' if state.get('fault')=='serial' else operation.config.SERIAL)).encode();return 0
    def update(handle,table,payload,options):
        assert table==b'user' and options==b''
        values=dict(pair.split('=',1) for pair in payload.decode().split('\t'))
        assert set(values)==operation.checkpoint.transport.core.FIELDS
        state['sets']=state.get('sets',0)+1;state['user'].update(values)
        if state.get('stop_on_set'):
            owner=check()
            (args.root/'detener.sync.json').write_text(json.dumps({'pid':owner['native']['pid']}))
        return 0
    def rt(handle,buffer,size):
        state['reads']=state.get('reads',0)+1;buffer.value=state['rt'].encode();return 1
    def disconnect(handle):
        state['disconnects']=state.get('disconnects',0)+1
        if state.get('fault')=='disconnect':raise RuntimeError('fixture disconnect')
    sdk=types.SimpleNamespace(Connect=Mock(return_value=1),Disconnect=Mock(side_effect=disconnect),
        GetDeviceParam=Mock(side_effect=serial),GetDeviceData=Mock(side_effect=rows),
        SetDeviceData=Mock(side_effect=update),GetRTLog=Mock(side_effect=rt))
    diag=types.SimpleNamespace(CONNECTION=b'fixture',maintenance_guard=check,pc_timezone=lambda:'fixture_zone',
        load_sdk=lambda:(sdk,types.SimpleNamespace(close=lambda:None),{'sha256':operation.closures.SDK_HASH}))
    try:
        request=operation.closures.request_at(args.worker/'request.json')
        if request['role']=='rt':return operation.rt_worker(args.worker,args.sha256,operation.config.load(args.root),root=args.root,diag=diag)
        return operation.checkpoint.worker(args.worker,args.sha256,diag)
    finally:path.write_text(json.dumps(state))


if __name__=='__main__':raise SystemExit(main())
