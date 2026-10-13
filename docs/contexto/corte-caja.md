Last updated
Oct 5, 2026
Summary
Corte de caja (daily cash reconciliation) feature for San Isidro Pagos module — full agreed design, real schema findings, and implementation phase status. Large feature, read this first before continuing work on it.

Details
Contexto y origen
Problem raised by Kanye: capturistas struggle to switch tabs to do the daily cash cut ("corte del día") the same day; wanted a button/flow to count total daily sales to reconcile against the paper log and physical cash, reopenable if someone pays a few minutes after close
Requirements were gathered live from Kanye relaying two non-technical decision-makers (community committee) who use the system and know what they want but aren't technical
Roles in the system: capturista and admin. Capturistas are the ones who must be controlled/locked by the corte; admin can keep seeing/using everything regardless of corte state
Agreed flow (confirmed by Kanye, final)
Trigger: automatic, backend-driven, at 20:15 on the días de cobro — backend is explicitly the source of truth for the time (not the frontend clock), because Kanye needs the timing to be infalible
At trigger time it interrupts the capturista's session immediately, regardless of what they're doing (e.g. mid-payment-form)
Blind count flow: system shows NO accumulated total or data first. It asks the capturista to enter the physical cash amount first
If the declared amount matches the system total for the day: congratulates the capturista and shows the full desglose (breakdown)
If it does not match: logs the attempt as a numbered intento with its difference, shows the desglose so the capturista can find the error, and offers to re-enter the amount. Repeats on each mismatch. No hay límite de intentos
Escape valve: after 3+ failed intentos, the system offers "cerrar con diferencia" (available, not forced) — requires a mandatory nota/justificación, then closes and locks exactly like a successful match, just flagged with a difference
Once matched (or closed with difference), the corte shows the amount and desglose in large format and fully locks the capturista from manipulating the system in any way until the next día de cobro. Durante el bloqueo: consultar sí, modificar no
Closing requires the capturista to sign by entering their own name as a free-text field — NOT validated against the logged-in session name (shared/technical account across 4 equipos)
Whole capturista session is blocked during the corte process (not just the payments module)
If the capturista loses connection/closes the tab mid-process, it must resume exactly where they left off (same attempt count, same state) on next login
Only one capturista works per día de cobro — no concurrency concern there
Reapertura (reopen) is admin-only, done later from the admin's own new "cortes" tab (never live/in real time); on reopen, capturista returns to normal payment-capture mode, NOT back into the blind-count flow
Build order: capturista-facing corte flow first; admin's new "cortes" dashboard tab/module comes last (explicitly deferred)
Real schema findings (repo 15Tano/Sistema-Pagos-Fraccionamiento, branch refactor-headless)
pagos table has NO user_id/capturista tracking column: id, vecino_id, cantidad, mes, tipo (enum: ordinario|extraordinario), restante, fecha_de_cobro, meses_pagados
Capturista login is one shared/technical account across 4 equipos (confirmed via CapturistaController.php comment); User.role is plain string
asignaciones_cobro table exists but is work-in-progress for a future feature — Kanye said explicitly NOT to touch/reference it from corte de caja, now or ever
config('app.timezone') is UTC — 20:15 trigger must explicitly set America/Mexico_City on the Laravel scheduler
PagoObserver (audit logging) ruled OUT as relevant — corte only needs to know who closed it (free-text firma), not who registered each payment
No way for a capturista to end up with a $0 corte (system-level fact)
Design: corte keyed by fecha alone (one corte per día de cobro, no per-capturista dimension). Daily 20:15 job opens a corte only if pagos exist for that fecha_de_cobro
"Especiales" is NOT a separate tipo — it's a pago with tipo=ordinario whose cantidad is different from 280 (300, 500, etc.) — a value-based classification rule, not the enum
Venta de tags: separate feature/table, modelo Tag (fillable: codigo, activo; uuid route key) y modelo TagSale (fillable: tag_id, sold_at [datetime cast], price). Venta de tags es SIEMPRE en efectivo (confirmado, sin excepciones) — debe incluirse en monto_sistema
Migración de cortes_caja (construida y commiteada, no desplegada a producción)
Schema::create('cortes_caja', function (Blueprint $table) {
    $table->id();
    $table->uuid('uuid')->unique();
    $table->date('fecha')->unique();
    $table->decimal('monto_sistema', 8, 2)->nullable();
    $table->enum('estado', ['en_proceso', 'cuadrado', 'cerrado_con_diferencia'])->default('en_proceso');
    $table->json('intentos')->nullable(); // [{numero, declarado, diferencia, at}]
    $table->string('firma_capturista')->nullable();
    $table->text('nota_diferencia')->nullable();
    $table->timestamp('cerrado_at')->nullable();
    $table->timestamp('reabierto_at')->nullable();
    $table->string('reabierto_por')->nullable();
    $table->text('motivo_reapertura')->nullable();
    $table->timestamps();
});
Modelo CorteCaja sigue el mismo patrón que Pago/Vecino (uuid como route key vía booted() creating hook)
Backend — estado: DONE
Migración + modelo CorteCaja
Job programado: AbrirCorteCaja (cortes-caja:abrir) dailyAt('20:15')->timezone('America/Mexico_City') en routes/console.php; solo abre si Pago::whereDate('fecha_de_cobro', hoy)->exists()
Middleware BloquearSiCorteActivo (alias corte.bloqueo, aplicado a todo auth:sanctum): bloquea no-GET para role=capturista cuando el corte de hoy está en_proceso o cerrado sin reabierto_at. GET, corte-caja/*, logout, me exentos. Admin nunca afectado. Nota: las rutas exentas deben incluir el prefijo api/ (api/corte-caja/*, api/logout, api/me) porque routes/api.php se auto-prefija
Endpoints (CorteCajaController): GET /corte-caja/hoy, POST /corte-caja/intentar {monto_declarado}, POST /corte-caja/cerrar {firma}, POST /corte-caja/cerrar-con-diferencia {nota, firma}
Bugfix crítico aplicado: monto_sistema ahora se calcula con un helper montoSistemaDelDia($fecha) que suma Pago::whereDate('fecha_de_cobro',...)->sum('cantidad') + TagSale::whereDate('sold_at',...)->sum('price') — antes solo sumaba pagos y por eso cualquier día con venta de tags iba a fallar en cuadrar
desgloseDelDia($fecha) devuelve: ordinario (pagos tipo=ordinario, cantidad=280, constante self::MONTO_CUOTA_ORDINARIA), especiales (tipo=ordinario, cantidad != 280), extraordinario (tipo=extraordinario), ventasTags (suma TagSale.price), tagsCount, total, cantidad_pagos
Nota abierta no bloqueante: MONTO_CUOTA_ORDINARIA=280 es un número mágico en el controller — si la cuota cambia con el tiempo debería vivir en config/BD. Tampoco está confirmado si TagSale.price tiene cast explícito a decimal/float en el modelo
Decisión sobre el componente DesgloseFinanciero existente
Se evaluó reusar el componente existente (frontend/src/pages/Historico/components/DesgloseFinanciero.jsx, estilo "Premium Liquid Glass", tira de 4 tarjetas con iconos) tal cual, pero se descartó: su array CONCEPTOS está hardcodeado dentro del componente con labels/semántica pensada para otra pantalla, y no calzaba con el tono "ritual" de la spec de UX recibida
DECISIÓN FINAL (confirmada por Sebastian): construir un desglose nuevo, tipo lista/recibo, específico para esta pantalla — componente DesgloseJornada.jsx — en vez de forzar el reuso de DesgloseFinanciero
También se descartó agregar un campo "Dispositivo: CAPTURA-01" que aparecía en un mockup de referencia — no existe en el schema y Sebastian confirmó que no se quiere
Spec de UX del modal de conteo ciego (recibida de otra consultoría de diseño, ya validada contra el backend real)
Paso 1 — Declaración: input grande, SIN mostrar el total esperado, foco automático, teclado numérico, botón deshabilitado sin monto válido
Verificación: transición con delay artificial ~600-900ms ("Comprobando cierre...")
Resultado A (coincide): check + count-up del monto + desglose que entra con stagger
Resultado B (diferencia): muestra "tu conteo" vs "total registrado" vs "diferencia", permite consultar el desglose de registros pero NO modificar nada ("consultar sí, modificar no"), botón de reintentar (sin límite de intentos), válvula "cerrar con diferencia" disponible (no forzada) desde el intento 3
Cada intento se conserva en la bitácora (nunca se sobrescribe)
Resultado final — Sellado: check, monto, capturista (firma), hora de cierre, número de intentos — SIN campo de dispositivo
Pantalla de bloqueo persistente: mismo resumen del sellado + "el sistema permanecerá bloqueado hasta la siguiente jornada de cobro", dashboard de fondo con blur
Lenguaje visual: glass/backdrop-blur-2xl, radios ~28-32px, jerarquía tipográfica marcada (CIERRE DE JORNADA pequeño → ¿CUÁNTO TIENES? grande → $8,450.00 enorme → EFECTIVO CONCILIADO pequeño), animaciones sutiles (fade+scale, check dibujándose, count-up, stagger, vibración horizontal leve en error — sin shake exagerado, spring en reintento)
Arquitectura de frontend (confirmada contra el árbol real de carpetas)
Stack real: React + Vite + Tailwind, axios centralizado en lib/axios.js (instancia api, interceptor de request inyecta token desde localStorage "auth-storage", interceptor de response maneja 401)
Mecanismo de interrupción "inmediata": polling cada 20s a GET /corte-caja/hoy mientras el usuario autenticado sea capturista (no websockets/SSE). Confirmado sostenible: una sola cuenta capturista activa a la vez, ~4300 req/día de un único cliente, endpoint liviano
Ubicación: NO va en pages/ (no es una ruta navegable) — va en components/CorteCaja/, hermana de components/layout/ y components/decoraciones/ (mismo patrón ya usado en el proyecto para overlays globales tipo PapelPicado/ConfettiFondo)
Estructura de archivos: lib/corteCaja.js (wrappers de los 4 endpoints, importa ./axios); hooks/useCorteCaja.js (máquina de estados fase: inactivo|declarando|verificando|coincide|diferencia|sellado, maneja polling y declarar/reintentar/cerrar/cerrarConDiferencia); components/CorteCaja/CorteCajaGuard.jsx (orquestador, se monta UNA vez en components/layout/layout.jsx, línea suelta <CorteCajaGuard /> dentro de <div className="app-shell">, sin envolver {children}; usa ReactDOM.createPortal hacia document.body porque el <aside> del sidebar tiene transform en móvil, lo que rompe position:fixed de un hijo normal); components/CorteCaja/PasoDeclaracion.jsx, PasoVerificando.jsx, ResultadoCoincide.jsx, ResultadoDiferencia.jsx, PantallaSellada.jsx, DesgloseJornada.jsx
Layout.jsx real de Sebastian: <Layout>{children}</Layout> envuelve tanto rutas admin como capturista vía AdminRoute en App.jsx, así que montar CorteCajaGuard ahí una sola vez cubre todas las rutas donde un capturista puede estar (/, /vecinos, /pagos, /tags, /historico)
Código ya escrito y entregado a Sebastian (pendiente que lo pegue/pruebe en su repo — no confirmado que corra)
lib/corteCaja.js — completo (getCorteHoy, intentarCorte, cerrarCorte, cerrarCorteConDiferencia)
hooks/useCorteCaja.js — completo: polling con setInterval 20s (limpia con clearInterval), evaluarCorte() decide fase según estado/reabierto_at, declarar() hace POST intentar con delay artificial de 750ms (Promise.all) antes de cambiar de fase, reintentar() vuelve a fase declarando, cerrar()/cerrarConDiferencia() llaman sus endpoints y pasan a fase sellado
components/CorteCaja/CorteCajaGuard.jsx — completo: createPortal a document.body, checa user.role === 'capturista', retorna null si inactivo, renderiza la fase correspondiente
components/CorteCaja/PasoDeclaracion.jsx — completo: input numérico grande con autofocus, botón deshabilitado si monto inválido, estilo glass-card
components/CorteCaja/PasoVerificando.jsx — completo: spinner simple con Tailwind (animate-spin), sin lógica propia
components/CorteCaja/DesgloseJornada.jsx — completo: recibe props desglose (ordinario/especiales/extraordinario/ventasTags/total) y tituloFecha opcional; incluye su propio formatCurrency local (es-MX, sin decimales) — pendiente decidir si se centraliza en lib/format.js; stagger de entrada (~90ms por fila)
Integración en Layout.jsx: agregar import CorteCajaGuard from "../CorteCaja/CorteCajaGuard"; y <CorteCajaGuard /> como primera línea dentro de <div className="app-shell">, sin tocar nada más
Implementation phase plan
DONE — Migración + modelo CorteCaja
DONE — Job programado AbrirCorteCaja
DONE — Middleware BloquearSiCorteActivo (confirmado funcionando via prueba manual, 423 correcto)
DONE — Endpoints CorteCajaController (confirmado funcionando via ciclo completo de pruebas en Postman)
EN PROGRESO (avanzado) — Frontend capturista UI. lib/corteCaja.js, useCorteCaja.js, CorteCajaGuard.jsx, PasoDeclaracion.jsx, PasoVerificando.jsx, DesgloseJornada.jsx escritos por Sebastian; ResultadoCoincide.jsx y PantallaSellada.jsx construidos por Claude (glass oscuro, check dibujado, count-up, entregados como archivo, sin reportar bugs); ResultadoDiferencia.jsx fue reescrito por Sebastian por su cuenta varias veces durante la sesión — Claude dejó de mantener una copia propia del archivo y ahora solo da parches puntuales sobre lo que Sebastian pega
Real GET /corte-caja/hoy response (corte #3, fecha 2026-09-17) confirmed exact shape: corte.intentos is an array of {numero, declarado, diferencia, at}; top-level fields id, uuid, fecha, monto_sistema, estado, firma_capturista, nota_diferencia, cerrado_at, reabierto_at, reabierto_por, motivo_reapertura, created_at, updated_at; desglose has ordinario, especiales, extraordinario, ventasTags, tagsCount, total, cantidad_pagos
Investigated 840-vs-990 monto_sistema/desglose discrepancy: NOT a calculation bug. corte.monto_sistema is null while en_proceso, only set at close; a TagSale created after close time made the live-recalculated desglose drift from the frozen monto_sistema — exactly the "pago después del cierre" scenario reapertura exists for
DECISION (confirmed by Kanye): dejar el desglose sin congelar — hoy() sigue recalculando desgloseDelDia() en vivo siempre, incluso para un corte cerrado; no se agrega columna desglose ni se toca cerrar()/cerrarConDiferencia()
Bugs de useCorteCaja.js encontrados y corregidos en esta sesión
Bug 1 (causa de "$0" en TU CONTEO / TOTAL REGISTRADO): al reconstruir ultimoResultado desde corte.intentos en la hidratación inicial, Sebastian usó claves que no existen en el shape real (ultimoIntento.monto_declarado/.monto, data.corte.numero_intento, data.corte.monto_sistema mientras en_proceso, data.corte.puede_cerrar_con_diferencia). Fix: reconstruir todo desde el propio intento — declarado, diferencia, numero — y calcular monto_sistema = declarado - diferencia, puede_cerrar_con_diferencia = intentos.length >= 3 && diferencia !== 0
Bug 2 (el poll regresaba a declarando cada 20s estando en diferencia/coincide): la lista de fases protegidas del polling subsecuente no incluía "diferencia"/"coincide" (luego tampoco "interrupcion" cuando se agregó, mismo bug recurrente). Fix: agregar cada fase interactiva nueva a esa lista de exclusión
Bug 3 (interrupción duraba ~2.7s en vez de 10s, solo con StrictMode activo — confirmado que main.jsx sí tiene <StrictMode>): el doble-montaje de efectos de StrictMode en dev dejaba una llamada tardía a consultarHoy() de un montaje ya descartado pisando la fase; inicializadoRef sobrevivía el remount sintético. Fix: resetear inicializadoRef.current = false en el cleanup del useEffect de polling, y asegurar que "interrupcion" esté en la lista de fases protegidas del punto anterior
Patrón adoptado (bandera inicializadoRef, propuesto por Sebastian): la hidratación inicial (primera resolución de fase al montar/refrescar) corre UNA vez por montaje real; después de eso el polling solo puede tocar la fase si no es una fase interactiva en curso
Fase nueva: "interrupcion" (pantalla de transición día-terminado → empezar corte)
Requisito (confirmado por Kanye): debe aparecer en cada refresh, pero SOLO mientras intentos.length === 0 (el primerísimo intento del día); una vez que existe al menos 1 intento, refrescar va directo a declarando/diferencia/coincide, nunca vuelve a mostrar la interrupción
Comportamiento: auto-avanza a los 10 segundos; un tap en cualquier parte de la tarjeta avanza al instante
Implementación: useCorteCaja expone avanzarConteo() (setFase("declarando")); nuevo componente InterrupcionAviso.jsx (ícono con pulso, título "Es hora de hacer el corte de caja", barra de progreso de 10s, onClick=avanzar) — construido por Claude, entregado como archivo
Wiring pendiente de un lado de Sebastian: agregar el branch {fase === "interrupcion" && <InterrupcionAviso onContinuar={avanzarConteo} />} en CorteCajaGuard.jsx
ResultadoDiferencia.jsx — evolución (Sebastian, fuera de lo que Claude entregó originalmente)
Sebastian reescribió el componente completo con un layout de "islas" de vidrio independientes (GlassIsland reutilizable con glow), un AnimatedValue que solo anima cuando el valor cambia (no cuenta desde $0 en cada render), navegación anterior/siguiente entre intentos individuales (en vez de lista completa), iconos SVG propios, y bloqueo de document.body.style.overflow mientras el modal está montado en vez de quitar el overlay duplicado — Claude dejó de mantener copia propia de este archivo y solo da parches puntuales
DECISION (confirmada por Kanye): el desglose de categorías (ordinario/especiales/extraordinario/ventasTags) debe estar oculto en el 1er intento fallido y visible desde el 2do en adelante — implementado con un placeholder (ícono candado + texto) en el 1er intento
Feature nueva: "Revisar por plaza" (verificación de efectivo por calle, contra la hoja física)
Motivación (Kanye): a veces hay que checar plaza por plaza (= calle) cuánto efectivo entró, porque la hoja física de conteo del capturista está organizada por calle con subtotales ("Plaza del Maguey — todos los pagos que hubo ahí")
Confirmado con Kanye: solo lectura, sin marcar nada como "revisado", sin persistencia de ningún tipo (ni backend ni local) — es puro cruce visual contra el papel
Venta de tags se muestra igual que antes (total + cantidad, sin desglosar por calle, ya que TagSale no tiene vecino/calle asociado)
Trigger: botón dentro de la Isla 2 de ResultadoDiferencia (junto al header "Desglose del día"), visible solo desde el 2do intento igual que el desglose de categorías
Backend nuevo: GET /corte-caja/hoy/plazas en CorteCajaController — agrupa Pago::whereDate('fecha_de_cobro', hoy)->with('vecino:id,nombre,calle') por vecino.calle, devuelve {plazas: [{calle, subtotal, cantidad_pagos, pagos: [{id, vecino, cantidad, tipo}]}], ventas_tags: {total, cantidad}}. Ruta GET, no necesita tocar el middleware BloquearSiCorteActivo (GET siempre exento). Asunción sin confirmar: que el modelo Pago tiene relación vecino() y Vecino tiene columnas nombre/calle (consistente con lo que ya usa useHistoricoData en el frontend, pero no se vio el modelo Pago.php directamente)
Frontend: lib/corteCaja.js +getPlazasDelDia(); nuevo componente VerificacionPorPlaza.jsx — Claude entregó una primera versión (acordeón simple), Sebastian la reescribió con arquitectura resumen→detalle (dos vistas deslizantes tipo carrusel dentro del mismo modal en vez de acordeón, con lucide-react icons, buscador de plaza cuando hay más de 6, total agregado por plazas)
Bugs de CSS corregidos sobre la versión de Sebastian (sin tocar nada más del diseño, a pedido explícito de Kanye — "me gusta como está"): (1) rendija de la vista anterior asomándose en la transición — fix: trasladar el panel oculto a translate-x-[101%] en vez de 100% para absorber el redondeo de subpíxel; (2) doble barra de scroll (fantasma de la vista inactiva a la izquierda + la activa cortada a la derecha) — fix: el panel inactivo pasa a overflow-hidden (condicional a vista === "...") en vez de mantener overflow-y-auto siempre activo, y el margen negativo se volvió asimétrico (-ml-2 pl-2 en vez de -mx-2 px-2) para que el borde derecho no quede más allá del área que recorta el contenedor padre
Pendiente sin confirmar aún: si el error de sintaxis PHP que salió al pegar plazasDelDia() en CorteCajaController.php (línea 222, "expecting function or const") ya se resolvió — Kanye no volvió a compartir el archivo corregido
Admin's new "cortes" tab (listado/historial + reapertura) — LAST, deferred
Punto 6 — Admin "cortes" tab: diseño confirmado (Kanye)
Un corte NO se reabre más de una vez — reabierto_at/reabierto_por/motivo_reapertura como campos únicos (sin migrar a bitácora tipo array); la pantalla de admin es casi solo de consulta
Solo existe una cuenta de admin (no hay múltiples admins con sesiones individuales) — reabierto_por no necesita lógica por-usuario
Reapertura: sí requiere modal de confirmación ("¿estás seguro?") antes de ejecutar; el motivo/justificación NO es obligatorio
Búsqueda por firma del capturista confirmada como filtro deseado en el listado, junto a rango de fechas y estado
Ubicación en la UI: cambió de opinión — la pestaña "Cortes" SÍ va también en la navbar (no solo en hamburguesa), con un ícono que represente los cortes
Estructura de frontend propuesta por Claude (pages/Cortes/ + hooks/ + components/, api/cortes.js) confirmada sin cambios por Kanye
users.role de su cuenta de admin es exactamente 'admin'
Paso 1 backend (GET corte-caja index + guard soloAdmin en CorteCajaController) probado: capturista 403, admin 200
Backend punto 6 (index, show, reabrir) probado en Postman: tras reabrir el capturista pasa el middleware (POST pagos da 201); el hook useCorteCaja queda en fase inactivo y CorteCajaGuard retorna null con reabierto_at lleno
Pendiente (1) resuelto/descartado: Kanye re-probó la reapertura y confirmó que la interfaz de Pagos se ve normal y le deja hacer todo — no había bug real, sin causa identificada de por qué el intento anterior pareció fallar
Pendientes que quedan, en orden de prioridad para Kanye: (2) posible document.body.style.overflow sin restaurar en modales del corte — dijo que no importa mucho; (3) advertencia de React en FilaPago.jsx: div dentro de tbody (no relacionada al corte) — para el final
Hueco real identificado: como estado nunca vuelve a en_proceso tras reabrir, intentar/cerrar dan 409 por siempre ese día — no hay forma de volver a cerrar la caja el mismo día tras una reapertura. Kanye decidió dejarlo así por ahora (sin elegir entre las opciones A/B/C propuestas), pendiente de resolver después
Backend del punto 6 ya desplegado a producción por Kanye (commits + deploy hechos)
Kanye dio por terminada la feature de corte de caja (punto 6 incluido): dijo que es de las que más le han gustado y que sintió que subió el nivel de profesionalismo del proyecto
2026-10-05: primer día de cobro real en producción — el corte NO se pudo hacer: el polling de 20s a GET /corte-caja/hoy responde {"message":"No autenticado."} (401) en prod; en localhost nunca pasó durante las pruebas. Hallado: en producción no existía el cron de schedule:run, así que el job de las 20:15 nunca corrió; cron instalado para sanisidro-back el 2026-10-05. Causa del 401 aún sin identificar: el capturista de este módulo entra con credenciales (AuthController, token sin expiración), NO por el PIN; el flujo PIN de CapturistaController es para otra funcionalidad sin relación con el corte. Pendiente confirmar que el corte se abre solo en el siguiente día de cobro y conectar el 401 al login en el front (lib/axios.js)
La cuenta capturista "buena" en producción es CapturistaCobros (users.id 212, entra con credenciales vía AuthController). Existen otras cuentas con role=capturista (Equipo 1, equipo2-4, capturista.sistema del PIN, nombre_usuario) que no son esa