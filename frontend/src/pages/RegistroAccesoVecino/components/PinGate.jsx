import { useState } from "react";
import { apiPublica } from "../api";
import BackgroundBlobs from "./BackgroundBlobs";
import { ShieldIcon, LockIcon, EyeIcon } from "../icons";

export default function PinGate({ onSuccess }) {
    const [pin, setPin] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleVerify = async () => {
        if (!pin.trim()) {
            setError("Ingresa el PIN de acceso.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await apiPublica.post("/capturista/verify-pin", { pin });
            onSuccess(res.data.token);
        } catch (err) {
            setError(
                err.response?.status === 403
                    ? "PIN incorrecto. Verifica e intenta de nuevo."
                    : "Error al verificar el PIN. Intenta de nuevo.",
            );
            setPin("");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 md:p-8">
            <BackgroundBlobs />

            <div className="w-full max-w-[420px] relative z-10">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-white/40 backdrop-blur-md border border-white/60 shadow-lg rounded-2xl flex items-center justify-center mx-auto mb-5 text-orange-500">
                        <ShieldIcon />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">
                        Área restringida
                    </p>
                    <h1 className="text-3xl font-bold text-stone-800">Acceso de capturista</h1>
                </div>

                <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-6 md:p-8 space-y-5">
                    {error && (
                        <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                            {error}
                        </div>
                    )}
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none">
                            <LockIcon />
                        </span>
                        <input
                            type={showPin ? "text" : "password"}
                            value={pin}
                            onChange={(e) => {
                                setPin(e.target.value);
                                setError("");
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                            placeholder="PIN de acceso"
                            autoComplete="off"
                            className={`w-full pl-12 pr-12 py-3.5 bg-white/50 backdrop-blur-sm border rounded-2xl text-base font-medium text-stone-800 placeholder-stone-500 focus:outline-none focus:ring-4 transition-all tracking-widest hover:bg-white/60 ${
                                error
                                    ? "border-red-300 focus:border-red-400 focus:ring-red-400/20"
                                    : "border-white/60 focus:border-orange-400 focus:ring-orange-500/20 focus:bg-white/80"
                            }`}
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPin((v) => !v)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors p-1"
                            tabIndex={-1}
                        >
                            <EyeIcon open={showPin} />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleVerify}
                        disabled={loading}
                        className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-base font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 active:translate-y-0"
                    >
                        {loading ? "Verificando..." : "Ingresar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
