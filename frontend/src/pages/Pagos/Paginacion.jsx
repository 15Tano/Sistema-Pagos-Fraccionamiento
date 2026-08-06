import { getPageNumbers } from "../paginacion";

// ── PAGINACIÓN ──
export default function Paginacion({
    currentPage,
    lastPage,
    total,
    perPage,
    onPageChange,
}) {
    if (lastPage <= 1) return null;

    return (
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/40 bg-white/20 flex-wrap gap-3 relative z-10">
            <span className="text-xs font-medium text-stone-500">
                {(currentPage - 1) * perPage + 1}–
                {Math.min(currentPage * perPage, total)} de {total}
            </span>
            <div className="flex gap-1.5 items-center flex-wrap">
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 rounded-xl border border-white/80 bg-white/50 text-stone-600 text-sm font-semibold flex items-center justify-center hover:bg-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] disabled:opacity-40 disabled:shadow-none transition-all active:scale-95"
                >
                    ‹
                </button>
                {getPageNumbers(currentPage, lastPage).map((p, i) =>
                    p === "..." ? (
                        <span
                            key={`e${i}`}
                            className="w-5 text-center text-xs font-medium text-stone-400"
                        >
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => onPageChange(p)}
                            className={`w-8 h-8 rounded-xl text-xs font-semibold flex items-center justify-center transition-all active:scale-95
                                ${
                                    currentPage === p
                                        ? "bg-gradient-to-br from-orange-400 to-orange-500 text-white border-orange-400 shadow-[0_2px_6px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)]"
                                        : "border border-white/80 bg-white/50 text-stone-600 hover:bg-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]"
                                }`}
                        >
                            {p}
                        </button>
                    ),
                )}
                <button
                    onClick={() =>
                        onPageChange(Math.min(lastPage, currentPage + 1))
                    }
                    disabled={currentPage === lastPage}
                    className="w-8 h-8 rounded-xl border border-white/80 bg-white/50 text-stone-600 text-sm font-semibold flex items-center justify-center hover:bg-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] disabled:opacity-40 disabled:shadow-none transition-all active:scale-95"
                >
                    ›
                </button>
            </div>
        </div>
    );
}
