import { useState, useEffect } from "react";

const ITEMS_PER_PAGE = 10;

export default function PaginatedPanel({ items, renderItem, emptyText }) {
    const [page, setPage] = useState(1);
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const slice = items.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE,
    );

    useEffect(() => setPage(1), [items.length]);

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
