import requests
import sqlite3
import os

# === CONFIGURACIÓN ===
# 1. La URL de tu Laravel local
URL_API = "http://127.0.0.1:8000/api/vencimientos"

# 2. La ruta a tu archivo simulado (Ajusta la ruta si es necesario)
# Esto busca el archivo dentro de la carpeta 'database' de donde corras el script
DB_PATH = os.path.join(os.getcwd(), 'database', 'zk_simulation.sqlite')

def sincronizar():
    print("--- INICIANDO SINCRONIZACIÓN ---")
    
    # 1. LEER DE LARAVEL (NUBE)
    try:
        print(f"Consultando {URL_API}...")
        response = requests.get(URL_API)
        
        if response.status_code == 200:
            datos = response.json()
            print(f"¡Éxito! Se recibieron {len(datos)} tags de Laravel.")
        else:
            print(f"Error en el servidor: {response.status_code}")
            return
            
    except Exception as e:
        print(f"No se pudo conectar a Laravel: {e}")
        return

    # 2. ESCRIBIR EN BASE DE DATOS LOCAL (SIMULACIÓN)
    try:
        print(f"Conectando a base de datos: {DB_PATH}")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        updates = 0
        
        for item in datos:
            card = item['card_no']
            fecha = item['expiration']
            
            # Buscamos si el tag existe en la simulación
            # (En la vida real ZKAccess ya tiene los usuarios creados)
            check = cursor.execute("SELECT CardNo FROM USERINFO WHERE CardNo = ?", (card,)).fetchone()
            
            if check:
                # Si existe, actualizamos
                cursor.execute("UPDATE USERINFO SET acc_enddate = ? WHERE CardNo = ?", (fecha, card))
                updates += 1
                print(f" -> Tag {card} actualizado a {fecha}")
            else:
                print(f" [X] El tag {card} viene de Laravel pero NO existe en la BD local.")

        conn.commit()
        conn.close()
        print(f"--- LISTO. Se actualizaron {updates} registros. ---")

    except Exception as e:
        print(f"Error de Base de Datos: {e}")

if __name__ == "__main__":
    sincronizar()
    