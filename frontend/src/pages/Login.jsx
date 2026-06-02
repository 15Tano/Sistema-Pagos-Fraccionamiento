import { useState, useEffect } from "react";
import { login } from "../api/auth";
import useAuthStore from "../store/authStore";

// --- Custom SVG Icons ---
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
const TagIcon = ({ className }) => (
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
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
        />
    </svg>
);
const LockIcon = ({ className }) => (
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
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
    </svg>
);
const EyeIcon = ({ className }) => (
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
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
    </svg>
);
const EyeOffIcon = ({ className }) => (
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
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
        />
    </svg>
);
const KeyIcon = ({ className }) => (
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
            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
        />
    </svg>
);

// Tu Logo Pequeño (para el formulario)
const YourLogoIcon = ({ className }) => (
    <img
        src="/arcos.png"
        alt="Logo de San Isidro"
        className="max-w-[320px] lg:max-w-[1300]"
    />
);

function Login({ onLogin }) {
    const setAuth = useAuthStore((state) => state.setAuth);
    const [loginType, setLoginType] = useState("admin"); // 'admin' o 'residente'
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [csrfToken, setCsrfToken] = useState("");

    useEffect(() => {
        const token = document.querySelector('meta[name="csrf-token"]');
        if (token) setCsrfToken(token.getAttribute("content"));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { token, user } = await login(identifier, password);
            setAuth(token, user);

            if (user.role === "admin" || user.role === "capturista") {
                window.location.href = "/";
            } else {
                window.location.href = "/residente";
            }
        } catch (error) {
            const message =
                error.response?.data?.message || "Error de conexión.";
            alert(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        // Global background: Piedra muy claro con refracciones de color detrás del cristal
        <div className="min-h-screen bg-stone-100 flex relative overflow-hidden">
            {/* Orbes desenfocados para dar refracción al Liquid Glass */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-orange-300/30 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-stone-300/50 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-white/40 rounded-full blur-[80px] pointer-events-none" />

            {/* Left Column: Formulario */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8 relative z-10">
                {/* Placa de Liquid Glass Principal */}
                <div className="relative bg-white/40 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.06)] w-full max-w-md border-t border-l border-white/80 border-r border-b border-white/30">
                    {/* Brillo curvo superior */}
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

                    {/* Encabezado */}
                    <div className="text-center mb-8">
                        {/* Contenedor del Logo con glass */}
                        <div className="w-16 h-16 bg-white/60 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[inset_0_2px_4px_rgba(255,255,255,1),0_4px_10px_rgba(0,0,0,0.03)] border border-white/80">
                            <YourLogoIcon className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-stone-800 mb-2 drop-shadow-sm">
                            Bienvenido
                        </h2>
                    </div>

                    {/* --- TABS / PESTAÑAS LÍQUIDAS --- */}
                    <div className="flex p-1.5 bg-black/5 backdrop-blur-sm rounded-2xl mb-8 shadow-[inset_0_2px_6px_rgba(0,0,0,0.04)] border border-white/20">
                        <button
                            type="button"
                            onClick={() => {
                                setLoginType("admin");
                                setIdentifier("");
                            }}
                            className={`flex-1 flex items-center justify-center py-2 text-sm font-bold rounded-xl transition-all duration-300 ${
                                loginType === "admin"
                                    ? "bg-white/80 text-orange-600 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-white transform scale-[1.02]"
                                    : "text-stone-500 hover:text-stone-700 hover:bg-white/20"
                            }`}
                        >
                            <UserIcon className="w-4 h-4 mr-2" />
                            Administración
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setLoginType("residente");
                                setIdentifier("");
                            }}
                            className={`flex-1 flex items-center justify-center py-2 text-sm font-bold rounded-xl transition-all duration-300 ${
                                loginType === "residente"
                                    ? "bg-white/80 text-green-600 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-white transform scale-[1.02]"
                                    : "text-stone-500 hover:text-stone-700 hover:bg-white/20"
                            }`}
                        >
                            <TagIcon className="w-4 h-4 mr-2" />
                            Residente
                        </button>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="space-y-6 relative z-10"
                    >
                        {/* INPUT DINÁMICO */}
                        <div>
                            <label className="block text-sm font-bold text-stone-700 mb-2 ml-1">
                                {loginType === "admin"
                                    ? "Correo Electrónico"
                                    : "Nombre de Usuario"}
                            </label>
                            <div className="relative group">
                                <input
                                    type={
                                        loginType === "admin" ? "email" : "text"
                                    }
                                    className={`w-full px-4 py-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.02)] focus:outline-none focus:bg-white/60 transition-all duration-300 pl-11 
                                        ${
                                            loginType === "admin"
                                                ? "focus:ring-4 focus:ring-orange-500/20 focus:border-orange-400"
                                                : "focus:ring-4 focus:ring-green-500/20 focus:border-green-400"
                                        }`}
                                    value={identifier}
                                    onChange={(e) =>
                                        setIdentifier(e.target.value)
                                    }
                                    placeholder={
                                        loginType === "admin"
                                            ? "admin@fracc.com"
                                            : "Ej: Humberto Taboada"
                                    }
                                    required
                                    disabled={isLoading}
                                />
                                <div
                                    className={`absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors duration-300 ${
                                        loginType === "admin"
                                            ? "text-orange-400 group-focus-within:text-orange-600"
                                            : "text-green-500 group-focus-within:text-green-700"
                                    }`}
                                >
                                    {loginType === "admin" ? (
                                        <UserIcon className="w-5 h-5" />
                                    ) : (
                                        <TagIcon className="w-5 h-5" />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* CONTRASEÑA */}
                        <div>
                            <label className="block text-sm font-bold text-stone-700 mb-2 ml-1">
                                Contraseña
                            </label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className={`w-full px-4 py-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.02)] focus:outline-none focus:bg-white/60 transition-all duration-300 pl-11 pr-11
                                        ${
                                            loginType === "admin"
                                                ? "focus:ring-4 focus:ring-orange-500/20 focus:border-orange-400"
                                                : "focus:ring-4 focus:ring-green-500/20 focus:border-green-400"
                                        }`}
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="********"
                                    required
                                    disabled={isLoading}
                                />
                                <div
                                    className={`absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors duration-300 ${
                                        loginType === "admin"
                                            ? "text-orange-400 group-focus-within:text-orange-600"
                                            : "text-green-500 group-focus-within:text-green-700"
                                    }`}
                                >
                                    <LockIcon className="w-5 h-5" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors p-1"
                                >
                                    {showPassword ? (
                                        <EyeOffIcon className="w-5 h-5" />
                                    ) : (
                                        <EyeIcon className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

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
                                (window.location.href =
                                    "/capturista/registro-acceso")
                            }
                            className="w-full flex items-center justify-center px-4 py-3 bg-white/20 backdrop-blur-md border border-white/40 rounded-xl text-sm font-bold text-stone-600 hover:text-stone-800 hover:bg-white/40 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 shadow-[0_4px_15px_rgba(0,0,0,0.03),inset_0_1px_2px_rgba(255,255,255,0.5)]"
                        >
                            <KeyIcon className="w-4 h-4 mr-2 text-stone-500" />
                            Acceso para Capturistas
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Column: Imagen Grande */}
            <div className="hidden lg:flex w-1/2 items-center justify-center p-8 relative z-10 pointer-events-none">
                {/* Glow suave detrás del logo grande para separarlo del fondo */}
                <div className="absolute w-[400px] h-[400px] bg-white/60 rounded-full blur-[60px]" />
                <img
                    src="/Logo Fraccionamiento Sol Verde Oro Elegante.png"
                    alt="Logo de San Isidro"
                    className="max-w-[600px] lg:max-w-[85%] relative z-10 drop-shadow-2xl"
                />
            </div>
        </div>
    );
}

export default Login;
