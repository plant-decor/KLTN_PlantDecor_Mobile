import { API } from '../constants';
import {
  ApiResponse,
  Category,
  PaginatedResponse,
  Product,
  Review,
} from '../types';
import api from './api';

export const productService = {
  getProducts: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    sortBy?: string;
    minPrice?: number;
    maxPrice?: number;
    careLevel?: string;
    size?: string;
  }) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Product>>>(
      API.ENDPOINTS.PRODUCTS,
      { params }
    );
    return response.data.data;
  },

  getProductDetail: async (id: string) => {
    const response = await api.get<ApiResponse<Product>>(
      API.ENDPOINTS.PRODUCT_DETAIL(id)
    );
    return response.data.data;
  },

  getCategories: async () => {
    const response = await api.get<ApiResponse<Category[]>>(
      API.ENDPOINTS.CATEGORIES
    );
    return response.data.data;
  },

  getProductReviews: async (productId: string, page = 1, limit = 10) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Review>>>(
      API.ENDPOINTS.REVIEWS(productId),
      { params: { page, limit } }
    );
    return response.data.data;
  },

  searchProducts: async (query: string) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Product>>>(
      API.ENDPOINTS.PRODUCTS,
      { params: { search: query } }
    );
    return response.data.data;
  },
};
