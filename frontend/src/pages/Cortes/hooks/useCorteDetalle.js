import { useState, useEffect, useCallback } from "react";
import { getCorte, reabrirCorte } from "../../../lib/cortes";

export function useCorteDetalle(uuid) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reabriendo, setReabriendo] = useState(false);

    useEffect(() => {
        let cancelado = false;
        setLoading(true);
        setError(null);

        getCorte(uuid)
            .then((res) => !cancelado && setData(res))
            .catch(() => !cancelado && setError("No se pudo cargar el corte."))
            .finally(() => !cancelado && setLoading(false));

        return () => {
            cancelado = true;
        };
    }, [uuid]);

    const reabrir = useCallback(async () => {
        setReabriendo(true);
        try {
            const res = await reabrirCorte(uuid);
            setData(res);
            return { ok: true };
        } catch (e) {
            return {
                ok: false,
                message:
                    e.response?.data?.message || "No se pudo reabrir el corte.",
            };
        } finally {
            setReabriendo(false);
        }
    }, [uuid]);

    return { data, loading, error, reabriendo, reabrir };
}
