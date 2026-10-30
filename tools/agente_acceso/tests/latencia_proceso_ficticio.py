"""Procesos propios de prueba. No hay DLL, HTTP real ni datos de caseta."""
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


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--sender',type=Path)
    parser.add_argument('--worker',type=Path)
    parser.add_argument('--sha256')
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--offline',action='store_true')
    args=parser.parse_args()
    if args.sender:
        import emisor_latencia as emitter
        import test_agente as fixture
        api=fixture.FakeTransport()
        if args.offline:api.send=Mock(side_effect=OSError('red ficticia'))
        result=emitter.worker(args.sender,base=args.root,transport=api)
        (args.sender/'inheritance.json').write_text(json.dumps({
            'secret_inherited':any(k.upper().startswith('SANISIDRO_') for k in os.environ),
            'pid':os.getpid(),'bits':struct.calcsize('P')*8}))
        return result
    import sdk_latencia as candidate
    path=args.root/'acceso-datos'/'fixture_sdk.json'
    state=json.loads(path.read_bytes())
    def check():
        record=candidate.session.checked_worker(args.worker,args.sha256,root=args.root)
        candidate.maintenance_files(args.root.parent/'InstalledSync',
            {'protocol':1,'purpose':'latencia_readonly','pid':record['native']['pid'],'run_id':record['run_id']})
        return record
    def data(handle,buffer,size,table,fields,condition,options):
        assert table==b'user' and fields==b'*' and condition==options==b''
        stream=io.StringIO();writer=csv.DictWriter(stream,fieldnames=list(state['user']))
        writer.writeheader();writer.writerow(state['user']);buffer.value=stream.getvalue().encode();return 1
    def serial(handle,buffer,size,field):
        buffer.value=('~SerialNumber='+candidate.SERIAL).encode();return 0
    def rt(handle,buffer,size):
        state['reads']=state.get('reads',0)+1
        buffer.value=state['rt'].encode();return 1
    def disconnect(handle):
        state['disconnects']=state.get('disconnects',0)+1
        if state.get('fault')=='disconnect':raise RuntimeError('Cierre SDK ficticio')
    sdk=types.SimpleNamespace(Connect=Mock(return_value=1),Disconnect=Mock(side_effect=disconnect),
        GetDeviceParam=Mock(side_effect=serial),GetDeviceData=Mock(side_effect=data),GetRTLog=Mock(side_effect=rt))
    diag=types.SimpleNamespace(CONNECTION=b'fixture',pc_timezone=lambda:'fixture',
        load_sdk=lambda:(sdk,types.SimpleNamespace(close=lambda:None),{'sha256':candidate.closures.SDK_HASH}))
    try:return candidate.dispatch(args.worker,args.sha256,root=args.root,diagnostic=diag,guard=check)
    finally:
        state.setdefault('children',[]).append({'pid':os.getpid(),'bits':struct.calcsize('P')*8,
            'secret_inherited':any(k.upper().startswith('SANISIDRO_') for k in os.environ)})
        path.write_text(json.dumps(state))


if __name__=='__main__':raise SystemExit(main())
