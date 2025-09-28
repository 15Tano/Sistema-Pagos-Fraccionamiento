import { useState, useEffect, useMemo } from "react";
import api from "../api";
import { useLocation } from "react-router-dom";

// Custom Icons
const CreditCardIcon = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
    </svg>
);

const EditIcon = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
    </svg>
);

const TrashIcon = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
    </svg>
);

const UserIcon = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
    </svg>
);

const SearchIcon = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
    </svg>
);

const CheckIcon = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
        />
    </svg>
);

const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    // Add timezone offset to counteract automatic conversion to UTC
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + offset);
    return localDate.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

const formatDateForInput = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + offset);
    return localDate.toISOString().split("T")[0];
};

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
    const location = useLocation();

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const vecinoIdFromUrl = params.get("vecinoId");

        if (vecinoIdFromUrl && vecinos.length > 0) {
            const vecinoToSelect = vecinos.find((v) => v.id == vecinoIdFromUrl);
            if (vecinoToSelect) {
                handleVecinoSelect(vecinoToSelect);
            }
        }
    }, [location.search, vecinos]);

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

    // Filter vecinos based on search query
    const filteredVecinos = useMemo(() => {
        if (!searchQuery.trim()) return vecinos;

        const query = searchQuery.toLowerCase().trim();
        return vecinos.filter(
            (vecino) =>
                vecino.nombre.toLowerCase().includes(query) ||
                vecino.calle.toLowerCase().includes(query) ||
                vecino.numero_casa.toString().includes(query)
        );
    }, [vecinos, searchQuery]);

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
            `${vecino.nombre} - ${vecino.calle} #${vecino.numero_casa}`
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

            let adjustedDate = form.fecha_de_cobro;

            const submitData = {
                vecino_id: form.vecino_id,
                cantidad: cantidadTotal,
                mes: form.mes,
                tipo: form.tipo,
                fecha_de_cobro: adjustedDate,
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
        } catch (error) {
            console.error("Error saving pago:", error);
            if (error.response?.data?.message) {
                setError(error.response.data.message);
            } else {
                setError(
                    "Error al guardar el pago. Por favor intente nuevamente."
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
            `${pago.vecino.nombre} - ${pago.vecino.calle} #${pago.vecino.numero_casa}`
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
                "Error al eliminar el pago. Por favor intente nuevamente."
            );
        } finally {
            setLoading(false);
        }
    };

    const formatMonth = (monthString) => {
        if (!monthString) return "-";
        const [year, month] = monthString.split("-");
        const date = new Date(year, month - 1);
        return date.toLocaleDateString("es-ES", {
            year: "numeric",
            month: "long",
        });
    };

    if (loading && pagos.length === 0 && vecinos.length === 0) {
        return (
            <div className="min-h-screen bg-white-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
                    <p className="mt-4 text-slate-600 font-medium">
                        Cargando datos...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-orange-600 mb-2">
                        Gestión de Pagos
                    </h1>

                    <p className="text-slate-600">
                        Sistema de registro y seguimiento de cuotas vecinales
                    </p>
                </div>

                {/* Payment Form Card */}
                <div className="bg-white backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 overflow-hidden">
                    <div className="bg-orange-500 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-500 rounded-lg">
                                    <CreditCardIcon className="w-6 h-6 text-white" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">
                                    {editingPagoId
                                        ? "Editar Pago"
                                        : "Registrar Nuevo Pago"}
                                </h2>
                            </div>
                            {editingPagoId && (
                                <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                    Modo Edición
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="p-6 bg-white">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
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
                            <div className="bg-white-50 p-6 rounded-xl border-2 border-orange-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <UserIcon className="w-5 h-5 text-orange-600" />
                                    Buscar Vecino *
                                </label>

                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        onFocus={() =>
                                            setShowVecinoDropdown(
                                                searchQuery.trim().length > 0
                                            )
                                        }
                                        placeholder="Busque por nombre, plaza o número de casa..."
                                        className="w-full border-2 border-orange-200 rounded-xl px-4 py-3 pr-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 pl-10"
                                        disabled={loading}
                                    />

                                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-orange-400" />

                                    {selectedVecinoForSearch && (
                                        <button
                                            type="button"
                                            onClick={clearVecinoSelection}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-600 transition p-1 rounded-full hover:bg-red-100"
                                            disabled={loading}
                                        >
                                            ✕
                                        </button>
                                    )}

                                    {/* Dropdown */}
                                    {showVecinoDropdown &&
                                        !selectedVecinoForSearch && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border-2 border-orange-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                                {filteredVecinos.length ===
                                                0 ? (
                                                    <div className="p-4 text-gray-500 text-center">
                                                        No se encontraron
                                                        vecinos con "
                                                        {searchQuery}"
                                                    </div>
                                                ) : (
                                                    filteredVecinos.map(
                                                        (vecino) => (
                                                            <button
                                                                key={vecino.id}
                                                                type="button"
                                                                onClick={() =>
                                                                    handleVecinoSelect(
                                                                        vecino
                                                                    )
                                                                }
                                                                className="w-full p-4 text-left hover:bg-orange-50 border-b border-orange-100 last:border-b-0 transition-colors"
                                                                disabled={
                                                                    loading
                                                                }
                                                            >
                                                                <div className="font-medium text-gray-900">
                                                                    {
                                                                        vecino.nombre
                                                                    }
                                                                </div>
                                                                <div className="text-sm text-gray-600 flex items-center gap-1">
                                                                    <span>
                                                                        🏠
                                                                    </span>{" "}
                                                                    {
                                                                        vecino.calle
                                                                    }{" "}
                                                                    #
                                                                    {
                                                                        vecino.numero_casa
                                                                    }
                                                                </div>
                                                            </button>
                                                        )
                                                    )
                                                )}
                                            </div>
                                        )}
                                </div>

                                {selectedVecinoForSearch && (
                                    <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                                        <div className="flex items-center gap-2 text-green-800 mb-2">
                                            <CheckIcon className="w-5 h-5" />
                                            <span className="font-medium">
                                                Vecino seleccionado:
                                            </span>
                                        </div>
                                        <div className="text-green-700">
                                            <strong>
                                                {selectedVecinoForSearch.nombre}
                                            </strong>{" "}
                                            - {selectedVecinoForSearch.calle} #
                                            {
                                                selectedVecinoForSearch.numero_casa
                                            }
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
                                        className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                                        required
                                        disabled={loading}
                                    >
                                        <option value="">
                                            Seleccionar cantidad de meses
                                        </option>
                                        <option value="1">1 mes - $280</option>
                                        <option value="2">
                                            2 meses - $560
                                        </option>
                                        <option value="3">
                                            3 meses - $840
                                        </option>
                                        <option value="4">
                                            4 meses - $1,120
                                        </option>
                                        <option value="5">
                                            5 meses - $1,400
                                        </option>
                                        <option value="6">
                                            6 meses - $1,680
                                        </option>
                                        <option value="7">
                                            7 meses - $1,960
                                        </option>
                                        <option value="8">
                                            8 meses - $2,240
                                        </option>
                                        <option value="9">
                                            9 meses - $2,520
                                        </option>
                                        <option value="10">
                                            10 meses - $2,800
                                        </option>
                                        <option value="11">
                                            11 meses - $3,080
                                        </option>
                                        <option value="12">
                                            12 meses - $3,360
                                        </option>
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
                                        className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
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
                                        className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                                        disabled={loading}
                                    >
                                        <option value="ordinario">
                                            Ordinario
                                        </option>
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
                                        className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                                        disabled={loading}
                                    />
                                </div>

                                {/* Payment Summary */}
                                {form.meses_pagados &&
                                    form.vecino_id &&
                                    form.mes && (
                                        <div className="md:col-span-2 bg-green-50 border-2 border-green-200 rounded-xl p-4">
                                            <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                                                <CreditCardIcon className="w-5 h-5" />
                                                Resumen del Pago
                                            </h4>
                                            <div className="grid grid-cols-3 gap-4 text-sm">
                                                <div>
                                                    <div className="text-green-700">
                                                        Meses a pagar:
                                                    </div>
                                                    <div className="font-bold text-green-900">
                                                        {form.meses_pagados} mes
                                                        {parseInt(
                                                            form.meses_pagados
                                                        ) > 1
                                                            ? "es"
                                                            : ""}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-green-700">
                                                        Total a pagar:
                                                    </div>
                                                    <div className="font-bold text-orange-600">
                                                        $
                                                        {calculateTotalAmount().toLocaleString()}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-green-700">
                                                        Desde mes:
                                                    </div>
                                                    <div className="font-bold text-green-900">
                                                        {formatMonth(form.mes)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 p-3 bg-white rounded-lg border-2 border-green-300">
                                                <div className="text-xs text-green-600 font-medium mb-1">
                                                    Detalle del pago:
                                                </div>
                                                <div className="text-sm text-green-800">
                                                    {form.meses_pagados} × $280
                                                    = $
                                                    {calculateTotalAmount().toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-4 pt-6 border-t border-gray-200">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-orange-500 text-white py-3 px-6 rounded-xl hover:bg-orange-600 transition-all duration-200 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center shadow-lg border-b-4 border-orange-600 transform hover:scale-105 active:scale-95"
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
                                        className="bg-gray-500 text-white py-3 px-6 rounded-xl hover:bg-gray-600 transition-all duration-200 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 active:scale-95"
                                    >
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Payments History */}
                <div className="bg-white backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 overflow-hidden">
                    <div className="bg-orange-500 px-6 py-4">
                        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                            <CreditCardIcon className="w-6 h-6" />
                            Historial de Pagos ({pagos.length})
                        </h3>
                    </div>

                    <div className="overflow-x-auto bg-white">
                        <table className="w-full">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                                        Vecino
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                                        Mes
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                                        Tipo
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                                        Cantidad
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                                        Estado
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                                        Fecha Cobro
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-700">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {pagos.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="7"
                                            className="px-6 py-12 text-center"
                                        >
                                            <div className="flex flex-col items-center gap-3">
                                                <CreditCardIcon className="w-12 h-12 text-gray-400" />
                                                <p className="text-gray-500 font-medium">
                                                    No hay pagos registrados
                                                </p>
                                                <p className="text-gray-400 text-sm">
                                                    Los pagos aparecerán aquí
                                                    una vez que se registren
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    pagos.map((pago, index) => (
                                        <tr
                                            key={pago.id}
                                            className={`hover:bg-orange-50 transition-colors ${
                                                index % 2 === 0
                                                    ? "bg-white"
                                                    : "bg-gray-50/50"
                                            }`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-orange-300 rounded-full flex items-center justify-center">
                                                        <span className="text-white font-semibold text-sm">
                                                            {pago.vecino.nombre
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            {pago.vecino.nombre}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {pago.vecino.calle}{" "}
                                                            #
                                                            {
                                                                pago.vecino
                                                                    .numero_casa
                                                            }
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                {formatMonth(pago.mes)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                        pago.tipo ===
                                                        "extraordinario"
                                                            ? "bg-orange-100 text-orange-800 border border-orange-200"
                                                            : "bg-green-100 text-green-800 border border-green-200"
                                                    }`}
                                                >
                                                    {pago.tipo
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                        pago.tipo.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-gray-900">
                                                    $
                                                    {pago.cantidad.toLocaleString()}
                                                </div>
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
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                    <CheckIcon className="w-3 h-3 mr-1" />
                                                    Pagado Completo
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                {pago.fecha_de_cobro
                                                    ? pago.fecha_de_cobro.split(
                                                          "T"
                                                      )[0] // → "2025-09-15"
                                                    : "-"}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() =>
                                                            handleEdit(pago)
                                                        }
                                                        disabled={loading}
                                                        className="p-2 text-amber-600 hover:bg-amber-100 rounded-full transition-colors"
                                                    >
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleDelete(
                                                                pago.id
                                                            )
                                                        }
                                                        disabled={loading}
                                                        className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Floating Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-200/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-200/20 rounded-full blur-3xl"></div>
            </div>
        </div>
    );
}

export default Pagos;
