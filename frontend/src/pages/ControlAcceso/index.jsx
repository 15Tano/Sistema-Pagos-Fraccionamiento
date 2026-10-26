import Layout from "../../components/layout/layout";
import VigilanciaLayout from "../../components/VigilanciaLayout";
import useAuthStore from "../../store/authStore";
import { monitorClient } from "../../api/controlAcceso";
import ControlAccessPanel from "./components/ControlAccessPanel";

export default function ControlAcceso({ vigilancia = false }) {
    const role = useAuthStore((s) => s.user?.role);
    const logout = useAuthStore((s) => s.logout);
    const content = <ControlAccessPanel client={monitorClient} />;
    if (role === "admin" && !vigilancia) return <Layout>{content}</Layout>;
    return <VigilanciaLayout active="readings" onLogout={logout}>{content}</VigilanciaLayout>;
}
