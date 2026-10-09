const PARTICULAS = [
    { x: 27, y: 30, dx: -18, dy: -54, delay: 0 },
    { x: 70, y: 30, dx: 22, dy: -60, delay: 1.4 },
    { x: 37, y: 61, dx: -30, dy: -48, delay: .8 },
    { x: 62, y: 61, dx: 28, dy: -52, delay: 2.2 },
    { x: 29, y: 32, dx: -8, dy: -72, delay: 2.8 },
    { x: 69, y: 32, dx: 12, dy: -76, delay: .5 },
    { x: 48, y: 67, dx: -12, dy: -65, delay: 1.8 },
    { x: 54, y: 63, dx: 18, dy: -58, delay: 3.2 },
];

export default function ParticulasSemaforo() {
    return (
        <div className="semaforo-particulas" aria-hidden="true">
            {PARTICULAS.map((p, i) => (
                <span key={i} style={{
                    left: `${p.x}%`, top: `${p.y}%`,
                    "--particula-x": `${p.dx}px`,
                    "--particula-y": `${p.dy}px`,
                    animationDelay: `-${p.delay}s`,
                }} />
            ))}
        </div>
    );
}
