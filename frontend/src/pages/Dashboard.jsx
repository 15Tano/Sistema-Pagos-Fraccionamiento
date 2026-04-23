import { useState, useEffect, useMemo, useCallback } from "react";
import { getDashboardStats } from "../api/dashboard";
import {
    getAvisos,
    createAviso,
    updateAviso,
    deleteAviso,
} from "../api/avisos";
import useAuthStore from "../store/authStore";

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
                    <div className="flex items-center justify-center h-20 text-sm font-medium text-stone-400">
                        {emptyText}
                    </div>
                ) : (
                    slice.map((item, i) => renderItem(item, i))
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/40">
                    <span className="text-xs font-semibold text-stone-500">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(page * ITEMS_PER_PAGE, items.length)} de{" "}
                        {items.length}
                    </span>
                    <div className="flex gap-1.5 items-center">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="w-7 h-7 rounded-lg border border-white/60 bg-white/40 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] text-stone-600 text-sm font-bold flex items-center justify-center hover:bg-white/60 active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all"
                        >
                            ‹
                        </button>

                        {getPageNumbers().map((p, i) =>
                            p === "..." ? (
                                <span
                                    key={`ellipsis-${i}`}
                                    className="w-6 text-center text-xs font-bold text-stone-400"
                                >
                                    …
                                </span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-all active:scale-95
                                        ${
                                            page === p
                                                ? "bg-gradient-to-b from-orange-400 to-orange-500 text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_2px_6px_rgba(249,115,22,0.3)] border border-orange-400"
                                                : "border border-white/60 bg-white/40 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] text-stone-600 hover:bg-white/60"
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
                            className="w-7 h-7 rounded-lg border border-white/60 bg-white/40 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] text-stone-600 text-sm font-bold flex items-center justify-center hover:bg-white/60 active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all"
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
    urgente: {
        label: "Urgente",
        dot: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]",
        ring: "ring-red-400/60",
    },
    informativo: {
        label: "Informativo",
        dot: "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]",
        ring: "ring-blue-400/60",
    },
    aviso: {
        label: "Aviso",
        dot: "bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.6)]",
        ring: "ring-yellow-400/60",
    },
    positivo: {
        label: "Positivo",
        dot: "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]",
        ring: "ring-green-400/60",
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
            <div className="relative overflow-hidden flex flex-col min-h-0 p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide">
                        Tablón de Avisos
                    </h3>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow-[0_4px_10px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)] active:scale-95 transition-all"
                    >
                        <svg
                            className="w-3.5 h-3.5 drop-shadow-sm"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Nuevo
                    </button>
                </div>

                <div className="flex flex-col gap-2 relative z-10 overflow-y-auto">
                    {avisos.length === 0 ? (
                        <div className="flex items-center justify-center h-16 text-sm font-medium text-stone-400">
                            Sin avisos publicados
                        </div>
                    ) : (
                        avisos.map((aviso) => {
                            const cfg =
                                TIPO_CONFIG_ADMIN[aviso.tipo] ||
                                TIPO_CONFIG_ADMIN.informativo;
                            return (
                                <div
                                    key={aviso.id}
                                    className="flex items-center gap-3 p-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] hover:bg-white/70 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span
                                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`}
                                        />
                                        <p className="text-sm font-bold text-stone-800 truncate drop-shadow-sm">
                                            {aviso.titulo}
                                        </p>
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ring-1 ${cfg.ring} text-stone-600 bg-white/50 shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]`}
                                        >
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {/* Editar */}
                                        <button
                                            onClick={() => openEdit(aviso)}
                                            className="p-2 text-stone-400 hover:text-orange-500 hover:bg-orange-50/50 rounded-xl transition-all active:scale-95"
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
                                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                />
                                            </svg>
                                        </button>
                                        {/* Borrar */}
                                        <button
                                            onClick={() =>
                                                handleDelete(aviso.id)
                                            }
                                            className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50/50 rounded-xl transition-all active:scale-95"
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

            {/* ── Modal crear/editar (Liquid Glass) ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowModal(false)}
                    />

                    {/* Modal */}
                    <div className="relative w-full max-w-md bg-white/60 backdrop-blur-2xl border-t border-l border-white/80 border-r border-b border-white/40 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.8)] p-8 z-10 transform transition-all scale-100">
                        <h3 className="text-xl font-bold text-stone-800 mb-6 drop-shadow-sm">
                            {editing ? "Editar aviso" : "Nuevo aviso"}
                        </h3>

                        <div className="space-y-4">
                            {/* Título */}
                            <input
                                type="text"
                                placeholder="Título"
                                value={form.titulo}
                                onChange={(e) =>
                                    setForm({ ...form, titulo: e.target.value })
                                }
                                className="w-full px-4 py-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.02)] focus:outline-none focus:bg-white/60 focus:ring-4 focus:ring-orange-500/20 focus:border-orange-400 transition-all font-semibold text-stone-700"
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
                                className="w-full px-4 py-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.02)] focus:outline-none focus:bg-white/60 focus:ring-4 focus:ring-orange-500/20 focus:border-orange-400 transition-all font-medium text-stone-600 resize-none"
                            />

                            {/* Selector de tipo con círculos de color */}
                            <div className="p-4 bg-white/30 backdrop-blur-sm rounded-2xl border border-white/50">
                                <p className="text-xs font-bold text-stone-500 mb-3 uppercase tracking-wide">
                                    Prioridad
                                </p>
                                <div className="flex gap-4 justify-around">
                                    {TIPOS.map((tipo) => {
                                        const cfg = TIPO_CONFIG_ADMIN[tipo];
                                        const selected = form.tipo === tipo;
                                        return (
                                            <button
                                                key={tipo}
                                                onClick={() =>
                                                    setForm({ ...form, tipo })
                                                }
                                                className="flex flex-col items-center gap-2 group outline-none"
                                                title={cfg.label}
                                            >
                                                <span
                                                    className={`w-8 h-8 rounded-full ${cfg.dot} transition-all duration-300 ${
                                                        selected
                                                            ? `ring-4 ring-offset-2 ring-offset-transparent ${cfg.ring} scale-110`
                                                            : "opacity-50 group-hover:opacity-80 group-hover:scale-105"
                                                    }`}
                                                />
                                                <span
                                                    className={`text-[10px] uppercase tracking-wide transition-all ${
                                                        selected
                                                            ? "text-stone-800 font-bold"
                                                            : "text-stone-400 font-medium"
                                                    }`}
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
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-stone-600 bg-white/40 backdrop-blur-sm border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] hover:bg-white/70 active:scale-95 transition-all"
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
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 shadow-[0_4px_15px_rgba(249,115,22,0.3),inset_0_2px_4px_rgba(255,255,255,0.4)] disabled:opacity-50 disabled:shadow-none disabled:transform-none active:scale-95 transition-all"
                            >
                                {saving
                                    ? "Guardando..."
                                    : editing
                                      ? "Guardar cambios"
                                      : "Publicar aviso"}
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
    const { user } = useAuthStore();
    const esCapturista = user?.role === "capturista";

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
                <div className="relative overflow-hidden p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem] group hover:bg-white/50 transition-colors">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1 drop-shadow-sm">
                        Recaudado en {mesFormateado}
                    </p>
                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-500 to-orange-600 drop-shadow-sm">
                        ${stats.total_recaudado.toLocaleString("es-MX")}
                    </p>
                    <p className="text-[11px] font-semibold text-stone-400 mt-2">
                        {stats.total_vecinos - stats.vecinos_pendientes} vecinos
                        pagaron
                    </p>
                    <div className="absolute top-5 right-5 text-orange-400/30 group-hover:text-orange-400/50 group-hover:scale-110 transition-all duration-500">
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
                    </div>
                </div>

                {/* Pendientes */}
                <div className="relative overflow-hidden p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem] group hover:bg-white/50 transition-colors">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1 drop-shadow-sm">
                        Pendientes de pago
                    </p>
                    <p className="text-3xl font-black text-stone-700 drop-shadow-sm">
                        {stats.vecinos_pendientes}
                    </p>
                    <p className="text-[11px] font-semibold text-stone-400 mt-2">
                        de {stats.total_vecinos} vecinos totales
                    </p>
                    <div className="absolute top-5 right-5 text-stone-400/30 group-hover:text-stone-500/40 group-hover:scale-110 transition-all duration-500">
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
                    </div>
                </div>

                {/* Tags */}
                <div className="relative overflow-hidden p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem] group hover:bg-white/50 transition-colors">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1 drop-shadow-sm">
                        Tags vendidos
                    </p>
                    <p className="text-3xl font-black text-stone-700 drop-shadow-sm">
                        {stats.tags_vendidos}
                    </p>
                    <p className="text-[11px] font-semibold text-stone-400 mt-2">
                        {stats.tags_en_stock} en stock
                    </p>
                    <div className="absolute top-5 right-5 text-stone-400/30 group-hover:text-stone-500/40 group-hover:scale-110 transition-all duration-500">
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
                    </div>
                </div>
            </div>

            {/* ── Paneles inferiores ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                {/* Morosos */}
                <div className="relative overflow-hidden flex flex-col min-h-0 p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide">
                            Sin pagar este mes
                        </h3>
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-orange-100/60 text-orange-700 border border-orange-200/60 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                            {stats.morosos.length} vecinos
                        </span>
                    </div>
                    <div className="relative z-10 flex-1 overflow-y-auto">
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
                    </div>
                </div>

                {/* Últimas ventas */}
                <div className="relative overflow-hidden flex flex-col min-h-0 p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide">
                            Últimas ventas de tags
                        </h3>
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-green-100/60 text-green-700 border border-green-200/60 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                            {stats.tags_vendidos} vendidos
                        </span>
                    </div>
                    <div className="relative z-10 flex-1 overflow-y-auto">
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
                                            {new Date(
                                                venta.created_at,
                                            ).toLocaleDateString("es-MX", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </p>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-green-100/60 text-green-700 border border-green-200/60 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                                        Vendido
                                    </span>
                                </div>
                            )}
                        />
                    </div>
                </div>

                {/* 📍 Panel de Avisos (Cambio solicitado) */}
                <div className="md:col-span-2 lg:col-span-1">
                    <AvisosAdmin />
                </div>
            </div>
        </div>
    );
}
