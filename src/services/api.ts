import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API, APP_CONFIG } from '../constants';
import { authService } from './authService';

// Create axios instance
const api = axios.create({
  baseURL: API.BASE_URL,
  timeout: API.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

if (__DEV__) {
  console.log('[API] baseURL:', API.BASE_URL);
}

// ─── Request interceptor — attach Bearer token ───────────────────────────────
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      if (__DEV__) {
        const method = config.method?.toUpperCase() ?? 'GET';
        console.log('[API] →', method, `${config.baseURL ?? ''}${config.url ?? ''}`);
      }

      const token = await SecureStore.getItemAsync(
        APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN
      );
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('[API] Failed to read access token:', error);
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ─── Response interceptor — transparent token refresh on 401 ─────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (__DEV__) {
      const method = error.config?.method?.toUpperCase() ?? 'UNKNOWN';
      const url   = `${error.config?.baseURL ?? ''}${error.config?.url ?? ''}`;
      const status = error.response?.status ?? 'NO_RESPONSE';
      console.log('[API] ✗', method, url, '| status:', status, '| code:', error.code);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt a single refresh per request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { tokens } = await authService.refreshToken();
        const { accessToken } = tokens;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        if (__DEV__) {
          console.log('[API] Token refreshed successfully');
        }

        // Retry the original request with the new token
        return api(originalRequest);
      } catch (refreshError) {
        if (__DEV__) {
          console.warn('[API] Token refresh failed — clearing stored tokens');
        }
        // Clear tokens and let the calling code handle the unauthenticated state
        await SecureStore.deleteItemAsync(APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN);
        await SecureStore.deleteItemAsync(APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN);
      }
    }

    return Promise.reject(error);
  }
);

export default api;