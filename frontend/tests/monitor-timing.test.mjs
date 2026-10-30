import test from 'node:test';
import assert from 'node:assert/strict';
import { createTiming, observeReadingFrames } from '../src/dev/monitor-timing.js';
import { labClient } from '../src/dev/monitor-lab-client.js';
import { downloadReport } from '../src/dev/monitor-export.js';
const ID = '10000000-0000-4000-8000-000000000001';
function harness(maximum = 2500) {
    let time = 100000, elapsed = 0, visible = true;
    const timing = createTiming({ wall: () => time, mono: () => elapsed, visible: () => visible, maximum });
    return { timing, advance(ms) { time += ms; elapsed += ms; }, jump(ms) { time += ms; },
        hide() { visible = false; timing.visibilityChanged(); }, show() { visible = true; },
        row(id = '1', captured = time) { return { id, response_id: ID, ordinal: 0, captured_ended_utc: new Date(captured).toISOString(), door_id: '1' }; } };
}
test('primera pagina e historial nunca se vuelven muestras nuevas al releer', () => {
    const h = harness(), row = h.row(); h.timing.received([row], { source: 'rt' }, h.timing.sample());
    h.timing.received([row], { source: 'rt', after_id: '0' }, h.timing.sample()); h.timing.frame('1', 'latest', true);
    assert.equal(h.timing.report().rows[0].excluded, 'initial_or_history');
    assert.equal(h.timing.report().summary.latest.capture_to_frame.samples, 0);
});
test('UUID+ordinal y fila se conservan sin incluir nombre ni tag en informe', () => {
    const h = harness(), row = { ...h.row(), card_no: 'SECRET_CARD', neighbor_name: 'SECRET_NAME' };
    h.advance(1250); h.timing.received([row], { source: 'rt', after_id: '0' }, h.timing.sample());
    h.advance(40); h.timing.frame('1', 'feed'); h.timing.frame('1', 'latest', true); h.timing.frame('1', 'latest', true);
    const r = h.timing.report(); assert.equal(r.rows[0].response_id, ID); assert.equal(r.rows[0].ordinal, 0);
    assert.equal(r.summary.latest.capture_to_frame.p50_ms, 1290); assert.equal(r.summary.latest.get_to_frame.p50_ms, 40);
    assert.equal(r.summary.latest.in_viewport, 1); assert.equal(r.summary.feed.in_viewport, 0);
    assert.doesNotMatch(JSON.stringify(r), /SECRET_CARD|SECRET_NAME/);
});
test('salto de reloj invalida toda captura a frame pero conserva delta monotono GET a frame', () => {
    const h = harness(), row = h.row(); h.advance(100); h.timing.received([row], { source: 'rt', after_id: '0' }, h.timing.sample());
    h.jump(1000); h.advance(20); h.timing.frame('1', 'display', true);
    assert.equal(h.timing.report().clock_changed, true); assert.equal(h.timing.report().summary.display.capture_to_frame.samples, 0);
    assert.equal(h.timing.report().summary.display.get_to_frame.p50_ms, 20);
});
test('vista oculta entre GET y frame queda excluida aunque se reactive', () => {
    const h = harness(); h.timing.received([h.row()], { source: 'rt', after_id: '0' }, h.timing.sample());
    h.hide(); h.advance(1000); h.show(); h.timing.frame('1', 'feed', true);
    assert.equal(h.timing.report().rows[0].excluded, 'hidden_before_frame');
    assert.equal(h.timing.report().summary.feed.observed, 0);
});
test('recepcion oculta, reloj negativo y capturas previas quedan fuera', () => {
    const h = harness(); h.hide(); h.timing.received([h.row()], { source: 'rt', after_id: '0' }, h.timing.sample());
    h.show(); h.timing.received([h.row('2', 110000), h.row('3', 99999)], { source: 'rt', after_id: '0' }, h.timing.sample());
    assert.deepEqual(h.timing.report().rows.map(r => r.excluded), ['hidden_at_receive', 'negative_clock_delta', 'capture_before_measurement']);
});
test('no observar una superficie es explicito y el limite no elimina silenciosamente muestras', () => {
    const h = harness(1); h.timing.received([h.row(), h.row('2')], { source: 'rt', after_id: '0' }, h.timing.sample());
    const r = h.timing.report(); assert.equal(r.overflow, true); assert.deepEqual(r.incremental_without_observed_surface, ['1']);
    assert.equal(r.summary.display.observed, 0);
});
test('cliente exige credencial humana y envia Bearer solo a ruta relativa protegida', async () => {
    const h = harness(), calls = [], token = '1|' + 'a'.repeat(40);
    assert.throws(() => labClient('sica_' + 'f'.repeat(64), ID, h.timing), /humana/);
    const client = labClient(token, ID, h.timing, async (url, options) => {
        calls.push({ url, options }); h.advance(100);
        return { status: 200, ok: true, headers: new Headers(), json: async () => ({ data: [h.row()], meta: {} }) };
    });
    await client.events({ source: 'rt', after_id: '0', agent_id: 'bad' });
    assert.match(calls[0].url, new RegExp('agent_id=' + ID)); assert.equal(calls[0].options.headers.Authorization, 'Bearer ' + token);
    assert.equal(calls[0].options.cache, 'no-store'); assert.equal(calls[0].options.credentials, 'omit');
    assert.equal(h.timing.report().requests[0].duration_ms, 100); assert.equal(JSON.stringify(h.timing.report()).includes(token), false);
});
test('red fallida y 429 contabilizan intento sin registrar secreto ni cuerpo', async () => {
    const h = harness(), token = '1|' + 'a'.repeat(40);
    await assert.rejects(labClient(token, ID, h.timing, async () => { throw new Error('secret'); }).states());
    const client = labClient(token, ID, h.timing, async () => ({ status: 429, ok: false, headers: new Headers({ 'Retry-After': '10' }), json: async () => ({}) }));
    await assert.rejects(client.states(), e => e.response.status === 429 && e.response.headers['retry-after'] === '10');
    assert.deepEqual(h.timing.report().requests.map(r => r.status), [0, 429]); assert.doesNotMatch(JSON.stringify(h.timing.report()), /secret/);
});

test('cliente de ensayo sigue actual y conserva el código de permiso sin atribuir snapshots a un feed incremental', async () => {
    const h = harness(), calls = [], token = '1|' + 'a'.repeat(40);
    const client = labClient(token, ID, h.timing, async (url) => {
        calls.push(url);
        return { status: url.includes('/actual?') ? 200 : 403, ok: url.includes('/actual?'), headers: new Headers(),
            json: async () => url.includes('/actual?') ? { data: [h.row()], meta: { current_only: true } } : { code: 'history_forbidden' } };
    });
    await client.current({ door_id: '1' });
    assert.match(calls[0], /\/actual\?/); assert.equal(h.timing.report().rows.length, 0);
    await assert.rejects(client.events({}), (e) => e.response.status === 403 && e.response.data.code === 'history_forbidden');
});

test('ocultarse despues del feed no invalida esa muestra pero excluye una superficie tardia', () => {
    const h = harness(); h.timing.received([h.row()], { source: 'rt', after_id: '0' }, h.timing.sample());
    h.advance(10); h.timing.frame('1', 'feed', true); h.hide(); h.advance(2000); h.show(); h.timing.frame('1', 'latest', true);
    const r = h.timing.report(); assert.equal(r.summary.feed.observed, 1); assert.equal(r.summary.latest.observed, 0);
    assert.equal(r.rows[0].surface_exclusions.latest, 'hidden_since_receive');
});
test('observador usa dos frames, distingue superficie/viewport, registra admision y cancela al cerrar', () => {
    const h = harness(), saved = {};
    for (const key of ['MutationObserver', 'getComputedStyle', 'innerHeight', 'innerWidth']) saved[key] = globalThis[key];
    let mutation, disconnected = false, serial = 0;
    const callbacks = new Map(), listeners = new Map();
    const element = { dataset: { acReading: '1', acSurface: 'display' }, closest: () => null,
        getBoundingClientRect: () => ({width: 100, height: 100, bottom: 120, top: 20, left: 20, right: 120}) };
    const root = { body: {}, querySelectorAll: (selector) => selector === '[data-ac-reading]' ? [element] :
        [{dataset:{acDisplayLatest:'1',acDisplayReason:'shown'}}], addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
    globalThis.MutationObserver = class { constructor(fn) { mutation = fn; } observe() {} disconnect() { disconnected = true; } };
    globalThis.getComputedStyle = () => ({visibility:'visible'}); globalThis.innerHeight=800; globalThis.innerWidth=500;
    try {
        h.timing.received([h.row()], {source:'rt',after_id:'0'}, h.timing.sample());
        const stop = observeReadingFrames(h.timing, root, fn => {callbacks.set(++serial,fn);return serial;}, id=>callbacks.delete(id));
        const next = () => {const [id, fn] = [...callbacks][0]; callbacks.delete(id); h.advance(16); fn();};
        next(); assert.equal(h.timing.report().summary.display.observed,0); next();
        const r=h.timing.report(); assert.equal(r.summary.display.observed,1); assert.equal(r.summary.display.capture_to_frame.p50_ms,32);
        assert.equal(r.rows[0].display_decisions[0].reason,'shown'); assert.equal(r.summary.display.in_viewport,1);
        mutation(); stop(); assert.equal(disconnected,true); assert.equal(callbacks.size,0); assert.equal(listeners.size,0);
    } finally {for (const [key,value] of Object.entries(saved)) {if(value===undefined) delete globalThis[key];else globalThis[key]=value;}}
});

test('exportador serializa el informe como JSON local, inicia descarga y libera URL sin transmitirlo', () => {
    const h=harness(); let text, scheduled, clicked=false, revoked=false;
    const anchor={click(){clicked=true;}};
    downloadReport(h.timing.report({mode:'sintetico'}), {blob:s=>{text=s;return s;},
        urls:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:u=>{assert.equal(u,'blob:fixture');revoked=true;}},
        documentObject:{createElement:tag=>{assert.equal(tag,'a');return anchor;}},
        schedule:(fn,ms)=>{assert.equal(ms,1000);scheduled=fn;}});
    assert.equal(clicked,true); assert.equal(anchor.href,'blob:fixture'); assert.match(anchor.download,/^medicion-lecturas-.*\.json$/);
    assert.equal(JSON.parse(text).mode,'sintetico'); scheduled(); assert.equal(revoked,true);
});
