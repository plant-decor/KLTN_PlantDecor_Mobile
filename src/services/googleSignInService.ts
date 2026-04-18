import ENV from '../config/env';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let hasConfiguredGoogleSignIn = false;
let cachedGoogleSignInModule: GoogleSignInModule | null = null;
const APP_PACKAGE_NAME = 'com.plantdecor.mobile';
const DEBUG_SHA1 = '5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25';
const RELEASE_SHA1 = '1C:CF:B3:44:D8:18:51:4D:C7:E4:AE:1F:96:D2:43:AE:2A:ED:02:B4';

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

const ensureGoogleSignInConfigured = () => {
  if (hasConfiguredGoogleSignIn) {
    return;
  }

  const { GoogleSignin } = getGoogleSignInModule();

  GoogleSignin.configure({
    scopes: ['profile', 'email'],
    ...(ENV.GOOGLE_WEB_CLIENT_ID.trim().length > 0
      ? { webClientId: ENV.GOOGLE_WEB_CLIENT_ID.trim() }
      : {}),
  });

  hasConfiguredGoogleSignIn = true;
};

const isGoogleSignInCancelledError = (error: unknown) => {
  try {
    const { isErrorWithCode, statusCodes } = getGoogleSignInModule();
    return isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED;
  } catch {
    return false;
  }
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
          `Debug SHA-1: ${DEBUG_SHA1}`,
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

export const googleSignInService = {
  getGoogleAccessToken,
  getGoogleSignInErrorMessage,
  isGoogleSignInCancelledError,
};
