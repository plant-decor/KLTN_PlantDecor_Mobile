import { API } from '../constants';
import {
  CompleteDesignTaskRequest,
  CompleteDesignTaskResponse,
  CreateDesignRegistrationRequest,
  CreateDesignRegistrationResponse,
  DesignPackageMaterial,
  DesignRegistration,
  DesignTask,
  DesignTemplate,
  DesignTemplateTier,
  DesignTemplateTierItem,
  DesignTemplateTierNursery,
  GetDesignRegistrationDetailResponse,
  GetDesignTaskDetailResponse,
  GetDesignTaskPackageMaterialsResponse,
  GetDesignTasksByRegistrationResponse,
  GetDesignTemplateTierDetailResponse,
  GetDesignTemplateTierNurseriesResponse,
  GetDesignTemplateTiersRequest,
  GetDesignTemplateTiersResponse,
  GetDesignTemplatesResponse,
  GetMyDesignRegistrationsPayload,
  GetMyDesignRegistrationsRequest,
  GetMyDesignRegistrationsResponse,
  GetMyDesignTasksPayload,
  GetMyDesignTasksRequest,
  GetMyDesignTasksResponse,
  ReportDesignTaskMaterialUsageRequest,
  ReportDesignTaskMaterialUsageResponse,
  UpdateDesignSurveyInfoRequest,
} from '../types';
import api from './api';
import { plantService } from './plantService';

const plantNameCache = new Map<number, string>();
const materialNameCache = new Map<number, string>();

const buildRegistrationQueryParams = (request?: GetMyDesignRegistrationsRequest) => {
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

const buildTaskQueryParams = (request?: GetMyDesignTasksRequest) => {
  if (!request) {
    return undefined;
  }

  const params: Record<string, string | number> = {};

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

  const from = typeof request.from === 'string' ? request.from.trim() : '';
  const to = typeof request.to === 'string' ? request.to.trim() : '';

  if (from) {
    params.from = from;
  }
  if (to) {
    params.to = to;
  }

  return Object.keys(params).length > 0 ? params : undefined;
};

const buildTierQueryParams = (request?: GetDesignTemplateTiersRequest) => {
  if (!request) {
    return undefined;
  }

  const params: Record<string, string | number | boolean> = {};

  if (typeof request.designTemplateId === 'number') {
    params.designTemplateId = request.designTemplateId;
  }

  if (typeof request.includeInactive === 'boolean') {
    params.includeInactive = request.includeInactive;
  }

  return Object.keys(params).length > 0 ? params : undefined;
};

const toDefaultFileName = (uri: string, fallbackPrefix: string) =>
  uri.split('/').pop() || `${fallbackPrefix}-${Date.now()}.jpg`;

const appendImagePart = (
  formData: FormData,
  fieldName: string,
  file: {
    uri: string;
    fileName?: string;
    mimeType?: string;
  },
  fallbackPrefix: string
) => {
  const normalizedUri = file.uri.trim();
  if (!normalizedUri) {
    throw new Error(`Invalid ${fieldName} uri`);
  }

  formData.append(
    fieldName,
    {
      uri: normalizedUri,
      name: file.fileName?.trim() || toDefaultFileName(normalizedUri, fallbackPrefix),
      type: file.mimeType?.trim() || 'image/jpeg',
    } as any
  );
};

const emptyRegistrationPayload = (
  request?: GetMyDesignRegistrationsRequest
): GetMyDesignRegistrationsPayload => ({
  items: [],
  totalCount: 0,
  pageNumber: request?.PageNumber ?? 1,
  pageSize: request?.PageSize ?? 10,
  totalPages: 1,
  hasPrevious: false,
  hasNext: false,
});

const emptyTaskPayload = (request?: GetMyDesignTasksRequest): GetMyDesignTasksPayload => ({
  items: [],
  totalCount: 0,
  pageNumber: request?.PageNumber ?? 1,
  pageSize: request?.PageSize ?? 10,
  totalPages: 1,
  hasPrevious: false,
  hasNext: false,
});

const resolvePlantName = async (plantId: number): Promise<string> => {
  const cached = plantNameCache.get(plantId);
  if (cached) {
    return cached;
  }

  try {
    const payload = await plantService.getPlantDetail(plantId);
    const value = payload?.name?.trim() || payload?.specificName?.trim() || `Plant #${plantId}`;
    plantNameCache.set(plantId, value);
    return value;
  } catch {
    return `Plant #${plantId}`;
  }
};

const resolveMaterialName = async (materialId: number): Promise<string> => {
  const cached = materialNameCache.get(materialId);
  if (cached) {
    return cached;
  }

  try {
    const payload = await plantService.getMaterialDetail(materialId);
    const value = payload?.name?.trim() || `Material #${materialId}`;
    materialNameCache.set(materialId, value);
    return value;
  } catch {
    return `Material #${materialId}`;
  }
};

export const designService = {
  getDesignTemplates: async (): Promise<DesignTemplate[]> => {
    const response = await api.get<GetDesignTemplatesResponse>(API.ENDPOINTS.PUBLIC_DESIGN_TEMPLATES);
    return response.data.payload ?? [];
  },

  getDesignTemplateTiers: async (
    request?: GetDesignTemplateTiersRequest
  ): Promise<DesignTemplateTier[]> => {
    const response = await api.get<GetDesignTemplateTiersResponse>(
      API.ENDPOINTS.PUBLIC_DESIGN_TEMPLATE_TIERS,
      {
        params: buildTierQueryParams(request),
      }
    );
    return response.data.payload ?? [];
  },

  getDesignTemplateTierDetail: async (id: number): Promise<DesignTemplateTier> => {
    const response = await api.get<GetDesignTemplateTierDetailResponse>(
      API.ENDPOINTS.PUBLIC_DESIGN_TEMPLATE_TIER_DETAIL(id)
    );
    return response.data.payload;
  },

  getDesignTemplateTierNurseries: async (id: number): Promise<DesignTemplateTierNursery[]> => {
    const response = await api.get<GetDesignTemplateTierNurseriesResponse>(
      API.ENDPOINTS.PUBLIC_DESIGN_TEMPLATE_TIER_NURSERIES(id)
    );
    return response.data.payload ?? [];
  },

  createDesignRegistration: async (
    request: CreateDesignRegistrationRequest
  ): Promise<DesignRegistration> => {
    const response = await api.post<CreateDesignRegistrationResponse>(
      API.ENDPOINTS.DESIGN_REGISTRATIONS,
      request
    );
    return response.data.payload;
  },

  getMyDesignRegistrations: async (
    request?: GetMyDesignRegistrationsRequest
  ): Promise<GetMyDesignRegistrationsPayload> => {
    const response = await api.get<GetMyDesignRegistrationsResponse>(
      API.ENDPOINTS.MY_DESIGN_REGISTRATIONS,
      {
        params: buildRegistrationQueryParams(request),
      }
    );

    return response.data.payload ?? emptyRegistrationPayload(request);
  },

  getMyCaretakerDesignRegistrations: async (
    request?: GetMyDesignRegistrationsRequest
  ): Promise<GetMyDesignRegistrationsPayload> => {
    const response = await api.get<GetMyDesignRegistrationsResponse>(
      API.ENDPOINTS.CARETAKER_MY_DESIGN_REGISTRATIONS,
      {
        params: buildRegistrationQueryParams(request),
      }
    );

    return response.data.payload ?? emptyRegistrationPayload(request);
  },

  getDesignRegistrationDetail: async (id: number): Promise<DesignRegistration> => {
    const response = await api.get<GetDesignRegistrationDetailResponse>(
      API.ENDPOINTS.DESIGN_REGISTRATION_DETAIL(id)
    );
    return response.data.payload;
  },

  cancelDesignRegistration: async (
    id: number,
    cancelReason?: string
  ): Promise<DesignRegistration> => {
    const trimmedReason = typeof cancelReason === 'string' ? cancelReason.trim() : '';
    const response = await api.post<GetDesignRegistrationDetailResponse>(
      API.ENDPOINTS.CANCEL_DESIGN_REGISTRATION(id),
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
  },

  updateDesignSurveyInfo: async (
    id: number,
    request: UpdateDesignSurveyInfoRequest
  ): Promise<DesignRegistration> => {
    const formData = new FormData();
    formData.append('Width', String(request.Width));
    formData.append('Length', String(request.Length));
    if (request.currentStateImage) {
      appendImagePart(formData, 'currentStateImage', request.currentStateImage, 'survey');
    }

    const response = await api.put<GetDesignRegistrationDetailResponse>(
      API.ENDPOINTS.DESIGN_REGISTRATION_SURVEY_INFO(id),
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data.payload;
  },

  getMyDesignTasks: async (request?: GetMyDesignTasksRequest): Promise<GetMyDesignTasksPayload> => {
    const response = await api.get<GetMyDesignTasksResponse>(API.ENDPOINTS.MY_DESIGN_TASKS, {
      params: buildTaskQueryParams(request),
    });

    return response.data.payload ?? emptyTaskPayload(request);
  },

  getDesignTaskDetail: async (id: number): Promise<DesignTask> => {
    const response = await api.get<GetDesignTaskDetailResponse>(
      API.ENDPOINTS.DESIGN_TASK_DETAIL(id)
    );
    return response.data.payload;
  },

  getDesignTasksByRegistration: async (registrationId: number): Promise<DesignTask[]> => {
    const response = await api.get<GetDesignTasksByRegistrationResponse>(
      API.ENDPOINTS.DESIGN_TASKS_BY_REGISTRATION(registrationId)
    );
    return response.data.payload ?? [];
  },

  reportDesignTaskMaterialUsage: async (
    id: number,
    request: ReportDesignTaskMaterialUsageRequest
  ): Promise<DesignTask> => {
    const response = await api.post<ReportDesignTaskMaterialUsageResponse>(
      API.ENDPOINTS.DESIGN_TASK_MATERIAL_USAGE(id),
      request
    );
    return response.data.payload;
  },

  completeDesignTask: async (id: number, request: CompleteDesignTaskRequest): Promise<DesignTask> => {
    const formData = new FormData();
    appendImagePart(formData, 'reportImage', request.reportImage, 'design-task');

    const response = await api.post<CompleteDesignTaskResponse>(
      API.ENDPOINTS.DESIGN_TASK_COMPLETE(id),
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.payload;
  },

  getDesignTaskPackageMaterials: async (id: number): Promise<DesignPackageMaterial[]> => {
    const response = await api.get<GetDesignTaskPackageMaterialsResponse>(
      API.ENDPOINTS.DESIGN_TASK_PACKAGE_MATERIALS(id)
    );
    return response.data.payload ?? [];
  },

  resolveTierItemName: async (item: DesignTemplateTierItem): Promise<string> => {
    if (typeof item.plantId === 'number' && item.plantId > 0) {
      return resolvePlantName(item.plantId);
    }
    if (typeof item.materialId === 'number' && item.materialId > 0) {
      return resolveMaterialName(item.materialId);
    }
    return item.itemType === 1 ? 'Plant item' : 'Material item';
  },

  resolveTierItemLabels: async (items: DesignTemplateTierItem[]): Promise<string[]> => {
    return Promise.all(
      items.map(async (item) => {
        const name = await designService.resolveTierItemName(item);
        return `${name} x${item.quantity}`;
      })
    );
  },
};
