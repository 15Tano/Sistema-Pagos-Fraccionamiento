import api from "../lib/axios";

export const login = async (email, password) => {
    const response = await api.post("/login", { email, password });
    const { token, user } = response.data;

    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));

    return { token, user };
};

export const logout = async () => {
    try {
        await api.post("/logout");
    } finally {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
    }
};

export const getUser = () => {
    const user = localStorage.getItem("auth_user");
    return user ? JSON.parse(user) : null;
};

export const isAuthenticated = () => {
    return !!localStorage.getItem("auth_token");
};
