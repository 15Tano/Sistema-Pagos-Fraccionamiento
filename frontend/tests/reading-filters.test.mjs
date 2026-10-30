import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_READING_FILTERS, hasReadingFilters, mexicoToday, readingHistoryParams } from '../src/pages/ControlAcceso/readingFilters.js';

test('consulta explicita por nombre, fechas y resultado conserva tag textual y no agrega cursores', () => {
    const filters = { ...EMPTY_READING_FILTERS, search: '00123', from: '2026-10-29', to: '2026-10-30', door: '2', result: 'repeated' };
    assert.deepEqual(readingHistoryParams('agent', filters), { agent_id: 'agent', source: 'rt', limit: 50, q: '00123', date_from: '2026-10-29', date_to: '2026-10-30', door_id: '2', result: 'repeated' });
    assert.equal(hasReadingFilters(filters), true);
    assert.equal(readingHistoryParams('agent', { ...filters, search: 'Ana López' }).q, 'Ana López');
});
test('cada filtro activa historico y limpiar retorna a seguimiento sin parametros vacios', () => {
    assert.equal(hasReadingFilters(EMPTY_READING_FILTERS), false);
    for (const patch of [{ search: 'Ana' }, { from: '2026-10-29' }, { to: '2026-10-29' }, { door: '1' }, { result: 'review' }, { source: 'all' }]) assert.equal(hasReadingFilters({ ...EMPTY_READING_FILTERS, ...patch }), true);
    assert.deepEqual(readingHistoryParams('agent', EMPTY_READING_FILTERS), { agent_id: 'agent', source: 'rt', limit: 50 });
});
test('Hoy usa Ciudad de Mexico aun antes de medianoche UTC sin mutar fecha', () => {
    const instant = new Date('2026-10-30T03:00:00Z');
    assert.equal(mexicoToday(instant), '2026-10-29');
    assert.equal(instant.toISOString(), '2026-10-30T03:00:00.000Z');
});
