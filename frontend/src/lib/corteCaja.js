import api from "./axios";

export const getCorteHoy = () => api.get("/corte-caja/hoy").then((r) => r.data);

export const intentarCorte = (monto_declarado, fecha) =>
    api.post("/corte-caja/intentar", { monto_declarado, fecha }).then((r) => r.data);

export const cerrarCorte = (firma, fecha) =>
    api.post("/corte-caja/cerrar", { firma, fecha }).then((r) => r.data);

export const cerrarCorteConDiferencia = (firma, fecha) =>
    api
        .post("/corte-caja/cerrar-con-diferencia", { firma, fecha })
        .then((r) => r.data);

export const getPlazasDelDia = (fecha) =>
    api.get("/corte-caja/hoy/plazas", { params: { fecha } }).then((r) => r.data);
