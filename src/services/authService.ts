import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { jwtDecode } from 'jwt-decode';
import { Platform } from 'react-native';
import { API, APP_CONFIG } from '../constants';
import {
  ApiResponse,
  AuthJwtClaims,
  AuthTokens,
  LogoutAllRequest,
  LogoutAllResponse,
  User,
  UserGender,
  UpdateProfileRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  SendOTPRequest,
  SendOTPResponse,
  SendPasswordResetOTPRequest,
  SendPasswordResetOTPResponse,
  VerifyOTPRequest,
  VerifyOTPResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '../types';
import api from './api';
import {
  clearStoredTokens,
  notifyAuthFailure,
  refreshAccessToken,
  setAuthFailureHandler,
} from './authSession';

const EMPTY_DATE = new Date(0).toISOString();

const getEnvelopeData = <T>(response: ApiResponse<T>): T => {
  const body = response.data ?? response.payload;
  if (!body) {
    throw new Error('Invalid API response: missing data/payload');
  }
  return body;
};

const normalizeBirthYear = (rawBirthYear: unknown): number | undefined => {
  if (typeof rawBirthYear === 'number' && Number.isInteger(rawBirthYear)) {
    return rawBirthYear;
  }

  if (typeof rawBirthYear === 'string' && rawBirthYear.trim().length > 0) {
    const parsed = Number(rawBirthYear);
    return Number.isInteger(parsed) ? parsed : undefined;
  }

  return undefined;
};

const normalizeGender = (
  rawGender: unknown
): { gender?: UserGender; genderCode?: number } => {
  if (typeof rawGender === 'number' && Number.isInteger(rawGender)) {
    return {
      genderCode: rawGender,
    };
  }

  if (typeof rawGender === 'string') {
    const trimmed = rawGender.trim();
    if (trimmed.length === 0) {
      return {};
    }

    const parsed = Number(trimmed);
    if (Number.isInteger(parsed)) {
      return {
        genderCode: parsed,
      };
    }

    return {
      gender: trimmed,
    };
  }

  return {};
};

const normalizeUser = (rawUser: any): User => {
  const normalizedGender = normalizeGender(rawUser?.gender);
  const normalizedReceiveNotifications =
    typeof rawUser?.receiveNotifications === 'boolean'
      ? rawUser.receiveNotifications
      : typeof rawUser?.receiveNotification === 'boolean'
        ? rawUser.receiveNotification
        : undefined;

  return {
    id: String(rawUser?.id ?? rawUser?.sub ?? ''),
    email: rawUser?.email ?? '',
    username: rawUser?.username ?? rawUser?.userName ?? undefined,
    fullName: rawUser?.fullName ?? rawUser?.username ?? rawUser?.name ?? '',
    phone: rawUser?.phone ?? rawUser?.phoneNumber ?? undefined,
    avatar: rawUser?.avatar ?? rawUser?.avatarUrl ?? rawUser?.avatarURL ?? undefined,
    address:
      typeof rawUser?.address === 'string'
        ? rawUser.address
        : rawUser?.address?.fullAddress ?? undefined,
    birthYear: normalizeBirthYear(rawUser?.birthYear),
    gender: normalizedGender.gender,
    genderCode: normalizedGender.genderCode,
    receiveNotifications: normalizedReceiveNotifications,
    receiveNotification: normalizedReceiveNotifications,
    profileCompleteness:
      typeof rawUser?.profileCompleteness === 'number'
        ? rawUser.profileCompleteness
        : undefined,
    createdAt: rawUser?.createdAt ?? EMPTY_DATE,
    updatedAt: rawUser?.updatedAt,
    status: rawUser?.status,
    isVerified: rawUser?.isVerified,
    role: rawUser?.role ?? rawUser?.Role,
  };
};

const buildUserFromToken = (accessToken: string): User | null => {
  try {
    const claims = jwtDecode<AuthJwtClaims>(accessToken);

    // Force refresh flow when the access token has expired.
    if (typeof claims?.exp === 'number') {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (claims.exp <= nowInSeconds) {
        return null;
      }
    }

    if (!claims?.sub && !claims?.email) {
      return null;
    }

    return normalizeUser({
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      Role: claims.Role,
      avatarURL: claims.avatarURL,
    });
  } catch {
    return null;
  }
};

const resolveDeviceId = async (): Promise<string> => {
  try {
    if (Platform.OS === 'android') {
      const androidId = await Application.getAndroidId();
      return androidId ?? `${Application.applicationId}-android`;
    }

    if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      return iosId ?? `${Application.applicationId}-ios`;
    }

    return Device.deviceName ?? `${Platform.OS}-unknown`;
  } catch {
    return Device.deviceName ?? `${Platform.OS}-${Date.now()}`;
  }
};

export const authService = {
  setAuthFailureHandler,
  notifyAuthFailure,
  login: async (email: string, password: string, deviceId: string) => {
    const loginRequest: LoginRequest = { email, password, deviceId };
    const response = await api.post<LoginResponse>(
      API.ENDPOINTS.LOGIN,
      loginRequest
    );

    const { accessToken, refreshToken } = response.data.payload;
    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN,
      accessToken
    );
    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN,
      refreshToken
    );

    const user = buildUserFromToken(accessToken);
    return { user, tokens: { accessToken, refreshToken } };
  },

  refreshToken: async (refreshToken?: string) => {
    const tokens = await refreshAccessToken(refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = tokens;

    const user = buildUserFromToken(accessToken);
    return { user, tokens: { accessToken, refreshToken: newRefreshToken } };
  },

  register: async (data: RegisterRequest) => {
    const response = await api.post<RegisterResponse>(
      API.ENDPOINTS.REGISTER,
      data
    );

    // Registration doesn't return tokens - user must verify email first
    const registerData = getEnvelopeData(response.data);
    return {
      user: normalizeUser(registerData.user),
      message: response.data.message,
    };
  },

  logout: async () => {
    try {
      await api.post(API.ENDPOINTS.LOGOUT);
    } catch {
      // Ignore logout API errors
    } finally {
      await clearStoredTokens();
    }
  },

  logoutAll: async () => {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN),
      ]);

      if (accessToken && refreshToken) {
        const request: LogoutAllRequest = {
          accessToken,
          refreshToken,
          deviceId: await resolveDeviceId(),
        };
        await api.post<LogoutAllResponse>(API.ENDPOINTS.LOGOUT_ALL, request);
      } else {
        await api.post(API.ENDPOINTS.LOGOUT);
      }
    } catch {
      // Ignore logout API errors
    } finally {
      await clearStoredTokens();
    }
  },

  getProfile: async () => {
    const response = await api.get<ApiResponse<User>>(API.ENDPOINTS.PROFILE);
    return normalizeUser(getEnvelopeData(response.data));
  },

  updateProfile: async (data: UpdateProfileRequest) => {
    const response = await api.put<ApiResponse<User>>(
      API.ENDPOINTS.UPDATE_PROFILE,
      data
    );
    return normalizeUser(getEnvelopeData(response.data));
  },

  getUserFromStoredToken: async (): Promise<User | null> => {
    const token = await SecureStore.getItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN
    );
    if (!token) {
      return null;
    }
    return buildUserFromToken(token);
  },

  checkAuthStatus: async (): Promise<boolean> => {
    const token = await SecureStore.getItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN
    );
    return !!token;
  },

  sendOTP: async (email: string) => {
    const request: SendOTPRequest = { email };
    const response = await api.post<SendOTPResponse>(
      API.ENDPOINTS.SEND_OTP_EMAIL,
      request
    );
    return response.data;
  },

  sendPasswordResetOTP: async (email: string) => {
    const request: SendPasswordResetOTPRequest = { email };
    const response = await api.post<SendPasswordResetOTPResponse>(
      API.ENDPOINTS.SEND_OTP_PASSWORD_RESET,
      request
    );
    return response.data;
  },

  verifyOTP: async (email: string, otpCode: string) => {
    const request: VerifyOTPRequest = { email, otpCode };
    const response = await api.post<VerifyOTPResponse>(
      API.ENDPOINTS.VERIFY_OTP_EMAIL,
      request
    );
    return response.data;
  },

  resetPassword: async (data: ResetPasswordRequest) => {
    const request: ResetPasswordRequest & { otp?: string; password?: string } = {
      ...data,
      // Keep aliases for backend naming variants to improve compatibility.
      otp: data.otpCode,
      password: data.newPassword,
    };

    const response = await api.post<ResetPasswordResponse>(
      API.ENDPOINTS.RESET_PASSWORD,
      request
    );
    return response.data;
  },
};
