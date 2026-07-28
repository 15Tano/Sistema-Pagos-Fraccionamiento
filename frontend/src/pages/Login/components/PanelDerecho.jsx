// Right Column: Imagen Grande
function PanelDerecho() {
    return (
        <div className="hidden lg:flex w-1/2 items-center justify-center p-8 relative z-10 pointer-events-none">
            {/* Glow suave detrás del logo grande para separarlo del fondo */}
            <div className="absolute w-[400px] h-[400px] bg-white/60 rounded-full blur-[60px]" />
            <img
                src="/Logo Fraccionamiento Sol Verde Oro Elegante.png"
                alt="Logo de San Isidro"
                className="max-w-[600px] lg:max-w-[85%] relative z-10 drop-shadow-2xl"
            />
        </div>
    );
}

export default PanelDerecho;
