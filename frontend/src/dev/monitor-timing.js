// Instrumentación exclusiva de ensayo. No modifica relojes, cursores ni frescura.
export function createTiming({ wall = () => Date.now(), mono = () => performance.now(), visible = () => !document.hidden, maximum = 2500 } = {}) {
    const started = { wall: wall(), mono: mono() };
    const records = new Map(), requests = [], errors = [];
    let clockChanged = false, overflow = false, visibilityEpoch = 0;
    const sample = () => {
        const point = { wall: wall(), mono: mono(), visible: visible() };
        if (Math.abs(point.wall - started.wall - (point.mono - started.mono)) > 250) clockChanged = true;
        return point;
    };
    const request = (kind, point, status, duration) => {
        if (requests.length < maximum) requests.push({ kind, at_ms: point.wall, status, duration_ms: duration });
        else overflow = true;
    };
    return {
        sample, request,
        error(kind) { if (errors.length < 100) errors.push({ kind, at_ms: wall() }); },
        visibilityChanged() {
            if (!visible()) visibilityEpoch++;
            if (!visible()) for (const r of records.values()) {
                if (!r.excluded && !Object.keys(r.surfaces).length) r.excluded = 'hidden_before_frame';
            }
        },
        received(rows, params, point) {
            const historical = !params.after_id || Boolean(params.before_id) || params.source !== 'rt' || Boolean(params.card_no);
            for (const row of rows) {
                if (records.has(row.id)) continue;
                if (records.size >= maximum) { overflow = true; continue; }
                const captured = Date.parse(row.captured_ended_utc);
                const validIdentity = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(row.response_id ?? '') && Number.isInteger(row.ordinal) && row.ordinal >= 0;
                records.set(row.id, { row_id: row.id, response_id: row.response_id, ordinal: row.ordinal,
                    captured_ended_utc: row.captured_ended_utc, door_id: row.door_id,
                    received_pc_ms: point.wall, received_mono_ms: point.mono, surfaces: {}, display_decisions: [], surface_exclusions: {}, received_visibility_epoch: visibilityEpoch,
                    excluded: historical ? 'initial_or_history' : !validIdentity ? 'invalid_identity' : !point.visible ? 'hidden_at_receive'
                        : !Number.isFinite(captured) ? 'invalid_capture_clock' : captured < started.wall ? 'capture_before_measurement' : point.wall < captured ? 'negative_clock_delta'
                            : point.wall - captured > 120000 ? 'backlog_or_clock_unverified' : null });
            }
        },
        frame(id, surface, inViewport = false) {
            const record = records.get(id), point = sample();
            if (!record || record.surfaces[surface] || !point.visible) return;
            if (record.received_visibility_epoch !== visibilityEpoch) { record.surface_exclusions[surface] = 'hidden_since_receive'; return; }
            record.surfaces[surface] = { pc_ms: point.wall, after_receive_ms: point.mono - record.received_mono_ms, in_viewport: inViewport };
        },
        displayDecision(id, reason) {
            const record = records.get(id);
            if (record && !record.display_decisions.some((d) => d.reason === reason) && record.display_decisions.length < 10) {
                record.display_decisions.push({ reason, pc_ms: wall() });
            }
        },
        report(context = {}) {
            const point = sample(), rows = [...records.values()];
            const summary = {};
            const percentile = (values) => {
                const v = values.sort((a, b) => a - b);
                return v.length ? { samples: v.length, p50_ms: v[Math.ceil(v.length * .5) - 1], p95_ms: v[Math.ceil(v.length * .95) - 1], max_ms: v.at(-1) } : { samples: 0 };
            };
            for (const surface of ['feed', 'latest', 'display']) {
                const eligible = rows.filter((r) => !r.excluded && r.surfaces[surface]);
                summary[surface] = { observed: eligible.length,
                    capture_to_frame: percentile(clockChanged ? [] : eligible.map((r) => r.surfaces[surface].pc_ms - Date.parse(r.captured_ended_utc))),
                    get_to_frame: percentile(eligible.map((r) => r.surfaces[surface].after_receive_ms)),
                    in_viewport: eligible.filter((r) => r.surfaces[surface].in_viewport).length };
            }
            return { scope: 'ensayo_monitor_no_antena_ni_pixeles_fisicos', ...context,
                started_pc_utc: new Date(started.wall).toISOString(), ended_pc_utc: new Date(point.wall).toISOString(),
                same_dell_clock_required: true, clock_changed: clockChanged, overflow,
                poll_after_completion_ms: 3000, health_interval_ms: 15000,
                summary, incremental_without_observed_surface: rows.filter((r) => !r.excluded && !Object.keys(r.surfaces).length).map((r) => r.row_id),
                rows, requests, errors,
                limits: ['Primera página e historial excluidos.', 'Dos requestAnimationFrame indican oportunidad de dibujo, no certifican píxeles físicos.',
                    'Solo capture_to_frame exige que captura y navegador sean Dell sin ajuste de reloj.',
                    'No mide espera previa a captura SDK. No sumar percentiles de segmentos.',
                    'Display conserva sus reglas de frescura; no mostrar una fila no implica pérdida de ingesta.'] };
        },
    };
}

export function observeReadingFrames(timing, root = document, raf = requestAnimationFrame, cancel = cancelAnimationFrame) {
    let first = null, second = null, stopped = false;
    const scan = () => {
        if (stopped || first != null || second != null) return;
        first = raf(() => { first = null; second = raf(() => {
            second = null;
            for (const display of root.querySelectorAll('[data-ac-display-latest]')) timing.displayDecision(display.dataset.acDisplayLatest, display.dataset.acDisplayReason);
            for (const element of root.querySelectorAll('[data-ac-reading]')) {
                if (element.closest('[hidden], [inert]')) continue;
                const box = element.getBoundingClientRect();
                if (!box.width || !box.height || getComputedStyle(element).visibility === 'hidden') continue;
                timing.frame(element.dataset.acReading, element.dataset.acSurface,
                    box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth);
            }
        }); });
    };
    const observer = new MutationObserver(scan);
    observer.observe(root.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ac-reading', 'data-ac-display-latest', 'data-ac-display-reason', 'hidden', 'inert'] });
    const visibility = () => { timing.visibilityChanged(); scan(); };
    root.addEventListener('visibilitychange', visibility);
    scan();
    return () => { stopped = true; observer.disconnect(); root.removeEventListener('visibilitychange', visibility); if (first != null) cancel(first); if (second != null) cancel(second); };
}
