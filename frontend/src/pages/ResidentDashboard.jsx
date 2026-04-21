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
        bg: "bg-red-100",
        text: "text-red-700",
        border: "border-red-200",
        dot: "bg-red-500",
    },
    informativo: {
        label: "Informativo",
        bg: "bg-blue-100",
        text: "text-blue-700",
        border: "border-blue-200",
        dot: "bg-blue-500",
    },
    aviso: {
        label: "Aviso",
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        border: "border-yellow-200",
        dot: "bg-yellow-500",
    },
    positivo: {
        label: "Positivo",
        bg: "bg-green-100",
        text: "text-green-700",
        border: "border-green-200",
        dot: "bg-green-500",
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
        ring: "ring-green-400/60",
        glow: "shadow-green-400/40",
        bg: "bg-green-500/20",
        icon: "text-green-500",
        titulo: "text-green-700",
        pulse: "bg-green-400",
    },
    amarillo: {
        ring: "ring-yellow-400/60",
        glow: "shadow-yellow-400/40",
        bg: "bg-yellow-500/20",
        icon: "text-yellow-500",
        titulo: "text-yellow-700",
        pulse: "bg-yellow-400",
    },
    rojo: {
        ring: "ring-red-400/60",
        glow: "shadow-red-400/40",
        bg: "bg-red-500/20",
        icon: "text-red-500",
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
                className="w-16 h-16"
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
                className="w-16 h-16"
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
                className="w-16 h-16"
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
        <div className="glass-card relative overflow-hidden flex flex-col items-center py-10 px-6">
            <div className="glass-card-shine" />

            {/* Círculo principal */}
            <div
                className={`relative flex items-center justify-center w-36 h-36 rounded-full ring-4 ${s.ring} ${s.bg} shadow-2xl ${s.glow} mb-6`}
            >
                {/* Pulso animado */}
                <span
                    className={`absolute inline-flex w-full h-full rounded-full opacity-20 animate-ping ${s.pulse}`}
                />
                <span className={s.icon}>{Icon}</span>
            </div>

            <p className={`text-2xl font-bold ${s.titulo}`}>{estado.titulo}</p>
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
    if (avisos.length === 0) return null;

    return (
        <div className="glass-card">
            <div className="glass-card-shine" />
            <div className="flex items-center gap-2 mb-4">
                <svg
                    className="w-4 h-4 text-orange-400"
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
                <h3 className="text-sm font-700 text-stone-800">
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
                            className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}
                        >
                            <div className="flex items-start gap-3">
                                <span
                                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <p
                                            className={`text-sm font-700 ${cfg.text}`}
                                        >
                                            {aviso.titulo}
                                        </p>
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-600 ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                                        >
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-stone-600">
                                        {aviso.descripcion}
                                    </p>
                                    <p className="text-xs text-stone-400 mt-1">
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
        </div>
    );
}

// ─── Historial de pagos ───────────────────────────────────────────────────────

function HistorialPagos({ pagos, loading }) {
    return (
        <div className="glass-card">
            <div className="glass-card-shine" />
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <svg
                        className="w-4 h-4 text-orange-400"
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
                    <h3 className="text-sm font-700 text-stone-800">
                        Historial de Pagos
                    </h3>
                </div>
                <span className="text-xs text-stone-400">
                    {pagos.length} registros
                </span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : pagos.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-8">
                    Sin pagos registrados
                </p>
            ) : (
                <div className="divide-y divide-black/05">
                    {pagos.map((pago) => (
                        <div key={pago.id} className="panel-item">
                            <div>
                                <p className="item-name">
                                    {formatMonth(pago.mes)}
                                </p>
                                <p className="item-sub">
                                    {pago.tipo === "extraordinario"
                                        ? "Extraordinario"
                                        : "Ordinario"}
                                    {pago.fecha_de_cobro
                                        ? ` · ${formatDate(pago.fecha_de_cobro)}`
                                        : ""}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-700 text-stone-800">
                                    $
                                    {parseFloat(pago.cantidad).toLocaleString(
                                        "es-MX",
                                    )}
                                </span>
                                {parseFloat(pago.restante) === 0 ? (
                                    <span className="badge badge-sold">
                                        Completo
                                    </span>
                                ) : (
                                    <span className="badge badge-due">
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

    const fetchData = useCallback(async () => {
        setLoadingPagos(true);
        try {
            const [pagosRes, avisosRes] = await Promise.all([
                api.get("/pagos/mis-pagos"),
                getAvisos(),
            ]);
            setPagos(pagosRes.data.data || pagosRes.data || []);
            setAvisos(avisosRes.data || []);
            setLastSync(new Date());
        } catch (e) {
            console.error("Error cargando datos del residente:", e);
        } finally {
            setLoadingPagos(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const estado = useMemo(() => calcularEstado(pagos), [pagos]);

    const handleLogout = useCallback(async () => {
        try {
            await apiLogout();
        } catch {}
        storeLogout();
        window.location.href = "/login";
    }, [storeLogout]);

    const tags = user?.tags || [];

    return (
        <div className="min-h-screen p-4 md:p-6">
            <div className="max-w-2xl mx-auto flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-stone-800">
                            Bienvenido, {user?.name || "Residente"}
                        </h1>
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {tags.map((t) => (
                                    <span
                                        key={t.id}
                                        className={`px-2 py-0.5 rounded-full text-xs font-600 font-mono ${
                                            t.activo
                                                ? "bg-green-100 text-green-700 border border-green-200"
                                                : "bg-red-100 text-red-600 border border-red-200"
                                        }`}
                                    >
                                        {t.codigo}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-600 text-stone-500 bg-white/60 border border-black/08 hover:bg-white transition"
                    >
                        <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                        </svg>
                        Salir
                    </button>
                </div>

                {/* Semáforo */}
                <Semaforo estado={estado} />

                {/* Tablón de avisos */}
                <TablonavisoResidente avisos={avisos} />

                {/* Historial */}
                <HistorialPagos pagos={pagos} loading={loadingPagos} />

                {/* Pie: última sincronización */}
                {lastSync && (
                    <p className="text-center text-xs text-stone-400 pb-2">
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
