import { useRef, useState } from "react";
import axios from "axios";

// Instancia de axios SIN interceptores — usa el token temporal del PIN
const apiPublica = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
});

// ─── Iconos ───────────────────────────────────────────────────────────────────
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
const UserIcon = () => (
    <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
        />
        <circle cx="12" cy="7" r="4" strokeWidth="2" />
    </svg>
);
const LockIcon = () => (
    <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <rect x="3" y="11" width="18" height="11" rx="2" strokeWidth="2" />
        <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M7 11V7a5 5 0 0 1 10 0v4"
        />
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
const EyeIcon = ({ open }) =>
    open ? (
        <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeWidth="2"
                d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
            />
            <circle cx="12" cy="12" r="3" strokeWidth="2" />
        </svg>
    ) : (
        <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeWidth="2"
                d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"
            />
        </svg>
    );
const CheckIcon = () => (
    <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M5 13l4 4L19 7"
        />
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

// ─── Fondo Abstracto Reutilizable ──────────────────────────────────────────────
const BackgroundBlobs = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none bg-stone-50 z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-orange-400/30 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[450px] h-[450px] rounded-full bg-amber-300/30 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-rose-300/20 blur-[120px]" />
    </div>
);

// ─── Pantalla de PIN ──────────────────────────────────────────────────────────
function PinGate({ onSuccess }) {
    const [pin, setPin] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleVerify = async () => {
        if (!pin.trim()) {
            setError("Ingresa el PIN de acceso.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await apiPublica.post("/capturista/verify-pin", {
                pin,
            });
            onSuccess(res.data.token);
        } catch (err) {
            setError(
                err.response?.status === 403
                    ? "PIN incorrecto. Verifica e intenta de nuevo."
                    : "Error al verificar el PIN. Intenta de nuevo.",
            );
            setPin("");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 md:p-8">
            <BackgroundBlobs />

            <div className="w-full max-w-[420px] relative z-10">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-white/40 backdrop-blur-md border border-white/60 shadow-lg rounded-2xl flex items-center justify-center mx-auto mb-5 text-orange-500">
                        <ShieldIcon />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">
                        Área restringida
                    </p>
                    <h1 className="text-3xl font-bold text-stone-800">
                        Acceso de capturista
                    </h1>
                </div>

                {/* Tarjeta Glassmorphism */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-6 md:p-8 space-y-5">
                    {error && (
                        <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                            {error}
                        </div>
                    )}
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none">
                            <LockIcon />
                        </span>
                        <input
                            type={showPin ? "text" : "password"}
                            value={pin}
                            onChange={(e) => {
                                setPin(e.target.value);
                                setError("");
                            }}
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleVerify()
                            }
                            placeholder="PIN de acceso"
                            autoComplete="off"
                            className={`w-full pl-12 pr-12 py-3.5 bg-white/50 backdrop-blur-sm border rounded-2xl text-base font-medium text-stone-800 placeholder-stone-500 focus:outline-none focus:ring-4 transition-all tracking-widest hover:bg-white/60 ${
                                error
                                    ? "border-red-300 focus:border-red-400 focus:ring-red-400/20"
                                    : "border-white/60 focus:border-orange-400 focus:ring-orange-500/20 focus:bg-white/80"
                            }`}
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPin((v) => !v)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors p-1"
                            tabIndex={-1}
                        >
                            <EyeIcon open={showPin} />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleVerify}
                        disabled={loading}
                        className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-base font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 active:translate-y-0"
                    >
                        {loading ? "Verificando..." : "Ingresar"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RegistroAccesoVecino() {
    const [token, setToken] = useState(null);

    // Búsqueda
    const [vecinoSearch, setVecinoSearch] = useState("");
    const [vecinoResults, setVecinoResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedVecino, setSelectedVecino] = useState(null);
    const searchTimeout = useRef(null);

    // Formulario
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Estado envío
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errors, setErrors] = useState({});
    const [globalError, setGlobalError] = useState("");

    const call = (method, url, data = null) => {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        return method === "get"
            ? apiPublica.get(url, { ...config, params: data })
            : apiPublica.post(url, data, config);
    };

    if (!token) {
        return <PinGate onSuccess={(t) => setToken(t)} />;
    }

    const handleVecinoSearch = (val) => {
        setVecinoSearch(val);
        setSelectedVecino(null);
        setErrors((e) => ({ ...e, vecino_id: undefined }));
        clearTimeout(searchTimeout.current);

        if (!val.trim()) {
            setVecinoResults([]);
            setShowDropdown(false);
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await call("get", "/vecinos", {
                    search: val,
                    per_page: 8,
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
        setErrors((e) => ({ ...e, vecino_id: undefined }));
    };

    const clearVecino = () => {
        setVecinoSearch("");
        setSelectedVecino(null);
        setShowDropdown(false);
        setVecinoResults([]);
    };

    const handleSubmit = async () => {
        setErrors({});
        setGlobalError("");

        const clientErrors = {};
        if (!selectedVecino)
            clientErrors.vecino_id = "Selecciona un vecino de la lista.";
        if (!username.trim())
            clientErrors.username = "El nombre de usuario es obligatorio.";
        if (!password) clientErrors.password = "La contraseña es obligatoria.";
        if (Object.keys(clientErrors).length) {
            setErrors(clientErrors);
            return;
        }

        setLoading(true);
        try {
            await call("post", "/vecinos/registro-acceso", {
                vecino_id: selectedVecino.id,
                username: username.trim(),
                password,
            });
            setSuccess(true);
        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors || {});
            } else {
                setGlobalError(
                    err.response?.data?.message ||
                        "Ocurrió un error al crear las credenciales. Intenta de nuevo.",
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSuccess(false);
        clearVecino();
        setUsername("");
        setPassword("");
        setErrors({});
        setGlobalError("");
    };

    // ── Pantalla de éxito ────────────────────────────────────────────────────
    if (success) {
        return (
            <div className="min-h-screen relative flex items-center justify-center p-4 md:p-8">
                <BackgroundBlobs />
                <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-3xl p-8 md:p-12 max-w-[480px] w-full text-center relative z-10">
                    <div className="w-20 h-20 bg-green-500/20 backdrop-blur-md border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 shadow-lg shadow-green-500/20">
                        <CheckIcon />
                    </div>
                    <h2 className="text-2xl font-bold text-stone-800 mb-2">
                        ¡Acceso creado!
                    </h2>
                    <p className="text-stone-600 text-base mb-4 leading-relaxed">
                        El vecino{" "}
                        <span className="font-bold text-stone-800">
                            {selectedVecino?.nombre}
                        </span>{" "}
                        ya puede ingresar con el usuario{" "}
                        <span className="font-mono text-orange-600 font-bold bg-white/50 px-2 py-1 rounded-lg border border-white/60">
                            {username}
                        </span>
                    </p>
                    <button
                        onClick={handleReset}
                        className="mt-8 w-full py-3.5 rounded-2xl bg-stone-800 hover:bg-stone-900 text-white text-base font-bold transition-all shadow-lg shadow-stone-800/30 hover:shadow-stone-800/50 hover:-translate-y-0.5"
                    >
                        Registrar otro vecino
                    </button>
                </div>
            </div>
        );
    }

    // ── Formulario principal ─────────────────────────────────────────────────
    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 md:p-8">
            <BackgroundBlobs />

            <div className="w-full max-w-[540px] relative z-10">
                <div className="mb-8 pl-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">
                        Panel de capturista
                    </p>
                    <h1 className="text-3xl font-bold text-stone-800">
                        Crear acceso a vecino
                    </h1>
                    <p className="text-stone-600 text-base mt-2">
                        Busca al residente y asígnale sus credenciales de
                        entrada.
                    </p>
                </div>

                {/* Tarjeta Principal Glassmorphism */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-6 md:p-8 space-y-7">
                    {globalError && (
                        <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                            {globalError}
                        </div>
                    )}

                    {/* Buscador */}
                    <div>
                        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2.5 ml-1">
                            Seleccionar Vecino
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none">
                                <SearchIcon />
                            </span>
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
                                placeholder="Buscar por nombre o número de casa..."
                                className={`w-full pl-12 pr-12 py-3.5 bg-white/50 backdrop-blur-sm border rounded-2xl focus:outline-none focus:ring-4 text-base font-medium text-stone-800 placeholder-stone-500 transition-all hover:bg-white/60 ${
                                    errors.vecino_id
                                        ? "border-red-300 focus:border-red-400 focus:ring-red-400/20"
                                        : "border-white/60 focus:border-orange-400 focus:ring-orange-500/20 focus:bg-white/80"
                                }`}
                                disabled={loading}
                            />
                            {vecinoSearch && (
                                <button
                                    type="button"
                                    onClick={clearVecino}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors p-1"
                                >
                                    <XIcon />
                                </button>
                            )}

                            {/* Dropdown de resultados */}
                            {showDropdown && vecinoResults.length > 0 && (
                                <ul className="absolute z-20 mt-2 w-full bg-white/80 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-xl overflow-hidden divide-y divide-stone-100/50">
                                    {vecinoResults.map((v) => (
                                        <li key={v.id}>
                                            <button
                                                type="button"
                                                onClick={() => selectVecino(v)}
                                                className="w-full text-left px-5 py-3.5 hover:bg-white/60 transition-colors flex items-center gap-4"
                                            >
                                                <span className="w-10 h-10 rounded-full bg-orange-100 border border-orange-200 text-orange-600 flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-inner">
                                                    {v.nombre?.[0]?.toUpperCase() ??
                                                        "?"}
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-base font-bold text-stone-800 truncate">
                                                        {v.nombre}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 text-sm text-stone-500 mt-0.5">
                                                        <HomeIcon />
                                                        {v.calle} #
                                                        {v.numero_casa}
                                                    </span>
                                                </span>
                                                {v.user_id && (
                                                    <span className="text-xs text-amber-700 bg-amber-100/80 border border-amber-200 px-2.5 py-1 rounded-full font-bold flex-shrink-0">
                                                        Ya tiene acceso
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {errors.vecino_id && (
                            <p className="text-sm font-medium text-red-500 mt-2 ml-1">
                                {Array.isArray(errors.vecino_id)
                                    ? errors.vecino_id[0]
                                    : errors.vecino_id}
                            </p>
                        )}

                        {/* Chip del vecino seleccionado */}
                        {selectedVecino && (
                            <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-white/40 backdrop-blur-sm border border-white/60 rounded-xl shadow-sm">
                                <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">
                                    {selectedVecino.nombre?.[0]?.toUpperCase()}
                                </span>
                                <span className="text-base text-stone-800 font-bold truncate">
                                    {selectedVecino.nombre}
                                </span>
                                <span className="text-sm font-semibold text-orange-500/80 ml-auto flex-shrink-0 bg-white/50 px-2 py-0.5 rounded-md">
                                    ID #{selectedVecino.id}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-white/40" />

                    {/* Credenciales */}
                    <div className="space-y-5">
                        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2.5 ml-1">
                            Datos de Acceso
                        </label>
                        <div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none">
                                    <UserIcon />
                                </span>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                        setErrors((err) => ({
                                            ...err,
                                            username: undefined,
                                        }));
                                    }}
                                    placeholder="Nombre de usuario"
                                    autoComplete="off"
                                    className={`w-full pl-12 pr-4 py-3.5 bg-white/50 backdrop-blur-sm border rounded-2xl text-base font-medium text-stone-800 placeholder-stone-500 focus:outline-none focus:ring-4 transition-all hover:bg-white/60 ${
                                        errors.username
                                            ? "border-red-300 focus:border-red-400 focus:ring-red-400/20"
                                            : "border-white/60 focus:border-orange-400 focus:ring-orange-500/20 focus:bg-white/80"
                                    }`}
                                    disabled={loading}
                                />
                            </div>
                            {errors.username && (
                                <p className="text-sm font-medium text-red-500 mt-2 ml-1">
                                    {Array.isArray(errors.username)
                                        ? errors.username[0]
                                        : errors.username}
                                </p>
                            )}
                        </div>
                        <div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none">
                                    <LockIcon />
                                </span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setErrors((err) => ({
                                            ...err,
                                            password: undefined,
                                        }));
                                    }}
                                    placeholder="Contraseña"
                                    autoComplete="new-password"
                                    className={`w-full pl-12 pr-12 py-3.5 bg-white/50 backdrop-blur-sm border rounded-2xl text-base font-medium text-stone-800 placeholder-stone-500 focus:outline-none focus:ring-4 transition-all hover:bg-white/60 ${
                                        errors.password
                                            ? "border-red-300 focus:border-red-400 focus:ring-red-400/20"
                                            : "border-white/60 focus:border-orange-400 focus:ring-orange-500/20 focus:bg-white/80"
                                    }`}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors p-1"
                                    tabIndex={-1}
                                >
                                    <EyeIcon open={showPassword} />
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-sm font-medium text-red-500 mt-2 ml-1">
                                    {Array.isArray(errors.password)
                                        ? errors.password[0]
                                        : errors.password}
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-4 mt-2 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-base font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 active:translate-y-0"
                    >
                        {loading ? "Creando acceso..." : "Crear credenciales"}
                    </button>
                </div>

                <p className="text-center text-sm font-medium text-stone-500/80 mt-6 backdrop-blur-sm">
                    Solo capturistas autorizados pueden crear credenciales.
                </p>
            </div>
        </div>
    );
}
