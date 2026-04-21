import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../lib/axios";
import {
    getTags,
    createTag,
    toggleTag,
    getTagSales,
    createTagSale,
    deleteTagSale,
} from "../api/tags";

// ─── Icono centralizado ───────────────────────────────────────────────────────
// SVGs sacados del JSX principal a un objeto para no contaminar el render tree

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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"
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

/**
 * Corrige el bug de desfase de fechas.
 * "2024-03-15" en UTC se renderiza como "14 mar" en zona UTC-6.
 * Solución: si es solo fecha, forzar mediodía local.
 */
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

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonthKey() {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
        <div className="glass-card">
            <div className="glass-card-shine" />
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-orange-400">{Icon.inventory()}</span>
                    <h3 className="text-sm font-700 text-stone-800">
                        Inyección de Inventario
                    </h3>
                </div>
                <span
                    className={`flex items-center gap-1 text-xs font-600 ${unlocked ? "text-green-600" : "text-stone-400"}`}
                >
                    {unlocked ? Icon.unlock() : Icon.lock()}
                    {unlocked ? "Desbloqueado" : "Protegido"}
                </span>
            </div>

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
                        onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                        className={`vecino-input flex-1 ${pinErr ? "border-red-400 ring-1 ring-red-300" : ""}`}
                    />
                    <button
                        onClick={handleUnlock}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-600 rounded-xl transition"
                    >
                        Entrar
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-xs text-stone-500">
                        Un código por línea o separados por coma. Se registran
                        como disponibles (sin vender).
                    </p>
                    <textarea
                        rows={3}
                        placeholder={"TAG001\nTAG002\nTAG003"}
                        value={codes}
                        onChange={(e) => setCodes(e.target.value)}
                        className="vecino-input w-full font-mono resize-none"
                    />
                    <button
                        onClick={handleInject}
                        disabled={saving || !codes.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-600 rounded-xl transition"
                    >
                        {Icon.plus()}
                        {saving ? "Registrando..." : "Registrar en inventario"}
                    </button>

                    {results.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-black/06">
                            {results.map((r) => (
                                <div
                                    key={r.codigo}
                                    className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${r.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
                                >
                                    {r.ok ? Icon.check() : Icon.x()}
                                    <span className="font-mono font-600">
                                        {r.codigo}
                                    </span>
                                    <span className="text-stone-400">—</span>
                                    <span>{r.msg}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
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
        if (!tagId) return;
        setSelling(true);
        try {
            await createTagSale(Number(tagId));
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
        <div className="glass-card relative overflow-visible">
            <div className="glass-card-shine" />
            <div className="flex items-center gap-2 mb-4">
                <span className="text-orange-400">{Icon.cart()}</span>
                <h3 className="text-sm font-700 text-stone-800">Vender Tag</h3>
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-700 bg-orange-100 text-orange-700 border border-orange-200">
                    {unsoldTags.length} disponibles · $150 c/u
                </span>
            </div>

            {/* Buscador */}
            <div className="relative mb-3">
                <label className="block text-xs text-stone-500 mb-1.5">
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
                        className="vecino-input w-full pl-9"
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
                    <ul className="absolute z-30 w-full mt-1 bg-white/95 backdrop-blur-md border border-black/08 rounded-xl shadow-xl overflow-hidden">
                        {resultados.map((v) => (
                            <li key={v.uuid}>
                                <button
                                    onClick={() => handleSelect(v)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors text-left"
                                >
                                    <span className="text-stone-400">
                                        {Icon.user()}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-600 text-stone-800 truncate">
                                            {v.nombre}
                                        </p>
                                        <p className="text-xs text-stone-500">
                                            {v.calle} #{v.numero_casa}
                                        </p>
                                    </div>
                                    {v.tags?.length > 0 && (
                                        <span className="text-xs text-orange-600 font-600 shrink-0">
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
                <div className="rounded-xl bg-orange-50/70 border border-orange-200/60 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-700 text-stone-800">
                                {selected.nombre}
                            </p>
                            <p className="text-xs text-stone-500">
                                {selected.calle} #{selected.numero_casa}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setSelected(null);
                                setQuery("");
                            }}
                            className="text-stone-300 hover:text-stone-500 transition-colors"
                        >
                            {Icon.x()}
                        </button>
                    </div>

                    {/* Tags actuales */}
                    {selected.tags?.length > 0 && (
                        <div>
                            <p className="text-xs text-stone-500 mb-1.5">
                                Tags actuales:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {selected.tags.map((t) => (
                                    <span
                                        key={t.id}
                                        className={`px-2 py-0.5 rounded-full text-xs font-600 ${t.activo ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`}
                                    >
                                        {t.codigo}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Selector de tag */}
                    <select
                        value={tagId}
                        onChange={(e) => setTagId(e.target.value)}
                        className="vecino-input w-full"
                    >
                        <option value="">Seleccionar tag disponible</option>
                        {unsoldTags.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.codigo}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={handleSell}
                        disabled={!tagId || selling}
                        className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-700 rounded-xl transition flex items-center justify-center gap-2"
                    >
                        {Icon.cart()}
                        {selling ? "Registrando..." : "Confirmar venta — $150"}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Panel: Ventas recientes ──────────────────────────────────────────────────
// Reutiliza el mismo patrón de PaginatedPanel del Dashboard

const ITEMS_PER_PAGE = 15;

function RecentSalesPanel({ sales, onDelete }) {
    const [page, setPage] = useState(1);
    const totalPages = Math.ceil(sales.length / ITEMS_PER_PAGE);
    const slice = useMemo(
        () => sales.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
        [sales, page],
    );

    useEffect(() => setPage(1), [sales.length]);

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
        <div className="glass-card flex flex-col min-h-0">
            <div className="glass-card-shine" />
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-orange-400">{Icon.chart()}</span>
                    <h3 className="text-sm font-700 text-stone-800">
                        Ventas Recientes
                    </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-700 bg-green-100 text-green-700 border border-green-200">
                    {sales.length} vendidos
                </span>
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
                {slice.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-sm text-stone-400">
                        No hay ventas registradas aún.
                    </div>
                ) : (
                    slice.map((sale) => (
                        <div key={sale.id} className="panel-item">
                            <div>
                                <p className="item-name">
                                    {sale.tag?.codigo ?? `Tag #${sale.tag_id}`}
                                </p>
                                <p className="item-sub">
                                    {formatSoldAt(sale.sold_at)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="badge badge-sold">
                                    ${parseFloat(sale.price || 150).toFixed(0)}
                                </span>
                                <button
                                    onClick={() => onDelete(sale.id)}
                                    className="p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
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
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-black/06">
                    <span className="text-xs text-stone-400">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(page * ITEMS_PER_PAGE, sales.length)} de{" "}
                        {sales.length}
                    </span>
                    <div className="flex gap-1 items-center">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="w-6 h-6 rounded-md border border-black/10 bg-white/60 text-stone-600 text-xs font-600 flex items-center justify-center hover:bg-white disabled:opacity-30 transition"
                        >
                            ‹
                        </button>
                        {getPageNumbers().map((p, i) =>
                            p === "..." ? (
                                <span
                                    key={`e-${i}`}
                                    className="w-6 text-center text-xs text-stone-400"
                                >
                                    …
                                </span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-6 h-6 rounded-md text-xs font-600 flex items-center justify-center transition ${page === p ? "bg-orange-500 text-white border border-orange-500" : "border border-black/10 bg-white/60 text-stone-600 hover:bg-white"}`}
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
                            className="w-6 h-6 rounded-md border border-black/10 bg-white/60 text-stone-600 text-xs font-600 flex items-center justify-center hover:bg-white disabled:opacity-30 transition"
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
    const [toast, setToast] = useState(null); // { msg, type }

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

            // Protección: Si Laravel manda datos paginados, extraemos solo el arreglo "data"
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

    // Tags que NO tienen venta registrada — disponibles para asignar
    const unsoldTags = useMemo(() => {
        const soldIds = new Set(sales.map((s) => s.tag_id));
        return tags.filter((t) => !soldIds.has(t.id));
    }, [tags, sales]);

    // ── KPI stats calculadas en frontend ──────────────────────────────────────
    // ── KPI stats calculadas en frontend ──────────────────────────────────────
    const kpi = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Mes anterior
        const lastMonthDate = new Date();
        lastMonthDate.setMonth(now.getMonth() - 1);
        const prevMonth = lastMonthDate.getMonth();
        const prevYear = lastMonthDate.getFullYear();

        const totalAcumulado = sales.reduce(
            (s, x) => s + parseFloat(x.price || 150),
            0,
        );

        // Filtrado por comparación de enteros (Mes y Año)
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
            } catch {
                showToast("Error al eliminar la venta", "error");
            }
        },
        [showToast, fetchData],
    );

    if (loading)
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-stone-500 text-sm">
                        Cargando tags...
                    </span>
                </div>
            </div>
        );

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Toast global */}
            {toast && (
                <div
                    className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-600 transition-all ${
                        toast.type === "error"
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-green-50 border-green-200 text-green-700"
                    }`}
                >
                    {toast.type === "error" ? Icon.x() : Icon.check()}
                    {toast.msg}
                </div>
            )}

            {/* ── KPI Cards (mismo patrón que Dashboard) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Stock */}
                <div className="glass-card relative overflow-hidden">
                    <div className="glass-card-shine" />
                    <p className="kpi-label">Stock disponible</p>
                    <p className="kpi-value text-orange-500">
                        {unsoldTags.length}
                    </p>
                    <p className="kpi-sub">
                        {sales.length} tags vendidos en total
                    </p>
                    <div className="kpi-icon text-orange-400">
                        {Icon.tag("w-6 h-6")}
                    </div>
                </div>

                {/* Ingresos acumulados */}
                <div className="glass-card relative overflow-hidden">
                    <div className="glass-card-shine" />
                    <p className="kpi-label">Ingresos acumulados</p>
                    <p className="kpi-value text-orange-500">
                        ${kpi.totalAcumulado.toLocaleString("es-MX")}
                    </p>
                    <p className="kpi-sub">en ventas de tags</p>
                    <div className="kpi-icon text-orange-400">
                        {Icon.cart("w-6 h-6")}
                    </div>
                </div>

                {/* Mes actual vs anterior */}
                <div className="glass-card relative overflow-hidden">
                    <div className="glass-card-shine" />
                    <p className="kpi-label">Este mes en tags</p>
                    <p className="kpi-value text-orange-500">
                        ${kpi.ventasMesActual.toLocaleString("es-MX")}
                    </p>
                    <div
                        className={`flex items-center gap-1 text-xs font-600 mt-0.5 ${
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
                    <div className="kpi-icon text-orange-400">
                        {Icon.chart("w-6 h-6")}
                    </div>
                </div>
            </div>

            {/* ── Contenido principal ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                {/* Columna izquierda: inventario + venta */}
                <div className="flex flex-col gap-3">
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
