# Aplicador candidato — 2026.10.25-2

Módulo de aplicación acotada y preparador readonly. API sigue única autoridad
de vigencias. No instala tareas, reemplaza polling/gestor/DLL ni publica backend.
No ofrece launcher de escritura ni emite aprobaciones reales.

## Primero: simulación en Dell, sin mantenimiento

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Aplicador_Candidato_2026.10.25-2.zip' -DestinationPath 'C:\SanIsidro\AplicadorCandidato_20261025'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\AplicadorCandidato_20261025\verificar_aplicador.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\AplicadorCandidato_20261025\simular_aplicador.py'
```

Esperado: simulation_ok,38pruebas/fallos0/errores0/omisiones0. Usa API/SDK/Access/
DPAPI/tareas/CIM ficticios, sin red ni DLL. Las cinco pruebas locales con ACE/ODBC
real sobre MDB ficticios se ejecutaron aparte y no se requieren en Python32.
Temporales con limpieza guardada bajo datos/pruebas_aplicacion_vigencias y
datos/pruebas_preparacion_aplicador; evidencia en registros/. No usa la outbox real.

## Preparar un plan real, después de aceptar la simulación

Esta operación también es solo lectura y NO autoriza aplicar. Requiere pausa
por gestor instalado, API habitual, Access y C3. No servidor/túnel SSH ni tag
físico. Cerrar ZKAccess/otros lectores y paneles candidatos; no realizar otras
consultas del gestor mientras corre el preparador.

Tras Preparar mantenimiento y confirmar Disabled/active=true/polling stopped:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\AplicadorCandidato_20261025\lanzar_preparacion_aplicacion.ps1' -Tag '12230693'
```

12230693 es el tag de la prueba física anterior. Si no está en API/Access/C3,
se rechaza la preparación: no crear, recuperar, renovar ni cambiar pagos para
forzar una prueba. El resultado contiene plan, hash, fechas anteriores/objetivo,
flags de cambios y approval_issued=false. Si todo coincide, no necesita escribir.

Esperar FIN preparación y regreso al prompt, sin Ctrl+C. Para parada propia:

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\AplicadorCandidato_20261025\preparar_aplicacion.py' --detener
```

Después de phase stopped:

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\AplicadorCandidato_20261025\preparar_aplicacion.py' --verificar-cierre
```

Solo con cierre_puente_confirmado: Terminar y reanudar por gestor y comprobar
dos ciclos nuevos. Fault/no confirmación: conservar mantenimiento y evidencia.
El control usa estado_puente.json propio de esta carpeta nueva y el verificador
readonly ya probado. No ejecutar otros lanzadores históricos incluidos.

El plan se guarda como plan_propuesto.json, sin aprobación, dentro de
datos/sesiones/UUID. Nuevos recibos readonly se agregan al ledger de ensayo
existente; no se toca outbox.sqlite, originales RT o ACK de envío.

## Controles implementados en las bibliotecas

- Un tag existente y plan exacto con hash confirmado; caducidad60s al crear
  Approval. Ese objeto representa una aprobación ya obtenida fuera del módulo:
  hash/booleano no son autenticación, firma ni autorización de backend. Esta
  entrega no tiene comando que los emita para escribir. Tests usan solo datos
  ficticios y un SDK sustituido.
- API nueva al ejecutar y antes de cada componente. Si cambia la vigencia, se
  rechaza; no se sustituye por una fecha inventada ni se renueva el tag.
- Respaldo e intenciones exclusivos/fsync antes de intentar escribir. Corte,
  resultado parcial/corrupto o revisión pendiente bloquean otro intento desde
  evidencia, incluso sin marca adicional. No reset/force ni rollback global.
- C3: misma ABI SetDeviceData de r2, DLL32/hash/serial comprobados; solo cuatro
  campos de user, Pin original y fechas oficiales. Todos los demás campos y
  permisos se verifican tras escribir. Scope/backup/request vinculados; sin
  replay del trabajador y sin Password en disco/payload de escritura.
- Access: transacción obligatoria, comparación del estado previo en WHERE,
  parámetros SQL/NULL, lectura posterior y commit. Solo acc_startdate,
  acc_enddate,set_valid_time. C3 debe estar verificado primero si necesitaba
  cambiar. Fallo de commit puede ser incierto: no afirmar deshacer lo confirmado.
- Si falla después de un intento, el componente queda unconfirmed y requiere
  revisión. No rescribir C3 o restaurar fechas antiguas a ciegas; reconsultar la
  API y revisar el alcance. No se modifican altas, niveles, dinero ni asociaciones.

## Pendientes y límites

La escritura mediante este binding aún NO se probó en la C3 real. Falta el
transporte del alcance autorizado y su aplicación acotada, integración continua,
gestor/vigilancia y transición con respaldo/rollback revisables. El futuro padre
debe mantener sync.lock/gate, comprobar recibos y transmitir la aprobación ya
confirmada; un objeto Approval no sustituye ese control.

El backup implementado conserva fechas e identidad anteriores. Antes de una
prueba real de escritura falta integrar el respaldo protegido del registro y
permisos completos/MDB y una recuperación selectiva verificable, sin guardar
Password en texto claro. Esta entrega no certifica restauración de esos campos.

Dependencias congeladas: Puente_Readonly_2026.10.25-1 completo/intacto y sus
referencias r2/núcleo/envío. No registrar ni sustituir SDK. No pantalla, nuevos
endpoints ni despliegue. Conservar High para la revisión de esta fase.
