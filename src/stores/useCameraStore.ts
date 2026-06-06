import { create } from 'zustand';

interface CameraStore {
  resolve: ((result: any) => void) | null;
  setResolve: (resolve: ((result: any) => void) | null) => void;
}

export const useCameraStore = create<CameraStore>((set) => ({
  resolve: null,
  setResolve: (resolve) => set({ resolve }),
}));
