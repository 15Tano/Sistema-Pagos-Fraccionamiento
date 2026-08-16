import { useState, useEffect, useMemo } from "react";
import { getDashboardStats } from "../../api/dashboard";
import useAuthStore from "../../store/authStore";
import PaginatedPanel from "./components/PaginatedPanel";
import KpiCard from "./components/KpiCard";
import PanelSeccion from "./components/PanelSeccion";
import AvisosAdmin from "./components/AvisosAdmin";
import AuditLogs from "./components/AuditLogs";
import { formatFechaCorta } from "./helpers/formatFecha";

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuthStore();
    const [plazaExpandida, setPlazaExpandida] = useState(null);
    const esCapturista = user?.role === "capturista";

    const rankingConPosicion = useMemo(() => {
        return (stats?.ranking_plazas || []).map((p, i) => ({
            ...p,
            rank: i + 1,
        }));
    }, [stats?.ranking_plazas]);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getDashboardStats();
            setStats(res.data);
        } catch (err) {
            setError("No se pudieron cargar las estadísticas.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const mesFormateado = useMemo(() => {
        if (!stats?.mes) return "";
        const [year, month] = stats.mes.split("-");
        return new Date(year, month - 1).toLocaleDateString("es-MX", {
            month: "long",
            year: "numeric",
        });
    }, [stats?.mes]);

    if (loading)
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin drop-shadow-md" />
                    <span className="text-stone-500 text-sm font-bold tracking-wide">
                        Cargando estadísticas...
                    </span>
                </div>
            </div>
        );

    if (error)
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4 p-6 bg-white/40 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] max-w-sm mx-auto mt-10">
                <p className="text-red-500 text-sm font-bold text-center drop-shadow-sm">
                    {error}
                </p>
                <button
                    onClick={fetchStats}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-400 text-white font-bold rounded-xl shadow-[0_4px_10px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 transition-all"
                >
                    Reintentar
                </button>
            </div>
        );

    if (esCapturista)
        return (
            <div className="flex items-center justify-center h-full pt-10">
                <div className="relative overflow-hidden flex flex-col items-center py-16 px-10 text-center max-w-sm bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2.5rem]">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                    <div className="w-20 h-20 rounded-full bg-white/60 border border-white/80 flex items-center justify-center mb-6 backdrop-blur-md shadow-[inset_0_2px_6px_rgba(0,0,0,0.05),0_4px_15px_rgba(0,0,0,0.05)]">
                        <svg
                            className="w-10 h-10 text-stone-400 drop-shadow-sm"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                        </svg>
                    </div>
                    <p className="text-stone-600 font-bold drop-shadow-sm">
                        Solo la administración puede ver esta sección
                    </p>
                </div>
            </div>
        );

    return (
        <div className="flex flex-col gap-5 h-full pb-20 md:pb-0">
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Recaudado */}
                <KpiCard
                    label={`Recaudado en ${mesFormateado}`}
                    value={`$${stats.total_recaudado.toLocaleString("es-MX")}`}
                    valueClassName="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-500 to-orange-600 drop-shadow-sm"
                    subtitle={`${stats.total_vecinos - stats.vecinos_pendientes} vecinos pagaron`}
                    iconWrapperClassName="absolute top-5 right-5 text-orange-400/30 group-hover:text-orange-400/50 group-hover:scale-110 transition-all duration-500"
                    icon={
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="12" y1="1" x2="12" y2="23" />
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                    }
                />

                {/* Pendientes */}
                <KpiCard
                    label="Pendientes de pago"
                    value={stats.vecinos_pendientes}
                    valueClassName="text-3xl font-black text-stone-700 drop-shadow-sm"
                    subtitle={`de ${stats.total_vecinos} vecinos totales`}
                    iconWrapperClassName="absolute top-5 right-5 text-stone-400/30 group-hover:text-stone-500/40 group-hover:scale-110 transition-all duration-500"
                    icon={
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    }
                />

                {/* Tags */}
                <KpiCard
                    label="Tags vendidos"
                    value={stats.tags_vendidos}
                    valueClassName="text-3xl font-black text-stone-700 drop-shadow-sm"
                    subtitle={`${stats.tags_en_stock} en stock`}
                    iconWrapperClassName="absolute top-5 right-5 text-stone-400/30 group-hover:text-stone-500/40 group-hover:scale-110 transition-all duration-500"
                    icon={
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                            <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                    }
                />
            </div>

            {/* ── Paneles inferiores ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                {/* Morosos */}
                <PanelSeccion
                    titulo="Sin pagar este mes"
                    badgeText={`${stats.morosos.length} vecinos`}
                    badgeClassName="bg-orange-100/60 text-orange-700 border-orange-200/60"
                >
                    <PaginatedPanel
                        items={stats.morosos}
                        emptyText="¡Todos los vecinos han pagado!"
                        renderItem={(vecino) => (
                            <div
                                key={vecino.id}
                                className="flex items-center justify-between p-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60 mb-2 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] hover:bg-white/70 transition-colors"
                            >
                                <div>
                                    <p className="text-sm font-bold text-stone-800 capitalize drop-shadow-sm">
                                        {vecino.nombre}
                                    </p>
                                    <p className="text-xs font-semibold text-stone-500 mt-0.5">
                                        {vecino.calle} #{vecino.numero_casa}
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-red-100/60 text-red-700 border border-red-200/60 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                                    $280
                                </span>
                            </div>
                        )}
                    />
                </PanelSeccion>

                {/* Últimas ventas */}
                <PanelSeccion
                    titulo="Últimas ventas de tags"
                    badgeText={`${stats.tags_vendidos} vendidos`}
                    badgeClassName="bg-green-100/60 text-green-700 border-green-200/60"
                >
                    <PaginatedPanel
                        items={stats.ultimas_ventas}
                        emptyText="No hay ventas registradas aún."
                        renderItem={(venta) => (
                            <div
                                key={venta.id}
                                className="flex items-center justify-between p-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60 mb-2 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] hover:bg-white/70 transition-colors"
                            >
                                <div>
                                    <p className="text-sm font-bold text-stone-800 uppercase drop-shadow-sm">
                                        Tag #{venta.codigo}
                                    </p>
                                    <p className="text-xs font-semibold text-stone-500 mt-0.5">
                                        {formatFechaCorta(venta.created_at)}
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-green-100/60 text-green-700 border border-green-200/60 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                                    Vendido
                                </span>
                            </div>
                        )}
                    />
                </PanelSeccion>

                <PanelSeccion
                    titulo="Ranking de adopción por plaza"
                    badgeText={`${rankingConPosicion.length} plazas`}
                    badgeClassName="bg-orange-100/60 text-orange-700 border-orange-200/60"
                    className="md:col-span-2"
                >
                    <PaginatedPanel
                        items={rankingConPosicion}
                        emptyText="Sin datos de plazas aún."
                        renderItem={(plaza) => {
                            const expandida = plazaExpandida === plaza.calle;
                            return (
                                <div
                                    key={plaza.calle}
                                    className="p-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60 mb-2 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] hover:bg-white/70 transition-colors"
                                >
                                    <button
                                        onClick={() =>
                                            setPlazaExpandida(
                                                expandida ? null : plaza.calle,
                                            )
                                        }
                                        className="w-full flex items-center gap-3 text-left"
                                    >
                                        <div className="w-7 h-7 shrink-0 flex items-center justify-center">
                                            {plaza.rank <= 3 ? (
                                                <span className="text-lg">
                                                    {plaza.rank === 1
                                                        ? "🥇"
                                                        : plaza.rank === 2
                                                          ? "🥈"
                                                          : "🥉"}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-bold text-stone-400">
                                                    #{plaza.rank}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-sm font-bold text-stone-800 capitalize truncate drop-shadow-sm">
                                                    {plaza.calle}
                                                </p>
                                                <span className="text-xs font-bold text-stone-600 shrink-0 ml-2">
                                                    {plaza.porcentaje}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-white/60 border border-white/60 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.4)] transition-all duration-500"
                                                    style={{
                                                        width: `${plaza.porcentaje}%`,
                                                    }}
                                                />
                                            </div>
                                            <p className="text-[10px] font-semibold text-stone-400 mt-1">
                                                {plaza.con_cuenta} de{" "}
                                                {plaza.total} vecinos
                                                registrados
                                                {plaza.vecinos_sin_cuenta
                                                    .length > 0 && (
                                                    <span className="text-orange-500">
                                                        {" "}
                                                        ·{" "}
                                                        {
                                                            plaza
                                                                .vecinos_sin_cuenta
                                                                .length
                                                        }{" "}
                                                        faltan{" "}
                                                        {expandida ? "▲" : "▼"}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </button>

                                    {expandida &&
                                        plaza.vecinos_sin_cuenta.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-white/50 flex flex-col gap-1.5">
                                                {plaza.vecinos_sin_cuenta.map(
                                                    (v) => (
                                                        <div
                                                            key={v.id}
                                                            className="flex items-center justify-between px-2.5 py-1.5 bg-orange-50/40 rounded-lg"
                                                        >
                                                            <span className="text-xs font-semibold text-stone-700 capitalize">
                                                                {v.nombre}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-stone-400">
                                                                #{v.numero_casa}
                                                            </span>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                </div>
                            );
                        }}
                    />
                </PanelSeccion>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AvisosAdmin />
                    <AuditLogs />
                </div>
            </div>
        </div>
    );
}
