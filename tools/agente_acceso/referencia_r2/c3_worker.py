"""Subproceso de 32 bits. Solo actualiza fechas de registros existentes."""
import json
from pathlib import Path
import sys
from c3_panel import Panel


def main():
    request = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    result = {}
    with Panel() as panel:
        if request["mode"] == "read":
            for row in panel.inventory():
                card = row["CardNo"]
                if card in result:
                    raise RuntimeError("Tag duplicado en C3: " + card)
                result[card] = {key: row[key] for key in ["CardNo", "Pin", "StartTime", "EndTime"]}
        elif request["mode"] == "apply":
            for change in request["changes"]:
                card = change["card"]
                try:
                    row = panel.user(card)
                    before = change["before"]
                    if any(row[key] != before[key] for key in before):
                        raise RuntimeError("Registro cambio desde la simulacion del ciclo.")
                    permissions = panel.read("userauthorize", "Pin=" + row["Pin"])
                    row["StartTime"] = "20200101"
                    row["EndTime"] = change["end"]
                    panel.write(row)
                    if panel.read("userauthorize", "Pin=" + row["Pin"]) != permissions:
                        raise RuntimeError("Permisos distintos despues de escribir.")
                    result[card] = {"ok": True}
                except Exception as exc:
                    result[card] = {"ok": False, "error": str(exc)}
                    break
        else:
            raise RuntimeError("Operacion desconocida.")
    Path(sys.argv[2]).write_text(json.dumps(result), encoding="utf-8")


if __name__ == "__main__":
    main()
