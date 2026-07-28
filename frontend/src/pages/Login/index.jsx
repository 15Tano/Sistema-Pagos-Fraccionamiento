import { useState, useEffect } from "react";
import { login } from "../../api/auth";
import useAuthStore from "../../store/authStore";
import DeveloperBadge from "../../components/DeveloperBadge";
import BackgroundOrbes from "./components/BackgroundOrbes";
import FormularioLogin from "./components/FormularioLogin";
import PanelDerecho from "./components/PanelDerecho";

function Login({ onLogin }) {
    const setAuth = useAuthStore((state) => state.setAuth);
    const [csrfToken, setCsrfToken] = useState("");

    useEffect(() => {
        const token = document.querySelector('meta[name="csrf-token"]');
        if (token) setCsrfToken(token.getAttribute("content"));
    }, []);

    const handleLogin = async (identifier, password) => {
        const { token, user } = await login(identifier, password);
        setAuth(token, user);

        if (user.role === "vigilancia") {
            window.location.href = "/vigilancia";
        } else if (user.role === "admin" || user.role === "capturista") {
            window.location.href = "/";
        } else {
            window.location.href = "/residente";
        }
    };

    return (
        // Global background: Piedra muy claro con refracciones de color detrás del cristal
        <div className="min-h-screen bg-stone-100 flex relative overflow-hidden">
            <BackgroundOrbes />

            {/* Left Column: Formulario */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8 relative z-10">
                <FormularioLogin onLogin={handleLogin} />
            </div>

            <DeveloperBadge />

            <PanelDerecho />
        </div>
    );
}

export default Login;
