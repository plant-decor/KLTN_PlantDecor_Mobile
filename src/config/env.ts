import { Platform } from 'react-native';

const parseTimeout = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const defaultDevApiUrl = Platform.select({
  android: 'https://10.0.2.2:7180/api',
  ios: 'https://localhost:7180/api',
  default: 'https://localhost:7180/api',
});

const ENV = {
  DEV_API_URL:
    process.env.EXPO_PUBLIC_DEV_API_URL ?? defaultDevApiUrl,
  PROD_API_URL:
    process.env.EXPO_PUBLIC_PROD_API_URL ?? 'https://api.plantdecor.vn/api',
  GOOGLE_WEB_CLIENT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  API_TIMEOUT: parseTimeout(process.env.EXPO_PUBLIC_API_TIMEOUT, 15000),
  APP_NAME: process.env.EXPO_PUBLIC_APP_NAME ?? 'PlantDecor',
  APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0',
};

export default ENV;