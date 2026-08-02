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

// ⚠️ TEMPORAL: tabla duplicada de ZkApiController::DIAS_VENCIMIENTO.
// Cuando se centralice el cálculo de vencimiento en un servicio único
// (backend), este bloque se borra y calcularEstado consume esa fuente.
const DIAS_VENCIMIENTO = {
    1: 7,
    2: 5,
    3: 5,
    4: 9,
    5: 7,
    6: 4,
    7: 9,
    8: 6,
    9: 10,
    10: 8,
    11: 5,
    12: 10,
};

function mesAnteriorKey(mesKey) {
    const [y, m] = mesKey.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function calcularEstado(pagos) {
    const ahora = new Date();
    const mesActual = currentMonthKey();
    const mesAnterior = mesAnteriorKey(mesActual);

    const pagoMesActual = pagos.find((p) => p.mes === mesActual);
    const pagoMesAnterior = pagos.find((p) => p.mes === mesAnterior);

    const buildOk = (pago, vigenciaTexto) => ({
        color: pago.tipo === "extraordinario" ? "amarillo" : "verde",
        titulo: "Acceso Activo",
        subtitulo:
            pago.tipo === "extraordinario"
                ? "Pago Extraordinario"
                : "Pago Puntual",
        descripcion: vigenciaTexto,
    });

    // Ya pagó el mes en curso: vigente sin condición.
    if (pagoMesActual) {
        return buildOk(
            pagoMesActual,
            `Pago registrado para ${formatMonth(mesActual)}.`,
        );
    }

    // No pagó este mes, pero pagó el anterior: vigente hasta el día de corte de ESTE mes.
    if (pagoMesAnterior) {
        const [yActual, mActual] = mesActual.split("-").map(Number);
        const diaCorte = DIAS_VENCIMIENTO[mActual];
        const corte = new Date(yActual, mActual - 1, diaCorte, 23, 59, 59);

        if (ahora <= corte) {
            const corteStr = `${String(diaCorte).padStart(2, "0")}/${String(mActual).padStart(2, "0")}/${yActual}`;
            return buildOk(
                pagoMesAnterior,
                `Vigente hasta el ${corteStr} (mes anterior pagado).`,
            );
        }
    }

    return {
        color: "rojo",
        titulo: "Acceso Restringido",
        subtitulo: "Pendiente de Pago",
        descripcion: `No se detecta pago vigente para ${formatMonth(mesActual)}.`,
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
        iconPath:
            "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
};
