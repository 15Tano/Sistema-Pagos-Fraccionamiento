export function labClient(token, agentId, timing, fetcher = fetch) {
    if (!/^\d+\|[A-Za-z0-9]{40,128}$/.test(token)) throw new Error('Use la credencial humana de ensayo, no la del agente.');
    const read = async (kind, params, { signal } = {}) => {
        const start = timing.sample(), timeout = new AbortController();
        let status = 0;
        const abort = () => timeout.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const timer = setTimeout(abort, 15000);
        try {
            const response = await fetcher('/api/control-acceso/monitor/' + kind + '?' + new URLSearchParams({ ...params, agent_id: agentId }), {
                signal: timeout.signal, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, cache: 'no-store', credentials: 'omit',
            });
            status = response.status;
            const body = await response.json(), end = timing.sample();
            if (!response.ok) throw Object.assign(new Error('HTTP'), { response: { status: response.status, data: body, headers: { 'retry-after': response.headers.get('Retry-After') } } });
            if (kind === 'eventos' && Array.isArray(body.data)) timing.received(body.data, params, end);
            return body;
        } catch (error) { if (error.name !== 'AbortError') timing.error(kind + '_failed'); throw error; }
        finally { const end = timing.sample(); timing.request(kind, end, status, end.mono - start.mono); clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    };
    // Cliente de ensayo de solo lectura; los snapshots actuales no se cuentan como páginas incrementales.
    return { states: (options) => read('estado', {}, options), events: (params, options) => read('eventos', params, options),
        current: (params, options) => read('actual', params, options) };
}
