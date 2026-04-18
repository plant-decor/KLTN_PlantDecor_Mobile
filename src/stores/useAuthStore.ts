import { create } from "zustand";
import { User, RegisterRequest, UpdateProfileRequest } from "../types";
import { authService } from "../services/authService";
import { useCartStore } from "./useCartStore";
import { usePlantStore } from "./usePlantStore";
import { useWishlistStore } from "./useWishlistStore";
import { isSupportedAppRole } from "../utils/authFlow";
interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSigningOut: boolean;
  hasCheckedAuth: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string, deviceId?: string) => Promise<User | null>;
  loginWithGoogle: (googleAccessToken: string, deviceId?: string) => Promise<User | null>;
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

export const useAuthStore = create<AuthState>((set, get) => {
  const UNSUPPORTED_ROLE_MESSAGE =
    "Your account role is currently not supported by the app. Please contact support for assistance.";

  authService.setAuthFailureHandler(() => {
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isSigningOut: false,
      hasCheckedAuth: true,
      error: null,
    });
  });

  let signOutInFlight: Promise<void> | null = null;

  const normalizeRole = (role?: string | null): string => {
    if (typeof role !== "string") {
      return "";
    }

    return role.trim().toLowerCase();
  };

  const setGuestAuthState = (error: string | null = null) => {
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      hasCheckedAuth: true,
      error,
    });
  };

  const clearStoredTokensSafely = async () => {
    try {
      await authService.clearSessionTokens();
    } catch {
      // Keep local state transition resilient even if token clear fails.
    }
  };

  const mergeUserWithRoleGuard = (currentUser: User | null, incomingUser: User): User => {
    const currentUserId =
      typeof currentUser?.id === "string" ? currentUser.id.trim() : "";
    const incomingUserId =
      typeof incomingUser?.id === "string" ? incomingUser.id.trim() : "";

    // Ignore stale profile responses that belong to a different account.
    if (
      currentUserId.length > 0 &&
      incomingUserId.length > 0 &&
      currentUserId !== incomingUserId
    ) {
      return currentUser ?? incomingUser;
    }

    const currentRole = normalizeRole(currentUser?.role);
    const incomingRole = normalizeRole(incomingUser.role);

    // Keep non-customer role from token/session if profile payload is empty or falls back to customer.
    const shouldKeepCurrentRole =
      currentRole.length > 0 &&
      (incomingRole.length === 0 ||
        (currentRole !== "customer" && incomingRole === "customer"));

    return {
      ...(currentUser ?? {}),
      ...incomingUser,
      role: shouldKeepCurrentRole
        ? currentUser?.role ?? incomingUser.role
        : incomingUser.role ?? currentUser?.role,
    };
  };

  const clearUserScopedStores = () => {

    try {
      useCartStore.getState().resetState();
    } catch {
      // Keep sign-out transition resilient if dependent store reset fails.
    }

    try {
      useWishlistStore.getState().resetState();
    } catch {
      // Keep sign-out transition resilient if dependent store reset fails.
    }

    try {
      usePlantStore.getState().resetState();
    } catch {
      // Keep sign-out transition resilient if dependent store reset fails.
    }

  };

  const syncProfileInBackground = () => {

    void authService
      .getProfile()
      .then((profile) => {
        set((state) => {
          if (!state.isAuthenticated) {
            return {};
          }

          const stateUserId =
            typeof state.user?.id === "string" ? state.user.id.trim() : "";
          const profileUserId =
            typeof profile?.id === "string" ? profile.id.trim() : "";

          if (
            stateUserId.length > 0 &&
            profileUserId.length > 0 &&
            stateUserId !== profileUserId
          ) {
            return {};
          }

          return { user: mergeUserWithRoleGuard(state.user, profile) };
        });
      })
      .catch(() => {
        // Keep token-decoded user when profile refresh fails.
      });
  };

  const resolveSessionUserForRouting = async (
    tokenUser: User | null
  ): Promise<{ user: User | null; profileResolved: boolean }> => {

    if (normalizeRole(tokenUser?.role).length > 0) {
      return { user: tokenUser, profileResolved: false };
    }

    try {
      const profile = await authService.getProfile();
      return {
        user: mergeUserWithRoleGuard(tokenUser, profile),
        profileResolved: true,
      };
    } catch {
      return { user: tokenUser, profileResolved: false };
    }
  };

  const commitAuthenticatedSession = async (
    tokenUser: User | null,
    options?: { skipProfileSync?: boolean; unsupportedRoleError?: string | null }
  ): Promise<"committed" | "missing-user" | "unsupported-role"> => {

    if (!tokenUser) {
      setGuestAuthState(null);
      return "missing-user";
    }

    if (!isSupportedAppRole(tokenUser.role)) {
      await clearStoredTokensSafely();
      setGuestAuthState(options?.unsupportedRoleError ?? null);
      return "unsupported-role";
    }

    set({
      user: tokenUser,
      isAuthenticated: true,
      isLoading: false,
      hasCheckedAuth: true,
      error: null,
    });

    if (!options?.skipProfileSync) {
      syncProfileInBackground();
    }

    return "committed";
  };

  const runOptimisticSignOut = (
    requestFactory: (tokenSnapshot: {
      accessToken: string | null;
      refreshToken: string | null;
    }) => Promise<void>
  ) => {
    if (signOutInFlight) {
      return signOutInFlight;
    }

    signOutInFlight = (async () => {
      set({ isSigningOut: true, error: null });

      clearUserScopedStores();

      try {
        setGuestAuthState(null);
      } catch {
        authService.notifyAuthFailure();
      }

      let tokenSnapshot: { accessToken: string | null; refreshToken: string | null } = {
        accessToken: null,
        refreshToken: null,
      };

      try {
        tokenSnapshot = await authService.getStoredTokenSnapshot();
      } catch {
        // Continue with best-effort local sign-out.
      }

      try {
        await authService.clearSessionTokens();
      } catch {
        // Continue with best-effort local sign-out.
      }

      try {
        set({ isSigningOut: false });
      } catch {
        authService.notifyAuthFailure();
      }

      try {
        await requestFactory(tokenSnapshot);
      } catch {
        // Ignore sign-out API failures after local state is already cleared.
      }
    })().finally(() => {
      signOutInFlight = null;
    });

    return signOutInFlight;
  };

  return {
    // Initial State
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isSigningOut: false,
    hasCheckedAuth: false,
    error: null,

    // Actions
    login: async (email, password, deviceId = "") => {
      if (get().isSigningOut) {
        throw new Error("You are currently signing out. Please wait a moment before trying to log in again.");
      }

      set({ isLoading: true, error: null });
      try {
        const { user: tokenUser } = await authService.login(email, password, deviceId);

        const resolvedSession = await resolveSessionUserForRouting(tokenUser ?? null);

        const commitResult = await commitAuthenticatedSession(resolvedSession.user, {
          skipProfileSync: resolvedSession.profileResolved,
          unsupportedRoleError: UNSUPPORTED_ROLE_MESSAGE,
        });

        if (commitResult === "unsupported-role") {
          throw new Error(UNSUPPORTED_ROLE_MESSAGE);
        }

        if (commitResult === "missing-user") {
          throw new Error("Your account could not be found. Please contact support for assistance.");
        }

        return resolvedSession.user;
      } catch (error) {
        const message =
          error instanceof Error && "response" in error
            ? (error as { response?: { data?: { message?: string } } }).response
                ?.data?.message
            : error instanceof Error && error.message.trim().length > 0
              ? error.message
              : undefined;
        set({
          error: message ?? "Login failed. Please try again.",
          isLoading: false,
        });
        throw error;
      }
    },

    loginWithGoogle: async (googleAccessToken, deviceId = "") => {
      if (get().isSigningOut) {
        throw new Error("You are currently signing out. Please wait a moment before trying to log in again.");
      }

      set({ isLoading: true, error: null });
      try {
        const { user: tokenUser } = await authService.loginWithGoogle(
          googleAccessToken,
          deviceId
        );

        const resolvedSession = await resolveSessionUserForRouting(tokenUser ?? null);

        const commitResult = await commitAuthenticatedSession(resolvedSession.user, {
          skipProfileSync: resolvedSession.profileResolved,
          unsupportedRoleError: UNSUPPORTED_ROLE_MESSAGE,
        });

        if (commitResult === "unsupported-role") {
          throw new Error(UNSUPPORTED_ROLE_MESSAGE);
        }

        if (commitResult === "missing-user") {
          throw new Error("Your account could not be found. Please contact support for assistance.");
        }

        return resolvedSession.user;
      } catch (error) {
        const message =
          error instanceof Error && "response" in error
            ? (error as { response?: { data?: { message?: string } } }).response
                ?.data?.message
            : error instanceof Error && error.message.trim().length > 0
              ? error.message
              : undefined;
        set({
          error: message ?? "Google login failed. Please try again.",
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
        return { message: "Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản." };
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Đăng ký thất bại. Vui lòng thử lại.";
        set({ error: message, isLoading: false });
        throw error;
      }
    },

    logout: async () => {
      await runOptimisticSignOut((tokenSnapshot) => authService.logout(tokenSnapshot));
    },

    logoutAll: async () => {
      await runOptimisticSignOut((tokenSnapshot) => authService.logoutAll(tokenSnapshot));
    },

    fetchProfile: async () => {
      set({ isLoading: true });
      try {
        const user = await authService.getProfile();
        set((state) => ({
          user: mergeUserWithRoleGuard(state.user, user),
          isLoading: false,
        }));
      } catch (error: any) {
        set({ isLoading: false });
      }
    },

    updateProfile: async (data) => {
      set({ isLoading: true, error: null });
      try {
        const user = await authService.updateProfile(data);
        set((state) => ({
          user: mergeUserWithRoleGuard(state.user, user),
          isLoading: false,
        }));
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Cập nhật thông tin thất bại. Vui lòng thử lại.";
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
      if (get().isSigningOut) {
        return;
      }

      set({ isLoading: true });
      try {
        const tokenUser = await authService.getUserFromStoredToken();

        if (tokenUser) {
          const resolvedSession = await resolveSessionUserForRouting(tokenUser);
          const commitResult = await commitAuthenticatedSession(resolvedSession.user, {
            skipProfileSync: resolvedSession.profileResolved,
            unsupportedRoleError: null,
          });

          if (commitResult !== "committed") {
            return;
          }

          return;
        }

        // Try silent refresh for auto-login when only refresh token is available.
        const { user } = await authService.refreshToken();
        const resolvedSession = await resolveSessionUserForRouting(user ?? null);
        const commitResult = await commitAuthenticatedSession(resolvedSession.user, {
          skipProfileSync: resolvedSession.profileResolved,
          unsupportedRoleError: null,
        });

        if (commitResult !== "committed") {
          return;
        }
      } catch {
        setGuestAuthState(null);
      }
    },

    clearError: () => set({ error: null }),

    setUser: (user) => set({ user }),
  };
});
