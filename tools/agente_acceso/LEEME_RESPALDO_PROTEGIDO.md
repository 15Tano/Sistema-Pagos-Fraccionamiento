# Respaldo protegido — 2026.10.25-1

Bibliotecas candidatas y comprobaciones locales. No instala ni reemplaza el
polling, gestor, vigilancia, SDK o tareas. No ofrece un comando de escritura.
No necesita mantenimiento, SSH, túnel, presentar tag ni estar en caseta.

## Ejecutar en una PowerShell de Dell

Usar carpeta nueva; no sobrescribir AplicadorCandidato ni publicaciones previas.
Copiar solamente comandos del bloque, sin el prompt PS ni salidas anteriores.

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Respaldo_Protegido_2026.10.25-1.zip' -DestinationPath 'C:\SanIsidro\RespaldoProtegido_20261025'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\RespaldoProtegido_20261025\verificar_respaldo.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\RespaldoProtegido_20261025\simular_respaldo.py'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\RespaldoProtegido_20261025\simular_respaldo.py' --comprobar-dpapi
```

Esperado: simulation_ok/31 pruebas y dpapi_ok/3 pruebas, cero fallos/errores/
omisiones. La segunda usa DPAPI real del usuario actual, con perfil ficticio y
un proceso hijo del mismo usuario. No accede a credenciales instaladas ni MDB.
Temporales propios bajo datos/pruebas_respaldo_protegido y datos/pruebas_respaldo_dpapi;
se limpian al terminar. Evidencia JSON/TXT en registros. Compartir solo salidas
resumidas, no archivos snapshot.dpapi ni objetos descifrados.

## Alcance comprobado

respaldo_protegido.Store cifra con DPAPI CurrentUser el registro user de siete
campos, permisos userauthorize y plan anterior de un tag existente, incluidas
fechas/identidad de Access. Password solo dentro del cifrado y memoria; manifiesto
público con contexto y hash del cifrado, sin hash del texto claro. Persistencia
exclusiva/fsync, relectura y descifrado antes de devolver confirmación. Contexto
de plan/serial/UUID vinculado; detectar corrupción o intercambio de snapshots.

puente_fechas_protegido.ProtectedDatesPanel guarda ese snapshot y su referencia
durable antes de llamar al binding de fechas. Si falla protección o disco, no
alcanza SetDeviceData. SDK sustituido en las pruebas, ninguna escritura C3 real.
Es una interfaz para el futuro trabajador; no está conectada al polling ni al
run_scoped_worker anterior. El futuro padre debe conservar sync.lock/gate y
verificar cierre antes de liberar el turno o continuar con Access.

recuperacion_selectiva.review vuelve a abrir el respaldo y compara identidad,
campos protegidos y permisos contra fuentes actuales. Si son distintos bloquea
la conciliación. Si solo difieren fechas propone un plan nuevo contra la API
actual, incluso vencida. Nunca restaura vigencia antigua, crea usuarios, repara
niveles, borra evidencias o emite aprobación. No modifica destinos ni resuelve
intentos pendientes de revisión; requiere consulta real y aprobación futura.

## Capacidad y conservación

Admisión hasta 1024 snapshots, 256 MiB en archivos y reserva de al menos 64 MiB
libres después del respaldo. Snapshot individual máximo 1 MiB, manifiesto 8 KiB.
Son límites de esta biblioteca candidata, no una política instalada. El escritor
debe ser único bajo el bloqueo operativo: la admisión no sustituye sync.lock.
Al llegar al límite o encontrar contenido ajeno, falla antes de escribir C3;
no elimina respaldos para hacer sitio. Incompletos también se conservan y cuentan.
La retención/exportación administrativa debe definirse antes de operación continua.
No borrar archivos ni subir límites para eludir una revisión pendiente.

El descifrado requiere el contexto DPAPI correspondiente. Se probó reapertura
por otro proceso del mismo usuario; no se acredita recuperación tras reinstalar
Windows, en otro equipo o con otra cuenta. No es un respaldo portátil. Symlinks,
junctions y rutas redirigidas se rechazan; no es una defensa contra un atacante
que ya controla el mismo usuario de Windows.

## Pendientes

No se copia ni se restaura la MDB completa, historial Access, membresías ni
otros usuarios. El plan incluye solo las fechas/identidad Access del tag. Falta
respaldo consistente de MDB y recuperación operativa revisada antes de una
escritura real. Tampoco hay transporte de autorización, launcher de aplicación,
runner continuo, instalación, pantalla, endpoints o despliegue en esta entrega.

Incluye Aplicador_Candidato_2026.10.25-2 completo e intacto como dependencia;
sus comandos históricos no forman parte de esta prueba. No ejecutar lanzadores
incluidos de mantenimiento/aplicación para validar este paquete.
