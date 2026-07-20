import ModalContacto from "./ModalContacto";

export default function PantallaBloqueada({
    user,
    estado,
    diasBloqueado,
    tags,
    onLogout,
    correo,
}) {
    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-red-950 via-red-600 to-stone-950 flex items-center justify-center p-4">
            {/* Formas fantasma del dashboard, simuladas — no datos reales */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div
                    className="p-6 flex flex-col gap-5 max-w-2xl mx-auto opacity-[0.14]"
                    style={{ filter: "blur(14px)" }}
                >
                    <div className="h-20 bg-white rounded-3xl" />
                    <div className="flex gap-3">
                        <div className="h-11 flex-1 bg-white rounded-2xl" />
                        <div className="h-11 w-11 bg-white rounded-full shrink-0" />
                    </div>
                    <div className="h-48 bg-white rounded-[2rem]" />
                    <div className="h-80 bg-white rounded-[2rem]" />
                </div>
            </div>

            <div className="absolute top-[-15%] left-[-10%] w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-15%] right-[-10%] w-96 h-96 bg-red-800/30 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 w-full max-w-sm">
                {/* Header mínimo: nombre + salir */}
                <div className="flex items-center justify-between mb-6 px-1">
                    <p className="text-lg font-bold text-red-200/80">
                        {user?.name || "Residente"}
                    </p>
                    <button
                        onClick={onLogout}
                        className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] text-sm font-bold text-red-200/80 hover:text-red-600 hover:bg-red-50/50 hover:border-red-200/60 transition-all active:scale-95"
                    >
                        Salir
                    </button>
                </div>

                {/* Card principal */}
                <div className="relative overflow-hidden p-7 bg-white/[0.07] backdrop-blur-md border-t border-l border-white/20 border-r border-b border-white/5 shadow-[0_25px_70px_rgba(0,0,0,0.4)] rounded-[2.5rem] text-center">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

                    <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center animate-pulse">
                        <svg className="w-10 h-10 text-red-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                        </svg>
                    </div>

                    <h1 className="text-xl font-bold text-white mb-1.5">
                        Acceso Temporalmente Suspendido
                    </h1>
                    <p className="text-sm text-red-200/80 leading-relaxed mb-5">
                        {estado.descripcion}
                    </p>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-400/25 mb-6">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        <span className="text-[11px] font-bold text-red-200 uppercase tracking-wide">
                            Bloqueado hace {diasBloqueado} {diasBloqueado === 1 ? "día" : "días"}
                        </span>
                    </div>

                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-center mb-6">
                            {tags.map((t) => (
                                <span
                                    key={t.id}
                                    className="relative px-3 py-1 rounded-xl text-xs font-bold font-mono tracking-wider bg-white/5 text-white/30 border border-white/10 grayscale"
                                >
                                    {t.codigo}
                                    <svg
                                        className="w-3 h-3 absolute -top-1.5 -right-1.5 text-red-400"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </span>
                            ))}
                        </div>
                    )}

                    <p className="text-sm font-semibold text-red-100">
                        Recupera el acceso con tu pago extemporáneo
                    </p>
                </div>

                {/* Contacto de vigilancia, siempre disponible */}
                <button
                    onClick={correo.open}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 backdrop-blur-xl border border-white/40 rounded-2xl text-xs font-semibold text-red-100/70 hover:bg-white/10 hover:text-red-100 transition-all"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                    </svg>
                    Contactar a vigilancia
                </button>
            </div>

            <ModalContacto
                isOpen={correo.isOpen}
                isVisible={correo.isVisible}
                onClose={correo.close}
                email="vigilanciasanisidro@gmail.com"
                boxClassName="bg-white/95 backdrop-blur-2xl"
                transformOrigin="bottom center"
            />
        </div>
    );
}
