import { create } from 'zustand';
import { User } from '../types';
import { authService } from '../services/authService';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Initial State
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Actions
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await authService.login(email, password);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      const message =
        error.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await authService.register(data);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      const message =
        error.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const user = await authService.getProfile();
      set({ user, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.updateProfile(data);
      set({ user, isLoading: false });
    } catch (error: any) {
      const message =
        error.response?.data?.message || 'Cập nhật thất bại. Vui lòng thử lại.';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const isAuth = await authService.checkAuthStatus();
      if (isAuth) {
        const user = await authService.getProfile();
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user) => set({ user }),
}));
