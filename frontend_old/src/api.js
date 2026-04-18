import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api";

const api = axios.create({
    baseURL: "http://127.0.0.1:8000/api", // Laravel API
});

export default api;
