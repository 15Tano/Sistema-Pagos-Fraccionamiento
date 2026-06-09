import { useRef, useState } from "react";
import useAuthStore from "../store/authStore";
import api from "../lib/axios";

const SearchIcon = () => (
    <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <circle cx="11" cy="11" r="8" strokeWidth="2" />
        <path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
    </svg>
);
const XIcon = () => (
    <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path strokeLinecap="round" strokeWidth="2" d="M18 6L6 18M6 6l12 12" />
    </svg>
);
const HomeIcon = () => (
    <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        />
        <polyline points="9 22 9 12 15 12 15 22" strokeWidth="2" />
    </svg>
);
const ShieldIcon = () => (
    <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        />
    </svg>
);
const CheckCircleIcon = () => (
    <svg
        className="w-9 h-9"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <circle cx="12" cy="12" r="9" strokeWidth="2" />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M9 12l2 2 4-4"
        />
    </svg>
);
const XCircleIcon = () => (
    <svg
        className="w-9 h-9"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <circle cx="12" cy="12" r="9" strokeWidth="2" />
        <path strokeLinecap="round" strokeWidth="2" d="M15 9l-6 6M9 9l6 6" />
    </svg>
);
const CardIcon = () => (
    <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
        <path strokeLinecap="round" strokeWidth="2" d="M2 10h20" />
    </svg>
);
const LogoutIcon = () => (
    <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
        />
    </svg>
);

const BackgroundBlobs = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none bg-stone-50 z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-orange-300/25 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[450px] h-[450px] rounded-full bg-amber-300/25 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-rose-200/20 blur-[120px]" />
    </div>
);

const TagCard = ({ tag }) => {
    const activo = tag.activo ?? tag.active ?? true;
    return (
        <li
            className={
                "flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all " +
                (activo
                    ? "bg-white/40 border-white/60 shadow-sm"
                    : "bg-white/10 border-white/20 opacity-50")
            }
        >
            <div
                className={
                    "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center " +
                    (activo
                        ? "bg-orange-500/15 text-orange-500"
                        : "bg-stone-400/15 text-stone-500")
                }
            >
                <CardIcon />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-800 truncate">
                    {tag.codigo ?? tag.numero_tag ?? "Tag #" + tag.id}
                </p>
                <p className="text-xs text-stone-500 truncate">
                    {tag.tipo ?? tag.descripcion ?? "Acceso general"}
                </p>
            </div>
            <span
                className={
                    "flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full " +
                    (activo
                        ? "bg-orange-500/15 text-orange-600 border border-orange-200/50"
                        : "bg-stone-400/15 text-stone-500 border border-stone-200/50")
                }
            >
                {activo ? "Activo" : "Inactivo"}
            </span>
        </li>
    );
};

const EstadoPago = ({ alCorriente }) => {
    const mes = new Date().toLocaleString("es-MX", {
        month: "long",
        year: "numeric",
    });
    if (alCorriente) {
        return (
            <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/30">
                <div className="text-emerald-500 flex-shrink-0">
                    <CheckCircleIcon />
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                        Al corriente
                    </p>
                    <p className="text-sm font-semibold text-emerald-700 capitalize mt-0.5">
                        Pago de {mes} confirmado
                    </p>
                </div>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-400/30">
            <div className="text-red-500 flex-shrink-0">
                <XCircleIcon />
            </div>
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-red-600">
                    Pago pendiente
                </p>
                <p className="text-sm font-semibold text-red-700 capitalize mt-0.5">
                    {mes} sin registrar
                </p>
            </div>
        </div>
    );
};

export default function VistaVigilancia() {
    const logout = useAuthStore((state) => state.logout);

    const [vecinoSearch, setVecinoSearch] = useState("");
    const [vecinoResults, setVecinoResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedVecino, setSelectedVecino] = useState(null);
    const searchTimeout = useRef(null);

    const [tags, setTags] = useState([]);
    const [alCorriente, setAlCorriente] = useState(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [errorDetalle, setErrorDetalle] = useState("");

    const calcularAlCorriente = (meses) => {
        const ahora = new Date();
        // El backend devuelve mes como "2026-06" — construimos el mismo formato
        const mesActual =
            ahora.getFullYear() +
            "-" +
            String(ahora.getMonth() + 1).padStart(2, "0");
        const entrada = meses.find((e) => e.mes === mesActual);
        return entrada?.pagado === true;
    };

    const cargarDetalle = async (vecino) => {
        setLoadingDetalle(true);
        setErrorDetalle("");
        setTags([]);
        setAlCorriente(null);
        try {
            // El endpoint devuelve { meses: [...], tags: [...] } en un solo objeto
            const res = await api.get("/pagos/estado-meses/" + vecino.uuid);
            const { meses = [], tags: tagsData = [] } = res.data;
            setTags(tagsData);
            setAlCorriente(calcularAlCorriente(meses));
        } catch (err) {
            setErrorDetalle(
                err?.response?.data?.message ??
                    "Error al cargar los datos del vecino.",
            );
        } finally {
            setLoadingDetalle(false);
        }
    };

    const handleVecinoSearch = (val) => {
        setVecinoSearch(val);
        setSelectedVecino(null);
        setAlCorriente(null);
        setTags([]);
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
        setVecinoSearch(v.nombre + " — " + v.calle + " #" + v.numero_casa);
        setShowDropdown(false);
        setVecinoResults([]);
        cargarDetalle(v);
    };

    const limpiarBusqueda = () => {
        setVecinoSearch("");
        setSelectedVecino(null);
        setVecinoResults([]);
        setShowDropdown(false);
        setTags([]);
        setAlCorriente(null);
        setErrorDetalle("");
    };

    const handleLogout = async () => {
        try {
            await api.post("/logout");
        } finally {
            logout();
            window.location.href = "/login";
        }
    };

    return (
        <div className="min-h-screen relative flex flex-col p-4 pb-8">
            <BackgroundBlobs />

            <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-10 pb-3 pointer-events-none">
                {/* Pill izquierda: escudo + textos */}
                <div className="pointer-events-auto flex items-center gap-3 bg-white/40 backdrop-blur-sm border border-white/60 rounded-2xl px-3 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-orange-500/15 text-orange-500">
                        <ShieldIcon />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 leading-none">
                            Caseta de Vigilancia
                        </p>
                        <p className="text-sm font-bold text-stone-800 leading-tight mt-0.5">
                            Consulta de acceso
                        </p>
                    </div>
                </div>

                {/* Pill derecha: botón salir */}
                <button
                    type="button"
                    onClick={handleLogout}
                    className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/40 backdrop-blur-sm border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] text-sm font-bold text-stone-600 hover:text-red-600 hover:bg-red-50/50 hover:border-red-200/60 transition-all active:scale-95"
                >
                    <LogoutIcon />
                    Salir
                </button>
            </header>

            <main className="relative z-10 flex flex-col gap-4 w-full max-w-[540px] mx-auto pt-24">
                {/* Buscador */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-6">
                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-3 ml-1">
                        Buscar residente
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none">
                            <SearchIcon />
                        </span>
                        <input
                            type="text"
                            value={vecinoSearch}
                            onChange={(e) => handleVecinoSearch(e.target.value)}
                            onFocus={() =>
                                vecinoResults.length > 0 &&
                                setShowDropdown(true)
                            }
                            placeholder="Nombre, apellidos o número de casa..."
                            className="w-full pl-12 pr-12 py-3.5 bg-white/50 backdrop-blur-sm border border-white/60 rounded-2xl focus:outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-400 focus:bg-white/80 text-base font-medium text-stone-800 placeholder-stone-500 transition-all hover:bg-white/60"
                        />
                        {vecinoSearch && (
                            <button
                                type="button"
                                onClick={limpiarBusqueda}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors p-1"
                            >
                                <XIcon />
                            </button>
                        )}

                        {showDropdown && vecinoResults.length > 0 && (
                            <ul className="absolute z-20 mt-2 w-full bg-white/80 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-xl overflow-hidden divide-y divide-stone-100/50">
                                {vecinoResults.map((v) => (
                                    <li key={v.id}>
                                        <button
                                            type="button"
                                            onClick={() => selectVecino(v)}
                                            className="w-full text-left px-5 py-3.5 hover:bg-white/60 transition-colors flex items-center gap-4"
                                        >
                                            <span className="w-10 h-10 rounded-full bg-orange-100 border border-orange-200 text-orange-500 flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-inner">
                                                {v.nombre?.[0]?.toUpperCase() ??
                                                    "?"}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-base font-bold text-stone-800 truncate">
                                                    {v.nombre}{" "}
                                                    {v.apellido_paterno ?? ""}{" "}
                                                    {v.apellido_materno ?? ""}
                                                </span>
                                                <span className="flex items-center gap-1.5 text-sm text-stone-500 mt-0.5">
                                                    <HomeIcon />
                                                    {v.calle} #{v.numero_casa}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {showDropdown &&
                        vecinoResults.length === 0 &&
                        vecinoSearch.trim() && (
                            <p className="text-center text-sm text-stone-400 mt-3">
                                Sin resultados para "{vecinoSearch}"
                            </p>
                        )}
                </div>

                {/* Detalle */}
                {selectedVecino && (
                    <div className="flex flex-col gap-4">
                        {/* Chip vecino seleccionado */}
                        <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-5">
                            <div className="flex items-center gap-4">
                                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-md">
                                    {selectedVecino.nombre?.[0]?.toUpperCase()}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-base font-bold text-stone-800 truncate">
                                        {selectedVecino.nombre}{" "}
                                        {selectedVecino.apellido_paterno ?? ""}{" "}
                                        {selectedVecino.apellido_materno ?? ""}
                                    </p>
                                    <p className="text-sm text-stone-500 mt-0.5 flex items-center gap-1.5">
                                        <HomeIcon />
                                        {selectedVecino.calle} #
                                        {selectedVecino.numero_casa}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Loading */}
                        {loadingDetalle && (
                            <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl p-8 flex flex-col items-center gap-3">
                                <div className="w-8 h-8 rounded-full border-2 border-orange-400/30 border-t-orange-500 animate-spin" />
                                <p className="text-sm font-medium text-stone-500">
                                    Consultando información…
                                </p>
                            </div>
                        )}

                        {/* Error */}
                        {errorDetalle && !loadingDetalle && (
                            <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl">
                                {errorDetalle}
                            </div>
                        )}

                        {/* Estado de pago */}
                        {!loadingDetalle && alCorriente !== null && (
                            <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-5">
                                <p className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-3 ml-1">
                                    Estado de pago
                                </p>
                                <EstadoPago alCorriente={alCorriente} />
                            </div>
                        )}

                        {/* Tags */}
                        {!loadingDetalle && alCorriente !== null && (
                            <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-5">
                                <div className="flex items-center justify-between mb-3 ml-1">
                                    <p className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                                        Tags de acceso
                                    </p>
                                    <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-stone-400/10 text-stone-500 border border-stone-200/50">
                                        {tags.length}{" "}
                                        {tags.length === 1 ? "tag" : "tags"}
                                    </span>
                                </div>

                                {tags.length > 0 ? (
                                    <ul className="flex flex-col gap-2">
                                        {tags.map((tag) => (
                                            <TagCard key={tag.id} tag={tag} />
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-6 text-stone-400">
                                        <CardIcon />
                                        <p className="text-sm font-medium">
                                            Sin tags asignados
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Botón nueva búsqueda */}
                        {!loadingDetalle && (
                            <button
                                type="button"
                                onClick={limpiarBusqueda}
                                className="w-full py-4 rounded-2xl bg-white/40 backdrop-blur-md border border-white/50 shadow-[0_4px_15px_rgba(0,0,0,0.03)] text-sm font-bold text-stone-600 hover:bg-white/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <XIcon />
                                Nueva búsqueda
                            </button>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
