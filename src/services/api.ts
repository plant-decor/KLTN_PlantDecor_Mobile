import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API, APP_CONFIG } from '../constants';

// Create axios instance
const api = axios.create({
  baseURL: API.BASE_URL,
  timeout: API.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await SecureStore.getItemAsync(
        APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN
      );
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to get access token:', error);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If 401 and not already retried, try refreshing token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync(
          APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN
        );

        if (refreshToken) {
          const response = await axios.post(
            `${API.BASE_URL}${API.ENDPOINTS.REFRESH_TOKEN}`,
            { refreshToken }
          );

          const { accessToken, refreshToken: newRefreshToken } =
            response.data.data;

          await SecureStore.setItemAsync(
            APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN,
            accessToken
          );
          await SecureStore.setItemAsync(
            APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN,
            newRefreshToken
          );

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }

          return api(originalRequest);
        }
      } catch (refreshError) {
        // Clear tokens on refresh failure
        await SecureStore.deleteItemAsync(
          APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN
        );
        await SecureStore.deleteItemAsync(
          APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN
        );
      }
    }

    return Promise.reject(error);
  }
);

export default api;
