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

// Tu Logo Pequeño (para el formulario)
const YourLogoIcon = ({ className }) => (
    <img
        src="/arcos.png"
        alt="Logo de San Isidro"
        className="max-w-[300px] lg:max-w-[1700]"
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

        // --- 1. MOCK PARA VERCEL (SIMULADOR) ---
        // Usamos un timeout de 800ms para que se vea la animación del botón cargando

        setTimeout(() => {
            const fakeToken = "token_de_prueba_123";
            const fakeUser = {
                id: 1,
                name:
                    loginType === "admin"
                        ? "Admin (Prueba)"
                        : "Residente (Prueba)",
                role: loginType,
                email:
                    identifier ||
                    (loginType === "admin" ? "admin@sanisidro.com" : "001452"),
            };

            // Guardamos la sesión falsa
            setAuth(fakeToken, fakeUser);

            // Redirigimos según el rol simulado
            if (fakeUser.role === "admin") {
                window.location.href = "/";
            } else {
                window.location.href = "/residente";
            }
            setIsLoading(false);
        }, 800);

        // --- 2. CÓDIGO REAL COMENTADO ---
        /*
        try {
            const { token, user } = await login(identifier, password);
            setAuth(token, user);

            if (user.role === "admin") {
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
        }*/
    };

    return (
        <div className="min-h-screen bg-white flex">
            {/* Left Column: Formulario */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8">
                <div className="relative bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-orange-100/50">
                    {/* Encabezado */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-orange-50">
                            <YourLogoIcon className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            Bienvenido
                        </h2>
                    </div>

                    {/* --- TABS / PESTAÑAS --- */}
                    <div className="flex p-1 bg-gray-100 rounded-xl mb-8">
                        <button
                            type="button"
                            onClick={() => {
                                setLoginType("admin");
                                setIdentifier("");
                            }}
                            className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                                loginType === "admin"
                                    ? "bg-white text-orange-600 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
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
                            className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                                loginType === "residente"
                                    ? "bg-white text-green-600 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            <TagIcon className="w-4 h-4 mr-2" />
                            Residente
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* INPUT DINÁMICO */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {loginType === "admin"
                                    ? "Correo Electrónico"
                                    : "Número de Tag / Tarjeta"}
                            </label>
                            <div className="relative">
                                <input
                                    type={
                                        loginType === "admin" ? "email" : "text"
                                    }
                                    className={`w-full px-4 py-3 bg-white border-2 rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 pl-11 
                                        ${
                                            loginType === "admin"
                                                ? "border-orange-100 focus:ring-orange-500 focus:border-orange-500"
                                                : "border-green-100 focus:ring-green-500 focus:border-green-500"
                                        }`}
                                    value={identifier}
                                    onChange={(e) =>
                                        setIdentifier(e.target.value)
                                    }
                                    placeholder={
                                        loginType === "admin"
                                            ? "admin@fracc.com"
                                            : "Ej: 001452"
                                    }
                                    required
                                    disabled={isLoading}
                                />
                                <div
                                    className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                                        loginType === "admin"
                                            ? "text-orange-400"
                                            : "text-green-500"
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className={`w-full px-4 py-3 bg-white border-2 rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 pl-11 pr-11
                                        ${
                                            loginType === "admin"
                                                ? "border-orange-100 focus:ring-orange-500 focus:border-orange-500"
                                                : "border-green-100 focus:ring-green-500 focus:border-green-500"
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
                                    className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                                        loginType === "admin"
                                            ? "text-orange-400"
                                            : "text-green-500"
                                    }`}
                                >
                                    <LockIcon className="w-5 h-5" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                                >
                                    {showPassword ? (
                                        <EyeOffIcon className="w-5 h-5" />
                                    ) : (
                                        <EyeIcon className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* BOTÓN SUBMIT */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full flex items-center justify-center px-4 py-3 text-white font-semibold rounded-xl focus:outline-none focus:ring-4 transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-lg border-b-4 active:border-b-0 disabled:opacity-50 disabled:transform-none
                                ${
                                    loginType === "admin"
                                        ? "bg-orange-500 hover:bg-orange-600 focus:ring-orange-200 border-orange-600"
                                        : "bg-green-600 hover:bg-green-700 focus:ring-green-200 border-green-700"
                                }`}
                        >
                            {isLoading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            ) : loginType === "admin" ? (
                                <UserIcon className="w-5 h-5 mr-2" />
                            ) : (
                                <TagIcon className="w-5 h-5 mr-2" />
                            )}
                            {isLoading
                                ? "Entrando..."
                                : loginType === "admin"
                                  ? "Iniciar sesión"
                                  : "Entrar con Tag"}
                        </button>
                    </form>
                    {/* Se eliminó la sección de Invitado aquí */}
                </div>
            </div>

            {/* Right Column: Imagen Grande (Fondo blanco limpio) */}
            <div className="hidden lg:flex w-1/2 bg-white items-center justify-center p-8 relative">
                <img
                    src="/Logo Fraccionamiento Sol Verde Oro Elegante.png"
                    alt="Logo de San Isidro"
                    className="max-w-[600px] lg:max-w-[85%] relative z-10 drop-shadow-xl"
                />
            </div>
        </div>
    );
}

export default Login;
