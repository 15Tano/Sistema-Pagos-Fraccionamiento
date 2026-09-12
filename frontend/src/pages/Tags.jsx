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
import { Icon } from "../lib/icons";
import { createPortal } from "react-dom";
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

// ─── Hook: posición de un elemento anclado, para dropdowns que escapan overflow ───
function useAnchorRect(anchorRef, active) {
    const [rect, setRect] = useState(null);

    useEffect(() => {
        if (!active || !anchorRef.current) {
            setRect(null);
            return;
        }
        const update = () => setRect(anchorRef.current.getBoundingClientRect());
        update();
        // capture:true -> detecta scroll de cualquier ancestro (incluido SmartScroll)
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [active, anchorRef]);

    return rect;
}

// ─── Dropdown que se renderiza en document.body, fuera del overflow del cajón ───
function PortalDropdown({ anchorRef, open, children, offset = 6 }) {
    const rect = useAnchorRect(anchorRef, open);

    if (!open || !rect) return null;

    return createPortal(
        <div
            style={{
                position: "fixed",
                top: rect.bottom + offset,
                left: rect.left,
                width: rect.width,
                zIndex: 9999,
            }}
        >
            {children}
        </div>,
        document.body,
    );
}

// ─── Hook: navegación por teclado sobre una lista ↑ ↓ Enter Esc ───
function useListNav(length, onSelect) {
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => setActiveIndex(-1), [length]);

    const handleKeyDown = useCallback(
        (e) => {
            if (length === 0) return;
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => (i - 1 + length) % length);
            } else if (e.key === "Enter") {
                if (activeIndex >= 0) {
                    e.preventDefault();
                    onSelect(activeIndex);
                }
            } else if (e.key === "Escape") {
                setActiveIndex(-1);
            }
        },
        [length, activeIndex, onSelect],
    );

    return { activeIndex, setActiveIndex, handleKeyDown };
}

const TAG_SEARCH_THRESHOLD = 8;

// ─── Panel: Buscador de vecinos + venta ───────────────────────────────────────
export function SellTagPanel({ unsoldTags, onSold, onError }) {
    const [query, setQuery] = useState("");
    const [resultados, setResultados] = useState([]);
    const [selected, setSelected] = useState(null);
    const [tagId, setTagId] = useState("");
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [selling, setSelling] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const debounceRef = useRef(null);

    const searchInputRef = useRef(null);
    const inputWrapperRef = useRef(null);

    // Foco automático al montar (el panel se remonta cada vez que se abre el cajón)
    useEffect(() => {
        const t = setTimeout(() => searchInputRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, []);

    // Confirmación de venta se resetea si cambia la selección
    useEffect(() => setConfirming(false), [selected, tagId]);

    const handleQuery = useCallback((val) => {
        setQuery(val);
        setSelected(null);
        setTagId("");
        clearTimeout(debounceRef.current);

        if (!val.trim()) {
            setResultados([]);
            setLoadingSearch(false);
            return;
        }

        // loading se activa YA (no dentro del timeout) para que no haya
        // un frame donde "no hay resultados" aparezca mientras se escribe.
        setLoadingSearch(true);

        debounceRef.current = setTimeout(async () => {
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

    const showNoResults =
        query.trim() && !loadingSearch && resultados.length === 0 && !selected;
    const showResultsDropdown = resultados.length > 0 || showNoResults;

    const resultsNav = useListNav(resultados.length, (i) =>
        handleSelect(resultados[i]),
    );

    const handleSell = useCallback(async () => {
        if (!tagId || !selected) return;
        setSelling(true);
        try {
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

    const handleConfirmClick = () => {
        if (!tagId || !selected) return;
        if (!confirming) {
            setConfirming(true);
            return;
        }
        handleSell();
    };

    return (
        <div className="relative overflow-visible p-5 bg-white/30 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            <div className="flex items-center gap-2 mb-5 relative z-10">
                <span className="text-orange-400">{Icon.cart()}</span>
                <h3 className="text-sm font-semibold text-stone-800">
                    Vender Tag
                </h3>
                <span className="ml-200 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-orange-100/60 border border-orange-200/60 text-orange-700 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                    {unsoldTags.length} disponibles · $150 c/u
                </span>
            </div>

            <div className="relative z-10">
                {/* Buscador de vecino */}
                <div className="relative mb-4" ref={inputWrapperRef}>
                    <label className="block text-xs font-medium text-stone-500 mb-1.5 ml-1">
                        Buscar vecino por nombre o casa
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                            {Icon.search()}
                        </span>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Ej: García o Casa 14..."
                            value={query}
                            onChange={(e) => handleQuery(e.target.value)}
                            onKeyDown={resultsNav.handleKeyDown}
                            role="combobox"
                            aria-expanded={showResultsDropdown}
                            aria-controls="vecino-resultados-listbox"
                            aria-activedescendant={
                                resultsNav.activeIndex >= 0
                                    ? `vecino-opt-${resultsNav.activeIndex}`
                                    : undefined
                            }
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

                    {/* Dropdown vía portal: escapa el overflow del cajón */}
                    <PortalDropdown
                        anchorRef={inputWrapperRef}
                        open={showResultsDropdown}
                    >
                        <div
                            className="transition-[opacity,transform] duration-150 ease-out opacity-100 translate-y-0
                                bg-white/90 backdrop-blur-xl border border-white/80 rounded-xl
                                shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden max-h-60 overflow-y-auto"
                        >
                            {resultados.length > 0 ? (
                                <ul
                                    id="vecino-resultados-listbox"
                                    role="listbox"
                                >
                                    {resultados.map((v, i) => (
                                        <li
                                            key={v.uuid}
                                            role="option"
                                            id={`vecino-opt-${i}`}
                                            aria-selected={
                                                i === resultsNav.activeIndex
                                            }
                                        >
                                            <button
                                                onClick={() => handleSelect(v)}
                                                onMouseEnter={() =>
                                                    resultsNav.setActiveIndex(i)
                                                }
                                                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left border-b border-black/5 last:border-0 ${
                                                    i === resultsNav.activeIndex
                                                        ? "bg-orange-50/80"
                                                        : "hover:bg-orange-50/80"
                                                }`}
                                            >
                                                <span className="text-stone-400/70">
                                                    {Icon.user()}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-stone-800 truncate">
                                                        {v.nombre}
                                                    </p>
                                                    <p className="text-xs font-medium text-stone-500 mt-0.5">
                                                        {v.calle} #
                                                        {v.numero_casa}
                                                    </p>
                                                </div>
                                                {v.tags?.length > 0 && (
                                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 bg-orange-100/50 px-2 py-0.5 rounded-md shrink-0">
                                                        {v.tags.length} tag
                                                        {v.tags.length > 1
                                                            ? "s"
                                                            : ""}
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="px-4 py-3 text-sm text-stone-400">
                                    Sin resultados para "{query}"
                                </div>
                            )}
                        </div>
                    </PortalDropdown>
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

                        {/* Selector de tag: nativo o buscable según volumen */}
                        <TagPicker
                            unsoldTags={unsoldTags}
                            tagId={tagId}
                            onChange={setTagId}
                        />

                        {/* Confirmación en dos pasos antes de vender */}
                        {confirming ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setConfirming(false)}
                                    disabled={selling}
                                    className="flex-1 py-3 bg-white/60 border border-stone-200/70 text-stone-600 text-sm font-semibold rounded-xl hover:bg-white/90 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmClick}
                                    disabled={selling}
                                    className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-[0_4px_10px_rgba(249,115,22,0.3)] transition-all active:scale-95"
                                >
                                    {selling
                                        ? "Registrando..."
                                        : `Sí, vender a ${selected.nombre.split(" ")[0]}`}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleConfirmClick}
                                disabled={!tagId || selling}
                                className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 disabled:opacity-50 disabled:shadow-none text-white text-sm font-semibold rounded-xl shadow-[0_4px_10px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)] transition-all flex items-center justify-center gap-2 active:scale-95"
                            >
                                {Icon.cart()}
                                Confirmar venta — $150
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Selector de tag: <select> nativo si son pocos, buscable si son muchos ───
function TagPicker({ unsoldTags, tagId, onChange }) {
    if (unsoldTags.length <= TAG_SEARCH_THRESHOLD) {
        return (
            <select
                value={tagId}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-700 transition-all cursor-pointer"
            >
                <option value="">Seleccionar un tag del inventario...</option>
                {unsoldTags.map((t) => (
                    <option key={t.id} value={t.id}>
                        {t.codigo}
                    </option>
                ))}
            </select>
        );
    }

    return (
        <TagCombobox
            unsoldTags={unsoldTags}
            tagId={tagId}
            onChange={onChange}
        />
    );
}

function TagCombobox({ unsoldTags, tagId, onChange }) {
    const [tagQuery, setTagQuery] = useState("");
    const [open, setOpen] = useState(false);
    const anchorRef = useRef(null);

    const selectedTag = useMemo(
        () => unsoldTags.find((t) => String(t.id) === String(tagId)) || null,
        [unsoldTags, tagId],
    );

    const filtered = useMemo(() => {
        if (!tagQuery.trim()) return unsoldTags;
        const q = tagQuery.toLowerCase();
        return unsoldTags.filter((t) => t.codigo.toLowerCase().includes(q));
    }, [unsoldTags, tagQuery]);

    const nav = useListNav(filtered.length, (i) => {
        onChange(String(filtered[i].id));
        setTagQuery(filtered[i].codigo);
        setOpen(false);
    });

    return (
        <div className="relative" ref={anchorRef}>
            <input
                type="text"
                placeholder="Buscar tag por código..."
                value={open ? tagQuery : selectedTag?.codigo || ""}
                onFocus={() => {
                    setOpen(true);
                    setTagQuery("");
                }}
                onChange={(e) => setTagQuery(e.target.value)}
                onKeyDown={nav.handleKeyDown}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-700 transition-all"
            />
            <PortalDropdown anchorRef={anchorRef} open={open}>
                <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden max-h-60 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-stone-400">
                            Sin tags que coincidan
                        </div>
                    ) : (
                        filtered.map((t, i) => (
                            <button
                                key={t.id}
                                onMouseDown={(e) => e.preventDefault()} // evita perder foco antes del click
                                onClick={() => {
                                    onChange(String(t.id));
                                    setTagQuery(t.codigo);
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-b border-black/5 last:border-0 ${
                                    i === nav.activeIndex
                                        ? "bg-orange-50/80 text-stone-800"
                                        : "text-stone-700 hover:bg-orange-50/80"
                                }`}
                            >
                                {t.codigo}
                            </button>
                        ))
                    )}
                </div>
            </PortalDropdown>
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
