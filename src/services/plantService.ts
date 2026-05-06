import { API } from '../constants';
import {
  CategoriesResponse,
  MaterialDetailResponse,
  NurseriesGotPlantInstancesResponse,
  NurseriesGotCommonPlantResponse,
  NurseriesGotMaterialResponse,
  NurseriesGotPlantComboResponse,
  PreferencesRecommendationPayload,
  PreferencesRecommendationPlant,
  PreferencesRecommendationResponse,
  PlantInstanceDetailResponse,
  PlantComboDetailResponse,
  PlantDetailResponse,
  UserPlant,
  UserPlantsResponse,
  PlantGuide,
  PlantGuideResponse,
  CareReminder,
  CareReminderListPayload,
  CareReminderListResponse,
  CareReminderTodayResponse,
  CreateCareReminderRequest,
  UpdateCareReminderRequest,
  GetCareRemindersRequest,
  CareReminderResponse,
  DeleteCareReminderResponse,
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

const buildCareRemindersParams = (request?: GetCareRemindersRequest) => {
  if (!request) {
    return undefined;
  }

  const params: Record<string, number> = {};

  if (typeof request.careType === 'number' && Number.isFinite(request.careType)) {
    params.careType = request.careType;
  }

  if (typeof request.pageNumber === 'number' && Number.isFinite(request.pageNumber)) {
    params.pageNumber = request.pageNumber;
  }

  if (typeof request.pageSize === 'number' && Number.isFinite(request.pageSize)) {
    params.pageSize = request.pageSize;
  }

  return Object.keys(params).length > 0 ? params : undefined;
};

const EMPTY_CARE_REMINDER_LIST: CareReminderListPayload = {
  items: [],
  totalCount: 0,
  pageNumber: 1,
  pageSize: 10,
  totalPages: 0,
  hasPrevious: false,
  hasNext: false,
};

const extractRecommendationItems = (
  source: PreferencesRecommendationPayload | PreferencesRecommendationPlant[] | null | undefined
): PreferencesRecommendationPlant[] => {
  if (Array.isArray(source)) {
    return source;
  }

  if (!source || typeof source !== 'object') {
    return [];
  }

  if (Array.isArray(source.items)) {
    return source.items;
  }

  if (
    source.items &&
    typeof source.items === 'object' &&
    Array.isArray(source.items.items)
  ) {
    return source.items.items;
  }

  if (Array.isArray(source.recommendations)) {
    return source.recommendations;
  }

  if (Array.isArray(source.data)) {
    return source.data;
  }

  return [];
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

  getPreferencesRecommendations: async (): Promise<PreferencesRecommendationPlant[] | null> => {
    try {
      const response = await api.get<PreferencesRecommendationResponse>(
        API.ENDPOINTS.PREFERENCES_RECOMMENDATION
      );

      const payload = response.data.payload ?? response.data.data;
      if (payload == null) {
        return null;
      }

      return extractRecommendationItems(payload);
    } catch (error: any) {
      console.error(
        'getPreferencesRecommendations error:',
        error.response?.data || error.message
      );
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

  getUserPlants: async (): Promise<UserPlant[] | null> => {
    try {
      const response = await api.get<UserPlantsResponse>(API.ENDPOINTS.USER_PLANTS_MY);
      return response.data.payload ?? null;
    } catch (error: any) {
      console.error('getUserPlants error:', error.response?.data || error.message);
      throw error;
    }
  },

  getPlantGuide: async (plantId: number): Promise<PlantGuide | null> => {
    try {
      const response = await api.get<PlantGuideResponse>(API.ENDPOINTS.PLANT_GUIDE(plantId));
      return response.data.payload ?? null;
    } catch (error: any) {
      console.error('getPlantGuide error:', error.response?.data || error.message);
      throw error;
    }
  },

  getCareReminders: async (
    request?: GetCareRemindersRequest
  ): Promise<CareReminderListPayload> => {
    try {
      const response = await api.get<CareReminderListResponse>(
        API.ENDPOINTS.USER_PLANTS_CARE_REMINDERS,
        {
          params: buildCareRemindersParams(request),
        }
      );

      return response.data.payload ?? EMPTY_CARE_REMINDER_LIST;
    } catch (error: any) {
      console.error('getCareReminders error:', error.response?.data || error.message);
      throw error;
    }
  },

  getTodayCareReminders: async (): Promise<CareReminder[]> => {
    try {
      const response = await api.get<CareReminderTodayResponse>(
        API.ENDPOINTS.USER_PLANTS_CARE_REMINDERS_TODAY
      );

      return response.data.payload ?? [];
    } catch (error: any) {
      console.error('getTodayCareReminders error:', error.response?.data || error.message);
      throw error;
    }
  },

  createCareReminder: async (
    request: CreateCareReminderRequest
  ): Promise<CareReminder> => {
    try {
      const response = await api.post<CareReminderResponse>(
        API.ENDPOINTS.USER_PLANTS_CARE_REMINDERS,
        request
      );

      return response.data.payload;
    } catch (error: any) {
      console.error('createCareReminder error:', error.response?.data || error.message);
      throw error;
    }
  },

  updateCareReminder: async (
    id: number,
    request: UpdateCareReminderRequest
  ): Promise<CareReminder> => {
    try {
      const response = await api.put<CareReminderResponse>(
        API.ENDPOINTS.USER_PLANTS_CARE_REMINDER_DETAIL(id),
        request
      );

      return response.data.payload;
    } catch (error: any) {
      console.error('updateCareReminder error:', error.response?.data || error.message);
      throw error;
    }
  },

  completeCareReminder: async (id: number): Promise<CareReminder> => {
    try {
      const response = await api.patch<CareReminderResponse>(
        API.ENDPOINTS.USER_PLANTS_CARE_REMINDER_COMPLETE(id)
      );

      return response.data.payload;
    } catch (error: any) {
      console.error('completeCareReminder error:', error.response?.data || error.message);
      throw error;
    }
  },

  deleteCareReminder: async (id: number): Promise<DeleteCareReminderResponse> => {
    try {
      const response = await api.delete<DeleteCareReminderResponse>(
        API.ENDPOINTS.USER_PLANTS_CARE_REMINDER_DETAIL(id)
      );

      return response.data;
    } catch (error: any) {
      console.error('deleteCareReminder error:', error.response?.data || error.message);
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
