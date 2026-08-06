// ── CÁLCULO DE NÚMEROS DE PÁGINA VISIBLES ──
export const getPageNumbers = (currentPage, lastPage) => {
    if (lastPage <= 5)
        return Array.from({ length: lastPage }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, "...", lastPage];
    if (currentPage >= lastPage - 2)
        return [
            1,
            "...",
            lastPage - 3,
            lastPage - 2,
            lastPage - 1,
            lastPage,
        ];
    return [
        1,
        "...",
        currentPage - 1,
        currentPage,
        currentPage + 1,
        "...",
        lastPage,
    ];
};
