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
