import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API, APP_CONFIG } from '../constants';
import { RefreshTokenRequest, RefreshTokenResponse } from '../types';

type AuthFailureHandler = () => void;

let authFailureHandler: AuthFailureHandler | null = null;

export const setAuthFailureHandler = (handler: AuthFailureHandler | null) => {
  authFailureHandler = handler;
};

export const notifyAuthFailure = () => {
  if (authFailureHandler) {
    authFailureHandler();
  }
};

export const clearStoredTokens = async () => {
  await SecureStore.deleteItemAsync(APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN);
};

export const refreshAccessToken = async (refreshToken?: string) => {
  const storedRefreshToken =
    refreshToken ??
    (await SecureStore.getItemAsync(APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN));

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

  return { accessToken, refreshToken: newRefreshToken };
};
