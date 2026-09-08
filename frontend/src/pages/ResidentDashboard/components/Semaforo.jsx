import { SEMAFORO_STYLES } from "../dashboardHelpers";
import { useTemporada } from "../../../hooks/useTemporada";
import SombreroSemaforo from "../../../components/decoraciones/SombreroSemaforo";

export default function Semaforo({ estado }) {
    const tema = useTemporada();
    const s = SEMAFORO_STYLES[estado.color];

    return (
        <div className="card-tematizable relative overflow-hidden flex flex-col items-center py-10 px-6 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            {/* Brillo curvo superior */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            {/* Círculo principal con Plop y Liquid Glass */}
            <div
                className={`semaforo-circulo relative flex items-center justify-center w-36 h-36 rounded-full border-[1.5px] ${s.ring} ${s.bg} backdrop-blur-md shadow-[inset_0_4px_10px_rgba(255,255,255,0.7)] ${s.glow} mb-6 hover:scale-105 active:scale-95 transition-all duration-300 ease-out cursor-default`}
            >
                {tema.sombreroSemaforo && (
                    <div className="absolute -top-11 left-1/2 -translate-x-[60%] w-32 z-20 pointer-events-none drop-shadow-md">
                        <SombreroSemaforo />
                    </div>
                )}

                {/* Pulso animado */}
                <span
                    className={`absolute inline-flex w-full h-full rounded-full opacity-20 animate-ping ${s.pulse}`}
                />
                <span className={s.icon}>
                    <svg
                        className="w-16 h-16 drop-shadow-md"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d={s.iconPath}
                        />
                    </svg>
                </span>
            </div>

            <p className={`text-2xl font-bold ${s.titulo} drop-shadow-sm`}>
                {estado.titulo}
            </p>
            <p className="text-lg text-stone-600 font-medium mt-1">
                {estado.subtitulo}
            </p>
            <p className="text-sm text-stone-400 mt-2 text-center max-w-xs">
                {estado.descripcion}
            </p>
        </div>
    );
}
