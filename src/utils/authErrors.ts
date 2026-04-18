import axios from 'axios';
import { TFunction } from 'i18next';
import { googleSignInService } from '../services/googleSignInService';

const resolveApiMessage = (error: unknown): string | null => {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const apiMessage = error.response?.data?.message;
  if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
    return apiMessage;
  }

  return null;
};

const isNetworkAxiosError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  return !error.response || error.code === 'ECONNABORTED' || error.message === 'Network Error';
};

const resolveNetworkErrorMessage = (t: TFunction): string => {
  return t('login.networkError', {
    defaultValue: 'Cannot connect to server. Please check your internet connection and try again.',
  });
};

const resolvePlainErrorMessage = (error: unknown): string | null => {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message?.trim();
  return message && message.length > 0 ? message : null;
};

export const resolveLoginErrorMessage = (error: unknown, t: TFunction): string => {
  const apiMessage = resolveApiMessage(error);
  if (apiMessage) {
    return apiMessage;
  }

  const plainErrorMessage = resolvePlainErrorMessage(error);
  if (plainErrorMessage) {
    return plainErrorMessage;
  }

  if (isNetworkAxiosError(error)) {
    return resolveNetworkErrorMessage(t);
  }

  if (axios.isAxiosError(error) && error.response?.status === 401) {
    return t('login.invalidCredentials', {
      defaultValue: 'Invalid email or password.',
    });
  }

  return t('login.loginFailed', {
    defaultValue: 'Login failed. Please try again.',
  });
};

export const resolveRegisterErrorMessage = (error: unknown, t: TFunction): string => {
  const apiMessage = resolveApiMessage(error);
  if (apiMessage) {
    return apiMessage;
  }

  const plainErrorMessage = resolvePlainErrorMessage(error);
  if (plainErrorMessage) {
    return plainErrorMessage;
  }

  if (isNetworkAxiosError(error)) {
    return resolveNetworkErrorMessage(t);
  }

  return t('register.registerFailed', {
    defaultValue: 'Registration failed. Please try again.',
  });
};

export const resolveGoogleAuthErrorMessage = (error: unknown, t: TFunction): string => {
  const apiMessage = resolveApiMessage(error);
  if (apiMessage) {
    return apiMessage;
  }

  const plainErrorMessage = resolvePlainErrorMessage(error);
  if (plainErrorMessage) {
    return plainErrorMessage;
  }

  if (isNetworkAxiosError(error)) {
    return resolveNetworkErrorMessage(t);
  }

  return googleSignInService.getGoogleSignInErrorMessage(error);
};
