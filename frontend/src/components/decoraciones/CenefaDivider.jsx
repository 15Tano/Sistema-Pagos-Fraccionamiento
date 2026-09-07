// src/components/decoraciones/CenefaDivider.jsx
//
// Uso: reemplaza (o agrega debajo de) el <hr> o border-bottom que ya tengas
// bajo títulos como "Avisos", "Historial de pagos", etc.
//
// <h3>Avisos</h3>
// <CenefaDivider colores={tema.cenefa?.colores} />

export default function CenefaDivider({ colores = ['#006341', '#ffffff', '#CE1126'], alto = 10 }) {
  return (
    <svg
      viewBox="0 0 200 10"
      preserveAspectRatio="none"
      style={{ width: '100%', height: alto, display: 'block' }}
    >
      {Array.from({ length: 20 }).map((_, i) => (
        <rect
          key={i}
          x={i * 10}
          y="0"
          width="10"
          height="10"
          fill={colores[i % colores.length]}
          opacity={0.5}
          transform={i % 2 === 0 ? `rotate(45 ${i * 10 + 5} 5)` : undefined}
        />
      ))}
    </svg>
  );
}
