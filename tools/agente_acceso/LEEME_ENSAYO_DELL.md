# Ensayo de emisor desde Dell — 2026.10.24-1

Ejecutar manualmente como Dell con Python32, un comando a la vez. No requiere
mantenimiento del gestor: no carga DLL, no consulta C3/Access ni lee o modifica
ZKSync/GestionTags. No instala tareas. Todos los eventos, horas, PID y estado
de vigencias enviados son fixtures, nunca mediciones de caseta. La API conserva
la autoridad de vigencias.

Servidor ya preparado en `/root/sanisidro-ensayos/acceso-20261023-1`, agente
`6b293548-0312-4d06-9c1d-3a7e79c9c5a0`, serial TEST-C3-001. El cliente exige esa
identidad y solo envía por loopback 18881. No usar otra credencial ni producción.

## 1. Extraer y verificar — PowerShell en Dell

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Ensayo_Emisor_Dell_2026.10.24-1.zip' -DestinationPath 'C:\SanIsidro\EnsayoEmisor_20261024'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\EnsayoEmisor_20261024\verificar_ensayo_dell.ps1'
```

## 2. Importar credencial por SSH directamente a DPAPI — PowerShell en Dell

La contraseña SSH se introduce en su prompt habitual. El JSON secreto no se
muestra ni se escribe en un archivo de texto local. No ejecutar `cat` por separado,
no usar Tee-Object/Start-Transcript ni compartir su salida. Si SSH falla, el cliente
rechaza la entrada vacía. Esta transferencia no necesita el servidor PHP arrancado.

```powershell
ssh root@api.sanisidro.info "cat /root/sanisidro-ensayos/acceso-20261023-1/datos/credencial-ensayo.json" | & 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnsayoEmisor_20261024\ensayo_dell.py' configurar
```

Esperado: CONFIGURADO, identidad verificada. Datos propios en
`datos\ensayo_remoto\outbox.sqlite` y `credencial.dpapi`, vinculada a Dell/equipo.

## 3. Preparar fixtures y probar pendiente sin túnel — PowerShell en Dell

Primero confirmar que NO se abrió aún el túnel 18881 de esta prueba y que ningún
otro servicio usa ese puerto. Si no se conoce su uso, omitir el envío sin túnel.

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnsayoEmisor_20261024\ensayo_dell.py' preparar
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnsayoEmisor_20261024\ensayo_dell.py' enviar
```

Esperado sin túnel: delivery retry, error network, dos mensajes pendientes y tres
originales conservados. Preparar no envía; repetirlo secuencialmente no duplica
los fixtures. Enviar respeta el próximo reintento guardado en SQLite.

## 4. Arrancar PHP — terminal SSH del servidor, dejar abierta

```bash
cd /root/sanisidro-ensayos/acceso-20261023-1
bash iniciar_ensayo.sh
```

No pulsar Ctrl+C hasta terminar. Es un proceso en primer plano.

## 5. Abrir túnel — otra ventana PowerShell en Dell, dejar abierta

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18881:127.0.0.1:18880 root@api.sanisidro.info
```

Tras autenticarse puede quedar sin texto; es normal. Si informa fallo de puerto,
detenerse, sin intentar cerrar servicios ajenos. Mantener abierta esa ventana.

## 6. Enviar y revisar — volver a PowerShell inicial en Dell

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnsayoEmisor_20261024\ensayo_dell.py' enviar
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnsayoEmisor_20261024\ensayo_dell.py' enviar
```

Si sigue idle con pendientes, respetar la espera de reintento (primer fallo, unos
3 segundos) y repetir enviar. Resultado correcto: primer envío acked/acked/idle,
segundo idle; messages acked=2, pending_count=0, responses=3. ACK lote:
responses_stored=3, rows_stored=2, events_stored=1, statuses_stored=1,
responses_pending_interpretation=1. El tercer original es un error SDK ficticio
con bytes binarios, conservado como sdk_error; no produce un evento y se incluye
en ese contador de respuestas sin interpretar. Los tres originales y sus hashes siguen
en la outbox tras el ACK. Este ensayo no simula pérdida de ACK tras commit remoto;
ese escenario ya está cubierto por pruebas locales contra Laravel.

La salida de enviar/estado contiene identificadores, hashes y ACK, sin token, y
se puede compartir. Si muestra paused o blocked, conservar carpeta y salida;
no borrar la base ni crear otra identidad para eludir el error.

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnsayoEmisor_20261024\ensayo_dell.py' estado
```

Al terminar, Ctrl+C en túnel y servidor PHP; conservar evidencias y bases. No
ejecutar deploy para esta prueba. Entrega remota y conteos se certifican solo
después de recibir las salidas reales, no por preparar este paquete.
