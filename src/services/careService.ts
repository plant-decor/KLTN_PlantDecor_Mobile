import { API } from '../constants';
import {
  CareServicePackage,
  CheckInServiceProgressResponse,
  CheckOutServiceProgressRequest,
  CheckOutServiceProgressResponse,
  CreateServiceRegistrationRequest,
  CreateServiceRegistrationResponse,
  GetCareServicePackageDetailResponse,
  GetCareServicePackageWithNurseriesResponse,
  CareServicePackageWithNurseries,
  GetCareServicePackagesResponse,
  GetMyServiceRegistrationsPayload,
  GetMyServiceRegistrationsRequest,
  GetMyServiceRegistrationsResponse,
  GetNurseriesNearbyRequest,
  GetNurseriesNearbyResponse,
  GetServiceProgressDetailResponse,
  GetServiceProgressMyScheduleRequest,
  GetServiceProgressMyScheduleResponse,
  GetServiceProgressesByRegistrationResponse,
  GetServiceProgressTodayResponse,
  GetServiceRegistrationDetailResponse,
  GetShiftsResponse,
  Nursery,
  NurseryNearby,
  ReportServiceProgressIncidentRequest,
  ReportServiceProgressIncidentResponse,
  SearchNurseriesRequest,
  SearchNurseriesResponse,
  ServiceProgress,
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

const buildMyScheduleParams = (request?: GetServiceProgressMyScheduleRequest) => {
  if (!request) {
    return undefined;
  }

  const params: Record<string, string> = {};
  const from = typeof request.from === 'string' ? request.from.trim() : '';
  const to = typeof request.to === 'string' ? request.to.trim() : '';

  if (from.length > 0) {
    params.from = from;
  }

  if (to.length > 0) {
    params.to = to;
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

  getCareServicePackageWithNurseries: async (
    id: number
  ): Promise<CareServicePackageWithNurseries> => {
    try {
      const response = await api.get<GetCareServicePackageWithNurseriesResponse>(
        API.ENDPOINTS.CARE_SERVICE_PACKAGE_WITH_NURSERIES(id)
      );

      return response.data.payload;
    } catch (error: any) {
      console.error(
        'getCareServicePackageWithNurseries error:',
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

  getAllNurseries: async (request?: SearchNurseriesRequest): Promise<Nursery[]> => {
    try {
      const response = await api.post<SearchNurseriesResponse>(
        API.ENDPOINTS.NURSERIES,
        request ?? {
          pagination: {
            pageNumber: 0,
            pageSize: 0,
          },
          isActive: true,
        }
      );

      return response.data.payload?.items ?? [];
    } catch (error: any) {
      console.error('getAllNurseries error:', error.response?.data || error.message);
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

  getCaretakerAssignedServiceRegistrations: async (
    request?: GetMyServiceRegistrationsRequest
  ): Promise<GetMyServiceRegistrationsPayload> => {
    try {
      const response = await api.get<GetMyServiceRegistrationsResponse>(
        API.ENDPOINTS.CARETAKER_ASSIGNED_SERVICE_REGISTRATIONS,
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
        'getCaretakerAssignedServiceRegistrations error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getServiceProgressToday: async (): Promise<ServiceProgress[]> => {
    try {
      const response = await api.get<GetServiceProgressTodayResponse>(
        API.ENDPOINTS.SERVICE_PROGRESS_TODAY
      );
      return response.data.payload ?? [];
    } catch (error: any) {
      console.error('getServiceProgressToday error:', error.response?.data || error.message);
      throw error;
    }
  },

  getServiceProgressMySchedule: async (
    request?: GetServiceProgressMyScheduleRequest
  ): Promise<ServiceProgress[]> => {
    try {
      const response = await api.get<GetServiceProgressMyScheduleResponse>(
        API.ENDPOINTS.SERVICE_PROGRESS_MY_SCHEDULE,
        {
          params: buildMyScheduleParams(request),
        }
      );
      return response.data.payload ?? [];
    } catch (error: any) {
      console.error(
        'getServiceProgressMySchedule error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getServiceProgressDetail: async (id: number): Promise<ServiceProgress> => {
    try {
      const response = await api.get<GetServiceProgressDetailResponse>(
        API.ENDPOINTS.SERVICE_PROGRESS_DETAIL(id)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getServiceProgressDetail error:', error.response?.data || error.message);
      throw error;
    }
  },

  getServiceProgressesByRegistration: async (
    registrationId: number
  ): Promise<ServiceProgress[]> => {
    try {
      const response = await api.get<GetServiceProgressesByRegistrationResponse>(
        API.ENDPOINTS.SERVICE_PROGRESSES_BY_REGISTRATION(registrationId)
      );
      return response.data.payload ?? [];
    } catch (error: any) {
      console.error(
        'getServiceProgressesByRegistration error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },

  checkInServiceProgress: async (id: number): Promise<ServiceProgress> => {
    try {
      const response = await api.post<CheckInServiceProgressResponse>(
        API.ENDPOINTS.SERVICE_PROGRESS_CHECK_IN(id)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('checkInServiceProgress error:', error.response?.data || error.message);
      throw error;
    }
  },

  checkOutServiceProgress: async (
    id: number,
    request: CheckOutServiceProgressRequest
  ): Promise<ServiceProgress> => {
    const normalizedUri = request.evidenceImage?.uri?.trim();
    if (!normalizedUri) {
      throw new Error('Invalid evidence image uri');
    }

    const inferredFileName = normalizedUri.split('/').pop() || `evidence-${Date.now()}.jpg`;
    const fileName = request.evidenceImage.fileName?.trim() || inferredFileName;
    const mimeType = request.evidenceImage.mimeType?.trim() || 'image/jpeg';

    const formData = new FormData();
    const description = typeof request.Description === 'string' ? request.Description.trim() : '';

    if (description.length > 0) {
      formData.append('Description', description);
    }

    formData.append(
      'evidenceImage',
      {
        uri: normalizedUri,
        name: fileName,
        type: mimeType,
      } as any
    );

    try {
      const response = await api.post<CheckOutServiceProgressResponse>(
        API.ENDPOINTS.SERVICE_PROGRESS_CHECK_OUT(id),
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('checkOutServiceProgress error:', error.response?.data || error.message);
      throw error;
    }
  },

  reportServiceProgressIncident: async (
    id: number,
    request: ReportServiceProgressIncidentRequest
  ): Promise<ServiceProgress> => {
    const normalizedUri = request.incidentImage?.uri?.trim();
    if (!normalizedUri) {
      throw new Error('Invalid incident image uri');
    }

    const inferredFileName = normalizedUri.split('/').pop() || `incident-${Date.now()}.jpg`;
    const fileName = request.incidentImage.fileName?.trim() || inferredFileName;
    const mimeType = request.incidentImage.mimeType?.trim() || 'image/jpeg';

    const formData = new FormData();
    const incidentReason =
      typeof request.IncidentReason === 'string' ? request.IncidentReason.trim() : '';

    if (incidentReason.length > 0) {
      formData.append('IncidentReason', incidentReason);
    }

    formData.append(
      'incidentImage',
      {
        uri: normalizedUri,
        name: fileName,
        type: mimeType,
      } as any
    );

    try {
      const response = await api.post<ReportServiceProgressIncidentResponse>(
        API.ENDPOINTS.SERVICE_PROGRESS_INCIDENT_REPORT(id),
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data.payload;
    } catch (error: any) {
      console.error(
        'reportServiceProgressIncident error:',
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

  cancelServiceRegistration: async (
    id: number,
    cancelReason?: string
  ): Promise<ServiceRegistration> => {
    try {
      const trimmedReason = typeof cancelReason === 'string' ? cancelReason.trim() : '';
      const response = await api.post<GetServiceRegistrationDetailResponse>(
        API.ENDPOINTS.CANCEL_SERVICE_REGISTRATION(id),
        undefined,
        {
          params:
            trimmedReason.length > 0
              ? {
                  cancelReason: trimmedReason,
                }
              : undefined,
        }
      );
      return response.data.payload;
    } catch (error: any) {
      console.error(
        'cancelServiceRegistration error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },
};
