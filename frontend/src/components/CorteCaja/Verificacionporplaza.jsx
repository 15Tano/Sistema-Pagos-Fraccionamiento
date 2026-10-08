import { useMemo, useState, useEffect } from "react";
import {
    ArrowLeft,
    ChevronRight,
    ReceiptText,
    Search,
    Tag,
    X,
} from "lucide-react";
import { getPlazasDelDia } from "../../lib/corteCaja";

// Modal de solo consulta: agrupa los pagos del día por calle ("plaza") para
// que el capturista pueda cruzar, plaza por plaza, cuánto efectivo entró en
// cada una contra su hoja física de conteo. No marca nada como "revisado" —
// es puramente informativo. Se abre desde un botón flotante en
// ResultadoDiferencia a partir del 2do intento.
//
// ARQUITECTURA: RESUMEN -> NAVEGACIÓN -> DETALLE (no accordion). El modal
// tiene dos "vistas" internas (lista / detalle) que conviven en el mismo
// contenedor y se deslizan lateralmente; nunca se abre un modal sobre otro.
// La vista de lista se mantiene compacta sin importar cuántos pagos existan
// — los pagos individuales solo se renderizan dentro de la plaza que el
// capturista seleccionó.
//
// Props:
//   onCerrar — cierra el modal (ej. setMostrarPlazas(false) en el padre)
export default function VerificacionPorPlaza({ onCerrar, fecha }) {
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(false);
    const [plazas, setPlazas] = useState([]);
    const [ventasTags, setVentasTags] = useState(null);

    const [vista, setVista] = useState("lista"); // "lista" | "detalle"
    const [plazaSeleccionada, setPlazaSeleccionada] = useState(null);
    const [busqueda, setBusqueda] = useState("");

    useEffect(() => {
        let cancelado = false;

        getPlazasDelDia(fecha)
            .then((data) => {
                if (cancelado) return;
                setPlazas(data.plazas ?? []);
                setVentasTags(data.ventas_tags ?? null);
            })
            .catch(() => {
                if (!cancelado) setError(true);
            })
            .finally(() => {
                if (!cancelado) setCargando(false);
            });

        return () => {
            cancelado = true;
        };
    }, [fecha]);

    const formatCurrency = (valor) =>
        new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
            maximumFractionDigits: 0,
        }).format(valor ?? 0);

    // Agregados calculados a partir de los datos existentes — no hay
    // endpoints ni campos nuevos, solo sumas sobre lo que ya llega.
    const totalPagos = useMemo(
        () => plazas.reduce((acc, p) => acc + (p.pagos?.length ?? 0), 0),
        [plazas],
    );
    const totalPorPlazas = useMemo(
        () => plazas.reduce((acc, p) => acc + (p.subtotal ?? 0), 0),
        [plazas],
    );

    // El orden de `plazas` se conserva tal cual llega del backend — no se
    // reordena por ningún criterio de negocio inventado.
    const mostrarBusqueda = plazas.length > 6;
    const plazasFiltradas = useMemo(() => {
        if (!busqueda.trim()) return plazas;
        const q = busqueda.trim().toLowerCase();
        return plazas.filter((p) => p.calle?.toLowerCase().includes(q));
    }, [plazas, busqueda]);

    const abrirPlaza = (plaza) => {
        setPlazaSeleccionada(plaza);
        setVista("detalle");
    };

    const volverALista = () => setVista("lista");

    const hayDatos = !cargando && !error && plazas.length > 0;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md rounded-[28px] bg-white/[0.92] backdrop-blur-2xl border border-white/80 shadow-2xl overflow-hidden">
                {/* Cerrar — persiste sin importar la vista activa */}
                <button
                    type="button"
                    onClick={onCerrar}
                    aria-label="Cerrar"
                    className="absolute top-4 right-4 z-20 flex items-center justify-center w-8 h-8 rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="p-6 pr-14">
                    {cargando && <EstadoCarga />}

                    {!cargando && error && <EstadoError onCerrar={onCerrar} />}

                    {!cargando && !error && plazas.length === 0 && (
                        <EstadoVacio />
                    )}

                    {hayDatos && (
                        <div className="relative h-[62vh] sm:h-[65vh] overflow-hidden">
                            {/* Vista: lista de plazas */}
                            <div
                                className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                                    vista === "lista"
                                        ? "translate-x-0"
                                        : "-translate-x-[101%] pointer-events-none"
                                }`}
                                aria-hidden={vista !== "lista"}
                            >
                                {/* Header + resumen — fijos, no scrollean */}
                                <div className="shrink-0">
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">
                                        Verificación por plaza
                                    </p>
                                    <p className="mt-1 text-xs text-stone-400">
                                        {plazas.length}{" "}
                                        {plazas.length === 1
                                            ? "plaza"
                                            : "plazas"}{" "}
                                        · {totalPagos}{" "}
                                        {totalPagos === 1 ? "pago" : "pagos"}
                                    </p>

                                    <div className="mt-4 flex items-end justify-between rounded-2xl bg-orange-50/70 border border-orange-100 px-4 py-3">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-orange-600/80">
                                            Total por plazas
                                        </span>
                                        <span className="text-xl font-bold tabular-nums text-stone-900">
                                            {formatCurrency(totalPorPlazas)}
                                        </span>
                                    </div>

                                    {mostrarBusqueda && (
                                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-stone-200 bg-white/70 px-3 py-2">
                                            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                            <input
                                                type="text"
                                                value={busqueda}
                                                onChange={(e) =>
                                                    setBusqueda(e.target.value)
                                                }
                                                placeholder="Buscar plaza..."
                                                aria-label="Buscar plaza"
                                                className="w-full bg-transparent text-sm text-stone-700 placeholder:text-stone-400 outline-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Lista — única parte que scrollea */}
                                <div
                                    className={`mt-3 flex-1 -ml-2 pl-2 ${
                                        vista === "lista"
                                            ? "overflow-y-auto"
                                            : "overflow-hidden"
                                    }`}
                                >
                                    {plazasFiltradas.length === 0 && (
                                        <p className="py-8 text-center text-sm text-stone-400">
                                            No se encontró ninguna plaza con ese
                                            nombre.
                                        </p>
                                    )}

                                    <div className="flex flex-col">
                                        {plazasFiltradas.map((plaza) => (
                                            <button
                                                key={plaza.calle}
                                                type="button"
                                                onClick={() =>
                                                    abrirPlaza(plaza)
                                                }
                                                className="group w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 py-3 px-2 -mx-2 text-left rounded-xl border-b border-stone-200/60 last:border-0 transition-colors hover:bg-orange-50/50"
                                            >
                                                <span className="text-sm font-semibold text-stone-800 truncate">
                                                    {plaza.calle}
                                                </span>
                                                <span className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                                                    <span className="text-xs text-stone-400 tabular-nums whitespace-nowrap">
                                                        {plaza.pagos?.length ??
                                                            0}{" "}
                                                        pagos
                                                    </span>
                                                    <span className="text-sm font-bold tabular-nums text-stone-900">
                                                        {formatCurrency(
                                                            plaza.subtotal,
                                                        )}
                                                    </span>
                                                    <ChevronRight className="hidden sm:block w-4 h-4 text-stone-300 transition-transform group-hover:translate-x-0.5" />
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    {ventasTags && ventasTags.cantidad > 0 && (
                                        <div className="mt-4 pt-4 border-t border-stone-200/70">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400 mb-2">
                                                Venta de tags
                                            </p>
                                            <div className="flex items-center justify-between rounded-2xl bg-stone-50 border border-stone-200 px-4 py-3">
                                                <span className="flex items-center gap-2 text-sm font-semibold text-stone-700">
                                                    <Tag className="w-3.5 h-3.5 text-stone-400" />
                                                    {ventasTags.cantidad}{" "}
                                                    {ventasTags.cantidad === 1
                                                        ? "tag vendido"
                                                        : "tags vendidos"}
                                                </span>
                                                <span className="text-sm font-bold tabular-nums text-stone-900">
                                                    {formatCurrency(
                                                        ventasTags.total,
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Vista: detalle de la plaza seleccionada */}
                            <div
                                className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                                    vista === "detalle"
                                        ? "translate-x-0"
                                        : "translate-x-[101%] pointer-events-none"
                                }`}
                                aria-hidden={vista !== "detalle"}
                            >
                                {plazaSeleccionada && (
                                    <>
                                        <div className="shrink-0">
                                            <button
                                                type="button"
                                                onClick={volverALista}
                                                className="group -ml-1 flex items-center gap-1.5 text-xs font-semibold text-stone-400 transition-colors hover:text-orange-600"
                                            >
                                                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                                                Todas las plazas
                                            </button>

                                            <p className="mt-3 text-lg font-bold uppercase tracking-wide text-stone-800">
                                                {plazaSeleccionada.calle}
                                            </p>
                                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-400">
                                                <ReceiptText className="w-3.5 h-3.5" />
                                                {plazaSeleccionada.pagos
                                                    ?.length ?? 0}{" "}
                                                {(plazaSeleccionada.pagos
                                                    ?.length ?? 0) === 1
                                                    ? "pago"
                                                    : "pagos"}
                                            </p>

                                            <p className="mt-2 text-3xl font-bold tabular-nums text-stone-900">
                                                {formatCurrency(
                                                    plazaSeleccionada.subtotal,
                                                )}
                                            </p>
                                        </div>

                                        <div
                                            className={`mt-4 pt-3 border-t border-stone-200/70 flex-1 -ml-2 pl-2 ${
                                                vista === "detalle"
                                                    ? "overflow-y-auto"
                                                    : "overflow-hidden"
                                            }`}
                                        >
                                            {(plazaSeleccionada.pagos ?? [])
                                                .length === 0 && (
                                                <p className="py-8 text-center text-sm text-stone-400">
                                                    Esta plaza no tiene pagos
                                                    registrados.
                                                </p>
                                            )}
                                            <div className="flex flex-col">
                                                {(
                                                    plazaSeleccionada.pagos ??
                                                    []
                                                ).map((pago) => (
                                                    <div
                                                        key={pago.id}
                                                        className="flex items-center justify-between gap-3 py-2.5 border-b border-stone-200/50 last:border-0"
                                                    >
                                                        <span className="text-sm text-stone-600 truncate">
                                                            {pago.vecino}
                                                        </span>
                                                        <span className="text-sm font-semibold tabular-nums text-stone-800 shrink-0">
                                                            {formatCurrency(
                                                                pago.cantidad,
                                                            )}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function EstadoCarga() {
    return (
        <div className="pr-2">
            <div className="h-3 w-40 rounded bg-stone-200/70 animate-pulse" />
            <div className="mt-2 h-3 w-24 rounded bg-stone-200/50 animate-pulse" />
            <div className="mt-4 h-14 w-full rounded-2xl bg-stone-200/50 animate-pulse" />
            <div className="mt-4 flex flex-col gap-2.5">
                {[0, 1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="h-10 w-full rounded-xl bg-stone-200/40 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

function EstadoError({ onCerrar }) {
    return (
        <div className="py-6 text-center">
            <p className="text-sm text-orange-600">
                No se pudo cargar el detalle por plaza.
            </p>
            <button
                type="button"
                onClick={onCerrar}
                className="mt-4 rounded-xl bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-200"
            >
                Cerrar
            </button>
        </div>
    );
}

function EstadoVacio() {
    return (
        <p className="py-6 text-center text-sm text-stone-400">
            No hay pagos registrados hoy.
        </p>
    );
}
