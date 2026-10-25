# Núcleo candidato de vigencias — 2026.10.25-1

Esta entrega valida contratos read/apply con servicios y procesos ficticios.
No instala polling, no conecta la DLL, no aplica fechas reales, no necesita SSH
ni mantenimiento. Mantener el polling habitual funcionando.

## Dell: solo verificar y simular

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Nucleo_Vigencias_2026.10.25-1.zip' -DestinationPath 'C:\SanIsidro\NucleoVigencias_20261025'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\NucleoVigencias_20261025\verificar_vigencias.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\NucleoVigencias_20261025\simular_vigencias.py'
```

Esperado: simulation_ok, 31 pruebas, fallos/errores/omisiones0. Evidencia en
registros/simulacion_vigencias_*.json y .txt. Los temporales ficticios se crean
y limpian bajo datos/pruebas_vigencias_candidato; no se usa la outbox real.

## Qué prueba

- Algoritmo r2 verificado con API y conexión Access sustituidas: fechas actuales
  desde API en cada ciclo, ausentes API intactos, solo existentes, respaldo y
  comparación readonly. No se modifica ninguna fuente r2 publicada.
- Solicitudes read/apply vinculadas por SHA a resultado, PID, ejecución y recibo
  de cierre. No siguiente turno hasta ACK durable del padre. Timeouts, salida
  sin recibo o datos alterados bloquean nuevas operaciones.
- En aplicación ficticia: solo fechas, lectura posterior de todos los campos
  y permisos, rechazo de cambios concurrentes, detención del lote al fallar.
- Escritura parcial C3/Access no aparece como éxito. La revisión de una escritura
  se distingue del cierre SDK incierto; recibos conservan el bloqueo incluso si
  no se escribió la marca adicional de revisión. No borrar recibos/marcadores.
- Respuestas de inventario excluyen Password/Group/SuperAuthorize. Errores del
  worker y de ODBC se registran por tipo/código, sin mensajes de excepción.

## Alcance y límites

vigencias_candidato.py no tiene CLI ni factory de hardware. Panel y comando hijo
se inyectan obligatoriamente: en estas pruebas son ficticios. Su modo apply no
es una autorización para fechas reales ni existe aquí un launcher nuevo de
aplicación. Aún falta conectar esta pieza al SDK real y al runner operativo,
comprobar tiempos de parada, vigilancia, respaldo/rollback y transición.

Se incluyen intactos los 20 archivos de Cierres_Coordinador_2026.10.24-1.zip
como dependencias verificadas. Sus lanzadores históricos son readonly y no son
pasos de esta entrega: ejecutar únicamente los tres comandos de arriba. No
abrir lectores/gestores alternos, repetir la captura física ni reemplazar DLL.

No acredita escrituras reales, servicio permanente, historia completa, reloj
del controlador, cruce vehicular ni despliegue. API sigue única autoridad de
vigencias. Backend, credenciales y tareas de Dell se conservan.
