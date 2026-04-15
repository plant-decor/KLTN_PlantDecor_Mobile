import { API } from '../constants';
import {
  CategoriesResponse,
  MaterialDetailResponse,
  NurseriesGotPlantInstancesResponse,
  NurseriesGotCommonPlantResponse,
  NurseriesGotMaterialResponse,
  NurseriesGotPlantComboResponse,
  PlantInstanceDetailResponse,
  PlantComboDetailResponse,
  PlantDetailResponse,
  SearchAdminListParams,
  SearchCommonPlantsNurseryRequest,
  SearchCommonPlantsNurseryResponse,
  SearchCommonPlantsRequest,
  SearchCommonPlantsResponse,
  SearchNurseriesRequest,
  SearchNurseriesResponse,
  SearchPlantsRequest,
  SearchPlantsResponse,
  ShopInstanceSearchRequest,
  ShopInstanceSearchResponse,
  ShopSearchRequest,
  ShopSearchResponse,
  ShopUnifiedSearchConfigResponse,
  TagsResponse,
} from '../types';
import api from './api';

const buildAdminListParams = (params?: SearchAdminListParams) => {
  if (!params) {
    return undefined;
  }

  const query: Record<string, number> = {};

  if (params.pageNumber !== undefined) {
    query.PageNumber = params.pageNumber;
  }

  if (params.pageSize !== undefined) {
    query.PageSize = params.pageSize;
  }

  return Object.keys(query).length > 0 ? query : undefined;
};

export const plantService = {
  searchShop: async (request: ShopSearchRequest) => {
    try {
      const response = await api.post<ShopSearchResponse>(
        API.ENDPOINTS.SHOP_SEARCH,
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('searchShop error:', error.response?.data || error.message);
      throw error;
    }
  },

  getShopUnifiedSearchConfig: async () => {
    try {
      const response = await api.get<ShopUnifiedSearchConfigResponse>(
        API.ENDPOINTS.SHOP_SEARCH_CONFIG
      );
      return response.data.payload;
    } catch (error: any) {
      console.error(
        'getShopUnifiedSearchConfig error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getAdminCategories: async (params?: SearchAdminListParams) => {
    try {
      const response = await api.get<CategoriesResponse>(API.ENDPOINTS.ADMIN_CATEGORIES, {
        params: buildAdminListParams(params),
      });
      return response.data.payload;
    } catch (error: any) {
      console.error('getAdminCategories error:', error.response?.data || error.message);
      throw error;
    }
  },

  getAdminTags: async (params?: SearchAdminListParams) => {
    try {
      const response = await api.get<TagsResponse>(API.ENDPOINTS.ADMIN_TAGS, {
        params: buildAdminListParams(params),
      });
      return response.data.payload;
    } catch (error: any) {
      console.error('getAdminTags error:', error.response?.data || error.message);
      throw error;
    }
  },

  getMaterialDetail: async (id: number) => {
    try {
      const response = await api.get<MaterialDetailResponse>(
        API.ENDPOINTS.MATERIAL_DETAIL(id)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getMaterialDetail error:', error.response?.data || error.message);
      throw error;
    }
  },

  getPlantComboDetail: async (id: number) => {
    try {
      const response = await api.get<PlantComboDetailResponse>(
        API.ENDPOINTS.PLANT_COMBO_DETAIL(id)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getPlantComboDetail error:', error.response?.data || error.message);
      throw error;
    }
  },

  getPlantDetail: async (id: number) => {
    try {
      const response = await api.get<PlantDetailResponse>(
        API.ENDPOINTS.PLANT_DETAIL(id)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getPlantDetail error:', error.response?.data || error.message);
      throw error;
    }
  },

  searchShopPlants: async (request: SearchPlantsRequest) => {
    try {
      const response = await api.post<SearchPlantsResponse>(
        API.ENDPOINTS.PLANTS,
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('searchShopPlants error:', error.response?.data || error.message);
      throw error;
    }
  },

  searchShopInstancePlants: async (request: ShopInstanceSearchRequest) => {
    try {
      const response = await api.post<ShopInstanceSearchResponse>(
        API.ENDPOINTS.SHOP_INSTANCE_SEARCH,
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('searchShopInstancePlants error:', error.response?.data || error.message);
      throw error;
    }
  },

  getPlantInstanceDetail: async (id: number) => {
    try {
      const response = await api.get<PlantInstanceDetailResponse>(
        API.ENDPOINTS.INSTANCE_DETAIL(id)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getPlantInstanceDetail error:', error.response?.data || error.message);
      throw error;
    }
  },

  searchNurseries: async (request: SearchNurseriesRequest) => {
    try {
      const response = await api.post<SearchNurseriesResponse>(
        API.ENDPOINTS.NURSERIES,
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('searchNurseries error:', error.response?.data || error.message);
      throw error;
    }
  },

  searchCommonPlantsNursery: async (
    nurseryId: number,
    request: SearchCommonPlantsNurseryRequest
  ) => {
    try {
      const response = await api.post<SearchCommonPlantsNurseryResponse>(
        API.ENDPOINTS.COMMON_PLANTS_BY_NURSERY(nurseryId),
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('searchCommonPlantsNursery error:', error.response?.data || error.message);
      throw error;
    }
  },

  searchCommonPlants: async (request: SearchCommonPlantsRequest) => {
    try {
      const response = await api.post<SearchCommonPlantsResponse>(
        API.ENDPOINTS.COMMON_PLANTS,
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('searchCommonPlants error:', error.response?.data || error.message);
      throw error;
    }
  },

  getNurseriesGotPlantInstances: async (plantId: number) => {
    try {
      const response = await api.get<NurseriesGotPlantInstancesResponse>(
        API.ENDPOINTS.NURSERIES_GOT_PLANT_INSTANCES(plantId)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getNurseriesGotPlantInstances error:', error.response?.data || error.message);
      throw error;
    }
  },

  getNurseriesGotCommonPlantByPlantId: async (plantId: number) => {
    try {
      const response = await api.get<NurseriesGotCommonPlantResponse>(
        API.ENDPOINTS.NURSERIES_GOT_COMMON_PLANT_BY_PLANT_ID(plantId)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getNurseriesGotCommonPlantByPlantId error:', error.response?.data || error.message);
      throw error;
    }
  },

  getNurseriesGotPlantCombo: async (plantComboId: number) => {
    try {
      const response = await api.get<NurseriesGotPlantComboResponse>(
        API.ENDPOINTS.NURSERIES_GOT_PLANT_COMBO(plantComboId)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getNurseriesGotPlantCombo error:', error.response?.data || error.message);
      throw error;
    }
  },

  getNurseriesGotMaterial: async (materialId: number) => {
    try {
      const response = await api.get<NurseriesGotMaterialResponse>(
        API.ENDPOINTS.NURSERIES_GOT_MATERIAL(materialId)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getNurseriesGotMaterial error:', error.response?.data || error.message);
      throw error;
    }
  },
};
