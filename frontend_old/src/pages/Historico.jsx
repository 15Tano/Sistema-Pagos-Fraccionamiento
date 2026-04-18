import { useState, useEffect, useMemo } from "react";
import api from "../api";

const MONTHLY_FEE = 280;
const CURRENT_MONTH_ISO = new Date().toISOString().slice(0, 7);

function Historico() {
    const [pagos, setPagos] = useState([]);
    const [vecinos, setVecinos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("resumen");

    const [selectedCalle, setSelectedCalle] = useState("");
    const [selectedVecino, setSelectedVecino] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH_ISO);
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().slice(0, 10)
    );
    const [selectedCollectionMonth, setSelectedCollectionMonth] =
        useState(CURRENT_MONTH_ISO);
    const [searchTipo, setSearchTipo] = useState("");
    const [showOnlyDue, setShowOnlyDue] = useState(false);

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

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchVecinos(), fetchPagos()]);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchVecinos = async () => {
        try {
            const response = await api.get("/vecinos");
            setVecinos(response.data);
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

            const response = await api.get("/pagos/historico", { params });
            setPagos(response.data);
        } catch (error) {
            console.error("Error fetching pagos:", error);
        } finally {
            setLoading(false);
        }
    };

    const uniqueCalles = useMemo(
        () => [...new Set(vecinos.map((v) => v.calle))].sort(),
        [vecinos]
    );

    const filteredVecinos = useMemo(
        () =>
            selectedCalle
                ? vecinos
                      .filter((v) => v.calle === selectedCalle)
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                : vecinos.sort((a, b) => a.nombre.localeCompare(b.nombre)),
        [vecinos, selectedCalle]
    );

    const currentMonthSummary = useMemo(() => {
        const currentMonthPayments = pagos.filter(
            (p) => p.mes === CURRENT_MONTH_ISO
        );

        return vecinos.map((vecino) => {
            const vecinoPayments = currentMonthPayments.filter(
                (p) => p.vecino_id === vecino.id
            );
            const totalPaid = vecinoPayments.reduce(
                (sum, p) => sum + parseFloat(p.cantidad),
                0
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
            (p) => p.mes === CURRENT_MONTH_ISO
        );

        const ordinarioTotal = currentMonthPayments
            .filter((p) => p.tipo === "ordinario")
            .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

        const extraordinarioTotal = currentMonthPayments
            .filter((p) => p.tipo === "extraordinario")
            .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

        return { ordinarioTotal, extraordinarioTotal };
    }, [pagos]);

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
            className={`px-4 py-2 font-medium text-sm rounded-lg transition ${
                activeTab === id
                    ? "bg-orange-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
        >
            {label}
            {count !== undefined && (
                <span
                    className={`ml-2 px-2 py-1 text-xs rounded-full ${
                        activeTab === id ? "bg-orange-500" : "bg-gray-300"
                    }`}
                >
                    {count}
                </span>
            )}
        </button>
    );

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-6">
                <div className="bg-white p-8 rounded-xl shadow-lg">
                    <div className="flex justify-center items-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <span className="ml-3 text-gray-600">
                            Cargando historial...
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900">
                    Histórico de Pagos
                </h1>
                <p className="text-gray-600 mt-2">
                    Sistema completo de seguimiento de pagos vecinales
                </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex flex-wrap gap-2 mb-6">
                    <TabButton
                        id="resumen"
                        label="Resumen General"
                        count={vecinos.length}
                    />
                    <TabButton id="individual" label="Por Vecino" />
                    <TabButton id="mensual" label="Por Mes Pagado" />
                    <TabButton id="mes_cobro" label="Por Mes de Cobro" />
                    <TabButton id="por_dia" label="Por Día de Cobro" />
                    <TabButton
                        id="adelantados"
                        label="Pagos Adelantados"
                        count={
                            pagos.filter((p) => p.mes > CURRENT_MONTH_ISO)
                                .length
                        }
                    />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
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
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
                                            e.target.value
                                        )
                                    }
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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

            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                {activeTab === "resumen" && (
                    <div>
                        <div className="px-6 py-4 bg-orange-50 border-b border-orange-200">
                            <h3 className="text-xl font-semibold text-orange-900">
                                Resumen del Mes Actual (
                                {formatMonth(CURRENT_MONTH_ISO)})
                            </h3>
                            <p className="text-orange-700 text-sm">
                                Estado de pagos de todos los vecinos
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Vecino
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Dirección
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Estado
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Pagado
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Restante
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Tag
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredCurrentMonthSummary.map(
                                        (vecino) => (
                                            <tr
                                                key={vecino.id}
                                                className="hover:bg-gray-50"
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-medium text-gray-900">
                                                        {vecino.nombre}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {vecino.calle} #
                                                    {vecino.numero_casa}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {getPaymentStatusBadge(
                                                        vecino.totalPaid,
                                                        vecino.totalRemaining
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    $
                                                    {vecino.totalPaid.toFixed(
                                                        2
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    $
                                                    {vecino.totalRemaining.toFixed(
                                                        2
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {vecino.tags &&
                                                    vecino.tags.length > 0 ? (
                                                        vecino.tags
                                                            .map(
                                                                (tag) =>
                                                                    tag.codigo
                                                            )
                                                            .join(", ")
                                                    ) : (
                                                        <span className="text-gray-400 italic">
                                                            Sin Tag
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">
                                        {
                                            filteredCurrentMonthSummary.filter(
                                                (v) => v.isComplete
                                            ).length
                                        }
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Pagos Completos
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-orange-600">
                                        {
                                            filteredCurrentMonthSummary.filter(
                                                (v) =>
                                                    v.hasPaid && !v.isComplete
                                            ).length
                                        }
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Pagos Parciales
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-red-600">
                                        {
                                            filteredCurrentMonthSummary.filter(
                                                (v) => !v.hasPaid
                                            ).length
                                        }
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Sin Pagar
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-gray-200">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-orange-600">
                                        $
                                        {paymentTypeSummary.ordinarioTotal.toFixed(
                                            2
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Recaudado Ordinario (Mes Actual)
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-orange-600">
                                        $
                                        {paymentTypeSummary.extraordinarioTotal.toFixed(
                                            2
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Recaudado Extraordinario (Mes Actual)
                                    </div>
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
                        <div className="px-6 py-4 bg-green-50 border-b border-green-200">
                            <h3 className="text-xl font-semibold text-green-900">
                                {activeTab === "individual" &&
                                    `Historial Individual`}
                                {activeTab === "mensual" &&
                                    `Pagos del Mes: ${formatMonth(
                                        selectedMonth
                                    )}`}
                                {activeTab === "mes_cobro" &&
                                    `Pagos Cobrados en: ${formatMonth(
                                        selectedCollectionMonth
                                    )}`}
                                {activeTab === "por_dia" &&
                                    `Pagos del Día: ${formatDate(
                                        selectedDate
                                    )}`}
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
                                    <thead className="bg-green-600 text-white">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                                Vecino
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                                Dirección
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                                Mes Pagado
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                                Tipo
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                                Cantidad
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                                Estado
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
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
                                                    className="hover:bg-gray-50"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="font-medium text-gray-900">
                                                            {pago.vecino.nombre}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {pago.vecino.calle} #
                                                        {
                                                            pago.vecino
                                                                .numero_casa
                                                        }
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {formatMonth(pago.mes)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                                pago.tipo ===
                                                                "extraordinario"
                                                                    ? "bg-orange-100 text-orange-800"
                                                                    : "bg-blue-100 text-blue-800"
                                                            }`}
                                                        >
                                                            {pago.tipo
                                                                .charAt(0)
                                                                .toUpperCase() +
                                                                pago.tipo.slice(
                                                                    1
                                                                )}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        $
                                                        {parseFloat(
                                                            pago.cantidad
                                                        ).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {pago.restante > 0 ? (
                                                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                                                                Resta $
                                                                {parseFloat(
                                                                    pago.restante
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
                                                                  pago.fecha_de_cobro
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
                    <div className="px-6 py-4 bg-gray-50 border-t">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="text-center">
                                <div className="text-xl font-bold text-orange-500">
                                    $
                                    {pagos
                                        .reduce(
                                            (sum, p) =>
                                                sum + parseFloat(p.cantidad),
                                            0
                                        )
                                        .toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Total Recaudado
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-bold text-gray-900">
                                    $
                                    {pagos
                                        .reduce(
                                            (sum, p) =>
                                                sum + parseFloat(p.restante),
                                            0
                                        )
                                        .toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Total Restante
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Historico;
