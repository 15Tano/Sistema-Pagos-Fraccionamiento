"""Secreto de ingesta protegido por DPAPI del usuario actual de Windows."""
import ctypes
from ctypes import wintypes
import os
from pathlib import Path
import re
import tempfile


class Blob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]


def crypt(data, decrypt=False):
    if os.name != 'nt':
        raise OSError('DPAPI requiere Windows y el usuario que ejecutara el emisor.')
    memory = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(memory, ctypes.POINTER(ctypes.c_ubyte)))
    result = Blob()
    library = ctypes.WinDLL('crypt32', use_last_error=True)
    function = getattr(library, 'CryptUnprotectData' if decrypt else 'CryptProtectData')
    function.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
                         ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    function.restype = wintypes.BOOL
    if not function(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(result)):
        raise OSError('DPAPI no pudo procesar la credencial con este usuario/equipo.')
    try:
        return ctypes.string_at(result.data, result.size)
    finally:
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.LocalFree.argtypes = [ctypes.c_void_p]
        kernel.LocalFree(ctypes.cast(result.data, ctypes.c_void_p))


def validate(token):
    if not re.fullmatch(r'sica_[a-f0-9]{64}', token):
        raise ValueError('Formato de credencial invalido.')
    return token


def store(path, token):
    encrypted = crypt(validate(token).encode('ascii'))
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(encrypted)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def load(path):
    return validate(crypt(Path(path).read_bytes(), decrypt=True).decode('ascii'))
