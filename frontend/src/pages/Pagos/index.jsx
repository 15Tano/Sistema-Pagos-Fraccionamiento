import { useState, useEffect, useCallback } from "react";
import api from "../../lib/axios";
import FormularioPago from "./components/FormularioPago";
import FiltrosTabla from "./components/FiltrosTabla";
import TablaPagos from "./components/TablaPagos";
import Paginacion from "./components/Paginacion";
import ModalConfirmarEliminar from "./components/ModalConfirmarEliminar";
import { formatMes, formatDate } from "./fechas";

const PER_PAGE = 20;

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

                <FiltrosTabla
                    search={search}
                    setSearch={setSearch}
                    filterFecha={filterFecha}
                    setFilterFecha={setFilterFecha}
                />

                <div className="relative z-10 flex-1 overflow-x-auto">
                    <TablaPagos
                        pagos={pagos}
                        loading={loading}
                        debouncedSearch={debouncedSearch}
                        expandedId={expandedId}
                        setExpandedId={setExpandedId}
                        onEdit={setEditingPago}
                        onDelete={setDeleteConfirm}
                        formatMes={formatMes}
                        formatDate={formatDate}
                    />
                </div>

                <Paginacion
                    currentPage={currentPage}
                    lastPage={lastPage}
                    total={total}
                    perPage={PER_PAGE}
                    onPageChange={setCurrentPage}
                />
            </div>

            {/* Modal de confirmación */}
            <ModalConfirmarEliminar
                pago={deleteConfirm}
                onCancel={() => setDeleteConfirm(null)}
                onConfirm={() => handleDelete(deleteConfirm.uuid)}
                formatMes={formatMes}
            />
        </div>
    );
}
