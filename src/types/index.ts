// ==================== User & Auth ====================
export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  address?: Address;
  createdAt: string;
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

// ==================== Product ====================
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  salePrice?: number;
  images: string[];
  category: Category;
  tags: string[];
  stock: number;
  rating: number;
  reviewCount: number;
  careLevel: 'easy' | 'medium' | 'hard';
  lightRequirement: 'low' | 'medium' | 'high';
  waterFrequency: string;
  size: 'small' | 'medium' | 'large' | 'extra-large';
  isAvailable: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
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
export interface ApiResponse<T> {
  success: boolean;
  data: T;
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
  OrderDetail: { orderId: string };
  Login: undefined;
  Register: undefined;
  Search: undefined;
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
