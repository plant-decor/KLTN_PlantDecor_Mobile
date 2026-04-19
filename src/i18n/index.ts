import i18n from 'i18next';
import * as SecureStore from 'expo-secure-store';
import { initReactI18next } from 'react-i18next';
import en from './translations/en';
import vi from './translations/vi';

export const LANGUAGE_STORAGE_KEY = 'app_language';

const resources = {
  en: { translation: en },
  vi: { translation: vi },
};

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      const savedLanguage = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
      if (savedLanguage === 'en' || savedLanguage === 'vi') {
        callback(savedLanguage);
        return;
      }

      callback('en');
    } catch {
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore persistence errors
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'vi'],
    compatibilityJSON: 'v4',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
