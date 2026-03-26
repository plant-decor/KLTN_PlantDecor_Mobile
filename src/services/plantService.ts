import { API } from '../constants';
import {
  ApiResponse,
  Category,
  PaginatedResponse,
  Plant,
  SearchPlantsRequest,
  SearchPlantsResponse,
  PlantDetailResponse,
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
};
