import api from "./api";
import { API } from "../constants";
import {
  SupportConversation,
  SupportMessage,
  SendMessageRequest,
  PaginatedResponse,
  ApiResponse,
} from "../types";

export const supportService = {
  // Get all conversations for the current user
  getConversations: async (): Promise<ApiResponse<SupportConversation[]>> => {
    const response = await api.get<ApiResponse<SupportConversation[]>>(API.ENDPOINTS.SUPPORT_CONVERSATIONS);
    return response.data;
  },

  // Start a new conversation (system connects with consultant)
  startConversation: async (firstMessage: string): Promise<ApiResponse<SupportConversation>> => {
    const response = await api.post<ApiResponse<SupportConversation>>(API.ENDPOINTS.SUPPORT_CONVERSATIONS_START, { firstMessage });
    return response.data;
  },

  // Get the latest active conversation for the current customer
  getLatestActive: async (): Promise<ApiResponse<SupportConversation>> => {
    const response = await api.get<ApiResponse<SupportConversation>>(API.ENDPOINTS.SUPPORT_CONVERSATIONS_LATEST_ACTIVE);
    return response.data;
  },

  // Get waiting conversations
  getWaiting: async (): Promise<ApiResponse<SupportConversation[]>> => {
    const response = await api.get<ApiResponse<SupportConversation[]>>(API.ENDPOINTS.SUPPORT_CONVERSATIONS_WAITING);
    return response.data;
  },

  // Get conversations claimed by the consultant
  getMyClaimed: async (): Promise<ApiResponse<SupportConversation[]>> => {
    const response = await api.get<ApiResponse<SupportConversation[]>>(API.ENDPOINTS.SUPPORT_CONVERSATIONS_MY_CLAIMED);
    return response.data;
  },

  // Get conversation details with recent messages
  getConversationDetail: async (
    conversationId: number,
    pageNumber: number = 1,
    pageSize: number = 30
  ): Promise<ApiResponse<SupportConversation>> => {
    const response = await api.get<ApiResponse<SupportConversation>>(API.ENDPOINTS.SUPPORT_CONVERSATION_DETAIL(conversationId), {
      params: { pageNumber, pageSize },
    });
    return response.data;
  },

  // Get message history for a conversation (paginated)
  getMessages: async (
    conversationId: number,
    pageNumber: number = 1,
    pageSize: number = 30
  ): Promise<ApiResponse<PaginatedResponse<SupportMessage>>> => {
    const response = await api.get<ApiResponse<PaginatedResponse<SupportMessage>>>(API.ENDPOINTS.SUPPORT_CONVERSATION_MESSAGES(conversationId), {
      params: { pageNumber, pageSize },
    });
    return response.data;
  },

  // Send a message
  sendMessage: async (
    conversationId: number,
    data: SendMessageRequest
  ): Promise<ApiResponse<SupportMessage>> => {
    const response = await api.post<ApiResponse<SupportMessage>>(
      API.ENDPOINTS.SUPPORT_CONVERSATION_MESSAGES(conversationId),
      data
    );
    return response.data;
  },

  // Close conversation
  closeConversation: async (
    conversationId: number
  ): Promise<ApiResponse<boolean>> => {
    const response = await api.post<ApiResponse<boolean>>(API.ENDPOINTS.SUPPORT_CONVERSATION_CLOSE(conversationId));
    return response.data;
  },

  // Claim conversation
  claimConversation: async (
    conversationId: number
  ): Promise<ApiResponse<SupportConversation>> => {
    const response = await api.post<ApiResponse<SupportConversation>>(API.ENDPOINTS.SUPPORT_CONVERSATION_CLAIM(conversationId));
    return response.data;
  },
};
