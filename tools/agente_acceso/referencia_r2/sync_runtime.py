"""Estado atomico, bloqueo de Windows y parada al finalizar el ciclo."""
import contextlib
import datetime as dt
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def save_json(path, data):
    path = Path(path)
    path.parent.mkdir(exist_ok=True, parents=True)
    temp = path.with_name(path.name + "." + str(os.getpid()) + ".tmp")
    temp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(temp, path)


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def stop_requested(root=ROOT):
    try:
        request = load_json(root / "detener.sync.json")
        return request.get("pid") == os.getpid()
    except (OSError, ValueError):
        return False


@contextlib.contextmanager
def exclusive_lock(path):
    import msvcrt
    with Path(path).open("a+b") as stream:
        if stream.tell() == 0:
            stream.write(b"0")
            stream.flush()
        stream.seek(0)
        try:
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            raise RuntimeError("Ya existe una ejecucion activa. No borrar el archivo de bloqueo.") from exc
        try:
            yield
        finally:
            stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
