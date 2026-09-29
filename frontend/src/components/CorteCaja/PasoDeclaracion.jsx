import { useState, useRef, useEffect } from "react";
import { Wallet, ArrowRight } from "lucide-react";

export default function PasoDeclaracion({ onDeclarar }) {
    const [monto, setMonto] = useState("");
    const [enfocado, setEnfocado] = useState(false);
    const inputRef = useRef(null);

    const [animando, setAnimando] = useState(false);
    const timerRef = useRef(null);

    const handleMontoChange = (e) => {
        setMonto(e.target.value);

        // Dispara la animación
        setAnimando(true);

        // Limpia el timer anterior si escribe muy rápido
        if (timerRef.current) clearTimeout(timerRef.current);

        // Regresa el input a su tamaño normal después de 150ms
        timerRef.current = setTimeout(() => {
            setAnimando(false);
        }, 150);
    };

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const montoValido = monto !== "" && Number(monto) >= 0;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!montoValido) return;
        onDeclarar(Number(monto));
    };

    const fechaJornada = new Date().toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
    });

    return (
        <form
            onSubmit={handleSubmit}
            className="glass-card !rounded-[2rem] !p-8 sm:!p-10 flex flex-col items-center text-center gap-7 w-full max-w-md mx-auto animate-paso-in"
        >
            {/* Header / progreso */}
            <div className="w-full flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-[11px] font-medium text-stone-400 tracking-wide">
                    <span>Cierre de jornada</span>
                    <span className="text-stone-300">·</span>
                    <span className="text-orange-500 font-semibold">01</span>
                    <span className="text-stone-300">/</span>
                    <span>02</span>
                </div>
                <div className="flex items-center gap-1.5 w-28">
                    <span className="h-1 flex-1 rounded-full bg-orange-500" />
                    <span className="h-1 flex-1 rounded-full bg-stone-200" />
                </div>
            </div>

            {/* Icon orb */}
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-50/60 backdrop-blur-md border border-orange-200/50 shadow-[0_0_20px_-4px_rgba(249,115,22,0.35)]">
                <Wallet className="w-6 h-6 text-orange-500" strokeWidth={2} />
            </div>

            {/* Título */}
            <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold text-stone-800">
                    Declaración de efectivo
                </h2>
                <p className="text-sm text-stone-500 ">
                    Cuenta el efectivo que tienes físicamente en este momento.
                </p>
            </div>

            {/* Monto — protagonista */}
            <div className="w-full">
                <label htmlFor="monto-declarado" className="sr-only">
                    Monto de efectivo declarado
                </label>
                <div
                    className={`relative flex items-center justify-center gap-1.5 rounded-2xl border bg-white/40 backdrop-blur-md px-6 py-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] transition-all duration-300 ${
                        enfocado
                            ? "border-orange-300 shadow-[0_0_0_4px_rgba(249,115,22,0.1),inset_0_1px_1px_rgba(255,255,255,0.6)] scale-[1.01]"
                            : "border-stone-200/70"
                    }`}
                >
                    <span
                        className={`text-3xl sm:text-4xl font-bold transition-colors duration-300 ${
                            monto ? "text-stone-400" : "text-stone-300"
                        }`}
                    >
                        $
                    </span>
                    <input
                        ref={inputRef}
                        id="monto-declarado"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={monto}
                        onChange={handleMontoChange}
                        onFocus={() => setEnfocado(true)}
                        onBlur={() => setEnfocado(false)}
                        placeholder="0.00"
                        className={`w-full bg-transparent text-center outline-none text-3xl sm:text-4xl font-bold text-stone-800 placeholder:text-stone-300/80 placeholder:font-medium transition-transform duration-150 ease-out will-change-transform ${
                            animando ? "scale-[1.6]" : "scale-100"
                        }`}
                    />
                </div>
                <p className="text-xs text-stone-400 mt-3">
                    Jornada · {fechaJornada}
                </p>
            </div>

            {/* CTA */}
            <div className="w-full flex flex-col items-center gap-2.5">
                <button
                    type="submit"
                    disabled={!montoValido}
                    className="group w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-orange-500 text-white font-semibold shadow-[0_8px_24px_-8px_rgba(249,115,22,0.55)] transition-all duration-200 hover:bg-orange-600 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:saturate-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
                >
                    Continuar
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
                <p className="text-[11px] text-stone-400">
                    Verificarás tu corte en el siguiente paso.
                </p>
            </div>

            <style>{`
                @keyframes paso-in {
                    from {
                        opacity: 0;
                        transform: translateY(8px) scale(0.98);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                .animate-paso-in {
                    animation: paso-in 450ms cubic-bezier(0.22, 1, 0.36, 1);
                }
            `}</style>
        </form>
    );
}
