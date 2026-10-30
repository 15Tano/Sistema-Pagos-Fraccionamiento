# Prueba de pantallas, tags y boton — 30 de octubre de 2026

El servicio permanente ya esta instalado; confirmar su estado antes de comenzar.
No abrir ZKAccess ni lectores de diagnostico en paralelo. Estas pruebas utilizan el
lector unico que funciona en produccion; no cambian fechas, permisos ni cableado.

## HDMI y dos ventanas

En Windows usar pantallas extendidas, no duplicadas, si se conectan dos monitores.
Abrir una ventana de navegador por pantalla, autenticada con una cuenta de vigilancia:

- Entrada: https://www.sanisidro.info/vigilancia/lecturas?display=entrada
- Salida: https://www.sanisidro.info/vigilancia/lecturas?display=salida

Mover cada ventana a su monitor y usar pantalla completa (F11 en navegador Windows).
Las plumas se eligen por URL independiente: no cambiar entrada por salida en la misma
ventana. Buscador sigue disponible en vista normal; historial segun permiso vigente.
No cambiar cableado de la C3 ni instalar otro controlador para obtener video.

## Tags

Con la pantalla en espera y lectura conectada, presentar una vez el tag de prueba
12230693 en entrada y retirarlo. Registrar hora PC, mensaje/nombre mostrado y demora
visual. Repetir en salida cuando corresponda. No cambiar vigencias para fabricar rechazo.

Comprobar: pantalla correcta, nombre completo cuando exista asociacion unica, resultado
visual coherente y regreso a Presente su tag despues de8segundos. La vista normal del
guardia conserva ultima lectura. Paso fisico y autorizacion C3 son hechos distintos.
Si se usa video para medir demora, encuadrar presentacion y pantalla en la misma toma;
no comparar sin corregir el reloj C3. Unas pocas pruebas no certifican percentiles.

## Boton de pared

Coordinar una pulsacion con el guardia. Anotar hora de Dell y que pluma responde.
Esperar unos10segundos para captura y ejecutar el revisor de originales con ventana
de180segundos. El script es adicional y NO reemplaza archivos del release instalado.
No contiene SDK, red ni lectura de credenciales. Consulta SQLite en modo readonly,
verifica identidad/hashes y no filtra por presencia de tag. Omite numeros de tag y PIN
al imprimir. Conserva response_id, ordinal y hash para recuperar el original si hace falta.

Comando en Dell, una vez copiado a Downloads:

```powershell
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\Users\Dell\Downloads\Revisar_Boton_20261030.py' --segundos 180
```

Repetir una segunda vez, separada por unos20segundos, para correlacionar eventos;
no atribuir al boton cualquier evento vecino de la misma ventana. Anotar si habia
transito/tag simultaneo. Si hay dudas, hacer otra ventana controlada con hora anotada.

Interpretacion del reporte:

- events incluye TODOS los registros de7campos excepto255, tengan card o no.
- has_card=false no implica por si mismo boton: requiere correlacion fisica.
- event_code_raw/door_raw no tienen significado supuesto ni activan plumas.
- status255_rows acredita respuestas de estado, no paso ni lectura de vecino.
- scan_truncated_in_window=true, sdk_error_captures>0, unparsed_rows>0 o capturas
  antiguas/inexistentes impiden concluir ausencia de evento con esa muestra.
- Si no aparece evento tras pulsar, no concluir cableado directo automaticamente:
  revisar ventana/cobertura y correlacion con una lectura conocida, sin abrir otro SDK.

Guardar la salida y horas; adaptar la clasificacion despues desde casa solo con
evidencia. La prueba del boton no reprograma hardware y no implementa apertura web.

## Cierre de la visita

Verificar web conectada, vigencias sin errores y vigilancia habilitada. Si se preparo
mantenimiento por otra causa, reanudar solo tras cierre confirmado usando el gestor.
No dejar procesos de ensayo, ZKAccess ni otra conexion SDK abierta junto al servicio.
