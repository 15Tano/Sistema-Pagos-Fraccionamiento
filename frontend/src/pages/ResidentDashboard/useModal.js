import { useState, useCallback } from "react";

/**
 * Encapsula el patrón open/visible + animación de cierre que se repetía
 * en correoOpen/correoVisible, camarasOpen/camarasVisible, reciboAbierto/reciboVisible.
 *
 * `onClosed` es opcional: se ejecuta cuando termina la animación de cierre
 * (por ejemplo, para limpiar el pago seleccionado del recibo).
 */
export default function useModal(onClosed) {
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const open = useCallback(() => {
        setIsOpen(true);
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const close = useCallback(() => {
        setIsVisible(false);
        setTimeout(() => {
            setIsOpen(false);
            onClosed?.();
        }, 300);
    }, [onClosed]);

    return { isOpen, isVisible, open, close };
}
