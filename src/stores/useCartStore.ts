import { create } from 'zustand';
import { CartItem, Plant } from '../types';

interface CartState {
  // State
  items: CartItem[];
  isLoading: boolean;

  // Computed (via getters)
  totalItems: () => number;
  totalPrice: () => number;

  // Actions
  addToCart: (plant: Plant, quantity?: number) => void;
  removeFromCart: (plantId: string) => void;
  updateQuantity: (plantId: string, quantity: number) => void;
  incrementQuantity: (plantId: string) => void;
  decrementQuantity: (plantId: string) => void;
  clearCart: () => void;
  getItemQuantity: (plantId: string) => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  // Initial State
  items: [],
  isLoading: false,

  // Computed
  totalItems: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  totalPrice: () => {
    return get().items.reduce((sum, item) => {
      const price = item.plant.basePrice;
      return sum + price * item.quantity;
    }, 0);
  },

  // Actions
  addToCart: (plant, quantity = 1) => {
    set((state) => {
      const existingItem = state.items.find(
        (item) => item.plant.id === plant.id
      );

      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.plant.id === plant.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        };
      }

      return {
        items: [
          ...state.items,
          {
            id: `cart_${plant.id}_${Date.now()}`,
            plant,
            quantity,
          },
        ],
      };
    });
  },

  removeFromCart: (plantId) => {
    set((state) => ({
      items: state.items.filter((item) => item.plant.id !== plantId),
    }));
  },

  updateQuantity: (plantId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(plantId);
      return;
    }

    set((state) => ({
      items: state.items.map((item) =>
        item.plant.id === plantId ? { ...item, quantity } : item
      ),
    }));
  },

  incrementQuantity: (plantId) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.plant.id === plantId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ),
    }));
  },

  decrementQuantity: (plantId) => {
    const item = get().items.find((i) => i.plant.id === plantId);
    if (item && item.quantity <= 1) {
      get().removeFromCart(plantId);
    } else {
      set((state) => ({
        items: state.items.map((i) =>
          i.plant.id === plantId
            ? { ...i, quantity: i.quantity - 1 }
            : i
        ),
      }));
    }
  },

  clearCart: () => set({ items: [] }),

  getItemQuantity: (plantId) => {
    const item = get().items.find((i) => i.plant.id === plantId);
    return item?.quantity ?? 0;
  },
}));
