import api from "../lib/axios";

export const getAvisos = () => api.get("/avisos");
export const createAviso = (data) => api.post("/avisos", data);
export const updateAviso = (id, data) => api.put(`/avisos/${id}`, data);
export const deleteAviso = (id) => api.delete(`/avisos/${id}`);
