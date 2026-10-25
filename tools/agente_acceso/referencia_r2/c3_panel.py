"""Biblioteca operativa C3-200. Sin comandos de prueba al importarla."""
import csv
import ctypes
import io
import os

SDK_DIR = r"C:\Program Files (x86)\ZKTeco\ZKAccess3.5\NewSDK"
FIELDS = ["CardNo", "Pin", "Password", "Group", "StartTime", "EndTime", "SuperAuthorize"]


class Panel:
    def __enter__(self):
        self.directory = os.add_dll_directory(SDK_DIR)
        self.sdk = ctypes.WinDLL(os.path.join(SDK_DIR, "plcommpro.dll"))
        self.sdk.Connect.argtypes = [ctypes.c_char_p]
        self.sdk.Connect.restype = ctypes.c_void_p
        self.sdk.Disconnect.argtypes = [ctypes.c_void_p]
        self.sdk.Disconnect.restype = None
        self.sdk.GetDeviceData.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_char), ctypes.c_int,
                                          ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p]
        self.sdk.GetDeviceData.restype = ctypes.c_int
        self.sdk.SetDeviceData.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p]
        self.sdk.SetDeviceData.restype = ctypes.c_int
        self.handle = self.sdk.Connect(b"protocol=TCP,ipaddress=192.168.1.201,port=4370,timeout=10000,passwd=")
        if not self.handle:
            self.directory.close()
            raise RuntimeError("No se pudo conectar.")
        return self

    def __exit__(self, *args):
        self.sdk.Disconnect(self.handle)
        self.directory.close()
        print("Conexion cerrada.")

    def read(self, table, condition):
        buffer = ctypes.create_string_buffer(4 * 1024 * 1024)
        result = self.sdk.GetDeviceData(self.handle, buffer, len(buffer), table.encode(), b"*", condition.encode(), b"")
        if result < 0:
            raise RuntimeError("Error de lectura SDK: " + str(result))
        reader = csv.DictReader(io.StringIO(buffer.value.decode("utf-8", errors="strict")))
        rows = list(reader)
        if result != len(rows):
            raise RuntimeError("Lectura incompleta: recuento SDK distinto de filas recibidas.")
        return rows

    def inventory(self):
        rows = self.read("user", "")
        if not rows:
            raise RuntimeError("Inventario C3 vacio: ciclo cancelado, sin aplicar cambios.")
        return rows

    def user(self, card):
        rows = self.read("user", "CardNo=" + card)
        if len(rows) != 1 or rows[0].get("CardNo") != card:
            raise RuntimeError("No hay un unico registro para tag " + card)
        row = rows[0]
        if set(row) != set(FIELDS):
            raise RuntimeError("Campos de usuario inesperados.")
        if any(v is None or any(c in v for c in "\t\r\n") for v in row.values()):
            raise RuntimeError("Registro no compatible.")
        return row

    def write(self, row):
        data = "\t".join(key + "=" + row[key] for key in ["CardNo", "Pin", "StartTime", "EndTime"]).encode("utf-8")
        result = self.sdk.SetDeviceData(self.handle, b"user", data, b"")
        if result != 0:
            raise RuntimeError("Escritura no confirmada, codigo SDK: " + str(result))
        if self.user(row["CardNo"]) != row:
            raise RuntimeError("La lectura posterior no coincide.")
