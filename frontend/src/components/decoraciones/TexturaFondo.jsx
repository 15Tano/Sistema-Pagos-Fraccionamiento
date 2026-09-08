// src/components/decoraciones/TexturaFondo.jsx
export default function TexturaFondo() {
    return (
        <div
            className="absolute inset-0 pointer-events-none opacity-[0.05] z-0"
            style={{
                backgroundImage: `repeating-linear-gradient(45deg, #006341 0px, #006341 2px, transparent 2px, transparent 12px),
                           repeating-linear-gradient(-45deg, #CE1126 0px, #CE1126 2px, transparent 2px, transparent 12px)`,
            }}
        />
    );
}
