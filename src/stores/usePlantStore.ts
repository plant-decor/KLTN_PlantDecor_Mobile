import { create } from 'zustand';
import {
  Category,
  Nursery,
  NurseryCommonPlant,
  NurseryPlantComboAndMaterialAvailability,
  NurseryPlantInstanceAvailability,
  Plant,
  SearchCommonPlantsNurseryRequest,
  SearchCommonPlantsRequest,
  SearchNurseriesRequest,
  SearchPlantsRequest,
  ShopInstanceSearchItem,
  ShopInstanceSearchRequest,
} from '../types';
import { plantService } from '../services/plantService';

interface PlantState {
  // State
  plants: Plant[];
  featuredPlants: Plant[];
  categories: Category[];
  selectedPlant: Plant | null;
  nurseries: Nursery[];
  commonPlants: NurseryCommonPlant[];
  commonPlantsByNursery: NurseryCommonPlant[];
  shopInstancePlants: ShopInstanceSearchItem[];
  nurseriesGotPlantInstances: NurseryPlantInstanceAvailability[];
  nurseriesGotCommonPlants: NurseryPlantInstanceAvailability[];
  nurseriesGotPlantCombos: NurseryPlantComboAndMaterialAvailability[];
  nurseriesGotMaterials: NurseryPlantComboAndMaterialAvailability[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  pageNumber: number;
  totalPages: number;
  nurseriesPageNumber: number;
  nurseriesTotalPages: number;
  commonPlantsPageNumber: number;
  commonPlantsTotalPages: number;
  commonPlantsByNurseryPageNumber: number;
  commonPlantsByNurseryTotalPages: number;
  shopInstancePlantsPageNumber: number;
  shopInstancePlantsTotalPages: number;
  shopInstancePlantsTotalCount: number;
  searchQuery: string;
  selectedCategory: string | null;

  // Actions
  fetchPlants: (params?: {
    page?: number;
    sortBy?: string;
    sortDirection?: string;
  }) => Promise<void>;
  fetchPlantDetail: (id: number) => Promise<void>;
  searchShopPlants: (request: SearchPlantsRequest) => Promise<void>;
  searchShopInstancePlants: (request: ShopInstanceSearchRequest) => Promise<void>;
  searchNurseries: (request: SearchNurseriesRequest) => Promise<void>;
  searchCommonPlants: (request: SearchCommonPlantsRequest) => Promise<void>;
  searchCommonPlantsNursery: (
    nurseryId: number,
    request: SearchCommonPlantsNurseryRequest
  ) => Promise<void>;
  fetchNurseriesGotPlantInstances: (
    plantId: number
  ) => Promise<NurseryPlantInstanceAvailability[]>;
  fetchNurseriesGotCommonPlantByPlantId: (
    plantId: number
  ) => Promise<NurseryPlantInstanceAvailability[]>;
  fetchNurseriesGotPlantComboByPlantComboId: (
    plantComboId: number
  ) => Promise<NurseryPlantComboAndMaterialAvailability[]>;
  fetchNurseriesGotMaterialByMaterialId: (
    materialId: number
  ) => Promise<NurseryPlantComboAndMaterialAvailability[]>;
  setSelectedCategory: (categoryId: string | null) => void;
  clearPlants: () => void;
  resetState: () => void;
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
  nurseries: [],
  commonPlants: [],
  commonPlantsByNursery: [],
  shopInstancePlants: [],
  nurseriesGotPlantInstances: [],
  nurseriesGotCommonPlants: [],
  nurseriesGotPlantCombos: [],
  nurseriesGotMaterials: [],
  isLoading: false,
  isLoadingMore: false,
  error: null,
  pageNumber: 1,
  totalPages: 1,
  nurseriesPageNumber: 1,
  nurseriesTotalPages: 1,
  commonPlantsPageNumber: 1,
  commonPlantsTotalPages: 1,
  commonPlantsByNurseryPageNumber: 1,
  commonPlantsByNurseryTotalPages: 1,
  shopInstancePlantsPageNumber: 1,
  shopInstancePlantsTotalPages: 1,
  shopInstancePlantsTotalCount: 0,
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
      const result = await plantService.searchShopPlants(request);
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

  searchShopInstancePlants: async (request) => {
    set({ isLoading: true, error: null });
    try {
      const result = await plantService.searchShopInstancePlants(request);
      if (result && result.items) {
        set({
          shopInstancePlants: result.items,
          shopInstancePlantsPageNumber: result.pageNumber,
          shopInstancePlantsTotalPages: result.totalPages,
          shopInstancePlantsTotalCount: result.totalCount,
          isLoading: false,
        });
      } else {
        set({
          shopInstancePlants: [],
          shopInstancePlantsPageNumber: 1,
          shopInstancePlantsTotalPages: 1,
          shopInstancePlantsTotalCount: 0,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Không thể tải cây định danh',
        isLoading: false,
        shopInstancePlants: [],
      });
    }
  },

  searchNurseries: async (request) => {
    set({ isLoading: true, error: null });
    try {
      const result = await plantService.searchNurseries(request);
      if (result && result.items) {
        set({
          nurseries: result.items,
          nurseriesPageNumber: result.pageNumber,
          nurseriesTotalPages: result.totalPages,
          isLoading: false,
        });
      } else {
        set({
          nurseries: [],
          nurseriesPageNumber: 1,
          nurseriesTotalPages: 1,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Không thể tải danh sách vựa',
        isLoading: false,
        nurseries: [],
      });
    }
  },

  searchCommonPlants: async (request) => {
    set({ isLoading: true, error: null });
    try {
      const result = await plantService.searchCommonPlants(request);
      if (result && result.items) {
        set({
          commonPlants: result.items,
          commonPlantsPageNumber: result.pageNumber,
          commonPlantsTotalPages: result.totalPages,
          isLoading: false,
        });
      } else {
        set({
          commonPlants: [],
          commonPlantsPageNumber: 1,
          commonPlantsTotalPages: 1,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Không thể tải cây đại trà',
        isLoading: false,
        commonPlants: [],
      });
    }
  },

  searchCommonPlantsNursery: async (nurseryId, request) => {
    set({ isLoading: true, error: null });
    try {
      const result = await plantService.searchCommonPlantsNursery(nurseryId, request);
      if (result && result.items) {
        set({
          commonPlantsByNursery: result.items,
          commonPlantsByNurseryPageNumber: result.pageNumber,
          commonPlantsByNurseryTotalPages: result.totalPages,
          isLoading: false,
        });
      } else {
        set({
          commonPlantsByNursery: [],
          commonPlantsByNurseryPageNumber: 1,
          commonPlantsByNurseryTotalPages: 1,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Không thể tải cây đại trà tại vựa',
        isLoading: false,
        commonPlantsByNursery: [],
      });
    }
  },

  fetchNurseriesGotPlantInstances: async (plantId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await plantService.getNurseriesGotPlantInstances(plantId);
      const normalizedResult = result ?? [];
      set({ nurseriesGotPlantInstances: normalizedResult, isLoading: false });
      return normalizedResult;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Không thể tải vựa có cây',
        isLoading: false,
        nurseriesGotPlantInstances: [],
      });
      return [];
    }
  },

  fetchNurseriesGotCommonPlantByPlantId: async (plantId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await plantService.getNurseriesGotCommonPlantByPlantId(plantId);
      const normalizedResult = result ?? [];
      set({ nurseriesGotCommonPlants: normalizedResult, isLoading: false });
      return normalizedResult;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Không thể tải vựa có cây đại trà',
        isLoading: false,
        nurseriesGotCommonPlants: [],
      });
      return [];
    }
  },

  fetchNurseriesGotPlantComboByPlantComboId: async (plantComboId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await plantService.getNurseriesGotPlantCombo(plantComboId);
      const normalizedResult = result ?? [];
      set({ nurseriesGotPlantCombos: normalizedResult, isLoading: false });
      return normalizedResult;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Không thể tải vựa có combo',
        isLoading: false,
        nurseriesGotPlantCombos: [],
      });
      return [];
    }
  },

  fetchNurseriesGotMaterialByMaterialId: async (materialId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await plantService.getNurseriesGotMaterial(materialId);
      const normalizedResult = result ?? [];
      set({ nurseriesGotMaterials: normalizedResult, isLoading: false });
      return normalizedResult;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Không thể tải vựa có vật tư',
        isLoading: false,
        nurseriesGotMaterials: [],
      });
      return [];
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
      nurseries: [],
      commonPlants: [],
      commonPlantsByNursery: [],
      shopInstancePlants: [],
      nurseriesGotPlantInstances: [],
      nurseriesGotCommonPlants: [],
      nurseriesGotPlantCombos: [],
      nurseriesGotMaterials: [],
      pageNumber: 1,
      totalPages: 1,
      nurseriesPageNumber: 1,
      nurseriesTotalPages: 1,
      commonPlantsPageNumber: 1,
      commonPlantsTotalPages: 1,
      commonPlantsByNurseryPageNumber: 1,
      commonPlantsByNurseryTotalPages: 1,
      shopInstancePlantsPageNumber: 1,
      shopInstancePlantsTotalPages: 1,
      shopInstancePlantsTotalCount: 0,
      searchQuery: '',
      selectedCategory: null,
    });
  },

  resetState: () => {
    set({
      plants: [],
      featuredPlants: [],
      categories: [],
      selectedPlant: null,
      nurseries: [],
      commonPlants: [],
      commonPlantsByNursery: [],
      shopInstancePlants: [],
      nurseriesGotPlantInstances: [],
      nurseriesGotCommonPlants: [],
      nurseriesGotPlantCombos: [],
      nurseriesGotMaterials: [],
      isLoading: false,
      isLoadingMore: false,
      error: null,
      pageNumber: 1,
      totalPages: 1,
      nurseriesPageNumber: 1,
      nurseriesTotalPages: 1,
      commonPlantsPageNumber: 1,
      commonPlantsTotalPages: 1,
      commonPlantsByNurseryPageNumber: 1,
      commonPlantsByNurseryTotalPages: 1,
      shopInstancePlantsPageNumber: 1,
      shopInstancePlantsTotalPages: 1,
      shopInstancePlantsTotalCount: 0,
      searchQuery: '',
      selectedCategory: null,
    });
  },

  clearError: () => set({ error: null }),
}));
