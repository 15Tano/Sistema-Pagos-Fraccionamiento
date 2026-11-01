# Correccion de recorrido del archivo local — 2026.10.31-3

Candidato para base Display-2 exclusivamente. No es la modalidad de pantallas
locales ni cambia turnos SDK, fechas, intervalos, ACK, reintentos o esquema SQLite.

Los calculos de tamano de archivos usan os.scandir y los metadatos enumerados
por Windows. No se cachean totales entre llamadas ni se omiten verificaciones
de ACK, hashes, originales o capacidad. La verificacion completa del catalogo
durante el arranque sigue activa; puede tardar con muchos archivos.

## Instalacion y retorno

Usar una carpeta nueva. Verificar SHA256 del ZIP y ejecutar con Python64 de Dell:

1. actualizar_almacen.py --verificar-paquete, sin SDK ni cambios de tareas.
2. Pausar con mantenimiento.ps1 y comprobar produccion_dell.verify_closed().
3. actualizar_almacen.py --plan; revisar hashes y alcance.
4. --aplicar --plan-sha256 HASH. Copia nuevo release inmutable y respalda los tres
   JSON de enlace en ZKSync/actualizaciones_almacen/UUID. No inicia tareas/SDK.
5. Reanudar por gestor. Esperar nueva sesion, ciclos, lecturas y ACK; comparar
   tendencia y antiguedad de cola. Un proceso nuevo no acredita por si solo salud.

Reversion en mantenimiento confirmado: --plan-reversion --actualizacion-id UUID;
despues --revertir --actualizacion-id UUID --plan-sha256 HASH. Conserva ambas
versiones, datos, originales y ACK. Una marca de revision parcial se conserva
hasta reversion/aplicacion verificada; nunca borrarla manualmente para continuar.

La demora HTTP de las muestras Dell fue .31–.33s y la cola crecia; este cambio
atiende trabajo local repetitivo. Solo el ensayo Dell podra atribuir el ahorro
real y demostrar que el emisor alcanza la produccion. No promete latencia maxima
ni prueba retrospectivamente el codigo SQLite del OperationalError anterior.
