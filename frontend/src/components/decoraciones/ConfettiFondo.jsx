// src/components/decoraciones/ConfettiFondo.jsx
export default function ConfettiFondo({ colores = ['#006341', '#ffffff', '#CE1126'] }) {
  // Posiciones fijas, no random en cada render, para que no "salte" al re-renderizar
  const papelitos = [
    { top: '8%', left: '12%', delay: '0s', size: 6 },
    { top: '22%', left: '78%', delay: '3s', size: 5 },
    { top: '55%', left: '5%', delay: '6s', size: 7 },
    { top: '70%', left: '88%', delay: '2s', size: 5 },
    { top: '40%', left: '45%', delay: '5s', size: 6 },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {papelitos.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-sm confetti-flotante"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: colores[i % colores.length],
            opacity: 0.12,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
