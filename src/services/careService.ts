import { API } from '../constants';
import {
  CareServicePackage,
  CreateServiceRegistrationRequest,
  CreateServiceRegistrationResponse,
  GetCareServicePackageDetailResponse,
  GetCareServicePackagesResponse,
  GetMyServiceRegistrationsPayload,
  GetMyServiceRegistrationsRequest,
  GetMyServiceRegistrationsResponse,
  GetNurseriesNearbyRequest,
  GetNurseriesNearbyResponse,
  GetServiceRegistrationDetailResponse,
  GetShiftsResponse,
  NurseryNearby,
  ServiceRegistration,
  ServiceRegistrationShift,
} from '../types';
import api from './api';

const buildNearbyNurseriesParams = (request: GetNurseriesNearbyRequest) => {
  const params: Record<string, number> = {
    lat: request.lat,
    lng: request.lng,
  };

  if (typeof request.radiusKm === 'number') {
    params.radiusKm = request.radiusKm;
  }

  if (typeof request.packageId === 'number') {
    params.packageId = request.packageId;
  }

  return params;
};

const buildMyServiceRegistrationsParams = (
  request?: GetMyServiceRegistrationsRequest
) => {
  if (!request) {
    return undefined;
  }

  const params: Record<string, number> = {};

  if (typeof request.PageNumber === 'number') {
    params.PageNumber = request.PageNumber;
  }

  if (typeof request.PageSize === 'number') {
    params.PageSize = request.PageSize;
  }

  if (typeof request.Skip === 'number') {
    params.Skip = request.Skip;
  }

  if (typeof request.Take === 'number') {
    params.Take = request.Take;
  }

  if (typeof request.status === 'number') {
    params.status = request.status;
  }

  return Object.keys(params).length > 0 ? params : undefined;
};

export const careService = {
  getCareServicePackages: async (): Promise<CareServicePackage[]> => {
    try {
      const response = await api.get<GetCareServicePackagesResponse>(
        API.ENDPOINTS.CARE_SERVICE_PACKAGES
      );
      return response.data.payload ?? [];
    } catch (error: any) {
      console.error(
        'getCareServicePackages error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getCareServicePackageDetail: async (id: number): Promise<CareServicePackage> => {
    try {
      const response = await api.get<GetCareServicePackageDetailResponse>(
        API.ENDPOINTS.CARE_SERVICE_PACKAGES_DETAIL(id)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error(
        'getCareServicePackageDetail error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getNurseriesNearby: async (
    request: GetNurseriesNearbyRequest
  ): Promise<NurseryNearby[]> => {
    try {
      const response = await api.get<GetNurseriesNearbyResponse>(
        API.ENDPOINTS.NURSERIES_NEARBY,
        {
          params: buildNearbyNurseriesParams(request),
        }
      );
      return response.data.payload ?? [];
    } catch (error: any) {
      console.error('getNurseriesNearby error:', error.response?.data || error.message);
      throw error;
    }
  },

  getShifts: async (): Promise<ServiceRegistrationShift[]> => {
    try {
      const response = await api.get<GetShiftsResponse>(API.ENDPOINTS.SHIFTS);
      return response.data.payload ?? [];
    } catch (error: any) {
      console.error('getShifts error:', error.response?.data || error.message);
      throw error;
    }
  },

  getMyServiceRegistrations: async (
    request?: GetMyServiceRegistrationsRequest
  ): Promise<GetMyServiceRegistrationsPayload> => {
    try {
      const response = await api.get<GetMyServiceRegistrationsResponse>(
        API.ENDPOINTS.MY_SERVICE_REGISTRATIONS,
        {
          params: buildMyServiceRegistrationsParams(request),
        }
      );

      return (
        response.data.payload ?? {
          items: [],
          totalCount: 0,
          pageNumber: request?.PageNumber ?? 1,
          pageSize: request?.PageSize ?? 10,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false,
        }
      );
    } catch (error: any) {
      console.error(
        'getMyServiceRegistrations error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getServiceRegistrationDetail: async (id: number): Promise<ServiceRegistration> => {
    try {
      const response = await api.get<GetServiceRegistrationDetailResponse>(
        API.ENDPOINTS.SERVICE_REGISTRATION_DETAIL(id)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error(
        'getServiceRegistrationDetail error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },

  createServiceRegistration: async (
    request: CreateServiceRegistrationRequest
  ): Promise<ServiceRegistration> => {
    try {
      const response = await api.post<CreateServiceRegistrationResponse>(
        API.ENDPOINTS.SERVICE_REGISTRATION,
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error(
        'createServiceRegistration error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },
};
