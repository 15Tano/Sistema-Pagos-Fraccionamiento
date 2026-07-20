import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
});

// Interceptor de REQUEST — inyecta el token en cada llamada automáticamente
api.interceptors.request.use((config) => {
    const stored = localStorage.getItem("auth-storage");
    const token = stored ? JSON.parse(stored)?.state?.token : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor de RESPONSE — manejo centralizado de errores
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const rutasPublicas = ["/capturista/registro-acceso"];
            const esRutaPublica = rutasPublicas.some((r) =>
                window.location.pathname.startsWith(r),
            );
            if (!esRutaPublica) {
                localStorage.removeItem("auth-storage");
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    },
);

export default api;
