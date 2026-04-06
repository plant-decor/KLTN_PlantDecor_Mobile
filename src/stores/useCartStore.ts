import { create } from 'zustand';
import {
  AddCartItemRequest,
  CartApiItem,
  CartItem,
  GetCartPayload,
  GetCartRequest,
  Plant,
  UpdateCartItemRequest,
} from '../types';
import { cartService } from '../services/cartService';

type CartMeta = Omit<GetCartPayload, 'items'>;

type AddToCartOptions = {
  commonPlantId?: number | null;
  nurseryPlantComboId?: number | null;
  nurseryMaterialId?: number | null;
};

interface CartState {
  // State
  items: CartItem[];
  cartItems: CartApiItem[];
  cartMeta: CartMeta | null;
  hasLoadedCart: boolean;
  isLoading: boolean;

  // Computed (via getters)
  totalItems: () => number;
  totalPrice: () => number;

  // Actions
  addToCart: (
    plant: Plant,
    quantity?: number,
    options?: AddToCartOptions
  ) => Promise<CartApiItem | null>;
  fetchCart: (params?: GetCartRequest) => Promise<void>;
  removeFromCart: (plantId: string) => void;
  updateQuantity: (plantId: string, quantity: number) => void;
  updateCartItem: (cartItemId: number, quantity: number) => Promise<void>;
  removeCartItem: (cartItemId: number) => Promise<void>;
  incrementQuantity: (plantId: string) => void;
  decrementQuantity: (plantId: string) => void;
  clearCart: () => Promise<void>;
  getItemQuantity: (plantId: string) => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  // Initial State
  items: [],
  cartItems: [],
  cartMeta: null,
  hasLoadedCart: false,
  isLoading: false,

  // Computed
  totalItems: () => {
    const { cartItems, items, hasLoadedCart } = get();
    if (hasLoadedCart) {
      return cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },

  totalPrice: () => {
    const { cartItems, items, hasLoadedCart } = get();
    if (hasLoadedCart) {
      return cartItems.reduce(
        (sum, item) => sum + (item.subTotal ?? item.price * item.quantity),
        0
      );
    }
    return items.reduce((sum, item) => {
      const price = item.plant.basePrice;
      return sum + price * item.quantity;
    }, 0);
  },

  // Actions
  addToCart: async (plant, quantity = 1, options) => {
    if (plant.isUniqueInstance) {
      console.warn('[Cart] Unique plant instances cannot be added to cart.');
      return null;
    }

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

    const toSafeId = (value: unknown) => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : 0;
    };

    const commonPlantId = toSafeId(
      options?.commonPlantId ?? plant.commonPlantId ?? plant.id
    );

    const request: AddCartItemRequest = {
      commonPlantId,
      nurseryPlantComboId: null,
      nurseryMaterialId: null,
      quantity,
    };
    console.log('[Cart] Adding to cart with request:', request);

    try {
      const payload = await cartService.addCartItem(request);
      set((state) => {
        const existingIndex = state.cartItems.findIndex(
          (item) => item.id === payload.id
        );
        const nextItems = [...state.cartItems];

        if (existingIndex >= 0) {
          nextItems[existingIndex] = payload;
        } else {
          nextItems.unshift(payload);
        }

        const cartMeta = state.cartMeta
          ? {
              ...state.cartMeta,
              totalCount:
                existingIndex >= 0
                  ? state.cartMeta.totalCount
                  : state.cartMeta.totalCount + 1,
            }
          : state.cartMeta;

        return {
          cartItems: nextItems,
          cartMeta,
          hasLoadedCart: true,
        };
      });

      return payload;
    } catch (error: any) {
      console.warn(
        '[Cart] addToCart API failed:',
        error?.response?.data || error?.message || error
      );
      return null;
    }
  },

  fetchCart: async (params) => {
    set({ isLoading: true });
    try {
      const payload = await cartService.getCart(params);
      const { items, ...meta } = payload;
      set({
        cartItems: items ?? [],
        cartMeta: meta,
        hasLoadedCart: true,
        isLoading: false,
        items: [],
      });
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
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

  updateCartItem: async (cartItemId, quantity) => {
    const request: UpdateCartItemRequest = { quantity };
    const payload = await cartService.updateCartItem(cartItemId, request);

    set((state) => {
      const nextItems = state.cartItems.map((item) =>
        item.id === payload.id ? payload : item
      );
      return {
        cartItems: nextItems,
        hasLoadedCart: true,
      };
    });
  },

  removeCartItem: async (cartItemId) => {
    await cartService.removeCartItem(cartItemId);

    set((state) => {
      const hasItem = state.cartItems.some((item) => item.id === cartItemId);
      const nextItems = state.cartItems.filter((item) => item.id !== cartItemId);
      const cartMeta =
        state.cartMeta && hasItem
          ? {
              ...state.cartMeta,
              totalCount: Math.max(0, state.cartMeta.totalCount - 1),
            }
          : state.cartMeta;

      return {
        cartItems: nextItems,
        cartMeta,
        hasLoadedCart: true,
      };
    });
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

  clearCart: async () => {
    await cartService.clearCart();
    set({ items: [], cartItems: [], cartMeta: null, hasLoadedCart: true });
  },

  getItemQuantity: (plantId) => {
    const item = get().items.find((i) => i.plant.id === plantId);
    return item?.quantity ?? 0;
  },
}));
