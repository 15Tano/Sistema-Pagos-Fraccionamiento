import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../../lib/axios";
import useAuthStore from "../../store/authStore";
import { getAvisos } from "../../api/avisos";
import { logout as apiLogout } from "../../api/auth";
import NotificationBanner from "../../components/NotificationBanner";

import useModal from "./useModal";
import { calcularEstado } from "./dashboardHelpers";

import DashboardHeader from "./components/DashboardHeader";
import AccionesRapidas from "./components/AccionesRapidas";
import Semaforo from "./components/Semaforo";
import TablonAvisoResidente from "./components/TablonAvisoResidente";
import HistorialPagos from "./components/HistorialPagos";
import PantallaBloqueada from "./components/PantallaBloqueada";
import ModalContacto from "./components/ModalContacto";
import ModalRecibo from "./components/ModalRecibo";
import ModalCamaras from "./components/ModalCamaras";
import DeveloperBadge from "../../components/DeveloperBadge";

import { getEncuestaActiva, votarEncuesta } from "../../api/encuestas";
import ModalEncuesta from "./components/ModalEncuesta";
import BotonEncuesta from "./components/BotonEncuesta";

import TemporadaProvider from "../TemporadaProvider";

console.log("VERSION 2.0 - CARGADA");

export default function ResidentDashboard() {
    const { user, logout: storeLogout } = useAuthStore();
    const [pagos, setPagos] = useState([]);
    const [avisos, setAvisos] = useState([]);
    const [loadingPagos, setLoadingPagos] = useState(true);
    const [lastSync, setLastSync] = useState(null);
    const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
    const [encuesta, setEncuesta] = useState(null);
    const [yaVotoEncuesta, setYaVotoEncuesta] = useState(true);
    const [opcionVotada, setOpcionVotada] = useState(null);
    const [resultadosEncuesta, setResultadosEncuesta] = useState(null);

    const correo = useModal();
    const camaras = useModal();
    const recibo = useModal(() => setPagoSeleccionado(null));
    const encuestaModal = useModal();

    const openRecibo = useCallback(
        (pago) => {
            setPagoSeleccionado(pago);
            recibo.open();
        },
        [recibo],
    );

    const fetchData = useCallback(async () => {
        setLoadingPagos(true);
        try {
            const pagosRes = await api.get("/pagos/mis-pagos");
            setPagos(pagosRes.data.data || pagosRes.data || []);
            setLastSync(new Date());
        } catch (e) {
            console.error("Error cargando pagos:", e);
        } finally {
            setLoadingPagos(false);
        }

        try {
            const avisosRes = await getAvisos();
            setAvisos(avisosRes.data || []);
        } catch (e) {
            console.error("Error cargando avisos:", e);
        }

        try {
            const encuestaRes = await getEncuestaActiva();
            setEncuesta(encuestaRes.data.encuesta || null);
            setYaVotoEncuesta(encuestaRes.data.ya_voto ?? true);
            setOpcionVotada(encuestaRes.data.opcion_votada ?? null);
            setResultadosEncuesta(encuestaRes.data.resultados ?? null);
        } catch {}
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const reciboUuid = params.get("recibo");
        if (reciboUuid && pagos.length > 0) {
            const pago = pagos.find((p) => p.uuid === reciboUuid);
            if (pago) {
                openRecibo(pago);
            }
        }
    }, [pagos, openRecibo]);

    const handleVotarEncuesta = useCallback(
        async (opcionIndex) => {
            const res = await votarEncuesta(encuesta.id, opcionIndex);
            setYaVotoEncuesta(true);
            setOpcionVotada(res.data.opcion_votada);
            setResultadosEncuesta(res.data.resultados);
        },
        [encuesta],
    );

    useEffect(() => {
        if (encuesta?.activa && !yaVotoEncuesta) {
            encuestaModal.open();
        }
    }, [encuesta, yaVotoEncuesta]);

    const estado = useMemo(() => calcularEstado(pagos), [pagos]);

    const diasBloqueado = useMemo(() => {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        return Math.max(
            1,
            Math.floor((hoy - inicioMes) / (1000 * 60 * 60 * 24)) + 1,
        );
    }, []);

    const handleLogout = useCallback(async () => {
        try {
            await apiLogout();
        } catch {}
        storeLogout();
        window.location.href = "/login";
    }, [storeLogout]);

    const tags = user?.tags || [];

    // ── Loading inicial ──
    if (loadingPagos) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-50/50">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // ── Pantalla de bloqueo ──
    if (estado.color === "rojo") {
        return (
            <PantallaBloqueada
                user={user}
                estado={estado}
                diasBloqueado={diasBloqueado}
                tags={tags}
                onLogout={handleLogout}
                correo={correo}
            />
        );
    }

    return (
        <TemporadaProvider>
            <div className="dashboard-root min-h-dvh p-4 md:p-6 bg-stone-50/50 relative overflow-hidden">
                <NotificationBanner />
                {/* Elementos decorativos de fondo opcionales para dar vida al blur */}
                <div className="blob-glow-1 absolute top-[-10%] left-[-10%] w-96 h-96 bg-orange-200/30 rounded-full blur-3xl pointer-events-none" />
                <div className="blob-glow-2 absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-stone-200/50 rounded-full blur-3xl pointer-events-none" />

                <div className="max-w-2xl mx-auto flex flex-col gap-5 relative z-10">
                    <DashboardHeader
                        user={user}
                        tags={tags}
                        onLogout={handleLogout}
                    />

                    <AccionesRapidas
                        onAbrirCorreo={correo.open}
                        onAbrirCamaras={camaras.open}
                    />

                    <Semaforo estado={estado} />

                    <TablonAvisoResidente avisos={avisos} />

                    <HistorialPagos
                        pagos={pagos}
                        loading={loadingPagos}
                        onVerRecibo={openRecibo}
                    />

                    <ModalContacto
                        isOpen={correo.isOpen}
                        isVisible={correo.isVisible}
                        onClose={correo.close}
                        email="casetasanisidro088@gmail.com"
                    />

                    <ModalRecibo
                        isOpen={recibo.isOpen}
                        isVisible={recibo.isVisible}
                        onClose={recibo.close}
                        pago={pagoSeleccionado}
                    />

                    <ModalCamaras
                        isOpen={camaras.isOpen}
                        isVisible={camaras.isVisible}
                        onClose={camaras.close}
                    />

                    <ModalEncuesta
                        isOpen={encuestaModal.isOpen}
                        isVisible={encuestaModal.isVisible}
                        onClose={encuestaModal.close}
                        encuesta={encuesta}
                        yaVoto={yaVotoEncuesta}
                        opcionVotada={opcionVotada}
                        resultados={resultadosEncuesta}
                        onVotar={handleVotarEncuesta}
                    />

                    {encuesta?.activa && !yaVotoEncuesta && (
                        <BotonEncuesta onClick={encuestaModal.open} />
                    )}

                    <DeveloperBadge />

                    {/* Pie: última sincronización */}
                    {lastSync && (
                        <p className="text-center text-xs font-medium text-stone-400 pb-4 mix-blend-multiply">
                            Última actualización:{" "}
                            {lastSync.toLocaleTimeString("es-MX", {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}{" "}
                            ·{" "}
                            {lastSync.toLocaleDateString("es-MX", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                            })}
                        </p>
                    )}
                </div>
            </div>
        </TemporadaProvider>
    );
}
