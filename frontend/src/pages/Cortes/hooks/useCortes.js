import { useState, useEffect, useCallback } from "react";
import { listarCortes } from "../../../lib/cortes";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";

const FILTROS_INICIALES = { desde: "", hasta: "", estado: "", firma: "" };

export function useCortes() {
    const [filtros, setFiltros] = useState(FILTROS_INICIALES);
    const [page, setPage] = useState(1);
    const [cortes, setCortes] = useState([]);
    const [meta, setMeta] = useState({ last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const firmaDebounced = useDebouncedValue(filtros.firma, 300);

    const fetchCortes = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { page };
            if (filtros.desde) params.desde = filtros.desde;
            if (filtros.hasta) params.hasta = filtros.hasta;
            if (filtros.estado) params.estado = filtros.estado;
            if (firmaDebounced.trim()) params.firma = firmaDebounced.trim();

            const res = await listarCortes(params);
            setCortes(res.data);
            setMeta({ last_page: res.last_page, total: res.total });
        } catch {
            setError("No se pudo cargar el historial de cortes.");
        } finally {
            setLoading(false);
        }
    }, [page, filtros.desde, filtros.hasta, filtros.estado, firmaDebounced]);

    useEffect(() => {
        fetchCortes();
    }, [fetchCortes]);

    const setFiltro = (campo, valor) => {
        setPage(1);
        setFiltros((prev) => ({ ...prev, [campo]: valor }));
    };

    const limpiarFiltros = () => {
        setPage(1);
        setFiltros(FILTROS_INICIALES);
    };

    return {
        cortes,
        meta,
        loading,
        error,
        filtros,
        setFiltro,
        limpiarFiltros,
        page,
        setPage,
        refetch: fetchCortes,
    };
}
