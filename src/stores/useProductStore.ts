import { create } from 'zustand';
import { Category, Product } from '../types';
import { productService } from '../services/productService';

interface ProductState {
  // State
  products: Product[];
  featuredProducts: Product[];
  categories: Category[];
  selectedProduct: Product | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  searchQuery: string;
  selectedCategory: string | null;

  // Actions
  fetchProducts: (params?: {
    page?: number;
    category?: string;
    search?: string;
    sortBy?: string;
  }) => Promise<void>;
  fetchMoreProducts: () => Promise<void>;
  fetchProductDetail: (id: string) => Promise<void>;
  fetchCategories: () => Promise<void>;
  searchProducts: (query: string) => Promise<void>;
  setSelectedCategory: (categoryId: string | null) => void;
  clearProducts: () => void;
  clearError: () => void;
}

export const useProductStore = create<ProductState>((set, get) => ({
  // Initial State
  products: [],
  featuredProducts: [],
  categories: [],
  selectedProduct: null,
  isLoading: false,
  isLoadingMore: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
  searchQuery: '',
  selectedCategory: null,

  // Actions
  fetchProducts: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const result = await productService.getProducts({
        page: 1,
        ...params,
      });
      set({
        products: result.items,
        currentPage: result.page,
        totalPages: result.totalPages,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Không thể tải sản phẩm',
        isLoading: false,
      });
    }
  },

  fetchMoreProducts: async () => {
    const { currentPage, totalPages, isLoadingMore, selectedCategory, searchQuery } =
      get();

    if (isLoadingMore || currentPage >= totalPages) return;

    set({ isLoadingMore: true });
    try {
      const result = await productService.getProducts({
        page: currentPage + 1,
        category: selectedCategory || undefined,
        search: searchQuery || undefined,
      });
      set((state) => ({
        products: [...state.products, ...result.items],
        currentPage: result.page,
        totalPages: result.totalPages,
        isLoadingMore: false,
      }));
    } catch {
      set({ isLoadingMore: false });
    }
  },

  fetchProductDetail: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const product = await productService.getProductDetail(id);
      set({ selectedProduct: product, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Không thể tải chi tiết sản phẩm',
        isLoading: false,
      });
    }
  },

  fetchCategories: async () => {
    try {
      const categories = await productService.getCategories();
      set({ categories });
    } catch (error: any) {
      console.warn('Failed to fetch categories:', error);
    }
  },

  searchProducts: async (query) => {
    set({ isLoading: true, searchQuery: query, error: null });
    try {
      const result = await productService.searchProducts(query);
      set({
        products: result.items,
        currentPage: result.page,
        totalPages: result.totalPages,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Tìm kiếm thất bại',
        isLoading: false,
      });
    }
  },

  setSelectedCategory: (categoryId) => {
    set({ selectedCategory: categoryId });
  },

  clearProducts: () => {
    set({
      products: [],
      currentPage: 1,
      totalPages: 1,
      searchQuery: '',
      selectedCategory: null,
    });
  },

  clearError: () => set({ error: null }),
}));
