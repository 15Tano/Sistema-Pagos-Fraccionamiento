# Preparación operativa 2026.10.26-1

Un solo paquete de preparación. Conserva las 117 entradas originales del Servicio
Integrado 2026.10.26-2 y agrega pruebas y adaptadores candidatos. No instala ni
activa nada. La entrada pública solo admite simulación y preflight de lectura.

## Qué ejecutar en Dell

No preparar mantenimiento. Mantener las vigencias y su vigilancia normales.
En una PowerShell de Dell, pegar solamente estos comandos, sin el texto del prompt
ni las respuestas de la consola:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Preparacion_Operativa_2026.10.26-1.zip' -DestinationPath 'C:\SanIsidro\PreparacionOperativa_20261026'

powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\PreparacionOperativa_20261026\verificar_preparacion.ps1'

& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\PreparacionOperativa_20261026\preparar_operacion.py' --simular --python32 'C:\Users\Dell\Python32\python.exe'

& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\PreparacionOperativa_20261026\preparar_operacion.py' --preflight
```

La simulación usa procesos, DPAPI y SQLite de prueba en esta carpeta. SDK, API,
Access y tareas de caseta se sustituyen por fixtures. Incluye 2,400 buffers de
65,536 bytes, sus mensajes/ACK ficticios, reapertura y comprobación de originales.
No mide el caudal real ni certifica un servicio continuo.

El preflight lee hashes del código instalado, metadatos, estado y contrato de dos
tareas. No abre MDB, descifra credenciales, consulta red o carga DLL. Si algún
hash no coincide, conservar la salida y revisar diferencias antes de instalar.
En particular, el hash de gt_backend.py procede de la copia local conocida; aún
debe compararse con Dell. Las referencias nunca autorizan sobrescribir variantes.

## Qué está preparado

- Propietario con sync.lock, nacimiento/imagen del proceso y permisos DPAPI para
  sus trabajadores. La conexión no concede autoridad para cambiar vigencias.
- Ciclos con API como autoridad, solo registros existentes, copias MDB/perfil
  previas, cambios acotados, verificación y cierre antes de pasar entre C3/Access.
- Emisor HTTPS separado de SDK/ACE, con credencial propia y almacén nuevo ligado
  a un agente de producción distinto del de ensayo.
- Buffer completo comprimido sin pérdida. Archivos ACK y recibos SDK verificados
  antes de retirar sus copias de trabajo. Originales y archivos se conservan.
- Instalación y reversión de biblioteca con plan/hash y consentimiento exactos,
  respaldo de código/XML, r2 como modo inicial, tareas y datos conservados.
- Parche candidato mínimo del gestor para bloquear consultas/reanudación si el
  SDK no tiene recibo de cierre y reconocimiento del padre. Se guardan las fuentes
  de referencia; no se editó el gestor instalado.
- Vigilancia separada de lector, almacén, envío y capacidad. Los ACK o lecturas RT
  no actualizan last_ok de vigencias. Se conserva la vigilancia r2.

## Límites y pendientes reales

No hay CLI de instalación o activación. No ejecutar funciones internas pegándolas
en consola. Antes de crear esa entrada operativa se debe revisar el plan y cerrar
la aceptación: aplicación real acotada de una diferencia natural autorizada por
la API, pausa/reanudación del gestor, reversión, HTTPS definitivo y capacidad.
Las simulaciones no deben convertirse en recibos de aceptación real.

La operación candidata exige configuración y aceptación ligadas al release. No
se entregan tokens reales ni un archivo que declare esas pruebas como aprobadas.
El agente y la cola del ensayo remoto se conservan tal como están.

Capacidad preparada: originales 2 GiB; cola caliente 256 MiB; archivos ACK 4 GiB;
recibos archivados 2 GiB; hasta 1,024 perfiles y 32 copias MDB. Aviso al 80% y por
reserva de disco baja. No hay borrado por antigüedad. El agotamiento pausa la
captura; un respaldo de fechas agotado impide nuevas aplicaciones y hace fallar
el ciclo. La política de custodia/retención debe acordarse antes de activar.

Un cierre SDK incierto mantiene la exclusión y exige revisión manual. No matar
procesos, borrar marcas/locks o reanudar a ciegas. Una actualización posterior
deberá respetar ese mismo contrato.

El backend de monitor se preparó por separado en Git, con bandera desactivada por
defecto y consultas solo para admin/vigilancia. No está desplegado y este ZIP no
lo despliega. La pantalla web sigue pendiente de su etapa de interfaz.
