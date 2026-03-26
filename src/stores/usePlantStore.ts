import { create } from 'zustand';
import { Category, Plant, SearchPlantsRequest } from '../types';
import { plantService } from '../services/plantService';

interface PlantState {
  // State
  plants: Plant[];
  featuredPlants: Plant[];
  categories: Category[];
  selectedPlant: Plant | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  pageNumber: number;
  totalPages: number;
  searchQuery: string;
  selectedCategory: string | null;

  // Actions
  fetchPlants: (params?: {
    page?: number;
    sortBy?: string;
    sortDirection?: string;
  }) => Promise<void>;
  fetchPlantDetail: (id: string) => Promise<void>;
  searchShopPlants: (request: SearchPlantsRequest) => Promise<void>;
  setSelectedCategory: (categoryId: string | null) => void;
  clearPlants: () => void;
  clearError: () => void;
}

const normalizePlant = (item: Plant): Plant => ({
  ...item,
  images: Array.isArray(item.images) ? item.images : [],
  categories: Array.isArray(item.categories) ? item.categories : [],
  tags: Array.isArray(item.tags) ? item.tags : [],
});

export const usePlantStore = create<PlantState>((set) => ({
  // Initial State
  plants: [],
  featuredPlants: [],
  categories: [],
  selectedPlant: null,
  isLoading: false,
  isLoadingMore: false,
  error: null,
  pageNumber: 1,
  totalPages: 1,
  searchQuery: '',
  selectedCategory: null,

  // Actions
  fetchPlants: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const request: SearchPlantsRequest = {
        pagination: {
          pageNumber: params?.page ?? 1,
          pageSize: 20,
        },
        sortBy: params?.sortBy,
        sortDirection: params?.sortDirection,
        isActive: true,
      };

      const result = await plantService.searchShopPlants(request);
      if (result) {
        const normalizedPlants = (result.items ?? []).map(normalizePlant);
        set({
          plants: normalizedPlants,
          featuredPlants: normalizedPlants.slice(0, 6),
          pageNumber: result.pageNumber,
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

  fetchPlantDetail: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const plant = await plantService.getPlantDetail(id);
      set({ selectedPlant: normalizePlant(plant), isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Không thể tải chi tiết sản phẩm',
        isLoading: false,
      });
    }
  },

  searchShopPlants: async (request) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Searching plants with request:', request);
      const result = await plantService.searchShopPlants(request);
      console.log('Search result:', result);
      if (result && result.items) {
        const normalizedPlants = result.items.map(normalizePlant);

        set({
          plants: normalizedPlants,
          featuredPlants: normalizedPlants.slice(0, 6),
          pageNumber: result.pageNumber,
          totalPages: result.totalPages,
          isLoading: false,
        });
      } else {
        // No results but success - set empty array
        set({
          plants: [],
          featuredPlants: [],
          pageNumber: 1,
          totalPages: 1,
          isLoading: false,
        });
      }
    } catch (error: any) {
      console.error('Search shop plants error:', error);
      set({
        error: error.response?.data?.message || 'Tìm kiếm thất bại',
        isLoading: false,
        plants: [],
        featuredPlants: [],
      });
    }
  },

  setSelectedCategory: (categoryId) => {
    set({ selectedCategory: categoryId });
  },

  clearPlants: () => {
    set({
      plants: [],
      featuredPlants: [],
      selectedPlant: null,
      pageNumber: 1,
      totalPages: 1,
      searchQuery: '',
      selectedCategory: null,
    });
  },

  clearError: () => set({ error: null }),
}));
