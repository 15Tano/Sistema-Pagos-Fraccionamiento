/*
 * Todo el layout va en línea (padding, gap, tipografía): en tu proyecto varias clases
 * de Tailwind no se están aplicando de forma confiable (pr-2.5 se perdió en la lista).
 */
const ESTADOS = {
    cuadrado: {
        label: "Cuadrado",
        texto: "#047857",
        fondo: "rgba(209,250,229,0.7)",
        borde: "rgba(110,231,183,0.75)",
        punto: "#10b981",
        halo: "rgba(16,185,129,0.22)",
    },
    cerrado_con_diferencia: {
        label: "Con diferencia",
        texto: "#b45309",
        fondo: "rgba(254,243,199,0.75)",
        borde: "rgba(252,211,77,0.75)",
        punto: "#f59e0b",
        halo: "rgba(245,158,11,0.24)",
    },
    en_proceso: {
        label: "En proceso",
        texto: "#57534e",
        fondo: "rgba(245,245,244,0.8)",
        borde: "rgba(214,211,209,0.85)",
        punto: "#a8a29e",
        halo: "rgba(168,162,158,0.22)",
    },
};

export default function EstadoBadge({ estado }) {
    const e = ESTADOS[estado] ?? ESTADOS.en_proceso;
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "4px 11px 4px 9px",
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.02em",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                color: e.texto,
                background: e.fondo,
                border: `1px solid ${e.borde}`,
                boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(28,25,23,0.05)",
                transition: "filter .2s ease",
            }}
            className="hover:brightness-105"
        >
            <span
                aria-hidden="true"
                style={{
                    width: 6,
                    height: 6,
                    flexShrink: 0,
                    borderRadius: 9999,
                    background: e.punto,
                    boxShadow: `0 0 0 2.5px ${e.halo}`,
                }}
            />
            {e.label}
        </span>
    );
}
