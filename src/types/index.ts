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

export type UserGender = string;
export type UserGenderCode = number;

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
  nurseryId: number;
  nurseryName: string;
  quantity: number;
  expiredDate?: string | null;
  reservedQuantity: number;
  isActive: boolean;
  availableQuantity: number;
  imageUrl?: string | null;
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
  imageUrl?: string | null;
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
  suitableSpace?: string | null;
  suitableRooms?: string[];
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
  cartItemId?: number;
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

// ==================== Order & Payment ====================
export type OrderType = number;
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
  plantInstanceId?: number;
}

export interface OrderLineItem {
  id: number;
  itemName: string;
  quantity: number;
  price: number;
  status: number;
  statusName: string;
}

export interface OrderNursery {
  id: number;
  nurseryId: number;
  nurseryName: string;
  shipperId: number | null;
  shipperName: string | null;
  subTotalAmount: number;
  status: number;
  statusName: string;
  shipperNote: string | null;
  deliveryNote: string | null;
  note: string | null;
  items: OrderLineItem[];
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
  items: OrderNursery[];
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
  ShipperHome: undefined;
  ShippingList: undefined;
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
  VerifyCode: { email: string; password: string };
  ForgotPassword: { email?: string } | undefined;
  OrderDetail: { orderId: number };
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