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

    // Sidebar hover — solo en desktop y solo fuera del dashboard
    const [sidebarHovered, setSidebarHovered] = useState(false);
    const hoverTimeout = useRef(null);

    const handleSidebarEnter = () => {
        clearTimeout(hoverTimeout.current);
        setSidebarHovered(true);
    };
    const handleSidebarLeave = () => {
        hoverTimeout.current = setTimeout(() => setSidebarHovered(false), 200);
    };

    // En dashboard: siempre visible. En otras: visible solo si hover
    const sidebarVisible = isDashboard || sidebarHovered;

    const handleLogout = async () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="app-shell">
            {/* ── FONDO ── */}
            <div className="app-bg" />

            {/* ── SIDEBAR — desktop ── */}
            <aside
                className={`sidebar ${sidebarVisible ? "sidebar-expanded" : "sidebar-collapsed"} ${!isDashboard ? "sidebar-hoverable" : ""}`}
                onMouseEnter={!isDashboard ? handleSidebarEnter : undefined}
                onMouseLeave={!isDashboard ? handleSidebarLeave : undefined}
            >
                {/* Logo */}
                <div className="sidebar-logo">
                    <div className="logo-img-wrap">
                        <img
                            src="/arcos.png"
                            alt="Logo"
                            className="logo-img"
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
                        className={`logo-text-wrap ${sidebarVisible ? "opacity-100" : "opacity-0"}`}
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
                            className={({ isActive }) =>
                                `nav-item ${isActive ? "nav-active" : ""}`
                            }
                            title={!sidebarVisible ? item.label : undefined}
                        >
                            {item.icon}
                            <span
                                className={`nav-label ${sidebarVisible ? "nav-label-visible" : "nav-label-hidden"}`}
                            >
                                {item.label}
                            </span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="sidebar-footer">
                    <div className="user-chip">
                        <div className="avatar">
                            {user?.name?.charAt(0).toUpperCase() || "A"}
                        </div>
                        <div
                            className={`user-info ${sidebarVisible ? "opacity-100" : "opacity-0"}`}
                        >
                            <div className="user-name">
                                {user?.name || "Administrador"}
                            </div>
                            <div className="user-role">
                                {user?.role || "admin"}
                            </div>
                        </div>
                        {sidebarVisible && (
                            <button
                                onClick={handleLogout}
                                className="logout-btn flex items-center justify-center text-gray-500 hover:text-orange-500 transition-colors duration-200"
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
                </div>
            </aside>

            {/* ── ZONA DE TRIGGER hover — solo en desktop fuera del dashboard ── */}
            {!isDashboard && (
                <div
                    className="sidebar-trigger"
                    onMouseEnter={handleSidebarEnter}
                    onMouseLeave={handleSidebarLeave}
                />
            )}

            {/* ── MAIN ── */}
            <main className="main-content">
                {/* Topbar */}
                <header className="topbar">
                    <div className="topbar-left">
                        {/* Botón hamburguesa — solo móvil */}
                        <button
                            className="hamburger md:hidden"
                            onClick={() => setSidebarHovered(true)}
                        >
                            <svg
                                width="20"
                                height="20"
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
                        </button>
                        <span className="topbar-title">
                            {NAV_ITEMS.find((n) => n.to === location.pathname)
                                ?.label || "Dashboard"}
                        </span>
                    </div>
                    <span className="topbar-date">
                        {new Date()
                            .toLocaleDateString("es-MX", {
                                month: "long",
                                year: "numeric",
                            })
                            .replace(/^./, (char) => char.toUpperCase())}
                    </span>
                </header>

                {/* Contenido de la página */}
                <div className="page-content">{children}</div>
            </main>

            {/* ── BOTTOM NAV — solo móvil ── */}
            <nav className="bottom-nav">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                            `bottom-nav-item ${isActive ? "bottom-nav-active" : ""}`
                        }
                    >
                        {item.icon}
                        <span className="bottom-nav-label">{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}
