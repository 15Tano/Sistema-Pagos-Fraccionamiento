"""Binding C3 del nucleo candidato, cerrado a inventario readonly en esta entrega."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import struct

import adaptadores_cierre as closures
import vigencias_candidato as core


class ReadOnlyPanel:
    def __init__(self, diagnostic=None):
        self.diag = diagnostic or closures.diagnostic_module()
        self.sdk = self.directory = self.handle = None
        self.sdk_sha256 = None

    def open(self):
        self.diag.maintenance_guard()
        self.sdk, self.directory, info = self.diag.load_sdk()
        self.sdk_sha256 = info['sha256']
        if self.sdk_sha256 != closures.SDK_HASH:
            raise closures.ControllerIdentityError('Biblioteca no confirmada.')
        self.handle = self.sdk.Connect(self.diag.CONNECTION)
        if not self.handle:
            raise RuntimeError('Conexion rechazada.')

    def serial(self):
        buffer = ctypes.create_string_buffer(4096)
        code = self.sdk.GetDeviceParam(self.handle, buffer, len(buffer), b'~SerialNumber')
        if code < 0 or b'\0' not in buffer.raw:
            raise closures.ControllerIdentityError('Serial no confirmado.')
        expected = b'~SerialNumber=' + core.SERIAL.encode('ascii')
        return core.SERIAL if buffer.value == expected else None

    def inventory(self):
        buffer = ctypes.create_string_buffer(4 * 1024 * 1024)
        code = self.sdk.GetDeviceData(self.handle, buffer, len(buffer), b'user', b'*', b'', b'')
        if b'\0' not in buffer.raw:
            raise ValueError('Inventario sin terminador.')
        # El buffer bruto puede incluir Password: solo se persisten cuatro campos.
        return list(closures.parse_inventory(buffer.value, code).values())

    def write_dates(self, values):
        raise PermissionError('Binding cerrado a solo lectura.')

    def disconnect(self):
        if self.handle:
            self.sdk.Disconnect(self.handle)
            self.handle = None

    def close_library(self):
        if self.directory is not None:
            self.directory.close()
            self.directory = None


def run_readonly(folder, digest, factory=ReadOnlyPanel):
    path = Path(folder) / 'operation.json'
    if path.stat().st_size > closures.MAX_RESPONSE:
        raise ValueError('Operacion excedida.')
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != digest or json.loads(raw) != {'mode': 'read'}:
        raise ValueError('Solo inventario readonly vinculado por SHA.')
    return core.worker(folder, digest, factory)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    args = parser.parse_args()
    try:
        from ensayo_puente_readonly import verify_package
        verify_package()
        if os.name != 'nt' or struct.calcsize('P') != 4:
            raise RuntimeError('Worker requiere Python32 instalado.')
        return run_readonly(args.worker, args.sha256)
    except (Exception, KeyboardInterrupt):
        return 1  # Sin payload, traceback, mensajes SDK ni credenciales.


if __name__ == '__main__':
    raise SystemExit(main())
