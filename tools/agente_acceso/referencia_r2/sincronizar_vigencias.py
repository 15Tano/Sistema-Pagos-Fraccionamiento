"""API -> fechas Access/C3. Simulacion por defecto; --aplicar habilita escritura."""
import argparse
import csv
import datetime as dt
import getpass
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request
from sync_runtime import exclusive_lock, load_json, save_json, stop_requested, utc_now

ROOT = Path(__file__).resolve().parent
DB_PATH = r"C:\Program Files (x86)\ZKTeco\ZKAccess3.5\Database_PRO.mdb"
PYTHON32 = r"C:\Users\Dell\Python32\python.exe"
API_URL = "https://api.sanisidro.info/api/vencimientos"
START = dt.datetime(2020, 1, 1)


def validate_api(data):
    if not isinstance(data, list) or not data:
        raise ValueError("API vacia o formato invalido; se omite el ciclo.")
    result = {}
    for item in data:
        card = str(item["card_no"]).strip()
        if not card.isdigit() or card in result:
            raise ValueError("Tarjeta invalida o duplicada en API.")
        end = dt.datetime.strptime(str(item["expiration"]), "%Y-%m-%d %H:%M:%S")
        if end.time() != dt.time(23, 59, 59) or end < START:
            raise ValueError("Vigencia no compatible: " + card)
        result[card] = end
    return result


def worker(payload):
    with tempfile.TemporaryDirectory(prefix="sanisidro_c3_") as folder:
        request, response = Path(folder) / "request.json", Path(folder) / "response.json"
        request.write_text(json.dumps(payload), encoding="utf-8")
        environment = dict(os.environ)
        environment.pop("SANISIDRO_ACCESS_PASSWORD", None)
        environment.pop("SANISIDRO_API_TOKEN", None)
        process = subprocess.run([PYTHON32, str(ROOT / "c3_worker.py"), str(request), str(response)],
                                 capture_output=True, text=True, timeout=300,
                                 env=environment,
                                 creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if process.returncode or not response.exists():
            raise RuntimeError("Fallo subproceso C3. " + process.stderr[-1500:])
        return json.loads(response.read_text(encoding="utf-8"))


def date_text(value):
    return value.isoformat(sep=" ") if isinstance(value, dt.datetime) else value


def api_request():
    headers = {"Accept": "application/json", "Cache-Control": "no-cache"}
    token = os.environ.get("SANISIDRO_API_TOKEN")
    if token:
        headers["Authorization"] = "Bearer " + token
    return urllib.request.Request(API_URL, headers=headers)


def cycle(password, apply, only):
    import pyodbc
    request = api_request()
    with urllib.request.urlopen(request, timeout=30) as response:
        expected = validate_api(json.loads(response.read().decode("utf-8")))
    if only:
        if any(card not in expected for card in only):
            raise ValueError("Alguno de los tags seleccionados no aparece en API.")
        expected = {card: expected[card] for card in only}
    escaped = "{" + password.replace("}", "}}") + "}"
    conn = pyodbc.connect("Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq=" + DB_PATH + ";PWD=" + escaped + ";",
                          readonly=not apply, autocommit=False, timeout=15)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT USERID, CardNo, acc_startdate, acc_enddate, set_valid_time FROM USERINFO")
        access = {}
        for row in cursor.fetchall():
            card = str(row[1]).strip()
            if card in expected:
                if card in access:
                    raise RuntimeError("Tag duplicado en Access: " + card)
                access[card] = row
        panel = worker({"mode": "read"})
        if not isinstance(panel, dict) or not panel:
            raise RuntimeError("Lectura C3 vacia o invalida: ciclo cancelado sin aplicar cambios.")
        plan = []
        for card, end in expected.items():
            acc, c3 = access.get(card), panel.get(card)
            if acc is None or c3 is None:
                plan.append({"card": card, "status": "NO_ENCONTRADO", "end": date_text(end),
                             "access_change": False, "c3_change": False})
                continue
            plan.append({"card": card, "status": "EXISTENTE", "end": date_text(end),
                         "access_change": acc[2] != START or acc[3] != end or not bool(acc[4]),
                         "c3_change": c3["StartTime"] != "20200101" or c3["EndTime"] != end.strftime("%Y%m%d"),
                         "access_before": {"userid": acc[0], "start": date_text(acc[2]), "end": date_text(acc[3]), "valid": bool(acc[4])},
                         "c3_before": c3})
        pending = [p for p in plan if p["access_change"] or p["c3_change"]]
        stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        if pending or not apply:
            output = ROOT / "registros" / ("plan_" + stamp + ".csv")
            with output.open("x", newline="", encoding="utf-8-sig") as stream:
                writer = csv.writer(stream)
                writer.writerow(["tag", "vigencia_api", "estado", "cambiar_access", "cambiar_c3"])
                for p in plan:
                    writer.writerow([p["card"], p["end"], p["status"], p["access_change"], p["c3_change"]])
            logging.info("Reporte: %s", output)
        logging.info("API=%s; cambios Access=%s; cambios C3=%s; no encontrados=%s; ausentes API sin cambios=%s",
                     len(expected), sum(p["access_change"] for p in plan), sum(p["c3_change"] for p in plan),
                     sum(p["status"] == "NO_ENCONTRADO" for p in plan), len(set(panel) - set(expected)) if not only else "fuera del alcance")
        if not apply:
            logging.info("SIMULACION: no se escribio en Access ni C3.")
            return
        if pending:
            backup = ROOT / "respaldos" / ("fechas_" + stamp + ".json")
            with backup.open("x", encoding="utf-8") as stream:
                json.dump(pending, stream, indent=2)
            logging.info("Respaldo de fechas: %s", backup)
        results = worker({"mode": "apply", "changes": [
            {"card": p["card"], "before": p["c3_before"], "end": expected[p["card"]].strftime("%Y%m%d")}
            for p in pending if p["c3_change"]]}) if any(p["c3_change"] for p in pending) else {}
        failures = 0
        for p in pending:
            card = p["card"]
            if p["c3_change"] and not results.get(card, {}).get("ok"):
                failures += 1
                logging.error("Pendiente C3 %s: %s", card, results.get(card, {}).get("error", "no procesado"))
                continue
            if p["access_change"]:
                try:
                    cursor.execute("SELECT acc_startdate, acc_enddate, set_valid_time FROM USERINFO WHERE USERID = ? AND CardNo = ?",
                                   p["access_before"]["userid"], card)
                    row = cursor.fetchone()
                    before = p["access_before"]
                    if row is None or [date_text(row[0]), date_text(row[1]), bool(row[2])] != [before["start"], before["end"], before["valid"]]:
                        raise RuntimeError("Access cambio durante el ciclo.")
                    cursor.execute("UPDATE USERINFO SET acc_startdate = ?, acc_enddate = ?, set_valid_time = ? WHERE USERID = ? AND CardNo = ?",
                                   START, expected[card], True, before["userid"], card)
                    cursor.execute("SELECT acc_startdate, acc_enddate, set_valid_time FROM USERINFO WHERE USERID = ? AND CardNo = ?", before["userid"], card)
                    row = cursor.fetchone()
                    if row is None or row[0] != START or row[1] != expected[card] or not bool(row[2]):
                        raise RuntimeError("Verificacion Access fallida.")
                    conn.commit()
                except Exception as exc:
                    conn.rollback()
                    failures += 1
                    logging.error("Pendiente Access %s: %s", card, exc)
                    continue
            logging.info("APLICADO Y VERIFICADO: %s", card)
        if failures:
            raise RuntimeError("Hay %s cambios pendientes; el proximo ciclo vuelve a comparar datos reales." % failures)
    finally:
        conn.rollback()
        conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--aplicar", action="store_true")
    parser.add_argument("--continuo", action="store_true")
    parser.add_argument("--tags", nargs="+")
    args = parser.parse_args()
    if args.continuo and not args.aplicar:
        parser.error("El modo continuo requiere --aplicar.")
    for folder in ["registros", "respaldos"]:
        (ROOT / folder).mkdir(exist_ok=True)
    handlers = [RotatingFileHandler(ROOT / "registros" / "sync.log", maxBytes=2000000, backupCount=5, encoding="utf-8")]
    if __import__("sys").stdout is not None:
        handlers.append(logging.StreamHandler())
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", handlers=handlers)
    try:
        with exclusive_lock(ROOT / "sync.lock"):
            password = os.environ.get("SANISIDRO_ACCESS_PASSWORD")
            if password is None:
                if __import__("sys").stdin is None:
                    raise RuntimeError("Credencial Access no disponible en ejecucion oculta.")
                password = getpass.getpass("Contrasena de Access (no se muestra): ")
            state_path = ROOT / "registros" / "estado.json"
            state = {"protocol": 2, "pid": os.getpid(), "run_started_utc": utc_now(),
                     "phase": "starting", "last_ok_utc": None, "consecutive_errors": 0}
            while True:
                if args.continuo and stop_requested():
                    state.update(phase="stopped", heartbeat_utc=utc_now())
                    save_json(state_path, state)
                    logging.info("PARADA ORDENADA: no hay escrituras en curso.")
                    return 0
                if args.continuo:
                    state.update(phase="cycle", heartbeat_utc=utc_now(), cycle_started_utc=utc_now())
                    save_json(state_path, state)
                ok = True
                try:
                    cycle(password, args.aplicar, args.tags)
                    state.update(last_ok_utc=utc_now(), consecutive_errors=0, last_error_type=None)
                except Exception as exc:
                    ok = False
                    state["consecutive_errors"] += 1
                    state["last_error_type"] = type(exc).__name__
                    logging.error("Ciclo no completado: %s", exc)
                finally:
                    if args.continuo:
                        state.update(phase="idle", heartbeat_utc=utc_now(), cycle_finished_utc=utc_now())
                        save_json(state_path, state)
                    logging.info("CICLO TERMINADO: %s", "correcto" if ok else "error")
                if not args.continuo:
                    return 0 if ok else 1
                deadline = time.monotonic() + 60
                while time.monotonic() < deadline and not stop_requested():
                    time.sleep(min(0.5, max(0, deadline - time.monotonic())))
    except Exception as exc:
        logging.error("No se pudo ejecutar: %s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
