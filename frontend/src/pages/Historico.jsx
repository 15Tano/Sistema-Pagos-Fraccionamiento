import { useState, useEffect, useMemo } from "react";
import api from "../api";

// Constants for repeated values
const MONTHLY_FEE = 280;
const CURRENT_MONTH_ISO = new Date().toISOString().slice(0, 7);

function Historico() {
    const [pagos, setPagos] = useState([]);
    const [vecinos, setVecinos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("resumen"); // resumen, individual, mensual, por_dia, adelantados

    // Filters
    const [selectedCalle, setSelectedCalle] = useState("");
    const [selectedVecino, setSelectedVecino] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH_ISO);
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().slice(0, 10)
    );
    const [searchTipo, setSearchTipo] = useState("");

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        // Fetch payments when tab or filters change, except for 'resumen'
        if (activeTab !== "resumen") {
            fetchPagos();
        }
    }, [
        activeTab,
        selectedCalle,
        selectedVecino,
        selectedMonth,
        selectedDate,
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
        // For 'resumen', we only fetch once on initial load.
        if (activeTab === "resumen" && pagos.length > 0) {
            return;
        }

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

    // Computed values
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

    // Create payment summary for current month
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
        setSearchTipo("");
    };

    const TabButton = ({ id, label, count }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 font-medium text-sm rounded-lg transition ${
                activeTab === id
                    ? "bg-orange-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-orange-200 transform hover:scale-105"
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
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-orange-600">
                    Histórico de Pagos
                </h1>
                <p className="text-gray-600 mt-2">
                    Sistema completo de seguimiento de pagos vecinales
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex flex-wrap gap-2 mb-6">
                    <TabButton
                        id="resumen"
                        label="Resumen General"
                        count={vecinos.length}
                    />
                    <TabButton id="individual" label="Por Vecino" />
                    <TabButton id="mensual" label="Por Mes" />
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

                {/* Filters */}
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
                                    Mes
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

                        <div className="flex gap-2">
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition transform hover:scale-105"
                            >
                                Limpiar
                            </button>
                            {activeTab !== "resumen" && (
                                <button
                                    onClick={fetchPagos}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition transform hover:scale-105"
                                >
                                    Actualizar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                {/* Resumen General Tab */}
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
                                <thead className="bg-orange-600 text-white">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Vecino
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Dirección
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Estado
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Pagado
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Restante
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Tag
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {currentMonthSummary
                                        .filter(
                                            (v) =>
                                                !selectedCalle ||
                                                v.calle === selectedCalle
                                        )
                                        .map((vecino) => (
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
                                        ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">
                                        {
                                            currentMonthSummary.filter(
                                                (v) => v.isComplete
                                            ).length
                                        }
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Pagos Completos
                                    </div>
                                </div>
                                <div className="text-center"></div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-red-600">
                                        {
                                            currentMonthSummary.filter(
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
                                    <div className="text-2xl font-bold text-orange-700">
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

                {/* Individual Tab */}
                {activeTab === "individual" && (
                    <div>
                        <div className="px-6 py-4 bg-orange-50 border-b border-orange-200">
                            <h3 className="text-xl font-semibold text-orange-900">
                                Historial Individual
                            </h3>
                            {selectedVecino && (
                                <p className="text-orange-700 text-sm">
                                    Mostrando pagos de:{" "}
                                    {
                                        filteredVecinos.find(
                                            (v) => v.id == selectedVecino
                                        )?.nombre
                                    }
                                </p>
                            )}
                        </div>

                        {!selectedVecino ? (
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
                                    <thead className="bg-orange-600 text-white">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                                Mes
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                                Tipo
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                                Cantidad
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                                Restante
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
                                                    colSpan="5"
                                                    className="px-6 py-8 text-center text-gray-500"
                                                >
                                                    No hay pagos registrados
                                                    para este vecino
                                                </td>
                                            </tr>
                                        ) : (
                                            pagos.map((pago) => (
                                                <tr
                                                    key={pago.id}
                                                    className="hover:bg-gray-50"
                                                >
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
                                                    <td className="px-6 py-4 text-sm text-gray-700">
                                                        {pago.fecha_de_cobro
                                                            ? pago.fecha_de_cobro.split(
                                                                  "T"
                                                              )[0] // → "2025-09-15"
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

                {/* Mensual Tab */}
                {activeTab === "mensual" && (
                    <div>
                        <div className="px-6 py-4 bg-orange-50 border-b border-orange-200">
                            <h3 className="text-xl font-semibold text-orange-900">
                                Pagos Mensuales - {formatMonth(selectedMonth)}
                            </h3>
                            <p className="text-orange-700 text-sm">
                                Todos los pagos del mes seleccionado
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-orange-600 text-white">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Vecino
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Dirección
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
                                                colSpan="6"
                                                className="px-6 py-8 text-center text-gray-500"
                                            >
                                                <div className="text-4xl mb-4">
                                                    📊
                                                </div>
                                                <div className="text-lg font-medium mb-2">
                                                    No hay pagos registrados
                                                    para{" "}
                                                    {formatMonth(selectedMonth)}
                                                </div>
                                                <div className="text-sm">
                                                    Los pagos de este mes
                                                    aparecerán aquí
                                                </div>
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
                                                    {pago.vecino.numero_casa}
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
                                                            pago.tipo.slice(1)}
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
                                                <td className="px-6 py-4 text-sm text-gray-700">
                                                    {pago.fecha_de_cobro
                                                        ? pago.fecha_de_cobro.split(
                                                              "T"
                                                          )[0] // → "2025-09-15"
                                                        : "-"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Por Día Tab */}
                {activeTab === "por_dia" && (
                    <div>
                        <div className="px-6 py-4 bg-orange-50 border-b border-orange-200">
                            <h3 className="text-xl font-semibold text-orange-900">
                                Pagos del Día:{" "}
                                {selectedDate
                                    ? new Date(
                                          selectedDate.includes("T")
                                              ? selectedDate
                                              : selectedDate + "T00:00:00Z" // si viene sin hora, se la añadimos en UTC
                                      ).toLocaleDateString("es-ES", {
                                          weekday: "long",
                                          year: "numeric",
                                          month: "long",
                                          day: "numeric",
                                          timeZone: "UTC", // <- forzamos UTC
                                      })
                                    : "-"}
                            </h3>

                            <p className="text-orange-700 text-sm">
                                Pagos cobrados en la fecha seleccionada
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-orange-600 text-white">
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
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {pagos.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="6"
                                                className="px-6 py-8 text-center text-gray-500"
                                            >
                                                <div className="text-4xl mb-4">
                                                    📅
                                                </div>
                                                <div className="text-lg font-medium mb-2">
                                                    No hay pagos registrados
                                                    para esta fecha
                                                </div>
                                                <div className="text-sm">
                                                    Los pagos cobrados en{" "}
                                                    {new Date(
                                                        selectedDate
                                                    ).toLocaleDateString(
                                                        "es-ES"
                                                    )}{" "}
                                                    aparecerán aquí
                                                </div>
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
                                                    {pago.vecino.numero_casa}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-sm font-medium rounded">
                                                        {formatMonth(pago.mes)}
                                                    </span>
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
                                                            pago.tipo.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    $
                                                    {parseFloat(
                                                        pago.cantidad
                                                    ).toFixed(2)}
                                                    <div className="text-xs text-gray-500">
                                                        {Math.round(
                                                            pago.cantidad / 280
                                                        )}{" "}
                                                        mes
                                                        {Math.round(
                                                            pago.cantidad / 280
                                                        ) > 1
                                                            ? "es"
                                                            : ""}
                                                    </div>
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
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Adelantados Tab */}
                {activeTab === "adelantados" && (
                    <div>
                        <div className="px-6 py-4 bg-orange-50 border-b border-orange-200">
                            <h3 className="text-xl font-semibold text-orange-900">
                                Pagos Adelantados
                            </h3>
                            <p className="text-orange-700 text-sm">
                                Pagos realizados para meses futuros
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-orange-600 text-white">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Vecino
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Mes Adelantado
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Cantidad
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Estado
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                                            Fecha Pago
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {pagos.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="5"
                                                className="px-6 py-8 text-center text-gray-500"
                                            >
                                                <div className="text-4xl mb-4">
                                                    📅
                                                </div>
                                                <div className="text-lg font-medium mb-2">
                                                    No hay pagos adelantados
                                                </div>
                                                <div className="text-sm">
                                                    Los pagos para meses futuros
                                                    aparecerán aquí
                                                </div>
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
                                                    <div className="text-sm text-gray-500">
                                                        {pago.vecino.calle} #
                                                        {
                                                            pago.vecino
                                                                .numero_casa
                                                        }
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-2 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded">
                                                        {formatMonth(pago.mes)}
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
                                                <td className="px-6 py-4 text-sm text-gray-700">
                                                    {pago.fecha_de_cobro
                                                        ? pago.fecha_de_cobro.split(
                                                              "T"
                                                          )[0] // → "2025-09-15"
                                                        : "-"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Summary Stats for non-resumen tabs */}
                {activeTab !== "resumen" && pagos.length > 0 && (
                    <div className="px-6 py-4 bg-gray-50 border-t">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="text-center">
                                <div className="text-xl font-bold text-gray-800">
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
                                <div className="text-xl font-bold text-red-600">
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
