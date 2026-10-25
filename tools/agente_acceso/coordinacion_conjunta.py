"""Orden de vida de lector/emisor propios; no SDK, credenciales o tareas aqui."""
import subprocess
import time


def coordinate(hooks, seconds, stopped, *, clock=time.monotonic, sleep=time.sleep, drain_seconds=15):
    if type(seconds) is not int or not 5 <= seconds <= 150:
        raise ValueError('Ventana conjunta permitida5..150s.')
    sdk = sender = sdk_target = sender_target = None
    sdk_proof = sender_proof = None
    error = None
    stop_sent = False
    started = clock()
    try:
        sdk = hooks.start('sdk', seconds)
        while sdk.poll() is None and clock() - started < seconds + 330:
            if sdk_target is None:
                sdk_target = hooks.bind('sdk', sdk)
            if sdk_target is not None and sender is None:
                sender = hooks.start('sender', 180)
            if sender is not None and sender_target is None:
                sender_target = hooks.bind('sender', sender)
            if (stopped() or clock() - started >= seconds) and sdk_target is not None and not stop_sent:
                hooks.request('sdk', sdk_target)
                stop_sent = True
            # Caida/red/pausa del emisor no cancela comparacion ni captura readonly.
            hooks.publish({'phase': 'running', 'sdk_identity': sdk_target,
                           'sender_identity': sender_target, 'stop_requested': stop_sent})
            sleep(.25)
    except BaseException as exc:
        error = type(exc).__name__
    finally:
        if sdk is not None:
            try:
                if sdk.poll() is None:
                    if sdk_target is None:
                        sdk_target = hooks.bind('sdk', sdk)
                    if sdk_target is not None:
                        hooks.request('sdk', sdk_target)
                    sdk.wait(timeout=360 if clock() - started < seconds + 330 else 5)
                    # Solo esperar; NUNCA kill/terminate del SDK.
            except BaseException as exc:
                error = error or type(exc).__name__
        if sender is not None:
            try:
                if sender_target is None:
                    sender_target = hooks.bind('sender', sender)
                # Solo drenar despues de cerrar SDK; limite breve, sin retener lock SDK por HTTP.
                until = clock() + drain_seconds
                while sdk is not None and sdk.poll() is not None and sender.poll() is None and clock() < until:
                    queue = hooks.health()
                    if queue['pending_count'] == 0 or queue['paused']:
                        break
                    sleep(.25)
                if sender.poll() is None and sender_target is not None:
                    hooks.request('sender', sender_target)
                sender.wait(timeout=45)  # Supervisor HTTP ya recoge a SU hijo; no matarlo desde aqui.
                if sender_target is not None:
                    sender_proof = hooks.proof('sender', sender_target, sender.returncode)
            except BaseException as exc:
                error = error or type(exc).__name__
        # Comprobar recibos/lock/exclusion solo cuando ambos hijos terminaron.
        if sdk is not None:
            try:
                if sdk.poll() is not None and sdk_target is not None:
                    sdk_proof = hooks.proof('sdk', sdk_target, sdk.returncode)
            except BaseException as exc:
                error = error or type(exc).__name__
            if sdk_proof is None:
                try:
                    hooks.unsafe_sdk()
                except BaseException as exc:
                    error = error or type(exc).__name__
        closed = sdk_proof is not None and sender_proof is not None
        result = {'phase': 'stopped' if closed and error is None else 'fault',
                  'sdk_identity': sdk_target, 'sender_identity': sender_target,
                  'sdk_closure_confirmed': sdk_proof is not None,
                  'sender_closure_confirmed': sender_proof is not None,
                  'sdk_launcher_pid': sdk.pid if sdk is not None else None,
                  'sdk_returncode': sdk.returncode if sdk is not None else None,
                  'sender_returncode': sender.returncode if sender is not None else None,
                  'sdk_proof': sdk_proof, 'sender_proof': sender_proof,
                  'orchestration_error_type': error, 'safe_to_resume_candidate': closed and error is None}
        hooks.publish(result)
    return result
