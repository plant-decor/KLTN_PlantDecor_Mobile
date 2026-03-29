import { create } from 'zustand';
import { wishlistService } from '../services/wishlistService';
import { WishlistItemType } from '../types';
import { getWishlistKey } from '../utils';

type WishlistTarget = {
  itemType: WishlistItemType;
  itemId: number;
};

interface WishlistState {
  statusByKey: Record<string, boolean>;
  clearStatus: () => void;
  setStatuses: (targets: WishlistTarget[], value: boolean) => void;
  ensureStatus: (targets: WishlistTarget[]) => Promise<void>;
  toggleWishlist: (
    itemType: WishlistItemType,
    itemId: number
  ) => Promise<{ wasInWishlist: boolean }>;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  statusByKey: {},
  clearStatus: () => set({ statusByKey: {} }),
  setStatuses: (targets, value) => {
    if (targets.length === 0) {
      return;
    }

    set((state) => {
      const next = { ...state.statusByKey };
      targets.forEach((target) => {
        next[getWishlistKey(target.itemType, target.itemId)] = value;
      });
      return { statusByKey: next };
    });
  },
  ensureStatus: async (targets) => {
    if (targets.length === 0) {
      return;
    }

    const statusByKey = get().statusByKey;
    const pendingTargets = targets.filter(
      (target) =>
        statusByKey[getWishlistKey(target.itemType, target.itemId)] === undefined
    );

    if (pendingTargets.length === 0) {
      return;
    }

    const results = await Promise.all(
      pendingTargets.map(async (target) => {
        const key = getWishlistKey(target.itemType, target.itemId);
        try {
          const isInWishlist = await wishlistService.checkWishlistItem(
            target.itemType,
            target.itemId
          );
          return { key, value: isInWishlist };
        } catch {
          return { key, value: false };
        }
      })
    );

    set((state) => {
      const next = { ...state.statusByKey };
      results.forEach((result) => {
        next[result.key] = result.value;
      });
      return { statusByKey: next };
    });
  },
  toggleWishlist: async (itemType, itemId) => {
    const wishlistKey = getWishlistKey(itemType, itemId);
    const wasInWishlist = get().statusByKey[wishlistKey] ?? false;

    set((state) => ({
      statusByKey: {
        ...state.statusByKey,
        [wishlistKey]: !wasInWishlist,
      },
    }));

    try {
      if (wasInWishlist) {
        await wishlistService.removeWishlistItem(itemType, itemId);
      } else {
        await wishlistService.addWishlistItem(itemType, itemId);
      }
      return { wasInWishlist };
    } catch (error) {
      set((state) => ({
        statusByKey: {
          ...state.statusByKey,
          [wishlistKey]: wasInWishlist,
        },
      }));
      throw error;
    }
  },
}));
