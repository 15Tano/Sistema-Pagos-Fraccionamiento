import { create } from "zustand";
import { persist } from "zustand/middleware";

const useAuthStore = create(
    persist(
        (set) => ({
            token: null,
            user: null,
            isAuthenticated: false,

            setAuth: (token, user) =>
                set({ token, user, isAuthenticated: true }),

            logout: () =>
                set({ token: null, user: null, isAuthenticated: false }),
        }),
        {
            name: "auth-storage", // clave en localStorage
        },
    ),
);

export default useAuthStore;
