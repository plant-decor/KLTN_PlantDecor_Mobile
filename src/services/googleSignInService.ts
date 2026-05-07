import ENV from '../config/env';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let hasConfiguredGoogleSignIn = false;
let cachedGoogleSignInModule: GoogleSignInModule | null = null;
const APP_PACKAGE_NAME = 'com.plantdecor.mobile';
const RELEASE_SHA1 = '44:A7:47:9F:8A:E6:C3:6D:24:3F:1B:41:9D:D9:68:F7:D1:AF:7B:2B';

const resolveErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '';
};

const isMissingGoogleNativeModuleError = (error: unknown) => {
  const normalizedMessage = resolveErrorMessage(error).toLowerCase();
  return (
    normalizedMessage.includes('rngooglesignin') &&
    normalizedMessage.includes('could not be found')
  );
};

const getGoogleSignInModule = (): GoogleSignInModule => {
  if (cachedGoogleSignInModule) {
    return cachedGoogleSignInModule;
  }

  // Lazily require the module so unsupported runtimes (e.g. Expo Go) do not crash on import.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  cachedGoogleSignInModule = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
  return cachedGoogleSignInModule;
};

const configureGoogleSignIn = (webClientId?: string) => {
  const { GoogleSignin } = getGoogleSignInModule();

  GoogleSignin.configure({
    scopes: ['profile', 'email'],
    ...(webClientId ? { webClientId } : {}),
  });

  hasConfiguredGoogleSignIn = true;
};

const ensureGoogleSignInConfigured = () => {
  const preferredWebClientId = ENV.GOOGLE_WEB_CLIENT_ID.trim();

  if (hasConfiguredGoogleSignIn) {
    return;
  }

  configureGoogleSignIn(preferredWebClientId.length > 0 ? preferredWebClientId : undefined);
};

const isGoogleSignInCancelledError = (error: unknown) => {
  try {
    const { isErrorWithCode, statusCodes } = getGoogleSignInModule();
    return isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED;
  } catch {
    return false;
  }
};

const signInAndFetchAccessToken = async (): Promise<string | null> => {
  const { GoogleSignin, isCancelledResponse } = getGoogleSignInModule();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResponse = await GoogleSignin.signIn();

  if (isCancelledResponse(signInResponse)) {
    return null;
  }

  const { accessToken } = await GoogleSignin.getTokens();
  const normalizedAccessToken = accessToken?.trim();

  if (!normalizedAccessToken) {
    throw new Error('Google access token was not returned.');
  }

  return normalizedAccessToken;
};

const getGoogleSignInErrorMessage = (error: unknown) => {
  if (isMissingGoogleNativeModuleError(error)) {
    return [
      'RNGoogleSignin native module is unavailable in this runtime.',
      'If you are opening the app in Expo Go, Google native sign-in is not supported there.',
      'Use a native build instead: npx expo run:android (debug) or install the release APK.',
      'If you already rebuilt, uninstall existing app variants and reinstall to avoid signature/runtime mismatch.',
    ].join('\n');
  }

  try {
    const { isErrorWithCode, statusCodes } = getGoogleSignInModule();
    if (isErrorWithCode(error)) {
      const normalizedCode = String(error.code).toUpperCase();

      if (normalizedCode === 'DEVELOPER_ERROR' || normalizedCode === '10') {
        return [
          'Google Sign-In configuration mismatch (DEVELOPER_ERROR).',
          `Package: ${APP_PACKAGE_NAME}`,
          `Release SHA-1: ${RELEASE_SHA1}`,
          'Ensure the Android OAuth client in Google Cloud uses this package + SHA-1 for the build variant you are running.',
          'If EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set, it must be a Web client ID (not Android).',
        ].join('\n');
      }

      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return 'Google Play Services is unavailable or outdated on this device.';
      }

      if (error.code === statusCodes.IN_PROGRESS) {
        return 'Google sign-in is already in progress.';
      }

      if (typeof error.message === 'string' && error.message.trim().length > 0) {
        return error.message;
      }
    }
  } catch (moduleError) {
    if (isMissingGoogleNativeModuleError(moduleError)) {
      return [
        'RNGoogleSignin native module is unavailable in this runtime.',
        'If you are opening the app in Expo Go, Google native sign-in is not supported there.',
        'Use a native build instead: npx expo run:android (debug) or install the release APK.',
        'If you already rebuilt, uninstall existing app variants and reinstall to avoid signature/runtime mismatch.',
      ].join('\n');
    }
  }

  const fallbackMessage = resolveErrorMessage(error).trim();
  if (fallbackMessage.length > 0) {
    return fallbackMessage;
  }

  return 'Google login failed. Please try again.';
};

const getGoogleAccessToken = async (): Promise<string | null> => {
  ensureGoogleSignInConfigured();
  return signInAndFetchAccessToken();
};

export const googleSignInService = {
  getGoogleAccessToken,
  getGoogleSignInErrorMessage,
  isGoogleSignInCancelledError,
};
