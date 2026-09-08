// src/components/TemporadaProvider.jsx
import { useEffect } from "react";
import { useTemporada } from "../hooks/useTemporada";
import ConfettiFondo from "./decoraciones/ConfettiFondo";
import DestellosEntrada from "./decoraciones/DestellosEntrada";

export default function TemporadaProvider({ children }) {
    const tema = useTemporada();

    useEffect(() => {
        // Marca el body -> permite que CSS global (.app-bg, .card, etc.)
        // reaccione al tema sin importar en qué parte del árbol vivan esos elementos.
        document.body.dataset.tema = tema.id;

        // Variables CSS para el glow (leídas por el override de .app-bg en index.css)
        if (tema.glow) {
            const root = document.documentElement;
            root.style.setProperty("--glow-1", tema.glow.c1);
            root.style.setProperty("--glow-2", tema.glow.c2);
            root.style.setProperty("--glow-3", tema.glow.c3);
            root.style.setProperty("--glow-4", tema.glow.c4);
        }

        return () => {
            delete document.body.dataset.tema;
        };
    }, [tema]);

    return (
        <>
            {tema.decoraciones.includes("confeti") && (
                <ConfettiFondo colores={tema.cenefa?.colores} />
            )}
            {tema.decoraciones.includes("destelloEntrada") && (
                <DestellosEntrada colores={tema.cenefa?.colores} />
            )}
            {children}
        </>
    );
}

// Hook auxiliar para que otros componentes (Semaforo, headers, botones)
// consulten el tema activo sin recalcularlo cada vez.
export { useTemporada };
