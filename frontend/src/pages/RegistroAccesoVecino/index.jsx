import { useState } from "react";
import { apiPublica } from "./api";
import BackgroundBlobs from "./components/BackgroundBlobs";
import PinGate from "./components/PinGate";
import TabSwitcher from "./components/TabSwitcher";
import CrearAccesoForm from "./components/CrearAccesoForm";
import EliminarAccesoForm from "./components/EliminarAccesoForm";
import SuccessScreen from "./components/SuccessScreen";

const TABS = [
    { id: "crear", label: "Crear acceso" },
    { id: "eliminar", label: "Eliminar acceso" },
];

export default function RegistroAccesoVecino() {
    const [token, setToken] = useState(null);
    const [activeTab, setActiveTab] = useState("crear");
    const [result, setResult] = useState(null); // { mode, vecino, username?, password? }

    if (!token) {
        return <PinGate onSuccess={(t) => setToken(t)} />;
    }

    const call = (method, url, data = null) => {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        if (method === "get") return apiPublica.get(url, { ...config, params: data });
        if (method === "delete") return apiPublica.delete(url, { ...config, data });
        return apiPublica.post(url, data, config);
    };

    if (result) {
        return (
            <div className="min-h-screen relative flex items-center justify-center p-4 md:p-8">
                <BackgroundBlobs />
                <SuccessScreen
                    mode={result.mode}
                    vecino={result.vecino}
                    username={result.username}
                    password={result.password}
                    onReset={() => setResult(null)}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 md:p-8">
            <BackgroundBlobs />
            <div className="w-full max-w-[540px] relative z-10">
                <div className="mb-8 pl-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">
                        Panel de capturista
                    </p>
                    <h1 className="text-3xl font-bold text-stone-800">
                        {activeTab === "crear" ? "Crear acceso a vecino" : "Eliminar acceso de vecino"}
                    </h1>
                    <p className="text-stone-600 text-base mt-2">
                        {activeTab === "crear"
                            ? "Busca al residente y asígnale sus credenciales de entrada."
                            : "Busca al residente y revoca sus credenciales de entrada."}
                    </p>
                </div>

                <TabSwitcher tabs={TABS} active={activeTab} onChange={setActiveTab} />

                <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-6 md:p-8">
                    {activeTab === "crear" ? (
                        <CrearAccesoForm
                            call={call}
                            onSuccess={({ vecino, username, password }) =>
                                setResult({ mode: "crear", vecino, username, password })
                            }
                        />
                    ) : (
                        <EliminarAccesoForm
                            call={call}
                            onSuccess={({ vecino }) => setResult({ mode: "eliminar", vecino })}
                        />
                    )}
                </div>

                <p className="text-center text-sm font-medium text-stone-500/80 mt-6 backdrop-blur-sm">
                    Solo capturistas autorizados pueden crear o eliminar credenciales.
                </p>
            </div>
        </div>
    );
}
