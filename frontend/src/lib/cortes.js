import api from "./axios";

export const listarCortes = (params) =>
    api.get("/corte-caja", { params }).then((r) => r.data);

export const getCorte = (uuid) =>
    api.get(`/corte-caja/${uuid}`).then((r) => r.data);

export const reabrirCorte = (uuid) =>
    api.post(`/corte-caja/${uuid}/reabrir`).then((r) => r.data);
