# Entrega de capturas del coordinador — 2026.10.24-1

Complemento independiente: no sustituye Coordinador_Ensayo_2026.10.24-1.zip ni
sus fuentes. Reutiliza cuatro bibliotecas verificadas por SHA256 de la carpeta
C:\SanIsidro\CoordinadorEnsayo_20261024. No importa SDK, Access ni controla tareas.
No necesita mantenimiento: polling sigue activo. Solo destino loopback18881 por
SSH al backend aislado, nunca produccion ni HTTP publico.

Exige la outbox existente datos/lectura_mantenimiento/outbox.sqlite, agente
c8d7ccdc-991f-497c-8383-92fb52921f8a y serial CO2K225060027. No inicializa otra
base, no crea eventos ni cambia identidad. Agrupa las respuestas aun sin lote y
conserva los mensajes existentes, UUID, bytes, hashes y ACK. No borra originales.

## 1. Extraer y verificar — PowerShell de Dell

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Entrega_Coordinador_2026.10.24-1.zip' -DestinationPath 'C:\SanIsidro\EntregaCoordinador_20261024'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\EntregaCoordinador_20261024\verificar_entrega.ps1'
```

## 2. Importar credencial por SSH directamente a DPAPI — PowerShell de Dell

Ejecutar la linea completa, sin imprimir/guardar la salida de cat por separado:

```powershell
ssh root@api.sanisidro.info "cat /root/sanisidro-ensayos/acceso-20261023-1/datos/alta-controlador-real.txt" | & 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EntregaCoordinador_20261024\entregar_coordinador.py' configurar
```

Entrada limitada a4096bytes, exige una sola linea de ID y token y agente esperado.
Si SSH falla o se recibe otro agente, rechaza sin imprimir secreto. No usar
Tee-Object/Start-Transcript ni compartir archivo privado. Se guarda solamente
credencial-ingesta.dpapi junto a la outbox, protegida para Dell/equipo.
Esperado CONFIGURADO. No necesita servidor PHP ni tunel activos para importar.

## 3. Servidor y tunel — mantener ventanas abiertas

Si PHP temporal ya esta activo, conservar esa ventana. Si esta detenido, en una
PowerShell de Dell ejecutar:

```powershell
ssh -t root@api.sanisidro.info "cd /root/sanisidro-ensayos/acceso-20261023-1 && bash iniciar_ensayo.sh"
```

En otra PowerShell de Dell, abrir tunel si aun no esta abierto:

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18881:127.0.0.1:18880 root@api.sanisidro.info
```

Puede quedar sin texto tras autenticarse; es normal. Si falla puerto ocupado,
usar/revisar ventana existente, sin cerrar servicios ajenos a ciegas.

## 4. Enviar — PowerShell de Dell con prompt PS, no terminal root ni tunel

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EntregaCoordinador_20261024\entregar_coordinador.py' enviar
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EntregaCoordinador_20261024\entregar_coordinador.py' enviar
```

Cada tanda hasta100mensajes/60s mas llamada en curso. Imprime progreso cada5ACK.
Reintenta mismos bytes/UUID; espera progresiva y pausa por errores permanentes
del emisor existente. Si termina con limit o retry, conserva pendientes y repetir
enviar respetando espera; no borrar base ni reinicializar para eludir errores.

Salida resumida compartible, sin tokens ni filas/tags: delivery, health, sumas de
ACK, conteo/manifiesto SHA256 de originales, hashes de cuerpos verificados y
prueba de originales/mensajes anteriores sin cambios. Resumen persistido en
datos/lectura_mantenimiento/entrega_resumen.json. Los ACK completos siguen en
SQLite. Verifica originales de SQLite (hash/base64/metadatos), no vuelve a leer
todos los buffer.bin independientes del trabajador.

Esperado para las93respuestas capturadas: responses=93, pending_count=0,
unbatched=0, hashes_verified=true, originals_preserved=true y
existing_messages_unchanged=true. ack_totals.responses_stored=93 al terminar.
No esperar93vehiculos: puede haber estados255/acumulados y varias filas por
respuesta. Segundo enviar idle, sin aumentar mensajes confirmados. Identificar
eventos/estados por los conteos que realmente devuelva Laravel, no inventarlos.

Si se desea consultar sin enviar:

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EntregaCoordinador_20261024\entregar_coordinador.py' estado
```

Al concluir revisar salidas y Ctrl+C en servidor temporal/tunel, conservando bases
y evidencia. No se ejecuta deploy ni se instala servicio por completar esta prueba.
