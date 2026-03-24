import * as SecureStore from 'expo-secure-store';
// ==================== User & Auth ====================
export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  address?: Address;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  isVerified?: boolean;
  role?: string;
}

export interface Address {
  street: string;
  ward: string;
  district: string;
  city: string;
  fullAddress: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceId: string;
}

// Matches the exact API envelope: { success, statusCode, message, payload: { accessToken, refreshToken } }
export interface LoginResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: AuthTokens;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  fullName: string;
  phoneNumber: string;
}

export interface RegisterResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: {
    user: {
      id: number;
      email: string;
      username: string;
      phoneNumber: string;
      createdAt: string;
      updatedAt: string;
      status: string;
      isVerified: boolean;
      role: string;
      fullName: string;
      receiveNotifications: boolean;
    };
  };
}

export interface SendOTPRequest {
  email: string;
}

export interface SendOTPResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: {
    success: boolean;
    message: string;
    expiresAt: string;
  };
}

export interface VerifyOTPRequest {
  email: string;
  otpCode: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: {
    success: boolean;
    message: string;
  };
}

// Matches the decoded JWT payload from /api/Authentication/login
export interface AuthJwtClaims {
  sub?: string;           // user id
  name?: string;          // full name
  email?: string;
  Role?: string;          // "Admin" | "Manager" | "Staff" | "Shipper" | "Caretaker" | "Customer"
  avatarURL?: string;
  SecurityStamp?: string;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
}

// ==================== Product ====================
export interface Product {
  id: string | number;
  name: string;
  slug?: string;
  specificName?: string;
  origin?: string;
  description?: string;
  basePrice: number;
  price: number;
  salePrice?: number;
  size: string | number;
  sizeName?: string;
  images: string[];
  primaryImageUrl?: string | null;
  category?: Category;
  categories?: Category[];
  categoryNames?: string[];
  tags?: Tag[];
  tagNames?: string[];
  stock: number;
  totalAvailableStock?: number;
  availableCommonQuantity?: number;
  availableInstances?: number;
  totalInstances?: number;
  rating?: number;
  reviewCount?: number;
  careLevel: string;
  careLevelType?: number;
  careLevelTypeName?: string;
  lightRequirement?: 'low' | 'medium' | 'high';
  waterFrequency?: string;
  growthRate?: string;
  placementType?: number;
  placementTypeName?: string;
  toxicity?: boolean;
  airPurifying?: boolean;
  hasFlower?: boolean;
  petSafe?: boolean;
  childSafe?: boolean;
  fengShuiElement?: string;
  fengShuiMeaning?: string;
  potIncluded?: boolean;
  potSize?: string;
  isAvailable?: boolean;
  isActive: boolean;
  isUniqueInstance?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tag {
  id: number;
  tagName: string;
  tagType: number;
  tagTypeName?: string | null;
}

export interface Category {
  id: string | number;
  name: string;
  slug?: string;
  icon?: string;
  image?: string;
  parentCategoryId?: number | null;
  parentCategoryName?: string | null;
  isActive?: boolean;
  categoryType?: number;
  categoryTypeName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  subCategories?: Category[];
}

// ==================== Product Search ====================
export interface SearchProductsRequest {
  pagination?: {
    pageNumber: number;
    pageSize: number;
  };
  keyword?: string;
  isActive?: boolean;
  placementType?: number;
  careLevelType?: number;
  careLevel?: string;
  toxicity?: boolean;
  airPurifying?: boolean;
  hasFlower?: boolean;
  petSafe?: boolean;
  childSafe?: boolean;
  isUniqueInstance?: boolean;
  minBasePrice?: number;
  maxBasePrice?: number;
  categoryIds?: number[];
  tagIds?: number[];
  nurseryId?: number;
  sortBy?: string;
  sortDirection?: string;
}

export interface SearchProductsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: {
    items: Product[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
}

export interface PlantDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: Product;
}

// ==================== Cart ====================
export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
}

// ==================== Order ====================
export interface Order {
  id: string;
  items: OrderItem[];
  totalAmount: number;
  shippingFee: number;
  discount: number;
  finalAmount: number;
  status: OrderStatus;
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  product: Product;
  quantity: number;
  price: number;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipping'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cod' | 'bank_transfer' | 'momo' | 'vnpay';

// ==================== AI Design ====================
export interface AIDesignRequest {
  roomImage: string;
  roomType: 'living_room' | 'bedroom' | 'office' | 'balcony' | 'garden';
  style: 'modern' | 'minimalist' | 'tropical' | 'zen' | 'classic';
  budget?: 'low' | 'medium' | 'high';
  preferences?: string;
}

export interface AIDesignResult {
  id: string;
  originalImage: string;
  designedImage: string;
  suggestedProducts: Product[];
  description: string;
  estimatedCost: number;
  createdAt: string;
}

// ==================== Review ====================
export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  productId: string;
  rating: number;
  comment: string;
  images?: string[];
  createdAt: string;
}

// ==================== API Response ====================
// Generic envelope used by most endpoints (data or payload field)
export interface ApiResponse<T> {
  success: boolean;
  statusCode?: number;
  data?: T;
  payload?: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==================== Navigation ====================
export type RootStackParamList = {
  MainTabs: undefined;
  ProductDetail: { productId: string };
  AIDesign: undefined;
  AIDesignResult: { resultId: string };
  Cart: undefined;
  Checkout: undefined;
  VerifyCode: { email: string; password: string };
  OrderDetail: { orderId: string };
  Login: undefined;
  Register: undefined;
  Search: undefined;
  Catalog: undefined;
  CategoryProducts: { categoryId: string; categoryName: string };
  EditProfile: undefined;
  OrderHistory: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Products: undefined;
  AIDesignTab: undefined;
  CartTab: undefined;
  Profile: undefined;
};