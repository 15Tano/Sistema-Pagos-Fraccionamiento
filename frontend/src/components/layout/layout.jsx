import { useState, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../../store/authStore";

const NAV_ITEMS = [
    {
        to: "/",
        label: "Dashboard",
        icon: (
            <svg
                className="nav-icon"
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
        ),
    },
    {
        to: "/vecinos",
        label: "Vecinos",
        icon: (
            <svg
                className="nav-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
            </svg>
        ),
    },
    {
        to: "/pagos",
        label: "Pagos",
        icon: (
            <svg
                className="nav-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        ),
    },
    {
        to: "/tags",
        label: "Tags",
        icon: (
            <svg
                className="nav-icon"
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
        ),
    },
    {
        to: "/historico",
        label: "Histórico",
        icon: (
            <svg
                className="nav-icon"
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
        ),
    },
];

export default function Layout({ children }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const isDashboard = location.pathname === "/";

    // ── Lógica de PC (Escritorio) ──
    const [sidebarHovered, setSidebarHovered] = useState(false);
    const hoverTimeout = useRef(null);

    const handleSidebarEnter = () => {
        clearTimeout(hoverTimeout.current);
        setSidebarHovered(true);
    };
    const handleSidebarLeave = () => {
        hoverTimeout.current = setTimeout(() => setSidebarHovered(false), 200);
    };
    const sidebarVisibleDesktop = isDashboard || sidebarHovered;

    // ── Lógica de Celular (Móvil) ──
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="app-shell">
            {/* ── FONDO ── */}
            <div className="app-bg" />

            {/* ── Fondo oscuro al abrir el menú en MÓVIL ── */}
            {mobileMenuOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-40 transition-opacity"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* ── SIDEBAR ── 
                Nota: Se agregaron ! (important) a las clases max-md para asegurar 
                que las reglas nativas de .sidebar o .sidebar-collapsed no oculten el menú 
            */}
            <aside
                className={`sidebar ${sidebarVisibleDesktop ? "sidebar-expanded" : "sidebar-collapsed"} ${!isDashboard ? "sidebar-hoverable" : ""} max-md:!flex max-md:!flex-col max-md:!fixed max-md:!inset-y-0 max-md:!left-0 max-md:!w-[280px] max-md:!bg-white/95 max-md:!backdrop-blur-3xl max-md:!z-50 max-md:!transform max-md:!transition-transform max-md:!duration-300 ${mobileMenuOpen ? "max-md:!translate-x-0" : "max-md:!-translate-x-full"}`}
                onMouseEnter={!isDashboard ? handleSidebarEnter : undefined}
                onMouseLeave={!isDashboard ? handleSidebarLeave : undefined}
            >
                {/* Botón para cerrar explícitamente en móvil */}
                {mobileMenuOpen && (
                    <button
                        className="md:hidden absolute top-4 right-4 text-stone-400 hover:text-stone-600 p-2 bg-stone-100/50 rounded-full"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <svg
                            width="24"
                            height="24"
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
                    </button>
                )}

                {/* Logo */}
                <div className="sidebar-logo">
                    <div className="logo-img-wrap">
                        <img
                            src="/arcos.png"
                            alt="Logo"
                            className="logo-img object-contain"
                            onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                            }}
                        />
                        <div
                            className="logo-fallback"
                            style={{ display: "none" }}
                        >
                            SI
                        </div>
                    </div>
                    <div
                        className={`logo-text-wrap ${sidebarVisibleDesktop || mobileMenuOpen ? "opacity-100" : "opacity-0"}`}
                    >
                        <div className="logo-name">San Isidro</div>
                        <div className="logo-sub">Panel de Administración</div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="sidebar-nav">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === "/"}
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                `nav-item ${isActive ? "nav-active" : ""}`
                            }
                            title={
                                !sidebarVisibleDesktop ? item.label : undefined
                            }
                        >
                            {item.icon}
                            <span
                                className={`nav-label ${sidebarVisibleDesktop || mobileMenuOpen ? "nav-label-visible" : "nav-label-hidden"}`}
                            >
                                {item.label}
                            </span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer y Botones de Salir */}
                <div className="sidebar-footer max-md:flex-col max-md:items-stretch max-md:pb-6">
                    <div className="user-chip w-full">
                        <div className="avatar">
                            {user?.name?.charAt(0).toUpperCase() || "A"}
                        </div>
                        <div
                            className={`user-info ${sidebarVisibleDesktop || mobileMenuOpen ? "opacity-100" : "opacity-0"}`}
                        >
                            <div className="user-name">
                                {user?.name || "Administrador"}
                            </div>
                            <div className="user-role">
                                {user?.role || "admin"}
                            </div>
                        </div>

                        {/* ── BOTÓN PC ── */}
                        {sidebarVisibleDesktop && (
                            <button
                                onClick={handleLogout}
                                className="logout-btn hidden md:flex items-center justify-center text-gray-500 hover:text-orange-500 transition-colors duration-200"
                                title="Cerrar sesión"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* ── BOTÓN MÓVIL EN SIDEBAR ── */}
                    {mobileMenuOpen && (
                        <button
                            onClick={handleLogout}
                            className="md:hidden flex items-center justify-center gap-2 w-full px-4 py-3 mt-4 text-red-600 font-bold bg-red-50 hover:bg-red-100 rounded-xl transition-all duration-200 active:scale-95 shadow-sm border border-red-100"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Cerrar sesión
                        </button>
                    )}
                </div>
            </aside>

            {/* ── ZONA DE TRIGGER hover — solo en desktop fuera del dashboard ── */}
            {!isDashboard && (
                <div
                    className="sidebar-trigger md:block hidden"
                    onMouseEnter={handleSidebarEnter}
                    onMouseLeave={handleSidebarLeave}
                />
            )}

            {/* ── MAIN ── */}
            <main className="main-content">
                {/* Topbar */}
                <header className="topbar flex items-center justify-between">
                    <div className="topbar-left flex items-center gap-3">
                        {/* Botón hamburguesa — SOLO en móvil */}
                        <button
                            className="md:hidden p-2 -ml-2 rounded-xl text-stone-600 hover:bg-stone-100 transition-colors"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <svg
                                width="28"
                                height="28"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                        </button>
                        <span className="topbar-title">
                            {NAV_ITEMS.find((n) => n.to === location.pathname)
                                ?.label || "Dashboard"}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="topbar-date">
                            {new Date()
                                .toLocaleDateString("es-MX", {
                                    month: "long",
                                    year: "numeric",
                                })
                                .replace(/^./, (char) => char.toUpperCase())}
                        </span>

                        {/* ── BOTÓN CERRAR SESIÓN MÓVIL EN LA TOPBAR ── */}
                        <button
                            onClick={handleLogout}
                            className="md:hidden flex items-center justify-center p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors ml-2"
                            title="Cerrar sesión"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Contenido de la página */}
                <div className="page-content">{children}</div>
            </main>

            {/* ── BOTTOM NAV FLOTANTE (Liquid Glass) — solo móvil ── */}
            <nav className="md:hidden fixed bottom-4 inset-x-4 z-20 flex items-center justify-around px-2 py-2.5 bg-white/40 backdrop-blur-2xl border-t border-l border-white/80 border-r border-b border-white/30 shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-[2rem]">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${
                                isActive
                                    ? "bg-white/70 text-orange-500 shadow-[inset_0_2px_6px_rgba(255,255,255,1),0_4px_10px_rgba(0,0,0,0.05)] border border-white/80 scale-105"
                                    : "text-stone-400 hover:text-stone-600 hover:bg-white/30 active:scale-95"
                            }`
                        }
                    >
                        <div className="[&>svg]:w-5 [&>svg]:h-5 [&>svg]:drop-shadow-sm mb-0.5">
                            {item.icon}
                        </div>
                        <span className="text-[9px] font-bold tracking-wide drop-shadow-sm">
                            {item.label}
                        </span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}
