# Correccion de recuperacion del display — 2026.10.30-2

La Dell registro mediana de1.437s entre capturas y56/119intervalos mayores de1.5s.
Ese limite reinicia la confirmacion de cola vacia y puede bloquear el display aunque
la vista normal muestre lecturas. Esta version tolera3s entre observaciones. Mantiene
dos respuestas255, caducidad2s de la ultima cola vacia, reset por reconexion/ciclo,
rechazo de error/formato desconocido y admision web8s. Sin cambios de fechas/SDK,
permisos, API, captura, tareas, intervalos ni datos. No garantiza una latencia nueva.

Es un release nuevo sobre el ZIP permanente original. No sustituir un archivo dentro
del release instalado ni editar su manifiesto. Instalar exige autorizacion final del
usuario, mantenimiento y cierre completo actual; el plan no inicia el servicio.

1. Extraer en carpeta nueva C:\SanIsidro\LecturasCorreccionDisplay_20261030.
2. Verificar SHA256 del ZIP contra la entrega; Python64 -B actualizar_display.py
   --verificar-paquete valida fuentes sin SDK, tareas o red.
3. Cerrar ZKAccess. Pausar usando mantenimiento.ps1 -Operacion pausar. Si falla,
   conservar mantenimiento y comprobar el cierre real antes de continuar.
4. Python64 -B actualizar_display.py --plan: revisar hash y alcance3JSON de enlace,
   nueva carpeta de release y respaldo. No aplica cambios ni concede fechas.
5. Con plan aprobado: --aplicar --plan-sha256 HASH_COMPLETO. Recalcula el plan bajo
   sync.lock, verifica que TODOS los bytes anteriores se conservan salvo tres
   sustituciones exactas (politica, version y verificador), respalda los tresJSON,
   y usa revision_instalacion.json para bloquear arranque durante una escritura parcial.
6. Solo con display_update_installed_waiting_resume: reanudar por el script instalado.
   Esperar dos ciclos/ACK y comprobar lector En espera y nueva lectura en ampliada.
   No repetir Preparar durante el arranque. Conservar update_id y plan_sha256.

Si algo falla, no borrar marcas ni repetir instalacion. El plan de reversion admite
restaurar los tresJSON respaldados bajo la marca propia de la actualizacion y exige
otro hash revisado: --plan-reversion --actualizacion-id UUID, despues --revertir
--actualizacion-id UUID --plan-sha256 HASH. Conserva ambos releases, todos los datos,
respaldos y tareas; luego reanudar por script y comprobar dos ciclos y ACK.

El parche web complementario distingue Actualizando lecturas de falta de datos.
Cambiar solo ese texto no soluciona el criterio de recuperacion en la Dell.
