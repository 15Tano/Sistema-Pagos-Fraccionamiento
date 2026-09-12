import { useState, useEffect } from "react";

/**
 * Retrasa la actualización de un valor. Útil para inputs de búsqueda/fecha
 * que no queremos que disparen un fetch o un filtrado en cada tecla.
 */
export function useDebouncedValue(value, delayMs = 300) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timeout = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timeout);
    }, [value, delayMs]);

    return debounced;
}
