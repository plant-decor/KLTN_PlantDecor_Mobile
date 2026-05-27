import { create } from 'zustand';
import {
  SubscriptionRecord,
  TierPackage,
  TierThreshold,
  UserAIQuotaStatus,
  UserTierProgressStatus,
} from '../types';
import { subscriptionService } from '../services';

type SubscriptionState = {
  tierPackages: TierPackage[];
  tierThresholds: TierThreshold[];
  quotaStatus: UserAIQuotaStatus | null;
  tierProgress: UserTierProgressStatus | null;
  subscriptionHistory: SubscriptionRecord[];
  isLoading: boolean;
  error: string | null;
  fetchTierPackages: () => Promise<TierPackage[]>;
  fetchTierThresholds: () => Promise<TierThreshold[]>;
  fetchQuotaStatus: () => Promise<UserAIQuotaStatus | null>;
  fetchTierProgress: () => Promise<UserTierProgressStatus | null>;
  fetchSubscriptionHistory: () => Promise<SubscriptionRecord[]>;
  purchaseTierPackage: (tierPackageId: number) => Promise<{ paymentId: number; paymentUrl: string }>;
  clear: () => void;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tierPackages: [],
  tierThresholds: [],
  quotaStatus: null,
  tierProgress: null,
  subscriptionHistory: [],
  isLoading: false,
  error: null,

  fetchTierPackages: async () => {
    set({ isLoading: true, error: null });
    try {
      const tierPackages = await subscriptionService.getPublicTierPackages();
      set({ tierPackages, isLoading: false });
      return tierPackages;
    } catch (error) {
      set({ isLoading: false, error: 'Unable to load tier packages.' });
      throw error;
    }
  },

  fetchTierThresholds: async () => {
    set({ isLoading: true, error: null });
    try {
      const tierThresholds = await subscriptionService.getPublicTierThresholds();
      set({ tierThresholds, isLoading: false });
      return tierThresholds;
    } catch (error) {
      set({ isLoading: false, error: 'Unable to load tier thresholds.' });
      throw error;
    }
  },

  fetchQuotaStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const quotaStatus = await subscriptionService.getUserAIQuota();
      set({ quotaStatus, isLoading: false });
      return quotaStatus;
    } catch (error) {
      set({ isLoading: false, error: 'Unable to load AI quota status.' });
      throw error;
    }
  },

  fetchTierProgress: async () => {
    set({ isLoading: true, error: null });
    try {
      const tierProgress = await subscriptionService.getUserTierProgress();
      set({ tierProgress, isLoading: false });
      return tierProgress;
    } catch (error) {
      set({ isLoading: false, error: 'Unable to load tier progress.' });
      throw error;
    }
  },

  fetchSubscriptionHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const subscriptionHistory = await subscriptionService.getUserSubscriptions();
      set({ subscriptionHistory, isLoading: false });
      return subscriptionHistory;
    } catch (error) {
      set({ isLoading: false, error: 'Unable to load subscriptions.' });
      throw error;
    }
  },

  purchaseTierPackage: async (tierPackageId: number) => {
    const result = await subscriptionService.createTierPackagePayment({ tierPackageId });
    return result;
  },

  clear: () => {
    set({
      tierPackages: [],
      tierThresholds: [],
      quotaStatus: null,
      tierProgress: null,
      subscriptionHistory: [],
      isLoading: false,
      error: null,
    });
  },
}));