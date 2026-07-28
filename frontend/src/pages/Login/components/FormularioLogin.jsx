import { useState } from "react";
import {
    UserIcon,
    TagIcon,
    LockIcon,
    EyeIcon,
    EyeOffIcon,
    KeyIcon,
    YourLogoIcon,
} from "./IconosLogin";
import SelectorTipoLogin from "./SelectorTipoLogin";
import CampoInput from "./CampoInput";

// onLogin: función async (identifier, password) => provista por el orquestador (index.jsx),
// hace la llamada real a la API y decide a dónde redirigir.
function FormularioLogin({ onLogin }) {
    const [loginType, setLoginType] = useState("admin"); // 'admin' o 'residente'
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSelectTipo = (tipo) => {
        setLoginType(tipo);
        setIdentifier("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await onLogin(identifier, password);
        } catch (error) {
            const message =
                error.response?.data?.message || "Error de conexión.";
            alert(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        // Placa de Liquid Glass Principal
        <div className="relative bg-white/40 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.06)] w-full max-w-md border-t border-l border-white/80 border-r border-b border-white/30">
            {/* Brillo curvo superior */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            {/* Encabezado */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-white/60 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[inset_0_2px_4px_rgba(255,255,255,1),0_4px_10px_rgba(0,0,0,0.03)] border border-white/80">
                    <YourLogoIcon className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 mb-2 drop-shadow-sm">
                    Bienvenido
                </h2>
            </div>

            <SelectorTipoLogin
                loginType={loginType}
                onSelect={handleSelectTipo}
            />

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                <CampoInput
                    label={
                        loginType === "admin"
                            ? "Correo Electrónico"
                            : "Nombre de Usuario"
                    }
                    type={loginType === "admin" ? "email" : "text"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={
                        loginType === "admin"
                            ? "admin@fracc.com"
                            : "Ej: Humberto Taboada"
                    }
                    disabled={isLoading}
                    loginType={loginType}
                    iconoIzquierdo={loginType === "admin" ? UserIcon : TagIcon}
                />

                <CampoInput
                    label="Contraseña"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    disabled={isLoading}
                    loginType={loginType}
                    iconoIzquierdo={LockIcon}
                    accionDerecha={{
                        icono: showPassword ? EyeOffIcon : EyeIcon,
                        onClick: () => setShowPassword(!showPassword),
                    }}
                />

                {/* BOTÓN SUBMIT LIQUID PLOP */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center px-4 py-3.5 mt-2 text-white font-bold rounded-xl focus:outline-none transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-[0_8px_20px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,0.4)] border border-white/40 disabled:opacity-50 disabled:transform-none disabled:shadow-none
                        ${
                            loginType === "admin"
                                ? "bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 shadow-[0_8px_20px_rgba(249,115,22,0.3),inset_0_2px_4px_rgba(255,255,255,0.4)]"
                                : "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-600 shadow-[0_8px_20px_rgba(22,163,74,0.3),inset_0_2px_4px_rgba(255,255,255,0.4)]"
                        }`}
                >
                    {isLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    ) : loginType === "admin" ? (
                        <UserIcon className="w-5 h-5 mr-2 drop-shadow-sm" />
                    ) : (
                        <TagIcon className="w-5 h-5 mr-2 drop-shadow-sm" />
                    )}
                    <span className="drop-shadow-sm tracking-wide">
                        {isLoading
                            ? "Entrando..."
                            : loginType === "admin"
                              ? "Iniciar sesión"
                              : "Entrar como Residente"}
                    </span>
                </button>
            </form>

            {/* --- SEPARADOR --- */}
            <div className="mt-8 flex items-center justify-center space-x-4">
                <div className="h-px bg-white/40 w-full flex-1" />
                <span className="text-xs font-semibold text-stone-400 tracking-wider uppercase">
                    o
                </span>
                <div className="h-px bg-white/40 w-full flex-1" />
            </div>

            {/* --- BOTÓN ACCESO CAPTURISTAS (LIQUID GLASS) --- */}
            <div className="mt-6 relative z-10">
                <button
                    type="button"
                    onClick={() =>
                        (window.location.href = "/capturista/registro-acceso")
                    }
                    className="w-full flex items-center justify-center px-4 py-3 bg-white/20 backdrop-blur-md border border-white/40 rounded-xl text-sm font-bold text-stone-600 hover:text-stone-800 hover:bg-white/40 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 shadow-[0_4px_15px_rgba(0,0,0,0.03),inset_0_1px_2px_rgba(255,255,255,0.5)]"
                >
                    <KeyIcon className="w-4 h-4 mr-2 text-stone-500" />
                    Acceso para Capturistas
                </button>
            </div>
        </div>
    );
}

export default FormularioLogin;
