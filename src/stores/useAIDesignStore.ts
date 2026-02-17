import { create } from 'zustand';
import { AIDesignRequest, AIDesignResult } from '../types';
import api from '../services/api';
import { API } from '../constants';

interface AIDesignState {
  // State
  designResults: AIDesignResult[];
  currentResult: AIDesignResult | null;
  isGenerating: boolean;
  error: string | null;

  // Actions
  generateDesign: (request: AIDesignRequest) => Promise<void>;
  fetchDesignResult: (id: string) => Promise<void>;
  fetchHistory: () => Promise<void>;
  clearCurrentResult: () => void;
  clearError: () => void;
}

export const useAIDesignStore = create<AIDesignState>((set) => ({
  // Initial State
  designResults: [],
  currentResult: null,
  isGenerating: false,
  error: null,

  // Actions
  generateDesign: async (request) => {
    set({ isGenerating: true, error: null });
    try {
      const formData = new FormData();
      formData.append('roomImage', {
        uri: request.roomImage,
        type: 'image/jpeg',
        name: 'room.jpg',
      } as any);
      formData.append('roomType', request.roomType);
      formData.append('style', request.style);
      if (request.budget) formData.append('budget', request.budget);
      if (request.preferences)
        formData.append('preferences', request.preferences);

      const response = await api.post(API.ENDPOINTS.AI_DESIGN, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // AI generation may take longer
      });

      const result: AIDesignResult = response.data.data;
      set((state) => ({
        currentResult: result,
        designResults: [result, ...state.designResults],
        isGenerating: false,
      }));
    } catch (error: any) {
      set({
        error:
          error.response?.data?.message ||
          'Không thể tạo thiết kế. Vui lòng thử lại.',
        isGenerating: false,
      });
      throw error;
    }
  },

  fetchDesignResult: async (id) => {
    try {
      const response = await api.get(API.ENDPOINTS.AI_DESIGN_RESULT(id));
      set({ currentResult: response.data.data });
    } catch (error: any) {
      set({
        error:
          error.response?.data?.message || 'Không thể tải kết quả thiết kế',
      });
    }
  },

  fetchHistory: async () => {
    try {
      const response = await api.get(API.ENDPOINTS.AI_DESIGN);
      set({ designResults: response.data.data });
    } catch (error: any) {
      console.warn('Failed to fetch design history:', error);
    }
  },

  clearCurrentResult: () => set({ currentResult: null }),

  clearError: () => set({ error: null }),
}));
