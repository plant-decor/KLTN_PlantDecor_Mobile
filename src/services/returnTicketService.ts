import { API } from '../constants';
import api from './api';
import {
  CreateReturnTicketRequest,
  ReturnTicket,
  ReturnTicketImageFile,
  ReturnTicketResponse,
  GetMyReturnTicketsResponse,
  UploadReturnTicketItemImagesResponse,
  ReturnTicketItem,
} from '../types';

export const returnTicketService = {
  createReturnTicket: async (data: CreateReturnTicketRequest): Promise<ReturnTicket> => {
    const response = await api.post<ReturnTicketResponse>(
      API.ENDPOINTS.CREATE_RETURN_TICKET,
      data
    );
    return response.data.payload;
  },

  getMyReturnTickets: async (): Promise<ReturnTicket[]> => {
    const response = await api.get<GetMyReturnTicketsResponse>(
      API.ENDPOINTS.MY_RETURN_TICKETS
    );
    return response.data.payload ?? [];
  },

  uploadReturnTicketItemImages: async (
    ticketId: number,
    itemId: number,
    files: ReturnTicketImageFile[]
  ): Promise<ReturnTicketItem> => {
    const formData = new FormData();

    files.forEach((file, index) => {
      const normalizedUri = file.uri?.trim();
      if (!normalizedUri) {
        return;
      }

      const inferredFileName =
        normalizedUri.split('/').pop() || `return-ticket-${ticketId}-${itemId}-${index}.jpg`;
      const fileName = file.fileName?.trim() || inferredFileName;
      const mimeType = file.mimeType?.trim() || 'image/jpeg';

      formData.append(
        'files',
        {
          uri: normalizedUri,
          name: fileName,
          type: mimeType,
        } as any
      );
    });

    const response = await api.post<UploadReturnTicketItemImagesResponse>(
      API.ENDPOINTS.RETURN_TICKET_IMAGE_UPLOAD(ticketId, itemId),
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data.payload;
  },
};
