import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createMonitorSession } from '../src/pages/ControlAcceso/monitorSession.js';
import { currentResponse, monitorPermissions, monitorSettingsResponse } from '../src/pages/ControlAcceso/model.js';

const AGENT = '00000000-0000-4000-8000-000000000001', STAMP = '2026-10-30T07:00:00Z';
const policy = (allowed = false) => ({ can_view_history: allowed, can_manage_history: false });
const row = (id, door = '1') => ({ id: String(id), source: 'rt', event_code: 0, card_no: '00123', pin: '1', door_id: door,
    door_label: door === '1' ? 'Entrada' : 'Salida', device_time_raw: '', direction: '0', verification: '4',
    captured_ended_utc: STAMP, received_at_utc: STAMP });
const page = (rows, more = false, after = null, current = false) => ({ data: rows, meta: { has_more: more,
    first_id: rows[0]?.id ?? null, last_id: rows.at(-1)?.id ?? after, physical_passage_confirmed: false, ...(current ? { current_only: true } : {}) } });
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
const flush = async () => { await setImmediate(); await setImmediate(); };

function harness(t, options = {}) {
    let allowed = options.allowed ?? false, value, serial = 0, time = 0;
    const calls = [], updates = [], timers = new Map();
    const client = {
        states: async () => ({ data: [{ agent_id: AGENT, device_serial: 'CO2K225060027' }], meta: {
            server_time_utc: STAMP, permissions: options.missingPermissions ? undefined : policy(allowed) } }),
        current: async (params, config) => { calls.push({ kind: 'current', params, config }); return options.current ? options.current(params, config) : page([row('9')], false, null, true); },
        events: async (params, config) => { calls.push({ kind: 'events', params, config }); return options.events ? options.events(params, config) : page([row('8'), row('9')], true); },
    };
    const session = createMonitorSession(client, options.filters || {}, (snapshot) => { value = snapshot; updates.push(snapshot); }, {
        clock: () => time, schedule: (fn, delay) => { const id = ++serial; timers.set(id, { fn, delay }); return id; }, cancel: (id) => timers.delete(id),
    });
    t.after(() => session.close());
    return { session, calls, updates, get value() { return value; },
        allow: (next) => { allowed = next; },
        start: async () => { session.start(); await flush(); },
        refresh: async () => { session.refresh(); await flush(); },
        next: async () => { const [id, timer] = [...timers][0]; timers.delete(id); time += timer.delay; timer.fn(); await flush(); },
    };
}

test('permisos ausentes o valores truthy no conceden acceso', () => {
    assert.deepEqual(monitorPermissions(null), policy());
    assert.deepEqual(monitorPermissions({ can_view_history: 'true', can_manage_history: 1 }), policy());
});

test('sin permiso solo se consulta actual; se reemplazan filas y nunca se cargan anteriores', async (t) => {
    let id = 8;
    const h = harness(t, { current: () => page([row(String(++id), '1'), row(String(++id), '2')], false, null, true) });
    await h.start(); await h.next(); await h.session.older();
    assert.deepEqual(h.calls.map((c) => c.kind), ['current', 'current']);
    assert.deepEqual(h.value.rows.map((r) => r.id), ['12', '11']);
    assert.equal(h.value.olderMore, false);
});

test('no envía filtros históricos ni cursores a la consulta actual', async (t) => {
    const h = harness(t, { missingPermissions: true, filters: { door: '2', card: '00123', source: 'all' } });
    await h.start(); await h.next();
    assert.deepEqual(h.calls[0].params, { agent_id: AGENT, door_id: '2' });
    assert.deepEqual(h.calls[1].params, h.calls[0].params);
    assert.equal(h.value.permissions.can_view_history, false);
});

test('releer un snapshot idéntico conserva la identidad y no reinicia los 8s del display', async (t) => {
    const h = harness(t); await h.start(); const first = h.value.rows[0];
    await h.next(); assert.strictEqual(h.value.rows[0], first);
    await h.next(); assert.strictEqual(h.value.rows[0], first);
});

test('retirar permiso borra el historial cargado y continúa con última lectura', async (t) => {
    const h = harness(t, { allowed: true }); await h.start();
    assert.equal(h.value.rows.length, 2); assert.equal(h.value.olderMore, true);
    h.allow(false); await h.refresh();
    assert.equal(h.value.permissions.can_view_history, false);
    assert.deepEqual(h.value.rows.map((r) => r.id), ['9']);
    assert.ok(h.updates.some((u) => !u.permissions.can_view_history && u.rows.length === 0));
    await h.session.older(); assert.equal(h.calls.at(-1).kind, 'current');
});

test('un 403 específico de historial cambia a actual sin cerrar la sesión de vigilancia', async (t) => {
    let n = 0;
    const h = harness(t, { allowed: true, events: () => {
        if (++n === 1) return page([row('8'), row('9')], true);
        h.allow(false);
        throw Object.assign(new Error(), { response: { status: 403, data: { code: 'history_forbidden' } } });
    } });
    await h.start(); await h.next();
    assert.equal(h.value.permissions.can_view_history, false); assert.deepEqual(h.value.rows, []);
    await h.next(); assert.equal(h.calls.at(-1).kind, 'current'); assert.equal(h.value.error, null);
    assert.equal(h.value.agentId, AGENT);
});

test('respuesta de anteriores que llega tras retirar permiso no repuebla historial', async (t) => {
    const old = deferred();
    const h = harness(t, { allowed: true, events: (p) => p.before_id ? old.promise : page([row('8'), row('9')], true) });
    await h.start(); const pending = h.session.older();
    h.allow(false); await h.refresh(); old.resolve(page([row('7')])); await pending;
    assert.deepEqual(h.value.rows.map((r) => r.id), ['9']);
});

test('volver a permitir historial empieza una consulta nueva sin cursor prestado', async (t) => {
    const h = harness(t); await h.start(); h.allow(true); await h.refresh();
    assert.equal(h.calls.at(-1).kind, 'events'); assert.equal(h.calls.at(-1).params.after_id, undefined);
    assert.equal(h.value.permissions.can_view_history, true);
});

test('401 en actual borra datos y no confunde cierre de sesión con permiso histórico', async (t) => {
    const h = harness(t, { current: () => { throw Object.assign(new Error(), { response: { status: 401 } }); } });
    await h.start(); assert.equal(h.value.error.terminal, true); assert.deepEqual(h.value.rows, []);
    assert.deepEqual(h.value.agents, []);
});

test('actual rechaza páginas históricas, puertas repetidas, fuente histórica y tarjetas vacías', () => {
    for (const value of [page([row('8')]), page([row('8'), row('9')], false, null, true),
        page([{ ...row('9'), source: 'transaction' }], false, null, true),
        page([{ ...row('9'), card_no: '0' }], false, null, true), page([row('9', '3')], false, null, true),
        page([row('7'), row('8', '2'), row('9')], false, null, true)]) assert.throws(() => currentResponse(value), /invalid_response/);
    assert.doesNotThrow(() => currentResponse(page([], false, null, true)));
    assert.doesNotThrow(() => currentResponse(page([row('8'), row('9', '2')], false, null, true)));
});

test('ajuste necesita booleano y revisión válidos, incluidos datos de conflicto', () => {
    assert.deepEqual(monitorSettingsResponse({ data: { history_for_guards: false, revision: 2 } }), { history_for_guards: false, revision: 2 });
    for (const data of [null, { history_for_guards: 'false', revision: 1 }, { history_for_guards: true, revision: 0 },
        { history_for_guards: true, revision: '1' }, { history_for_guards: true, revision: 2147483648 }]) {
        assert.throws(() => monitorSettingsResponse({ data }), /invalid_response/);
    }
});
