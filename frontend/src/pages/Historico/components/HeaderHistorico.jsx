// Punto 10: el capturista solo ve "Por Día de Cobro", así que el título
// genérico "Histórico de Pagos" se sentía vacío/fuera de contexto para su rol.
function HeaderHistorico({ esCapturista }) {
    if (esCapturista) {
        return (
            <div className="mb-2 px-2">
                <h1 className="text-3xl font-semibold text-stone-800 mb-1">
                    Tu Resumen de Cobro del Día
                </h1>
                <p className="text-sm text-stone-500">
                    Pagos que has registrado en la fecha seleccionada
                </p>
            </div>
        );
    }

    return (
        <div className="mb-2 px-2">
            <h1 className="text-3xl font-semibold text-stone-800 mb-1">
                Histórico de Pagos
            </h1>
            <p className="text-sm text-stone-500">
                Seguimiento completo de pagos vecinales
            </p>
        </div>
    );
}

export default HeaderHistorico;
