// ==================== Colors ====================
export const COLORS = {
  // Primary - Green theme for plant app
  primary: '#2D6A4F',
  primaryLight: '#52B788',
  primaryDark: '#1B4332',

  // Secondary
  secondary: '#B7E4C7',
  secondaryLight: '#D8F3DC',

  // Accent
  accent: '#D4A373',
  accentLight: '#FAEDCD',

  // Neutral
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F8F9FA',
  gray100: '#F1F3F5',
  gray200: '#E9ECEF',
  gray300: '#DEE2E6',
  gray400: '#CED4DA',
  gray500: '#ADB5BD',
  gray600: '#868E96',
  gray700: '#495057',
  gray800: '#343A40',
  gray900: '#212529',

  // Semantic
  success: '#40C057',
  warning: '#FCC419',
  error: '#FA5252',
  info: '#339AF0',

  // Background
  background: '#F8F9FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  // Text
  textPrimary: '#212529',
  textSecondary: '#868E96',
  textLight: '#ADB5BD',
  textOnPrimary: '#FFFFFF',

  // Border
  border: '#E9ECEF',
  borderLight: '#F1F3F5',
} as const;

// ==================== Typography ====================
export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 30,
    '5xl': 36,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// ==================== Spacing ====================
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

// ==================== Border Radius ====================
export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

// ==================== Shadows ====================
export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

// ==================== API ====================
export const API = {
  BASE_URL: __DEV__
    ? 'http://10.0.2.2:3000/api' // Android emulator
    : 'https://api.plantdecor.vn/api',
  TIMEOUT: 15000,
  ENDPOINTS: {
    // Auth
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH_TOKEN: '/auth/refresh',
    LOGOUT: '/auth/logout',

    // Products
    PRODUCTS: '/products',
    PRODUCT_DETAIL: (id: string) => `/products/${id}`,
    CATEGORIES: '/categories',

    // Cart
    CART: '/cart',
    CART_ADD: '/cart/add',
    CART_UPDATE: '/cart/update',
    CART_REMOVE: (id: string) => `/cart/remove/${id}`,

    // Orders
    ORDERS: '/orders',
    ORDER_DETAIL: (id: string) => `/orders/${id}`,

    // AI Design
    AI_DESIGN: '/ai/design',
    AI_DESIGN_RESULT: (id: string) => `/ai/design/${id}`,

    // User
    PROFILE: '/user/profile',
    UPDATE_PROFILE: '/user/profile',

    // Reviews
    REVIEWS: (productId: string) => `/products/${productId}/reviews`,
  },
} as const;

// ==================== App Config ====================
export const APP_CONFIG = {
  APP_NAME: 'PlantDecor',
  VERSION: '1.0.0',
  ITEMS_PER_PAGE: 20,
  MAX_CART_QUANTITY: 99,
  IMAGE_QUALITY: 0.8,
  SECURE_STORE_KEYS: {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    USER_DATA: 'user_data',
  },
} as const;
