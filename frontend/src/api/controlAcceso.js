import api from "../lib/axios";

export const monitorClient = {
    states: ({ signal }) => api.get("/control-acceso/monitor/estado", { signal, timeout: 15000 }).then((r) => r.data),
    events: (params, { signal }) => api.get("/control-acceso/monitor/eventos", { params, signal, timeout: 15000 }).then((r) => r.data),
};
