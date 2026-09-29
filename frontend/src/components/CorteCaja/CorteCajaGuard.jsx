import useAuthStore from "../../store/authStore";
import useCorteCaja from "../../hooks/useCorteCaja";
import PasoDeclaracion from "./PasoDeclaracion";
import PasoVerificando from "./PasoVerificando";
import ResultadoCoincide from "./ResultadoCoincide";
import ResultadoDiferencia from "./ResultadoDiferencia";
import PantallaSellada from "./PantallaSellada";
import InterrupcionAviso from "./InterrupcionAviso";

export default function CorteCajaGuard() {
    const { user } = useAuthStore();
    const esCapturista = user?.role === "capturista";

    const {
        fase,
        corte,
        desglose,
        ultimoResultado,
        avanzarConteo,
        declarar,
        reintentar,
        cerrar,
        cerrarConDiferencia,
    } = useCorteCaja(esCapturista);
    console.log("GUARD fase:", fase, "| reabierto_at:", corte?.reabierto_at);

    if (!esCapturista || fase === "inactivo") return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center">
            {/* fondo: blur + overlay translúcido sobre el dashboard que sigue detrás */}
            <div className="absolute inset-0 backdrop-blur-sm bg-white/30" />

            <div className="relative w-full max-w-md mx-4">
                {fase === "interrupcion" && (
                    <InterrupcionAviso onContinuar={avanzarConteo} />
                )}

                {fase === "declarando" && (
                    <PasoDeclaracion onDeclarar={declarar} />
                )}
                {fase === "verificando" && <PasoVerificando />}
                {fase === "coincide" && (
                    <ResultadoCoincide
                        resultado={ultimoResultado}
                        desglose={desglose}
                        fecha={corte?.fecha}
                        onCerrar={cerrar}
                    />
                )}
                {fase === "diferencia" && (
                    <ResultadoDiferencia
                        resultado={ultimoResultado}
                        desglose={desglose}
                        corte={corte}
                        onReintentar={reintentar}
                        onCerrarConDiferencia={cerrarConDiferencia}
                    />
                )}
                {fase === "sellado" && (
                    <PantallaSellada corte={corte} desglose={desglose} />
                )}
            </div>
        </div>
    );
}
