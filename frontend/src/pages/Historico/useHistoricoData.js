import { useState, useEffect, useMemo } from "react";
import api from "../../lib/axios";
import { getTagSales } from "../../api/tags";
import useAuthStore from "../../store/authStore";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const CURRENT_MONTH_ISO = new Date().toISOString().slice(0, 7);
const CUOTA_ORDINARIA = 280;

function categorizarPagos(pagosList) {
    const ordinario = pagosList
        .filter(
            (p) =>
                p.tipo === "ordinario" &&
                parseFloat(p.cantidad) === CUOTA_ORDINARIA,
        )
        .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

    const extraordinario = pagosList
        .filter((p) => p.tipo === "extraordinario")
        .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

    const especiales = pagosList
        .filter(
            (p) =>
                p.tipo === "ordinario" &&
                parseFloat(p.cantidad) !== CUOTA_ORDINARIA,
        )
        .reduce((sum, p) => sum + parseFloat(p.cantidad), 0);

    return { ordinario, extraordinario, especiales };
}

export function useHistoricoData() {
    const { user } = useAuthStore();
    const esCapturista = user?.role === "capturista";

    const [pagos, setPagos] = useState([]);
    const [vecinos, setVecinos] = useState([]);
    const [tagSales, setTagSales] = useState([]);

    const [loadingInicial, setLoadingInicial] = useState(true);
    const [loadingTabla, setLoadingTabla] = useState(false);

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

    // Búsqueda por nombre (punto 3) — con debounce para no filtrar en cada tecla
    const [searchNombre, setSearchNombre] = useState("");
    const debouncedSearchNombre = useDebouncedValue(searchNombre, 250);

    // Orden de tabla (punto 4)
    const [sortConfig, setSortConfig] = useState({
        field: null,
        direction: "asc",
    });

    useEffect(() => {
        fetchInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeTab !== "resumen") {
            fetchPagos();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    async function fetchInitialData() {
        setLoadingInicial(true);
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
            setLoadingInicial(false);
        }
    }

    async function fetchVecinos() {
        try {
            const response = await api.get("/vecinos?per_page=500");
            setVecinos(response.data.data || response.data || []);
        } catch (error) {
            console.error("Error fetching vecinos:", error);
        }
    }

    async function fetchPagos() {
        setLoadingTabla(true);
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
            setLoadingTabla(false);
        }
    }

    const uniqueCalles = useMemo(
        () => [...new Set(vecinos.map((v) => v.calle))].sort(),
        [vecinos],
    );

    // Fix: ya no muta el array de vecinos original
    const filteredVecinos = useMemo(() => {
        const base = selectedCalle
            ? vecinos.filter((v) => v.calle === selectedCalle)
            : vecinos;
        return [...base].sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [vecinos, selectedCalle]);

    // ── ESTADO DE CUENTA: qué cuota mensual se está pagando ──
    const currentMonthSummary = useMemo(() => {
        const paymentsForCurrentMonthFee = pagos.filter(
            (p) => p.mes === CURRENT_MONTH_ISO,
        );

        return vecinos.map((vecino) => {
            const vecinoPayments = paymentsForCurrentMonthFee.filter(
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
    }, [vecinos, pagos]);

    const filteredCurrentMonthSummary = useMemo(() => {
        let filtered = currentMonthSummary;

        if (selectedCalle) {
            filtered = filtered.filter((v) => v.calle === selectedCalle);
        }
        if (showOnlyDue) {
            filtered = filtered.filter((v) => !v.hasPaid);
        }
        if (debouncedSearchNombre.trim()) {
            const term = debouncedSearchNombre.trim().toLowerCase();
            filtered = filtered.filter((v) =>
                v.nombre.toLowerCase().includes(term),
            );
        }
        if (sortConfig.field) {
            filtered = [...filtered].sort((a, b) => {
                const dir = sortConfig.direction === "asc" ? 1 : -1;
                if (sortConfig.field === "nombre") {
                    return a.nombre.localeCompare(b.nombre) * dir;
                }
                if (sortConfig.field === "totalPaid") {
                    return (a.totalPaid - b.totalPaid) * dir;
                }
                return 0;
            });
        }

        return filtered;
    }, [
        currentMonthSummary,
        selectedCalle,
        showOnlyDue,
        debouncedSearchNombre,
        sortConfig,
    ]);

    const pagosOrdenados = useMemo(() => {
        if (!sortConfig.field) return pagos;
        return [...pagos].sort((a, b) => {
            const dir = sortConfig.direction === "asc" ? 1 : -1;
            if (sortConfig.field === "nombre") {
                return a.vecino.nombre.localeCompare(b.vecino.nombre) * dir;
            }
            if (sortConfig.field === "cantidad") {
                return (parseFloat(a.cantidad) - parseFloat(b.cantidad)) * dir;
            }
            return 0;
        });
    }, [pagos, sortConfig]);

    function toggleSort(field) {
        setSortConfig((prev) =>
            prev.field === field
                ? {
                      field,
                      direction: prev.direction === "asc" ? "desc" : "asc",
                  }
                : { field, direction: "asc" },
        );
    }

    // ── DESGLOSE FINANCIERO — generalizado para Resumen / Día de Cobro / Mes de Cobro ──
    const desgloseFinanciero = useMemo(() => {
        let base = { ordinario: 0, extraordinario: 0, especiales: 0 };
        let ventasTags = 0;
        let tagsCount = 0;

        if (activeTab === "resumen") {
            // pagos aquí es la carga inicial sin filtrar por fecha, hay que acotar a este mes
            const collectedThisMonth = pagos.filter((p) => {
                const paidDate = p.fecha_de_cobro || p.created_at || "";
                return paidDate.slice(0, 7) === CURRENT_MONTH_ISO;
            });
            base = categorizarPagos(collectedThisMonth);

            const tagsThisMonth = tagSales.filter(
                (s) =>
                    (s.sold_at || s.created_at || "").slice(0, 7) ===
                    CURRENT_MONTH_ISO,
            );
            ventasTags = tagsThisMonth.reduce(
                (sum, s) => sum + parseFloat(s.price || 150),
                0,
            );
            tagsCount = tagsThisMonth.length;
        } else if (activeTab === "por_dia") {
            // pagos ya viene filtrado por selectedDate desde el backend
            base = categorizarPagos(pagos);

            const tagsThisDay = tagSales.filter(
                (s) =>
                    (s.sold_at || s.created_at || "").slice(0, 10) ===
                    selectedDate,
            );
            ventasTags = tagsThisDay.reduce(
                (sum, s) => sum + parseFloat(s.price || 150),
                0,
            );
            tagsCount = tagsThisDay.length;
        } else if (activeTab === "mes_cobro") {
            // pagos ya viene filtrado por selectedCollectionMonth desde el backend
            base = categorizarPagos(pagos);

            const tagsThisMonth = tagSales.filter(
                (s) =>
                    (s.sold_at || s.created_at || "").slice(0, 7) ===
                    selectedCollectionMonth,
            );
            ventasTags = tagsThisMonth.reduce(
                (sum, s) => sum + parseFloat(s.price || 150),
                0,
            );
            tagsCount = tagsThisMonth.length;
        }

        const total =
            base.ordinario + base.extraordinario + base.especiales + ventasTags;
        return { ...base, ventasTags, tagsCount, total };
    }, [activeTab, pagos, tagSales, selectedDate, selectedCollectionMonth]);

    function clearFilters() {
        setSelectedCalle("");
        setSelectedVecino("");
        setSelectedMonth(CURRENT_MONTH_ISO);
        setSelectedDate(new Date().toISOString().slice(0, 10));
        setSelectedCollectionMonth(CURRENT_MONTH_ISO);
        setSearchTipo("");
        setSearchNombre("");
        setShowOnlyDue(false);
        setSortConfig({ field: null, direction: "asc" });
    }

    return {
        // datos crudos
        vecinos,
        pagos: pagosOrdenados,
        tagSales,
        esCapturista,

        // loading separado (punto 6)
        loadingInicial,
        loadingTabla,

        // tabs
        activeTab,
        setActiveTab,

        // filtros
        selectedCalle,
        setSelectedCalle,
        selectedVecino,
        setSelectedVecino,
        selectedMonth,
        setSelectedMonth,
        selectedDate,
        setSelectedDate,
        selectedCollectionMonth,
        setSelectedCollectionMonth,
        searchTipo,
        setSearchTipo,
        showOnlyDue,
        setShowOnlyDue,
        searchNombre,
        setSearchNombre,

        // orden
        sortConfig,
        toggleSort,

        // derivados
        uniqueCalles,
        filteredVecinos,
        filteredCurrentMonthSummary,
        desgloseFinanciero,

        // acciones
        clearFilters,
        refetchPagos: fetchPagos,

        CURRENT_MONTH_ISO,
    };
}
