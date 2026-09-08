// src/components/decoraciones/CenefaDivider.jsx
//
// Uso: reemplaza (o agrega debajo de) el <hr> o border-bottom que ya tengas
// bajo títulos como "Avisos", "Historial de pagos", etc.
//
// <h3>Avisos</h3>
// <CenefaDivider colores={tema.cenefa?.colores} />

// src/components/decoraciones/CenefaDivider.jsx/*
export default function CenefaDivider({
    colores = ["#006341", "#ffffff", "#CE1126"],
    alto = 8,
}) {
    return (
        <svg
            viewBox="0 0 400 16"
            preserveAspectRatio="none"
            style={{ width: "100%", height: alto, display: "block" }}
        >
            {Array.from({ length: 20 }).map((_, i) => (
                <path
                    key={i}
                    transform={`translate(${i * 20},0)`}
                    d="M0,16 L10,0 L20,16 Z"
                    fill={colores[i % colores.length]}
                    opacity={0.55}
                />
            ))}
        </svg>
    );
}
