import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import {
    Check, ChevronRight, LoaderCircle, Power, Radio, Search, ShieldCheck, ShieldOff, Tag, X,
} from "lucide-react";
import { setTagAccess } from "../../../api/tags";

const RESULT_LIMIT = 30;

function normalize(value) {
    return String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function ownerNames(tag) {
    return tag.vecinos?.map((owner) => owner.nombre).join(" · ") || "Sin vecino asignado";
}

function accessLabel(tag) {
    if (tag.desactivado_manualmente) return "Desactivado";
    return tag.vecinos?.length ? "Por vigencia" : "Sin asignar";
}

export default function TagAccessPanel({ tags, onChange }) {
    const headingId = useId();
    const searchId = useId();
    const reducedMotion = useReducedMotion();
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const query = normalize(search).trim();
    const results = useMemo(() => {
        if (!query) return tags.filter((tag) => tag.desactivado_manualmente);

        const terms = query.split(/\s+/);
        return tags.filter((tag) => {
            const owners = tag.vecinos?.map((owner) => `${owner.nombre} ${owner.calle} ${owner.numero_casa}`).join(" ");
            const searchable = normalize(`${tag.codigo} ${owners ?? ""}`);
            return terms.every((term) => searchable.includes(term));
        }).sort((a, b) => Number(normalize(b.codigo) === query) - Number(normalize(a.codigo) === query));
    }, [query, tags]);

    const selected = tags.find((tag) => tag.id === selectedId);
    const disabled = Boolean(selected?.desactivado_manualmente);
    const compatible = disabled || /^\d+$/.test(String(selected?.codigo ?? "").trim());
    const assigned = Boolean(selected?.vecinos?.length);
    const StatusIcon = disabled ? ShieldOff : ShieldCheck;

    function selectTag(tag) {
        setSelectedId(tag.id);
        setConfirming(false);
        setError("");
        setNotice("");
    }

    async function confirmChange() {
        if (!selected || saving) return;
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const { data } = await setTagAccess(selected.id, !disabled);
            onChange(data.tag);
            setConfirming(false);
            setNotice(disabled
                ? assigned
                    ? "Reactivado. El polling volverá a tomar la vigencia por pagos."
                    : "Desactivación retirada. El tag sigue sin vecino asignado."
                : "Desactivación guardada. El polling recibirá la fecha vencida.");
        } catch (requestError) {
            setError(requestError.response?.data?.message ?? "No se pudo guardar el cambio. Vuelve a intentarlo.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section aria-labelledby={headingId} className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/55 p-4 shadow-[0_14px_44px_rgba(65,43,29,0.08)] backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-orange-200/80 bg-orange-100 text-orange-700 shadow-[inset_0_1px_1px_white]">
                    <Radio size={21} aria-hidden="true" />
                </div>
                <h2 id={headingId} className="text-lg font-bold tracking-tight text-stone-900">Acceso de tags</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 md:gap-6">
                <div className="min-w-0">
                    <label htmlFor={searchId} className="text-sm font-semibold text-stone-700">Buscar tag</label>
                    <div className="mt-1.5 flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white/85 px-3.5 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-200">
                        <Search size={18} className="shrink-0 text-stone-500" aria-hidden="true" />
                        <input
                            id={searchId}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Código, vecino o domicilio"
                            autoComplete="off"
                            className="min-w-0 flex-1 bg-transparent py-3 text-base text-stone-900 outline-none placeholder:text-stone-500"
                        />
                        {search && (
                            <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch("")} className="grid size-8 shrink-0 place-items-center rounded-lg text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-orange-500">
                                <X size={16} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                    <p role="status" className="my-2.5 text-xs font-medium text-stone-600">
                        {query
                            ? `${results.length} ${results.length === 1 ? "resultado" : "resultados"}${results.length > RESULT_LIMIT ? ` · mostrando ${RESULT_LIMIT}` : ""}`
                            : `${results.length} ${results.length === 1 ? "tag desactivado" : "tags desactivados"} manualmente`}
                    </p>
                    {results.length > 0 && (
                        <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                            {results.slice(0, RESULT_LIMIT).map((tag) => (
                                <li key={tag.id}>
                                    <button
                                        type="button"
                                        aria-pressed={selectedId === tag.id}
                                        onClick={() => selectTag(tag)}
                                        disabled={saving}
                                        className="flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-white/65 px-3 py-2 text-left hover:bg-white focus-visible:outline-2 focus-visible:outline-orange-500 aria-pressed:border-orange-200 aria-pressed:bg-orange-50 disabled:opacity-70"
                                    >
                                        <Tag size={16} className="shrink-0 text-stone-500" aria-hidden="true" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-mono text-sm font-bold text-stone-900">{tag.codigo}</span>
                                            <span className="block truncate text-xs text-stone-600">{ownerNames(tag)}</span>
                                        </span>
                                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${tag.desactivado_manualmente ? "bg-rose-100 text-rose-800" : "bg-stone-100 text-stone-700"}`}>
                                            {accessLabel(tag)}
                                        </span>
                                        <ChevronRight size={15} className="shrink-0 text-stone-500" aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {selected ? (
                    <Motion.div
                        key={selected.id}
                        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="min-w-0"
                    >
                        <div className="relative isolate overflow-hidden rounded-[1.35rem] border border-stone-700 bg-stone-900 p-4 text-white shadow-[0_10px_24px_rgba(33,24,19,0.17)] sm:p-5">
                            <Motion.div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 -z-10"
                                animate={{ backgroundColor: disabled ? "#461c29" : "#182f2b" }}
                                transition={{ duration: reducedMotion ? 0 : 0.4 }}
                                style={{ backgroundImage: "radial-gradient(ellipse at 100% 0%, #ffffff24, transparent 62%)" }}
                            />
                            <AnimatePresence initial={false}>
                                {!reducedMotion && (
                                    <Motion.div
                                        key={String(disabled)}
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/15 to-transparent"
                                        initial={{ x: "-130%" }}
                                        animate={{ x: "340%" }}
                                        transition={{ duration: 0.7, ease: "easeOut" }}
                                    />
                                )}
                            </AnimatePresence>
                            <div className="relative flex items-center justify-between gap-3">
                                <Motion.div
                                    key={String(disabled)}
                                    initial={reducedMotion ? false : { scale: 0.72, rotate: -12 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 360, damping: 18 }}
                                    className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/25 bg-white/10"
                                >
                                    <StatusIcon size={24} aria-hidden="true" />
                                </Motion.div>
                                <span className={`rounded-full border border-white/20 px-2.5 py-1 text-xs font-semibold ${disabled ? "bg-rose-400/15 text-rose-100" : "bg-white/10 text-white"}`}>
                                    {accessLabel(selected)}
                                </span>
                            </div>
                            <p className="mt-4 break-all font-mono text-xl font-bold tracking-wider">{selected.codigo}</p>
                            <p className="mt-1 break-words text-sm text-white/80">{ownerNames(selected)}</p>
                        </div>

                        {!compatible ? (
                            <p className="mt-3 text-sm text-stone-600">Este código no es numérico y el polling no puede procesarlo.</p>
                        ) : confirming ? (
                            <div className="mt-3 rounded-2xl border border-stone-200 bg-white/90 p-3.5">
                                <p className="text-sm font-semibold text-stone-900">{disabled ? "¿Reactivar este tag?" : "¿Desactivar este tag?"}</p>
                                <p className="mt-1 text-sm text-stone-600">
                                    {disabled
                                        ? assigned
                                            ? "El acceso volverá a depender de la vigencia calculada con los pagos actuales."
                                            : "Se quitará la desactivación manual. La vigencia por pagos se calculará cuando se asigne a un vecino."
                                        : "El polling recibirá la vigencia del 02/01/2020 para bloquear el paso en la pluma."}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button type="button" onClick={() => { setConfirming(false); setError(""); }} disabled={saving} className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-50">
                                        Cancelar
                                    </button>
                                    <button type="button" onClick={confirmChange} disabled={saving} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60 ${disabled ? "bg-emerald-800 hover:bg-emerald-900" : "bg-rose-700 hover:bg-rose-800"}`}>
                                        {saving && <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" />}
                                        {saving ? "Guardando…" : disabled ? "Confirmar reactivación" : "Confirmar desactivación"}
                                    </button>
                                </div>
                                {error && <p role="alert" className="mt-2 text-sm font-medium text-rose-800">{error}</p>}
                            </div>
                        ) : (
                            <button type="button" onClick={() => { setConfirming(true); setNotice(""); }} className={`mt-3 inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-orange-500 ${disabled ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100" : "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"}`}>
                                <Power size={17} aria-hidden="true" />
                                {disabled ? "Reactivar tag" : "Desactivar tag"}
                            </button>
                        )}
                        {notice && (
                            <Motion.p role="status" initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-start gap-2 text-sm font-medium text-stone-700">
                                <Check size={17} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
                                {notice}
                            </Motion.p>
                        )}
                    </Motion.div>
                ) : (
                    <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-[1.35rem] border border-dashed border-stone-300 bg-white/40 px-4 py-6 text-center text-sm text-stone-600">
                        <Tag size={20} className="text-stone-500" aria-hidden="true" />
                        Selecciona un tag para gestionar su acceso.
                    </div>
                )}
            </div>
        </section>
    );
}
