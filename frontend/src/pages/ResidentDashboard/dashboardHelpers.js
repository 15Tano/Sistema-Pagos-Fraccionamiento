// ─── Fechas ───────────────────────────────────────────────────────────────

export function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(mes) {
    if (!mes) return "-";
    const [year, month] = mes.split("-");
    return new Date(year, month - 1).toLocaleDateString("es-MX", {
        month: "long",
        year: "numeric",
    });
}

export function formatDate(dateString) {
    if (!dateString) return "-";
    const part = dateString.split("T")[0];
    const [y, m, d] = part.split("-");
    return `${d}/${m}/${y}`;
}

// ─── Config de tipos de aviso ─────────────────────────────────────────────

export const TIPO_CONFIG = {
    urgente: {
        label: "Urgente",
        bg: "bg-red-100/50",
        text: "text-red-700",
        border: "border-red-200/60",
        dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
    },
    informativo: {
        label: "Informativo",
        bg: "bg-blue-100/50",
        text: "text-blue-700",
        border: "border-blue-200/60",
        dot: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]",
    },
    aviso: {
        label: "Aviso",
        bg: "bg-yellow-100/50",
        text: "text-yellow-700",
        border: "border-yellow-200/60",
        dot: "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]",
    },
    positivo: {
        label: "Positivo",
        bg: "bg-green-100/50",
        text: "text-green-700",
        border: "border-green-200/60",
        dot: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]",
    },
};

// ─── Semáforo de estado ───────────────────────────────────────────────────

export function calcularEstado(pagos) {
    const mesActual = currentMonthKey();
    const pagosDelMes = pagos.filter((p) => p.mes === mesActual);

    if (pagosDelMes.length === 0) {
        return {
            color: "rojo",
            titulo: "Acceso Restringido",
            subtitulo: "Pendiente de Pago",
            descripcion: `No se detecta pago para ${formatMonth(mesActual)}.`,
        };
    }

    const tieneExtraordinario = pagosDelMes.some(
        (p) => p.tipo === "extraordinario",
    );

    if (tieneExtraordinario) {
        return {
            color: "amarillo",
            titulo: "Acceso Activo",
            subtitulo: "Pago Extraordinario",
            descripcion: `Pago registrado con recargo para ${formatMonth(mesActual)}.`,
        };
    }

    return {
        color: "verde",
        titulo: "Acceso Activo",
        subtitulo: "Pago Puntual",
        descripcion: `Pago ordinario registrado para ${formatMonth(mesActual)}.`,
    };
}

// Cada estado trae ya su path de ícono, así el componente Semaforo
// no necesita un if/else para elegir el SVG.
export const SEMAFORO_STYLES = {
    verde: {
        ring: "border-green-300/80",
        glow: "shadow-[0_15px_35px_rgba(34,197,94,0.25)]",
        bg: "bg-gradient-to-br from-green-400/30 to-green-500/10",
        icon: "text-green-600",
        titulo: "text-green-700",
        pulse: "bg-green-400",
        iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    amarillo: {
        ring: "border-yellow-300/80",
        glow: "shadow-[0_15px_35px_rgba(234,179,8,0.25)]",
        bg: "bg-gradient-to-br from-yellow-400/30 to-yellow-500/10",
        icon: "text-yellow-600",
        titulo: "text-yellow-700",
        pulse: "bg-yellow-400",
        iconPath: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    rojo: {
        ring: "border-red-300/80",
        glow: "shadow-[0_15px_35px_rgba(239,68,68,0.25)]",
        bg: "bg-gradient-to-br from-red-400/30 to-red-500/10",
        icon: "text-red-600",
        titulo: "text-red-700",
        pulse: "bg-red-400",
        iconPath: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
};
