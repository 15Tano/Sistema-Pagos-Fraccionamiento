import { useState, useEffect, useMemo } from "react";
import { getDashboardStats } from "../api/dashboard";

const ITEMS_PER_PAGE = 5;

function PaginatedPanel({ items, renderItem, emptyText }) {
    const [page, setPage] = useState(1);
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const slice = items.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE,
    );

    useEffect(() => setPage(1), [items.length]);

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex flex-col gap-1.5 flex-1">
                {slice.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-sm text-stone-400">
                        {emptyText}
                    </div>
                ) : (
                    slice.map((item, i) => renderItem(item, i))
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/20">
                    <span className="text-xs text-stone-400">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(page * ITEMS_PER_PAGE, items.length)} de{" "}
                        {items.length}
                    </span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="w-6 h-6 rounded-md border border-black/10 bg-white/60 text-stone-600 text-xs font-semibold flex items-center justify-center hover:bg-white disabled:opacity-30 transition"
                        >
                            ‹
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button
                                key={i}
                                onClick={() => setPage(i + 1)}
                                className={`w-6 h-6 rounded-md text-xs font-semibold flex items-center justify-center transition
                                    ${
                                        page === i + 1
                                            ? "bg-orange-500 text-white border border-orange-500"
                                            : "border border-black/10 bg-white/60 text-stone-600 hover:bg-white"
                                    }`}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            onClick={() =>
                                setPage((p) => Math.min(totalPages, p + 1))
                            }
                            disabled={page === totalPages}
                            className="w-6 h-6 rounded-md border border-black/10 bg-white/60 text-stone-600 text-xs font-semibold flex items-center justify-center hover:bg-white disabled:opacity-30 transition"
                        >
                            ›
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-stone-500 text-sm">
                        Cargando estadísticas...
                    </span>
                </div>
            </div>
        );

    if (error)
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <p className="text-red-500 text-sm">{error}</p>
                <button
                    onClick={fetchStats}
                    className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition"
                >
                    Reintentar
                </button>
            </div>
        );

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Recaudado */}
                <div className="glass-card relative overflow-hidden">
                    <div className="glass-card-shine" />
                    <p className="kpi-label">Recaudado en {mesFormateado}</p>
                    <p className="kpi-value text-orange-500">
                        ${stats.total_recaudado.toLocaleString("es-MX")}
                    </p>
                    <p className="kpi-sub">
                        {stats.total_vecinos - stats.vecinos_pendientes} vecinos
                        pagaron
                    </p>
                    <div className="kpi-icon text-orange-400">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="12" y1="1" x2="12" y2="23" />
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                    </div>
                </div>

                {/* Pendientes */}
                <div className="glass-card relative overflow-hidden">
                    <div className="glass-card-shine" />
                    <p className="kpi-label">Pendientes de pago</p>
                    <p className="kpi-value">{stats.vecinos_pendientes}</p>
                    <p className="kpi-sub">
                        de {stats.total_vecinos} vecinos totales
                    </p>
                    <div className="kpi-icon text-orange-400">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                </div>

                {/* Tags */}
                <div className="glass-card relative overflow-hidden">
                    <div className="glass-card-shine" />
                    <p className="kpi-label">Tags vendidos</p>
                    <p className="kpi-value">{stats.tags_vendidos}</p>
                    <p className="kpi-sub">{stats.tags_en_stock} en stock</p>
                    <div className="kpi-icon text-orange-400">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                            <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* ── Paneles inferiores ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                {/* Morosos */}
                <div className="glass-card flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-700 text-stone-800">
                            Sin pagar este mes
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-700 bg-orange-100 text-orange-700 border border-orange-200">
                            {stats.morosos.length} vecinos
                        </span>
                    </div>
                    <PaginatedPanel
                        items={stats.morosos}
                        emptyText="¡Todos los vecinos han pagado!"
                        renderItem={(vecino) => (
                            <div key={vecino.id} className="panel-item">
                                <div>
                                    <p className="item-name">{vecino.nombre}</p>
                                    <p className="item-sub">
                                        {vecino.calle} #{vecino.numero_casa}
                                    </p>
                                </div>
                                <span className="badge badge-due">$280</span>
                            </div>
                        )}
                    />
                </div>

                {/* Últimas ventas */}
                <div className="glass-card flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-700 text-stone-800">
                            Últimas ventas de tags
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-700 bg-green-100 text-green-700 border border-green-200">
                            {stats.tags_vendidos} vendidos
                        </span>
                    </div>
                    <PaginatedPanel
                        items={stats.ultimas_ventas}
                        emptyText="No hay ventas registradas aún."
                        renderItem={(venta) => (
                            <div key={venta.id} className="panel-item">
                                <div>
                                    <p className="item-name">
                                        Tag #{venta.codigo}
                                    </p>
                                    <p className="item-sub">
                                        {new Date(
                                            venta.created_at,
                                        ).toLocaleDateString("es-MX", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </p>
                                </div>
                                <span className="badge badge-sold">
                                    Vendido
                                </span>
                            </div>
                        )}
                    />
                </div>
            </div>
        </div>
    );
}
