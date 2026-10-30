// Descarga local exclusiva del laboratorio. No sube datos a otro servicio.
export function downloadReport(report, { urls = URL, documentObject = document, schedule = setTimeout, blob = (text) => new Blob([text], { type: 'application/json' }) } = {}) {
    const url = urls.createObjectURL(blob(JSON.stringify(report, null, 2)));
    const link = documentObject.createElement('a'); link.href = url;
    link.download = 'medicion-lecturas-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    try { link.click(); } finally { schedule(() => urls.revokeObjectURL(url), 1000); }
}
