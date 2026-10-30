import { statesResponse, eventsResponse, currentResponse, monitorPermissions, mergeRows, replaceCurrentRows, errorInfo } from "./model.js";

export const initialMonitor = () => ({ agents: [], agentId: "", rows: [], loading: true, error: null,
    permissions: monitorPermissions(null), busy: false, olderLoading: false, olderMore: false, connectedAt: null, anchor: null, truncated: false, catchingUp: false });

// Un propietario por consulta: cursor de seguimiento independiente del historial y del limite visual.
export function createMonitorSession(client, filters, notify, options = {}) {
    const clock = options.clock ?? (() => performance.now());
    const schedule = options.schedule ?? ((fn, delay) => setTimeout(fn, delay));
    const cancel = options.cancel ?? ((id) => clearTimeout(id));
    const maxPages = options.maxPages === 1 ? 1 : 2;
    let model = initialMonitor(), closed = false, enabled = true, visible = true, terminal = false;
    let timer = null, running = false, failures = 0, cursor = null, oldest = null, initial = true;
    let nextHealth = 0, queued = false, policyEpoch = 0;
    const controllers = new Set();
    const publish = (extra) => { if (!closed) { model = { ...model, ...extra }; notify(model); } };
    const active = () => !closed && enabled && visible && !terminal;
    const request = async (call) => {
        const controller = new AbortController(); controllers.add(controller);
        try { return await call(controller.signal); } finally { controllers.delete(controller); }
    };
    const stopTimer = () => { if (timer != null) cancel(timer); timer = null; };
    const aborted = (e) => e?.name === "AbortError" || e?.code === "ERR_CANCELED";
    const abort = () => { for (const controller of controllers) controller.abort(); };
    const params = () => ({ agent_id: model.agentId, source: filters.source || "rt", limit: 50,
        ...(filters.door ? { door_id: filters.door } : {}), ...(filters.card ? { card_no: filters.card } : {}) });
    const historyDenied = (error) => error?.response?.status === 403 && error.response.data?.code === "history_forbidden";
    const applyPermissions = (raw) => {
        const permissions = monitorPermissions(raw);
        if (permissions.can_view_history !== model.permissions.can_view_history) {
            policyEpoch++; cursor = null; oldest = null; initial = true;
            publish({ rows: [], olderMore: false, catchingUp: false, permissions });
        } else publish({ permissions });
    };
    const revokeHistory = () => {
        applyPermissions({ ...model.permissions, can_view_history: false });
        nextHealth = 0; failures = 0;
        publish({ loading: true, error: null });
    };
    async function tick() {
        stopTimer();
        if (!active()) return;
        if (running) { queued = true; return; }
        running = true; publish({ busy: true });
        let delay = 3000;
        try {
            if (clock() >= nextHealth || !model.agentId) {
                const value = statesResponse(await request((signal) => client.states({ signal })));
                if (!active()) return;
                const selected = filters.agentId || model.agentId ||
                    value.data.find((a) => a.device_serial === "CO2K225060027")?.agent_id ||
                    (value.data.length === 1 ? value.data[0].agent_id : "");
                if (selected && !value.data.some((a) => a.agent_id === selected)) throw Object.assign(new Error(), { response: { status: 404 } });
                applyPermissions(value.meta.permissions);
                nextHealth = clock() + 15000;
                publish({ agents: value.data, agentId: selected, truncated: value.meta.truncated,
                    anchor: { server: Date.parse(value.meta.server_time_utc), at: clock() } });
            }
            if (model.agentId) {
                if (!model.permissions.can_view_history) {
                    const value = currentResponse(await request((signal) => client.current({ agent_id: model.agentId,
                        ...(filters.door ? { door_id: filters.door } : {}) }, { signal })));
                    if (!active()) return;
                    if (value.meta.permissions) applyPermissions(value.meta.permissions);
                    publish({ rows: replaceCurrentRows(model.rows, value.data), olderMore: false, catchingUp: false });
                } else {
                let more = false;
                for (let page = 0; page < maxPages; page++) {
                    const epoch = policyEpoch;
                    const value = eventsResponse(await request((signal) => client.events({ ...params(),
                        ...(!initial && cursor != null ? { after_id: cursor } : {}) }, { signal })), !initial ? cursor : null);
                    if (!active()) return;
                    if (epoch !== policyEpoch || !model.permissions.can_view_history) break;
                    if (value.meta.permissions) applyPermissions(value.meta.permissions);
                    if (!model.permissions.can_view_history) break;
                    if (initial) { oldest = value.meta.first_id; publish({ olderMore: value.meta.has_more }); }
                    cursor = value.meta.last_id; more = !initial && value.meta.has_more; initial = false;
                    publish({ rows: mergeRows(model.rows, value.data), catchingUp: more });
                    if (!more) break;
                }
                if (more) delay = 3000; // Dos paginas por tanda; conservar margen del limite de consultas.
                }
            }
            failures = 0; publish({ loading: false, error: null, connectedAt: clock() });
        } catch (error) {
            if (!closed && !aborted(error)) {
                if (historyDenied(error)) { revokeHistory(); delay = 0; }
                else {
                const info = errorInfo(error); terminal = info.terminal; failures++;
                delay = Math.min(30000, 3000 * 2 ** Math.min(failures, 4));
                if (error?.response?.status === 429) {
                    const retry = Number(error.response.headers?.["retry-after"]);
                    if (Number.isFinite(retry) && retry > 0) delay = Math.max(delay, Math.min(120000, retry * 1000));
                }
                publish({ loading: false, error: info, ...(info.clear ? { agents: [], rows: [], agentId: "", permissions: monitorPermissions(null) } : {}) });
                }
            }
        } finally {
            running = false; publish({ busy: false });
            if (active()) { timer = schedule(tick, queued && !model.error ? 0 : delay); queued = false; }
        }
    }
    return {
        start: () => { Promise.resolve().then(tick); },
        setEnabled(value) { if (enabled === value) return; enabled = value; stopTimer(); if (!value) abort(); else tick(); },
        setVisible(value) { if (visible === value) return; visible = value; stopTimer(); if (!value) abort(); else tick(); },
        refresh() { terminal = false; nextHealth = 0; failures = 0; tick(); },
        async older() {
            if (closed || terminal || !model.permissions.can_view_history || model.olderLoading || !model.olderMore || !oldest || model.rows.length >= 400) return;
            const epoch = policyEpoch;
            publish({ olderLoading: true });
            try {
                const value = eventsResponse(await request((signal) => client.events({ ...params(), before_id: oldest }, { signal })), null, oldest);
                if (closed || terminal || epoch !== policyEpoch || !model.permissions.can_view_history) return;
                oldest = value.meta.first_id ?? oldest;
                publish({ rows: mergeRows(model.rows, value.data), olderMore: value.meta.has_more });
            } catch (error) {
                if (!closed && !aborted(error)) {
                    if (historyDenied(error)) { revokeHistory(); tick(); return; }
                    const info = errorInfo(error);
                    if (info.terminal) { terminal = true; stopTimer(); abort(); }
                    publish({ error: info, ...(info.clear ? { agents: [], rows: [], agentId: "", permissions: monitorPermissions(null) } : {}) });
                }
            } finally { publish({ olderLoading: false }); }
        },
        close() { closed = true; stopTimer(); abort(); },
    };
}
