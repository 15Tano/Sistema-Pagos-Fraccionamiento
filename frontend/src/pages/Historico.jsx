import { useState, useEffect, useMemo } from "react";
import api from "../lib/axios";
import { getTagSales } from "../api/tags";
// AGREGA después del último import:
import useAuthStore from "../store/authStore";

const MONTHLY_FEE = 280;
const CURRENT_MONTH_ISO = new Date().toISOString().slice(0, 7);

function Historico() {
    const { user } = useAuthStore();
    const esCapturista = user?.role === "capturista";
    const [pagos, setPagos] = useState([]);
    const [vecinos, setVecinos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("resumen");

    const [selectedCalle, setSelectedCalle] = useState("");
    const [selectedVecino, setSelectedVecino] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH_ISO);
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().slice(0, 10),
    );
    const [selectedCollectionMonth, setSelectedCollectionMonth] =
        useState(CURRENT_MONTH_ISO);
    const [searchTipo, setSearchTipo] = useState("");
    const [showOnlyDue, setShowOnlyDue] = useState(false);
    const [tagSales, setTagSales] = useState([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (activeTab !== "resumen") {
            fetchPagos();
        }
    }, [
        activeTab,
        selectedCalle,
        selectedVecino,
        selectedMonth,
        selectedDate,
        selectedCollectionMonth,
        searchTipo,
    ]);

    // AGREGA después del useState de activeTab:
    useEffect(() => {
        if (esCapturista) setActiveTab("por_dia");
    }, [esCapturista]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [, , tagSalesRes] = await Promise.all([
                fetchVecinos(),
                fetchPagos(),
                getTagSales(),
            ]);
            setTagSales(tagSalesRes.data || []);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchVecinos = async () => {
        try {
            const response = await api.get("/vecinos?per_page=500");
            setVecinos(response.data.data || response.data || []);
        } catch (error) {
            console.error("Error fetching vecinos:", error);
        }
    };

    const fetchPagos = async () => {
        if (activeTab === "resumen" && pagos.length > 0) return;

        setLoading(true);
        try {
            const params = {};

            if (activeTab === "mensual") {
                params.mes = selectedMonth;
            } else if (activeTab === "individual" && selectedVecino) {
                params.vecino_id = selectedVecino;
            } else if (activeTab === "adelantados") {
                params.adelantados = true;
            } else if (activeTab === "por_dia") {
                params.fecha_cobro = selectedDate;
            } else if (activeTab === "mes_cobro") {
                params.mes_cobro = selectedCollectionMonth;
            }

            if (selectedCalle && activeTab !== "individual") {
                params.calle = selectedCalle;
            }
            if (searchTipo) {
                params.tipo = searchTipo;
            }

            const response = await api.get("/pagos/historico", {
                params: { ...params, per_page: 9999 },
            });

            setPagos(response.data.data || response.data || []);
        } catch (error) {
            console.error("Error fetching pagos:", error);
        } finally {
            setLoading(false);
        }
    };

    const uniqueCalles = useMemo(
        () => [...new Set(vecinos.map((v) => v.calle))].sort(),
        [vecinos],
    );

    const filteredVecinos = useMemo(
        () =>
            selectedCalle
                ? vecinos
                      .filter((v) => v.calle === selectedCalle)
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                : vecinos.sort((a, b) => a.nombre.localeCompare(b.nombre)),
        [vecinos, selectedCalle],
    );

    const currentMonthSummary = useMemo(() => {
        const currentMonthPayments = pagos.filter(
            (p) => p.mes === CURRENT_MONTH_ISO,
        );

        return vecinos.map((vecino) => {
            const vecinoPayments = currentMonthPayments.filter(
                (p) => p.vecino_id === vecino.id,
            );
            const totalPaid = vecinoPayments.reduce(
                (sum, p) => sum + parseFloat(p.cantidad),
                0,
            );

            const totalRemaining =
                vecinoPayments.length > 0
                    ? vecinoPayments[0].restante
                    : MONTHLY_FEE;

            const vecinoData =
                vecinoPayments.length > 0 ? vecinoPayments[0].vecino : vecino;

            return {
                ...vecinoData,
                totalPaid,
                totalRemaining: parseFloat(totalRemaining),
                hasPaid: totalPaid > 0,
                isComplete: parseFloat(totalRemaining) === 0 && totalPaid > 0,
                payments: vecinoPayments,
            };
        });
    }, [vecinos, pagos]);

    const filteredCurrentMonthSummary = useMemo(() => {
        let filtered = currentMonthSummary;
        if (selectedCalle) {
            filtered = filtered.filter((v) => v.calle === selectedCalle);
        }
        if (showOnlyDue) {
            filtered = filtered.filter((v) => v.totalRemaining > 0);
        }
        return filtered;
    }, [currentMonthSummary, selectedCalle, showOnlyDue]);

    const paymentTypeSummary = useMemo(() => {
        const currentMonthPayments = pagos.filter(
            (p) => p.mes === CURRENT_MONTH_ISO,
        );

        const ordinarioTotal = currentMonthPayments
            .filter((p) => p.tipo === "ordinario")
            .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

        const extraordinarioTotal = currentMonthPayments
            .filter((p) => p.tipo === "extraordinario")
            .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

        return { ordinarioTotal, extraordinarioTotal };
    }, [pagos]);

    const resumenFinanciero = useMemo(() => {
        const currentMonthPayments = pagos.filter(
            (p) => p.mes === CURRENT_MONTH_ISO,
        );

        // Pagos ordinarios a $280 (cuota base)
        const ordinario = currentMonthPayments
            .filter(
                (p) => p.tipo === "ordinario" && parseFloat(p.cantidad) === 280,
            )
            .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

        // Multas extraordinarias (tipo extraordinario)
        const extraordinario = currentMonthPayments
            .filter((p) => p.tipo === "extraordinario")
            .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

        // Pagos especiales: ordinarios pero con cantidad distinta a 280 ($300, $500, etc.)
        const especiales = currentMonthPayments
            .filter(
                (p) => p.tipo === "ordinario" && parseFloat(p.cantidad) !== 280,
            )
            .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

        // Ventas de tags del mes actual
        const ventasTags = tagSales
            .filter(
                (s) =>
                    (s.sold_at || s.created_at || "").slice(0, 7) ===
                    CURRENT_MONTH_ISO,
            )
            .reduce((sum, s) => sum + parseFloat(s.price || 150), 0);

        const total = ordinario + extraordinario + especiales + ventasTags;

        return { ordinario, extraordinario, especiales, ventasTags, total };
    }, [pagos, tagSales]);

    const formatMonth = (monthString) => {
        if (!monthString) return "-";
        const [year, month] = monthString.split("-");
        const date = new Date(year, month - 1);
        return date.toLocaleDateString("es-ES", {
            year: "numeric",
            month: "long",
        });
    };

    const formatDate = (dateString) => {
        if (!dateString) return "-";
        // Extract just the date part (YYYY-MM-DD)
        const datePart = dateString.split("T")[0];
        const [year, month, day] = datePart.split("-");
        return `${day}/${month}/${year}`; // DD/MM/YYYY format
    };

    const getPaymentStatusBadge = (totalPaid, totalRemaining) => {
        if (totalPaid === 0) {
            return (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                    Sin Pagar
                </span>
            );
        } else if (totalRemaining === 0) {
            return (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    Completo
                </span>
            );
        } else {
            return (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                    Parcial
                </span>
            );
        }
    };

    const clearFilters = () => {
        setSelectedCalle("");
        setSelectedVecino("");
        setSelectedMonth(CURRENT_MONTH_ISO);
        setSelectedDate(new Date().toISOString().slice(0, 10));
        setSelectedCollectionMonth(CURRENT_MONTH_ISO);
        setSearchTipo("");
        setShowOnlyDue(false);
    };

    const TabButton = ({ id, label, count }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 font-medium text-sm rounded-xl transition-all duration-200 ${
                activeTab === id
                    ? "bg-orange-500 text-white shadow-md"
                    : "bg-white/60 backdrop-blur-sm border border-black/08 text-stone-600 hover:bg-white"
            }`}
        >
            {label}
            {count !== undefined && (
                <span
                    className={`ml-2 px-1.5 py-0.5 text-xs rounded-full font-700 ${
                        activeTab === id
                            ? "bg-orange-400 text-white"
                            : "bg-stone-200 text-stone-600"
                    }`}
                >
                    {count}
                </span>
            )}
        </button>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-stone-500 text-sm">
                        Cargando historial...
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="mb-2">
                <h1 className="text-3xl font-bold text-stone-800 mb-1">
                    Histórico de Pagos
                </h1>
                <p className="text-sm text-stone-500">
                    Seguimiento completo de pagos vecinales
                </p>
            </div>

            <div className="glass-card">
                <div className="glass-card-shine" />{" "}
                <div className="flex flex-wrap gap-2 mb-6">
                    {!esCapturista && (
                        <TabButton
                            id="resumen"
                            label="Resumen General"
                            count={vecinos.length}
                        />
                    )}
                    {!esCapturista && (
                        <TabButton id="individual" label="Por Vecino" />
                    )}
                    {!esCapturista && (
                        <TabButton id="mensual" label="Por Mes Pagado" />
                    )}
                    {!esCapturista && (
                        <TabButton id="mes_cobro" label="Por Mes de Cobro" />
                    )}
                    <TabButton id="por_dia" label="Por Día de Cobro" />
                    {!esCapturista && (
                        <TabButton
                            id="adelantados"
                            label="Pagos Adelantados"
                            count={
                                pagos.filter((p) => p.mes > CURRENT_MONTH_ISO)
                                    .length
                            }
                        />
                    )}
                </div>
                <div className="bg-white/40 p-4 rounded-xl border border-black/05">
                    {" "}
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-48">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Calle
                            </label>
                            <select
                                value={selectedCalle}
                                onChange={(e) => {
                                    setSelectedCalle(e.target.value);
                                    if (activeTab === "individual")
                                        setSelectedVecino("");
                                }}
                                className="vecino-input w-full"
                            >
                                <option value="">Todas las calles</option>
                                {uniqueCalles.map((calle) => (
                                    <option key={calle} value={calle}>
                                        {calle}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {activeTab === "individual" && (
                            <div className="flex-1 min-w-48">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Vecino
                                </label>
                                <select
                                    value={selectedVecino}
                                    onChange={(e) =>
                                        setSelectedVecino(e.target.value)
                                    }
                                    className="vecino-input w-full"
                                >
                                    <option value="">Seleccionar vecino</option>
                                    {filteredVecinos.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.nombre} - {v.calle} #
                                            {v.numero_casa}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {activeTab === "mensual" && (
                            <div className="flex-1 min-w-48">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Mes Pagado
                                </label>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) =>
                                        setSelectedMonth(e.target.value)
                                    }
                                    className="vecino-input w-full"
                                />
                            </div>
                        )}

                        {activeTab === "mes_cobro" && (
                            <div className="flex-1 min-w-48">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Mes de Cobro
                                </label>
                                <input
                                    type="month"
                                    value={selectedCollectionMonth}
                                    onChange={(e) =>
                                        setSelectedCollectionMonth(
                                            e.target.value,
                                        )
                                    }
                                    className="vecino-input w-full"
                                />
                            </div>
                        )}

                        {activeTab === "por_dia" && (
                            <div className="flex-1 min-w-48">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fecha de Cobro
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) =>
                                        setSelectedDate(e.target.value)
                                    }
                                    className="vecino-input w-full"
                                />
                            </div>
                        )}

                        {activeTab !== "resumen" && (
                            <div className="flex-1 min-w-48">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tipo
                                </label>
                                <select
                                    value={searchTipo}
                                    onChange={(e) =>
                                        setSearchTipo(e.target.value)
                                    }
                                    className="vecino-input w-full"
                                >
                                    <option value="">Todos los tipos</option>
                                    <option value="ordinario">Ordinario</option>
                                    <option value="extraordinario">
                                        Extraordinario
                                    </option>
                                </select>
                            </div>
                        )}

                        {activeTab === "resumen" && (
                            <div className="flex items-center pt-6">
                                <input
                                    type="checkbox"
                                    id="showOnlyDue"
                                    checked={showOnlyDue}
                                    onChange={(e) =>
                                        setShowOnlyDue(e.target.checked)
                                    }
                                    className="mr-2 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                                />
                                <label
                                    htmlFor="showOnlyDue"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Solo con adeudos
                                </label>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                            >
                                Limpiar
                            </button>
                            {activeTab !== "resumen" && (
                                <button
                                    onClick={fetchPagos}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                                >
                                    Actualizar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card overflow-hidden">
                <div className="glass-card-shine" />
                {activeTab === "resumen" && (
                    <div>
                        <div className="px-6 py-4 border-b border-black/06">
                            <h3 className="text-sm font-700 text-stone-800">
                                Resumen del Mes Actual (
                                {formatMonth(CURRENT_MONTH_ISO)})
                            </h3>
                            <p className="text-orange-700 text-sm">
                                Estado de pagos de todos los vecinos
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-black/03">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                            Vecino
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                            Dirección
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                            Estado
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                            Pagado
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                            Restante
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                            Tag
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredCurrentMonthSummary.map(
                                        (vecino) => (
                                            <tr
                                                key={vecino.id}
                                                className="hover:bg-orange-50/40 transition-colors"
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <p className="item-name">
                                                        {vecino.nombre}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {vecino.calle} #
                                                    {vecino.numero_casa}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {getPaymentStatusBadge(
                                                        vecino.totalPaid,
                                                        vecino.totalRemaining,
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    $
                                                    {vecino.totalPaid.toFixed(
                                                        2,
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    $
                                                    {vecino.totalRemaining.toFixed(
                                                        2,
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {vecino.tags &&
                                                    vecino.tags.length > 0 ? (
                                                        vecino.tags
                                                            .map(
                                                                (tag) =>
                                                                    tag.codigo,
                                                            )
                                                            .join(", ")
                                                    ) : (
                                                        <span className="text-gray-400 italic">
                                                            Sin Tag
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="border-t border-black/06">
                            {/* Fila 1: contadores de estado */}
                            <div className="grid grid-cols-3 gap-0 divide-x divide-black/06 border-b border-black/06">
                                <div className="px-6 py-4 text-center">
                                    <p className="text-2xl font-bold text-green-600">
                                        {
                                            filteredCurrentMonthSummary.filter(
                                                (v) => v.isComplete,
                                            ).length
                                        }
                                    </p>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                        Pagos completos
                                    </p>
                                </div>
                                <div className="px-6 py-4 text-center">
                                    <p className="text-2xl font-bold text-orange-500">
                                        {
                                            filteredCurrentMonthSummary.filter(
                                                (v) =>
                                                    v.hasPaid && !v.isComplete,
                                            ).length
                                        }
                                    </p>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                        Pagos parciales
                                    </p>
                                </div>
                                <div className="px-6 py-4 text-center">
                                    <p className="text-2xl font-bold text-red-500">
                                        {
                                            filteredCurrentMonthSummary.filter(
                                                (v) => !v.hasPaid,
                                            ).length
                                        }
                                    </p>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                        Sin pagar
                                    </p>
                                </div>
                            </div>

                            {/* Fila 2: desglose financiero */}
                            <div className="px-6 py-4">
                                <p className="text-xs font-700 text-stone-500 uppercase tracking-wide mb-3">
                                    Desglose financiero —{" "}
                                    {new Date().toLocaleDateString("es-MX", {
                                        month: "long",
                                        year: "numeric",
                                    })}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                    {/* Ordinarios $280 */}
                                    <div className="bg-white/60 border border-black/06 rounded-xl px-4 py-3">
                                        <p className="text-xs text-stone-400 mb-1">
                                            Cuotas ordinarias
                                        </p>
                                        <p className="text-lg font-bold text-stone-800">
                                            $
                                            {resumenFinanciero.ordinario.toLocaleString(
                                                "es-MX",
                                            )}
                                        </p>
                                        <p className="text-xs text-stone-400">
                                            a $280 c/u
                                        </p>
                                    </div>

                                    {/* Extraordinarios */}
                                    <div className="bg-white/60 border border-black/06 rounded-xl px-4 py-3">
                                        <p className="text-xs text-stone-400 mb-1">
                                            Multas extraordinarias
                                        </p>
                                        <p className="text-lg font-bold text-stone-800">
                                            $
                                            {resumenFinanciero.extraordinario.toLocaleString(
                                                "es-MX",
                                            )}
                                        </p>
                                        <p className="text-xs text-stone-400">
                                            tipo extraordinario
                                        </p>
                                    </div>

                                    {/* Especiales $300/$500 */}
                                    <div className="bg-white/60 border border-black/06 rounded-xl px-4 py-3">
                                        <p className="text-xs text-stone-400 mb-1">
                                            Pagos especiales
                                        </p>
                                        <p className="text-lg font-bold text-stone-800">
                                            $
                                            {resumenFinanciero.especiales.toLocaleString(
                                                "es-MX",
                                            )}
                                        </p>
                                        <p className="text-xs text-stone-400">
                                            $300, $500, etc.
                                        </p>
                                    </div>

                                    {/* Ventas de tags */}
                                    <div className="bg-white/60 border border-black/06 rounded-xl px-4 py-3">
                                        <p className="text-xs text-stone-400 mb-1">
                                            Ventas de tags
                                        </p>
                                        <p className="text-lg font-bold text-stone-800">
                                            $
                                            {resumenFinanciero.ventasTags.toLocaleString(
                                                "es-MX",
                                            )}
                                        </p>
                                        <p className="text-xs text-stone-400">
                                            {
                                                tagSales.filter(
                                                    (s) =>
                                                        (
                                                            s.sold_at ||
                                                            s.created_at ||
                                                            ""
                                                        ).slice(0, 7) ===
                                                        CURRENT_MONTH_ISO,
                                                ).length
                                            }{" "}
                                            tags · $150 c/u
                                        </p>
                                    </div>
                                </div>

                                {/* Total general */}
                                <div className="flex items-center justify-between bg-orange-50/80 border border-orange-200/60 rounded-xl px-5 py-3">
                                    <p className="text-sm font-700 text-stone-700">
                                        Total ingresado este mes
                                    </p>
                                    <p className="text-2xl font-bold text-orange-600">
                                        $
                                        {resumenFinanciero.total.toLocaleString(
                                            "es-MX",
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {[
                    "individual",
                    "mensual",
                    "mes_cobro",
                    "por_dia",
                    "adelantados",
                ].includes(activeTab) && (
                    <div>
                        <div className="px-6 py-4 border-b border-black/06">
                            <h3 className="text-sm font-700 text-stone-800">
                                {activeTab === "individual" &&
                                    `Historial Individual`}
                                {activeTab === "mensual" &&
                                    `Pagos del Mes: ${formatMonth(selectedMonth)}`}
                                {activeTab === "mes_cobro" &&
                                    `Pagos Cobrados en: ${formatMonth(selectedCollectionMonth)}`}
                                {activeTab === "por_dia" &&
                                    `Pagos del Día: ${formatDate(selectedDate)}`}
                                {activeTab === "adelantados" &&
                                    `Pagos Adelantados`}
                            </h3>
                        </div>

                        {activeTab === "individual" && !selectedVecino ? (
                            <div className="p-12 text-center text-gray-500">
                                <div className="text-4xl mb-4">👤</div>
                                <div className="text-lg font-medium mb-2">
                                    Seleccione un vecino
                                </div>
                                <div className="text-sm">
                                    Use los filtros para seleccionar un vecino y
                                    ver su historial completo
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-black/03">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                                Vecino
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                                Dirección
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                                Mes Pagado
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                                Tipo
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                                Cantidad
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                                Estado
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wide">
                                                Fecha Cobro
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {pagos.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan="7"
                                                    className="px-6 py-8 text-center text-gray-500"
                                                >
                                                    No hay pagos registrados
                                                </td>
                                            </tr>
                                        ) : (
                                            pagos.map((pago) => (
                                                <tr
                                                    key={pago.id}
                                                    className="hover:bg-orange-50/40 transition-colors"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <p className="item-name">
                                                            {pago.vecino.nombre}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        <p className="item-sub">
                                                            {pago.vecino.calle}{" "}
                                                            #
                                                            {
                                                                pago.vecino
                                                                    .numero_casa
                                                            }
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {formatMonth(pago.mes)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`px-2 py-1 text-xs font-medium rounded-full ${pago.tipo === "extraordinario" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}`}
                                                        >
                                                            {pago.tipo
                                                                .charAt(0)
                                                                .toUpperCase() +
                                                                pago.tipo.slice(
                                                                    1,
                                                                )}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        $
                                                        {parseFloat(
                                                            pago.cantidad,
                                                        ).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {pago.restante > 0 ? (
                                                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                                                                Resta $
                                                                {parseFloat(
                                                                    pago.restante,
                                                                ).toFixed(2)}
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                                                Completo
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {pago.fecha_de_cobro
                                                            ? formatDate(
                                                                  pago.fecha_de_cobro,
                                                              )
                                                            : "-"}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
                {activeTab !== "resumen" && pagos.length > 0 && (
                    <div className="px-6 py-4 border-t border-black/06">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="text-center">
                                <p className="text-xl font-bold text-orange-500">
                                    $
                                    {pagos
                                        .reduce(
                                            (sum, p) =>
                                                sum + parseFloat(p.cantidad),
                                            0,
                                        )
                                        .toFixed(2)}
                                </p>
                                <p className="text-xs text-stone-500 mt-0.5">
                                    Total Recaudado
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-bold text-gray-900">
                                    $
                                    {pagos
                                        .reduce(
                                            (sum, p) =>
                                                sum + parseFloat(p.restante),
                                            0,
                                        )
                                        .toFixed(2)}
                                </p>
                                <p className="text-xs text-stone-500 mt-0.5">
                                    Total Restante
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Historico;
