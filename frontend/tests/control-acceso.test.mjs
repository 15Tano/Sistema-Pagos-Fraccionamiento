import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createMonitorSession } from '../src/pages/ControlAcceso/monitorSession.js';
import { mergeRows, rowId, eventsResponse, reporting, cycleLabel, deviceText, utcText, neighborText, eventPresentation, displayReading, displayDoor } from '../src/pages/ControlAcceso/model.js';

const AGENT = '00000000-0000-4000-8000-000000000001';
const STAMP = '2026-10-26T18:30:00Z';
const NOW = Date.parse(STAMP);
const agent = () => ({ agent_id: AGENT, reporting_status: 'reciente', received_at_utc: STAMP, reported_at_utc: STAMP,
    vigencias_status: 'correcto', vigencias: { last_ok_utc: STAMP, heartbeat_utc: STAMP } });
const states = () => ({ data: [agent()], meta: { server_time_utc: STAMP, truncated: false } });
const row = (id) => ({ id: String(id), source: 'rt', event_code: 0, card_no: '0012230693', pin: '693', door_id: '1',
    door_label: 'Entrada', device_time_raw: '2026-10-26 12:29:59', direction: '0', verification: '4',
    captured_ended_utc: STAMP, received_at_utc: STAMP });
const page = (ids = [], more = false, after = null) => ({ data: ids.map(row), meta: {
    first_id: ids.length ? String(ids[0]) : null, last_id: ids.length ? String(ids.at(-1)) : after,
    has_more: more, physical_passage_confirmed: false } });
const failure = (status, headers = {}) => Object.assign(new Error('HTTP'), { response: { status, headers } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { await setImmediate(); await setImmediate(); };

function harness(t, events, filters = {}, stateReader = states, runtime = {}) {
    let value, time = 0, serial = 0;
    const timers = new Map(), calls = [], updates = [];
    const session = createMonitorSession({ states: stateReader, events: async (params, config) => {
        calls.push({ params: { ...params }, signal: config.signal }); return events(params, config);
    } }, filters, (model) => { value = model; updates.push(model); }, {
        clock: () => time,
        schedule: (fn, delay) => { const id = ++serial; timers.set(id, { fn, delay }); return id; },
        cancel: (id) => timers.delete(id),
        ...runtime,
    });
    t.after(() => session.close());
    return { session, calls, updates, timers, get value() { return value; },
        async start() { session.start(); await settle(); },
        async next() { const [id, timer] = [...timers][0] ?? []; assert.ok(timer, 'se programó siguiente consulta'); timers.delete(id); time += timer.delay; timer.fn(); await settle(); },
    };
}

test('IDs mayores que 2^53 y eventos idénticos conservan identidad y orden', () => {
    assert.equal(rowId('9223372036854775807'), true);
    for (const id of [9007199254740993, '01', '-1', '9223372036854775808']) assert.equal(rowId(id), false);
    const result = mergeRows([row('9007199254740992')], [row('9007199254740993'), row('9007199254740992')]);
    assert.deepEqual(result.map((r) => r.id), ['9007199254740993', '9007199254740992']);
    assert.equal(result[0].card_no, '0012230693');
});

test('contrato rechaza orden, límites de cursor y respuestas ambiguas', () => {
    assert.throws(() => eventsResponse(page(['2', '1']), null), /invalid_response/);
    assert.throws(() => eventsResponse(page(['2']), '2'), /invalid_response/);
    assert.throws(() => eventsResponse(page(['3']), null, '3'), /invalid_response/);
    assert.throws(() => eventsResponse(page([], true), null), /invalid_response/);
    const bad = page(['1']); bad.meta.last_id = '2'; assert.throws(() => eventsResponse(bad, null), /invalid_response/);
    assert.doesNotThrow(() => eventsResponse(page([], false, '9007199254740993'), '9007199254740993'));
});

test('frescura caduca sin nuevas consultas y RT reciente no renueva vigencias antiguas', () => {
    assert.equal(reporting(agent(), NOW)[1], 'good');
    assert.equal(cycleLabel(agent(), NOW), 'Al día');
    assert.equal(reporting(agent(), NOW + 90001)[1], 'warning');
    assert.equal(cycleLabel(agent(), NOW + 90001), 'Sin confirmar');
    const old = agent(); old.vigencias.last_ok_utc = '2026-10-26T18:20:00Z';
    assert.equal(cycleLabel(old, NOW), 'Sin confirmar');
    old.vigencias.last_ok_utc = null;
    assert.equal(cycleLabel(old, NOW), 'Sin confirmar');
    old.received_at_utc = null; assert.notEqual(reporting(old, NOW)[1], 'good');
    const future = agent(); future.reported_at_utc = '2026-10-26T18:31:00Z';
    assert.equal(reporting(future, NOW)[0], 'Reloj por revisar');
});

test('hora C3 cruda no se interpreta como UTC; UTC requiere zona explícita', () => {
    assert.equal(deviceText('2026-10-26 12:29:59'), '2026-10-26 12:29:59');
    assert.equal(utcText('2026-10-26 12:29:59'), 'Sin dato');
    assert.match(utcText('2026-10-26T18:29:59Z'), /12:29:59/);
});

test('carga inicial muestra últimos eventos; has_more inicial es historial', async (t) => {
    const h = harness(t, () => page(['8', '9'], true)); await h.start();
    assert.deepEqual(h.value.rows.map((r) => r.id), ['9', '8']);
    assert.equal(h.calls.length, 1); assert.equal(h.value.olderMore, true); assert.equal(h.value.catchingUp, false);
});

test('incremental drena dos páginas por tanda sin saltarse registros ni mover el cursor por historial', async (t) => {
    const h = harness(t, (p) => p.before_id ? page(['7']) : !p.after_id ? page(['8', '9'], true) :
        p.after_id === '9' ? page(['10', '11'], true) : p.after_id === '11' ? page(['12'], true) : page(['13']));
    await h.start(); await h.session.older();
    assert.equal(h.calls.at(-1).params.before_id, '8');
    await h.next(); assert.deepEqual(h.calls.slice(-2).map((c) => c.params.after_id), ['9', '11']);
    assert.equal(h.value.catchingUp, true); await h.next();
    assert.equal(h.calls.at(-1).params.after_id, '12'); assert.equal(h.value.catchingUp, false);
    assert.deepEqual(h.value.rows.map((r) => r.id), ['13', '12', '11', '10', '9', '8', '7']);
});

test('página vacía preserva cursor exacto y no borra lecturas', async (t) => {
    const h = harness(t, (p) => !p.after_id ? page(['9007199254740993']) : page([], false, p.after_id));
    await h.start(); await h.next(); await h.next();
    assert.equal(h.calls.at(-1).params.after_id, '9007199254740993'); assert.equal(h.value.rows.length, 1);
});

test('límite visual de 400 no altera cursor de seguimiento', async (t) => {
    let current = 0;
    const h = harness(t, (p) => { const ids = Array.from({ length: 50 }, () => String(++current)); return page(ids, Boolean(p.after_id)); });
    await h.start(); for (let i = 0; i < 5; i++) await h.next();
    assert.equal(h.value.rows.length, 400); const latest = h.value.rows[0].id;
    await h.next(); assert.equal(h.calls.at(-2).params.after_id, latest);
});

test('pausa cancela petición y reanuda mismo cursor; pestaña oculta suspende consultas', async (t) => {
    const pending = deferred(); let count = 0;
    const h = harness(t, (p, { signal }) => {
        if (++count === 2) { signal.addEventListener('abort', () => pending.reject(Object.assign(new Error(), { name: 'AbortError' }))); return pending.promise; }
        return p.after_id ? page([], false, p.after_id) : page(['9']);
    });
    await h.start(); await h.next(); h.session.setEnabled(false); await settle();
    assert.equal(h.calls[1].signal.aborted, true); assert.equal(h.timers.size, 0);
    h.session.setEnabled(true); await settle(); assert.equal(h.calls.at(-1).params.after_id, '9');
    h.session.setVisible(false); assert.equal(h.timers.size, 0);
    h.session.setVisible(true); await settle(); assert.equal(h.calls.at(-1).params.after_id, '9');
});

test('cerrar una selección descarta respuestas tardías aunque cliente ignore abort', async (t) => {
    const pending = deferred(); const h = harness(t, () => pending.promise, { door: '1', card: '00123' });
    await h.start(); const before = h.updates.length; h.session.close(); pending.resolve(page(['9'])); await settle();
    assert.equal(h.updates.length, before); assert.equal(h.calls[0].signal.aborted, true);
    assert.equal(h.calls[0].params.door_id, '1'); assert.equal(h.calls[0].params.card_no, '00123');
    const newSelection = harness(t, () => page(['10']), { door: '2' }); await newSelection.start();
    assert.deepEqual(newSelection.value.rows.map((r) => r.id), ['10']); assert.equal(newSelection.calls[0].params.after_id, undefined);
});

for (const status of [401, 403]) test(`${status} borra datos y detiene consultas, incluido historial tardío`, async (t) => {
    const older = deferred(); const h = harness(t, (p) => p.before_id ? older.promise : p.after_id ? Promise.reject(failure(status)) : page(['8', '9'], true));
    await h.start(); const oldRequest = h.session.older(); await h.next(); older.resolve(page(['7'])); await oldRequest;
    assert.deepEqual(h.value.rows, []); assert.deepEqual(h.value.agents, []); assert.equal(h.timers.size, 0);
});

test('404 deshabilitado es terminal hasta reintento explícito', async (t) => {
    let count = 0; const h = harness(t, () => page(['1']), {}, () => ++count === 1 ? Promise.reject(failure(404)) : states());
    await h.start(); assert.equal(h.timers.size, 0); assert.equal(h.value.error.terminal, true);
    h.session.refresh(); await settle(); assert.equal(h.value.error, null); assert.equal(h.value.rows.length, 1);
});

test('red y 429 retienen lecturas y respetan espera antes de reintentar', async (t) => {
    let count = 0; const h = harness(t, (p) => ++count === 1 ? page(['9']) : count === 2 ? Promise.reject(new Error('network')) :
        count === 3 ? Promise.reject(failure(429, { 'retry-after': '60' })) : page([], false, p.after_id));
    await h.start(); await h.next(); assert.equal(h.value.rows.length, 1); assert.equal([...h.timers.values()][0].delay, 6000);
    await h.next(); assert.equal([...h.timers.values()][0].delay, 60000); assert.equal(h.value.rows.length, 1);
    await h.next(); assert.equal(h.value.error, null); assert.equal(h.calls.at(-1).params.after_id, '9');
});

test('una respuesta inválida no adelanta cursor ni crea reintentos ilimitados', async (t) => {
    let count = 0; const h = harness(t, () => ++count === 1 ? page(['9']) : page(['8']));
    await h.start(); await h.next(); assert.equal(h.value.error.terminal, true); assert.equal(h.timers.size, 0);
    assert.deepEqual(h.value.rows.map((r) => r.id), ['9']);
    h.session.refresh(); await settle(); assert.equal(h.calls.at(-1).params.after_id, '9');
});

test('nombre completo, ausencia y asociaciones múltiples; campos viejos no inventan asociación', () => {
    assert.equal(neighborText({ neighbor_status: 'single', neighbor_name: 'María Fernanda López Morales' }), 'María Fernanda López Morales');
    assert.equal(neighborText({ neighbor_status: 'none' }), 'Sin vecino asociado');
    assert.equal(neighborText({ neighbor_status: 'multiple', neighbor_name: 'No mostrar' }), 'Verificar asociación');
    assert.equal(neighborText({}), 'Nombre no disponible');
    const invalid = page(['1']); invalid.data[0].neighbor_name = { value: 'invalid' };
    assert.throws(() => eventsResponse(invalid, null), /invalid_response/);
});

test('clasificación contrastada: 20 es repetición, nunca vencimiento ni rechazo genérico', () => {
    assert.equal(eventPresentation(0).title, 'Acceso autorizado');
    assert.equal(eventPresentation(20).title, 'Lectura repetida');
    assert.equal(eventPresentation(20).tone, 'warning');
    assert.equal(eventPresentation(99).title, 'Consulte a vigilancia');
    assert.equal(eventPresentation(null).tone, 'review');
});

test('display admite solo lectura RT fresca de la pluma fijada y con seguimiento listo', () => {
    const candidate = row('1'); const options = { door: '1', ready: true };
    assert.equal(displayReading(candidate, NOW + 3000, options), candidate);
    assert.equal(displayReading(candidate, NOW + 8000, options), null);
    assert.equal(displayReading(candidate, NOW, { ...options, door: '2' }), null);
    assert.equal(displayReading(candidate, NOW, { ...options, ready: false }), null);
    assert.equal(displayReading(candidate, NOW, { ...options, catchingUp: true }), null);
    assert.equal(displayReading({ ...candidate, source: 'transaction' }, NOW, options), null);
    assert.equal(displayReading({ ...candidate, card_no: '0' }, NOW, options), null);
    assert.equal(displayReading({ ...candidate, captured_ended_utc: null }, NOW, options), null);
    assert.equal(displayReading(candidate, NOW - 5000, options), null);
    assert.equal(displayReading(null, NOW, options), null);
});

test('un lote atrasado no se vuelve lectura nueva por recibirse ahora', () => {
    const backlog = { ...row('1'), captured_ended_utc: '2026-10-26T18:00:00Z', received_at_utc: STAMP };
    assert.equal(displayReading(backlog, NOW, { door: '1', ready: true }), null);
    assert.equal(displayDoor('entrada'), '1'); assert.equal(displayDoor('salida'), '2'); assert.equal(displayDoor('all'), '');
});

test('el controlador físico conocido se elige sin selector ni depender del orden de agentes de ensayo', async (t) => {
    const physical = { ...agent(), device_serial: 'CO2K225060027' };
    const h = harness(t, () => page(['1']), {}, () => ({ data: [{ ...agent(), agent_id: '00000000-0000-4000-8000-000000000099', device_serial: 'TEST-C3-001' }, physical], meta: { server_time_utc: STAMP } }));
    await h.start(); assert.equal(h.calls[0].params.agent_id, AGENT);
});

test('cada display limita drenaje a una página por tanda conservando su cursor', async (t) => {
    const h = harness(t, (p) => !p.after_id ? page(['9']) : p.after_id === '9' ? page(['10'], true) : page(['11']), { door: '2' }, states, { maxPages: 1 });
    await h.start(); await h.next(); assert.equal(h.calls.length, 2); assert.equal(h.value.catchingUp, true);
    await h.next(); assert.equal(h.calls.at(-1).params.after_id, '10'); assert.equal(h.calls.at(-1).params.door_id, '2');
});

test('un refresco en espera no salta Retry-After del servidor', async (t) => {
    const pending = deferred(); let calls = 0;
    const h = harness(t, () => ++calls === 1 ? page(['9']) : pending.promise);
    await h.start(); await h.next(); h.session.refresh();
    pending.reject(failure(429, { 'retry-after': '60' })); await settle();
    assert.equal([...h.timers.values()][0].delay, 60000);
});
