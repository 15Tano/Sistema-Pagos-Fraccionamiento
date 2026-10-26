# Pantalla de consulta de control de acceso

2026-10-26. Primera versión local revisable, después de validar la captura real,
la entrega al backend aislado y el retorno del polling instalado. La consulta
web puede avanzar independientemente del piloto de escritura pendiente. No se
cambiaron vigencias, tareas de Dell, bibliotecas ni producción en esta entrega.

## Alcance y acceso

Ruta `/control-acceso`, protegida con el PrivateRoute existente para los roles
exactos `admin` y `vigilancia`. Administración accede desde el menú del Layout;
en móvil se conserva la barra inferior existente y el nuevo acceso está en el
menú lateral. Vigilancia tiene un enlace desde su vista actual y puede volver
a su buscador. La autorización de las dos consultas sigue en Laravel/Sanctum.

La pantalla usa exclusivamente los GET ya implementados de
`/api/control-acceso/monitor/estado` y `/eventos`, mediante la instancia Axios
centralizada y la sesión humana existente. No usa la credencial del agente ni
ejecuta solicitudes de alta, recuperación, cambio de fecha o apertura de plumas.

Incluye estado reportado, vigencias, lector y envíos pendientes; selector de
caseta; filtros de puerta, tag exacto y origen; lista y detalle de lecturas.
DoorID 1 entrada / 2 salida solo se aplica al serial CO2K225060027 confirmado.
Para otros seriales se muestran números de puerta. Tarjetas y cursores se
mantienen como cadenas, incluidos ceros iniciales e IDs mayores que 2^53.

## Seguimiento y significado de los datos

- Consulta de eventos cada 3 segundos y de estado cada 15, con peticiones
  cancelables y sin solapar tandas de seguimiento. Hasta dos páginas de 50
  eventos por tanda para conservar margen frente al límite del backend.
- La carga inicial toma los últimos registros; las siguientes avanzan por el
  cursor `after_id` confirmado. No saltan al último ID global si hay pendientes.
  El historial `before_id` tiene un cursor separado. Se muestran hasta 400 filas.
- Se conservan eventos iguales con IDs distintos. Una repetición HTTP de la
  misma fila no crea otra fila visual. Cambiar filtros descarta respuestas de
  la selección anterior; cerrar la vista cancela las peticiones.
- Ocultar la pestaña, perder conexión o pausar seguimiento suspende las consultas
  del navegador. Este botón no pausa el lector de caseta ni cambia tareas.
- Fallos de red conservan las últimas lecturas con aviso y espera creciente;
  429 respeta Retry-After. 401/403 limpian la lista; 404 detiene reintentos
  automáticos e informa indisponibilidad. El interceptor común mantiene su
  comportamiento de sesión expirada. Una respuesta inválida no mueve el cursor.
- La antigüedad visual avanza desde la hora UTC del servidor y un reloj
  monotónico local. Un GET exitoso no renueva la fecha del reporte ni acredita
  vigencias correctas. Reportes de más de 90 segundos y ciclos de más de 300
  dejan de mostrarse como recientes; reloj futuro o fechas ausentes tampoco.
- La hora de la C3 se muestra cruda, identificada como hora del equipo. Captura
  y recepción UTC se presentan en America/Mexico_City. Los códigos permanecen
  numéricos: no se infiere apertura, rechazo ni cruce físico del vehículo.

## Verificación local

15 pruebas Node aprobadas, sin dependencias nuevas: cursores grandes, ceros,
multiplicidad, drenaje incremental, historial independiente, límite visual,
pausa/cancelación, respuestas tardías, autorización, 404, 429, red, contrato y
caducidad de frescura. Ejecutar desde `frontend`:

```powershell
node --test tests/control-acceso.test.mjs
```

ESLint aprobado para el módulo y los archivos existentes modificados. Build de
producción aprobado; conserva los avisos de tamaño de bundle y Browserslist.
No se presenta el lint general del repositorio como una suite nueva aprobada.

Revisión en navegador de la misma vista/hook con cliente ficticio aislado:
filtro de entrada, búsqueda exacta, pausa/reanudación, reportes atrasados,
error de conexión, 404 y ausencia de casetas. Vista móvil de 390px comprobada
sin desbordamiento horizontal del documento, además de escritorio.

`frontend/monitor-preview.html` y `src/dev/control-acceso-preview.jsx` son una
entrada separada para Vite de desarrollo; no se importan desde App ni main y
no usan Axios, tokens, OneSignal o la API real. Datos claramente ficticios;
la entrada y sus fixtures quedan fuera del build normal. Arranque local:

```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5182 --strictPort
```

Abrir `http://127.0.0.1:5182/monitor-preview.html`. Las capturas de revisión
están en `output/control-acceso-monitor/` y no son datos de producción.

## Pendientes para operación real

No se desplegó esta pantalla ni se habilitó la bandera del monitor. Antes de
mostrar datos reales en la web: revisar los commits, desplegar backend por el
flujo Git/rsync existente con confirmación, aplicar las migraciones pertinentes,
habilitar explícitamente el monitor y verificar cuentas humanas/roles reales.
La captura continua y el envío HTTPS definitivo desde Dell siguen pendientes
de transición operativa. La pantalla no convierte un ensayo aislado en un flujo
de producción. Revisar privacidad y permisos aparte para pantallas exteriores.

La escritura candidata real con una diferencia natural de vigencia sigue sin
validarse: el piloto del tag 12230693 fue `no_changes`, no una escritura real.
No fabricar diferencias ni repetir mantenimiento para demostrar la interfaz.
La API permanece como única autoridad de vigencias.
