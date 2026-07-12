import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../lib/axios";
import useAuthStore from "../store/authStore";
import { getAvisos } from "../api/avisos";
import { logout as apiLogout } from "../api/auth";

console.log("VERSION 2.0 - CARGADA");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(mes) {
    if (!mes) return "-";
    const [year, month] = mes.split("-");
    return new Date(year, month - 1).toLocaleDateString("es-MX", {
        month: "long",
        year: "numeric",
    });
}

function formatDate(dateString) {
    if (!dateString) return "-";
    const part = dateString.split("T")[0];
    const [y, m, d] = part.split("-");
    return `${d}/${m}/${y}`;
}

// ─── Config de tipos de aviso ─────────────────────────────────────────────────

const TIPO_CONFIG = {
    urgente: {
        label: "Urgente",
        bg: "bg-red-100/50",
        text: "text-red-700",
        border: "border-red-200/60",
        dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
    },
    informativo: {
        label: "Informativo",
        bg: "bg-blue-100/50",
        text: "text-blue-700",
        border: "border-blue-200/60",
        dot: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]",
    },
    aviso: {
        label: "Aviso",
        bg: "bg-yellow-100/50",
        text: "text-yellow-700",
        border: "border-yellow-200/60",
        dot: "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]",
    },
    positivo: {
        label: "Positivo",
        bg: "bg-green-100/50",
        text: "text-green-700",
        border: "border-green-200/60",
        dot: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]",
    },
};

// ─── Semáforo de estado ───────────────────────────────────────────────────────

function calcularEstado(pagos) {
    const mesActual = currentMonthKey();
    const pagosDelMes = pagos.filter((p) => p.mes === mesActual);

    if (pagosDelMes.length === 0) {
        return {
            color: "rojo",
            titulo: "Acceso Restringido",
            subtitulo: "Pendiente de Pago",
            descripcion: `No se detecta pago para ${formatMonth(mesActual)}.`,
        };
    }

    const tieneExtraordinario = pagosDelMes.some(
        (p) => p.tipo === "extraordinario",
    );

    if (tieneExtraordinario) {
        return {
            color: "amarillo",
            titulo: "Acceso Activo",
            subtitulo: "Pago Extraordinario",
            descripcion: `Pago registrado con recargo para ${formatMonth(mesActual)}.`,
        };
    }

    return {
        color: "verde",
        titulo: "Acceso Activo",
        subtitulo: "Pago Puntual",
        descripcion: `Pago ordinario registrado para ${formatMonth(mesActual)}.`,
    };
}

const SEMAFORO_STYLES = {
    verde: {
        ring: "border-green-300/80",
        glow: "shadow-[0_15px_35px_rgba(34,197,94,0.25)]",
        bg: "bg-gradient-to-br from-green-400/30 to-green-500/10",
        icon: "text-green-600",
        titulo: "text-green-700",
        pulse: "bg-green-400",
    },
    amarillo: {
        ring: "border-yellow-300/80",
        glow: "shadow-[0_15px_35px_rgba(234,179,8,0.25)]",
        bg: "bg-gradient-to-br from-yellow-400/30 to-yellow-500/10",
        icon: "text-yellow-600",
        titulo: "text-yellow-700",
        pulse: "bg-yellow-400",
    },
    rojo: {
        ring: "border-red-300/80",
        glow: "shadow-[0_15px_35px_rgba(239,68,68,0.25)]",
        bg: "bg-gradient-to-br from-red-400/30 to-red-500/10",
        icon: "text-red-600",
        titulo: "text-red-700",
        pulse: "bg-red-400",
    },
};

// ─── Componente Semáforo ──────────────────────────────────────────────────────

function Semaforo({ estado }) {
    const s = SEMAFORO_STYLES[estado.color];

    const Icon =
        estado.color === "verde" ? (
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        ) : estado.color === "amarillo" ? (
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
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        ) : (
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
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        );

    return (
        <div className="relative overflow-hidden flex flex-col items-center py-10 px-6 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            {/* Brillo curvo superior */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            {/* Círculo principal con Plop y Liquid Glass */}
            <div
                className={`relative flex items-center justify-center w-36 h-36 rounded-full border-[1.5px] ${s.ring} ${s.bg} backdrop-blur-md shadow-[inset_0_4px_10px_rgba(255,255,255,0.7)] ${s.glow} mb-6 hover:scale-105 active:scale-95 transition-all duration-300 ease-out cursor-default`}
            >
                {/* Pulso animado */}
                <span
                    className={`absolute inline-flex w-full h-full rounded-full opacity-20 animate-ping ${s.pulse}`}
                />
                <span className={s.icon}>{Icon}</span>
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

// ─── Tablón de avisos (vista residente) ───────────────────────────────────────

function TablonavisoResidente({ avisos }) {
    const [imagenAmpliada, setImagenAmpliada] = useState(null);

    useEffect(() => {
        if (imagenAmpliada) {
            const scrollY = window.scrollY;
            document.body.style.position = "fixed";
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = "100%";

            return () => {
                document.body.style.position = "";
                document.body.style.top = "";
                document.body.style.width = "";
                window.scrollTo(0, scrollY);
            };
        }
    }, [imagenAmpliada]);

    if (avisos.length === 0) return null;

    // ... resto del componente sin cambios
    // Asumo que TIPO_CONFIG viene de tus props o contexto global, lo dejo igual.
    // if (avisos.length === 0) return null; // <- Opcional: descomenta si validas que haya avisos.

    return (
        <div className="relative overflow-hidden p-6 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            {/* Brillo superior */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            <div className="flex items-center gap-2 mb-5">
                <svg
                    className="w-5 h-5 text-orange-400 drop-shadow-sm"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                    />
                </svg>
                <h3 className="text-sm font-bold text-stone-800 tracking-wide uppercase">
                    Tablón de Avisos
                </h3>
            </div>

            <div className="space-y-3">
                {avisos.map((aviso) => {
                    const cfg =
                        TIPO_CONFIG[aviso.tipo] || TIPO_CONFIG.informativo;
                    return (
                        <div
                            key={aviso.id}
                            className={`relative overflow-hidden rounded-2xl border p-4 bg-white/50 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_2px_8px_rgba(0,0,0,0.02)] ${cfg.border} hover:bg-white/60 transition-colors duration-300`}
                        >
                            <div className="flex items-start gap-3 relative z-10">
                                <span
                                    className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <p
                                            className={`text-sm font-bold ${cfg.text}`}
                                        >
                                            {aviso.titulo}
                                        </p>
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border} backdrop-blur-sm`}
                                        >
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-stone-600 leading-relaxed">
                                        {aviso.descripcion}
                                    </p>

                                    {/* Imagen del aviso */}
                                    {aviso.imagen_url && (
                                        <button
                                            onClick={() =>
                                                setImagenAmpliada(
                                                    aviso.imagen_url,
                                                )
                                            }
                                            className="mt-3 block w-full max-w-xs rounded-xl overflow-hidden border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:opacity-90 active:scale-[0.98] transition-all"
                                        >
                                            <img
                                                src={aviso.imagen_url}
                                                alt={aviso.titulo}
                                                className="w-full h-40 object-cover"
                                            />
                                        </button>
                                    )}

                                    <p className="text-xs text-stone-400 mt-2 font-medium">
                                        {new Date(
                                            aviso.created_at,
                                        ).toLocaleDateString("es-MX", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Lightbox con estilo Glassmorphism (Ajustado) */}
            {imagenAmpliada && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
                    onClick={() => setImagenAmpliada(null)}
                >
                    {/* Fondo oscuro translúcido */}
                    <div className="absolute inset-0 bg-white-900/20 backdrop-blur-sm" />

                    {/* Contenedor Glassmorphism Shrink-Wrap */}
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-auto h-auto bg-white/20 backdrop-blur-[8px] backdrop-saturate-200 border border-white/50 p-2 sm:p-3 z-10 rounded-2xl sm:rounded-[2rem] shadow-[0_25px_50px_rgba(0,0,0,0.3),inset_0_2px_10px_rgba(255,255,255,0.4)]"
                    >
                        {/* Botón Flotante Absoluto */}
                        <button
                            onClick={() => setImagenAmpliada(null)}
                            className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 p-2 text-stone-600 hover:text-stone-900 bg-white/90 hover:bg-white border border-white/60 shadow-xl rounded-full transition-all active:scale-95 z-20"
                        >
                            <svg
                                className="w-5 h-5 sm:w-6 sm:h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>

                        {/* Imagen Responsive */}
                        <img
                            src={imagenAmpliada}
                            alt="Aviso ampliado"
                            className="w-auto h-auto object-contain rounded-xl sm:rounded-3xl"
                            style={{
                                maxHeight: "80dvh",
                                maxWidth: "100%",
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Historial de pagos ───────────────────────────────────────────────────────

// ─── Historial de pagos ───────────────────────────────────────────────────────

function HistorialPagos({ pagos, loading }) {
    // 1. Estado para el año (inicia en 2026 como pediste)
    const [selectedYear, setSelectedYear] = useState("2026");

    // 2. Extraer años únicos del historial para llenar el select
    const availableYears = useMemo(() => {
        // Sacamos el año de la fecha "YYYY-MM"
        const years = new Set(pagos.map((p) => p.mes.split("-")[0]));
        years.add("2026"); // Aseguramos que 2026 siempre exista como opción
        return Array.from(years).sort((a, b) => b - a); // Orden descendente
    }, [pagos]);

    // 3. Filtrar los pagos que correspondan al año seleccionado
    const filteredPagos = useMemo(() => {
        return pagos.filter((p) => p.mes.startsWith(selectedYear));
    }, [pagos, selectedYear]);

    return (
        <div className="relative overflow-hidden p-6 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            {/* Brillo superior */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-2">
                    <svg
                        className="w-5 h-5 text-orange-400 drop-shadow-sm"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                    </svg>
                    <h3 className="text-sm font-bold text-stone-800 tracking-wide uppercase">
                        Historial
                    </h3>
                </div>

                {/* Controles: Select de año y Contador */}
                <div className="flex items-center gap-2">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="bg-white/50 backdrop-blur-md border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] rounded-xl px-2.5 py-1 text-xs font-bold text-stone-700 outline-none focus:ring-2 focus:ring-orange-400/50 appearance-none cursor-pointer"
                        style={{
                            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="%23555" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>')`,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 6px center",
                            paddingRight: "1.75rem",
                        }}
                    >
                        {availableYears.map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>

                    <span className="px-3 py-1 rounded-full bg-white/50 border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] text-xs font-semibold text-stone-500">
                        {filteredPagos.length}
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin drop-shadow-md" />
                </div>
            ) : filteredPagos.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-8 font-medium">
                    Sin pagos registrados en {selectedYear}
                </p>
            ) : (
                <div className="divide-y divide-white/50 relative z-10">
                    {filteredPagos.map((pago) => (
                        <div
                            key={pago.id}
                            className="flex items-center justify-between py-3 px-2 -mx-2 rounded-xl hover:bg-white/40 transition-colors duration-200"
                        >
                            <div>
                                <p className="text-sm font-bold text-stone-800 capitalize">
                                    {formatMonth(pago.mes).split(" ")[0]}{" "}
                                    {/* Opcional: Mostrar solo el mes si ya tienes el año en el filtro */}
                                </p>
                                <p className="text-xs text-stone-500 font-medium mt-0.5">
                                    {pago.tipo === "extraordinario"
                                        ? "Extraordinario"
                                        : "Ordinario"}
                                    {pago.fecha_de_cobro
                                        ? ` · ${formatDate(pago.fecha_de_cobro)}`
                                        : ""}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-stone-800">
                                    $
                                    {parseFloat(pago.cantidad).toLocaleString(
                                        "es-MX",
                                    )}
                                </span>
                                {parseFloat(pago.restante) === 0 ? (
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-green-100/60 text-green-700 border border-green-200/60 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                                        Completo
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-red-100/60 text-red-700 border border-red-200/60 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                                        Resta $
                                        {parseFloat(pago.restante).toFixed(0)}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ResidentDashboard() {
    const { user, logout: storeLogout } = useAuthStore();
    const [pagos, setPagos] = useState([]);
    const [avisos, setAvisos] = useState([]);
    const [loadingPagos, setLoadingPagos] = useState(true);
    const [lastSync, setLastSync] = useState(null);

    const [correoOpen, setCorreoOpen] = useState(false);
    const [correoVisible, setCorreoVisible] = useState(false);
    const openCorreo = () => {
        setCorreoOpen(true);
        requestAnimationFrame(() => setCorreoVisible(true));
    };
    const closeCorreo = () => {
        setCorreoVisible(false);
        setTimeout(() => setCorreoOpen(false), 300);
    };

    const fetchData = useCallback(async () => {
        setLoadingPagos(true);
        try {
            const pagosRes = await api.get("/pagos/mis-pagos");
            setPagos(pagosRes.data.data || pagosRes.data || []);
            setLastSync(new Date());
        } catch (e) {
            console.error("Error cargando pagos:", e);
        } finally {
            setLoadingPagos(false);
        }

        try {
            const avisosRes = await getAvisos();
            setAvisos(avisosRes.data || []);
        } catch {}
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const estado = useMemo(() => calcularEstado(pagos), [pagos]);

    const diasBloqueado = useMemo(() => {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        return Math.max(
            1,
            Math.floor((hoy - inicioMes) / (1000 * 60 * 60 * 24)) + 1,
        );
    }, []);

    const handleLogout = useCallback(async () => {
        try {
            await apiLogout();
        } catch {}
        storeLogout();
        window.location.href = "/login";
    }, [storeLogout]);

    const tags = user?.tags || [];

    // ── Pantalla de bloqueo ──
    if (!loadingPagos && estado.color === "rojo") {
        return (
            <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-red-950 via-red-900 to-stone-950 flex items-center justify-center p-4">
                {/* Formas fantasma del dashboard, simuladas — no datos reales */}
                <div className="absolute inset-0 opacity-[0.07] pointer-events-none p-6 flex flex-col gap-5 max-w-2xl mx-auto">
                    <div className="h-20 bg-white rounded-3xl" />
                    <div className="h-14 bg-white rounded-2xl" />
                    <div className="h-40 bg-white rounded-[2rem]" />
                    <div className="h-32 bg-white rounded-[2rem]" />
                </div>

                <div className="absolute top-[-15%] left-[-10%] w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-[-15%] right-[-10%] w-96 h-96 bg-red-800/30 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 w-full max-w-sm">
                    {/* Header mínimo: nombre + salir */}
                    <div className="flex items-center justify-between mb-6 px-1">
                        <p className="text-sm font-bold text-red-200/80">
                            {user?.name || "Residente"}
                        </p>
                        <button
                            onClick={handleLogout}
                            className="text-xs font-bold text-red-200/60 hover:text-red-100 transition-colors"
                        >
                            Salir
                        </button>
                    </div>

                    {/* Card principal */}
                    <div className="relative overflow-hidden p-7 bg-white/[0.07] backdrop-blur-2xl border-t border-l border-white/20 border-r border-b border-white/5 shadow-[0_25px_70px_rgba(0,0,0,0.4)] rounded-[2.5rem] text-center">
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

                        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center animate-pulse">
                            <svg
                                className="w-7 h-7 text-red-300"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                        </div>

                        <h1 className="text-xl font-bold text-white mb-1.5">
                            Acceso Restringido
                        </h1>
                        <p className="text-sm text-red-200/80 leading-relaxed mb-5">
                            {estado.descripcion}
                        </p>

                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-400/25 mb-6">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            <span className="text-[11px] font-bold text-red-200 uppercase tracking-wide">
                                Bloqueado hace {diasBloqueado}{" "}
                                {diasBloqueado === 1 ? "día" : "días"}
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
                        onClick={openCorreo}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-xs font-semibold text-red-200/70 hover:bg-white/10 hover:text-red-100 transition-all"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
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

                {/* Modal de correo — mismo que en el dashboard normal */}
                {correoOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ touchAction: "manipulation" }}
                        onClick={closeCorreo}
                    >
                        <div
                            className="absolute inset-0 bg-black/50 transition-opacity duration-300"
                            style={{ opacity: correoVisible ? 1 : 0 }}
                        />
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-sm bg-white/95 backdrop-blur-2xl p-6 z-10"
                            style={{
                                borderRadius: correoVisible ? "2rem" : "9999px",
                                transform: correoVisible
                                    ? "scale(1)"
                                    : "scale(0.4)",
                                opacity: correoVisible ? 1 : 0,
                                filter: correoVisible
                                    ? "blur(0px)"
                                    : "blur(4px)",
                                transformOrigin: "bottom center",
                                transition:
                                    "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out, filter 0.35s ease-out",
                                boxShadow: "0 25px 70px rgba(0,0,0,0.3)",
                            }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-bold text-stone-800">
                                    Contacto de Vigilancia
                                </h3>
                                <button
                                    onClick={closeCorreo}
                                    className="p-2 text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-full transition-all active:scale-95"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2.5}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                            <p className="text-sm text-stone-600 leading-relaxed">
                                Para quejas, sugerencias, solicitud de video u
                                otro tema relacionado con seguridad, escribe a:
                            </p>
                            <p className="text-sm font-bold text-orange-500 mt-2 break-all">
                                vigilanciasanisidro@gmail.com
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        // Fondo base sutil para que el glass resalte
        <div className="min-h-screen p-4 md:p-6 bg-stone-50/50 relative">
            {/* Elementos decorativos de fondo opcionales para dar vida al blur */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-orange-200/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-stone-200/50 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-2xl mx-auto flex flex-col gap-5 relative z-10">
                {/* Header liquid glass */}
                <div className="flex items-start justify-between p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.03)] rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                    <div>
                        <h1 className="text-2xl font-bold text-stone-800 drop-shadow-sm">
                            Bienvenido, {user?.name || "Residente"}
                        </h1>
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2.5">
                                {tags.map((t) => (
                                    <span
                                        key={t.id}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold font-mono tracking-wider shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] ${
                                            t.activo
                                                ? "bg-green-100/60 text-green-700 border border-green-200/60 backdrop-blur-sm"
                                                : "bg-red-100/60 text-red-600 border border-red-200/60 backdrop-blur-sm"
                                        }`}
                                    >
                                        {t.codigo}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Botón con Plop */}
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold text-stone-600 bg-white/50 border border-white/80 shadow-[0_2px_10px_rgba(0,0,0,0.02),inset_0_1px_2px_rgba(255,255,255,1)] hover:bg-white/80 hover:shadow-[0_4px_15px_rgba(0,0,0,0.05)] active:scale-95 transition-all duration-200"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                        </svg>
                        Salir
                    </button>
                </div>

                {/* ── Pill de correo (ahora clickeable) + botón cámaras ── */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={openCorreo}
                        style={{ touchAction: "manipulation" }}
                        className="flex items-center gap-2.5 flex-1 min-w-0 px-4 py-2.5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 rounded-2xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_8px_rgba(0,0,0,0.03)] hover:bg-white/60 active:scale-[0.98] transition-all duration-200 text-left"
                    >
                        <svg
                            className="w-4 h-4 text-orange-400 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                        </svg>
                        <span className="text-xs font-semibold text-stone-600 truncate">
                            casetasanisidro088@gmail.com
                        </span>
                    </button>

                    <button
                        onClick={openCamaras}
                        title="Ver rango de cámaras"
                        style={{ touchAction: "manipulation" }}
                        className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-white/50 backdrop-blur-xl border border-white/80 shadow-[0_4px_14px_rgba(0,0,0,0.05),inset_0_1px_2px_rgba(255,255,255,0.9)] hover:bg-white/75 active:scale-95 transition-all duration-200"
                    >
                        <svg
                            className="w-5 h-5 text-stone-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                        </svg>
                    </button>
                </div>

                {/* Semáforo */}
                <Semaforo estado={estado} />

                {/* Tablón de avisos */}
                <TablonavisoResidente avisos={avisos} />

                {/* Historial */}
                <HistorialPagos pagos={pagos} loading={loadingPagos} />

                {/* ── Modal de correo (info de contacto) ── */}
                {correoOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ touchAction: "manipulation" }}
                        onClick={closeCorreo}
                    >
                        <div
                            className="absolute inset-0 bg-stone-900/25 transition-opacity duration-300"
                            style={{ opacity: correoVisible ? 1 : 0 }}
                        />
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="liquid-modal relative w-full max-w-sm bg-white/55 backdrop-blur-[20px] backdrop-saturate-200 border-t border-l border-white/70 border-r border-b border-white/30 p-6 z-10"
                            style={{
                                borderRadius: correoVisible ? "2rem" : "9999px",
                                transform: correoVisible
                                    ? "scale(1)"
                                    : "scale(0.4)",
                                opacity: correoVisible ? 1 : 0,
                                filter: correoVisible
                                    ? "blur(0px)"
                                    : "blur(4px)",
                                transformOrigin: "bottom right",
                                transition:
                                    "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out, filter 0.35s ease-out",
                                boxShadow:
                                    "0 25px 70px rgba(0,0,0,0.15), inset 0 2px 10px rgba(255,255,255,0.6)",
                            }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-bold text-stone-800">
                                    Contacto de Vigilancia
                                </h3>
                                <button
                                    onClick={closeCorreo}
                                    className="p-2 text-stone-500 hover:text-stone-800 bg-white/50 hover:bg-white/70 rounded-full transition-all active:scale-95"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2.5}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                            <p className="text-sm text-stone-600 leading-relaxed">
                                Para quejas, sugerencias, solicitud de video u
                                otro tema relacionado con seguridad, escribe a:
                            </p>
                            <p className="text-sm font-bold text-orange-500 mt-2 break-all">
                                casetasanisidro088@gmail.com
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Modal de cámaras (Responsivo y Ajustado) ── */}
                {camarasOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
                        style={{ touchAction: "manipulation" }}
                        onClick={closeCamaras}
                    >
                        {/* Fondo oscuro translúcido (Más claro: 40% en lugar de 900 sólido) */}
                        <div
                            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity duration-300"
                            style={{ opacity: camarasVisible ? 1 : 0 }}
                        />

                        {/* Contenedor Glassmorphism Responsivo */}
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-lg flex flex-col bg-white/45 backdrop-blur-[5px] backdrop-saturate-200 border-t border-l border-white/70 border-r border-b border-white/30 z-10 overflow-hidden"
                            style={{
                                maxHeight: "90dvh", // El modal nunca será más alto que el 90% de la pantalla
                                borderRadius: camarasVisible
                                    ? "2rem"
                                    : "9999px", // Suavizamos a 2rem para móviles
                                transform: camarasVisible
                                    ? "scale(1)"
                                    : "scale(0.35)",
                                opacity: camarasVisible ? 1 : 0,
                                filter: camarasVisible
                                    ? "blur(0px)"
                                    : "blur(4px)",
                                transformOrigin: "top right",
                                transition:
                                    "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out, filter 0.35s ease-out",
                                boxShadow:
                                    "0 25px 70px rgba(0,0,0,0.15), inset 0 2px 10px rgba(255,255,255,0.6)",
                            }}
                        >
                            {/* Header Fijo (No hace scroll) */}
                            <div className="flex items-center justify-between p-5 border-b border-white/30 shrink-0">
                                <h3 className="text-lg font-bold text-stone-800">
                                    Rango de Cámaras
                                </h3>
                                <button
                                    onClick={closeCamaras}
                                    className="p-2 text-stone-500 hover:text-stone-800 bg-white/40 hover:bg-white/70 rounded-full transition-all active:scale-95"
                                >
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2.5}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>

                            {/* Contenido (Si no cabe en el cel, esta área hace scroll) */}
                            <div className="p-5 overflow-y-auto">
                                <img
                                    src="/CAMARAS_page-0001.jpg"
                                    alt="Rango de cámaras de seguridad"
                                    className="w-full h-auto object-contain rounded-xl border border-white/60"
                                    style={{ touchAction: "manipulation" }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Pie: última sincronización */}
                {lastSync && (
                    <p className="text-center text-xs font-medium text-stone-400 pb-4 mix-blend-multiply">
                        Última actualización:{" "}
                        {lastSync.toLocaleTimeString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}{" "}
                        ·{" "}
                        {lastSync.toLocaleDateString("es-MX", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                        })}
                    </p>
                )}
            </div>
        </div>
    );
}
