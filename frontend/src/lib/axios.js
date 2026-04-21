import axios from "axios";

console.log("DEBUG - La URL de la API es:", import.meta.env.VITE_API_URL);

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
            // Token expirado o inválido → limpiar sesión y redirigir
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    },
);

export default api;
