// src/components/decoraciones/PapelPicado.jsx
export default function PapelPicado() {
  const colores = ['#4d7c62', '#e8e6e1', '#b5544a']; // versiones desaturadas verde/blanco/rojo

  return (
    <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 overflow-hidden opacity-60 z-10">
      <svg viewBox="0 0 800 24" className="w-full h-full" preserveAspectRatio="none">
        {Array.from({ length: 16 }).map((_, i) => (
          <path
            key={i}
            transform={`translate(${i * 50},0)`}
            d="M0,0 L48,0 L44,12 L38,7 L32,14 L26,7 L20,14 L14,7 L4,12 Z"
            fill={colores[i % 3]}
          />
        ))}
      </svg>
    </div>
  );
}
