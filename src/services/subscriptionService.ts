import { API } from '../constants';
import {
  CreateTierPackagePaymentRequest,
  CreateTierPackagePaymentResponse,
  GetTierPackageResponse,
  GetTierPackagesResponse,
  GetTierThresholdsResponse,
  GetUserAIQuotaResponse,
  GetUserSubscriptionsResponse,
  TierPackage,
  TierThreshold,
  UserAIQuotaStatus,
  SubscriptionRecord,
} from '../types';
import api from './api';

type ApiEnvelope<T> = {
  payload?: T;
  data?: T;
};

const getPayload = <T>(response: ApiEnvelope<T>): T => {
  const body = response.payload ?? response.data;

  if (body === undefined || body === null) {
    throw new Error('Invalid API response: missing payload');
  }

  return body;
};

export const subscriptionService = {
  getPublicTierPackages: async (): Promise<TierPackage[]> => {
    const response = await api.get<GetTierPackagesResponse>(API.ENDPOINTS.PUBLIC_TIER_PACKAGES);
    return getPayload(response.data);
  },

  getPublicTierPackageDetail: async (id: number): Promise<TierPackage> => {
    const response = await api.get<GetTierPackageResponse>(
      API.ENDPOINTS.PUBLIC_TIER_PACKAGE_DETAIL(id)
    );
    return getPayload(response.data);
  },

  getPublicTierThresholds: async (): Promise<TierThreshold[]> => {
    const response = await api.get<GetTierThresholdsResponse>(API.ENDPOINTS.PUBLIC_TIER_THRESHOLDS);
    return getPayload(response.data);
  },

  getUserAIQuota: async (): Promise<UserAIQuotaStatus> => {
    const response = await api.get<GetUserAIQuotaResponse>(API.ENDPOINTS.USER_AI_QUOTA);
    return getPayload(response.data);
  },

  getUserSubscriptions: async (): Promise<SubscriptionRecord[]> => {
    const response = await api.get<GetUserSubscriptionsResponse>(API.ENDPOINTS.USER_SUBSCRIPTIONS);
    return getPayload(response.data);
  },

  createTierPackagePayment: async (
    request: CreateTierPackagePaymentRequest
  ): Promise<CreateTierPackagePaymentResponse['payload']> => {
    const response = await api.post<CreateTierPackagePaymentResponse>(
      API.ENDPOINTS.PAYMENT_CREATE_TIER_PACKAGE,
      request
    );

    return getPayload(response.data);
  },
};