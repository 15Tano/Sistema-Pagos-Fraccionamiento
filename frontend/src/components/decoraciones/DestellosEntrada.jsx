import { useEffect, useMemo, useState } from "react";

export default function DestellosEntrada({
    colores = ["#006341", "#ffffff", "#CE1126"],
}) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => setVisible(false), 1100);
        return () => clearTimeout(t);
    }, []);

    const destellos = useMemo(() => {
        return Array.from({ length: 36 }).map((_, i) => {
            // Distribuir partículas alrededor de toda la pantalla
            const angle = Math.random() * Math.PI * 2;
            const distance = 25 + Math.random() * 55;

            return {
                id: i,

                // Punto inicial cerca del centro
                x: 50 + Math.cos(angle) * 5,
                y: 45 + Math.sin(angle) * 5,

                // Destino
                dx: Math.cos(angle) * distance,
                dy: Math.sin(angle) * distance,

                size: 3 + Math.random() * 7,

                color: colores[i % colores.length],

                delay: Math.random() * 0.9,

                duration: 2.4 + Math.random() * 0.9,

                rotation: Math.random() * 360,

                // Diferentes formas
                type: ["circle", "diamond", "star"][i % 3],
            };
        });
    }, [colores]);

    const totalDuration = useMemo(() => {
        const maxParticula = Math.max(
            ...destellos.map((d) => d.delay + d.duration),
        );
        return Math.max(maxParticula, 1.5) * 1000 + 150; // antes: 0.9
    }, [destellos]);

    if (!visible) return null;

    return (
        <div
            className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
            aria-hidden="true"
        >
            {/* Flash inicial */}
            <div className="destello-flash absolute inset-0" />

            {/* Destello central */}
            <div className="destello-core absolute left-1/2 top-[45%]" />

            {/* Rayos */}
            <div className="destello-rays absolute left-1/2 top-[45%]" />

            {/* Partículas */}
            {destellos.map((d) => (
                <span
                    key={d.id}
                    className={`absolute destello-particula destello-${d.type}`}
                    style={{
                        left: `${d.x}%`,
                        top: `${d.y}%`,
                        width: `${d.size}px`,
                        height: `${d.size}px`,

                        backgroundColor: d.color,

                        "--dx": `${d.dx}vw`,
                        "--dy": `${d.dy}vh`,
                        "--rotation": `${d.rotation}deg`,
                        "--delay": `${d.delay}s`,
                        "--duration": `${d.duration}s`,

                        animationDelay: `${d.delay}s`,
                        animationDuration: `${d.duration}s`,

                        boxShadow: `
                            0 0 ${d.size * 2}px ${d.color},
                            0 0 ${d.size * 4}px ${d.color}
                        `,
                    }}
                />
            ))}
        </div>
    );
}
