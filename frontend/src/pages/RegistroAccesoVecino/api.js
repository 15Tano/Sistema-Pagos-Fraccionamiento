import axios from "axios";

// Instancia de axios SIN interceptores — usa el token temporal del PIN
export const apiPublica = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
});
