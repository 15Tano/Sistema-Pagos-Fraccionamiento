import { useState, useEffect, useMemo } from "react";
import api from "../lib/axios";

function Pagos() {
    const [pagos, setPagos] = useState([]);
    const [vecinos, setVecinos] = useState([]);
    const [form, setForm] = useState({
        vecino_id: "",
        meses_pagados: "",
        mes: "",
        tipo: "ordinario",
        fecha_de_cobro: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [editingPagoId, setEditingPagoId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showVecinoDropdown, setShowVecinoDropdown] = useState(false);
    const [selectedVecinoForSearch, setSelectedVecinoForSearch] =
        useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [filterFechaCobro, setFilterFechaCobro] = useState("");
    const itemsPerPage = 20;

    /**
     * Formatea una cadena de fecha a un formato legible en español, evitando problemas de zona horaria.
     * @param {string} dateString - La fecha en formato YYYY-MM, YYYY-MM-DD o ISO.
     * @param {'day' | 'month'} formatType - 'day' para DD/MM/YYYY, 'month' para "Mes de Año".
     * @returns {string} La fecha formateada.
     */
    const formatDisplayDate = (dateString, formatType = "day") => {
        if (!dateString) {
            return formatType === "day" ? "Sin fecha" : "-";
        }

        // Añadir "-02" a las fechas que solo tienen mes (YYYY-MM) para evitar errores.
        const safeDateString =
            dateString.length === 7 ? `${dateString}-02` : dateString;

        const date = new Date(safeDateString);

        if (isNaN(date.getTime())) {
            return "Fecha inválida";
        }

        // La clave es forzar la zona horaria a UTC tanto para días como para meses.
        // Esto evita que la hora local del navegador cambie el día.
        let options = {
            timeZone: "UTC",
        };

        if (formatType === "day") {
            options = {
                ...options,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            };
        } else if (formatType === "month") {
            options = {
                ...options,
                year: "numeric",
                month: "long",
            };
        }

        return date.toLocaleDateString("es-ES", options);
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchVecinos(), fetchPagos()]);
        } catch (error) {
            console.error("Error fetching initial data:", error);
            setError("Error al cargar los datos iniciales");
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
            throw error;
        }
    };

    const fetchPagos = async () => {
        try {
            const response = await api.get("/pagos");
            setPagos(response.data);
        } catch (error) {
            console.error("Error fetching pagos:", error);
            throw error;
        }
    };

    // Filter vecinos based on search query with multi-field support
    const filteredVecinos = useMemo(() => {
        if (!searchQuery.trim()) return vecinos;

        const query = searchQuery.toLowerCase().trim();
        const queryParts = query.split(/\s+/); // Split by whitespace

        return vecinos.filter((vecino) => {
            const searchableText =
                `${vecino.nombre} ${vecino.calle} ${vecino.numero_casa}`.toLowerCase();

            // All query parts must match somewhere in the combined text
            return queryParts.every((part) => searchableText.includes(part));
        });
    }, [vecinos, searchQuery]);

    // Filter and paginate pagos
    const filteredAndPaginatedPagos = useMemo(() => {
        let filtered = [...pagos];

        // Filter by fecha_de_cobro if selected
        if (filterFechaCobro) {
            filtered = filtered.filter(
                (pago) => pago.fecha_de_cobro === filterFechaCobro,
            );
        }

        // Sort by ID descending (most recent first)
        filtered.sort((a, b) => b.id - a.id);

        // Calculate pagination
        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedData = filtered.slice(startIndex, endIndex);

        return {
            data: paginatedData,
            totalPages,
            totalItems: filtered.length,
        };
    }, [pagos, filterFechaCobro, currentPage]);

    // Get unique payment dates for filter
    const uniqueFechasCobro = useMemo(() => {
        const fechas = pagos
            .map((p) => p.fecha_de_cobro)
            .filter((f) => f)
            .sort((a, b) => new Date(b) - new Date(a));
        return [...new Set(fechas)];
    }, [pagos]);

    // Reset to page 1 when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filterFechaCobro]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
        setError("");
    };

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        setShowVecinoDropdown(value.trim().length > 0);
        setSelectedVecinoForSearch(null);
    };

    const handleVecinoSelect = (vecino) => {
        setForm({ ...form, vecino_id: vecino.id });
        setSelectedVecinoForSearch(vecino);
        setSearchQuery(
            `${vecino.nombre} - ${vecino.calle} #${vecino.numero_casa}`,
        );
        setShowVecinoDropdown(false);
    };

    const clearVecinoSelection = () => {
        setForm({ ...form, vecino_id: "" });
        setSelectedVecinoForSearch(null);
        setSearchQuery("");
        setShowVecinoDropdown(false);
    };

    const validateForm = () => {
        if (!form.vecino_id) {
            setError("Por favor seleccione un vecino");
            return false;
        }

        if (
            !form.meses_pagados ||
            parseInt(form.meses_pagados) < 1 ||
            parseInt(form.meses_pagados) > 12
        ) {
            setError("Por favor seleccione la cantidad de meses (1-12)");
            return false;
        }

        if (!form.mes) {
            setError("Por favor seleccione el mes de inicio");
            return false;
        }

        return true;
    };

    const calculateTotalAmount = () => {
        if (!form.meses_pagados) return 0;
        return parseInt(form.meses_pagados) * 280;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError("");

        try {
            const mesesPagados = parseInt(form.meses_pagados);
            const cantidadTotal = mesesPagados * 280;

            const submitData = {
                vecino_id: form.vecino_id,
                cantidad: cantidadTotal,
                mes: form.mes,
                tipo: form.tipo,
                fecha_de_cobro: form.fecha_de_cobro,
                meses_pagados: mesesPagados,
            };

            if (editingPagoId) {
                await api.put(`/pagos/${editingPagoId}`, submitData);
            } else {
                await api.post("/pagos", submitData);
            }

            // Reset form
            setForm({
                vecino_id: "",
                meses_pagados: "",
                mes: "",
                tipo: "ordinario",
                fecha_de_cobro: "",
            });
            setEditingPagoId(null);
            clearVecinoSelection();

            await fetchPagos();
            setCurrentPage(1); // Reset to first page after adding/editing
        } catch (error) {
            console.error("Error saving pago:", error);
            if (error.response?.data?.message) {
                setError(error.response.data.message);
            } else {
                setError(
                    "Error al guardar el pago. Por favor intente nuevamente.",
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (pago) => {
        // Calculate months from cantidad (assuming 280 per month)
        const mesesPagados = Math.round(pago.cantidad / 280);

        setForm({
            vecino_id: pago.vecino.id,
            meses_pagados: mesesPagados.toString(),
            mes: pago.mes,
            tipo: pago.tipo,
            fecha_de_cobro: pago.fecha_de_cobro || "",
        });
        setEditingPagoId(pago.id);
        setSelectedVecinoForSearch(pago.vecino);
        setSearchQuery(
            `${pago.vecino.nombre} - ${pago.vecino.calle} #${pago.vecino.numero_casa}`,
        );
        setError("");
    };

    const handleCancelEdit = () => {
        setForm({
            vecino_id: "",
            meses_pagados: "",
            mes: "",
            tipo: "ordinario",
            fecha_de_cobro: "",
        });
        setEditingPagoId(null);
        clearVecinoSelection();
        setError("");
    };

    const handleDelete = async (id) => {
        if (
            !window.confirm("¿Estás seguro de que quieres eliminar este pago?")
        ) {
            return;
        }

        setLoading(true);
        try {
            await api.delete(`/pagos/${id}`);
            await fetchPagos();
        } catch (error) {
            console.error("Error deleting pago:", error);
            setError(
                "Error al eliminar el pago. Por favor intente nuevamente.",
            );
        } finally {
            setLoading(false);
        }
    };

    if (loading && pagos.length === 0 && vecinos.length === 0) {
        return (
            <div className="max-w-7xl mx-auto p-6">
                <div className="bg-white p-8 rounded-xl shadow-lg">
                    <div className="flex justify-center items-center h-64">
                        <div className="flex items-center space-x-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                            <div className="text-lg text-gray-600">
                                Cargando datos...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900">
                    Gestión de Pagos
                </h1>
                <p className="text-gray-600 mt-2">
                    Sistema de registro y seguimiento de cuotas vecinales
                </p>
            </div>

            {/* Payment Form Card */}
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800">
                        {editingPagoId ? "Editar Pago" : "Registrar Nuevo Pago"}
                    </h2>
                    {editingPagoId && (
                        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                            Modo Edición
                        </span>
                    )}
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center">
                            <div className="text-red-600 mr-3">⚠️</div>
                            <div className="text-red-700 font-medium">
                                {error}
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Vecino Search Section */}
                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Buscar Vecino *
                        </label>

                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onFocus={() =>
                                    setShowVecinoDropdown(
                                        searchQuery.trim().length > 0,
                                    )
                                }
                                placeholder="Busque por nombre, calle o número de casa..."
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                                disabled={loading}
                            />

                            {selectedVecinoForSearch && (
                                <button
                                    type="button"
                                    onClick={clearVecinoSelection}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                    disabled={loading}
                                >
                                    ✕
                                </button>
                            )}

                            {!selectedVecinoForSearch && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                    🔍
                                </div>
                            )}

                            {/* Dropdown */}
                            {showVecinoDropdown && !selectedVecinoForSearch && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {filteredVecinos.length === 0 ? (
                                        <div className="p-4 text-gray-500 text-center">
                                            No se encontraron vecinos con "
                                            {searchQuery}"
                                        </div>
                                    ) : (
                                        filteredVecinos.map((vecino) => (
                                            <button
                                                key={vecino.id}
                                                type="button"
                                                onClick={() =>
                                                    handleVecinoSelect(vecino)
                                                }
                                                className="w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition"
                                                disabled={loading}
                                            >
                                                <div className="font-medium text-gray-900">
                                                    {vecino.nombre}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    📍 {vecino.calle} #
                                                    {vecino.numero_casa}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedVecinoForSearch && (
                            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center text-green-800">
                                    <span className="mr-2">✅</span>
                                    <span className="font-medium">
                                        Vecino seleccionado:
                                    </span>
                                </div>
                                <div className="mt-1 text-green-700">
                                    <strong>
                                        {selectedVecinoForSearch.nombre}
                                    </strong>{" "}
                                    - {selectedVecinoForSearch.calle} #
                                    {selectedVecinoForSearch.numero_casa}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Payment Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Cantidad de Meses *
                            </label>
                            <select
                                name="meses_pagados"
                                value={form.meses_pagados}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                                required
                                disabled={loading}
                            >
                                <option value="">
                                    Seleccionar cantidad de meses
                                </option>
                                <option value="1">1 mes - $280</option>
                                <option value="2">2 meses - $560</option>
                                <option value="3">3 meses - $840</option>
                                <option value="4">4 meses - $1,120</option>
                                <option value="5">5 meses - $1,400</option>
                                <option value="6">6 meses - $1,680</option>
                                <option value="7">7 meses - $1,960</option>
                                <option value="8">8 meses - $2,240</option>
                                <option value="9">9 meses - $2,520</option>
                                <option value="10">10 meses - $2,800</option>
                                <option value="11">11 meses - $3,080</option>
                                <option value="12">12 meses - $3,360</option>
                            </select>
                            <div className="mt-1 text-xs text-gray-500">
                                Cada mes equivale a $280
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Mes de Inicio *
                            </label>
                            <input
                                type="month"
                                name="mes"
                                value={form.mes}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                                required
                                disabled={loading}
                            />
                            <div className="mt-1 text-xs text-gray-500">
                                Mes desde el cual se aplicará el pago
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tipo de Pago
                            </label>
                            <select
                                name="tipo"
                                value={form.tipo}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                                disabled={loading}
                            >
                                <option value="ordinario">Ordinario</option>
                                <option value="extraordinario">
                                    Extraordinario
                                </option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Fecha de Cobro
                            </label>
                            <input
                                type="date"
                                name="fecha_de_cobro"
                                value={form.fecha_de_cobro}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                                disabled={loading}
                            />
                        </div>

                        {/* Payment Summary */}
                        {form.meses_pagados && form.vecino_id && form.mes && (
                            <div className="md:col-span-2 bg-orange-50 border border-orange-200 rounded-lg p-4">
                                <h4 className="font-medium text-orange-900 mb-3">
                                    Resumen del Pago
                                </h4>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <div className="text-orange-700">
                                            Meses a pagar:
                                        </div>
                                        <div className="font-bold text-orange-900">
                                            {form.meses_pagados} mes
                                            {parseInt(form.meses_pagados) > 1
                                                ? "es"
                                                : ""}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-orange-700">
                                            Total a pagar:
                                        </div>
                                        <div className="font-bold text-green-600">
                                            $
                                            {calculateTotalAmount().toLocaleString()}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-orange-700">
                                            Desde mes:
                                        </div>
                                        <div className="font-bold text-orange-900">
                                            {form.mes
                                                ? formatDisplayDate(
                                                      form.mes,
                                                      "month",
                                                  )
                                                : "-"}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 p-2 bg-white rounded border border-orange-200">
                                    <div className="text-xs text-orange-600 font-medium mb-1">
                                        Detalle del pago:
                                    </div>
                                    <div className="text-sm text-orange-800">
                                        {form.meses_pagados} × $280 = $
                                        {calculateTotalAmount().toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4 border-t border-gray-200">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-orange-600 text-white py-3 px-6 rounded-lg hover:bg-orange-700 transform hover:scale-105 active:scale-95 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                    {editingPagoId
                                        ? "Actualizando..."
                                        : "Registrando..."}
                                </>
                            ) : editingPagoId ? (
                                "Actualizar Pago"
                            ) : (
                                "Registrar Pago"
                            )}
                        </button>

                        {editingPagoId && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={loading}
                                className="bg-gray-500 text-white py-3 px-6 rounded-lg hover:bg-gray-600 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Payments History */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <h3 className="text-xl font-semibold text-gray-800">
                            Historial de Pagos ({pagos.length})
                        </h3>

                        {/* Filter by Fecha de Cobro */}
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                Filtrar por fecha:
                            </label>
                            <select
                                value={filterFechaCobro}
                                onChange={(e) =>
                                    setFilterFechaCobro(e.target.value)
                                }
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            >
                                <option value="">Todas las fechas</option>
                                {uniqueFechasCobro.map((fecha) => (
                                    <option key={fecha} value={fecha}>
                                        {formatDisplayDate(fecha, "day")}
                                    </option>
                                ))}
                            </select>
                            {filterFechaCobro && (
                                <button
                                    onClick={() => setFilterFechaCobro("")}
                                    className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Results info */}
                    {filterFechaCobro && (
                        <div className="mt-2 text-sm text-gray-600">
                            Mostrando {filteredAndPaginatedPagos.totalItems}{" "}
                            pago
                            {filteredAndPaginatedPagos.totalItems !== 1
                                ? "s"
                                : ""}{" "}
                            del {formatDisplayDate(filterFechaCobro, "day")}
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-orange-600 text-white">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                                    Vecino
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                                    Mes
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                                    Tipo
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                                    Cantidad
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                                    Estado
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                                    Fecha Cobro
                                </th>
                                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredAndPaginatedPagos.data.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="7"
                                        className="px-6 py-12 text-center text-gray-500"
                                    >
                                        <div className="text-gray-400 text-6xl mb-4">
                                            💳
                                        </div>
                                        <div className="text-lg font-medium">
                                            {filterFechaCobro
                                                ? "No hay pagos para esta fecha"
                                                : "No hay pagos registrados"}
                                        </div>
                                        <div className="text-sm">
                                            {filterFechaCobro
                                                ? "Intenta con otra fecha de cobro"
                                                : "Los pagos aparecerán aquí una vez que se registren"}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAndPaginatedPagos.data.map((pago) => (
                                    <tr
                                        key={pago.id}
                                        className="hover:bg-gray-50 transition"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">
                                                {pago.vecino.nombre}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {pago.vecino.calle} #
                                                {pago.vecino.numero_casa}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {formatDisplayDate(
                                                pago.mes,
                                                "month",
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                    pago.tipo ===
                                                    "extraordinario"
                                                        ? "bg-orange-100 text-orange-800"
                                                        : "bg-orange-100 text-orange-800"
                                                }`}
                                            >
                                                {pago.tipo
                                                    .charAt(0)
                                                    .toUpperCase() +
                                                    pago.tipo.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                            ${pago.cantidad.toLocaleString()}
                                            <div className="text-xs text-gray-500">
                                                {Math.round(
                                                    pago.cantidad / 280,
                                                )}{" "}
                                                mes
                                                {Math.round(
                                                    pago.cantidad / 280,
                                                ) > 1
                                                    ? "es"
                                                    : ""}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <span className="mr-1">✅</span>
                                                Pagado Completo
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDisplayDate(
                                                pago.fecha_de_cobro,
                                                "day",
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() =>
                                                        handleEdit(pago)
                                                    }
                                                    disabled={loading}
                                                    className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600 transform hover:scale-105 active:scale-95 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleDelete(pago.id)
                                                    }
                                                    disabled={loading}
                                                    className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transform hover:scale-105 active:scale-95 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredAndPaginatedPagos.totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            {/* Page info */}
                            <div className="text-sm text-gray-700">
                                Mostrando{" "}
                                <span className="font-medium">
                                    {(currentPage - 1) * itemsPerPage + 1}
                                </span>{" "}
                                -{" "}
                                <span className="font-medium">
                                    {Math.min(
                                        currentPage * itemsPerPage,
                                        filteredAndPaginatedPagos.totalItems,
                                    )}
                                </span>{" "}
                                de{" "}
                                <span className="font-medium">
                                    {filteredAndPaginatedPagos.totalItems}
                                </span>{" "}
                                pagos
                            </div>

                            {/* Pagination buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() =>
                                        setCurrentPage((prev) =>
                                            Math.max(1, prev - 1),
                                        )
                                    }
                                    disabled={currentPage === 1}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition"
                                >
                                    ← Anterior
                                </button>

                                {/* Page numbers */}
                                <div className="flex gap-1">
                                    {(() => {
                                        const totalPages =
                                            filteredAndPaginatedPagos.totalPages;
                                        const pages = [];
                                        const maxVisible = 5;

                                        let startPage = Math.max(
                                            1,
                                            currentPage -
                                                Math.floor(maxVisible / 2),
                                        );
                                        let endPage = Math.min(
                                            totalPages,
                                            startPage + maxVisible - 1,
                                        );

                                        if (
                                            endPage - startPage <
                                            maxVisible - 1
                                        ) {
                                            startPage = Math.max(
                                                1,
                                                endPage - maxVisible + 1,
                                            );
                                        }

                                        // First page
                                        if (startPage > 1) {
                                            pages.push(
                                                <button
                                                    key={1}
                                                    onClick={() =>
                                                        setCurrentPage(1)
                                                    }
                                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                                                >
                                                    1
                                                </button>,
                                            );
                                            if (startPage > 2) {
                                                pages.push(
                                                    <span
                                                        key="ellipsis1"
                                                        className="px-2 text-gray-500"
                                                    >
                                                        ...
                                                    </span>,
                                                );
                                            }
                                        }

                                        // Visible pages
                                        for (
                                            let i = startPage;
                                            i <= endPage;
                                            i++
                                        ) {
                                            pages.push(
                                                <button
                                                    key={i}
                                                    onClick={() =>
                                                        setCurrentPage(i)
                                                    }
                                                    className={`px-3 py-2 border rounded-lg text-sm font-medium transition ${
                                                        currentPage === i
                                                            ? "bg-orange-600 text-white border-orange-600"
                                                            : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                                                    }`}
                                                >
                                                    {i}
                                                </button>,
                                            );
                                        }

                                        // Last page
                                        if (endPage < totalPages) {
                                            if (endPage < totalPages - 1) {
                                                pages.push(
                                                    <span
                                                        key="ellipsis2"
                                                        className="px-2 text-gray-500"
                                                    >
                                                        ...
                                                    </span>,
                                                );
                                            }
                                            pages.push(
                                                <button
                                                    key={totalPages}
                                                    onClick={() =>
                                                        setCurrentPage(
                                                            totalPages,
                                                        )
                                                    }
                                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                                                >
                                                    {totalPages}
                                                </button>,
                                            );
                                        }

                                        return pages;
                                    })()}
                                </div>

                                <button
                                    onClick={() =>
                                        setCurrentPage((prev) =>
                                            Math.min(
                                                filteredAndPaginatedPagos.totalPages,
                                                prev + 1,
                                            ),
                                        )
                                    }
                                    disabled={
                                        currentPage ===
                                        filteredAndPaginatedPagos.totalPages
                                    }
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition"
                                >
                                    Siguiente →
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Pagos;
