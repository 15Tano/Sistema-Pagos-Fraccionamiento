export default function PasoVerificando() {
    return (
        <div className="glass-card !rounded-[2rem] !p-10 flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in-95 duration-300">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-[0.15em]">
                Comprobando cierre...
            </p>

            <div className="relative w-14 h-14 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-orange-100" />
                <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
            </div>

            <p className="text-sm text-stone-500">
                Comparando registros de la jornada
            </p>
        </div>
    );
}
