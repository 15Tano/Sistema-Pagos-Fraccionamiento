// src/config/temporadas.js
//
// Registro central de temporadas. Para agregar una temporada futura
// (ej. Día de Muertos, Navidad), solo se agrega un objeto nuevo aquí.
// Nada de código en componentes necesita tocarse.
//
// Estructura de cada temporada:
// - id: identificador único, se usa como document.body.dataset.tema
// - rango: fechas de inicio/fin (mes 1-12, día 1-31). null = solo se activa por override manual.
// - glow: 4 colores rgba para las burbujas de fondo (mismo patrón que ya usas, otro tinte)
// - semaforo: colores hex opcionales para sobreescribir rojo/amarillo/verde del semáforo
// - cenefa: colores para el patrón geométrico de los headers
// - accentGlow: color del resplandor en hover de botones de acción
// - countUpColor: color de pulso del contador animado
// - saludo: texto chiquito arriba del "Hola, {nombre}"
// - iconoSidebar: emoji/símbolo que reemplaza el ícono normal del sidebar
// - decoraciones: qué componentes decorativos se activan
// - sombreroSemaforo: true/false — si aplica el SVG de sombrero sobre el círculo

export const TEMAS = {
    default: {
        id: "default",
        rango: null,
        glow: null, // usa el .app-bg original, sin overrides
        semaforo: null,
        cenefa: null,
        accentGlow: null,
        countUpColor: null,
        saludo: null,
        iconoSidebar: null,
        decoraciones: [],
        sombreroSemaforo: false,
    },

    septiembre: {
        id: "septiembre",
        rango: { inicioMes: 9, inicioDia: 1, finMes: 9, finDia: 30 },
        glow: {
            c1: "rgba(0, 99, 65, 0.16)", // verde bandera
            c2: "rgba(206, 17, 38, 0.12)", // rojo bandera
            c3: "rgba(0, 99, 65, 0.10)",
            c4: "rgba(206, 17, 38, 0.08)",
        },
        semaforo: {
            verde: "#006341",
            rojo: "#CE1126",
            // amarillo se deja igual, no hay "amarillo bandera" que tenga sentido
        },
        cenefa: {
            colores: ["#006341", "#ffffff", "#CE1126"],
            patron: "zigzag",
        },
        accentGlow: "rgba(0, 99, 65, 0.35)",
        countUpColor: "#006341",
        saludo: "¡Feliz Mes Patrio! 🇲🇽",
        iconoSidebar: "🎉", // placeholder — sugiero swap por un SVG de moño tricolor
        decoraciones: [
            "papelPicado",
            "confeti",
            "destelloEntrada",
            "destelloRecibo",
        ],
        sombreroSemaforo: true,
    },

    // noviembre: {
    //   id: 'noviembre',
    //   rango: { inicioMes: 11, inicioDia: 1, finMes: 11, finDia: 2 },
    //   glow: { c1: 'rgba(255,140,0,0.14)', c2: 'rgba(75,0,60,0.12)', c3: ..., c4: ... },
    //   cenefa: { colores: ['#ff8c00', '#4b003c', '#ffd700'], patron: 'papelPicadoCalavera' },
    //   decoraciones: ['papelPicado', 'confeti'],
    //   sombreroSemaforo: false,
    //   iconoSidebar: '💀',
    //   saludo: 'Día de Muertos 💀🌼',
    // },
};

// Prioridad si algún día se solapan rangos de fecha
export const ORDEN_TEMAS = ["septiembre"];
