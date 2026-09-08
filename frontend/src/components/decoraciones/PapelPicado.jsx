// src/components/decoraciones/PapelPicado.jsx
export default function PapelPicado() {
    const colores = ["#4d7c62", "#e8e6e1", "#b5544a", "#e8e6e1"];
    const flagCount = 12;

    return (
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-14 overflow-visible opacity-90 z-20">
            {/* Cuerda */}
            <div className="absolute top-3 left-0 right-0 h-px bg-stone-400/40" />

            <div className="flex w-full pt-3">
                {Array.from({ length: flagCount }).map((_, i) => (
                    <div
                        key={i}
                        className="papel-picado-flag flex-1 mx-[1px]"
                        style={{
                            backgroundColor: colores[i % colores.length],
                            animationDelay: `${(i % 4) * 0.3}s`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
