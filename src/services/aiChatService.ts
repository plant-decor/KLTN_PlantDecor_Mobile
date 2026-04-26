import { API } from '../constants';
import {
  AIChatEnumGroup,
  AIChatHistoryPayload,
  AIChatHistoryResponse,
  AIChatMessage,
  AIChatMessageRole,
  AIChatResponse,
  AIChatSessionCreateRequest,
  AIChatSessionCreateResponse,
  AIChatSessionSummary,
  AIChatSessionsPayload,
  AIChatSessionsResponse,
  AIChatSuggestedPlant,
  AIChatbotRequest,
  SystemEnumValue,
} from '../types';
import api from './api';

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }

  return null;
};

const normalizeStatusValue = (value: unknown): number | string => {
  const numeric = asNumber(value);
  if (numeric !== null) {
    return numeric;
  }

  const text = asString(value);
  return text ?? 'unknown';
};

const normalizeRole = (value: unknown): AIChatMessageRole => {
  const role = asString(value)?.toLowerCase();
  if (role === 'user' || role === 'assistant' || role === 'system') {
    return role;
  }

  return role ?? 'assistant';
};

const normalizeEnumValue = (value: unknown): SystemEnumValue | null => {
  const name = asString((value as { name?: unknown })?.name);
  const rawValue = (value as { value?: unknown })?.value;
  const numeric = asNumber(rawValue);
  const stringValue = asString(rawValue);
  const normalizedValue = numeric ?? stringValue;

  if (normalizedValue === null || !name) {
    return null;
  }

  return {
    value: normalizedValue,
    name,
  };
};

const normalizeEnumGroup = (value: unknown): AIChatEnumGroup | null => {
  const enumName = asString((value as { enumName?: unknown })?.enumName);
  const values = Array.isArray((value as { values?: unknown[] })?.values)
    ? (value as { values: unknown[] }).values
        .map((item) => normalizeEnumValue(item))
        .filter((item): item is SystemEnumValue => Boolean(item))
    : [];

  if (!enumName || values.length === 0) {
    return null;
  }

  return {
    enumName,
    values,
  };
};

const normalizeSessionSummary = (value: unknown): AIChatSessionSummary => ({
  sessionId: asNumber((value as { sessionId?: unknown })?.sessionId) ?? 0,
  title: asString((value as { title?: unknown })?.title),
  status: normalizeStatusValue((value as { status?: unknown })?.status),
  startedAt:
    asString((value as { startedAt?: unknown })?.startedAt) ??
    new Date().toISOString(),
  endedAt: asString((value as { endedAt?: unknown })?.endedAt),
  updatedAt: asString((value as { updatedAt?: unknown })?.updatedAt),
});

const normalizeSuggestedPlant = (value: unknown): AIChatSuggestedPlant | null => {
  const entityType = asString((value as { entityType?: unknown })?.entityType);
  const entityId = asNumber((value as { entityId?: unknown })?.entityId);
  const name = asString((value as { name?: unknown })?.name);

  if (!entityType || entityId === null || !name) {
    return null;
  }

  return {
    entityType,
    entityId,
    name,
    description: asString((value as { description?: unknown })?.description),
    price:
      typeof (value as { price?: unknown })?.price === 'number'
        ? ((value as { price: number }).price ?? null)
        : asNumber((value as { price?: unknown })?.price),
    imageUrl: asString((value as { imageUrl?: unknown })?.imageUrl),
    isPurchasable:
      typeof (value as { isPurchasable?: unknown })?.isPurchasable === 'boolean'
        ? (value as { isPurchasable: boolean }).isPurchasable
        : undefined,
    relevanceScore:
      typeof (value as { relevanceScore?: unknown })?.relevanceScore === 'number'
        ? (value as { relevanceScore: number }).relevanceScore
        : null,
  };
};

const normalizeHistoryMessage = (value: unknown): AIChatMessage => ({
  id:
    asNumber((value as { messageId?: unknown })?.messageId) ??
    String(
      asString((value as { createdAt?: unknown })?.createdAt) ?? Math.random()
    ),
  role: normalizeRole((value as { role?: unknown })?.role),
  content: asString((value as { content?: unknown })?.content) ?? '',
  intent: asString((value as { intent?: unknown })?.intent),
  isFallback:
    typeof (value as { isFallback?: unknown })?.isFallback === 'boolean'
      ? (value as { isFallback: boolean }).isFallback
      : false,
  isPolicyResponse:
    typeof (value as { isPolicyResponse?: unknown })?.isPolicyResponse === 'boolean'
      ? (value as { isPolicyResponse: boolean }).isPolicyResponse
      : false,
  createdAt:
    asString((value as { createdAt?: unknown })?.createdAt) ??
    new Date().toISOString(),
});

const sortMessagesNewestFirst = (items: AIChatMessage[]): AIChatMessage[] =>
  [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

const normalizeHistoryPayload = (payload: AIChatHistoryPayload): AIChatHistoryPayload => ({
  ...payload,
  messages: sortMessagesNewestFirst(
    (payload.messages ?? []).map((message) => normalizeHistoryMessage(message))
  ),
});

export const aiChatService = {
  getEnums: async (): Promise<AIChatEnumGroup[]> => {
    const response = await api.get<{ payload?: unknown }>(API.ENDPOINTS.AI_CHAT_ENUMS);
    const payload = Array.isArray(response.data?.payload) ? response.data.payload : [];
    return payload
      .map((item) => normalizeEnumGroup(item))
      .filter((item): item is AIChatEnumGroup => Boolean(item));
  },

  createSession: async (
    data?: AIChatSessionCreateRequest
  ): Promise<AIChatSessionCreateResponse> => {
    const response = await api.post<AIChatSessionCreateResponse>(
      API.ENDPOINTS.AI_CHAT_SESSIONS,
      data ?? {}
    );

    return {
      ...response.data,
      payload: normalizeSessionSummary(response.data.payload),
    };
  },

  getSessions: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    skip?: number;
    take?: number;
  }): Promise<AIChatSessionsResponse> => {
    const response = await api.get<AIChatSessionsResponse>(
      API.ENDPOINTS.AI_CHAT_SESSIONS,
      {
        params: {
          PageNumber: params?.pageNumber,
          PageSize: params?.pageSize,
          Skip: params?.skip,
          Take: params?.take,
        },
      }
    );

    const payload = response.data.payload;
    const normalizedPayload: AIChatSessionsPayload = {
      ...payload,
      items: (payload.items ?? []).map((item) => normalizeSessionSummary(item)),
    };

    return {
      ...response.data,
      payload: normalizedPayload,
    };
  },

  getSessionHistory: async (
    sessionId: number,
    params?: {
      pageNumber?: number;
      pageSize?: number;
      skip?: number;
      take?: number;
    }
  ): Promise<AIChatHistoryResponse> => {
    const response = await api.get<AIChatHistoryResponse>(
      API.ENDPOINTS.AI_CHAT_SESSION_HISTORY(sessionId),
      {
        params: {
          PageNumber: params?.pageNumber,
          PageSize: params?.pageSize,
          Skip: params?.skip,
          Take: params?.take,
        },
      }
    );

    return {
      ...response.data,
      payload: normalizeHistoryPayload(response.data.payload),
    };
  },

  sendMessage: async (data: AIChatbotRequest): Promise<AIChatResponse> => {
    const response = await api.post<AIChatResponse>(API.ENDPOINTS.AI_CHAT_CHATBOT, data);
    const payload = response.data.payload;

    return {
      ...response.data,
      payload: {
        ...payload,
        suggestedPlants: (payload.suggestedPlants ?? [])
          .map((item) => normalizeSuggestedPlant(item))
          .filter((item): item is AIChatSuggestedPlant => Boolean(item)),
      },
    };
  },
};
