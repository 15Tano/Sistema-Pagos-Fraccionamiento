# Temporadas: tematización

Última actualización del contexto compartido: 8 de octubre de 2026.

## Resumen

Tematización estacional del Resident Dashboard de San Isidro (Septiembre/Mes Patrio primero): decisiones, detalles aprobados y descartados, y pendientes.

## Detalles

- Quiere tematizar el Resident Dashboard por temporada/mes; arranca con Septiembre (Mes Patrio) y habrá más temas después.
- Solo el dashboard del vecino; Admin y Vigilancia no se tocan.
- Quiere que cualquier tema futuro funcione sin tocar código de componentes (solo agregar config).
- No quiere perder la identidad de la UI: debe verse "el mismo San Isidro 2.0, pero en septiembre", no una bandera ni un sticker pegado; los detalles deben vivir donde ya hay algo.
- Descartó reemplazar las 248 clases `orange-*` de Tailwind (demasiado invasivo).
- Aprobados: papel picado sutil arriba, borde superior tricolor en tarjetas, sombrero mexicano sobre el círculo del semáforo, textura de fondo sutil, semáforo con tonos bandera, confeti de fondo muy tenue, cenefa geométrica en headers existentes (Avisos, Historial), glow tricolor en hover de acciones rápidas, pulso verde en contador, destello tricolor al abrir recibo (easter egg), saludo patrio, ícono patrio (dejó que se propusiera el lugar), blobs de fondo en verde/rojo.
- Descartados: badge/pin en el avatar; animación de destellos al entrar al dashboard ("muy simple para justificar su existencia").
- Estado al cierre de sesión: textura de fondo se ve por encima del contenido (sin resolver); sombrero del semáforo se ve mal (pausado); cenefa de Historial se veía rara (fix sin confirmar); faltan sidebar, ModalRecibo y useCountUp.
- Resumen completo de la sesión pedido como `.md` para pasarlo a otro chat.

## Uso de este documento

Este documento conserva el contexto histórico proporcionado por el usuario. Los estados y pendientes corresponden a la fecha indicada; verificar el código actual antes de continuar la implementación.
