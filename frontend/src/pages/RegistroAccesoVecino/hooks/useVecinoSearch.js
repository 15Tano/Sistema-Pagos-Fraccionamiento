import { useRef, useState } from "react";

/**
 * Hook compartido para el buscador de vecinos.
 * `call` es el helper (method, url, data) => axios promise, ya con el Bearer del PIN.
 * `onlyConAcceso` filtra del lado del cliente los resultados que ya tienen user_id
 * (útil para la pestaña de eliminar acceso). Ojo: es un filtro sobre los 8
 * resultados que regresa `per_page`, no un filtro real en el backend — si en el
 * futuro el back soporta algo como `?con_acceso=1` conviene mover el filtro allá.
 */
export function useVecinoSearch(call, { onlyConAcceso = false } = {}) {
    const [vecinoSearch, setVecinoSearchRaw] = useState("");
    const [vecinoResults, setVecinoResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedVecino, setSelectedVecino] = useState(null);
    const [vecinoError, setVecinoError] = useState(undefined);
    const searchTimeout = useRef(null);

    const handleVecinoSearch = (val) => {
        setVecinoSearchRaw(val);
        setSelectedVecino(null);
        setVecinoError(undefined);
        clearTimeout(searchTimeout.current);

        if (!val.trim()) {
            setVecinoResults([]);
            setShowDropdown(false);
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await call("get", "/vecinos", {
                    search: val,
                    per_page: 8,
                });
                let data = res.data.data || [];
                if (onlyConAcceso) {
                    data = data.filter((v) => v.user_id);
                }
                setVecinoResults(data);
                setShowDropdown(true);
            } catch {
                setVecinoResults([]);
            }
        }, 200);
    };

    const selectVecino = (v) => {
        setSelectedVecino(v);
        setVecinoSearchRaw(`${v.nombre} — ${v.calle} #${v.numero_casa}`);
        setShowDropdown(false);
        setVecinoResults([]);
        setVecinoError(undefined);
    };

    const clearVecino = () => {
        setVecinoSearchRaw("");
        setSelectedVecino(null);
        setShowDropdown(false);
        setVecinoResults([]);
    };

    return {
        vecinoSearch,
        vecinoResults,
        showDropdown,
        selectedVecino,
        vecinoError,
        setVecinoError,
        handleVecinoSearch,
        selectVecino,
        clearVecino,
        setShowDropdown,
    };
}
