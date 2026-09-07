// src/hooks/useTemporada.js
import { useMemo } from "react";
import { TEMAS, ORDEN_TEMAS } from "../config/temporadas";

function estaEnRango(hoy, rango) {
    if (!rango) return false;
    const { inicioMes, inicioDia, finMes, finDia } = rango;
    const mes = hoy.getMonth() + 1;
    const dia = hoy.getDate();

    const despuesDeInicio =
        mes > inicioMes || (mes === inicioMes && dia >= inicioDia);
    const antesDeFin = mes < finMes || (mes === finMes && dia <= finDia);
    return despuesDeInicio && antesDeFin;
}

export function useTemporada() {
    return useMemo(() => {
        // Override manual opcional (fase futura: vendría de un endpoint admin)
        const overrideId =
            typeof window !== "undefined"
                ? localStorage.getItem("tema_override")
                : null;
        if (overrideId && TEMAS[overrideId]) return TEMAS[overrideId];

        const hoy = new Date();
        for (const id of ORDEN_TEMAS) {
            if (estaEnRango(hoy, TEMAS[id].rango)) return TEMAS[id];
        }
        return TEMAS.default;
    }, []);
}
