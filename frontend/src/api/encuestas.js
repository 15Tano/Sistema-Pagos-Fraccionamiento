import api from "../lib/axios";

export const getEncuestaActiva = () => api.get("/encuestas/activa");

export const votarEncuesta = (encuestaId, opcionIndex) =>
    api.post(`/encuestas/${encuestaId}/votar`, { opcion_index: opcionIndex });

// ── Admin ──
export const getEncuestasAdmin = () => api.get("/encuestas");

export const createEncuesta = (data) => api.post("/encuestas", data);

export const toggleEncuesta = (id) => api.patch(`/encuestas/${id}/toggle`);

export const getResultadosEncuesta = (id) =>
    api.get(`/encuestas/${id}/resultados`);
