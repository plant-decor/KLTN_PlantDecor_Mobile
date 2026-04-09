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
  pendingByKey: Record<string, boolean>;
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
  pendingByKey: {},
  clearStatus: () => set({ statusByKey: {}, pendingByKey: {} }),
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

    const targetByKey = new Map<string, WishlistTarget>();
    targets.forEach((target) => {
      targetByKey.set(getWishlistKey(target.itemType, target.itemId), target);
    });

    const { statusByKey, pendingByKey } = get();
    const pendingTargets = Array.from(targetByKey.entries())
      .filter(
        ([key]) => statusByKey[key] === undefined && pendingByKey[key] !== true
      )
      .map(([, target]) => target);

    if (pendingTargets.length === 0) {
      return;
    }

    set((state) => {
      const nextPending = { ...state.pendingByKey };
      pendingTargets.forEach((target) => {
        nextPending[getWishlistKey(target.itemType, target.itemId)] = true;
      });
      return { pendingByKey: nextPending };
    });

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
      const nextPending = { ...state.pendingByKey };
      results.forEach((result) => {
        next[result.key] = result.value;
        delete nextPending[result.key];
      });
      return { statusByKey: next, pendingByKey: nextPending };
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
