import { create } from 'zustand';

interface AuthState {
    isAuthenticated: boolean;
    user: any | null;
    login: (token: string, refresh: string, userData?: any) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    isAuthenticated: !!localStorage.getItem('access_token'),
    user: null,
    login: (token, refresh, userData) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('refresh_token', refresh);
        set({ isAuthenticated: true, user: userData });
    },
    logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ isAuthenticated: false, user: null });
    },
}));
