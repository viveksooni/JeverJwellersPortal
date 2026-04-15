import { create } from 'zustand';
import type { User } from '@jever/shared';
import { setAccessToken } from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setAuth: (user, token) => {
    setAccessToken(token);
    set({ user, isAuthenticated: true });
  },
  clearAuth: () => {
    setAccessToken(null);
    set({ user: null, isAuthenticated: false });
  },
}));
