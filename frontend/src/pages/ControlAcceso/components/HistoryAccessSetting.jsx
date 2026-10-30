import { useEffect, useRef, useState } from "react";
import { ChevronDown, LockKeyhole, RefreshCw } from "lucide-react";
import { monitorSettingsResponse } from "../model";

function HistoryPermissionControl({ client }) {
    const [state, setState] = useState({ data: null, busy: true, error: "", saved: false, uncertain: false });
    const owner = useRef(null);
    useEffect(() => {
        const run = { closed: false, busy: false, controllers: new Set() };
        owner.current = run;
        const controller = new AbortController(); run.controllers.add(controller);
        client.settings({ signal: controller.signal }).then((response) => {
            const data = monitorSettingsResponse(response);
            if (!run.closed) setState({ data, busy: false, error: "", saved: false, uncertain: false });
        }).catch(() => {
            if (!run.closed) setState({ data: null, busy: false, error: "No se pudo consultar el permiso. Intenta actualizarlo.", saved: false, uncertain: true });
        }).finally(() => run.controllers.delete(controller));
        return () => { run.closed = true; run.controllers.forEach((c) => c.abort()); };
    }, [client]);

    const change = async (reload = false) => {
        const run = owner.current;
        if (!run || run.closed || run.busy || state.busy || (!reload && (!state.data || state.uncertain))) return;
        run.busy = true;
        const controller = new AbortController(); run.controllers.add(controller);
        setState((current) => ({ ...current, busy: true, error: "", saved: false }));
        try {
            const response = reload ? await client.settings({ signal: controller.signal }) :
                await client.updateSettings({ history_for_guards: !state.data.history_for_guards, revision: state.data.revision }, { signal: controller.signal });
            const data = monitorSettingsResponse(response);
            if (!run.closed) setState({ data, busy: false, error: "", saved: !reload, uncertain: false });
        } catch (error) {
            if (!run.closed) {
                if (error?.response?.status === 409 && error.response.data?.code === "monitor_settings_conflict") {
                    try {
                        const data = monitorSettingsResponse(error.response.data);
                        setState({ data, busy: false, error: "Otro administrador cambió el permiso. Revisa el valor actual antes de volver a cambiarlo.", saved: false, uncertain: false });
                    } catch {
                        setState((current) => ({ ...current, busy: false, error: "Actualiza el ajuste antes de volver a cambiarlo.", saved: false, uncertain: true }));
                    }
                } else setState((current) => ({ ...current, busy: false, error: "No se pudo confirmar el ajuste. Actualízalo para comprobar su valor.", saved: false, uncertain: true }));
            }
        } finally { run.busy = false; run.controllers.delete(controller); }
    };

    return <div className="ac-permission-control">
        <div><label id="ac-history-permission-label">Permitir que vigilancia consulte el historial de lecturas</label>
            <p>El Buscador, la última lectura y las pantallas ampliadas permanecen disponibles. Administración siempre tiene acceso al historial.</p></div>
        <button type="button" role="switch" aria-labelledby="ac-history-permission-label"
            aria-checked={state.data?.history_for_guards === true} disabled={state.busy || !state.data || state.uncertain}
            className="ac-permission-switch" onClick={() => change()}><span /></button>
        <div className="ac-permission-feedback" role={state.error ? "alert" : "status"}>
            {state.busy ? "Consultando…" : state.error || (state.saved ? "Permiso guardado." : state.data?.history_for_guards ? "Historial disponible para vigilancia." : "Historial reservado a administración.")}
            {!state.busy && <button type="button" onClick={() => change(true)}><RefreshCw size={12} />Actualizar ajuste</button>}
        </div>
    </div>;
}

export default function HistoryAccessSetting({ client }) {
    const [open, setOpen] = useState(false);
    return <details className="ac-history-permission glass-card" onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary><LockKeyhole size={16} /><span>Acceso al historial<span>Solo administración</span></span><ChevronDown size={15} /></summary>
        {open && <HistoryPermissionControl client={client} />}
    </details>;
}
