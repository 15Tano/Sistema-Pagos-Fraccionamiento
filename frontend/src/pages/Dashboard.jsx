import { useState, useEffect, useMemo, useCallback } from "react";
import { getDashboardStats } from "../api/dashboard";
import {
    getAvisos,
    createAviso,
    updateAviso,
    deleteAviso,
} from "../api/avisos";

const ITEMS_PER_PAGE = 10;

function PaginatedPanel({ items, renderItem, emptyText }) {
    const [page, setPage] = useState(1);
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const slice = items.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE,
    );

    useEffect(() => setPage(1), [items.length]);

    // Genera array de páginas visibles con ellipsis
    const getPageNumbers = () => {
        if (totalPages <= 5) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages = [];
        if (page <= 3) {
            pages.push(1, 2, 3, 4, "...", totalPages);
        } else if (page >= totalPages - 2) {
            pages.push(
                1,
                "...",
                totalPages - 3,
                totalPages - 2,
                totalPages - 1,
                totalPages,
            );
        } else {
            pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
        }
        return pages;
    };

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
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-black/06">
                    <span className="text-xs text-stone-400">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(page * ITEMS_PER_PAGE, items.length)} de{" "}
                        {items.length}
                    </span>
                    <div className="flex gap-1 items-center">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="w-6 h-6 rounded-md border border-black/10 bg-white/60 text-stone-600 text-xs font-semibold flex items-center justify-center hover:bg-white disabled:opacity-30 transition"
                        >
                            ‹
                        </button>

                        {getPageNumbers().map((p, i) =>
                            p === "..." ? (
                                <span
                                    key={`ellipsis-${i}`}
                                    className="w-6 text-center text-xs text-stone-400"
                                >
                                    …
                                </span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-6 h-6 rounded-md text-xs font-semibold flex items-center justify-center transition
                                        ${
                                            page === p
                                                ? "bg-orange-500 text-white border border-orange-500"
                                                : "border border-black/10 bg-white/60 text-stone-600 hover:bg-white"
                                        }`}
                                >
                                    {p}
                                </button>
                            ),
                        )}

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

const TIPO_CONFIG_ADMIN = {
    urgente: { label: "Urgente", dot: "bg-red-500", ring: "ring-red-400" },
    informativo: {
        label: "Informativo",
        dot: "bg-blue-500",
        ring: "ring-blue-400",
    },
    aviso: { label: "Aviso", dot: "bg-yellow-500", ring: "ring-yellow-400" },
    positivo: {
        label: "Positivo",
        dot: "bg-green-500",
        ring: "ring-green-400",
    },
};

const TIPOS = ["urgente", "informativo", "aviso", "positivo"];

function AvisosAdmin() {
    const [avisos, setAvisos] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null); // aviso a editar o null para crear
    const [form, setForm] = useState({
        titulo: "",
        descripcion: "",
        tipo: "informativo",
    });
    const [saving, setSaving] = useState(false);

    const fetchAvisos = useCallback(async () => {
        try {
            const res = await getAvisos();
            setAvisos(res.data || []);
        } catch {}
    }, []);

    useEffect(() => {
        fetchAvisos();
    }, [fetchAvisos]);

    const openCreate = () => {
        setEditing(null);
        setForm({ titulo: "", descripcion: "", tipo: "informativo" });
        setShowModal(true);
    };

    const openEdit = (aviso) => {
        setEditing(aviso);
        setForm({
            titulo: aviso.titulo,
            descripcion: aviso.descripcion,
            tipo: aviso.tipo,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.titulo.trim() || !form.descripcion.trim()) return;
        setSaving(true);
        try {
            if (editing) {
                await updateAviso(editing.id, form);
            } else {
                await createAviso(form);
            }
            setShowModal(false);
            fetchAvisos();
        } catch {
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Eliminar este aviso?")) return;
        try {
            await deleteAviso(id);
            fetchAvisos();
        } catch {}
    };

    return (
        <>
            {/* ── Feed de avisos ── */}
            <div className="glass-card flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-700 text-stone-800">
                        Tablón de Avisos
                    </h3>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-600 rounded-lg transition"
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
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Nuevo
                    </button>
                </div>

                <div className="flex flex-col gap-1.5">
                    {avisos.length === 0 ? (
                        <div className="flex items-center justify-center h-16 text-sm text-stone-400">
                            Sin avisos publicados
                        </div>
                    ) : (
                        avisos.map((aviso) => {
                            const cfg =
                                TIPO_CONFIG_ADMIN[aviso.tipo] ||
                                TIPO_CONFIG_ADMIN.informativo;
                            return (
                                <div key={aviso.id} className="panel-item">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span
                                            className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}
                                        />
                                        <p className="item-name truncate">
                                            {aviso.titulo}
                                        </p>
                                        <span
                                            className={`px-1.5 py-0.5 rounded-full text-xs font-600 ring-1 ${cfg.ring} text-stone-600 shrink-0`}
                                        >
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {/* Editar */}
                                        <button
                                            onClick={() => openEdit(aviso)}
                                            className="p-1.5 text-stone-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition"
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
                                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                />
                                            </svg>
                                        </button>
                                        {/* Borrar */}
                                        <button
                                            onClick={() =>
                                                handleDelete(aviso.id)
                                            }
                                            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
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
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Modal crear/editar ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={() => setShowModal(false)}
                    />

                    {/* Modal */}
                    <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/70 rounded-2xl shadow-2xl p-6 z-10">
                        <h3 className="text-base font-700 text-stone-800 mb-4">
                            {editing ? "Editar aviso" : "Nuevo aviso"}
                        </h3>

                        <div className="space-y-3">
                            {/* Título */}
                            <input
                                type="text"
                                placeholder="Título"
                                value={form.titulo}
                                onChange={(e) =>
                                    setForm({ ...form, titulo: e.target.value })
                                }
                                className="vecino-input w-full"
                            />

                            {/* Descripción */}
                            <textarea
                                rows={3}
                                placeholder="Descripción del aviso..."
                                value={form.descripcion}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        descripcion: e.target.value,
                                    })
                                }
                                className="vecino-input w-full resize-none"
                            />

                            {/* Selector de tipo con círculos de color */}
                            <div>
                                <p className="text-xs text-stone-500 mb-2">
                                    Prioridad
                                </p>
                                <div className="flex gap-3">
                                    {TIPOS.map((tipo) => {
                                        const cfg = TIPO_CONFIG_ADMIN[tipo];
                                        const selected = form.tipo === tipo;
                                        return (
                                            <button
                                                key={tipo}
                                                onClick={() =>
                                                    setForm({ ...form, tipo })
                                                }
                                                className="flex flex-col items-center gap-1"
                                                title={cfg.label}
                                            >
                                                <span
                                                    className={`w-7 h-7 rounded-full ${cfg.dot} transition-all ${
                                                        selected
                                                            ? `ring-2 ring-offset-2 ${cfg.ring} scale-110`
                                                            : "opacity-40 hover:opacity-70"
                                                    }`}
                                                />
                                                <span
                                                    className={`text-xs ${selected ? "text-stone-700 font-600" : "text-stone-400"}`}
                                                >
                                                    {cfg.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2 rounded-xl text-sm font-600 text-stone-600 bg-white/60 border border-black/08 hover:bg-white transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={
                                    saving ||
                                    !form.titulo.trim() ||
                                    !form.descripcion.trim()
                                }
                                className="flex-1 py-2 rounded-xl text-sm font-700 text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition"
                            >
                                {saving
                                    ? "Guardando..."
                                    : editing
                                      ? "Guardar cambios"
                                      : "Publicar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
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
                {/* 📍 Panel de Avisos (Cambio solicitado) */}
                <div className="md:col-span-2 lg:col-span-1">
                    <AvisosAdmin />
                </div>
            </div>
        </div>
    );
}
