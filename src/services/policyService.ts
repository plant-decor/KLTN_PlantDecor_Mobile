import api from './api';
import {
  GetPolicyEnumsResponse,
  GetActivePoliciesResponse,
  GetPolicyDetailResponse,
} from '../types';

export const policyService = {
  getPolicyEnums: async () => {
    const response = await api.get<GetPolicyEnumsResponse>('/system/enums/policy');
    return response.data;
  },

  getAllActivePolicies: async () => {
    const response = await api.get<GetActivePoliciesResponse>('/policy-contents');
    return response.data;
  },

  getPoliciesByCategory: async (category: number) => {
    const response = await api.get<GetActivePoliciesResponse>(`/policy-contents/categories/${category}`);
    return response.data;
  },

  getPolicyDetail: async (id: number) => {
    const response = await api.get<GetPolicyDetailResponse>(`/policy-contents/${id}`);
    return response.data;
  }
};
