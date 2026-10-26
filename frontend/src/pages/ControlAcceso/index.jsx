import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LogOut } from "lucide-react";
import Layout from "../../components/layout/layout";
import useAuthStore from "../../store/authStore";
import { monitorClient } from "../../api/controlAcceso";
import { useControlAccess } from "./hooks/useControlAccess";
import ControlAccessView from "./components/ControlAccessView";

export default function ControlAcceso() {
    const role = useAuthStore((s) => s.user?.role);
    const logout = useAuthStore((s) => s.logout);
    const [filters, setFilters] = useState({ agentId: "", door: "", card: "", source: "rt" });
    const monitor = useControlAccess(monitorClient, filters);
    const content = <ControlAccessView monitor={monitor} filters={filters}
        onFilters={(patch) => setFilters((current) => ({ ...current, ...patch }))} />;
    if (role === "admin") return <Layout>{content}</Layout>;
    return <div className="app-shell"><div className="app-bg" /><main className="relative z-10 w-full max-w-[1500px] mx-auto px-4 sm:px-8 py-6 sm:py-9">
        <div className="flex items-center justify-between mb-7 text-sm text-stone-600">
            <Link to="/vigilancia" className="inline-flex items-center gap-2 hover:text-orange-700"><ArrowLeft size={17} />Volver a vigilancia</Link>
            <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-3 py-2"><LogOut size={16} />Salir</button>
        </div>{content}</main></div>;
}
