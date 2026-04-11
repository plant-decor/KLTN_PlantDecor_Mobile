import { create } from "zustand";
import { User, RegisterRequest, UpdateProfileRequest } from "../types";
import { authService } from "../services/authService";

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCheckedAuth: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string, deviceId?: string) => Promise<User | null>;
  register: (data: RegisterRequest) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  changeAvatar: (uri: string, fileName?: string, mimeType?: string) => Promise<string>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  authService.setAuthFailureHandler(() => {
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      hasCheckedAuth: true,
      error: null,
    });
  });

  return {
    // Initial State
    user: null,
    isAuthenticated: false,
    isLoading: false,
    hasCheckedAuth: false,
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

        return user ?? null;
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

    logoutAll: async () => {
      set({ isLoading: true });
      try {
        await authService.logoutAll();
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

    changeAvatar: async (uri, fileName, mimeType) => {
      set({ error: null });
      try {
        const avatarURL = await authService.changeAvatar({
          uri,
          fileName,
          mimeType,
        });

        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                avatar: avatarURL,
              }
            : state.user,
        }));

        return avatarURL;
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          'Cập nhật ảnh đại diện thất bại. Vui lòng thử lại.';
        set({ error: message });
        throw error;
      }
    },

    checkAuth: async () => {
      set({ isLoading: true });
      try {
        const tokenUser = await authService.getUserFromStoredToken();

        if (tokenUser) {
          set({
            user: tokenUser,
            isAuthenticated: true,
            isLoading: false,
            hasCheckedAuth: true,
            error: null,
          });

          // Refresh profile in background to get the latest server state.
          void authService
            .getProfile()
            .then((profile) => {
              set({ user: profile });
            })
            .catch(() => {
              // Keep token-based user when profile refresh fails.
            });
          return;
        }

        // Try silent refresh for auto-login when only refresh token is available.
        const { user } = await authService.refreshToken();
        set({
          user: user ?? null,
          isAuthenticated: true,
          isLoading: false,
          hasCheckedAuth: true,
          error: null,
        });

        void authService
          .getProfile()
          .then((profile) => {
            set({ user: profile });
          })
          .catch(() => {
            // Keep token-based user when profile refresh fails.
          });
      } catch {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          hasCheckedAuth: true,
          error: null,
        });
      }
    },

    clearError: () => set({ error: null }),

    setUser: (user) => set({ user }),
  };
});
