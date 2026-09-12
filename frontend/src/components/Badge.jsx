/**
 * Badge de estado, reutiliza las clases .badge-* ya definidas en index.css.
 * variant: "success" | "danger" | "info" | "warning"
 */
const VARIANT_CLASS = {
    success: "badge-sold",
    danger: "badge-due",
    info: "badge-info",
    warning: "badge-warning",
};

function Badge({ variant = "info", children }) {
    return (
        <span className={`badge ${VARIANT_CLASS[variant]}`}>{children}</span>
    );
}

export default Badge;
