import api from "../lib/axios";

export const monitorClient = {
    states: ({ signal }) => api.get("/control-acceso/monitor/estado", { signal, timeout: 15000 }).then((r) => r.data),
    events: (params, { signal }) => api.get("/control-acceso/monitor/eventos", { params, signal, timeout: 15000 }).then((r) => r.data),
    current: (params, { signal }) => api.get("/control-acceso/monitor/actual", { params, signal, timeout: 15000 }).then((r) => r.data),
    settings: ({ signal }) => api.get("/control-acceso/monitor/configuracion", { signal, timeout: 15000 }).then((r) => r.data),
    updateSettings: (data, { signal }) => api.patch("/control-acceso/monitor/configuracion", data, { signal, timeout: 15000 }).then((r) => r.data),
};
