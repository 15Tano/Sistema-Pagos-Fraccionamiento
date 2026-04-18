import api from "../lib/axios";

export const getDashboardStats = () => api.get("/dashboard/stats");
