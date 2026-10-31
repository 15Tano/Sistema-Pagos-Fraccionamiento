# Correccion de la vista ampliada — 2026-10-30

## Diagnostico verificado y autorizacion

Usuario confirma que la vista normal recibe lecturas y muestra Conexion=Recibiendo
datos/Lector=Recuperando, mientras ampliada pide apoyo a vigilancia. La ampliada
requiere reader=status_observed y evita autorizar eventos durante recuperacion.

Consulta readonly de120capturas en Dell: mediana1.437s y56/119intervalos mayores
de1.5s. Ultimos12:1.21,7.84,1.226,.907,1.712,1.41,.715,1.703,1.337,1.692,1.844,1.407s.
ReaderObservation invalida confirmacion si el intervalo supera1.5s. Reproduccion con
vacios255 ficticios y esa cadencia demuestra reinicios; no supone que las120capturas
reales contengan solo255 ni certifica una latencia fisica nueva.

Usuario autoriza explicitamente instalar en Dell y publicar el ajuste web tras
presentar el paquete y las pruebas. Publicacion/instalacion/aceptacion se registran
solo al obtener evidencia; no se deducen de la autorizacion o de un push.

## Cambios preparados

- Dell2026.10.30-2: tolera3s entre observaciones. Conserva dos255, gracia2s desde
  cola vacia REAL, reset por ciclo/reconexion/hueco largo y rechazo SDK/formato.
- Frontend: recuperacion muestra Actualizando lecturas/Espere un momento; falta de
  datos mantiene apoyo a vigilancia. Se preservan admision por puerta/origen RT,
  frescura8s y bloqueo de autorizaciones mientras hay recuperacion.
- El motor r2, SDK, vigencias, tareas, credenciales y datos originales se conservan.

## Entrega y pruebas

tools/agente_acceso/Lecturas_Correccion_Display_2026.10.30-2.zip:
188archivos/479587bytes/SHA256
e130384297c7c4ea859c2d5a157fea0ed3d9d4732b994fc9bc3930605ea3a812.
Manifiesto3eca5b039d106d5dbe383074b940d321fbe438b5a38a9964569a9316200e1a6e.
Base instalada59bf55874a0101e3c049be8d1add3285e08e5c56db4e16a58aed3f913f658dfc.
ZIP original1f933dd4376833d03d08476d70a1434bd0e8f5acd9a4262963183340c7e77f60 intacto.

45Python aprobados:14correccion/actualizacion/reversion,6recuperacion previa y
25servicio/motor r2. Incluyen fallo durante reversion, nuevo plan para continuar,
drift, respaldo alterado y cambios SDK ajenos rechazados aun con manifiesto coherente.
Frontend50pruebas/build/lint aprobados. QA visual local bloqueado: IAB no alcanzo
localhost5187; no presentarlo como revision visual aceptada ni prueba fisica Dell.
Evidencia output/diagnostico-display-20261030/entrega-final.json y carpeta
130d5ff6-c17f-4097-9ab7-d9119bd33b4a/.

## Aplicacion y retorno

Extraer a C:\SanIsidro\LecturasCorreccionDisplay_20261030. Python64 del usuario Dell,
PowerShell administrador: actualizar_display.py --verificar-paquete es sin SDK/red.
Cerrar ZKAccess y pausar mediante mantenimiento.ps1. Si devuelve error, no asumir
cierre: la llamada directa produccion_dell.verify_closed() debe confirmarlo de nuevo.

actualizar_display.py --plan requiere mantenimiento/cierre, toma sync.lock y compara
todos los bytes con el release original: solo cambian politica, version y verificador.
--aplicar --plan-sha256 HASH recalcula el plan bajo lock, respalda los tresJSON
de enlace y copia un release nuevo. Usa revision_instalacion.json para bloquear
arranque parcial. No habilita tareas ni inicia el SDK. Con recibo de exito, reanudar
por mantenimiento.ps1 y esperar dos ciclos/ACK antes de otra pausa.

Reversion: --plan-reversion --actualizacion-id UUID y --revertir
--actualizacion-id UUID --plan-sha256 HASH. Restaura los tresJSON exactos, conserva
ambos releases/datos/tareas y permite nuevo plan tras una reversion interrumpida.
Nunca borrar marcas para continuar ni reinstalar el paquete permanente original.

## Pendientes actuales

Verificar publicacion web y ZIP remoto, transferir/validar paquete en Dell, plan e
instalacion autorizados, dos ciclos/ACK y ensayo real de tag en ampliada. Error
intermitente de guardia/confirmacion temprana del gestor permanece como asunto
separado. Boton no produjo evento identificable en la prueba RT ni en ZKAccess;
no inventar codigo ni afirmar cableado directo al motor.

Parche login afbada0 publicado previamente; backend desplegado/aceptacion real
del login en la red afectada siguen sin evidencia recibida en este chat.
