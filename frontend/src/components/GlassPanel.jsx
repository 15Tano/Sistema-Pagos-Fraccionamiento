/**
 * Contenedor "liquid glass" reutilizable.
 * size="default" → tarjetas normales (14px radius, como KPIs del Dashboard)
 * size="lg"      → paneles de página completa (2rem radius, como Histórico)
 */
function GlassPanel({ children, className = "", size = "default" }) {
    return (
        <div
            className={`glass-card ${size === "lg" ? "glass-card-lg" : ""} ${className}`}
        >
            <div className="glass-card-shine" />
            {children}
        </div>
    );
}

export default GlassPanel;
