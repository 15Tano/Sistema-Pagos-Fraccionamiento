import { useState } from "react";
import { useVecinoSearch } from "../hooks/useVecinoSearch";
import VecinoBuscador from "./VecinoBuscador";
import { UserIcon, LockIcon, EyeIcon } from "../icons";

export default function CrearAccesoForm({ call, onSuccess }) {
    const {
        vecinoSearch,
        vecinoResults,
        showDropdown,
        selectedVecino,
        vecinoError,
        setVecinoError,
        handleVecinoSearch,
        selectVecino,
        clearVecino,
        setShowDropdown,
    } = useVecinoSearch(call);

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [globalError, setGlobalError] = useState("");

    const handleSubmit = async () => {
        setErrors({});
        setGlobalError("");

        const clientErrors = {};
        if (!selectedVecino) setVecinoError("Selecciona un vecino de la lista.");
        if (!username.trim()) clientErrors.username = "El nombre de usuario es obligatorio.";
        if (!password) clientErrors.password = "La contraseña es obligatoria.";
        if (!selectedVecino || Object.keys(clientErrors).length) {
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
            onSuccess({ vecino: selectedVecino, username, password });
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

    return (
        <div className="space-y-7">
            {globalError && (
                <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                    {globalError}
                </div>
            )}

            <VecinoBuscador
                vecinoSearch={vecinoSearch}
                vecinoResults={vecinoResults}
                showDropdown={showDropdown}
                selectedVecino={selectedVecino}
                error={vecinoError}
                disabled={loading}
                onChange={handleVecinoSearch}
                onFocus={() => vecinoResults.length > 0 && setShowDropdown(true)}
                onSelect={selectVecino}
                onClear={clearVecino}
            />

            <div className="border-t border-white/40" />

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
                                setErrors((err) => ({ ...err, username: undefined }));
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
                            {Array.isArray(errors.username) ? errors.username[0] : errors.username}
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
                                setErrors((err) => ({ ...err, password: undefined }));
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
                            {Array.isArray(errors.password) ? errors.password[0] : errors.password}
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
    );
}
