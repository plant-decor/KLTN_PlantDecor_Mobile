import { API } from '../constants';
import {
  ServiceFlowEnumsResponse,
  ServiceRegistrationShift,
  SystemEnumGroup,
  SystemEnumPrimitive,
  SystemEnumsResponse,
  SystemEnumValue,
} from '../types';
import api from './api';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toEnumPrimitive = (value: unknown): SystemEnumPrimitive | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^-?\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }

    return trimmed;
  }

  return null;
};

const toEnumValue = (value: unknown): SystemEnumValue | null => {
  if (!isRecord(value)) {
    return null;
  }

  const enumValue = toEnumPrimitive(value.value);
  if (enumValue === null) {
    return null;
  }

  const name =
    typeof value.name === 'string' && value.name.trim().length > 0
      ? value.name.trim()
      : String(enumValue);

  return {
    value: enumValue,
    name,
  };
};

const toEnumGroup = (value: unknown, fallbackEnumName: string): SystemEnumGroup | null => {
  if (!isRecord(value)) {
    return null;
  }

  const enumName =
    typeof value.enumName === 'string' && value.enumName.trim().length > 0
      ? value.enumName.trim()
      : fallbackEnumName;

  const valuesSource =
    Array.isArray(value.values)
      ? value.values
      : Array.isArray(value.payload)
        ? value.payload
        : Array.isArray(value.data)
          ? value.data
          : null;

  if (!valuesSource) {
    return null;
  }

  const values = valuesSource
    .map((item) => toEnumValue(item))
    .filter((item): item is SystemEnumValue => Boolean(item));

  if (values.length === 0) {
    return null;
  }

  return {
    enumName,
    values,
  };
};

const toEnumGroups = (value: unknown, fallbackEnumName: string): SystemEnumGroup[] => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [];
    }

    const first = value[0];
    if (isRecord(first) && ('enumName' in first || 'values' in first)) {
      return value
        .map((item) => toEnumGroup(item, fallbackEnumName))
        .filter((item): item is SystemEnumGroup => Boolean(item));
    }

    const values = value
      .map((item) => toEnumValue(item))
      .filter((item): item is SystemEnumValue => Boolean(item));

    if (values.length === 0) {
      return [];
    }

    return [
      {
        enumName: fallbackEnumName,
        values,
      },
    ];
  }

  const grouped = toEnumGroup(value, fallbackEnumName);
  if (grouped) {
    return [grouped];
  }

  if (isRecord(value)) {
    if ('payload' in value) {
      return toEnumGroups(value.payload, fallbackEnumName);
    }

    if ('data' in value) {
      return toEnumGroups(value.data, fallbackEnumName);
    }
  }

  return [];
};

const parseEnumResponse = (
  responseBody: SystemEnumsResponse | unknown,
  fallbackEnumName: string
): SystemEnumGroup[] => {
  if (isRecord(responseBody)) {
    if ('payload' in responseBody) {
      const groupsFromPayload = toEnumGroups(responseBody.payload, fallbackEnumName);
      if (groupsFromPayload.length > 0) {
        return groupsFromPayload;
      }
    }

    if ('data' in responseBody) {
      const groupsFromData = toEnumGroups(responseBody.data, fallbackEnumName);
      if (groupsFromData.length > 0) {
        return groupsFromData;
      }
    }
  }

  return toEnumGroups(responseBody, fallbackEnumName);
};

const toShift = (value: unknown): ServiceRegistrationShift | null => {
  if (!isRecord(value)) {
    return null;
  }

  const idValue = value.id;
  const id =
    typeof idValue === 'number' && Number.isInteger(idValue)
      ? idValue
      : typeof idValue === 'string' && /^\d+$/.test(idValue.trim())
        ? Number(idValue.trim())
        : null;

  if (id === null || id <= 0) {
    return null;
  }

  const shiftName =
    typeof value.shiftName === 'string' && value.shiftName.trim().length > 0
      ? value.shiftName.trim()
      : null;
  const startTime =
    typeof value.startTime === 'string' && value.startTime.trim().length > 0
      ? value.startTime.trim()
      : null;
  const endTime =
    typeof value.endTime === 'string' && value.endTime.trim().length > 0
      ? value.endTime.trim()
      : null;

  if (!shiftName || !startTime || !endTime) {
    return null;
  }

  return {
    id,
    shiftName,
    startTime,
    endTime,
  };
};

const toShifts = (value: unknown): ServiceRegistrationShift[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toShift(item))
    .filter((item): item is ServiceRegistrationShift => Boolean(item));
};

const parseServiceFlowResponse = (
  responseBody: ServiceFlowEnumsResponse | unknown
): {
  groups: SystemEnumGroup[];
  shifts: ServiceRegistrationShift[];
} => {
  if (isRecord(responseBody)) {
    const source =
      isRecord(responseBody.payload)
        ? responseBody.payload
        : isRecord(responseBody.data)
          ? responseBody.data
          : null;

    if (source) {
      const groups = 'enums' in source ? toEnumGroups(source.enums, 'service-flow') : [];
      const shifts = 'shifts' in source ? toShifts(source.shifts) : [];

      if (groups.length > 0 || shifts.length > 0) {
        return { groups, shifts };
      }
    }
  }

  return {
    groups: parseEnumResponse(responseBody, 'service-flow'),
    shifts: [],
  };
};

export const enumService = {
  getByName: async (enumName: string): Promise<SystemEnumGroup[]> => {
    try {
      const response = await api.get<SystemEnumsResponse>(
        API.ENDPOINTS.SYSTEM_ENUM_BY_NAME(enumName)
      );
      return parseEnumResponse(response.data, enumName);
    } catch (error: any) {
      console.error('enumService.getByName error:', error.response?.data || error.message);
      throw error;
    }
  },

  getAll: async (): Promise<SystemEnumGroup[]> => {
    try {
      const response = await api.get<SystemEnumsResponse>(API.ENDPOINTS.SYSTEM_ENUMS);
      return parseEnumResponse(response.data, 'system');
    } catch (error: any) {
      console.error('enumService.getAll error:', error.response?.data || error.message);
      throw error;
    }
  },

  getServiceFlow: async (): Promise<{
    groups: SystemEnumGroup[];
    shifts: ServiceRegistrationShift[];
  }> => {
    try {
      const response = await api.get<ServiceFlowEnumsResponse>(
        API.ENDPOINTS.SYSTEM_ENUM_SERVICE_FLOW
      );
      return parseServiceFlowResponse(response.data);
    } catch (error: any) {
      console.error(
        'enumService.getServiceFlow error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },
};
