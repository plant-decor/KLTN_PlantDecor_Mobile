import { create } from 'zustand';
import { UserPlant, PlantGuide } from '../types';
import { plantService } from '../services/plantService';

interface UserPlantState {
  userPlants: UserPlant[];
  selectedGuide: PlantGuide | null;
  isLoading: boolean;
  isGuideLoading: boolean;
  error: string | null;

  fetchUserPlants: () => Promise<void>;
  fetchPlantGuide: (plantId: number) => Promise<PlantGuide | null>;
  clearError: () => void;
  resetState: () => void;
}

export const useUserPlantStore = create<UserPlantState>((set) => ({
  userPlants: [],
  selectedGuide: null,
  isLoading: false,
  isGuideLoading: false,
  error: null,

  fetchUserPlants: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await plantService.getUserPlants();
      set({ userPlants: result ?? [], isLoading: false });
    } catch (error: any) {
      set({
        error: error?.response?.data?.message || 'Không thể tải cây của bạn',
        isLoading: false,
        userPlants: [],
      });
    }
  },

  fetchPlantGuide: async (plantId: number) => {
    set({ isGuideLoading: true, error: null });
    try {
      const guide = await plantService.getPlantGuide(plantId);
      set({ selectedGuide: guide ?? null, isGuideLoading: false });
      return guide ?? null;
    } catch (error: any) {
      set({
        error: error?.response?.data?.message || 'Không thể tải hướng dẫn cây',
        isGuideLoading: false,
      });
      return null;
    }
  },

  clearError: () => set({ error: null }),

  resetState: () =>
    set({ userPlants: [], selectedGuide: null, isLoading: false, isGuideLoading: false, error: null }),
}));

export default useUserPlantStore;
