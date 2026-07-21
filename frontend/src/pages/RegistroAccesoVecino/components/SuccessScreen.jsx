import { useState } from "react";
import { CheckIcon } from "../icons";

export default function SuccessScreen({ mode, vecino, username, password, onReset }) {
    const [copied, setCopied] = useState(false);
    const isCreate = mode === "crear";

    const handleCopy = async () => {
        const texto = `Usuario: ${username}\nContraseña: ${password}`;
        try {
            await navigator.clipboard.writeText(texto);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Portapapeles no disponible; el capturista puede copiar a mano.
        }
    };

    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-3xl p-8 md:p-12 max-w-[480px] w-full text-center relative z-10">
            <div className="w-20 h-20 bg-green-500/20 backdrop-blur-md border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 shadow-lg shadow-green-500/20">
                <CheckIcon />
            </div>
            <h2 className="text-2xl font-bold text-stone-800 mb-2">
                {isCreate ? "¡Acceso creado!" : "Acceso eliminado"}
            </h2>

            {isCreate ? (
                <>
                    <p className="text-stone-600 text-base mb-4 leading-relaxed">
                        El vecino{" "}
                        <span className="font-bold text-stone-800">{vecino?.nombre}</span> ya
                        puede ingresar con el usuario{" "}
                        <span className="font-mono text-orange-600 font-bold bg-white/50 px-2 py-1 rounded-lg border border-white/60">
                            {username}
                        </span>
                    </p>
                    <p className="text-xs text-stone-500 mb-4">
                        Copia estas credenciales ahora y entrégalas al residente: no vuelven a
                        mostrarse después de salir de esta pantalla.
                    </p>
                    <button
                        onClick={handleCopy}
                        className="w-full py-3 rounded-2xl bg-white/60 hover:bg-white/80 border border-white/60 text-stone-800 text-sm font-bold transition-all"
                    >
                        {copied ? "¡Copiado!" : "Copiar usuario y contraseña"}
                    </button>
                </>
            ) : (
                <p className="text-stone-600 text-base mb-4 leading-relaxed">
                    Las credenciales de{" "}
                    <span className="font-bold text-stone-800">{vecino?.nombre}</span> fueron
                    eliminadas. El residente necesitará un acceso nuevo para volver a iniciar
                    sesión.
                </p>
            )}

            <button
                onClick={onReset}
                className="mt-4 w-full py-3.5 rounded-2xl bg-stone-800 hover:bg-stone-900 text-white text-base font-bold transition-all shadow-lg shadow-stone-800/30 hover:shadow-stone-800/50 hover:-translate-y-0.5"
            >
                {isCreate ? "Registrar otro vecino" : "Volver"}
            </button>
        </div>
    );
}
