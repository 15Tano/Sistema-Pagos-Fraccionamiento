# Enlace candidato de control y salud — 2026.10.25-2

Candidato separado para revisar antes de activar botones en caseta. No instala
tareas ni sustituye gestor, polling, vigilancia, SDK o ZIP de cierres publicado.
API sigue siendo autoridad de vigencias. No incluye credenciales ni DLL.

## Alcance y estado

41 pruebas nuevas locales aprobadas, con14 comprobaciones PowerShell incluidas
en una de ellas; suite completa142 aprobada. Estados/CIM/tareas sustituidos,
SQLite y locks temporales y un hijo Python ficticio propio. No SDK/red/Access
ni tareas reales para estos41casos. Interfaz visual y operaciones reales del
gestor no ejercitadas. Primero repetir la simulacion en Dell sin mantenimiento;
no abrir panel ni usar botones hasta revisar resultado. No equivale a transicion
permanente. ZIP1 publicado se conserva intacto; usar carpeta nueva para ZIP2.

## Simulacion — PowerShell Dell, sin mantenimiento

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Enlace_Candidato_2026.10.25-2.zip' -DestinationPath 'C:\SanIsidro\EnlaceCandidato_20261025_r2'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\EnlaceCandidato_20261025_r2\verificar_enlace.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnlaceCandidato_20261025_r2\simular_enlace.py'
```

Esperado simulation_ok, tests41, failures0/errors0/skipped0,
powershell_checks_included14. Detalle txt/resumen JSON en registros/. Temporales
en datos/pruebas_enlace, limpieza guardada por ruta; no lee instalaciones reales.
Funciones compartidas de panel/delegacion se prueban con callbacks ficticios,
no abren WinForms, no llaman Get-ScheduledTask/CIM ni al gestor instalado.

Como comando separado para otra revision posterior, enlace_candidato.py salud
lee tareas/CIM, estado del polling/vigilancia, ensayo cerrado y SQLite
existente con mode=ro/query_only. Solo guarda informe filtrado en registros/
propio. Sin SDK, Access, DPAPI, HTTP, alertas, cambios de tareas ni consultas de
tags. La cola local sin pendientes no certifica transporte actual al servidor.
Ensayo stopped se muestra detenido_sin_verificar_cierre; leer su estado no
acredita recibos ni lock. Datos/filas/commandlines no se copian a los informes.
La vigilancia instalada permanece independiente, con sus umbrales existentes.

## Controles candidatos, pendientes de aceptacion en Dell

Panel separado: panel_coordinador.ps1. Botones:

- Preparar mantenimiento: primero valida fuentes/ledger y ausencia de otros
  lectores; delega pausar al mantenimiento.ps1 instalado cuyo SHA se exige.
- Solicitar parada ensayo: confirma ruta, PID, run_id y creacion del proceso
  de ensayo_cierres.py --mantenimiento antes de escribir detener_cierres.json.
  No detiene polling, mata procesos ni anuncia cierre por escribir la peticion.
- Verificar cierre: exige stopped por limit/requested, gate sin fallo/cliente,
  ausencia de proceso y otros lectores, ninguna revision pendiente, ledger
  completo con recibos/ACK y toma/liberacion de sync.lock existente. No lo borra.
- Terminar y reanudar: exige lo anterior y mantenimiento activo antes de
  delegar reanudar al gestor r2 verificado. La reanudacion instalada aun verifica
  proceso con su contrato legacy; no certifica lock adquirido ni dos ciclos.
  Obtener estado.json y dos ciclos nuevos sigue siendo obligatorio.
- Consultar salud: evaluacion separada de vigencias, ensayo readonly y cola.

El panel no inicia el lector. Para una futura prueba SDK, se conserva el
lanzador de cierres ya validado, sin cambiarlo; requiere mantenimiento confirmado
y cierre de ZKAccess. No ejecutarlo en esta primera revision. La parada del
ensayo sigue acotada150s/propia; cerrar el panel no detiene un ensayo ajeno.
Mientras un control del panel esta en curso se impide cerrar la ventana.

Rutas fijas: ZKSync y GestionTags instalados; CierresCoordinador_20261024 para
fuentes de recibos, verificadas contra manifiesto congelado del ZIP publicado;
CoordinadorEnsayo_20261024/datos/lectura_mantenimiento para estado, ledger y cola.
No inicializa otra base ni cambia identidad. La verificacion de cierres reutiliza
adaptadores ya diagnosticados; importarlos no carga DLL ni abre el controlador.

Python sin script identificable u otra herramienta Python en C:\SanIsidro no
reconocida bloquea cierre por precaucion. CIM inaccesible y PID reutilizado
impiden confirmacion. No cerrar procesos ajenos para eludir la comprobacion.
La version2 relee identidad/estado antes de escribir stop y antes de confirmar
cierre, rechaza inicio futuro y requiere recibos de inventario de la misma
ejecucion suficientes para los ciclos completados. No considera un argumento
de python -c como ruta de entrada. enlace_funciones.ps1 concentra las acciones,
constructor de procesos y delegacion, probados con callbacks sustituidos.
El wrapper mantiene mantenimiento_enlace.lock desde precheck hasta terminar
la delegacion para excluir otros botones de mantenimiento del candidato.

El lock solo prueba disponibilidad en ese instante, no reserva una transicion
entre procesos externos: no abrir lectores, gestor de tags ni otro ensayo
durante la pausa/reanudacion. ZKAccess no respeta ese lock. El mutex del panel
serializa sus operaciones; no sustituye exclusion de otros programas.

## Pendientes antes de uso operativo

Repetir simulacion en Dell, revisar interfaz y comprobar comportamiento real
solo despues. Las carreras con lanzadores externos no quedan resueltas por
serializar botones propios; conservan las restricciones anteriores.
Integracion dentro de los botones originales, nueva version operativa con
run_id/confirmacion de lock, emisor automatico independiente, alertas separadas,
recuperacion/retencion/reconciliacion y transicion permanente siguen pendientes.
No se ha desplegado el backend de ingesta a produccion ni creado pantalla web.
