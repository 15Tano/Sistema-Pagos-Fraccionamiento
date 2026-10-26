"""Vigilancia independiente, una ejecucion por minuto; popup solo ante falla."""
import base64
import datetime as dt
import json
from pathlib import Path
import subprocess

from sync_runtime import ROOT, exclusive_lock, load_json, save_json, utc_now


def parse(value):
    return dt.datetime.fromisoformat(value).astimezone(dt.timezone.utc)


def assess(state, since, now, minutes=5):
    baseline = parse(since)
    if not state:
        return "sin estado del proceso" if (now - baseline).total_seconds() > minutes * 60 else None
    heartbeat = max(baseline, parse(state.get("heartbeat_utc") or since))
    if (now - heartbeat).total_seconds() > minutes * 60:
        return "sin actividad reciente"
    # Un reinicio sin ciclo correcto no reinicia el plazo de alerta.
    last_ok = max(baseline, parse(state.get("last_ok_utc") or since))
    if (now - last_ok).total_seconds() > minutes * 60:
        return "sin ciclo correcto reciente"
    return None


def powershell(source):
    encoded = base64.b64encode(source.encode("utf-16le")).decode("ascii")
    return subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", encoded],
                          capture_output=True, text=True, timeout=40,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


def main():
    config_path = ROOT / "vigilancia-config.json"
    config = load_json(config_path) if config_path.exists() else {"minutes": 5, "repeat_minutes": 15, "popup": True}
    now = dt.datetime.now(dt.timezone.utc)
    status_file = ROOT / "registros" / "vigilancia.json"
    with exclusive_lock(ROOT / "watchdog.lock"):
        try:
            previous = load_json(status_file)
        except (OSError, ValueError):
            previous = {}
        task = powershell("$t=Get-ScheduledTask -TaskName 'SanIsidro-Vigencias' -ErrorAction SilentlyContinue; if($null -eq $t){'Missing'}else{$t.State.ToString()}")
        status = task.stdout.strip() if task.returncode == 0 else "Unknown"
        if status == "Disabled":
            save_json(status_file, {"checked_utc": utc_now(), "status": "mantenimiento", "task_state": status})
            return
        since = previous.get("enabled_since_utc") or utc_now()
        try:
            state = load_json(ROOT / "registros" / "estado.json")
        except (OSError, ValueError):
            state = None
        reason = assess(state, since, now, config["minutes"])
        if status in {"Unknown", "Missing"} and (now - parse(since)).total_seconds() > config["minutes"] * 60:
            reason = "tarea no disponible para vigilancia"
        result = {"checked_utc": utc_now(), "enabled_since_utc": since, "task_state": status,
                  "status": "alerta" if reason else "correcto", "reason": reason}
        if reason:
            last_alert = previous.get("last_alert_utc")
            notify = not last_alert or (now - parse(last_alert)).total_seconds() >= config["repeat_minutes"] * 60
            result["last_alert_utc"] = last_alert
            if notify:
                result["last_alert_utc"] = utc_now()
                message = "San Isidro: sincronizacion requiere revision. " + reason + ". Revisar C:\\SanIsidro\\ZKSync\\registros\\sync.log. No ejecutar sincronizacion completa a ciegas."
                command = "try { Write-EventLog -LogName Application -Source 'SanIsidro-ZKSync' -EventId 5100 -EntryType Warning -Message '" + message + "' -ErrorAction Stop } catch {}"
                if config.get("popup", True):
                    command += "; (New-Object -ComObject WScript.Shell).Popup('" + message + "',20,'San Isidro - alerta de sincronizacion',48) | Out-Null"
                powershell(command)
        save_json(status_file, result)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Si falla el propio monitor, conservar evidencia local sin secretos.
        ROOT.joinpath("registros").mkdir(exist_ok=True)
        with (ROOT / "registros" / "vigilancia-error.log").open("a", encoding="utf-8") as stream:
            stream.write(utc_now() + " " + type(exc).__name__ + "\n")
        raise SystemExit(1)
