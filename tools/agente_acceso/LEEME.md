# Emisor local de acceso — preparación

Primera versión local, sin instalar en caseta. No carga plcommpro, consulta C3,
modifica Access, calcula vigencias ni instala tareas. Usa Python estándar, SQLite
y DPAPI de Windows. No depende de los módulos del polling.

Manual, evidencia y límites: [emisor local](../../docs/contexto/control-acceso-emisor-local.md).

Para comprobar Dell sin SDK ni red: paquete `Preflight_Emisor_2026.10.23-1.zip`,
con instrucciones en [LEEME_PREFLIGHT.md](LEEME_PREFLIGHT.md). No requiere pausa.

## Probar

Desde la raíz del repositorio, en PowerShell:

```powershell
& 'C:\Python312\python.exe' -B -m unittest discover -s tools/agente_acceso/tests -v
```

Los tests crean SQLite temporales dentro de `backend/storage/app/agente-acceso-ensayo/`
y un servidor PHP/Laravel efímero en loopback. PHP predeterminado: `C:\xampp\php\php.exe`;
puede indicarse otro ejecutable con `CA_TRIAL_PHP`. No leen bases reales de `.env`.
Se usan exclusivamente identidades, tarjetas y credenciales ficticias.

## Preparar un almacén ficticio

```powershell
& 'C:\Python312\python.exe' -B tools/agente_acceso/agente.py iniciar --agente 10000000-0000-4000-8000-000000000001 --serial TEST-C3-001
& 'C:\Python312\python.exe' -B tools/agente_acceso/agente.py estado-local
```

Ubicación predeterminada: `tools/agente_acceso/datos/outbox.sqlite`, ignorada por Git.
Para otra base, poner `--db 'ruta\outbox.sqlite'` antes del subcomando. Un almacén no
puede cambiar de agente/controlador; crear otro para una identidad diferente.

`encolar-respuesta` importa bytes de un archivo explícito, no lee el controlador:

```powershell
& 'C:\Python312\python.exe' -B tools/agente_acceso/agente.py encolar-respuesta --archivo 'ruta\respuesta.payload.bin' --origen rt --codigo 1 --inicio '2026-10-24T02:12:01.854246Z' --fin '2026-10-24T02:12:01.951000Z'
```

Cada importación manual representa una observación distinta. La API Python acepta
`response_id` persistente para reintentar una misma captura sin duplicarla.
`encolar-estado --archivo 'ruta\snapshot.json'` guarda un snapshot explícito sin el
sobre común; campos según el contrato API. No se recolecta todavía automáticamente
el estado del polling ni se inventa un estado saludable.

## Credencial y envío a un servidor de ensayo preparado

La identidad debe corresponder a la credencial del servidor de ensayo. El secreto
se introduce con prompt oculto, nunca como argumento:

```powershell
& 'C:\Python312\python.exe' -B tools/agente_acceso/agente.py guardar-credencial --archivo 'tools\agente_acceso\datos\agente.dpapi'
& 'C:\Python312\python.exe' -B tools/agente_acceso/agente.py enviar --url 'http://127.0.0.1:8000/api/control-acceso/agente' --credencial 'tools\agente_acceso\datos\agente.dpapi' --ensayo-local --max-mensajes 20
```

Este ejemplo no levanta un servidor en 8000; requiere uno de ensayo preparado.
Los tests levantan y detienen el suyo automáticamente, con puerto libre.
Fuera de loopback literal se exige HTTPS, validación TLS y no hay redirecciones.
La credencial DPAPI debe guardarse usando el mismo usuario/equipo del emisor.

`enviar` realiza una tanda acotada y sale. No es un proceso permanente; el futuro
coordinador/programador deberá invocarlo con la frecuencia acordada. Tras un fallo
temporal, otro envío respeta el plazo guardado. Los errores permanentes/ACK inválido
pausan globalmente el emisor. Una vez resuelta la causa, `reanudar` habilita los mismos
mensajes, sin cambiar contenido, UUID ni secuencia. No elude conflictos del servidor.

No borrar SQLite, WAL, SHM u originales para destrabar una entrega. No copiar solo
el archivo principal mientras esté abierto. No hay borrado ni retención automáticos.
