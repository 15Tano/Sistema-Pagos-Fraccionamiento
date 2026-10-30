"""Entrada x86 de produccion; RT o motor r2 verificado, nunca simultaneos."""
import argparse
import hashlib
from pathlib import Path
import struct

import adaptadores_cierre as closed
import produccion_config as config
import produccion_r2 as r2
import sdk_operativo as sdk
import sesion_operativa as session


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker',type=Path,required=True)
    parser.add_argument('--sha256',required=True)
    args=parser.parse_args()
    try:
        if struct.calcsize('P')!=4: raise PermissionError('SDK requiere x86.')
        from produccion_paquete import verify_package
        verify_package()
        settings=config.load(session.SYNC);config.activation(session.SYNC,settings)
        if hashlib.sha256((Path(__file__).parent/'OPERATIVA_SHA256SUMS.json').read_bytes()).hexdigest()!=settings.release_sha256:
            raise PermissionError('Release ajeno.')
        request=closed.request_at(args.worker/'request.json')
        if request['role']=='rt':
            if hashlib.sha256((args.worker/'request.json').read_bytes()).hexdigest()!=args.sha256: raise PermissionError('Turno RT ajeno.')
            return sdk.rt_worker(args.worker,args.sha256,settings,diag=sdk.diagnostic(args.worker,args.sha256))
        return r2.execute_worker(args.worker,args.sha256,
            guard=lambda:session.checked_worker(args.worker,args.sha256))
    except BaseException:
        return 1


if __name__=='__main__': raise SystemExit(main())
