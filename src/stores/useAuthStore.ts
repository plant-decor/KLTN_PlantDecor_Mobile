import { create } from "zustand";
import { User, RegisterRequest } from "../types";
import { authService } from "../services/authService";

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string, deviceId?: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  authService.setAuthFailureHandler(() => {
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
  });

  return {
    // Initial State
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    // Actions
    login: async (email, password, deviceId = "") => {
      set({ isLoading: true, error: null });
      try {
        const { user } = await authService.login(email, password, deviceId);

        // Immediately apply whatever identity we have (token-bootstrap or full profile).
        set({ user: user ?? null, isAuthenticated: true, isLoading: false });

        // Always sync with the server-authoritative profile without blocking login UX.
        void authService
          .getProfile()
          .then((profile) => set({ user: profile }))
          .catch(() => {
            // Keep token-based bootstrap user on transient profile fetch errors.
          });
      } catch (error) {
        const message =
          error instanceof Error && "response" in error
            ? (error as { response?: { data?: { message?: string } } }).response
                ?.data?.message
            : undefined;
        set({
          error: message ?? "Đăng nhập thất bại. Vui lòng thử lại.",
          isLoading: false,
        });
        throw error;
      }
    },

    register: async (data) => {
      set({ isLoading: true, error: null });
      try {
        const { user } = await authService.register(data);
        // Registration doesn't authenticate - user must verify email first
        set({ user, isAuthenticated: false, isLoading: false });
        return { message: "Đăng ký thành công. Vui lòng xác nhận email của bạn." };
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Đăng ký thất bại. Vui lòng thử lại.";
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
          error.response?.data?.message || "Cập nhật thất bại. Vui lòng thử lại.";
        set({ error: message, isLoading: false });
        throw error;
      }
    },

    checkAuth: async () => {
      set({ isLoading: true });
      try {
        const isAuth = await authService.checkAuthStatus();
        if (isAuth) {
          const tokenUser = await authService.getUserFromStoredToken();

          set({ user: tokenUser, isAuthenticated: true, isLoading: false });

          // Refresh profile in background to get the latest server state.
          void authService
            .getProfile()
            .then((profile) => {
              set({ user: profile });
            })
            .catch(() => {
              // Keep token-based user when profile refresh fails.
            });
        } else {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    clearError: () => set({ error: null }),

    setUser: (user) => set({ user }),
  };
});
