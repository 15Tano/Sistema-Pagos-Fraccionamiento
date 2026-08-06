import { useState, useEffect, useCallback, useRef } from "react";
import api from "../lib/axios";

// ── ICONS ──
const SearchIcon = () => (
    <svg
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"
        />
    </svg>
);
const XIcon = () => (
    <svg
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
        />
    </svg>
);
const ChevronIcon = ({ open }) => (
    <svg
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
        }}
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
        />
    </svg>
);
const TagIcon = () => (
    <svg
        width="11"
        height="11"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
        />
    </svg>
);
const TrashIcon = () => (
    <svg
        width="14"
        height="14"
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
const EditIcon = () => (
    <svg
        width="14"
        height="14"
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

// ── CUOTAS BASE ──
const CUOTAS = [280, 300, 500];
const RECARGO_EXTRA = 50;

// ── HELPERS DE FECHA LOCAL ──
const getLocalToday = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const getLocalMonth = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
};

// ── FILA EXPANDIBLE ──
function PagoExpandido({ vecinoUuid }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/pagos/estado-meses/${vecinoUuid}`)
            .then((r) => setData(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [vecinoUuid]);

    if (loading)
        return (
            <div className="px-5 py-4 flex items-center justify-center gap-2 text-xs text-stone-400 font-medium bg-white/20 border-t border-white/40">
                <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                Cargando estado...
            </div>
        );

    if (!data) return null;

    return (
        <div className="px-5 py-4 bg-white/30 backdrop-blur-md border-t border-white/60 flex flex-col sm:flex-row gap-5 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]">
            {/* Últimos 3 meses */}
            <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
                    Últimos 3 meses
                </p>
                <div className="flex gap-2.5">
                    {data.meses.map((m) => (
                        <div
                            key={m.mes}
                            className="flex flex-col items-center gap-1.5"
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] border
                                ${
                                    m.pagado
                                        ? "bg-green-100/60 border-green-200/60 text-green-700"
                                        : "bg-red-100/60 border-red-200/60 text-red-600"
                                }`}
                            >
                                {m.pagado ? "✓" : "✗"}
                            </div>
                            <span
                                className="text-[10px] font-medium text-stone-500 text-center leading-tight"
                                style={{ maxWidth: 52 }}
                            >
                                {m.label.split(" ")[0]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px bg-white/60" />

            {/* Tags */}
            <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
                    Tags asignados
                </p>
                {data.tags.length === 0 ? (
                    <span className="text-xs text-stone-400 italic">
                        Sin tags
                    </span>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {data.tags.map((tag) => (
                            <span
                                key={tag.id}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold bg-orange-100/60 text-orange-700 border border-orange-200/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]"
                            >
                                <TagIcon />
                                {tag.codigo}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── FORMULARIO DE PAGO ──
function FormularioPago({ onSaved, editingPago, onCancelEdit }) {
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

// ── COMPONENTE PRINCIPAL ──
export default function Pagos() {
    const [pagos, setPagos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPago, setEditingPago] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const PER_PAGE = 20;

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebounced] = useState("");
    const [filterFecha, setFilterFecha] = useState("");

    useEffect(() => {
        const t = setTimeout(() => {
            setDebounced(search);
            setCurrentPage(1);
        }, 200);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterFecha]);

    const fetchPagos = useCallback(
        async (page = 1) => {
            setLoading(true);
            try {
                const params = { page, per_page: PER_PAGE };
                if (debouncedSearch) params.search = debouncedSearch;
                if (filterFecha) params.fecha_cobro = filterFecha;
                const res = await api.get("/pagos", { params });
                const paginated = res.data;
                setPagos(paginated.data || []);
                setCurrentPage(paginated.current_page);
                setLastPage(paginated.last_page);
                setTotal(paginated.total);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        },
        [debouncedSearch, filterFecha],
    );

    useEffect(() => {
        fetchPagos(currentPage);
    }, [fetchPagos, currentPage]);

    const handleDelete = async (uuid) => {
        try {
            await api.delete(`/pagos/${uuid}`);
            setDeleteConfirm(null);
            fetchPagos(currentPage);
        } catch (err) {
            console.error(err);
        }
    };

    const getPageNumbers = () => {
        if (lastPage <= 5)
            return Array.from({ length: lastPage }, (_, i) => i + 1);
        if (currentPage <= 3) return [1, 2, 3, 4, "...", lastPage];
        if (currentPage >= lastPage - 2)
            return [
                1,
                "...",
                lastPage - 3,
                lastPage - 2,
                lastPage - 1,
                lastPage,
            ];
        return [
            1,
            "...",
            currentPage - 1,
            currentPage,
            currentPage + 1,
            "...",
            lastPage,
        ];
    };

    const formatMes = (mes) => {
        if (!mes) return "-";
        const [y, m] = mes.split("-");
        return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
            "es-MX",
            { month: "long", year: "numeric" },
        );
    };

    const formatDate = (d) => {
        if (!d) return "-";
        const [year, month, day] = d.slice(0, 10).split("-");
        return new Date(year, month - 1, day).toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <div className="flex flex-col gap-6 h-full pb-20 md:pb-0">
            {/* Header */}
            <div className="px-2">
                <h1 className="text-3xl font-semibold text-stone-800 mb-1">
                    Gestión de Pagos
                </h1>
                <p className="text-sm font-medium text-stone-500">
                    {total} recibos registrados en el sistema
                </p>
            </div>

            {/* Formulario */}
            <FormularioPago
                onSaved={() => fetchPagos(currentPage)}
                editingPago={editingPago}
                onCancelEdit={() => setEditingPago(null)}
            />

            {/* Panel Principal */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem] flex flex-col flex-1">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

                {/* Filtros tabla */}
                <div className="p-5 flex flex-col sm:flex-row gap-4 relative z-10 bg-white/20 border-b border-white/40">
                    <div className="relative flex-1">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar vecino en recibos..."
                            className="w-full pl-11 pr-10 py-3 rounded-xl bg-white/50 backdrop-blur-md border border-white/60 text-sm font-medium text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] transition-all"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                            >
                                <XIcon />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide whitespace-nowrap">
                            Filtrar por fecha:
                        </label>
                        <div className="relative">
                            <input
                                type="date"
                                value={filterFecha}
                                onChange={(e) => setFilterFecha(e.target.value)}
                                className="py-3 pl-4 pr-9 rounded-xl bg-white/50 backdrop-blur-md border border-white/60 text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] transition-all cursor-pointer"
                            />
                            {filterFecha && (
                                <button
                                    onClick={() => setFilterFecha("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 bg-white/50 rounded"
                                >
                                    <XIcon />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabla */}
                <div className="relative z-10 flex-1 overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-48 gap-3">
                            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm font-medium text-stone-500">
                                Cargando registro de pagos...
                            </span>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-black/5 border-b border-white/40">
                                <tr>
                                    <th className="w-10 px-4 py-4" />
                                    <th className="px-5 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                        Vecino
                                    </th>
                                    <th className="px-5 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                        Mes Cobrado
                                    </th>
                                    <th className="px-5 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                        Tipo
                                    </th>
                                    <th className="px-5 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                        Monto Total
                                    </th>
                                    <th className="px-5 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                        Fecha Física
                                    </th>
                                    <th className="px-5 py-4 text-center text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/40">
                                {pagos.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="7"
                                            className="px-5 py-16 text-center text-stone-400 text-sm font-medium"
                                        >
                                            {debouncedSearch
                                                ? `No hay coincidencias para "${debouncedSearch}"`
                                                : "Aún no hay pagos registrados."}
                                        </td>
                                    </tr>
                                ) : (
                                    pagos.map((pago) => (
                                        <div
                                            key={`row-${pago.uuid}`}
                                            className="contents"
                                        >
                                            <tr
                                                className={`hover:bg-white/40 transition-colors ${expandedId === pago.uuid ? "bg-white/30" : ""}`}
                                            >
                                                <td className="px-4 py-4">
                                                    <button
                                                        onClick={() =>
                                                            setExpandedId(
                                                                expandedId ===
                                                                    pago.uuid
                                                                    ? null
                                                                    : pago.uuid,
                                                            )
                                                        }
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 bg-white/50 border border-stone-200/50 hover:bg-white transition-all shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]"
                                                    >
                                                        <ChevronIcon
                                                            open={
                                                                expandedId ===
                                                                pago.uuid
                                                            }
                                                        />
                                                    </button>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <p className="text-sm font-semibold text-stone-800 capitalize">
                                                        {pago.vecino?.nombre}
                                                    </p>
                                                    <p className="text-xs font-medium text-stone-500 mt-0.5">
                                                        {pago.vecino?.calle} #
                                                        {
                                                            pago.vecino
                                                                ?.numero_casa
                                                        }
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-stone-700 capitalize">
                                                    {formatMes(pago.mes)}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span
                                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] border ${
                                                            pago.tipo ===
                                                            "extraordinario"
                                                                ? "bg-purple-100/60 text-purple-700 border-purple-200/60"
                                                                : "bg-blue-100/60 text-blue-700 border-blue-200/60"
                                                        }`}
                                                    >
                                                        {pago.tipo}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-semibold text-stone-800">
                                                        $
                                                        {parseFloat(
                                                            pago.cantidad,
                                                        ).toLocaleString(
                                                            "es-MX",
                                                            {
                                                                minimumFractionDigits: 2,
                                                            },
                                                        )}
                                                    </span>
                                                    {pago.meses_pagados > 1 && (
                                                        <span className="ml-1.5 text-[10px] font-medium text-stone-400 uppercase tracking-widest">
                                                            (
                                                            {pago.meses_pagados}{" "}
                                                            m)
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-stone-500">
                                                    {formatDate(
                                                        pago.fecha_de_cobro,
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() =>
                                                                setEditingPago(
                                                                    pago,
                                                                )
                                                            }
                                                            className="w-8 h-8 rounded-xl flex items-center justify-center text-amber-500 bg-white/50 border border-amber-200/50 hover:bg-amber-50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] transition-all"
                                                        >
                                                            <EditIcon />
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                setDeleteConfirm(
                                                                    pago,
                                                                )
                                                            }
                                                            className="w-8 h-8 rounded-xl flex items-center justify-center text-red-500 bg-white/50 border border-red-200/50 hover:bg-red-50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] transition-all"
                                                        >
                                                            <TrashIcon />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedId === pago.uuid && (
                                                <tr key={`exp-${pago.uuid}`}>
                                                    <td
                                                        colSpan="7"
                                                        className="p-0"
                                                    >
                                                        <PagoExpandido
                                                            vecinoUuid={
                                                                pago.vecino
                                                                    ?.uuid
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </div>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Paginación */}
                {lastPage > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/40 bg-white/20 flex-wrap gap-3 relative z-10">
                        <span className="text-xs font-medium text-stone-500">
                            {(currentPage - 1) * PER_PAGE + 1}–
                            {Math.min(currentPage * PER_PAGE, total)} de {total}
                        </span>
                        <div className="flex gap-1.5 items-center flex-wrap">
                            <button
                                onClick={() =>
                                    setCurrentPage((p) => Math.max(1, p - 1))
                                }
                                disabled={currentPage === 1}
                                className="w-8 h-8 rounded-xl border border-white/80 bg-white/50 text-stone-600 text-sm font-semibold flex items-center justify-center hover:bg-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] disabled:opacity-40 disabled:shadow-none transition-all active:scale-95"
                            >
                                ‹
                            </button>
                            {getPageNumbers().map((p, i) =>
                                p === "..." ? (
                                    <span
                                        key={`e${i}`}
                                        className="w-5 text-center text-xs font-medium text-stone-400"
                                    >
                                        …
                                    </span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setCurrentPage(p)}
                                        className={`w-8 h-8 rounded-xl text-xs font-semibold flex items-center justify-center transition-all active:scale-95
                                            ${
                                                currentPage === p
                                                    ? "bg-gradient-to-br from-orange-400 to-orange-500 text-white border-orange-400 shadow-[0_2px_6px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)]"
                                                    : "border border-white/80 bg-white/50 text-stone-600 hover:bg-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]"
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ),
                            )}
                            <button
                                onClick={() =>
                                    setCurrentPage((p) =>
                                        Math.min(lastPage, p + 1),
                                    )
                                }
                                disabled={currentPage === lastPage}
                                className="w-8 h-8 rounded-xl border border-white/80 bg-white/50 text-stone-600 text-sm font-semibold flex items-center justify-center hover:bg-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] disabled:opacity-40 disabled:shadow-none transition-all active:scale-95"
                            >
                                ›
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de confirmación */}
            {deleteConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity"
                    onClick={() => setDeleteConfirm(null)}
                >
                    <div className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm" />
                    <div
                        className="relative w-full max-w-sm bg-white/70 backdrop-blur-2xl border-t border-l border-white/80 border-r border-b border-white/40 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.8)] p-8 transform transition-all scale-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-stone-800 mb-2 drop-shadow-sm">
                            ¿Eliminar recibo de pago?
                        </h3>
                        <p className="text-sm font-medium text-stone-500 mb-6 leading-relaxed">
                            Se borrará permanentemente el pago de{" "}
                            <span className="font-semibold text-stone-700">
                                {deleteConfirm.vecino?.nombre}
                            </span>{" "}
                            correspondiente a{" "}
                            <span className="font-semibold text-stone-700 capitalize">
                                {formatMes(deleteConfirm.mes)}
                            </span>
                            . Esta acción no se puede deshacer.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-3 rounded-xl border border-white/80 bg-white/50 text-stone-600 text-sm font-semibold hover:bg-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm.uuid)}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-400 text-white text-sm font-semibold hover:from-red-400 hover:to-red-500 shadow-[0_4px_15px_rgba(239,68,68,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)] transition-all active:scale-95"
                            >
                                Sí, eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
