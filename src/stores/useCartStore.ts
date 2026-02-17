import { create } from 'zustand';
import { CartItem, Product } from '../types';

interface CartState {
  // State
  items: CartItem[];
  isLoading: boolean;

  // Computed (via getters)
  totalItems: () => number;
  totalPrice: () => number;

  // Actions
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  incrementQuantity: (productId: string) => void;
  decrementQuantity: (productId: string) => void;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
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
      const price = item.product.salePrice ?? item.product.price;
      return sum + price * item.quantity;
    }, 0);
  },

  // Actions
  addToCart: (product, quantity = 1) => {
    set((state) => {
      const existingItem = state.items.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        };
      }

      return {
        items: [
          ...state.items,
          {
            id: `cart_${product.id}_${Date.now()}`,
            product,
            quantity,
          },
        ],
      };
    });
  },

  removeFromCart: (productId) => {
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }

    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      ),
    }));
  },

  incrementQuantity: (productId) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ),
    }));
  },

  decrementQuantity: (productId) => {
    const item = get().items.find((i) => i.product.id === productId);
    if (item && item.quantity <= 1) {
      get().removeFromCart(productId);
    } else {
      set((state) => ({
        items: state.items.map((i) =>
          i.product.id === productId
            ? { ...i, quantity: i.quantity - 1 }
            : i
        ),
      }));
    }
  },

  clearCart: () => set({ items: [] }),

  getItemQuantity: (productId) => {
    const item = get().items.find((i) => i.product.id === productId);
    return item?.quantity ?? 0;
  },
}));
