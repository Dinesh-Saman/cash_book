import { create } from 'zustand';
import { User } from '../types';
import { authApi } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  checkAuth: () => Promise<void>;
}

const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  token: localStorage.getItem('token'),
  isLoading: false,
  login: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },
  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      localStorage.removeItem('user');
      set({ user: null, token: null });
      return;
    }
    try {
      const res = await authApi.me();
      if (res.data.success && res.data.data) {
        const u = res.data.data;
        localStorage.setItem('user', JSON.stringify(u));
        set({ user: u });
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null, token: null });
      }
    }
  },
}));
