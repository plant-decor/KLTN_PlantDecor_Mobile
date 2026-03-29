import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import { API, APP_CONFIG } from '../constants';
import {
  ApiResponse,
  AuthJwtClaims,
  AuthTokens,
  User,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  SendOTPRequest,
  SendOTPResponse,
  VerifyOTPRequest,
  VerifyOTPResponse,
} from '../types';
import api from './api';

const EMPTY_DATE = new Date(0).toISOString();

const getEnvelopeData = <T>(response: ApiResponse<T>): T => {
  const body = response.data ?? response.payload;
  if (!body) {
    throw new Error('Invalid API response: missing data/payload');
  }
  return body;
};

const normalizeUser = (rawUser: any): User => ({
  id: String(rawUser?.id ?? rawUser?.sub ?? ''),
  email: rawUser?.email ?? '',
  fullName: rawUser?.fullName ?? rawUser?.username ?? rawUser?.name ?? '',
  phone: rawUser?.phone ?? rawUser?.phoneNumber ?? undefined,
  avatar: rawUser?.avatar ?? rawUser?.avatarUrl ?? rawUser?.avatarURL ?? undefined,
  createdAt: rawUser?.createdAt ?? EMPTY_DATE,
  updatedAt: rawUser?.updatedAt,
  status: rawUser?.status,
  isVerified: rawUser?.isVerified,
  role: rawUser?.role ?? rawUser?.Role,
});

const buildUserFromToken = (accessToken: string): User | null => {
  try {
    const claims = jwtDecode<AuthJwtClaims>(accessToken);
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

export const authService = {
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
    const storedRefreshToken =
      refreshToken ??
      (await SecureStore.getItemAsync(
        APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN
      ));

    if (!storedRefreshToken) {
      throw new Error('No refresh token available');
    }

    const refreshRequest: RefreshTokenRequest = {
      refreshToken: storedRefreshToken,
    };
    // Use axios directly to avoid interceptor recursion during refresh.
    const response = await axios.post<RefreshTokenResponse>(
      `${API.BASE_URL}${API.ENDPOINTS.REFRESH_TOKEN}`,
      refreshRequest
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data.payload;
    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN,
      accessToken
    );
    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN,
      newRefreshToken
    );

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
      await SecureStore.deleteItemAsync(
        APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN
      );
      await SecureStore.deleteItemAsync(
        APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN
      );
    }
  },

  getProfile: async () => {
    const response = await api.get<ApiResponse<User>>(API.ENDPOINTS.PROFILE);
    return normalizeUser(getEnvelopeData(response.data));
  },

  updateProfile: async (data: Partial<User>) => {
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

  verifyOTP: async (email: string, otpCode: string) => {
    const request: VerifyOTPRequest = { email, otpCode };
    const response = await api.post<VerifyOTPResponse>(
      API.ENDPOINTS.VERIFY_OTP_EMAIL,
      request
    );
    return response.data;
  },
};
