# Conservación automática de Lecturas, release4

Preparación candidata. Instalar backend y ensayar MariaDB antes de aplicar en Dell.
No modifica motor r2, Access, fechas, SDK, tareas de Windows ni cadencia RT.

- 255 puros conocidos: un snapshot durable comprimido y contadores acumulados en
  originals.sqlite. No se crea un original ni un mensaje HTTP por cada consulta.
  Respuestas mixtas, desconocidas, vacías y errores se conservan completas.
- Salud normal cada30segundos, inmediata ante cambio de lector/fallo. La cola
  sustituye reportes de salud pendientes no arrendados por el más reciente,
  reservando secuencias y conservando las lecturas de vehículos.
- Estados vencidos410 se retiran de la cola con contador local, nunca se inventa
  un ACK. Lotes vehiculares vencidos se conservan bloqueados para revisión.
- Archivos locales con ACK verificado: conservación7días y retiro automático en
  tandas20 cada30segundos. Nunca se retiran originales pendientes ni copias calientes.
  Marcas durables permiten terminar una limpieza tras apagón. SQLite reutiliza
  sus páginas libres; no se ejecuta VACUUM con el sistema activo.
- Contadores llegan con la salud; Laravel integra solo el incremento, conserva
  estado actual, cambios por24horas, resúmenes horarios7días y eventos90días.
  Ventana acordada de admisión/reintento7días. El backend elimina comprobantes
  vencidos sin permitir que sus mensajes antiguos vuelvan a insertar eventos.

La limpieza de información ya confirmada es irreversible desde el archivo local;
la retención de eventos consultables del servidor sigue en90días y conserva las
últimas lecturas. Rollback de código no recupera archivos ya retirados.
No se prometen recuperación de espacio inmediata en InnoDB ni tamaño constante
independiente del tráfico. No hay mantenimiento mensual previsto.

## Actualización de Dell, una vez aprobado el ensayo

Usar Python64 y carpeta separada; no copiar archivos sobre el release activo.
Verificar SHA256 del ZIP y manifiesto. El instalador solo acepta Almacén-3 como
base exacta y delta de fuentes permitido. Primero pausa entre ciclos desde el
gestor y confirma cierre; luego ejecuta desde el paquete:

```powershell
python -B .\actualizar_ingesta.py --verificar-paquete
python -B .\actualizar_ingesta.py --plan
python -B .\actualizar_ingesta.py --aplicar --plan-sha256 HASH_DEL_PLAN_REVISADO
```

El plan consulta capacidades del backend por HTTPS con la credencial DPAPI ya
instalada. Exige summary-v1 activo,7días de admisión,1día técnico y90días de eventos.
Si falta compatibilidad, se detiene antes de modificar enlaces. Aplicación solo
en mantenimiento, con sync.lock, respaldo/enlaces por hash y marcas durables.
Reanudar desde el gestor y comprobar dos ciclos correctos, lectura web y ACK.
Reversión conserva los datos sobrevivientes y usa plan/hash propios.

No abrir un SDK adicional para medir esta corrección. Comparar muestras de conteos
del backend y salud de emisor/lector sin detener el servicio después de aceptarlo.
