import { create } from 'zustand';
import { Category, Product, SearchProductsRequest } from '../types';
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
  searchShopProducts: (request: SearchProductsRequest) => Promise<void>;
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
      if (result) {
        set({
          products: result.items,
          currentPage: result.page,
          totalPages: result.totalPages,
          isLoading: false,
        });
      }
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
      if (result) {
        set((state) => ({
          products: [...state.products, ...result.items],
          currentPage: result.page,
          totalPages: result.totalPages,
          isLoadingMore: false,
        }));
      }
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
      if (result) {
        set({
          products: result.items,
          currentPage: result.page,
          totalPages: result.totalPages,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Tìm kiếm thất bại',
        isLoading: false,
      });
    }
  },

  searchShopProducts: async (request) => {
    set({ isLoading: true, error: null });
    try {
      const result = await productService.searchShopProducts(request);
      if (result && result.items) {
        // Transform products to ensure proper image handling
        const transformedProducts = result.items.map((item) => ({
          ...item,
          id: String(item.id),
          price: item.basePrice,
          images: item.primaryImageUrl ? [item.primaryImageUrl] : [],
          stock: item.totalAvailableStock || 0,
          rating: item.rating || 4.5,
          reviewCount: item.reviewCount || 0,
        }));

        set({
          products: transformedProducts,
          currentPage: result.pageNumber,
          totalPages: result.totalPages,
          isLoading: false,
        });
      } else {
        // No results but success - set empty array
        set({
          products: [],
          currentPage: 1,
          totalPages: 1,
          isLoading: false,
        });
      }
    } catch (error: any) {
      console.error('Search shop products error:', error);
      set({
        error: error.response?.data?.message || 'Tìm kiếm thất bại',
        isLoading: false,
        products: [],
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
