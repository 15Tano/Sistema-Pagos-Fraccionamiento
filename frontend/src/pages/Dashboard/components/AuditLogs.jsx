import { useState, useEffect, useCallback } from "react";
import api from "../../../lib/axios";
import { ACCION_CONFIG } from "../config/auditLogConfig";
import { formatFechaHora } from "../helpers/formatFecha";

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    // --- ESTADOS PARA FILTRO Y BUSCADOR ---
    const [searchTerm, setSearchTerm] = useState("");
    const [accionFilter, setAccionFilter] = useState("");
    // --------------------------------------

    const fetchLogs = useCallback(
        async (p = 1, search = searchTerm, accion = accionFilter) => {
            setLoading(true);
            try {
                // Se agregan los parámetros a la URL
                const res = await api.get(
                    `/audit-logs?page=${p}&search=${search}&accion=${accion}`,
                );
                setLogs(res.data.data || []);
                setLastPage(res.data.last_page || 1);
                setTotal(res.data.total || 0);
                setPage(p);
            } catch {
            } finally {
                setLoading(false);
            }
        },
        [searchTerm, accionFilter],
    ); // Dependencias del useCallback

    useEffect(() => {
        fetchLogs(1, searchTerm, accionFilter);
    }, [fetchLogs, searchTerm, accionFilter]);

    return (
        <div className="relative overflow-hidden flex flex-col min-h-0 p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide">
                    Registro de Actividad
                </h3>
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-stone-100/60 text-stone-600 border border-stone-200/60">
                        {total} registros
                    </span>
                    <button
                        onClick={() => fetchLogs(page)}
                        className="p-1.5 text-stone-400 hover:text-orange-500 hover:bg-orange-50/50 rounded-xl transition-all active:scale-95"
                        title="Actualizar"
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
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ── Buscador y Filtro Liquid Glass ── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 relative z-10">
                {/* Buscador de Texto */}
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Buscar por usuario o acción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:bg-white/60 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all text-sm font-medium text-stone-700 placeholder-stone-400"
                    />
                    <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                </div>

                {/* Filtro Select */}
                <div className="relative shrink-0 sm:w-40">
                    <select
                        value={accionFilter}
                        onChange={(e) => setAccionFilter(e.target.value)}
                        className="w-full pl-4 pr-8 py-2.5 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:bg-white/60 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all text-sm font-bold text-stone-600 appearance-none cursor-pointer"
                    >
                        <option value="">Todas las acciones</option>
                        {Object.keys(ACCION_CONFIG).map((key) => (
                            <option key={key} value={key}>
                                {ACCION_CONFIG[key].label}
                            </option>
                        ))}
                    </select>
                    {/* Flecha personalizada del select */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
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
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Lista */}
            <div className="flex flex-col gap-2 relative z-10 overflow-y-auto flex-1">
                {loading ? (
                    <div className="flex items-center justify-center h-16">
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex items-center justify-center h-16 text-sm font-medium text-stone-400">
                        No se encontraron resultados
                    </div>
                ) : (
                    logs.map((log) => {
                        const cfg =
                            ACCION_CONFIG[log.accion] || ACCION_CONFIG.updated;
                        return (
                            <div
                                key={log.id}
                                className="flex items-start gap-3 p-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] hover:bg-white/70 transition-colors"
                            >
                                <div className="flex flex-col gap-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border backdrop-blur-sm ${cfg.bg} ${cfg.text} ${cfg.border}`}
                                        >
                                            {cfg.label}
                                        </span>
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">
                                            {log.modelo}
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-stone-700 truncate">
                                        <span className="text-orange-600">
                                            {log.user_name || "Sistema"}
                                        </span>
                                        <span className="text-stone-300 mx-1">
                                            →
                                        </span>
                                        <span className="text-stone-600">
                                            {log.modelo_label ||
                                                `#${log.modelo_id}`}
                                        </span>
                                    </p>
                                    <p className="text-[10px] font-semibold text-stone-400">
                                        {formatFechaHora(log.created_at)}
                                        {log.ip ? ` · ${log.ip}` : ""}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Paginación */}
            {lastPage > 1 && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/40 relative z-10">
                    <span className="text-xs font-semibold text-stone-500">
                        Pág. {page} de {lastPage}
                    </span>
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => fetchLogs(page - 1)}
                            disabled={page === 1}
                            className="w-7 h-7 rounded-lg border border-white/60 bg-white/40 backdrop-blur-sm text-stone-600 text-sm font-bold flex items-center justify-center hover:bg-white/60 active:scale-95 disabled:opacity-30 transition-all"
                        >
                            ‹
                        </button>
                        <button
                            onClick={() => fetchLogs(page + 1)}
                            disabled={page === lastPage}
                            className="w-7 h-7 rounded-lg border border-white/60 bg-white/40 backdrop-blur-sm text-stone-600 text-sm font-bold flex items-center justify-center hover:bg-white/60 active:scale-95 disabled:opacity-30 transition-all"
                        >
                            ›
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
