import { useState, useEffect, useCallback } from "react";
import {
    getEncuestasAdmin,
    createEncuesta,
    toggleEncuesta,
    getResultadosEncuesta,
} from "../../../api/encuestas";
import EncuestaModal from "./EncuestaModal";
import ResultadosEncuestaModal from "./ResultadosEncuestaModal";
import PaginatedPanel from "./PaginatedPanel";

const FORM_VACIO = {
    pregunta: "",
    descripcion: "",
    opciones: ["", ""],
    fecha_cierre: "",
};

export default function EncuestasAdmin() {
    const [encuestas, setEncuestas] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(FORM_VACIO);
    const [saving, setSaving] = useState(false);

    const [showResultados, setShowResultados] = useState(false);
    const [encuestaSeleccionada, setEncuestaSeleccionada] = useState(null);
    const [resultados, setResultados] = useState(null);
    const [loadingResultados, setLoadingResultados] = useState(false);

    const fetchEncuestas = useCallback(async () => {
        try {
            const res = await getEncuestasAdmin();
            setEncuestas(res.data || []);
        } catch {}
    }, []);

    useEffect(() => {
        fetchEncuestas();
    }, [fetchEncuestas]);

    const openCreate = () => {
        setForm(FORM_VACIO);
        setShowModal(true);
    };

    const handleSave = async () => {
        const opcionesLimpias = form.opciones
            .map((o) => o.trim())
            .filter(Boolean);
        if (!form.pregunta.trim() || opcionesLimpias.length < 2) return;

        setSaving(true);
        try {
            await createEncuesta({
                pregunta: form.pregunta.trim(),
                descripcion: form.descripcion.trim() || null,
                opciones: opcionesLimpias,
                fecha_cierre: form.fecha_cierre || null,
            });
            setShowModal(false);
            fetchEncuestas();
        } catch {
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (id) => {
        try {
            await toggleEncuesta(id);
            fetchEncuestas();
        } catch {}
    };

    const handleVerResultados = async (encuesta) => {
        setEncuestaSeleccionada(encuesta);
        setShowResultados(true);
        setLoadingResultados(true);
        setResultados(null);
        try {
            const res = await getResultadosEncuesta(encuesta.id);
            setResultados(res.data);
        } catch {
        } finally {
            setLoadingResultados(false);
        }
    };

    return (
        <>
            <div className="relative overflow-hidden flex flex-col min-h-0 p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide">
                        Encuestas
                    </h3>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow-[0_4px_10px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)] active:scale-95 transition-all"
                    >
                        <svg
                            className="w-3.5 h-3.5 drop-shadow-sm"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Nueva
                    </button>
                </div>

                <div className="relative z-10 flex-1 min-h-0 flex flex-col">
                    <PaginatedPanel
                        items={encuestas}
                        emptyText="Sin encuestas creadas"
                        renderItem={(encuesta) => (
                            <div
                                key={encuesta.id}
                                className="flex items-center gap-3 p-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60 mb-2 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] hover:bg-white/70 transition-colors"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span
                                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                            encuesta.activa
                                                ? "bg-green-500"
                                                : "bg-stone-400"
                                        }`}
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-stone-800 truncate drop-shadow-sm">
                                            {encuesta.pregunta}
                                        </p>
                                        <p className="text-[11px] text-stone-500 font-medium">
                                            {encuesta.votos_count ?? 0} votos ·{" "}
                                            {encuesta.activa
                                                ? "activa"
                                                : "cerrada"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() =>
                                            handleVerResultados(encuesta)
                                        }
                                        className="p-2 text-stone-400 hover:text-orange-500 hover:bg-orange-50/50 rounded-xl transition-all active:scale-95"
                                        title="Ver resultados"
                                    >
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14"
                                            />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleToggle(encuesta.id)
                                        }
                                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
                                            encuesta.activa
                                                ? "text-stone-500 hover:text-red-500 hover:bg-red-50/50"
                                                : "text-stone-500 hover:text-green-600 hover:bg-green-50/50"
                                        }`}
                                    >
                                        {encuesta.activa ? "Cerrar" : "Reabrir"}
                                    </button>
                                </div>
                            </div>
                        )}
                    />
                </div>
            </div>

            <EncuestaModal
                open={showModal}
                form={form}
                setForm={setForm}
                saving={saving}
                onClose={() => setShowModal(false)}
                onSave={handleSave}
            />

            <ResultadosEncuestaModal
                open={showResultados}
                encuesta={encuestaSeleccionada}
                resultados={resultados}
                loading={loadingResultados}
                onClose={() => setShowResultados(false)}
            />
        </>
    );
}
