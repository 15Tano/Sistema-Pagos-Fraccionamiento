// ── HELPERS DE FECHA LOCAL ──
export const getLocalToday = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

export const getLocalMonth = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
};

export const formatMes = (mes) => {
    if (!mes) return "-";
    const [y, m] = mes.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
        "es-MX",
        { month: "long", year: "numeric" },
    );
};

export const formatDate = (d) => {
    if (!d) return "-";
    const [year, month, day] = d.slice(0, 10).split("-");
    return new Date(year, month - 1, day).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};
