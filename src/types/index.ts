import * as SecureStore from 'expo-secure-store';
// ==================== User & Auth ====================
export interface User {
  id: string;
  email: string;
  username?: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  address?: string | Address;
  birthYear?: number;
  gender?: UserGender;
  genderCode?: number;
  receiveNotifications?: boolean;
  receiveNotification?: boolean;
  profileCompleteness?: number;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  isVerified?: boolean;
  role?: string;
}

export type UserGender = 'Male' | 'Female' | 'Other';
export type UserGenderCode = 1 | 2 | 3;

export interface UpdateProfileRequest {
  username: string;
  fullName: string;
  phoneNumber?: string;
  address: string;
  birthYear: number;
  gender: UserGenderCode;
  receiveNotifications: boolean;
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

export interface RefreshTokenRequest {
  refreshToken: string;
}

// Matches the exact API envelope: { success, statusCode, message, payload: { accessToken, refreshToken } }
export interface LoginResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: AuthTokens;
}

export interface RefreshTokenResponse {
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

// ==================== Plant ====================
export interface Plant {
  id: string | number;
  commonPlantId?: number | null;
  nurseryPlantComboId?: number | null;
  nurseryMaterialId?: number | null;
  name: string;
  specificName: string;
  origin: string;
  description: string;
  basePrice: number;
  placementType: number;
  placementTypeName: string;
  size: number;
  sizeName: string;
  growthRate: string;
  toxicity: boolean;
  airPurifying: boolean;
  hasFlower: boolean;
  petSafe: boolean;
  childSafe: boolean;
  fengShuiElement: string;
  fengShuiMeaning: string;
  potIncluded: boolean;
  potSize: string;
  careLevelType: number;
  careLevelTypeName: string;
  careLevel: string;
  isActive: boolean;
  isUniqueInstance: boolean;
  createdAt: string;
  updatedAt: string;
  categories: Category[];
  tags: Tag[];
  images: string[];
  totalInstances: number;
  availableInstances: number;
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

// ==================== Plant Search ====================
export interface SearchPlantsRequest {
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
  sizes?: number[];
  fengShuiElement?: string;
  nurseryId?: number;
  sortBy?: string;
  sortDirection?: string;
}

export interface SearchPlantsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: {
    items: Plant[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
}

// ==================== Nursery Search ====================
export interface Nursery {
  id: number;
  nurseryMaterialId?: number | null;
  nurseryPlantComboId?: number | null;
  commonPlantId?: number | null;
  managerId?: number | null;
  managerName?: string | null;
  name: string;
  address: string;
  phone?: string | null;
  isActive?: boolean;
  createdAt?: string;
}

export interface SearchNurseriesRequest {
  pagination?: {
    pageNumber: number;
    pageSize: number;
  };
}

export interface SearchNurseriesResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: {
    items: Nursery[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
}

// ==================== Common Plants By Nursery ====================
export interface NurseryCommonPlant {
  id: number;
  plantId: number;
  plantName: string;
  nurseryId: number;
  nurseryName: string;
  quantity: number;
  reservedQuantity: number;
  isActive: boolean;
  availableQuantity: number;
}

export interface SearchCommonPlantsNurseryRequest {
  pagination?: {
    pageNumber: number;
    pageSize: number;
  };
}

export interface SearchCommonPlantsNurseryResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: {
    items: NurseryCommonPlant[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
}

// ==================== Common Plants Search ====================
export interface SearchCommonPlantsRequest {
  pagination?: {
    pageNumber: number;
    pageSize: number;
  };
  searchTerm?: string;
  categoryIds?: number[];
  tagIds?: number[];
  sizes?: number[];
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  isAscending?: boolean;
}

export interface SearchCommonPlantsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: {
    items: NurseryCommonPlant[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
}

// ==================== Nurseries By Plant Instances ====================
export interface NurseryPlantInstanceAvailability {
  commonPlantId?: number | null;
  nurseryId: number;
  nurseryName: string;
  address: string;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  availableInstanceCount: number;
  minPrice: number;
  maxPrice: number;
}

export interface NurseriesGotPlantInstancesResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: NurseryPlantInstanceAvailability[];
}

export interface NurseriesGotCommonPlantResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: NurseryPlantInstanceAvailability[];
}

export interface PlantDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: Plant;
}

// ==================== Cart ====================
export interface CartApiItem {
  id: number;
  cartId: number;
  commonPlantId: number | null;
  nurseryPlantComboId: number | null;
  nurseryMaterialId: number | null;
  productName: string;
  quantity: number;
  price: number;
  subTotal: number;
  createdAt: string;
}

export interface AddCartItemRequest {
  commonPlantId: number | null;
  nurseryPlantComboId: number | null;
  nurseryMaterialId: number | null;
  quantity: number;
}

export type AddCartItemPayload = CartApiItem;

export interface AddCartItemResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: CartApiItem;
}

export interface GetCartRequest {
  pageNumber?: number;
  pageSize?: number;
  skip?: number;
  take?: number;
}

export interface GetCartPayload {
  items: CartApiItem[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface GetCartResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: GetCartPayload;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface UpdateCartItemResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: CartApiItem;
}

export interface RemoveCartItemResponse {
  success: boolean;
  statusCode: number;
  message: string;
}

export interface ClearCartResponse {
  success: boolean;
  statusCode: number;
  message: string;
}

export interface CartItem {
  id: string;
  plant: Plant;
  quantity: number;
}

export type CheckoutSource = 'cart' | 'buy-now';

export interface CheckoutItem {
  id: string;
  name: string;
  size?: string;
  image?: string;
  price: number;
  quantity: number;
}

// ==================== Wishlist ====================
export type WishlistItemType =
  | 'CommonPlant'
  | 'PlantInstance'
  | 'NurseryPlantCombo'
  | 'NurseryMaterial';

export interface WishlistItem {
  id: number;
  itemType: WishlistItemType;
  itemId: number;
  itemName: string;
  itemImageUrl: string | null;
  price: number;
  quantity: number | null;
  additionalInfo: string | null;
  createdAt: string;
}

export interface GetWishlistRequest {
  pageNumber?: number;
  pageSize?: number;
  skip?: number;
  take?: number;
}

export interface GetWishlistPayload {
  items: WishlistItem[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface GetWishlistResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: GetWishlistPayload;
}

export interface AddWishlistItemResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: WishlistItem;
}

export interface RemoveWishlistItemResponse {
  success: boolean;
  statusCode: number;
  message: string;
}

export interface CheckWishlistResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: boolean;
}

// // ==================== Order ====================
// export interface Order {
//   id: string;
//   items: OrderItem[];
//   totalAmount: number;
//   shippingFee: number;
//   discount: number;
//   finalAmount: number;
//   status: OrderStatus;
//   shippingAddress: Address;
//   paymentMethod: PaymentMethod;
//   note?: string;
//   createdAt: string;
//   updatedAt: string;
// }

// export interface OrderItem {
//   plant: Plant;
//   quantity: number;
//   price: number;
// }

// export type OrderStatus =
//   | 'pending'
//   | 'confirmed'
//   | 'processing'
//   | 'shipping'
//   | 'delivered'
//   | 'cancelled';

// export type PaymentMethod = 'cod' | 'bank_transfer' | 'momo' | 'vnpay';

// // ==================== AI Design ====================
// export interface AIDesignRequest {
//   roomImage: string;
//   roomType: 'living_room' | 'bedroom' | 'office' | 'balcony' | 'garden';
//   style: 'modern' | 'minimalist' | 'tropical' | 'zen' | 'classic';
//   budget?: 'low' | 'medium' | 'high';
//   preferences?: string;
// }

// export interface AIDesignResult {
//   id: string;
//   originalImage: string;
//   designedImage: string;
//   suggestedPlants: Plant[];
//   description: string;
//   estimatedCost: number;
//   createdAt: string;
// }

// // ==================== Review ====================
// export interface Review {
//   id: string;
//   userId: string;
//   userName: string;
//   userAvatar?: string;
//   plantId: string;
//   rating: number;
//   comment: string;
//   images?: string[];
//   createdAt: string;
// }

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
  PlantDetail: { plantId: string };
  AIDesign: undefined;
  AIDesignResult: { resultId: string };
  Cart: undefined;
  Wishlist: undefined;
  Checkout: {
    source?: CheckoutSource;
    items?: CheckoutItem[];
  } | undefined;
  VerifyCode: { email: string; password: string };
  OrderDetail: { orderId: string };
  Login: undefined;
  Register: undefined;
  Search: undefined;
  Catalog: undefined;
  CategoryPlants: { categoryId: string; categoryName: string };
  EditProfile: undefined;
  OrderHistory: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Plants: undefined;
  AIDesignTab: undefined;
  CartTab: undefined;
  Profile: undefined;
};