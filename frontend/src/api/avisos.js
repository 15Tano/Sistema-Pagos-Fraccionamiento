import api from "../lib/axios";

export const getAvisos = () => api.get("/avisos");

export const createAviso = (data) => {
    const fd = new FormData();
    fd.append("titulo", data.titulo);
    fd.append("descripcion", data.descripcion);
    fd.append("tipo", data.tipo);
    if (data.imagen instanceof File) fd.append("imagen", data.imagen);

    return api.post("/avisos", fd, {
        headers: { "Content-Type": "multipart/form-data" },
    });
};

export const updateAviso = (id, data) => {
    const fd = new FormData();
    fd.append("_method", "PUT"); // method spoofing
    fd.append("titulo", data.titulo);
    fd.append("descripcion", data.descripcion);
    fd.append("tipo", data.tipo);
    if (data.imagen instanceof File) fd.append("imagen", data.imagen);
    if (data.eliminarImagen) fd.append("eliminar_imagen", "1");

    return api.post(`/avisos/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
    });
};

export const deleteAviso = (id) => api.delete(`/avisos/${id}`);
