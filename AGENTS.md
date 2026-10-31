# San Isidro 2.0 — guía del proyecto

## Contexto compartido entre chats

La documentación permanente de este proyecto está en `docs/contexto/`. Al comenzar a trabajar en este repositorio, lee `overview.md`, `ways-of-working.md` y `learnings.md`. Consulta los documentos temáticos antes de trabajar en sus respectivas funciones.

| Documento | Fecha del contexto | Uso |
| --- | --- | --- |
| [Overview](docs/contexto/overview.md) | 2026-09-27 | Propósito, roles, stack, arquitectura, diseño e infraestructura. |
| [Ways Of Working](docs/contexto/ways-of-working.md) | 2026-09-15 | Preferencias del usuario para diseño, diagnóstico, cambios, Git y despliegues. |
| [Learnings](docs/contexto/learnings.md) | 2026-09-15 | Aprendizajes técnicos y precauciones del proyecto. |
| [Corte de caja](docs/contexto/corte-caja.md) | 2026-10-05 | Reglas de negocio, decisiones, evolución y pendientes del corte. |
| [Temporadas y tematización](docs/contexto/temporadas-tematizacion.md) | 2026-10-08 | Alcance y decisiones de tematización del dashboard del vecino. |
| [Control de acceso ZKTeco](docs/contexto/control-acceso-zkteco.md) | 2026-10-28 | Polling r2 recuperado tras apagón y vigilancia correcto. Dell i5-4570/4 lógicos/15.94GB RAM,9.25GB libres; muestraCPU30%. Inicio automático sin intervención no atribuido; botón pendiente. |
| [Diseño de integración de acceso](docs/contexto/control-acceso-diseno-integracion.md) | 2026-10-24 | Ingesta y entrega real al backend aislado verificadas; coordinador readonly probado, transición operativa pendiente. |
| [API de control de acceso v1](docs/contexto/control-acceso-api-v1.md) | 2026-10-23 | Contrato implementado localmente: autenticación del agente, estado, lotes, ACK, límites, pruebas y pendientes de ensayo. |
| [Ensayo MySQL de acceso](docs/contexto/control-acceso-ensayo-mysql.md) | 2026-10-23 | MySQL 8.4.13 aislado: migración, concurrencia InnoDB, 24 pruebas aprobadas, repetición y cierre de la instancia temporal. |
| [Emisor local de acceso](docs/contexto/control-acceso-emisor-local.md) | 2026-10-24 | Outbox SQLite y DPAPI; entrega ficticia y 93 respuestas reales confirmadas en ensayo remoto, detalle en coordinador. |
| [Ensayo remoto de acceso](docs/contexto/control-acceso-ensayo-remoto.md) | 2026-10-26 | ACK acumulados de 359 respuestas reales en ensayo aislado, 184 mensajes, cero pendientes y originales conservados; segundo envío idle. |
| [Coordinador de acceso](docs/contexto/control-acceso-coordinador.md) | 2026-10-25 | Ensayo conjunto readonly/HTTP aprobado: 300 respuestas, cola vacía, cierre final confirmado y dos ciclos correctos de r2 tras reanudar. |
| [Operación de acceso](docs/contexto/control-acceso-operacion.md) | 2026-10-25 | Enlace r2 probado: pausa, parada solicitada, verificación de cierre y retorno del polling; integración permanente y vigilancia automática pendientes. |
| [Emisor vigilado de acceso](docs/contexto/control-acceso-envio-vigilado.md) | 2026-10-25 | ZIP2 aceptado en ensayo Dell: cierre limpio, cola vacía, originales conservados y vigencias correctas; integración conjunta/permanente pendiente. |
| [Ensayo conjunto de acceso](docs/contexto/control-acceso-ensayo-conjunto.md) | 2026-10-25 | Ensayo real y cierre final aprobados; polling reanudado con dos ciclos correctos, 300 respuestas/162 mensajes confirmados y originales conservados. |
| [Transición operativa de acceso](docs/contexto/control-acceso-transicion-operativa.md) | 2026-10-25 | Puente readonly aceptado: 838 planes iguales, cierre final confirmado antes de reanudar y dos ciclos correctos; aplicación operativa y transición pendientes. |
| [Aplicador candidato de acceso](docs/contexto/control-acceso-aplicador-candidato.md) | 2026-10-25 | Padre64/hijo32 y perfil C3 cifrado reales aceptados, cierre automático y r2 con dos ciclos correctos; 444 tests locales. Aplicación real y operación continua pendientes. |
| [Servicio integrado de acceso](docs/contexto/control-acceso-servicio-integrado.md) | 2026-10-26 | Ensayo readonly real cerrado: r2 con tres ciclos correctos, 359 originales/184 mensajes ACK, cero pendientes y segundo envío idle. Aplicación real e instalación permanente pendientes. |
| [Consultas del monitor de acceso](docs/contexto/control-acceso-monitor-api.md) | 2026-10-30 | Historial protegido por permiso vigente, actual por pluma y configuración exclusiva admin. SQLite43 (ingesta+monitor) y MySQL26 (monitor) aprobados. Backend publicado y monitor habilitado; lector Dell pendiente. |
| [Pantalla del monitor de acceso](docs/contexto/control-acceso-pantalla-monitor.md) | 2026-10-30 | Diseño y animación aprobados; acceso admin desde dashboard, historial opcional para vigilancia y Buscador conservado. Node48 y QA móvil aprobados. Frontend7be031c en producción, acceso admin confirmado; datos Dell pendientes. Demo pública ficticia separada. |
| [Corrección de la vista ampliada](docs/contexto/control-acceso-correccion-display.md) | 2026-10-30 | Recuperación incompatible con cadencia Dell: candidato3s y mensaje web corregido;45Python/50Node aprobados. Instalación y publicación autorizadas; aceptación real pendiente. |
| [Permisos del historial de Lecturas](docs/contexto/control-acceso-permisos-historial.md) | 2026-10-30 | Admin siempre ve historial; vigilancia por defecto solo última lectura/display y Buscador. Toggle persistente exclusivo admin, protección backend y nueva migración. Node48, SQLite43/375, MySQL26/247 aprobados. Botón físico y puesta en marcha permanente pendientes. |
| [Preparación del despliegue de Lecturas](docs/contexto/control-acceso-despliegue.md) | 2026-10-30 | Backend7c91b73 desplegado, tres migraciones y monitor habilitado; frontend7be031c promovido, admin confirma entrada sin lecturas. Dell y botón pendientes. |
| [Producción permanente Dell](docs/contexto/control-acceso-produccion-dell.md) | 2026-10-30 | Producción operativa: web con lecturas confirmada, parada libre y reanudación PID9340 con dos ciclos correctos/52ACK/RT reciente. Motor r2 original conservado. Botón/HDMI físicos pendientes; revisor readonly preparado. |
| [Ensayo privado del monitor web](docs/contexto/control-acceso-ensayo-monitor-web.md) | 2026-10-29 | SDK→web verificado: última visible p50 1.82s/máx3.14s; 54UUID coincidentes, 359originales/214ACK/0pendientes, cierre y dos ciclos r2 correctos. Error15:15: inventario vacío rechazado antes de escribir; ciclos siguientes correctos. |
| [Reinicio de Lecturas](docs/contexto/control-acceso-reinicio-lecturas.md) | 2026-10-29 | Reinicio real y cierre aceptados, sin aplicar fechas. Retorno r2 con dos ciclos correctos y cola vacía; error15:15 por inventario vacío rechazado sin escrituras, luego dos ciclos correctos. |
| [Preparación operativa consolidada](docs/contexto/control-acceso-preparacion-operativa.md) | 2026-10-26 | Simulación Dell64/32 aprobada: 72 pruebas y 2400 buffers; preflight r2/gestor/tareas coincidente, polling saludable. Piloto de aplicación e instalación/activación pendientes. |
| [Piloto de vigencias](docs/contexto/control-acceso-piloto-vigencias.md) | 2026-10-26 | Piloto real de 12230693 sin cambios, cierre confirmado y r2 reanudado con dos ciclos correctos. No hubo aprobación, respaldo nuevo ni escritura candidata. |
| [Candidato de latencia](docs/contexto/control-acceso-latencia-candidata.md) | 2026-10-29 | SDK→web y correlación54UUID verificados; 359originales/214ACK/0pendientes. Retorno r2 con dos ciclos correctos; respuesta vacía15:15 rechazada antes de escribir, luego dos ciclos correctos. Instalación permanente pendiente; droplet sin cambios. |

Estos documentos contienen contexto histórico, no una certificación del estado actual del código o de producción. Verifica archivos, configuración y pruebas pertinentes antes de afirmar que algo está implementado, desplegado o pendiente. Una instrucción actual del usuario actualiza las preferencias históricas. Para decisiones documentadas que se contradigan, usa la decisión explícita más reciente; si la fecha o el alcance no resuelven la contradicción, expón la duda antes de implementar lo que dependa de ella.

Por ejemplo, el resumen general describe un estado anterior del corte de caja al documento específico. También menciona `DestellosEntrada`, mientras el resumen posterior de tematización descarta destellos al entrar. No restaures una función descartada basándote únicamente en el resumen anterior.

## Forma de trabajar

- Lee el código real antes de proponer cambios. No inventes columnas, endpoints, relaciones ni estructura.
- Para funciones de varios componentes, presenta primero el diseño conceptual y confirma las suposiciones que afecten la implementación. Para errores y refactors, diagnostica primero, sustenta los hallazgos y trabaja en orden de dependencias.
- Prefiere parches mínimos y precisos. Conserva el código y el diseño circundantes; incorpora exactamente el feedback del usuario.
- Explica los pasos y su propósito. Cuando el usuario deba ejecutar operaciones, proporciona comandos exactos para PowerShell o bash según corresponda.
- Antes de editar código, revisa el estado de Git, la rama y el archivo actual. La preferencia histórica es actualizar con `git pull`; verifica primero el seguimiento remoto y las modificaciones locales, y protege el trabajo existente antes de integrar cambios.
- Para commits, agrega archivos mediante rutas explícitas revisadas en `git status`. La configuración histórica es `refactor-headless-final` siguiendo `origin/refactor-headless`, con push `git push origin HEAD:refactor-headless`; verifica que siga vigente antes de usarla.
- No edites archivos de producción directamente. Usa el flujo de Git y el script de despliegue con rsync. Prepara y muestra cambios, prueba en una ruta separada y solicita confirmación antes de aplicar un despliegue a producción.
- No ejecutes `git reset --hard` sobre el docroot: el repositorio tiene `backend/`, mientras Laravel en producción está desplegado plano mediante rsync.

## Arquitectura y reglas esenciales

- Proyecto PWA para pagos de residentes, control de acceso y comunicaciones. Roles: admin, capturista, vigilancia y residente; verifica sus valores reales en el código.
- Stack documentado: React, Vite, Tailwind, Zustand y Axios; Laravel, MySQL y Sanctum. Comprueba versiones actuales en los archivos de dependencias cuando sean relevantes.
- Las páginas complejas siguen `pages/[PageName]/index.jsx` con `hooks/` y `components/`. Reutiliza la instancia centralizada de Axios y el patrón de wrappers existente en el módulo.
- Conserva la identidad visual "Premium Liquid Glass" y las clases globales existentes.
- Aplica las restricciones de acceso y horarios en el backend. El frontend muestra el estado, pero no es la autoridad para permisos ni tiempos.
- Maneja explícitamente fechas y zonas horarias con Carbon y configuración del framework; para horarios de cobro usa `America/Mexico_City`. Evita mutaciones accidentales de objetos Carbon.
- Al recalcular, usa los datos fuente. Distingue las cifras congeladas al cerrar de los desgloses consultados en vivo según las decisiones de cada función.
- No registres `$request->all()` ni contraseñas en logs. Si hay exposición, conserva evidencia para auditoría y coordina la rotación de credenciales afectadas.
- No hagas consultas de datos dentro del render de React. Usa efectos y cancelación de peticiones cuando corresponda. Revisa los aprendizajes de CSS, modales, OneSignal, ZKTeco e iOS antes de tocar esas áreas.

## Reglas temáticas que deben preservarse

- Corte de caja: consulta su documento completo antes de modificarlo. No uses ni vincules `asignaciones_cobro` para esta función. Incluye ventas de tags en el efectivo; preserva conteo ciego, firma libre, historial de intentos y bloqueo del capturista según las decisiones vigentes. Verifica los pendientes históricos, especialmente autenticación en producción y comportamiento tras reapertura, contra el estado actual.
- Tematización: alcance exclusivo del dashboard del vecino. Admin y Vigilancia quedan fuera. Los temas futuros deben configurarse sin modificar componentes; evita reemplazar masivamente las utilidades `orange-*` y respeta los detalles aprobados y descartados.

## Mantenimiento del contexto

Cuando el usuario confirme una nueva decisión o se verifique un cambio de estado, actualiza el documento correspondiente con fecha y evidencia breve. Distingue decisiones confirmadas, observaciones verificadas y asuntos pendientes. No guardes contraseñas, tokens ni secretos en esta documentación. Mantén este índice actualizado si agregas o renombras documentos.
