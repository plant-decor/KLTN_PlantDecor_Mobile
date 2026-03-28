import { API } from '../constants';
import {
  NurseriesGotPlantInstancesResponse,
  NurseriesGotCommonPlantResponse,
  PlantDetailResponse,
  SearchCommonPlantsNurseryRequest,
  SearchCommonPlantsNurseryResponse,
  SearchCommonPlantsRequest,
  SearchCommonPlantsResponse,
  SearchNurseriesRequest,
  SearchNurseriesResponse,
  SearchPlantsRequest,
  SearchPlantsResponse,
} from '../types';
import api from './api';

export const plantService = {

  getPlantDetail: async (id: string) => {
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
    nurseryId: string | number,
    request: SearchCommonPlantsNurseryRequest
  ) => {
    try {
      const response = await api.post<SearchCommonPlantsNurseryResponse>(
        API.ENDPOINTS.COMMON_PLANTS_BY_NURSERY(String(nurseryId)),
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

  getNurseriesGotPlantInstances: async (plantId: string | number) => {
    try {
      const response = await api.get<NurseriesGotPlantInstancesResponse>(
        API.ENDPOINTS.NURSERIES_GOT_PLANT_INSTANCES(String(plantId))
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getNurseriesGotPlantInstances error:', error.response?.data || error.message);
      throw error;
    }
  },

  getNurseriesGotCommonPlantByPlantId: async (plantId: string | number) => {
    try {
      const response = await api.get<NurseriesGotCommonPlantResponse>(
        API.ENDPOINTS.NURSERIES_GOT_COMMON_PLANT_BY_PLANT_ID(String(plantId))
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getNurseriesGotCommonPlantByPlantId error:', error.response?.data || error.message);
      throw error;
    }
  },
};
