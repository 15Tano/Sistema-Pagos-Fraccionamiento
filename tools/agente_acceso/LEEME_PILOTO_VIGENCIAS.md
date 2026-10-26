# Piloto de vigencias 2026.10.26-2

Un tag existente en API, Access y C3. Usa la DLL x86 instalada y el aplicador
protegido anterior. No instala tareas/servicio, consume RT, envia al servidor de
ensayo, cambia permisos/niveles o crea/recupera usuarios. No necesita SSH ni
presentacion fisica del tag. La API habitual sigue siendo autoridad de fechas.

## 1. Simulacion y preflight, sin mantenimiento

Abrir PowerShell **como administrador** en Dell. La simulacion trabaja con SDK,
API y tareas ficticios, procesos/DPAPI reales y una MDB de prueba separada.
La elevacion evita una escritura C3 seguida de rechazo Access por permisos en
Program Files. El principal Highest de la tarea no acredita la consola actual.

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Piloto_Vigencias_2026.10.26-2.zip' -DestinationPath 'C:\SanIsidro\PilotoVigencias_20261026'

powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\PilotoVigencias_20261026\verificar_piloto.ps1'

& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\PilotoVigencias_20261026\simular_piloto.py' --python32 'C:\Users\Dell\Python32\python.exe'

& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\PilotoVigencias_20261026\piloto_vigencias_dell.py' --preflight
```

El preflight solo comprueba rutas, metadatos, elevacion y hashes de r2/gestor.
No abre MDB, consulta API, carga SDK ni descifra credenciales. Comparar la salida
antes de pasar al piloto. No repetir las 72 pruebas ni la carga2400 anterior.

## 2. Piloto real, solo despues de revisar esa salida

Cerrar otros lectores, emisores candidatos y operaciones ZKAccess. Usar
**Preparar mantenimiento en el gestor instalado** y comprobar r2 detenido,
tarea Disabled y mantenimiento active=true. No cerrar la ventana del piloto
mientras trabaje. No pulsar Terminar y reanudar hasta el cierre final confirmado.

Para el tag que ya se probo fisicamente:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\PilotoVigencias_20261026\lanzar_piloto_vigencias.ps1' -Tag '12230693'
```

El lanzador carga las credenciales DPAPI instaladas solo en memoria; no escribir
password/token en comandos ni compartirlos. No cambia esas credenciales.

1. Consulta API y fechas Access/C3 actuales. Publica plan y hash completos.
2. Si coinciden, termina con status=no_changes y dates_applied=false: sin
   respaldo adicional, Approval, Set o UPDATE. Esto no certifica la ruta de
   escritura y no se fabrica una diferencia para conseguirlo.
3. Si hay diferencia natural, verifica copia MDB privada y perfil C3/permisos
   cifrados. Solo entonces muestra la frase `APLICAR tag SHA256` del plan.
   Revisar fecha API y valores anteriores. ENTER vacio cancela conservando
   respaldo; la espera vence a los120s. Si hay duda, cancelar y compartir plan.
4. Despues del consentimiento vuelve a leer API/Access/C3. Si algo cambio,
   rechaza antes de emitir el alcance. Approval nueva, ligada a ese plan y60s,
   se crea despues de los respaldos y de la espera humana. No se renueva en el
   trabajador para eludir vencimiento.
5. Aplica solo fechas del tag que cambian; C3 se cierra/verifica antes de Access.
   Conserva evidencia durable y bloquea reintentos tras una aplicacion parcial.
   Una solicitud Ctrl+C antes de aplicar cancela; durante la transaccion se
   atiende al terminar ese tag, para no abandonar Access despues de C3.

Una marca temporal propia en GestionTags/revision_pendiente.json bloquea
reanudacion y otras escrituras desde antes de abrir SDK. No es un error por si
sola. La guardia solo admite su marca exacta y el padre nativo vivo, su nacimiento
y permiso DPAPI ligado a la operacion. Una revision ajena siempre impide continuar.

Al salir Python, el mismo lanzador ejecuta verificacion del UUID de ESTE
lanzamiento, recibos/ACK, transacciones, procesos, lock y handle MDB liberado.
Solo con cierre_piloto_confirmado/safe_to_resume=true retira su propia marca,
y permite **Terminar y reanudar** en el gestor. Comprobar dos ciclos nuevos.
No crea un permiso de activacion permanente ni habilita una tarea nueva.

Ante fault/parcial/cierre incierto: conservar mantenimiento y evidencia, no
borrar marcas/locks ni repetir el comando para aplicar de nuevo. No se hace
rollback automatico de fechas: una restauracion debe cotejar la API actual.
Un SDK incierto conserva la exclusion; no matar el proceso para eludirla.

Todos los archivos del piloto quedan bajo datos/sesiones/UUID. Son privados
para el usuario y SYSTEM. Los respaldos se conservan; maximo64sesiones. La
cola/originales del ensayo y su credencial permanecen fuera de este piloto.

## Alcance de la aceptacion

Una salida verified/dates_applied=true acredita solo las componentes indicadas
para el tag y la fecha API mostrados; no prueba paso fisico ni otros tags.
no_changes/declined son cierres sin escritura, no una prueba de Set/UPDATE.
El backend de produccion, transporte HTTPS definitivo, enlace del gestor y
operacion continua todavia necesitan su aceptacion y despliegue aparte.
