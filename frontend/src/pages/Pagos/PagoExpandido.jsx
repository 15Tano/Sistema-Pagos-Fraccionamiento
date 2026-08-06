import { useState, useEffect } from "react";
import api from "../../../lib/axios";
import { TagIcon } from "./Icons";

// ── FILA EXPANDIDA ──
export default function PagoExpandido({ vecinoUuid }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/pagos/estado-meses/${vecinoUuid}`)
            .then((r) => setData(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [vecinoUuid]);

    if (loading)
        return (
            <div className="px-5 py-4 flex items-center justify-center gap-2 text-xs text-stone-400 font-medium bg-white/20 border-t border-white/40">
                <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                Cargando estado...
            </div>
        );

    if (!data) return null;

    return (
        <div className="px-5 py-4 bg-white/30 backdrop-blur-md border-t border-white/60 flex flex-col sm:flex-row gap-5 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]">
            {/* Últimos 3 meses */}
            <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
                    Últimos 3 meses
                </p>
                <div className="flex gap-2.5">
                    {data.meses.map((m) => (
                        <div
                            key={m.mes}
                            className="flex flex-col items-center gap-1.5"
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] border
                                ${
                                    m.pagado
                                        ? "bg-green-100/60 border-green-200/60 text-green-700"
                                        : "bg-red-100/60 border-red-200/60 text-red-600"
                                }`}
                            >
                                {m.pagado ? "✓" : "✗"}
                            </div>
                            <span
                                className="text-[10px] font-medium text-stone-500 text-center leading-tight"
                                style={{ maxWidth: 52 }}
                            >
                                {m.label.split(" ")[0]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px bg-white/60" />

            {/* Tags */}
            <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
                    Tags asignados
                </p>
                {data.tags.length === 0 ? (
                    <span className="text-xs text-stone-400 italic">
                        Sin tags
                    </span>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {data.tags.map((tag) => (
                            <span
                                key={tag.id}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold bg-orange-100/60 text-orange-700 border border-orange-200/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]"
                            >
                                <TagIcon />
                                {tag.codigo}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
