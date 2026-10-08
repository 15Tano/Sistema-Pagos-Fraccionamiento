import { useCallback, useEffect, useRef, useState } from "react";
import {
    getCorteHoy,
    intentarCorte,
    cerrarCorte,
    cerrarCorteConDiferencia,
} from "../lib/corteCaja";

const INTERVALO_POLL_MS = 20000;

// fase: 'inactivo' | 'interrupcion' | 'declarando' | 'verificando' | 'coincide' | 'diferencia' | 'sellado'
export default function useCorteCaja(activo) {
    const [fase, setFase] = useState("inactivo");
    const [corte, setCorte] = useState(null);
    const [desglose, setDesglose] = useState(null);
    const [ultimoResultado, setUltimoResultado] = useState(null);
    const intervalRef = useRef(null);
    // Bandera de hidratación: solo resuelve el estado inicial UNA vez por
    // montaje (o sea, una vez por refresh/reconexión). Después de eso, el
    // polling subsecuente ya no debe pisar la fase interactiva en curso.
    const inicializadoRef = useRef(false);
    const fechaRef = useRef(null);

    const evaluarCorte = useCallback((data) => {
        if (!data.existe) {
            setFase("inactivo");
            setCorte(null);
            inicializadoRef.current = false;
            return;
        }

        const fecha = data.corte.fecha.slice(0, 10);
        if (fechaRef.current !== fecha) inicializadoRef.current = false;
        fechaRef.current = fecha;
        setCorte(data.corte);
        setDesglose(data.desglose);

        if (data.corte.estado === "en_proceso") {
            if (!inicializadoRef.current) {
                inicializadoRef.current = true;

                const intentos = data.corte.intentos ?? [];
                const ultimoIntento = intentos[intentos.length - 1];

                if (ultimoIntento) {
                    // OJO: mientras el corte sigue en_proceso, corte.monto_sistema
                    // vive en null en la BD (el backend solo llena esa columna al
                    // cerrar) — por eso se reconstruye desde el propio intento
                    // ({numero, declarado, diferencia, at}), nunca desde corte.*.
                    const montoSistema =
                        ultimoIntento.declarado - ultimoIntento.diferencia;

                    setUltimoResultado({
                        diferencia: ultimoIntento.diferencia,
                        numero_intento: ultimoIntento.numero,
                        declarado: ultimoIntento.declarado,
                        monto_sistema: montoSistema,
                        puede_cerrar_con_diferencia:
                            intentos.length >= 3 &&
                            ultimoIntento.diferencia !== 0,
                    });

                    setFase(
                        ultimoIntento.diferencia === 0
                            ? "coincide"
                            : "diferencia",
                    );
                } else {
                    // nadie ha declarado nada todavía hoy: primerísimo intento,
                    // toca la pantalla de interrupción antes de contar
                    setFase("interrupcion");
                }
            } else {
                // polling subsecuente: no interrumpir una fase interactiva en curso
                setFase((prev) =>
                    [
                        "declarando",
                        "verificando",
                        "diferencia",
                        "coincide",
                        "interrupcion",
                    ].includes(prev)
                        ? prev
                        : "declarando",
                );
            }
        } else if (data.corte.reabierto_at) {
            setFase("inactivo");
        } else {
            setFase("sellado");
        }
    }, []);

    const consultarHoy = useCallback(async () => {
        try {
            const data = await getCorteHoy();
            evaluarCorte(data);
        } catch {
            // silencioso — se reintenta en el próximo poll
        }
    }, [evaluarCorte]);

    useEffect(() => {
        if (!activo) return;

        consultarHoy(); // check inmediato al montar
        intervalRef.current = setInterval(consultarHoy, INTERVALO_POLL_MS);

        return () => {
            clearInterval(intervalRef.current);
            inicializadoRef.current = false;
        };
    }, [activo, consultarHoy]);

    // avanza de la pantalla de interrupción a la primera declaración
    // (tap = instantáneo; el auto-avance a los 10s lo dispara InterrupcionAviso)
    const avanzarConteo = useCallback(() => setFase("declarando"), []);

    const declarar = useCallback(async (montoDeclarado) => {
        setFase("verificando");

        // delay artificial de la spec (600-900ms) para que la transición se sienta intencional
        const [resultado] = await Promise.all([
            intentarCorte(montoDeclarado, fechaRef.current),
            new Promise((r) => setTimeout(r, 750)),
        ]);

        setDesglose(resultado.desglose);
        setUltimoResultado({ ...resultado, declarado: montoDeclarado });
        setFase(resultado.coincide ? "coincide" : "diferencia");
    }, []);

    const reintentar = useCallback(() => setFase("declarando"), []);

    const cerrar = useCallback(async (firma) => {
        const data = await cerrarCorte(firma, fechaRef.current);
        setCorte(data.corte);
        setDesglose(data.desglose);
        setFase("sellado");
    }, []);

    const cerrarConDiferencia = useCallback(async (firma) => {
        const data = await cerrarCorteConDiferencia(firma, fechaRef.current);
        setCorte(data.corte);
        setDesglose(data.desglose);
        setFase("sellado");
    }, []);

    return {
        fase,
        corte,
        desglose,
        ultimoResultado,
        avanzarConteo,
        declarar,
        reintentar,
        cerrar,
        cerrarConDiferencia,
    };
}
