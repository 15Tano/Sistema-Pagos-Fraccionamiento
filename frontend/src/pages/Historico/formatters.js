export function formatMonth(monthString) {
    if (!monthString) return "-";
    const [year, month] = monthString.split("-");
    const date = new Date(year, month - 1);
    return date.toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
    });
}

export function formatDate(dateString) {
    if (!dateString) return "-";
    const datePart = dateString.split("T")[0];
    const [year, month, day] = datePart.split("-");
    return `${day}/${month}/${year}`;
}

export function formatCurrency(amount, { decimals = true } = {}) {
    return `$${Number(amount || 0).toLocaleString("es-MX", {
        minimumFractionDigits: decimals ? 2 : 0,
        maximumFractionDigits: decimals ? 2 : 0,
    })}`;
}
