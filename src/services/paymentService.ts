import { API } from '../constants';
import {
  ContinuePaymentResponse,
  CreatePaymentPayload,
  CreatePaymentRequest,
  CreatePaymentResponse,
} from '../types';
import api from './api';

export const paymentService = {
  createPayment: async (
    request: CreatePaymentRequest
  ): Promise<CreatePaymentPayload> => {
    try {
      const response = await api.post<CreatePaymentResponse>(
        API.ENDPOINTS.PAYMENT_CREATE,
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('createPayment error:', error.response?.data || error.message);
      throw error;
    }
  },

  continuePayment: async (invoiceId: number): Promise<CreatePaymentPayload> => {
    try {
      const response = await api.post<ContinuePaymentResponse>(
        API.ENDPOINTS.PAYMENT_CONTINUE(invoiceId)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('continuePayment error:', error.response?.data || error.message);
      throw error;
    }
  },
};
