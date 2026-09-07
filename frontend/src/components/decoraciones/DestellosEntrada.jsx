// src/components/decoraciones/DestellosEntrada.jsx
import { useEffect, useState } from 'react';

export default function DestellosEntrada({ colores = ['#006341', '#ffffff', '#CE1126'] }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 800);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const destellos = Array.from({ length: 14 }).map((_, i) => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    color: colores[i % colores.length],
    delay: `${Math.random() * 0.3}s`,
    size: 3 + Math.random() * 4,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {destellos.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full destello-entrada"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            backgroundColor: d.color,
            animationDelay: d.delay,
          }}
        />
      ))}
    </div>
  );
}
