"""Rutas sin redirecciones; utilizable por emisor sin importar SDK/Access."""
from pathlib import Path


def checked_path(path):
    path=Path(path).absolute()
    for part in (path,*path.parents):
        try: attributes=getattr(part.lstat(),'st_file_attributes',0)
        except FileNotFoundError: attributes=0
        if part.is_symlink() or attributes&0x400: raise ValueError('Ruta redirigida.')
    return path
