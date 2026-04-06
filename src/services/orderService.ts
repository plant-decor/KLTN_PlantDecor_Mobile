import { API } from '../constants';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  GetOrderDetailResponse,
  GetOrdersResponse,
  OrderPayload,
  OrderStatusFilter,
} from '../types';
import api from './api';

const buildOrdersParams = (orderStatus?: OrderStatusFilter) => {
  if (!orderStatus) {
    return undefined;
  }

  return {
    orderStatus,
  };
};

export const orderService = {
  createOrder: async (request: CreateOrderRequest): Promise<OrderPayload> => {
    try {
      const response = await api.post<CreateOrderResponse>(
        API.ENDPOINTS.ORDER,
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('createOrder error:', error.response?.data || error.message);
      throw error;
    }
  },

  getMyOrders: async (orderStatus?: OrderStatusFilter): Promise<OrderPayload[]> => {
    try {
      const response = await api.get<GetOrdersResponse>(API.ENDPOINTS.ORDERS, {
        params: buildOrdersParams(orderStatus),
      });
      return response.data.payload ?? [];
    } catch (error: any) {
      console.error('getMyOrders error:', error.response?.data || error.message);
      throw error;
    }
  },

  getOrderDetail: async (orderId: number): Promise<OrderPayload> => {
    try {
      const response = await api.get<GetOrderDetailResponse>(
        API.ENDPOINTS.ORDER_DETAIL(orderId)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('getOrderDetail error:', error.response?.data || error.message);
      throw error;
    }
  },
};
