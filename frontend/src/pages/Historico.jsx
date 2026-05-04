import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../lib/axios";
import { getTagSales } from "../api/tags";
import useAuthStore from "../store/authStore";

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

    const getCurrentMonthStrictPayments = useCallback(() => {
        return pagos.filter((p) => {
            const isForThisMonth = p.mes === CURRENT_MONTH_ISO;
            const paidDate = p.fecha_de_cobro || p.created_at || "";
            const isPaidThisMonth = paidDate.slice(0, 7) === CURRENT_MONTH_ISO;
            return isForThisMonth && isPaidThisMonth;
        });
    }, [pagos]);

    const currentMonthSummary = useMemo(() => {
        const currentMonthPayments = getCurrentMonthStrictPayments();

        return vecinos.map((vecino) => {
            const vecinoPayments = currentMonthPayments.filter(
                (p) => p.vecino_id === vecino.id,
            );
            const totalPaid = vecinoPayments.reduce(
                (sum, p) => sum + parseFloat(p.cantidad),
                0,
            );

            const vecinoData =
                vecinoPayments.length > 0 ? vecinoPayments[0].vecino : vecino;

            return {
                ...vecinoData,
                totalPaid,
                hasPaid: totalPaid > 0,
                payments: vecinoPayments,
            };
        });
    }, [vecinos, getCurrentMonthStrictPayments]);

    const filteredCurrentMonthSummary = useMemo(() => {
        let filtered = currentMonthSummary;
        if (selectedCalle) {
            filtered = filtered.filter((v) => v.calle === selectedCalle);
        }
        if (showOnlyDue) {
            filtered = filtered.filter((v) => !v.hasPaid);
        }
        return filtered;
    }, [currentMonthSummary, selectedCalle, showOnlyDue]);

    const resumenFinanciero = useMemo(() => {
        const currentMonthPayments = getCurrentMonthStrictPayments();

        const ordinario = currentMonthPayments
            .filter(
                (p) => p.tipo === "ordinario" && parseFloat(p.cantidad) === 280,
            )
            .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

        const extraordinario = currentMonthPayments
            .filter((p) => p.tipo === "extraordinario")
            .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

        const especiales = currentMonthPayments
            .filter(
                (p) => p.tipo === "ordinario" && parseFloat(p.cantidad) !== 280,
            )
            .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

        const ventasTags = tagSales
            .filter(
                (s) =>
                    (s.sold_at || s.created_at || "").slice(0, 7) ===
                    CURRENT_MONTH_ISO,
            )
            .reduce((sum, s) => sum + parseFloat(s.price || 150), 0);

        const total = ordinario + extraordinario + especiales + ventasTags;

        return { ordinario, extraordinario, especiales, ventasTags, total };
    }, [getCurrentMonthStrictPayments, tagSales]);

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
        const datePart = dateString.split("T")[0];
        const [year, month, day] = datePart.split("-");
        return `${day}/${month}/${year}`;
    };

    const getPaymentStatusBadge = (hasPaid) => {
        if (!hasPaid) {
            return (
                <span className="px-2.5 py-1 bg-red-100/60 border border-red-200 text-red-700 text-[10px] uppercase tracking-wide font-medium rounded-lg shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                    Sin Pagar
                </span>
            );
        } else {
            return (
                <span className="px-2.5 py-1 bg-green-100/60 border border-green-200 text-green-700 text-[10px] uppercase tracking-wide font-medium rounded-lg shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                    Pagado
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
            className={`px-4 py-2 font-medium text-sm rounded-xl transition-all duration-300 active:scale-95 ${
                activeTab === id
                    ? "bg-gradient-to-r from-orange-500 to-orange-400 text-white shadow-[0_4px_10px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)]"
                    : "bg-white/40 backdrop-blur-md border border-white/60 text-stone-600 hover:bg-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]"
            }`}
        >
            <span>{label}</span>
            {count !== undefined && (
                <span
                    className={`ml-2 px-1.5 py-0.5 text-xs rounded-lg font-medium shadow-[inset_0_1px_1px_rgba(0,0,0,0.1)] ${
                        activeTab === id
                            ? "bg-black/10 text-white"
                            : "bg-black/5 text-stone-500"
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
                    <span className="text-stone-500 text-sm font-medium tracking-wide">
                        Cargando historial...
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 h-full pb-20 md:pb-0">
            <div className="mb-2 px-2">
                <h1 className="text-3xl font-semibold text-stone-800 mb-1">
                    Histórico de Pagos
                </h1>
                <p className="text-sm text-stone-500">
                    Seguimiento completo de pagos vecinales
                </p>
            </div>

            {/* ── PANEL DE FILTROS SUPERIOR (Liquid Glass) ── */}
            <div className="relative overflow-hidden p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

                <div className="flex flex-wrap gap-2 mb-6 relative z-10">
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

                <div className="bg-white/30 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] relative z-10">
                    <div className="flex flex-wrap gap-4 items-end">
                        {/* Selector de Calle */}
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                                Calle
                            </label>
                            <select
                                value={selectedCalle}
                                onChange={(e) => {
                                    setSelectedCalle(e.target.value);
                                    if (activeTab === "individual")
                                        setSelectedVecino("");
                                }}
                                className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
                            >
                                <option value="">Todas las calles</option>
                                {uniqueCalles.map((calle) => (
                                    <option key={calle} value={calle}>
                                        {calle}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Filtros Dinámicos según Pestaña */}
                        {activeTab === "individual" && (
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                                    Vecino
                                </label>
                                <select
                                    value={selectedVecino}
                                    onChange={(e) =>
                                        setSelectedVecino(e.target.value)
                                    }
                                    className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
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
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                                    Mes Pagado
                                </label>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) =>
                                        setSelectedMonth(e.target.value)
                                    }
                                    className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
                                />
                            </div>
                        )}

                        {activeTab === "mes_cobro" && (
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
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
                                    className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
                                />
                            </div>
                        )}

                        {activeTab === "por_dia" && (
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                                    Fecha de Cobro
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) =>
                                        setSelectedDate(e.target.value)
                                    }
                                    className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
                                />
                            </div>
                        )}

                        {activeTab !== "resumen" && (
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                                    Tipo
                                </label>
                                <select
                                    value={searchTipo}
                                    onChange={(e) =>
                                        setSearchTipo(e.target.value)
                                    }
                                    className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
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
                            <div className="flex items-center gap-2 pb-2">
                                <input
                                    type="checkbox"
                                    id="showOnlyDue"
                                    checked={showOnlyDue}
                                    onChange={(e) =>
                                        setShowOnlyDue(e.target.checked)
                                    }
                                    className="w-4 h-4 text-orange-500 border-white/60 rounded focus:ring-orange-500/20 bg-white/50"
                                />
                                <label
                                    htmlFor="showOnlyDue"
                                    className="text-sm font-medium text-stone-600 cursor-pointer"
                                >
                                    Solo sin pagar
                                </label>
                            </div>
                        )}

                        {/* Botones de Acción */}
                        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                            <button
                                onClick={clearFilters}
                                className="flex-1 sm:flex-none px-5 py-2.5 bg-white/50 backdrop-blur-sm border border-white/60 text-stone-600 text-sm font-medium rounded-xl hover:bg-white/80 transition-all shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] active:scale-95"
                            >
                                Limpiar
                            </button>
                            {activeTab !== "resumen" && (
                                <button
                                    onClick={fetchPagos}
                                    className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-400 text-white text-sm font-medium rounded-xl shadow-[0_4px_10px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)] hover:from-orange-400 hover:to-orange-500 transition-all active:scale-95"
                                >
                                    Buscar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CONTENIDO PRINCIPAL (Tablas y Resúmenes) ── */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

                {activeTab === "resumen" && (
                    <div className="relative z-10 flex flex-col">
                        <div className="px-6 py-5 border-b border-white/40 bg-white/20">
                            <h3 className="text-lg font-semibold text-stone-800">
                                Resumen del Mes Actual (
                                {formatMonth(CURRENT_MONTH_ISO)})
                            </h3>
                            <p className="text-orange-600 text-xs font-medium uppercase tracking-wide mt-1">
                                Solo refleja ingresos físicos del mes en curso
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-black/5 border-b border-white/40">
                                    <tr>
                                        <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                            Vecino
                                        </th>
                                        <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                            Dirección
                                        </th>
                                        <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                            Estado
                                        </th>
                                        <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                            Monto Pagado
                                        </th>
                                        <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                            Tag
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/40">
                                    {filteredCurrentMonthSummary.map(
                                        (vecino) => (
                                            <tr
                                                key={vecino.id}
                                                className="hover:bg-white/40 transition-colors"
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <p className="text-sm font-medium text-stone-800 capitalize">
                                                        {vecino.nombre}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                                                    {vecino.calle} #
                                                    {vecino.numero_casa}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {getPaymentStatusBadge(
                                                        vecino.hasPaid,
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-700">
                                                    $
                                                    {vecino.totalPaid.toLocaleString(
                                                        "es-MX",
                                                        {
                                                            minimumFractionDigits: 2,
                                                        },
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs text-stone-400">
                                                    {vecino.tags &&
                                                    vecino.tags.length > 0 ? (
                                                        <span className="bg-stone-100/50 px-2.5 py-1 rounded-lg border border-stone-200/50 text-stone-600">
                                                            {vecino.tags
                                                                .map(
                                                                    (tag) =>
                                                                        tag.codigo,
                                                                )
                                                                .join(", ")}
                                                        </span>
                                                    ) : (
                                                        <span className="italic text-stone-300">
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

                        {/* Desglose de Contadores de Estado */}
                        <div className="grid grid-cols-2 gap-0 divide-x divide-white/40 border-t border-b border-white/40 bg-white/20">
                            <div className="px-6 py-5 text-center">
                                <p className="text-3xl font-bold text-green-600">
                                    {
                                        filteredCurrentMonthSummary.filter(
                                            (v) => v.hasPaid,
                                        ).length
                                    }
                                </p>
                                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide mt-1">
                                    Pagados
                                </p>
                            </div>
                            <div className="px-6 py-5 text-center">
                                <p className="text-3xl font-bold text-red-500">
                                    {
                                        filteredCurrentMonthSummary.filter(
                                            (v) => !v.hasPaid,
                                        ).length
                                    }
                                </p>
                                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide mt-1">
                                    Sin Pagar
                                </p>
                            </div>
                        </div>

                        {/* Desglose Financiero */}
                        <div className="p-6 md:p-8 bg-white/10">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
                                <div className="bg-white/50 backdrop-blur-sm border border-white/60 rounded-2xl p-4 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] text-center">
                                    <p className="text-xs font-medium text-stone-500 mb-1">
                                        Cuotas Ordinarias
                                    </p>
                                    <p className="text-xl font-medium text-stone-800">
                                        $
                                        {resumenFinanciero.ordinario.toLocaleString(
                                            "es-MX",
                                        )}
                                    </p>
                                    <p className="text-[10px] text-stone-400 mt-1">
                                        a $280 c/u
                                    </p>
                                </div>
                                <div className="bg-white/50 backdrop-blur-sm border border-white/60 rounded-2xl p-4 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] text-center">
                                    <p className="text-xs font-medium text-stone-500 mb-1">
                                        Multas
                                    </p>
                                    <p className="text-xl font-medium text-stone-800">
                                        $
                                        {resumenFinanciero.extraordinario.toLocaleString(
                                            "es-MX",
                                        )}
                                    </p>
                                    <p className="text-[10px] text-stone-400 mt-1">
                                        Extraordinarios
                                    </p>
                                </div>
                                <div className="bg-white/50 backdrop-blur-sm border border-white/60 rounded-2xl p-4 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] text-center">
                                    <p className="text-xs font-medium text-stone-500 mb-1">
                                        Pagos Especiales
                                    </p>
                                    <p className="text-xl font-medium text-stone-800">
                                        $
                                        {resumenFinanciero.especiales.toLocaleString(
                                            "es-MX",
                                        )}
                                    </p>
                                    <p className="text-[10px] text-stone-400 mt-1">
                                        $300, $500, etc.
                                    </p>
                                </div>
                                <div className="bg-white/50 backdrop-blur-sm border border-white/60 rounded-2xl p-4 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] text-center">
                                    <p className="text-xs font-medium text-stone-500 mb-1">
                                        Venta Tags
                                    </p>
                                    <p className="text-xl font-medium text-stone-800">
                                        $
                                        {resumenFinanciero.ventasTags.toLocaleString(
                                            "es-MX",
                                        )}
                                    </p>
                                    <p className="text-[10px] text-stone-400 mt-1">
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
                                        tags
                                    </p>
                                </div>
                            </div>

                            {/* Total General Cierre GIGANTE */}
                            <div className="mt-8 flex flex-col items-center justify-center bg-gradient-to-b from-orange-400/10 to-orange-500/10 border border-orange-200/50 rounded-3xl p-8 shadow-sm">
                                <p className="text-xs font-semibold text-orange-800/60 uppercase tracking-widest mb-2">
                                    Total Recaudado Real
                                </p>
                                <p className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-orange-500 to-orange-600 drop-shadow-md">
                                    $
                                    {resumenFinanciero.total.toLocaleString(
                                        "es-MX",
                                        {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        },
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── VISTA DE TABLAS (Demás Pestañas) ── */}
                {[
                    "individual",
                    "mensual",
                    "mes_cobro",
                    "por_dia",
                    "adelantados",
                ].includes(activeTab) && (
                    <div className="relative z-10 flex flex-col h-full min-h-[400px]">
                        <div className="px-6 py-5 border-b border-white/40 bg-white/20">
                            <h3 className="text-lg font-semibold text-stone-800">
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
                            <div className="flex flex-col items-center justify-center p-16 text-center text-stone-400 flex-1">
                                <div className="text-6xl mb-4 opacity-50 drop-shadow-sm">
                                    👤
                                </div>
                                <div className="text-lg font-medium text-stone-600 mb-2">
                                    Seleccione un vecino
                                </div>
                                <div className="text-sm max-w-xs">
                                    Use los filtros de arriba para ver el
                                    historial de pagos de un residente
                                    específico.
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left">
                                    <thead className="bg-black/5 border-b border-white/40">
                                        <tr>
                                            <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                                Vecino
                                            </th>
                                            <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                                Dirección
                                            </th>
                                            <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                                Mes Pagado
                                            </th>
                                            <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                                Tipo
                                            </th>
                                            <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                                Cantidad
                                            </th>
                                            <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                                Estado
                                            </th>
                                            <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                                Fecha Cobro
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/40">
                                        {pagos.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan="7"
                                                    className="px-6 py-12 text-center text-stone-500 font-medium"
                                                >
                                                    No hay pagos registrados
                                                    para este filtro.
                                                </td>
                                            </tr>
                                        ) : (
                                            pagos.map((pago) => (
                                                <tr
                                                    key={pago.id}
                                                    className="hover:bg-white/40 transition-colors"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-800 capitalize">
                                                        {pago.vecino.nombre}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                                                        {pago.vecino.calle} #
                                                        {
                                                            pago.vecino
                                                                .numero_casa
                                                        }
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-700 capitalize">
                                                        {formatMonth(pago.mes)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide rounded-lg border shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] ${
                                                                pago.tipo ===
                                                                "extraordinario"
                                                                    ? "bg-orange-100/60 border-orange-200 text-orange-800"
                                                                    : "bg-blue-100/60 border-blue-200 text-blue-800"
                                                            }`}
                                                        >
                                                            {pago.tipo}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-800">
                                                        $
                                                        {parseFloat(
                                                            pago.cantidad,
                                                        ).toLocaleString(
                                                            "es-MX",
                                                            {
                                                                minimumFractionDigits: 2,
                                                            },
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide rounded-lg border bg-green-100/60 border-green-200 text-green-700 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                                                            Completado
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-stone-400">
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

                        {/* Cierre de Totales en Lista GIGANTE */}
                        {activeTab !== "resumen" && pagos.length > 0 && (
                            <div className="px-6 py-10 border-t border-white/40 bg-gradient-to-b from-white/10 to-white/30 mt-auto flex flex-col items-center justify-center">
                                <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">
                                    Suma Recaudada
                                </p>
                                <p className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-orange-500 to-orange-700 drop-shadow-md">
                                    $
                                    {pagos
                                        .reduce(
                                            (sum, p) =>
                                                sum + parseFloat(p.cantidad),
                                            0,
                                        )
                                        .toLocaleString("es-MX", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Historico;
