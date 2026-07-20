import api from "../lib/axios";

export const login = async (email, password) => {
    const response = await api.post("/login", { email, password });
    const { token, user } = response.data;
    return { token, user };
};

export const logout = async () => {
    await api.post("/logout");
};
