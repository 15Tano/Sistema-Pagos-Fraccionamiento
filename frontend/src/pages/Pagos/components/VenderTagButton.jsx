import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { getTags, getTagSales } from "../../../api/tags";
import { SellTagPanel } from "../../Tags";
import { Icon } from "../../../lib/icons";

// ─── FÍSICA DE ANIMACIÓN EXTREMA ──────────────────────────────────────────
// Sobregiro agresivo: se pasa de su posición final y de su tamaño original,
// creando el efecto visual de "estirarse y rebotar" como goma o resorte fuerte.
const ELASTIC_BOUNCE = "cubic-bezier(0.2, 1.65, 0.4, 1)";
const DURATION = "500ms";

export default function VenderTagButton() {
    const [open, setOpen] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const [tags, setTags] = useState([]);
    const [sales, setSales] = useState([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);

    function isToday(dateStr) {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const now = new Date();
        return (
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate()
        );
    }

    const fetchData = useCallback(async () => {
        setDataLoading(true);
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
            setDataLoaded(true);
        } finally {
            setDataLoading(false);
        }
    }, []);

    const unsoldTags = useMemo(() => {
        const soldIds = new Set(sales.map((sale) => sale.tag_id));
        return tags.filter((tag) => !soldIds.has(tag.id));
    }, [tags, sales]);

    const soldToday = useMemo(
        () => sales.filter((s) => isToday(s.sold_at || s.created_at)).length,
        [sales],
    );

    const handleToggle = () => {
        setOpen((value) => !value);
        setHasLoaded(true);
        if (!dataLoaded && !dataLoading) fetchData();
    };

    const handleHoverPrefetch = () => {
        if (!dataLoaded && !dataLoading) fetchData();
    };

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open]);

    return (
        <>
            <Backdrop open={open} onClick={() => setOpen(false)} />

            {/* ═══ CAJÓN ═══ */}
            <div className="fixed right-2 top-24 z-40 w-[23rem] max-w-[calc(100vw-2rem)] pointer-events-none overflow-visible">
                {hasLoaded && (
                    <VenderTagPanelContainer
                        open={open}
                        onClose={() => setOpen(false)}
                        unsoldTags={unsoldTags}
                        dataLoading={dataLoading}
                        refetch={fetchData}
                    />
                )}
            </div>

            {/* ═══ TIRADOR / SQUASH & STRETCH TRIGGER ═══ */}
            <div className="fixed right-0 top-24 z-50">
                <div
                    className="relative transition-transform will-change-transform"
                    style={{
                        transitionTimingFunction: ELASTIC_BOUNCE,
                        transitionDuration: DURATION,
                        transform: open
                            ? "translateY(0)"
                            : "translateY(0.5rem)",
                    }}
                >
                    <button
                        type="button"
                        onClick={handleToggle}
                        onMouseEnter={handleHoverPrefetch}
                        aria-label={open ? "Cerrar vender tag" : "Vender tag"}
                        aria-expanded={open}
                        title={open ? "Cerrar" : "Vender tag"}
                        style={{
                            transitionTimingFunction: ELASTIC_BOUNCE,
                            transitionDuration: DURATION,
                        }}
                        className={`
                            group relative flex items-center justify-center overflow-hidden origin-right
                            text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2
                            transition-[height,width,background-color,border-radius,box-shadow,transform]
                            will-change-[height,width,transform]
                            ${
                                open
                                    ? `
                                    h-14 w-12
                                    rounded-l-[1.4rem]
                                    bg-orange-500
                                    shadow-md
                                    hover:w-14 hover:-translate-x-1
                                `
                                    : `
                                    h-32 w-11
                                    rounded-l-[1.15rem]
                                    bg-gradient-to-b from-orange-500 to-orange-400
                                    shadow-[-6px_6px_25px_rgba(249,115,22,0.25)]
                                    hover:-translate-x-3 hover:w-16 /* Se estira pidiendo que lo jales */
                                    hover:shadow-[-12px_12px_30px_rgba(249,115,22,0.35)]
                                    active:scale-x-[0.85] active:scale-y-[1.1] /* Squash mecánico al clickear */
                                `
                            }
                        `}
                    >
                        <span className="pointer-events-none absolute -left-8 top-0 h-full w-7 rotate-[14deg] bg-white/20 blur-md transition-transform duration-700 group-hover:translate-x-32" />

                        <div
                            className={`
                                absolute inset-0 flex flex-col items-center justify-center transition-all duration-200
                                ${open ? "opacity-0 scale-75 blur-sm pointer-events-none" : "opacity-100 scale-100 blur-0"}
                            `}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-[18px] h-[18px] drop-shadow-md mb-1.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect
                                    x="2"
                                    y="5"
                                    width="20"
                                    height="14"
                                    rx="2"
                                />
                                <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                            <span
                                style={{
                                    writingMode: "vertical-rl",
                                    transform: "rotate(180deg)",
                                }}
                                className="text-[10px] font-black tracking-[0.15em] drop-shadow-md"
                            >
                                VENDER
                            </span>
                        </div>

                        <div
                            className={`
                                absolute inset-0 flex items-center justify-center transition-all duration-300
                                ${open ? "opacity-100 scale-100" : "opacity-0 scale-150 pointer-events-none"}
                            `}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-5 h-5 text-white drop-shadow-sm transition-transform group-hover:rotate-90 duration-300"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </div>
                    </button>

                    {!open && dataLoaded && soldToday > 0 && (
                        <span
                            className="
                                absolute -left-2 -top-2 z-20
                                flex h-[1.35rem] min-w-[1.35rem] items-center justify-center
                                rounded-full bg-orange-600 px-1.5
                                text-[10px] font-bold text-white
                                shadow-[0_3px_8px_rgba(239,68,68,0.5)] ring-2 ring-white
                                pointer-events-none
                                animate-in zoom-in duration-300
                            "
                        >
                            {soldToday}
                        </span>
                    )}
                </div>
            </div>
        </>
    );
}

// ─── Backdrop ──────────────────────────────────────────────────────────────

function Backdrop({ open, onClick }) {
    const [mounted, setMounted] = useState(open);

    useEffect(() => {
        if (open) setMounted(true);
        else {
            const t = setTimeout(() => setMounted(false), 500);
            return () => clearTimeout(t);
        }
    }, [open]);

    if (!mounted) return null;

    return (
        <div
            onClick={onClick}
            style={{ transitionDuration: "400ms" }}
            className={`
                fixed inset-0 z-30
                bg-stone-900/5 backdrop-blur-[2px]
                transition-all ease-out
                ${open ? "opacity-90" : "opacity-0"}
            `}
        />
    );
}

// ─── Contenedor Limpio ─────────────────────────────────────────────────────

function VenderTagPanelContainer({
    open,
    onClose,
    unsoldTags,
    dataLoading,
    refetch,
}) {
    const [feedback, setFeedback] = useState(null);

    return (
        <AnimatedDrawer open={open}>
            <div
                className="
        relative rounded-[1.65rem] overflow-hidden
        bg-white/40
        border border-white/60
        shadow-[-15px_15px_40px_rgba(0,0,0,0.12),inset_0_1px_2px_rgba(255,255,255,0.7)]
        backdrop-blur-2xl
        transition-all duration-300 ease-out
        [&>div>div>div]:!bg-transparent [&>div>div>div]:!shadow-none [&>div>div>div]:!border-none
    "
            >
                <FeedbackToast
                    feedback={feedback}
                    onClose={() => setFeedback(null)}
                />

                {dataLoading ? (
                    <LoadingState />
                ) : (
                    <SmartScroll>
                        <SellTagPanel
                            unsoldTags={unsoldTags}
                            onSold={(msg) => {
                                setFeedback({ msg, type: "success" });
                                refetch();
                            }}
                            onError={(msg) =>
                                setFeedback({ msg, type: "error" })
                            }
                        />
                    </SmartScroll>
                )}
            </div>
        </AnimatedDrawer>
    );
}

// ─── Animación del Cajón con Stretch Dinámico ─────────────────────────────
// Al combinar el Overshoot del ELASTIC_BOUNCE con scaleX, el cajón
// entra estirado (scaleX > 1), se aplasta al frenar (scaleX < 1) y rebota.
function AnimatedDrawer({ open, children }) {
    return (
        <div
            className={`
                pointer-events-auto relative
                will-change-transform
                transition-transform
            `}
            style={{
                transitionDuration: DURATION,
                transitionTimingFunction: ELASTIC_BOUNCE,
                transformOrigin: "right center", // El estiramiento nace desde el lado derecho
                transform: open
                    ? "translateX(0%) scaleX(1)"
                    : "translateX(160%) scaleX(1.08)",
            }}
        >
            {children}
        </div>
    );
}

// ─── Scroll inteligente ───────────────────────────────────────────────────

function SmartScroll({ children }) {
    const scrollRef = useRef(null);
    const [hasOverflow, setHasOverflow] = useState(false);
    const [atTop, setAtTop] = useState(true);
    const [atBottom, setAtBottom] = useState(true);

    const update = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setHasOverflow(el.scrollHeight > el.clientHeight + 2);
        setAtTop(el.scrollTop <= 2);
        setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        update();
        el.addEventListener("scroll", update, { passive: true });
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => {
            el.removeEventListener("scroll", update);
            observer.disconnect();
        };
    }, [update]);

    return (
        <div className="relative">
            <div
                className={`
                    pointer-events-none absolute inset-x-0 top-0 z-30 h-6
                    bg-gradient-to-b from-white to-transparent
                    transition-opacity duration-300 rounded-t-[1.65rem]
                    ${hasOverflow && !atTop ? "opacity-100" : "opacity-0"}
                `}
            />
            <div
                ref={scrollRef}
                className="
                    max-h-[calc(100vh-8rem)]
                    overflow-y-auto overscroll-contain scroll-smooth
                    [scrollbar-width:thin]
                    [scrollbar-color:rgba(120,113,108,0.22)_transparent]
                    [&::-webkit-scrollbar]:w-1
                    [&::-webkit-scrollbar-track]:bg-transparent
                    [&::-webkit-scrollbar-thumb]:rounded-full
                    [&::-webkit-scrollbar-thumb]:bg-stone-400/25
                    hover:[&::-webkit-scrollbar-thumb]:bg-stone-500/40
                "
            >
                {children}
            </div>
            <div
                className={`
                    pointer-events-none absolute inset-x-0 bottom-0 z-30 h-8
                    bg-gradient-to-t from-white to-transparent
                    transition-opacity duration-300 rounded-b-[1.65rem]
                    ${hasOverflow && !atBottom ? "opacity-100" : "opacity-0"}
                `}
            />
        </div>
    );
}

// ─── Loading ───────────────────────────────────────────────────────────────
function LoadingState() {
    return (
        <div className="min-h-[18rem] px-5 py-6">
            <div className="mb-6 space-y-2">
                <div className="h-5 w-32 animate-pulse rounded-lg bg-stone-100" />
                <div className="h-3 w-48 animate-pulse rounded bg-stone-50" />
            </div>
            <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                    <div
                        key={item}
                        className="h-16 animate-pulse rounded-2xl border border-stone-100 bg-stone-50"
                    />
                ))}
            </div>
        </div>
    );
}

// ─── Toast flotante ────────────────────────────────────────────────────────
function FeedbackToast({ feedback, onClose }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!feedback) return;
        setVisible(true);
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300);
        }, 3200);
        return () => clearTimeout(timer);
    }, [feedback, onClose]);

    if (!feedback) return null;

    const isError = feedback.type === "error";

    return createPortal(
        <div
            className={`
                fixed top-6 right-6 z-[9999]
                flex items-center gap-3
                px-4 py-3 rounded-2xl
                border shadow-lg
                backdrop-blur-xl text-sm font-medium
                transition-[transform,opacity] duration-300 ease-out
                ${visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}
                ${
                    isError
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-green-50 border-green-200 text-green-700"
                }
            `}
        >
            <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    isError ? "bg-red-100" : "bg-green-100"
                }`}
            >
                {isError ? "!" : "✓"}
            </span>
            <span className="flex-1">{feedback.msg}</span>
            <button
                type="button"
                onClick={() => {
                    setVisible(false);
                    setTimeout(onClose, 300);
                }}
                className="rounded-full px-1.5 py-1 text-xs opacity-40 transition-all duration-200 hover:bg-black/5 hover:opacity-80"
            >
                ocultar
            </button>
        </div>,
        document.body,
    );
}
