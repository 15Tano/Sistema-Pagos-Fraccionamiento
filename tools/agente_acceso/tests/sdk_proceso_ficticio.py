"""Solo ejecutable de pruebas: SDK sustituido. Nunca importar/cargar DLL."""
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
import transporte_aplicador as transport


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--worker',type=Path,required=True);parser.add_argument('--sha256',required=True)
    args=parser.parse_args();path=args.worker.parent.parent/'fixture_sdk.json'
    state=json.loads(path.read_bytes());events=state.setdefault('events',[])
    events.append({'pid':os.getpid(),'bits':struct.calcsize('P')*8,'inherited_secret':any(k.upper().startswith('SANISIDRO_') for k in os.environ)})
    def data(handle,buffer,size,table,fields,condition,options):
        rows=[state['user']] if table==b'user' else state['permits']
        header=list(state['user']) if table==b'user' else ['Pin','AuthorizeTimezoneId','AuthorizeDoorId']
        stream=io.StringIO();writer=csv.DictWriter(stream,fieldnames=header);writer.writeheader();writer.writerows(rows)
        buffer.value=stream.getvalue().encode();return len(rows)
    def serial(handle,buffer,size,field):
        buffer.value=b'~SerialNumber=OTHER' if state.get('fault')=='serial' else b'~SerialNumber=CO2K225060027';return 0
    def update(handle,table,payload,options):
        state['sets']=state.get('sets',0)+1
        assert table==b'user' and options==b''
        values=dict(pair.split('=',1) for pair in payload.decode().split('\t'))
        assert set(values)==transport.core.FIELDS
        state['user'].update(values);return 0
    def disconnect(handle):
        state['disconnects']=state.get('disconnects',0)+1
        if state.get('fault')=='disconnect': raise RuntimeError('fixture close failure')
    sdk=types.SimpleNamespace(Connect=Mock(return_value=1),Disconnect=Mock(side_effect=disconnect),
        GetDeviceParam=Mock(side_effect=serial),GetDeviceData=Mock(side_effect=data),SetDeviceData=Mock(side_effect=update))
    diag=types.SimpleNamespace(CONNECTION=b'fixture',maintenance_guard=Mock(),load_sdk=Mock(return_value=(sdk,
        types.SimpleNamespace(close=lambda:None),{'sha256':transport.closures.SDK_HASH})))
    try: return transport.worker(args.worker,args.sha256,diag)
    except BaseException: return 1
    finally: path.write_text(json.dumps(state))


if __name__=='__main__': raise SystemExit(main())
