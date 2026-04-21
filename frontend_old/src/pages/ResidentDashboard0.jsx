import React, { useState } from "react";

// --- ICONOS (SVG) ---
const LogoutIcon = () => (
    <svg
        className="w-5 h-5"
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

const BellIcon = () => (
    <svg
        className="w-5 h-5 text-orange-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
    </svg>
);

const MoneyIcon = () => (
    <svg
        className="w-5 h-5 text-green-600"
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
);

// --- COMPONENTE PRINCIPAL ---
// OJO AQUÍ: Las llaves { } son obligatorias para sacar user y onLogout
const ResidentDashboard = ({ user, onLogout }) => {
    // Datos simulados (Luego vendrán de la BD)
    const [status] = useState("ACTIVO");
    const [vencimiento] = useState("15/02/2026");

    const avisos = [
        {
            id: 1,
            titulo: "Mantenimiento Portón",
            msg: "Cerrado jueves de 10am a 2pm.",
            tipo: "alerta",
            fecha: "Hoy",
        },
        {
            id: 2,
            titulo: "Recolección Basura",
            msg: "El camión pasará ahora los martes.",
            tipo: "info",
            fecha: "Ayer",
        },
    ];

    const pagos = [
        {
            id: 1,
            mes: "Enero 2026",
            monto: 500,
            fecha: "02/01/26",
            estado: "Pagado",
        },
        {
            id: 2,
            mes: "Dic 2025",
            monto: 500,
            fecha: "05/12/25",
            estado: "Pagado",
        },
        {
            id: 3,
            mes: "Nov 2025",
            monto: 500,
            fecha: "03/11/25",
            estado: "Pagado",
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-10 font-sans">
            {/* --- NAVBAR --- */}
            <nav className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-2xl mx-auto px-4 h-16 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            SI
                        </div>
                        <span className="font-bold text-gray-700 tracking-tight">
                            San Isidro
                        </span>
                    </div>

                    {/* BOTÓN DE LOGOUT CORREGIDO */}
                    <button
                        onClick={onLogout}
                        className="text-sm text-gray-500 hover:text-red-500 font-medium transition flex items-center gap-1"
                    >
                        Salir
                        <LogoutIcon />
                    </button>
                </div>
            </nav>

            {/* --- CONTENIDO PRINCIPAL --- */}
            <div className="max-w-md mx-auto px-4 py-6 space-y-6">
                {/* SALUDO (Usando datos reales del login) */}
                <div>
                    <p className="text-gray-500 text-sm">Bienvenido a casa,</p>
                    <h1 className="text-2xl font-bold text-gray-800">
                        {user.name}
                    </h1>
                    <p className="text-xs text-gray-400 font-mono mt-1">
                        Tag ID: {user.tag || user.username}
                    </p>
                </div>

                {/* 1. EL SEMÁFORO (HÉROE) */}
                <div
                    className={`relative overflow-hidden rounded-2xl shadow-xl p-6 text-center text-white transition-all duration-500 transform hover:scale-[1.02]
          ${
              status === "ACTIVO"
                  ? "bg-gradient-to-br from-green-500 to-green-700 shadow-green-200"
                  : "bg-gradient-to-br from-red-500 to-red-700 shadow-red-200"
          }`}
                >
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>

                    <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-3">
                        Estado del Acceso
                    </p>

                    <div className="flex justify-center items-center gap-3 mb-5">
                        <div
                            className={`w-3 h-3 rounded-full animate-pulse ${
                                status === "ACTIVO"
                                    ? "bg-green-300 shadow-[0_0_15px_rgba(134,239,172,1)]"
                                    : "bg-red-300"
                            }`}
                        ></div>
                        <span className="text-4xl font-black tracking-tight drop-shadow-sm">
                            {status === "ACTIVO" ? "AUTORIZADO" : "SUSPENDIDO"}
                        </span>
                    </div>

                    <div className="bg-white/20 rounded-lg p-2 px-4 inline-block backdrop-blur-sm border border-white/10">
                        <p className="text-sm">
                            Vence el:{" "}
                            <span className="font-bold">{vencimiento}</span>
                        </p>
                    </div>
                </div>

                {/* 2. AVISOS */}
                <div>
                    <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-lg">
                        <BellIcon />
                        Avisos Recientes
                    </h2>
                    <div className="space-y-3">
                        {avisos.map((aviso) => (
                            <div
                                key={aviso.id}
                                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-shadow"
                            >
                                <div
                                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                                        aviso.tipo === "alerta"
                                            ? "bg-red-500"
                                            : "bg-blue-500"
                                    }`}
                                ></div>
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-bold text-gray-800 text-sm group-hover:text-orange-600 transition-colors">
                                        {aviso.titulo}
                                    </h3>
                                    <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                        {aviso.fecha}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    {aviso.msg}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. HISTORIAL DE PAGOS */}
                <div>
                    <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-lg">
                        <MoneyIcon />
                        Últimos Pagos
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                                <tr>
                                    <th className="p-3 text-left font-medium text-xs uppercase tracking-wider">
                                        Concepto
                                    </th>
                                    <th className="p-3 text-right font-medium text-xs uppercase tracking-wider">
                                        Monto
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pagos.map((pago) => (
                                    <tr
                                        key={pago.id}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="p-3">
                                            <p className="font-bold text-gray-800 text-sm">
                                                {pago.mes}
                                            </p>
                                            <p className="text-[11px] text-gray-400">
                                                {pago.fecha}
                                            </p>
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className="block font-bold text-gray-700">
                                                ${pago.monto}
                                            </span>
                                            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-bold mt-1">
                                                {pago.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="text-center mt-8 text-gray-300 text-[10px]">
                San Isidro App v2.0
            </div>
        </div>
    );
};

export default ResidentDashboard;
