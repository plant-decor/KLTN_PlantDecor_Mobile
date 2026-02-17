import * as SecureStore from 'expo-secure-store';
import { API, APP_CONFIG } from '../constants';
import { ApiResponse, AuthTokens, User } from '../types';
import api from './api';

export const authService = {
  login: async (email: string, password: string) => {
    const response = await api.post<
      ApiResponse<{ user: User; tokens: AuthTokens }>
    >(API.ENDPOINTS.LOGIN, { email, password });

    const { tokens } = response.data.data;
    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN,
      tokens.accessToken
    );
    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN,
      tokens.refreshToken
    );

    return response.data.data;
  },

  register: async (data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) => {
    const response = await api.post<
      ApiResponse<{ user: User; tokens: AuthTokens }>
    >(API.ENDPOINTS.REGISTER, data);

    const { tokens } = response.data.data;
    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN,
      tokens.accessToken
    );
    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN,
      tokens.refreshToken
    );

    return response.data.data;
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
    return response.data.data;
  },

  updateProfile: async (data: Partial<User>) => {
    const response = await api.put<ApiResponse<User>>(
      API.ENDPOINTS.UPDATE_PROFILE,
      data
    );
    return response.data.data;
  },

  checkAuthStatus: async (): Promise<boolean> => {
    const token = await SecureStore.getItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN
    );
    return !!token;
  },
};
