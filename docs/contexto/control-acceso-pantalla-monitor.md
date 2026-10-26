# Pantalla de consulta de control de acceso

2026-10-26. Rediseño móvil local confirmado por el usuario. No desplegado;
Dell, polling, bibliotecas, vigencias y tareas instaladas no se modificaron.

## Decisiones confirmadas

- Vigilancia tiene dos pestañas superiores: Buscador, predeterminada en
  /vigilancia, y Lecturas en /vigilancia/lecturas. El buscador conserva su
  lógica y datos existentes; comparte el marco visual, no consultas nuevas.
- Una sola caseta permanente. Quitar su selector, nombre y serial de la vista.
  El seguimiento elige internamente el serial físico CO2K225060027, antes de
  agentes de ensayo. No cambiar el mapeo DoorID1 entrada / DoorID2 salida.
- Indicadores compactos y legibles: Comunicación, Vigencias de tags, Lector
  de tags y Datos por enviar. Detalles técnicos y de hora quedan desplegables.
- La tarjeta principal muestra la última lectura de tag para la pluma elegida.
  Buscar o desplegar un registro histórico no la sustituye.
- Nombre completo del vecino, tanto en la tarjeta como en la lista; sin calle,
  número de casa, pagos, teléfono o identificadores personales adicionales.
  Sin asociación: “Sin vecino asociado”; varias: “Verificar asociación”.
- Mini monitores probablemente HDMI desde Dell. Botón Ampliar en la tarjeta;
  enlaces separados de Entrada/Salida para abrir ventanas y moverlas al monitor.
  Todavía no se compró/configuró hardware ni se instaló una sesión kiosco.
- En display, presentar una lectura nueva durante 8 segundos completos y luego
  “Presente su tag”, retirando nombre/tag. En el monitor normal del guardia la
  última lectura permanece. No repetir una lectura antigua al abrir el display.
- Altas/recuperaciones, identificación asistida y exportaciones quedan para
  después. Apertura/cierre de plumas fue solo una consulta: no implementarlos.

## Acceso y datos

La ruta /control-acceso se conserva para administración;
/vigilancia/lecturas utiliza el marco de vigilancia.
Ambas rutas de lecturas exigen sesión humana y rol exacto admin o vigilancia.
Capturista/residente/visitante no tienen acceso. El backend conserva Sanctum,
autorización, bandera deshabilitada por defecto y Cache-Control private,no-store.

El modo display usa la misma ruta autenticada, con ?display=entrada o salida.
Es un modo de presentación para HDMI, no una ruta pública ni una autorización
nueva. Oculta/inactiva el contenido de administración mientras está abierto;
salida mediante botón o Escape y Fullscreen API cuando el navegador la admite.
No sustituye el diseño de credenciales/permisos que requeriría un navegador
externo independiente. No abrir puertos en Dell ni conectar otro cliente SDK.

GET /api/control-acceso/monitor/eventos añade neighbor_name y neighbor_status
(single/none/multiple). Resuelve en lote la asociación actual usando tags.codigo,
tag_vecino y vecinos.nombre. Comparación textual exacta y uniqueStrict preservan
00111 frente a 111. Varias asociaciones no eligen un vecino arbitrario. No se
crean asociaciones por recibir eventos ni se modifican datos de ingreso.
El nombre es el asociado al consultar, no prueba quién portaba un tag antiguo.
No requiere migración nueva para nombres; usa las tablas existentes.

## Lecturas y display

PullSDK anexo6 ya contrastado: 0 Normal Punch Open -> “Acceso autorizado” verde;
20 Too Short Punch Interval -> “Lectura repetida” ámbar. No interpretar 20 como
vencimiento. Códigos sin significado contrastado -> “Consulte a vigilancia”;
el número crudo queda en el detalle del guardia. No se afirma cruce vehicular.

La tarjeta y el display siguen RT sin filtros de búsqueda; el historial se
consulta aparte, solo al buscar/cambiar origen/actualizar/cargar anteriores.
Los filtros históricos no crean otro polling ni cambian la última lectura.
Se conservan filas repetidas con distinto ID y cursores de texto mayores que
2^53. Máximo visual 400; no representa un total de vehículos ni historial
completo. El selector Todas/Entrada/Salida delimita el seguimiento y la lista.

Eventos cada3s y estado cada15s, cancelables, con una tanda en curso. Guardia:
hasta dos páginas de50 por tanda; display: una. Dos displays y un guardia
mantienen margen frente a120consultas/minuto incluso drenando pendientes
(aprox.92/min, sin contar acciones manuales). Un refresco en espera respeta
Retry-After; errores/red no crean bucles sin pausa.

Display admite solo tag RT de su puerta, captura/recepción menores que8s al
admitirlo (tolerancia futura1s), reporte reciente, lector status_observed,
seguimiento activo y sin recuperación pendiente. Desde que lo presenta mantiene
8s completos; temporizador y límite de hora evitan conservarlo después. Una
lectura nueva reemplaza la anterior. Datos atrasados, error, desconexión o pausa
no muestran una autorización antigua; solicitan apoyo de vigilancia si no hay
estado reciente. Al volver a primer plano se actualiza el reloj visual.

Recibir una consulta HTTP no renueva la fecha del reporte ni acredita vigencias.
Frescura de reportes90s, ciclos300s; futuro/fechas ausentes no se muestran sanos.
Hora del equipo cruda; captura/recepción UTC se presentan en America/Mexico_City.
Pausar seguimiento solo afecta ese navegador, no las plumas ni el polling de Dell.

## Verificación local de esta revisión

- Node:22 pruebas aprobadas: cursores, multiplicidad, historial, pausa, respuestas
  tardías, permisos, reintentos, nombres, códigos, admisión fresca por puerta,
  descarte de backlog y presupuesto de páginas de cada display.
- Laravel SQLite en memoria:33 pruebas /244 aserciones aprobadas, ingesta+monitor.
- MySQL8.4.13 aislado:16 pruebas /116 aserciones del monitor aprobadas, incluyendo
  asociaciones exactas, múltiples, retiradas y nombres actuales sin domicilio.
  Instancia validada por puerto33379/server_id231026/ruta/marcador; SHUTDOWN
  confirmado en ux-monitor.stderr.log el 2026-10-26T20:29:09.830172Z.
- ESLint del cambio y build aprobados. Permanecen avisos de Browserslist/tamaño
  de bundle; no se actualizaron dependencias. No afirmar que el lint general
  o ExampleTest de Laravel, con su fallo previo en /, estén corregidos.
- Navegador: pestañas, búsqueda que no cambia la última tarjeta, filtro de salida,
  repetición ámbar, ampliación, espera tras8s y lectura conservada al regresar.
  Móvil390px sin desbordamiento horizontal; display1280x720 y640x360 revisados.
  Capturas locales en output/control-acceso-monitor/, con datos ficticios.

Ejecutar desde frontend:

```powershell
node --test tests/control-acceso.test.mjs
```

Desde backend:

```powershell
php vendor/phpunit/phpunit/phpunit --filter "ControlAccessIngestionTest|ControlAccessMonitorTest" --exclude-group mysql-ensayo
```

El ensayo MySQL requiere el entorno aislado documentado y no usa .env real.

## Vista previa y pendientes

frontend/monitor-preview.html es una entrada separada de Vite de desarrollo.
Mismo panel, hooks y componentes visuales, cliente ficticio y MemoryRouter.
No importa App/main, Axios, credenciales ni OneSignal; no conecta a la API real.
El buscador de la demo solo usa nombres ficticios; no reemplaza el buscador real.
Controles de simulación exclusivos de esta entrada. No entran al build normal.

npm run dev -- --host 127.0.0.1 --port 5182 --strictPort
http://127.0.0.1:5182/monitor-preview.html
http://127.0.0.1:5182/monitor-preview.html?display=entrada
http://127.0.0.1:5182/monitor-preview.html?display=salida

Pendiente: revisión visual del usuario, despliegue autorizado por Git/rsync,
migraciones previas de ingesta/índices, bandera del monitor, roles humanos reales
y captura/envío HTTPS continuos desde Dell. Ninguna vista ficticia certifica
operación permanente. Piloto real de escritura sigue sin diferencia natural:
12230693 fue no_changes, no una escritura; no fabricar pagos o fechas.
La API sigue como única autoridad de vigencias.
