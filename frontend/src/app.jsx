import { useState } from "react";
import {
    BrowserRouter as Router,
    Routes,
    Route,
    NavLink,
    Navigate,
} from "react-router-dom";

// COMPONENTES
import Login from "./components/login";
import Pagos from "./components/Pagos";
import GuestView from "./pages/GuestView";
import Vecinos from "./pages/Vecinos";
import Tags from "./pages/Tags";
import Historico from "./pages/Historico";
import ResidentDashboard from "./pages/ResidentDashboard";

// ICONOS
const CreditCardIcon = ({ className }) => (
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
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
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
const ChartIcon = ({ className }) => (
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
    </svg>
);
const UserGroupIcon = ({ className }) => (
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
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
    </svg>
);
const LogoutIcon = ({ className }) => (
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
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
    </svg>
);
const MenuIcon = ({ className }) => (
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
            d="M4 6h16M4 12h16M4 18h16"
        />
    </svg>
);
const XIcon = ({ className }) => (
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
            d="M6 18L18 6M6 6l12 12"
        />
    </svg>
);

function App() {
    const [user, setUser] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // --- FUNCIÓN DE LOGOUT ROBUSTA ---
    const handleLogout = async () => {
        try {
            await fetch("http://127.0.0.1:8000/logout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                credentials: "include", // <--- AGREGAR ESTO: Para borrar la sesión correcta
            });
        } catch (error) {
            console.warn("Error de red al salir, cerrando localmente.");
        } finally {
            setUser(null);
        }
    };

    if (!user) {
        return <Login onLogin={setUser} />;
    }

    const navigationItems = [
        { path: "/vecinos", label: "Vecinos", icon: UserGroupIcon },
        { path: "/pagos", label: "Pagos", icon: CreditCardIcon },
        { path: "/tags", label: "Tags", icon: TagIcon },
        { path: "/historico", label: "Histórico", icon: ChartIcon },
    ];

    return (
        <Router>
            <div className="min-h-screen bg-white-50">
                {/* --- HEADER ADMIN --- */}
                {user.role === "admin" && (
                    <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-white/30 shadow-lg">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex justify-between items-center h-16">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0 flex items-start">
                                        <img
                                            src="/logosanisidro.png"
                                            alt="Logo"
                                            className="max-w-[300px] lg:max-w-[300px]"
                                        />
                                    </div>
                                </div>

                                <nav className="hidden md:flex space-x-1">
                                    {navigationItems.map((item) => (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            className={({ isActive }) =>
                                                `flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border-2 ${
                                                    isActive
                                                        ? "bg-orange-500 border-orange-500 text-white shadow-lg"
                                                        : "text-slate-600 border-transparent hover:text-orange-600 hover:border-orange-500"
                                                }`
                                            }
                                        >
                                            <item.icon className="w-5 h-5 mr-2" />
                                            {item.label}
                                        </NavLink>
                                    ))}
                                </nav>

                                <div className="flex items-center space-x-4">
                                    <div className="hidden sm:block">
                                        <div className="flex items-center">
                                            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-2">
                                                <span className="text-white font-semibold text-sm">
                                                    {user.name
                                                        ? user.name
                                                              .charAt(0)
                                                              .toUpperCase()
                                                        : "U"}
                                                </span>
                                            </div>
                                            <span className="text-slate-700 font-medium text-sm">
                                                {user.name}
                                            </span>
                                        </div>
                                    </div>

                                    {/* BOTÓN LOGOUT ADMIN */}
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center px-4 py-2 bg-white/50 text-slate-700 rounded-xl hover:bg-white/80 border border-white/30 transition-all"
                                    >
                                        <LogoutIcon className="w-4 h-4 mr-2" />
                                        <span className="hidden sm:inline">
                                            Salir
                                        </span>
                                    </button>

                                    <button
                                        onClick={() =>
                                            setIsMobileMenuOpen(
                                                !isMobileMenuOpen
                                            )
                                        }
                                        className="md:hidden p-2 rounded-lg bg-white/50"
                                    >
                                        {isMobileMenuOpen ? (
                                            <XIcon className="w-6 h-6" />
                                        ) : (
                                            <MenuIcon className="w-6 h-6" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Menu */}
                        {isMobileMenuOpen && (
                            <div className="md:hidden border-t border-white/30 bg-white/70 backdrop-blur-md px-2 pt-2 pb-3 space-y-1">
                                {navigationItems.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={() =>
                                            setIsMobileMenuOpen(false)
                                        }
                                        className={({ isActive }) =>
                                            `flex items-center px-3 py-2 rounded-xl text-base font-medium transition-all duration-300 border-2 ${
                                                isActive
                                                    ? "bg-orange-500 border-orange-500 text-white"
                                                    : "text-slate-600 border-transparent hover:text-orange-600"
                                            }`
                                        }
                                    >
                                        <item.icon className="w-5 h-5 mr-3" />
                                        {item.label}
                                    </NavLink>
                                ))}
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center px-3 py-2 rounded-xl text-base font-medium text-slate-600 border-transparent hover:text-red-600 hover:bg-red-50"
                                >
                                    <LogoutIcon className="w-5 h-5 mr-3" />
                                    Cerrar sesión
                                </button>
                            </div>
                        )}
                    </header>
                )}

                {/* --- CONTENIDO PRINCIPAL --- */}
                <main
                    className={
                        user.role === "admin"
                            ? "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
                            : "w-full"
                    }
                >
                    <Routes>
                        {/* RESIDENTE (Pasamos la función handleLogout como prop para que su botón funcione) */}
                        {user.role === "residente" && (
                            <>
                                <Route
                                    path="/"
                                    element={
                                        <ResidentDashboard
                                            user={user}
                                            onLogout={handleLogout}
                                        />
                                    }
                                />
                                <Route
                                    path="*"
                                    element={<Navigate to="/" replace />}
                                />
                            </>
                        )}

                        {/* ADMIN */}
                        {user.role === "admin" && (
                            <>
                                <Route path="/vecinos" element={<Vecinos />} />
                                <Route path="/pagos" element={<Pagos />} />
                                <Route path="/tags" element={<Tags />} />
                                <Route
                                    path="/historico"
                                    element={<Historico />}
                                />
                                <Route
                                    path="*"
                                    element={<Navigate to="/vecinos" replace />}
                                />
                            </>
                        )}

                        {/* INVITADO */}
                        {user.role === "guest" && (
                            <Route path="*" element={<GuestView />} />
                        )}
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
