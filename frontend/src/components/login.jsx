import { useState } from "react";

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
const HomeIcon = ({ className }) => (
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
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
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
// Placeholder for your logo
const YourLogoIcon = ({ className }) => (
    <img
        src="/arcos.png" // <-- Pon aquí la URL o la ruta a tu imagen
        alt="Logo de San Isidro"
        className="max-w-[300px] lg:max-w-[1700]" // Ajusta el tamaño como necesites
    />
);

function Login({ onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleAdminLogin = (e) => {
        e.preventDefault();
        setIsLoading(true);
        setTimeout(() => {
            if (email === "admin@fracc.com" && password === "admin123") {
                onLogin({ role: "admin", name: "Administrador" });
            } else {
                alert("Credenciales incorrectas");
            }
            setIsLoading(false);
        }, 800);
    };

    const handleGuestLogin = () => {
        setIsLoading(true);
        setTimeout(() => {
            onLogin({ role: "guest", name: "Invitado" });
            setIsLoading(false);
        }, 300);
    };

    return (
        <div className="min-h-screen bg-white flex">
            {/* Left Column: Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8">
                <div className="relative bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl w-full max-w-md border border-orange-100">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <YourLogoIcon className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold text-orange-600 mb-2">
                            Sistema de Registros
                        </h2>
                        <div className="w-16 h-1 bg-orange-300 mx-auto rounded-full"></div>
                        <p className="text-slate-600 mt-3">
                            Accede a tu cuenta de administrador
                        </p>
                    </div>

                    <form onSubmit={handleAdminLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Usuario
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    className="w-full px-4 py-3 bg-white border-2 border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 pl-11"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Administrador"
                                    disabled={isLoading}
                                    required
                                />
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-orange-400">
                                    <UserIcon className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="w-full px-4 py-3 bg-white border-2 border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 pl-11 pr-11"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="********"
                                    disabled={isLoading}
                                    required
                                />
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-orange-400">
                                    <LockIcon className="w-5 h-5" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-600 transition-colors p-1"
                                    disabled={isLoading}
                                >
                                    {showPassword ? (
                                        <EyeOffIcon className="w-5 h-5" />
                                    ) : (
                                        <EyeIcon className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center px-4 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-200 transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg border-b-4 border-orange-500 active:border-b-0"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                    Iniciando sesión...
                                </>
                            ) : (
                                <>
                                    <UserIcon className="w-5 h-5 mr-2" />
                                    Iniciar sesión
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-orange-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">
                                    o
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={handleGuestLogin}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center px-4 py-3 bg-white text-orange-700 font-medium rounded-xl border-2 border-orange-300 hover:bg-orange-50 hover:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-200 transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isLoading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
                            ) : (
                                <>
                                    <EyeIcon className="w-5 h-5 mr-2" />
                                    Entrar como Invitado
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Column: Logo/Image placeholder */}
            <div className="hidden lg:flex w-1/2 bg-white items-center justify-center p-8">
                {/* --- EJEMPLO CON TU LOGO --- */}
                <img
                    src="/Logo Fraccionamiento Sol Verde Oro Elegante.png" // <-- Pon aquí la URL o la ruta a tu imagen
                    alt="Logo de San Isidro"
                    className="max-w-[600px] lg:max-w-[600px]" // Ajusta el tamaño como necesites
                />
                {/* --- FIN DEL EJEMPLO --- */}
            </div>
        </div>
    );
}

export default Login;
