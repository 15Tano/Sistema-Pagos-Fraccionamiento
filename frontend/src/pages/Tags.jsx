import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import api from "../lib/axios";
import {
    getTags,
    createTag,
    getTagSales,
    createTagSale,
    deleteTagSale,
} from "../api/tags";
import useAuthStore from "../store/authStore";

// ─── Icono centralizado ───────────────────────────────────────────────────────
const Icon = {
    tag: (cls = "w-5 h-5") => (
        <svg
            className={cls}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
        </svg>
    ),
    cart: (cls = "w-5 h-5") => (
        <svg
            className={cls}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
        </svg>
    ),
    plus: (cls = "w-4 h-4") => (
        <svg
            className={cls}
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
    ),
    lock: (cls = "w-4 h-4") => (
        <svg
            className={cls}
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
    ),
    unlock: (cls = "w-4 h-4") => (
        <svg
            className={cls}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            />
        </svg>
    ),
    trash: (cls = "w-4 h-4") => (
        <svg
            className={cls}
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
    ),
    search: (cls = "w-4 h-4") => (
        <svg
            className={cls}
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
    ),
    check: (cls = "w-4 h-4") => (
        <svg
            className={cls}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
            />
        </svg>
    ),
    x: (cls = "w-4 h-4") => (
        <svg
            className={cls}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
            />
        </svg>
    ),
    trendUp: (cls = "w-4 h-4") => (
        <svg
            className={cls}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
        </svg>
    ),
    trendDown: (cls = "w-4 h-4") => (
        <svg
            className={cls}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
            />
        </svg>
    ),
    user: (cls = "w-4 h-4") => (
        <svg
            className={cls}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
        </svg>
    ),
    inventory: (cls = "w-5 h-5") => (
        <svg
            className={cls}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
        </svg>
    ),
    chart: (cls = "w-5 h-5") => (
        <svg
            className={cls}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
        </svg>
    ),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatSoldAt(soldAt) {
    if (!soldAt) return "Sin fecha";
    const raw = /^\d{4}-\d{2}-\d{2}$/.test(soldAt)
        ? `${soldAt}T12:00:00`
        : soldAt;
    return new Date(raw).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

// ─── PIN de inyección de stock (hardcoded, solo admin) ────────────────────────
const STOCK_PIN = "1234";

// ─── Panel: Inyección de inventario ──────────────────────────────────────────
function StockInjectionPanel({ onDone, onError }) {
    const [unlocked, setUnlocked] = useState(false);
    const [pin, setPin] = useState("");
    const [pinErr, setPinErr] = useState(false);
    const [codes, setCodes] = useState("");
    const [saving, setSaving] = useState(false);
    const [results, setResults] = useState([]);

    const handleUnlock = () => {
        if (pin === STOCK_PIN) {
            setUnlocked(true);
            setPinErr(false);
            setPin("");
        } else setPinErr(true);
    };

    const handleInject = useCallback(async () => {
        const list = codes
            .split(/[\n,]+/)
            .map((c) => c.trim())
            .filter(Boolean);
        if (!list.length) return;
        setSaving(true);
        setResults([]);

        const settled = await Promise.allSettled(
            list.map((codigo) =>
                createTag(codigo).then(() => ({ codigo, ok: true })),
            ),
        );

        setResults(
            settled.map((r, i) => ({
                codigo: list[i],
                ok: r.status === "fulfilled",
                msg:
                    r.status === "rejected"
                        ? r.reason?.response?.data?.message ||
                          "Ya existe o error"
                        : "Registrado",
            })),
        );
        setSaving(false);
        setCodes("");
        onDone();
    }, [codes, onDone]);

    return (
        <div className="relative overflow-hidden p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                    <span className="text-orange-400">{Icon.inventory()}</span>
                    <h3 className="text-sm font-semibold text-stone-800">
                        Inyección de Inventario
                    </h3>
                </div>
                <span
                    className={`flex items-center gap-1 text-xs font-semibold ${unlocked ? "text-green-600" : "text-stone-400"}`}
                >
                    {unlocked ? Icon.unlock() : Icon.lock()}
                    {unlocked ? "Desbloqueado" : "Protegido"}
                </span>
            </div>

            <div className="relative z-10">
                {!unlocked ? (
                    <div className="flex gap-2">
                        <input
                            type="password"
                            placeholder="PIN de administrador"
                            value={pin}
                            onChange={(e) => {
                                setPin(e.target.value);
                                setPinErr(false);
                            }}
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleUnlock()
                            }
                            className={`flex-1 px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-sm transition-all ${pinErr ? "border-red-400 focus:border-red-400" : "focus:border-orange-400"}`}
                        />
                        <button
                            onClick={handleUnlock}
                            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 text-white text-sm font-semibold rounded-xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)] active:scale-95 transition-all"
                        >
                            Entrar
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-stone-500 font-medium">
                            Un código por línea o separados por coma. Se
                            registran como disponibles (sin vender).
                        </p>
                        <textarea
                            rows={3}
                            placeholder={"TAG001\nTAG002\nTAG003"}
                            value={codes}
                            onChange={(e) => setCodes(e.target.value)}
                            className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 font-mono resize-none transition-all"
                        />
                        <button
                            onClick={handleInject}
                            disabled={saving || !codes.trim()}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-[0_4px_10px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)] active:scale-95 transition-all"
                        >
                            {Icon.plus()}
                            {saving
                                ? "Registrando..."
                                : "Registrar en inventario"}
                        </button>

                        {results.length > 0 && (
                            <div className="space-y-1.5 pt-4 mt-2 border-t border-white/40">
                                {results.map((r) => (
                                    <div
                                        key={r.codigo}
                                        className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] border ${r.ok ? "bg-green-100/60 border-green-200/60 text-green-700" : "bg-red-100/60 border-red-200/60 text-red-600"}`}
                                    >
                                        {r.ok ? Icon.check() : Icon.x()}
                                        <span className="font-mono font-medium">
                                            {r.codigo}
                                        </span>
                                        <span className="text-stone-400/50">
                                            —
                                        </span>
                                        <span className="font-medium">
                                            {r.msg}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Panel: Buscador de vecinos + venta ───────────────────────────────────────
function SellTagPanel({ unsoldTags, onSold, onError }) {
    const [query, setQuery] = useState("");
    const [resultados, setResultados] = useState([]);
    const [selected, setSelected] = useState(null);
    const [tagId, setTagId] = useState("");
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [selling, setSelling] = useState(false);
    const debounceRef = useRef(null);

    const handleQuery = useCallback((val) => {
        setQuery(val);
        setSelected(null);
        setTagId("");
        clearTimeout(debounceRef.current);
        if (!val.trim()) {
            setResultados([]);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setLoadingSearch(true);
            try {
                const res = await api.get(
                    `/vecinos?search=${encodeURIComponent(val)}&per_page=7`,
                );
                setResultados(res.data.data || []);
            } catch {
                setResultados([]);
            } finally {
                setLoadingSearch(false);
            }
        }, 200);
    }, []);

    const handleSelect = useCallback((v) => {
        setSelected(v);
        setQuery(v.nombre);
        setResultados([]);
        setTagId("");
    }, []);

    const handleSell = useCallback(async () => {
        if (!tagId || !selected) return;
        setSelling(true);
        try {
            // CORRECCIÓN BUGS: Aquí se envía el tagId Y el vecino_id (selected.id)
            await createTagSale(Number(tagId), selected.id);
            onSold(`Tag vendido a ${selected.nombre} — $150`);
            setSelected(null);
            setQuery("");
            setTagId("");
        } catch (e) {
            onError(e.response?.data?.error || "Error al registrar la venta");
        } finally {
            setSelling(false);
        }
    }, [tagId, selected, onSold, onError]);

    return (
        <div className="relative overflow-visible p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            <div className="flex items-center gap-2 mb-5 relative z-10">
                <span className="text-orange-400">{Icon.cart()}</span>
                <h3 className="text-sm font-semibold text-stone-800">
                    Vender Tag
                </h3>
                <span className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-orange-100/60 border border-orange-200/60 text-orange-700 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                    {unsoldTags.length} disponibles · $150 c/u
                </span>
            </div>

            <div className="relative z-10">
                {/* Buscador */}
                <div className="relative mb-4">
                    <label className="block text-xs font-medium text-stone-500 mb-1.5 ml-1">
                        Buscar vecino por nombre o casa
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                            {Icon.search()}
                        </span>
                        <input
                            type="text"
                            placeholder="Ej: García o Casa 14..."
                            value={query}
                            onChange={(e) => handleQuery(e.target.value)}
                            className="w-full pl-9 pr-10 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-700 placeholder-stone-400 transition-all"
                        />
                        {loadingSearch && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                <svg
                                    className="w-4 h-4 animate-spin text-orange-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8z"
                                    />
                                </svg>
                            </span>
                        )}
                    </div>

                    {/* Dropdown resultados */}
                    {resultados.length > 0 && (
                        <ul className="absolute z-30 w-full mt-1.5 bg-white/90 backdrop-blur-xl border border-white/80 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden max-h-60 overflow-y-auto">
                            {resultados.map((v) => (
                                <li key={v.uuid}>
                                    <button
                                        onClick={() => handleSelect(v)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50/80 transition-colors text-left border-b border-black/5 last:border-0"
                                    >
                                        <span className="text-stone-400/70">
                                            {Icon.user()}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-stone-800 truncate">
                                                {v.nombre}
                                            </p>
                                            <p className="text-xs font-medium text-stone-500 mt-0.5">
                                                {v.calle} #{v.numero_casa}
                                            </p>
                                        </div>
                                        {v.tags?.length > 0 && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 bg-orange-100/50 px-2 py-0.5 rounded-md shrink-0">
                                                {v.tags.length} tag
                                                {v.tags.length > 1 ? "s" : ""}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Vecino seleccionado */}
                {selected && (
                    <div className="rounded-2xl bg-white/50 border border-white/80 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_10px_rgba(0,0,0,0.02)] p-5 space-y-4 transition-all">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-semibold text-stone-800">
                                    {selected.nombre}
                                </p>
                                <p className="text-xs font-medium text-stone-500 mt-0.5">
                                    {selected.calle} #{selected.numero_casa}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelected(null);
                                    setQuery("");
                                }}
                                className="text-stone-400 hover:text-stone-600 bg-white/50 p-1.5 rounded-lg border border-stone-200/50 hover:bg-white transition-all"
                            >
                                {Icon.x()}
                            </button>
                        </div>

                        {/* Tags actuales */}
                        {selected.tags?.length > 0 && (
                            <div>
                                <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-2">
                                    Tags actuales vinculados:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {selected.tags.map((t) => (
                                        <span
                                            key={t.id}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] border ${
                                                t.activo
                                                    ? "bg-green-100/60 text-green-700 border-green-200/60"
                                                    : "bg-red-100/60 text-red-700 border-red-200/60"
                                            }`}
                                        >
                                            {t.codigo}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Selector de tag */}
                        <div>
                            <select
                                value={tagId}
                                onChange={(e) => setTagId(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-700 transition-all cursor-pointer"
                            >
                                <option value="">
                                    Seleccionar un tag del inventario...
                                </option>
                                {unsoldTags.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.codigo}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={handleSell}
                            disabled={!tagId || selling}
                            className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 disabled:opacity-50 disabled:shadow-none text-white text-sm font-semibold rounded-xl shadow-[0_4px_10px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)] transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            {Icon.cart()}
                            {selling
                                ? "Registrando Venta..."
                                : "Confirmar venta — $150"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Panel: Ventas recientes ──────────────────────────────────────────────────
const ITEMS_PER_PAGE = 15;

function RecentSalesPanel({ sales, onDelete }) {
    const [page, setPage] = useState(1);

    // CORRECCIÓN BUGS: Se ordena el arreglo de más reciente a más viejo antes de paginar.
    const sortedSales = useMemo(() => {
        return [...sales].sort((a, b) => {
            const dateA = new Date(a.sold_at || a.created_at);
            const dateB = new Date(b.sold_at || b.created_at);
            return dateB - dateA;
        });
    }, [sales]);

    const totalPages = Math.ceil(sortedSales.length / ITEMS_PER_PAGE);

    const slice = useMemo(
        () =>
            sortedSales.slice(
                (page - 1) * ITEMS_PER_PAGE,
                page * ITEMS_PER_PAGE,
            ),
        [sortedSales, page],
    );

    useEffect(() => setPage(1), [sortedSales.length]);

    const getPageNumbers = () => {
        if (totalPages <= 5)
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages = [];
        if (page <= 3) pages.push(1, 2, 3, 4, "...", totalPages);
        else if (page >= totalPages - 2)
            pages.push(
                1,
                "...",
                totalPages - 3,
                totalPages - 2,
                totalPages - 1,
                totalPages,
            );
        else pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
        return pages;
    };

    return (
        <div className="relative overflow-hidden flex flex-col min-h-0 p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-2">
                    <span className="text-orange-400">{Icon.chart()}</span>
                    <h3 className="text-sm font-semibold text-stone-800">
                        Ventas Recientes
                    </h3>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-green-100/60 border border-green-200/60 text-green-700 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                    {sales.length} vendidos
                </span>
            </div>

            <div className="flex flex-col gap-2 flex-1 relative z-10 overflow-y-auto">
                {slice.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-sm font-medium text-stone-400">
                        No hay ventas registradas aún.
                    </div>
                ) : (
                    slice.map((sale) => (
                        <div
                            key={sale.id}
                            className="flex items-center justify-between p-3 bg-white/50 backdrop-blur-sm border border-white/60 rounded-2xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] hover:bg-white/70 transition-colors"
                        >
                            <div>
                                <p className="text-sm font-semibold text-stone-800">
                                    {sale.tag?.codigo ?? `Tag #${sale.tag_id}`}
                                </p>
                                <p className="text-xs font-medium text-stone-500 mt-0.5">
                                    {formatSoldAt(sale.sold_at)}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-lg border bg-stone-100/50 border-stone-200/60 text-stone-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                                    ${parseFloat(sale.price || 150).toFixed(0)}
                                </span>
                                <button
                                    onClick={() => onDelete(sale.id)}
                                    className="p-1.5 text-stone-400 hover:text-red-500 bg-white/50 border border-stone-200/50 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all"
                                    title="Eliminar venta"
                                >
                                    {Icon.trash()}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/40 relative z-10">
                    <span className="text-xs font-medium text-stone-500">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(page * ITEMS_PER_PAGE, sortedSales.length)} de{" "}
                        {sortedSales.length}
                    </span>
                    <div className="flex gap-1.5 items-center">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="w-7 h-7 rounded-lg border border-white/60 bg-white/40 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] text-stone-600 text-sm font-medium flex items-center justify-center hover:bg-white/60 active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all"
                        >
                            ‹
                        </button>
                        {getPageNumbers().map((p, i) =>
                            p === "..." ? (
                                <span
                                    key={`e-${i}`}
                                    className="w-5 text-center text-xs text-stone-400 font-medium"
                                >
                                    …
                                </span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-all active:scale-95 ${
                                        page === p
                                            ? "bg-gradient-to-b from-orange-400 to-orange-500 text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_2px_6px_rgba(249,115,22,0.3)] border border-orange-400"
                                            : "border border-white/60 bg-white/40 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] text-stone-600 hover:bg-white/60"
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
                            className="w-7 h-7 rounded-lg border border-white/60 bg-white/40 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] text-stone-600 text-sm font-medium flex items-center justify-center hover:bg-white/60 active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all"
                        >
                            ›
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Tags() {
    const [tags, setTags] = useState([]);
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const { user } = useAuthStore();
    const esCapturista = user?.role === "capturista";

    const showToast = useCallback((msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [tagsRes, salesRes] = await Promise.all([
                getTags(),
                getTagSales(),
            ]);

            const tagsData = Array.isArray(tagsRes.data)
                ? tagsRes.data
                : tagsRes.data?.data || [];
            const salesData = Array.isArray(salesRes.data)
                ? salesRes.data
                : salesRes.data?.data || [];

            setTags(tagsData);
            setSales(salesData);
        } catch {
            showToast("Error al cargar los datos", "error");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const unsoldTags = useMemo(() => {
        const soldIds = new Set(sales.map((s) => s.tag_id));
        return tags.filter((t) => !soldIds.has(t.id));
    }, [tags, sales]);

    const kpi = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const lastMonthDate = new Date();
        lastMonthDate.setMonth(now.getMonth() - 1);
        const prevMonth = lastMonthDate.getMonth();
        const prevYear = lastMonthDate.getFullYear();

        const totalAcumulado = sales.reduce(
            (s, x) => s + parseFloat(x.price || 150),
            0,
        );

        const ventasMesActual = sales
            .filter((s) => {
                const date = new Date(s.sold_at || s.created_at);
                return (
                    date.getMonth() === currentMonth &&
                    date.getFullYear() === currentYear
                );
            })
            .reduce((s, x) => s + parseFloat(x.price || 150), 0);

        const ventasMesAnterior = sales
            .filter((s) => {
                const date = new Date(s.sold_at || s.created_at);
                return (
                    date.getMonth() === prevMonth &&
                    date.getFullYear() === prevYear
                );
            })
            .reduce((s, x) => s + parseFloat(x.price || 150), 0);

        const diff = ventasMesActual - ventasMesAnterior;
        const pct =
            ventasMesAnterior > 0
                ? ((diff / ventasMesAnterior) * 100).toFixed(1)
                : ventasMesActual > 0
                  ? "100"
                  : "0";

        const tendencia = diff > 0 ? "up" : diff < 0 ? "down" : "equal";

        return {
            totalAcumulado,
            ventasMesActual,
            ventasMesAnterior,
            pct,
            tendencia,
        };
    }, [sales]);

    const handleDeleteSale = useCallback(
        async (saleId) => {
            if (!window.confirm("¿Eliminar esta venta?")) return;
            try {
                await deleteTagSale(saleId);
                showToast("Venta eliminada");
                fetchData();
            } catch (error) {
                // Aquí le decimos a React que muestre el error del backend, no el texto genérico
                showToast(
                    error.response?.data?.error || "Error al eliminar la venta",
                    "error",
                );
            }
        },
        [showToast, fetchData],
    );

    if (loading)
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin drop-shadow-md" />
                    <span className="text-stone-500 text-sm font-medium tracking-wide">
                        Cargando tags...
                    </span>
                </div>
            </div>
        );

    return (
        <div className="flex flex-col gap-5 h-full pb-20 md:pb-0">
            {/* Toast global */}
            {toast && (
                <div
                    className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border text-sm font-medium transition-all backdrop-blur-md ${
                        toast.type === "error"
                            ? "bg-red-50/90 border-red-200 text-red-700"
                            : "bg-green-50/90 border-green-200 text-green-700"
                    }`}
                >
                    {toast.type === "error" ? Icon.x() : Icon.check()}
                    {toast.msg}
                </div>
            )}

            {/* ── KPI Cards ── */}
            {!esCapturista && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Stock */}
                    <div className="relative overflow-hidden p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem] group hover:bg-white/50 transition-colors">
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1 drop-shadow-sm">
                            Stock disponible
                        </p>
                        <p className="text-3xl font-bold text-orange-500 drop-shadow-sm">
                            {unsoldTags.length}
                        </p>
                        <p className="text-[11px] font-medium text-stone-400 mt-2">
                            {sales.length} tags vendidos en total
                        </p>
                        <div className="absolute top-5 right-5 text-orange-400/30 group-hover:text-orange-400/50 group-hover:scale-110 transition-all duration-500">
                            {Icon.tag("w-12 h-12")}
                        </div>
                    </div>

                    {/* Ingresos acumulados */}
                    <div className="relative overflow-hidden p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem] group hover:bg-white/50 transition-colors">
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1 drop-shadow-sm">
                            Ingresos acumulados
                        </p>
                        <p className="text-3xl font-bold text-orange-500 drop-shadow-sm">
                            ${kpi.totalAcumulado.toLocaleString("es-MX")}
                        </p>
                        <p className="text-[11px] font-medium text-stone-400 mt-2">
                            en ventas de tags
                        </p>
                        <div className="absolute top-5 right-5 text-orange-400/30 group-hover:text-orange-400/50 group-hover:scale-110 transition-all duration-500">
                            {Icon.cart("w-12 h-12")}
                        </div>
                    </div>

                    {/* Mes actual vs anterior */}
                    <div className="relative overflow-hidden p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem] group hover:bg-white/50 transition-colors">
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1 drop-shadow-sm">
                            Este mes en tags
                        </p>
                        <p className="text-3xl font-bold text-orange-500 drop-shadow-sm">
                            ${kpi.ventasMesActual.toLocaleString("es-MX")}
                        </p>
                        <div
                            className={`flex items-center gap-1 text-[11px] font-medium mt-2 ${
                                kpi.tendencia === "up"
                                    ? "text-green-600"
                                    : kpi.tendencia === "down"
                                      ? "text-red-500"
                                      : "text-stone-400"
                            }`}
                        >
                            {kpi.tendencia === "up" && Icon.trendUp()}
                            {kpi.tendencia === "down" && Icon.trendDown()}
                            <span>
                                {kpi.tendencia === "equal"
                                    ? "Sin cambio vs mes anterior"
                                    : `${kpi.tendencia === "up" ? "+" : ""}${kpi.pct}% vs $${kpi.ventasMesAnterior.toLocaleString("es-MX")}`}
                            </span>
                        </div>
                        <div className="absolute top-5 right-5 text-orange-400/30 group-hover:text-orange-400/50 group-hover:scale-110 transition-all duration-500">
                            {Icon.chart("w-12 h-12")}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Contenido principal ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                {/* Columna izquierda: inventario + venta */}
                <div className="flex flex-col gap-4">
                    <StockInjectionPanel
                        onDone={() => {
                            fetchData();
                            showToast("Tags registrados en inventario");
                        }}
                        onError={(msg) => showToast(msg, "error")}
                    />
                    <SellTagPanel
                        unsoldTags={unsoldTags}
                        onSold={(msg) => {
                            fetchData();
                            showToast(msg);
                        }}
                        onError={(msg) => showToast(msg, "error")}
                    />
                </div>

                {/* Columna derecha: historial de ventas */}
                <RecentSalesPanel sales={sales} onDelete={handleDeleteSale} />
            </div>
        </div>
    );
}
