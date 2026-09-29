import api from "./axios";

export const getCorteHoy = () => api.get("/corte-caja/hoy").then((r) => r.data);

export const intentarCorte = (monto_declarado) =>
    api.post("/corte-caja/intentar", { monto_declarado }).then((r) => r.data);

export const cerrarCorte = (firma) =>
    api.post("/corte-caja/cerrar", { firma }).then((r) => r.data);

export const cerrarCorteConDiferencia = (nota, firma) =>
    api
        .post("/corte-caja/cerrar-con-diferencia", { nota, firma })
        .then((r) => r.data);

export const getPlazasDelDia = () =>
    api.get("/corte-caja/hoy/plazas").then((r) => r.data);
