import { useState, useEffect, useCallback } from "react";
import {
    getAvisos,
    createAviso,
    updateAviso,
    deleteAviso,
} from "../../../api/avisos";
import { TIPO_CONFIG_ADMIN } from "../config/avisosConfig";
import AvisoModal from "./AvisoModal";

export default function AvisosAdmin() {
    const [avisos, setAvisos] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null); // aviso a editar o null para crear
    const [form, setForm] = useState({
        titulo: "",
        descripcion: "",
        tipo: "informativo",
        imagen: null,
        eliminarImagen: false,
    });
    const [saving, setSaving] = useState(false);

    const [preview, setPreview] = useState(null);

    const fetchAvisos = useCallback(async () => {
        try {
            const res = await getAvisos();
            setAvisos(res.data || []);
        } catch {}
    }, []);

    useEffect(() => {
        fetchAvisos();
    }, [fetchAvisos]);

    const openCreate = () => {
        setEditing(null);
        setForm({
            titulo: "",
            descripcion: "",
            tipo: "informativo",
            imagen: null,
            eliminarImagen: false,
        });
        setPreview(null);
        setShowModal(true);
    };

    const openEdit = (aviso) => {
        setEditing(aviso);
        setForm({
            titulo: aviso.titulo,
            descripcion: aviso.descripcion,
            tipo: aviso.tipo,
            imagen: null,
            eliminarImagen: false,
        });
        setPreview(aviso.imagen_url || null);
        setShowModal(true);
    };

    const handleImagenChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setForm({ ...form, imagen: file, eliminarImagen: false });
        setPreview(URL.createObjectURL(file));
    };

    const handleRemoveImagen = () => {
        setForm({ ...form, imagen: null, eliminarImagen: true });
        setPreview(null);
    };

    const handleSave = async () => {
        if (!form.titulo.trim() || !form.descripcion.trim()) return;
        setSaving(true);
        try {
            if (editing) {
                await updateAviso(editing.id, form);
            } else {
                await createAviso(form);
            }
            setShowModal(false);
            fetchAvisos();
        } catch {
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Eliminar este aviso?")) return;
        try {
            await deleteAviso(id);
            fetchAvisos();
        } catch {}
    };

    return (
        <>
            {/* ── Feed de avisos ── */}
            <div className="relative overflow-hidden flex flex-col min-h-0 p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide">
                        Tablón de Avisos
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
                        Nuevo
                    </button>
                </div>

                <div className="flex flex-col gap-2 relative z-10 overflow-y-auto">
                    {avisos.length === 0 ? (
                        <div className="flex items-center justify-center h-16 text-sm font-medium text-stone-400">
                            Sin avisos publicados
                        </div>
                    ) : (
                        avisos.map((aviso) => {
                            const cfg =
                                TIPO_CONFIG_ADMIN[aviso.tipo] ||
                                TIPO_CONFIG_ADMIN.informativo;
                            return (
                                <div
                                    key={aviso.id}
                                    className="flex items-center gap-3 p-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] hover:bg-white/70 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {/* --- AQUÍ VA LA IMAGEN --- */}
                                        {aviso.imagen_url && (
                                            <img
                                                src={aviso.imagen_url}
                                                alt=""
                                                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/60 shadow-sm"
                                            />
                                        )}

                                        {/* --- PUNTO DE COLOR --- */}
                                        <span
                                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`}
                                        />

                                        <p className="text-sm font-bold text-stone-800 truncate drop-shadow-sm">
                                            {aviso.titulo}
                                        </p>
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ring-1 ${cfg.ring} text-stone-600 bg-white/50 shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]`}
                                        >
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {/* Editar */}
                                        <button
                                            onClick={() => openEdit(aviso)}
                                            className="p-2 text-stone-400 hover:text-orange-500 hover:bg-orange-50/50 rounded-xl transition-all active:scale-95"
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
                                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                />
                                            </svg>
                                        </button>
                                        {/* Borrar */}
                                        <button
                                            onClick={() =>
                                                handleDelete(aviso.id)
                                            }
                                            className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50/50 rounded-xl transition-all active:scale-95"
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
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Modal crear/editar (Liquid Glass) ── */}
            <AvisoModal
                open={showModal}
                editing={editing}
                form={form}
                setForm={setForm}
                preview={preview}
                saving={saving}
                onClose={() => setShowModal(false)}
                onSave={handleSave}
                onImagenChange={handleImagenChange}
                onRemoveImagen={handleRemoveImagen}
            />
        </>
    );
}
