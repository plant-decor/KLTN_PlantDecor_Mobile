import * as SecureStore from 'expo-secure-store';
import type { NavigatorScreenParams } from '@react-navigation/native';
// ==================== User & Auth ====================
export interface User {
  id: string;
  email: string;
  username?: string;
  fullName: string;
  phone?: string;
  phoneNumber?: string;
  avatar?: string;
  avatarUrl?: string;
  address?: string | Address;
  birthYear?: number;
  gender?: UserGender;
  genderCode?: number;
  latitude?: number;
  longitude?: number;
  receiveNotifications?: boolean;
  receiveNotification?: boolean;
  profileCompleteness?: number;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  isVerified?: boolean;
  role?: string;
  nurseryId?: number;
  nurseryName?: string;
}

export type UserGender = string;
export type UserGenderCode = number;

export interface UpdateProfileRequest {
  userName: string;
  phoneNumber: string;
  fullName: string;
  address: string;
  birthYear: number;
  gender: UserGender;
  latitude: number;
  longitude: number;
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

export interface GoogleLoginRequest {
  accessToken: string;
  deviceId: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutAllRequest {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
}

export interface LogoutAllResponse {
  success: boolean;
  statusCode: number;
  message: string;
}

// Matches the exact API envelope: { success, statusCode, message, payload: { accessToken, refreshToken } }
export interface LoginResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: AuthTokens;
}

export interface GoogleLoginResponse {
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

export interface ChangeAvatarRequest {
  uri: string;
  fileName?: string;
  mimeType?: string;
}

export interface ChangeAvatarPayload {
  avatarURL: string;
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

export interface SendPasswordResetOTPRequest {
  email: string;
}

export interface SendPasswordResetOTPResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload?: {
    success?: boolean;
    message?: string;
    expiresAt?: string;
  };
}

export interface ResetPasswordRequest {
  email: string;
  otpCode: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload?: {
    success?: boolean;
    message?: string;
  };
}

// Matches the decoded JWT payload from /api/Authentication/login
export interface AuthJwtClaims {
  sub?: string;           // user id
  nameid?: string;
  name?: string;          // full name
  email?: string;
  Role?: string;          // "Admin" | "Manager" | "Staff" | "Shipper" | "Caretaker" | "Customer"
  role?: string | string[];
  roles?: string[];
  preferred_username?: string;
  upn?: string;
  avatarURL?: string;
  avatarUrl?: string;
  SecurityStamp?: string;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string | string[];
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'?: string | string[];
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'?: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'?: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'?: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn'?: string;
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
  roomType?: number[] | null;
  roomStyle?: number[] | null;
  roomTypeNames?: string[] | null;
  roomStyleNames?: string[] | null;
  RoomType?: number[] | null;
  RoomStyle?: number[] | null;
  RoomTypeNames?: string[] | null;
  RoomStyleNames?: string[] | null;
  fengShuiElement: number | string;
  fengShuiElementName?: string | null;
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

// ==================== User Plants & Guides ====================
export interface UserPlant {
  id: number;
  plantId: number;
  plantInstanceId?: number | null;
  plantName: string;
  plantSpecificName?: string | null;
  primaryImageUrl?: string | null;
  purchaseDate?: string | null;
  lastWateredDate?: string | null;
  lastFertilizedDate?: string | null;
  lastPrunedDate?: string | null;
  location?: string | null;
  currentTrunkDiameter?: number | null;
  currentHeight?: number | null;
  healthStatus?: string | null;
  age?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPlantsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: UserPlant[];
}

export interface PlantGuide {
  id: number;
  plantId: number;
  plantName: string;
  lightRequirement?: number | null;
  lightRequirementName?: string | null;
  watering?: string | null;
  fertilizing?: string | null;
  pruning?: string | null;
  temperature?: string | null;
  humidity?: string | null;
  soil?: string | null;
  careNotes?: string | null;
  createdAt?: string | null;
}

export interface PlantGuideResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: PlantGuide;
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
  fengShuiElement?: number;
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

// ==================== Unified Shop Search ====================
export interface ShopSearchRequest {
  pagination?: {
    pageNumber: number;
    pageSize: number;
  };
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  categoryIds?: number[];
  tagIds?: number[];
  petSafe?: boolean;
  childSafe?: boolean;
  comboSeason?: number;
  comboType?: number;
  placementType?: number;
  careLevelType?: number;
  careLevel?: string;
  toxicity?: boolean;
  airPurifying?: boolean;
  hasFlower?: boolean;
  isUniqueInstance?: boolean;
  sizes?: number[];
  fengShuiElement?: number;
  nurseryId?: number;
  sortBy?: string;
  sortDirection?: string;
  includePlants?: boolean;
  includeMaterials?: boolean;
  includeCombos?: boolean;
}

export interface ShopSearchPlantSummary {
  id: number;
  name: string;
  basePrice: number;
  isUniqueInstance: boolean;
  size: number;
  sizeName: string;
  careLevelType: number;
  careLevelTypeName: string;
  fengShuiElement: number;
  fengShuiElementName?: string | null;
  isActive: boolean;
  primaryImageUrl?: string | null;
  totalInstances: number;
  availableInstances: number;
  availableCommonQuantity?: number;
  totalAvailableStock?: number;
  categoryNames: string[];
  tagNames: string[];
  commonPlantId?: number | null;
  nurseryPlantComboId?: number | null;
  nurseryMaterialId?: number | null;
}

export interface ShopSearchMaterialSummary {
  id: number;
  materialId: number;
  materialName: string;
  materialCode: string;
  unit: string;
  basePrice: number;
  nurseryId: number;
  nurseryName: string;
  quantity: number;
  expiredDate?: string | null;
  reservedQuantity: number;
  isActive: boolean;
  availableQuantity: number;
  primaryImageUrl?: string | null;
}

export interface ShopSearchComboNursery {
  nurseryId: number;
  nurseryName: string;
  quantity: number;
}

export interface ShopSearchComboSummary {
  id: number;
  name: string;
  comboType: number;
  comboTypeName?: string | null;
  description?: string | null;
  price: number;
  primaryImageUrl?: string | null;
  nurseries: ShopSearchComboNursery[];
  season?: number | null;
  seasonName?: string | null;
  petSafe?: boolean;
  childSafe?: boolean;
}

export type ShopSearchItemType = 'Plant' | 'Material' | 'Combo';

export interface ShopSearchItem {
  type: ShopSearchItemType;
  plant: ShopSearchPlantSummary | null;
  material: ShopSearchMaterialSummary | null;
  combo: ShopSearchComboSummary | null;
}

export interface ShopSearchItemsPayload {
  items: ShopSearchItem[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface ShopSearchPayload {
  keyword: string | null;
  items: ShopSearchItemsPayload;
  plantTotalCount: number;
  materialTotalCount: number;
  comboTotalCount: number;
}

export interface ShopSearchResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ShopSearchPayload;
}

export interface PreferencesRecommendationPlant {
  id?: number | string | null;
  plantId?: number | string | null;
  commonPlantId?: number | string | null;
  name?: string | null;
  plantName?: string | null;
  basePrice?: number | null;
  price?: number | null;
  isUniqueInstance?: boolean | null;
  primaryImageUrl?: string | null;
  imageUrl?: string | null;
  images?: string[] | null;
  createdAt?: string | null;
}

export interface PreferencesRecommendationPayload {
  items?:
    | PreferencesRecommendationPlant[]
    | {
        items?: PreferencesRecommendationPlant[] | null;
      }
    | null;
  recommendations?: PreferencesRecommendationPlant[] | null;
  data?: PreferencesRecommendationPlant[] | null;
  totalCount?: number;
}

export interface PreferencesRecommendationResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload?: PreferencesRecommendationPayload | PreferencesRecommendationPlant[] | null;
  data?: PreferencesRecommendationPayload | PreferencesRecommendationPlant[] | null;
}

export interface ShopSearchConfigGroup {
  groupName: string;
  values: SystemEnumValue[];
}

export interface ShopUnifiedSearchConfigPayload {
  filterEnums: ShopSearchConfigGroup[];
  filterOptions: unknown[];
  sortEnums: ShopSearchConfigGroup[];
}

export interface ShopUnifiedSearchConfigResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ShopUnifiedSearchConfigPayload;
}

// ==================== Material & Combo Details ====================
export interface MaterialDetail {
  id: number;
  materialCode: string;
  name: string;
  description: string;
  basePrice: number;
  unit: string;
  brand?: string | null;
  specifications?: string | null;
  expiryMonths?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categories: Category[];
  tags: Tag[];
  images: string[];
}

export interface MaterialDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: MaterialDetail;
}

export interface PlantComboDetailItem {
  id: number;
  plantComboId: number;
  plantId: number;
  plantName: string;
  quantity: number;
  notes?: string | null;
}

export interface PlantComboDetail {
  id: number;
  comboCode: string;
  comboName: string;
  comboType: number;
  comboTypeName: string;
  description: string;
  suitableSpace?: string | number | null;
  suitableRooms?: Array<string | number> | null;
  SuitableSpace?: string | number | null;
  SuitableRooms?: Array<string | number> | null;
  fengShuiElement?: number | null;
  fengShuiPurpose?: string | null;
  petSafe?: boolean;
  childSafe?: boolean;
  themeName?: string | null;
  themeDescription?: string | null;
  comboPrice: number;
  season?: number | null;
  seasonName?: string | null;
  isActive: boolean;
  viewCount?: number;
  purchaseCount?: number;
  createdAt: string;
  updatedAt: string;
  comboItems: PlantComboDetailItem[];
  images: string[];
  tagsNavigation: Tag[];
}

export interface PlantComboDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: PlantComboDetail;
}

// ==================== Admin Filter Options ====================
export interface SearchAdminListParams {
  pageNumber?: number;
  pageSize?: number;
}

export interface CategoriesPayload {
  items: Category[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface CategoriesResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: CategoriesPayload;
}

export interface TagsPayload {
  items: Tag[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface TagsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: TagsPayload;
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
  isActive?: boolean;
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

// ==================== Shop Plant Instances Search ====================
export interface ShopInstanceSearchRequest {
  pagination: {
    pageNumber: number;
    pageSize: number;
  };
  nurseryId: number;
  plantId: number;
}

export interface ShopInstanceSearchItem {
  plantInstanceId: number;
  plantId: number;
  plantName: string;
  currentNurseryId: number;
  nurseryName: string;
  nurseryAddress?: string | null;
  nurseryPhone?: string | null;
  sku: string;
  specificPrice: number;
  height?: number | null;
  healthStatus?: string | null;
  description?: string | null;
  status: number;
  statusName: string;
  primaryImageUrl?: string | null;
  createdAt: string;
}

export interface ShopInstanceSearchPayload {
  items: ShopInstanceSearchItem[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface ShopInstanceSearchResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ShopInstanceSearchPayload;
}

export interface PlantInstanceDetail {
  id: number;
  plantId: number;
  plantName: string;
  currentNurseryId: number;
  nurseryName: string;
  nurseryAddress?: string | null;
  nurseryPhone?: string | null;
  sku: string;
  specificPrice: number;
  height?: number | null;
  trunkDiameter?: number | null;
  healthStatus?: string | null;
  age?: number | null;
  description?: string | null;
  status: number;
  statusName: string;
  createdAt: string;
  updatedAt: string;
  images: string[];
}

export interface PlantInstanceDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: PlantInstanceDetail;
}

// ==================== Nurseries By Plant Instances ====================
export interface NurseryPlantInstanceAvailability {
  commonPlantId?: number | null;
  plantInstanceId?: number | null;
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

export interface NurseryPlantComboAndMaterialAvailability {
  id: number;
  nurseryMaterialId: number | null;
  nurseryPlantComboId: number | null;
  commonPlantId: number | null;
  managerId?: number | null;
  managerName?: string | null;
  name: string;
  address: string;
  phone?: string | null;
  isActive: boolean;
  createdAt?: string | null;
  quantity?: number | null;

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

export interface NurseriesGotPlantComboResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: NurseryPlantComboAndMaterialAvailability[];
}

export interface NurseriesGotMaterialResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: NurseryPlantComboAndMaterialAvailability[];
}

export interface PlantDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: Plant;
}

// ==================== Cart ====================
export interface CartItem {
  id: string;
  plant: Plant;
  quantity: number;
}

export interface CartApiItem {
  id: number;
  cartId: number;
  plantId?: number | null;
  plantComboId?: number | null;
  materialId?: number | null;
  commonPlantId: number | null;
  nurseryPlantComboId: number | null;
  nurseryMaterialId: number | null;
  nurseryId: number;
  nurseryName: string;
  productName: string;
  quantity: number;
  price: number;
  subTotal: number;
  createdAt: string;
}

export interface AddCartItemRequest {
  commonPlantId: number | null;
  nurseryPlantComboId?: number | null;
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

export type CheckoutSource = 'cart' | 'buy-now';

export interface CheckoutItem {
  id: string;
  name: string;
  size?: string;
  image?: string;
  price: number;
  quantity: number;
  cartItemId?: number;
  buyNowItemId?: number | null;
  buyNowItemTypeName?: string;
  plantInstanceId?: number;
  isUniqueInstance?: boolean;
}

// ==================== Wishlist ====================
export type WishlistItemType = 'Plant' | 'PlantInstance' | 'PlantCombo' | 'Material';

export interface WishlistItem {
  id: number;
  itemType: WishlistItemType;
  itemId: number;
  itemName: string;
  itemImageUrl: string | null;
  price: number;
  quantity: number | null;
  nurseryName: string | null;
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

export interface ClearWishlistResponse {
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

// ==================== System Enums ====================
export type SystemEnumPrimitive = string | number;

export interface SystemEnumValue {
  value: SystemEnumPrimitive;
  name: string;
}

export interface SystemEnumGroup {
  enumName: string;
  values: SystemEnumValue[];
}

export interface SystemEnumsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload?: SystemEnumGroup[] | SystemEnumGroup | SystemEnumValue[];
  data?: SystemEnumGroup[] | SystemEnumGroup | SystemEnumValue[];
}

export interface ServiceFlowEnumsPayload {
  enums?: SystemEnumGroup[] | SystemEnumGroup | SystemEnumValue[];
  shifts?: unknown;
}

export interface ServiceFlowEnumsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload?: ServiceFlowEnumsPayload;
  data?: ServiceFlowEnumsPayload;
}

// ==================== Order & Payment ====================
export type OrderType = number;
export type BuyNowItemType = number;
export type PaymentStrategy = number;
export type OrderStatusFilter = string;

export interface GetNurseryOrdersRequest {
  status?: number;
  pageNumber?: number;
  pageSize?: number;
}

export interface CreateOrderRequest {
  address: string;
  phone: string;
  customerName: string;
  note?: string;
  paymentStrategy: PaymentStrategy;
  orderType: OrderType;
  cartItemIds: number[];
  buyNowItemId?: number;
  buyNowItemType?: BuyNowItemType;
  buyNowQuantity?: number;
  plantInstanceId?: number;
}

export interface OrderLineItem {
  id: number;
  nurseryOrderDetailId?: number | null;
  itemName: string;
  quantity: number;
  price: number;
  status: number;
  statusName: string;
  itemImageUrl?: string | null;
  itemImage?: string | null;
  imageUrl?: string | null;
  primaryImageUrl?: string | null;
}

export interface OrderNursery {
  id: number;
  orderId?: number;
  nurseryId: number;
  nurseryName: string;
  shipperId: number | null;
  shipperName: string | null;
  subTotalAmount: number;
  status: number;
  statusName: string;
  shipperNote: string | null;
  deliveryNote: string | null;
  deliveryImageUrl?: string | null;
  note: string | null;
  items: OrderLineItem[];
}

export interface ShipperNurseryOrderDetailPayload extends OrderNursery {
  orderId: number;
  shipperEmail: string | null;
  shipperPhone: string | null;
  customerId: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string;
  totalAmount: number;
  depositAmount: number | null;
  remainingAmount: number | null;
  deliveryImageUrl: string | null;
}

export interface InvoiceDetail {
  id: number;
  itemName: string;
  unitPrice: number;
  quantity: number;
  amount: number;
}

export interface OrderInvoice {
  id: number;
  orderId: number;
  issuedDate: string;
  totalAmount: number;
  type: number;
  typeName: string;
  status: number;
  statusName: string;
  details: InvoiceDetail[];
}

export interface OrderPayload {
  id: number;
  userId: number;
  address: string;
  phone: string;
  customerName: string;
  totalAmount: number;
  depositAmount: number | null;
  remainingAmount: number | null;
  status: number;
  statusName: string;
  paymentStrategy: number;
  orderType: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderLineItem[];
  nurseryOrders: OrderNursery[];
  invoices: OrderInvoice[];
}

export interface CreateOrderResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: OrderPayload;
}

export interface GetOrdersResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: OrderPayload[];
}

export interface GetNurseryOrdersPayload {
  items: ShipperNurseryOrderDetailPayload[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface GetNurseryOrdersResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: GetNurseryOrdersPayload;
}

export interface StartShippingRequest {
  shipperNote: string;
}

export interface StartShippingResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: OrderNursery;
}

export interface MarkDeliveredRequest {
  deliveryNote: string;
  deliveryImage: {
    uri: string;
    fileName?: string;
    mimeType?: string;
  };
}

export interface MarkDeliveredResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: OrderNursery;
}

export interface MarkDeliveryFailedRequest {
  failureReason: string;
}

export interface MarkDeliveryFailedResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: OrderNursery;
}

export interface GetOrderDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: OrderPayload;
}

export interface GetShipperNurseryOrderDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ShipperNurseryOrderDetailPayload;
}

export interface CancelOrderResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: OrderPayload;
}

export interface CreatePaymentRequest {
  invoiceId: number;
}

export interface CreatePaymentPayload {
  paymentId: number;
  paymentUrl: string;
}

export interface CreatePaymentResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: CreatePaymentPayload;
}

export interface ContinuePaymentResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: CreatePaymentPayload;
}

// ==================== Return Tickets ====================
export interface CreateReturnTicketItemRequest {
  nurseryOrderDetailId: number;
  requestedQuantity: number;
  reason: string;
}

export interface CreateReturnTicketRequest {
  orderId: number;
  reason: string;
  items: CreateReturnTicketItemRequest[];
}

export interface ReturnTicketImageFile {
  uri: string;
  fileName?: string;
  mimeType?: string;
}

export interface ReturnTicketItem {
  id: number;
  nurseryOrderDetailId: number;
  itemName: string;
  productImageUrl: string | null;
  requestedQuantity: number;
  approvedQuantity: number | null;
  reason: string;
  managerDecisionNote: string | null;
  refundedAmount: number | null;
  refundReference: string | null;
  refundedAt: string | null;
  status: number;
  statusName: string;
  nurseryOrderId: number;
  nurseryId: number;
  imageUrls: string[];
}

export interface ReturnTicketAssignment {
  id: number;
  nurseryId: number;
  managerId: number | null;
  managerName: string | null;
  status: number;
  statusName: string;
  assignedAt: string;
}

export interface ReturnTicket {
  id: number;
  orderId: number;
  customerId: number;
  reason: string;
  status: number;
  statusName: string;
  totalRefundedAmount: number;
  createdAt: string;
  items: ReturnTicketItem[];
  assignments: ReturnTicketAssignment[];
}

export interface ReturnTicketResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ReturnTicket;
}

export interface GetMyReturnTicketsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ReturnTicket[];
}

export interface UploadReturnTicketItemImagesResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ReturnTicketItem;
}

// ==================== Care Service ====================
export interface CareServiceSpecialization {
  id: number;
  name: string;
  description: string;
}

export interface CareServicePackage {
  id: number;
  name: string;
  description: string;
  features: string;
  visitPerWeek: number | null;
  durationDays: number;
  totalSessions: number | null;
  serviceType: number;
  areaLimit: number;
  unitPrice: number;
  isActive: boolean;
  createdAt: string;
  specializations: CareServiceSpecialization[];
}

export interface GetCareServicePackagesResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: CareServicePackage[];
}

export interface GetCareServicePackageDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: CareServicePackage;
}

export interface NurseryCareServiceItem {
  nurseryCareServiceId: number;
  nurseryId: number;
  nurseryName: string;
  nurseryAddress: string;
  nurseryPhone: string;
}

export interface CareServicePackageWithNurseries extends CareServicePackage {
  nurseryCareServices: NurseryCareServiceItem[];
}

export interface GetCareServicePackageWithNurseriesResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: CareServicePackageWithNurseries;
}

export interface CareServicePackageSummary {
  id: number;
  name: string;
  description: string;
  visitPerWeek: number | null;
  durationDays: number;
  serviceType: number;
  unitPrice: number;
}

export interface NurseryCareService {
  id: number;
  nurseryId: number;
  nurseryName: string;
  nurseryAddress: string;
  nurseryPhone: string;
  careServicePackage: CareServicePackageSummary;
}

export interface NurseryNearby {
  id: number;
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  availableServices: NurseryCareService[];
}

export interface GetNurseriesNearbyRequest {
  lat: number;
  lng: number;
  radiusKm?: number;
  packageId?: number;
}

export interface GetNurseriesNearbyResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: NurseryNearby[];
}

export interface GetMyServiceRegistrationsRequest {
  PageNumber?: number;
  PageSize?: number;
  Skip?: number;
  Take?: number;
  status?: number;
}

export interface GetMyServiceRegistrationsPayload {
  items: ServiceRegistration[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface GetMyServiceRegistrationsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: GetMyServiceRegistrationsPayload;
}

export interface CreateServiceRegistrationRequest {
  careServicePackageId: number;
  preferredNurseryId: number | null;
  serviceDate: string;
  scheduleDaysOfWeek: number[];
  preferredShiftId: number;
  address: string;
  phone: string;
  note?: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ServiceRegistrationShift {
  id: number;
  shiftName: string;
  startTime: string;
  endTime: string;
}

export interface GetShiftsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ServiceRegistrationShift[];
}

export interface ServiceRegistrationCustomer {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  avatar: string | null;
}

export interface ServiceRegistrationCaretaker {
  id: number;
  fullName?: string;
  email?: string;
  phone?: string;
  avatar?: string | null;
}

export interface ServiceProgressRegistrationSummary {
  id: number;
  address: string;
  phone: string;
  nurseryCareService: NurseryCareService;
  customer: ServiceRegistrationCustomer | null;
}

export interface ServiceProgress {
  id: number;
  serviceRegistrationId: number;
  status: number;
  statusName: string;
  taskDate: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  description: string | null;
  evidenceImageUrl: string | null;
  careServiceType?: number;
  careServiceTypeName?: string;
  hasIncidents?: boolean;
  incidentReason?: string | null;
  incidentImageUrl?: string | null;
  shift: ServiceRegistrationShift | null;
  caretaker: ServiceRegistrationCaretaker | null;
  serviceRegistration: ServiceProgressRegistrationSummary | null;
}

export interface GetServiceProgressTodayResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ServiceProgress[];
}

export interface GetServiceProgressMyScheduleRequest {
  from?: string;
  to?: string;
}

export interface GetServiceProgressMyScheduleResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ServiceProgress[];
}

export interface GetServiceProgressDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ServiceProgress;
}

export interface GetServiceProgressesByRegistrationResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ServiceProgress[];
}

export interface CheckOutServiceProgressEvidenceImage {
  uri: string;
  fileName?: string;
  mimeType?: string;
}

export interface CheckOutServiceProgressRequest {
  Description?: string;
  evidenceImage: CheckOutServiceProgressEvidenceImage;
}

export interface CheckInServiceProgressResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ServiceProgress;
}

export interface CheckOutServiceProgressResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ServiceProgress;
}

export interface IncidentReportImageFile {
  uri: string;
  fileName?: string;
  mimeType?: string;
}

export interface ReportServiceProgressIncidentRequest {
  IncidentReason?: string;
  incidentImage: IncidentReportImageFile;
}

export interface ReportServiceProgressIncidentResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ServiceProgress;
}

export interface ServiceRegistration {
  id: number;
  status: number;
  statusName: string;
  serviceDate: string;
  totalSessions: number | null;
  address: string;
  phone: string;
  note: string | null;
  latitude: number;
  longitude: number;
  scheduleDaysOfWeek: string;
  cancelReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  orderId: number | null;
  nurseryCareService: NurseryCareService;
  prefferedShift?: ServiceRegistrationShift | null;
  preferredShift?: ServiceRegistrationShift | null;
  customer: ServiceRegistrationCustomer;
  mainCaretaker: ServiceRegistrationCaretaker | null;
  currentCaretaker: ServiceRegistrationCaretaker | null;
  progresses: ServiceProgress[];
  rating: unknown | null;
}

export interface CreateServiceRegistrationResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ServiceRegistration;
}

export interface GetServiceRegistrationDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: ServiceRegistration;
}

// ==================== AI Room Design ====================
export interface RoomDesignImageFile {
  uri: string;
  fileName?: string;
  mimeType?: string;
}

export interface RoomDesignAllergyPlant {
  id: number;
  name: string;
  scientificName?: string | null;
  imageUrl?: string | null;
}

export interface RoomDesignAnalyzeRequest {
  image: RoomDesignImageFile;
  roomType: string;
  roomStyle: string;
  /** Omitted from multipart when undefined / null / empty */
  fengShuiElement?: string | null;
  minBudget?: number;
  maxBudget?: number;
  careLevelType?: string | null;
  /** Omitted when undefined so the backend can treat as unset */
  hasAllergy?: boolean | null;
  allergyNote?: string;
  allergicPlantIds?: number[];
  petSafe?: boolean | null;
  childSafe?: boolean | null;
  preferredNurseryIds?: number[];
}

export interface RoomDesignRecommendationEntityRef {
  id?: number | null;
  plantId?: number | null;
  commonPlantId?: number | null;
  plantInstanceId?: number | null;
  name?: string | null;
  plantName?: string | null;
  imageUrl?: string | null;
  primaryImageUrl?: string | null;
  basePrice?: number | null;
  specificPrice?: number | null;
  images?: unknown;
}

export interface RoomDesignRecommendation {
  id: string;
  name: string;
  plantId?: number | null;
  commonPlantId?: number | null;
  plantInstanceId?: number | null;
  imageUrl?: string | null;
  price?: number | null;
  specificPrice?: number | null;
  nurseryId?: number | null;
  nurseryName?: string | null;
  plantReason?: string | null;
  placementPosition?: string | null;
  placementReason?: string | null;
  /** Analyze-upload API (flat item) */
  entityType?: string | null;
  entityId?: number | null;
  productId?: number | null;
  description?: string | null;
  fengShuiElement?: string | null;
  matchScore?: number | null;
  careDifficulty?: string | null;
  isPurchasable?: boolean | null;
  commonPlant?: RoomDesignRecommendationEntityRef | null;
  plantInstance?: RoomDesignRecommendationEntityRef | null;
  raw?: unknown;
}

export interface RoomDesignRoomAnalysis {
  availableSpace?: string | null;
  colorPalette?: string[] | null;
  summary?: string | null;
}

export interface RoomDesignAnalyzeResult {
  layoutDesignId: number | null;
  roomAnalysis?: RoomDesignRoomAnalysis | null;
  totalCount?: number | null;
  processingTimeMs?: number | null;
  userId?: number | null;
  previewImageUrl?: string | null;
  plantCollageUrl?: string | null;
  aiResponseImageUrl?: string | null;
  fluxPromptUsed?: string | null;
  roomImageUrl?: string | null;
  summary?: string | null;
  recommendations: RoomDesignRecommendation[];
  raw?: unknown;
}

export interface RoomDesignGeneratedImage {
  id: string;
  imageUrl: string;
  prompt?: string | null;
  source?: string | null;
}

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

// ==================== AI Chat ====================
export type AIChatSessionStatus = number | string;
export type AIChatMessageRole = 'user' | 'assistant' | 'system' | string;

export interface AIChatSessionCreateRequest {
  title?: string;
}

export interface AIChatSessionSummary {
  sessionId: number;
  title: string | null;
  status: AIChatSessionStatus;
  startedAt: string;
  endedAt?: string | null;
  updatedAt?: string | null;
}

export interface AIChatSessionCreateResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: AIChatSessionSummary;
}

export interface AIChatSessionsPayload {
  items: AIChatSessionSummary[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface AIChatSessionsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: AIChatSessionsPayload;
}

export interface AIChatHistoryMessage {
  messageId: number;
  role: AIChatMessageRole;
  content: string;
  intent?: string | null;
  isFallback?: boolean;
  isPolicyResponse?: boolean;
  createdAt: string;
}

export interface AIChatHistoryPayload {
  sessionId: number;
  title: string | null;
  status: AIChatSessionStatus;
  startedAt: string;
  endedAt: string | null;
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  messages: AIChatMessage[];
}

export interface AIChatHistoryResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: AIChatHistoryPayload;
}

export interface AIChatConversationTurn {
  role: AIChatMessageRole;
  content: string;
}

export interface AIChatSuggestedPlant {
  entityType: string;
  entityId: number;
  name: string;
  description?: string | null;
  price?: number | null;
  imageUrl?: string | null;
  isPurchasable?: boolean;
  relevanceScore?: number | null;
}

export interface AIChatbotRequest {
  sessionId: number;
  message: string;
  roomDescription?: string | null;
  fengShuiElement?: string | number | null;
  maxBudget?: number | null;
  limit?: number | null;
  preferredRooms?: Array<string | number> | null;
  petSafe?: boolean | null;
  childSafe?: boolean | null;
  onlyPurchasable: boolean;
  conversationHistory?: AIChatConversationTurn[];
}

export interface AIChatPayload {
  intent?: string | null;
  reply: string;
  roomEnvironmentSummary?: string | null;
  suggestedPlants?: AIChatSuggestedPlant[];
  careTips?: string[];
  followUpQuestions?: string[];
  policySources?: string[];
  disclaimer?: string | null;
  usedFallback?: boolean;
}

export interface AIChatResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: AIChatPayload;
}

export interface AIChatEnumGroup {
  enumName: string;
  values: SystemEnumValue[];
}

export interface AIChatMessage {
  id: number | string;
  role: AIChatMessageRole;
  content: string;
  intent?: string | null;
  isFallback?: boolean;
  isPolicyResponse?: boolean;
  createdAt: string;
  suggestedPlants?: AIChatSuggestedPlant[];
  followUpQuestions?: string[];
  disclaimer?: string | null;
  pending?: boolean;
  failed?: boolean;
}

// ==================== Support Conversations ====================
export interface SupportParticipant {
  userId: number;
  fullName: string | null;
  email: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface SupportMessage {
  id: number;
  chatSessionId: number;
  senderId: number;
  senderName: string | null;
  content: string;
  createdAt: string;
  isFromConsultant?: boolean;
}

export interface SupportConversation {
  id: number;
  status: number;
  startedAt: string;
  endedAt: string | null;
  participants: SupportParticipant[];
  latestMessage?: SupportMessage | null;
  messages?: SupportMessage[];
  totalMessages?: number;
  totalPages?: number;
  pageNumber?: number;
  pageSize?: number;
}

export interface SendMessageRequest {
  content: string;
}

export type SupportRealtimeConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export interface SupportConversationRealtimeUpdate {
  conversationId: number;
  status?: number;
  endedAt?: string | null;
  latestMessage?: SupportMessage | null;
  conversation?: SupportConversation | null;
}

export interface SupportRealtimeIncomingMessage {
  messageId: number;
  conversationId: number;
  senderId: number;
  content: string;
  sendAt: string;
}

// ==================== Navigation ====================
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Home: undefined;
  ShipperHome: undefined;
  ShippingList: undefined;
  ShipperOrderDetail: {
    orderId: number;
    nurseryOrderId?: number;
  };
  CaretakerHome: undefined;
  CaretakerTasks: undefined;
  CaretakerTaskDetail: {
    progressId: number;
    serviceRegistrationId: number;
  };
  CaretakerRegistrationDetail: {
    registrationId: number;
    highlightedProgressId?: number;
  };
  PlantDetail: { plantId: string };
  PlantInstanceDetail: {
    plantInstanceId: number;
    plantId?: number;
  };
  MaterialDetail: {
    materialId: number;
    nurseryMaterialId?: number;
  };
  ComboDetail: {
    comboId: number;
    nurseryPlantComboId?: number;
  };
  AIDesign: undefined;
  AIDesignResult: { resultId: string };
  Cart: undefined;
  Wishlist: undefined;
  UserPlants: undefined;
  Checkout: {
    source?: CheckoutSource;
    items?: CheckoutItem[];
    paymentCompleted?: boolean;
    completedOrderId?: number;
  } | undefined;
  PaymentWebView: {
    paymentUrl: string;
    orderId: number;
  };
  PaymentSuccess: {
    orderId?: number;
  };
  AIChat: {
    sessionId?: number;
    createNew?: boolean;
  } | undefined;
  AIChatSessions: {
    selectedSessionId?: number;
  } | undefined;
  VerifyCode: { email: string; password: string };
  ForgotPassword: { email?: string } | undefined;
  OrderDetail: { orderId: number };
  ServiceRegistrationDetail: {
    registrationId: number;
    highlightedProgressId?: number;
  };
  CustomerServiceProgressDetail: {
    progressId: number;
    serviceRegistrationId: number;
  };
  CareServicePackageDetail: { packageId: number };
  Login: undefined;
  Register: undefined;
  Search: undefined;
  Catalog: { keyword?: string } | undefined;
  CategoryPlants: { categoryId: string; categoryName: string };
  EditProfile: undefined;
  OrderHistory: undefined;
  SupportChat: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Plants: undefined;
  AIDesignTab: undefined;
  ServiceTab: undefined;
  Profile: undefined;
};
