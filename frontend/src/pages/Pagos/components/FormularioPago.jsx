import { useState, useEffect, useRef } from "react";
import api from "../../../lib/axios";
import { SearchIcon, XIcon } from "./Icons";
import { CUOTAS, RECARGO_EXTRA } from "../constantes";
import { getLocalToday, getLocalMonth } from "../fechas";

// ── FORMULARIO DE PAGO ──
export default function FormularioPago({ onSaved, editingPago, onCancelEdit }) {
    const isEdit = !!editingPago;

    const [vecinoSearch, setVecinoSearch] = useState("");
    const [vecinoResults, setVecinoResults] = useState([]);
    const [selectedVecino, setSelectedVecino] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [cuotaBase, setCuotaBase] = useState(280);
    const [mesesPagados, setMesesPagados] = useState(1);

    // CORRECCIÓN: Uso de fechas locales
    const [mes, setMes] = useState(() => getLocalMonth());
    const [tipo, setTipo] = useState("ordinario");
    const [fechaCobro, setFechaCobro] = useState(() => getLocalToday());

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const searchTimeout = useRef(null);
    const dropdownRef = useRef(null);

    // Poblar form al editar
    useEffect(() => {
        if (editingPago) {
            setSelectedVecino(editingPago.vecino);
            setVecinoSearch(
                `${editingPago.vecino.nombre} — ${editingPago.vecino.calle} #${editingPago.vecino.numero_casa}`,
            );
            const porMes =
                editingPago.meses_pagados > 0
                    ? Math.round(
                          editingPago.cantidad / editingPago.meses_pagados,
                      )
                    : editingPago.cantidad;
            const recargo =
                editingPago.tipo === "extraordinario" ? RECARGO_EXTRA : 0;
            const base = porMes - recargo;
            setCuotaBase(CUOTAS.includes(base) ? base : 280);
            setMesesPagados(editingPago.meses_pagados || 1);
            setMes(editingPago.mes || "");
            setTipo(editingPago.tipo || "ordinario");
            setFechaCobro(
                editingPago.fecha_de_cobro
                    ? editingPago.fecha_de_cobro.slice(0, 10)
                    : "",
            );
        } else {
            resetForm();
        }
    }, [editingPago]);

    const resetForm = () => {
        setSelectedVecino(null);
        setVecinoSearch("");
        setVecinoResults([]);
        setCuotaBase(280);
        setMesesPagados(1);
        setMes(getLocalMonth());
        setTipo("ordinario");
        setFechaCobro(getLocalToday());
        setError("");
    };

    const handleVecinoSearch = (val) => {
        setVecinoSearch(val);
        setSelectedVecino(null);
        clearTimeout(searchTimeout.current);
        if (!val.trim()) {
            setVecinoResults([]);
            setShowDropdown(false);
            return;
        }
        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await api.get("/vecinos", {
                    params: { search: val, per_page: 8 },
                });
                setVecinoResults(res.data.data || []);
                setShowDropdown(true);
            } catch {
                setVecinoResults([]);
            }
        }, 200);
    };

    const selectVecino = (v) => {
        setSelectedVecino(v);
        setVecinoSearch(`${v.nombre} — ${v.calle} #${v.numero_casa}`);
        setShowDropdown(false);
        setVecinoResults([]);
    };

    const recargo = tipo === "extraordinario" ? RECARGO_EXTRA : 0;
    const porMes = cuotaBase + recargo;
    const totalCalc = porMes * mesesPagados;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedVecino && !isEdit) {
            setError("Selecciona un vecino.");
            return;
        }
        if (!mes) {
            setError("Selecciona el mes de inicio.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const payload = {
                cuota_base: cuotaBase,
                meses_pagados: mesesPagados,
                mes,
                tipo,
                fecha_de_cobro: fechaCobro || null,
            };
            if (!isEdit) payload.vecino_uuid = selectedVecino.uuid;

            if (isEdit) {
                await api.put(`/pagos/${editingPago.uuid}`, payload);
            } else {
                await api.post("/pagos", payload);
            }
            resetForm();
            onSaved();
        } catch (err) {
            setError(err.response?.data?.message || "Error al guardar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative overflow-visible p-6 sm:p-8 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                    <h2 className="text-lg font-semibold text-stone-800">
                        {isEdit ? "Editar Pago" : "Registrar Pago"}
                    </h2>
                    <p className="text-xs font-medium text-stone-500 mt-1">
                        {isEdit
                            ? "Modifica los datos del recibo seleccionado"
                            : "Completa la información para asentar el cobro"}
                    </p>
                </div>
                {isEdit && (
                    <span className="px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-orange-100/60 text-orange-700 border border-orange-200/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                        Modo edición
                    </span>
                )}
            </div>

            {error && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-red-50/90 border border-red-200 text-red-600 text-sm font-medium backdrop-blur-md">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-5 relative z-10"
            >
                {!isEdit && (
                    <div>
                        <label className="block text-xs font-medium text-stone-500 mb-1.5 ml-1">
                            Vecino *
                        </label>
                        <div className="relative" ref={dropdownRef}>
                            {!vecinoSearch && (
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                                    <SearchIcon />
                                </div>
                            )}
                            <input
                                type="text"
                                value={vecinoSearch}
                                onChange={(e) =>
                                    handleVecinoSearch(e.target.value)
                                }
                                onFocus={() =>
                                    vecinoResults.length > 0 &&
                                    setShowDropdown(true)
                                }
                                placeholder="Buscar por nombre, apellidos o número de casa..."
                                className="w-full pl-10 pr-10 py-3 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-700 placeholder-stone-400 transition-all"
                                disabled={loading}
                            />
                            {vecinoSearch && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setVecinoSearch("");
                                        setSelectedVecino(null);
                                        setShowDropdown(false);
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                                >
                                    <XIcon />
                                </button>
                            )}
                            {showDropdown && vecinoResults.length > 0 && (
                                <div className="absolute z-30 top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-xl border border-white/80 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden max-h-60 overflow-y-auto">
                                    {vecinoResults.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => selectVecino(v)}
                                            className="w-full px-5 py-3 text-left hover:bg-orange-50/80 border-b border-black/5 last:border-0 transition-colors"
                                        >
                                            <p className="text-sm font-semibold text-stone-800">
                                                {v.nombre}
                                            </p>
                                            <p className="text-xs font-medium text-stone-500 mt-0.5">
                                                {v.calle} #{v.numero_casa}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedVecino && (
                            <div className="mt-2.5 px-4 py-2.5 rounded-xl bg-green-100/40 border border-green-200/60 text-xs text-green-700 font-medium shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] flex items-center gap-2">
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                                {selectedVecino.nombre} — {selectedVecino.calle}{" "}
                                #{selectedVecino.numero_casa}
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Cuota base */}
                    <div>
                        <label className="block text-xs font-medium text-stone-500 mb-1.5 ml-1">
                            Cuota base *
                        </label>
                        <div className="flex gap-2">
                            {CUOTAS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCuotaBase(c)}
                                    className={`flex-1 py-3 rounded-xl text-sm font-medium border shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] transition-all active:scale-95
                                        ${
                                            cuotaBase === c
                                                ? "bg-gradient-to-r from-orange-500 to-orange-400 text-white border-orange-400 shadow-[0_4px_10px_rgba(249,115,22,0.3)]"
                                                : "bg-white/50 text-stone-600 border-white/60 hover:bg-white/80"
                                        }`}
                                >
                                    ${c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tipo */}
                    <div>
                        <label className="block text-xs font-medium text-stone-500 mb-1.5 ml-1">
                            Tipo de pago *
                        </label>
                        <select
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value)}
                            className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-700 transition-all cursor-pointer"
                            disabled={loading}
                        >
                            <option value="ordinario">Ordinario</option>
                            <option value="extraordinario">
                                Extraordinario (+$50)
                            </option>
                        </select>
                    </div>

                    {/* Meses */}
                    <div>
                        <label className="block text-xs font-medium text-stone-500 mb-1.5 ml-1">
                            Meses a pagar *
                        </label>
                        <select
                            value={mesesPagados}
                            onChange={(e) =>
                                setMesesPagados(Number(e.target.value))
                            }
                            className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-700 transition-all cursor-pointer"
                            disabled={loading}
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(
                                (n) => (
                                    <option key={n} value={n}>
                                        {n} mes{n > 1 ? "es" : ""}
                                    </option>
                                ),
                            )}
                        </select>
                    </div>

                    {/* Mes inicio */}
                    <div>
                        <label className="block text-xs font-medium text-stone-500 mb-1.5 ml-1">
                            Mes de inicio *
                        </label>
                        <input
                            type="month"
                            value={mes}
                            onChange={(e) => setMes(e.target.value)}
                            className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-700 transition-all cursor-pointer"
                            disabled={loading}
                        />
                    </div>

                    {/* Fecha de cobro */}
                    <div>
                        <label className="block text-xs font-medium text-stone-500 mb-1.5 ml-1">
                            Fecha física de cobro
                        </label>
                        <input
                            type="date"
                            value={fechaCobro}
                            onChange={(e) => setFechaCobro(e.target.value)}
                            className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-700 transition-all cursor-pointer"
                            disabled={loading}
                        />
                    </div>

                    {/* Resumen reactivo Visual */}
                    <div className="flex flex-col justify-end">
                        <div className="px-5 py-3 rounded-2xl bg-gradient-to-br from-orange-400/10 to-orange-500/10 border border-orange-200/50 flex flex-col justify-center h-full">
                            <p className="text-[10px] text-orange-800/60 font-semibold uppercase tracking-widest mb-0.5">
                                Total a Pagar
                            </p>
                            <p className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600 drop-shadow-sm">
                                ${totalCalc.toLocaleString("es-MX")}
                            </p>
                            <p className="text-[10px] text-stone-500 font-medium mt-1">
                                ${cuotaBase}{" "}
                                {recargo > 0 ? ` + $${recargo} recargo` : ""} ×{" "}
                                {mesesPagados} mes{mesesPagados > 1 ? "es" : ""}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/40 mt-2">
                    {isEdit && (
                        <button
                            type="button"
                            onClick={() => {
                                resetForm();
                                onCancelEdit();
                            }}
                            className="w-full sm:w-auto px-8 py-3 rounded-xl border border-white/80 bg-white/50 text-stone-600 text-sm font-semibold hover:bg-white/80 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] active:scale-95 transition-all"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full sm:flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 text-white text-sm font-semibold hover:from-orange-400 hover:to-orange-500 shadow-[0_4px_10px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)] disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading && (
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        )}
                        {loading
                            ? "Guardando..."
                            : isEdit
                              ? "Guardar cambios"
                              : "Registrar pago"}
                    </button>
                </div>
            </form>
        </div>
    );
}
