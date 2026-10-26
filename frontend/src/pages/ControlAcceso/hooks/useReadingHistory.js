import { useEffect, useRef, useState } from "react";
import { errorInfo, eventsResponse, mergeRows } from "../model";

// Búsquedas históricas explícitas: no abren otro seguimiento ni sustituyen la última lectura.
export function useReadingHistory(client, agentId, filters, enabled) {
    const key = JSON.stringify({ agentId, ...filters });
    const [snapshot, setSnapshot] = useState({ key: "", rows: [], loading: false, more: false, error: null });
    const [revision, setRevision] = useState(0);
    const owner = useRef(null);
    useEffect(() => {
        if (!enabled || !agentId) return;
        let closed = false, busy = false, oldest = null, rows = [];
        const controllers = new Set();
        const query = JSON.parse(key);
        const params = { agent_id: query.agentId, source: query.source, limit: 50,
            ...(query.door ? { door_id: query.door } : {}), ...(query.card ? { card_no: query.card } : {}) };
        async function load(older = false) {
            if (closed || busy || (older && !oldest)) return;
            busy = true;
            const controller = new AbortController(); controllers.add(controller);
            setSnapshot((current) => ({ ...(current.key === key ? current : { rows: [], more: false }), key, loading: true, error: null }));
            try {
                const before = older ? oldest : null;
                const value = eventsResponse(await client.events({ ...params, ...(before ? { before_id: before } : {}) }, { signal: controller.signal }), null, before);
                if (closed) return;
                rows = mergeRows(older ? rows : [], value.data); oldest = value.meta.first_id ?? oldest;
                setSnapshot({ key, rows, loading: false, more: value.meta.has_more && rows.length < 400, error: null });
            } catch (error) {
                if (!closed && error?.code !== "ERR_CANCELED" && error?.name !== "AbortError") {
                    const info = errorInfo(error); if (info.clear) rows = [];
                    setSnapshot({ key, rows, loading: false, more: false, error: info });
                }
            } finally { busy = false; controllers.delete(controller); }
        }
        owner.current = { older: () => load(true) };
        Promise.resolve().then(() => load());
        return () => { closed = true; controllers.forEach((c) => c.abort()); owner.current = null; };
    }, [client, agentId, key, revision, enabled]);
    const state = snapshot.key === key ? snapshot : { rows: [], loading: enabled && Boolean(agentId), more: false, error: null };
    return { ...state, refresh: () => setRevision((r) => r + 1), older: () => owner.current?.older() };
}
