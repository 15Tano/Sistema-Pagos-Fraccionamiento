// src/components/TemporadaProvider.jsx
import { useEffect, useState } from "react";
import { useTemporada } from "../hooks/useTemporada";
import ConfettiFondo from "./decoraciones/ConfettiFondo";
import DestellosEntrada from "./decoraciones/DestellosEntrada";

const DESTELLOS_KEY = "destellos_ultima_fecha";

function shouldShowDestellos() {
    const hoy = new Date().toDateString();
    const ultimaVez = localStorage.getItem(DESTELLOS_KEY);

    // Detecta si esta carga fue un reload explícito del navegador/PWA
    // (F5, pull-to-refresh) en vez de una navegación normal o relanzamiento
    // desde el ícono de home (que la Navigation Timing API marca como "navigate").
    const [nav] = performance.getEntriesByType("navigation");
    const esReloadExplicito = nav?.type === "reload";

    if (esReloadExplicito || ultimaVez !== hoy) {
        localStorage.setItem(DESTELLOS_KEY, hoy);
        return true;
    }
    return false;
}

export default function TemporadaProvider({ children }) {
    const tema = useTemporada();

    // Se calcula UNA vez al montar el provider (lazy initializer),
    // no en cada render.
    const [mostrarDestellos] = useState(shouldShowDestellos);

    useEffect(() => {
        document.body.dataset.tema = tema.id;

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
            {tema.decoraciones.includes("destelloEntrada") &&
                mostrarDestellos && (
                    <DestellosEntrada colores={tema.cenefa?.colores} />
                )}
            {children}
        </>
    );
}

export { useTemporada };
