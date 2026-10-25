"""Turnos SDK candidatos. No importa DLL ni inicia un trabajador al importarse."""
from dataclasses import dataclass, field
import os
import subprocess
import threading


class UnsafeSDKClosure(RuntimeError):
    pass


class SDKGate:
    def __init__(self):
        self._lock = threading.Lock()
        self.active = None
        self.fault = False

    def acquire(self, role):
        if role not in ('vigencias', 'rt'):
            raise ValueError('Rol SDK invalido.')
        with self._lock:
            if self.fault:
                raise UnsafeSDKClosure('Cierre SDK pendiente de revision.')
            if self.active is not None:
                raise RuntimeError('Ya hay un turno SDK propio activo.')
            self.active = role

    def release(self, role, *, clean):
        with self._lock:
            if self.active != role or type(clean) is not bool:
                self.fault = True
                raise UnsafeSDKClosure('Propietario/cierre del turno no confirmado.')
            self.active = None
            if not clean:
                self.fault = True


@dataclass(frozen=True)
class ClosedWorker:
    pid: int
    returncode: int
    stdout: bytes = field(repr=False)
    stderr: bytes = field(repr=False)


def run_closed_worker(gate, role, command, *, verify_closed, timeout=300, cleanup_timeout=10, cwd=None):
    """Exige recibo de cierre validado por el adaptador, ademas de salida0.

    Sin un verify_closed concreto para el worker r2, no usar como reemplazo.
    El emisor no usa este gate porque no tiene SDK. No hay reinicio automatico.
    """
    if (not isinstance(command, (list, tuple)) or not command or
            any(not isinstance(arg, str) or '\0' in arg for arg in command) or
            not callable(verify_closed) or not 0 < timeout <= 300 or not 0 < cleanup_timeout <= 15):
        raise ValueError('Parametros de trabajador invalidos.')
    gate.acquire(role)
    process, clean = None, False
    environment = {key: value for key, value in os.environ.items() if not key.upper().startswith('SANISIDRO_')}
    try:
        try:
            process = subprocess.Popen(list(command), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                env=environment, cwd=cwd, shell=False,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except OSError:
            clean = True  # Ningun trabajador fue creado por este Popen.
            raise
        stdout, stderr = process.communicate(timeout=timeout)
        closed = ClosedWorker(process.pid, process.returncode, stdout, stderr)
        if process.returncode != 0 or verify_closed(closed) is not True:
            raise UnsafeSDKClosure('Recibo de cierre o salida SDK no confirmados.')
        clean = True
        return closed
    except BaseException:
        # No iniciar otro cliente aunque kill/espera terminen: Disconnect no confirmado.
        if process is not None and process.poll() is None:
            try:
                process.kill()  # Solo hijo creado aqui, nunca un PID externo.
                process.communicate(timeout=cleanup_timeout)
            except (OSError, subprocess.TimeoutExpired):
                pass
        if process is not None:
            raise UnsafeSDKClosure('Trabajador SDK interrumpido; conservar evidencia.') from None
        raise
    finally:
        gate.release(role, clean=clean)
        if process is not None and process.poll() is not None:
            for stream in (process.stdout, process.stderr):
                if stream is not None:
                    stream.close()
