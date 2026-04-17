import HomeIcon from "../../assets/icons/navbar.svg";
import PlantIcon from "../../assets/icons/Icons-2.svg";
import AiIcon from "../../assets/icons/Icons-1.svg";
import FavoriteIcon from "../../assets/icons/Icons.svg";
import ProfileIcon from "../../assets/icons/Vector.svg";
import GoogleIcon from "../../assets/icons/Google_Icon.svg";
import CartBagIcon from "../../assets/icons/cart_bag.svg";
import Logo from "../../assets/icons/logo.svg";
import LogoWithText from "../../assets/icons/logo_with_text.svg";
import ENV from "../config/env";

// ==================== Icons ====================
export const ICONS = {
  home: HomeIcon,
  plants: PlantIcon,
  aiDesign: AiIcon,
  cart: FavoriteIcon,
  profile: ProfileIcon,
  google: GoogleIcon,
  cartBag: CartBagIcon,
  logo: Logo,
  logoWithText: LogoWithText,
} as const;

// ==================== Colors ====================
export const COLORS = {
  // Primary - Green theme for plant app
  primary: "#2D6A4F",
  primaryLight: "#13EC6D",
  primaryDark: "#1B4332",

  // Secondary
  secondary: "#B7E4C7",
  secondaryLight: "#D8F3DC",

  // Accent
  accent: "#D4A373",
  accentLight: "#FAEDCD",

  // Neutral
  white: "#FFFFFF",
  black: "#000000",
  gray50: "#F8F9FA",
  gray100: "#F1F3F5",
  gray200: "#E9ECEF",
  gray300: "#DEE2E6",
  gray400: "#CED4DA",
  gray500: "#ADB5BD",
  gray600: "#868E96",
  gray700: "#495057",
  gray800: "#343A40",
  gray900: "#212529",

  // Semantic
  success: "#40C057",
  warning: "#FCC419",
  error: "#FA5252",
  info: "#339AF0",

  // Background
  background: "#F8F9FA",
  surface: "#FFFFFF",
  card: "#FFFFFF",

  // Text
  textPrimary: "#212529",
  textSecondary: "#868E96",
  textLight: "#ADB5BD",
  textOnPrimary: "#FFFFFF",

  // Border
  border: "#E9ECEF",
  borderLight: "#F1F3F5",
} as const;

// ==================== Typography ====================
export const FONTS = {
  regular: "System",
  medium: "System",
  bold: "System",
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    "2xl": 20,
    "3xl": 24,
    "4xl": 30,
    "5xl": 36,
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
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const;

// ==================== Border Radius ====================
export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  full: 9999,
} as const;

// ==================== Shadows ====================
export const SHADOWS = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

// ==================== API ====================
export const API = {
  // BASE_URL: __DEV__ ? ENV.DEV_API_URL : ENV.PROD_API_URL,
  BASE_URL: ENV.PROD_API_URL,
  TIMEOUT: ENV.API_TIMEOUT,
  ENDPOINTS: {
    // Auth
    LOGIN: "/Authentication/login",
    REGISTER: "/Authentication/register",
    REFRESH_TOKEN: "/Authentication/refreshToken",
    LOGOUT: "/Authentication/logout",
    LOGOUT_ALL: "/Authentication/logout-all",
    SEND_OTP_EMAIL: "/Authentication/send-otp-email-verification",
    VERIFY_OTP_EMAIL: "/Authentication/verify-otp-email-verification",
    SEND_OTP_PASSWORD_RESET: "/Authentication/send-otp-password-reset",
    RESET_PASSWORD: "/Authentication/reset-password-with-otp",

    //Shop
    SHOP_SEARCH: "/shop/search",
    SHOP_SEARCH_CONFIG: "/system/search-config/shop-unified",
    SHOP_INSTANCE_SEARCH: "/shop/plant-instances/search",
    NURSERIES: "/shop/nurseries/search",
    
    // Plants
    PLANTS: "/shop/plants/search",
    PLANT_DETAIL: (id: number) => `/shop/plants/${id}`,

    COMMON_PLANTS: "/shop/common-plants/search",
    COMMON_DETAIL: (id: number) => `/shop/common-plants/${id}`,
    COMMON_PLANTS_BY_NURSERY: (nurseryId: number) => `/shop/nurseries/${nurseryId}/common-plants/search`,
    NURSERIES_GOT_COMMON_PLANT_BY_PLANT_ID: (plantId: number) => `/shop/plants/${plantId}/common-nurseries`,
    
    INSTANCE_DETAIL: (id: number) => `/shop/plant-instances/${id}`,
    INSTANCE_PLANTS_BY_NURSERY: (nurseryId: number) => `/shop/nurseries/${nurseryId}/plant-instances/search`,
    NURSERIES_GOT_PLANT_INSTANCES: (plantId: number) => `/plants/${plantId}/nurseries`,
    
    //PlantCombos
    PLANT_COMBO_DETAIL: (id: number) => `/PlantCombos/${id}`,
    NURSERIES_GOT_PLANT_COMBO: (plantComboId: number) => `/shop/plant-combos/${plantComboId}/nurseries`,

    //Materials
    MATERIAL_DETAIL: (id: number) => `/material/${id}`,
    NURSERIES_GOT_MATERIAL: (materialId: number) => `/shop/materials/${materialId}/nurseries`,

    // Cart
    CART: "/Cart",
    CART_ADD: "/Cart/items",
    CART_UPDATE: (id: number) => `/Cart/items/${id}`,
    CART_REMOVE: (id: number) => `/Cart/items/${id}`,
    CART_CLEAR: "/Cart",

    // Orders
    ORDER: "/Order",
    ORDER_DETAIL: (id: number) => `/Order/${id}`,
    ORDERS: "/Order/my",
    ORDER_CANCEL: (id: number) => `/Order/${id}/cancel`,
    ORDER_DELIVERED: (id: number) => `/Order/${id}/delivered`,

    // Payment
    PAYMENT_CREATE: "/Payment/create",
    PAYMENT_CONTINUE: (invoiceId: number) => `/Payment/invoice/${invoiceId}/continue`,
    PAYMENT_CALLBACK: "/Payment/Checkout/PaymentCallbackVnpay",
    PAYMENT_IPN: "/Payment/Checkout/IpnVnpay",

    // System Enums
    SYSTEM_ENUMS: "/system/enums",
    SYSTEM_ENUM_BY_NAME: (enumName: string) => `/system/enums/${enumName}`,
    SYSTEM_ENUM_SERVICE_FLOW: "/system/enums/service-flow",
    ADMIN_CATEGORIES: "/admin/Categories",
    ADMIN_TAGS: "/admin/Tags",

    // AI Design
    // AI_DESIGN: '/ai/design',
    // AI_DESIGN_RESULT: (id: string) => `/ai/design/${id}`,

    // User
    PROFILE: "/User/user-profile",
    UPDATE_PROFILE: "/User/user-profile",
    CHANGE_AVATAR: "/User/avatar",
    SET_PASSWORD_GOOGLE: "/User/set-password-for-google-login",

    //Wishlist
    WISHLIST: "/Wishlist",
    WISHLIST_ADD: (itemType: string, itemId: number) =>
      `/Wishlist/${itemType}/${itemId}`,
    WISHLIST_REMOVE: (itemType: string, itemId: number) =>
      `/Wishlist/${itemType}/${itemId}`,
    WISHLIST_CHECK: (itemType: string, itemId: number) =>
      `/Wishlist/${itemType}/${itemId}/check`,
    WISHLIST_CLEAR: "/Wishlist/all",

    //User Preferences
    PREFERENCES_RECOMMENDATION: "/UserPreferences/recommendations",
    PREFERENCES_CONTEXTUAL: "/UserPreferences/recommendations/contextual",

    //Shipping
    NURSERY_ORDERS: "/shipper/nursery-orders/my",
    START_SHIPPING: (orderId: number) =>
      `/shipper/nursery-orders/${orderId}/start-shipping`,
    MARK_DELIVERED: (orderId: number) =>
      `/shipper/nursery-orders/${orderId}/mark-delivered`,
    MARK_DELIVERY_FAILED: (orderId: number) =>
      `/shipper/nursery-orders/${orderId}/mark-delivery-failed`,

    //CareService
    CARE_SERVICE_PACKAGES: "/care-service-packages",
    CARE_SERVICE_PACKAGES_DETAIL: (id: number) => `/care-service-packages/${id}`,
    SHIFTS: "/shifts",
    NURSERIES_NEARBY: "/nurseries/nearby",

    SERVICE_REGISTRATION: "/service-registrations",
    MY_SERVICE_REGISTRATIONS: "/service-registrations/my",
    SERVICE_REGISTRATION_DETAIL: (id: number) => `/service-registrations/${id}`,
    CANCEL_SERVICE_REGISTRATION: (id: number) => `/service-registrations/${id}/cancel`,
    CARETAKER_ASSIGNED_SERVICE_REGISTRATIONS: "/service-registrations/my-tasks",
    CARETAKER_ASSGINED_SERVICE_REGISTRATIONS: "/service-registrations/my-tasks",
    SERVICE_PROGRESS_TODAY: "/service-progress/today",
    SERVICE_PROGRESS_MY_SCHEDULE: "/service-progress/my-schedule",
    SERVICE_PROGRESS_CHECK_IN: (id: number) => `/service-progress/${id}/check-in`,
    SERVICE_PROGRESS_CHECK_OUT: (id: number) => `/service-progress/${id}/check-out`,

  },
} as const;

// ==================== App Config ====================
export const APP_CONFIG = {
  APP_NAME: ENV.APP_NAME,
  VERSION: ENV.APP_VERSION,
  ITEMS_PER_PAGE: 20,
  MAX_CART_QUANTITY: 99,
  IMAGE_QUALITY: 0.8,
  SECURE_STORE_KEYS: {
    ACCESS_TOKEN: "access_token",
    REFRESH_TOKEN: "refresh_token",
    USER_DATA: "user_data",
    APP_LANGUAGE: "app_language",
  },
} as const;
