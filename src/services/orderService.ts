import { API } from '../constants';
import {
  CancelOrderResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  GetNurseryOrdersPayload,
  GetNurseryOrdersRequest,
  GetNurseryOrdersResponse,
  GetShipperNurseryOrderDetailResponse,
  MarkDeliveryFailedRequest,
  MarkDeliveryFailedResponse,
  GetOrderDetailResponse,
  GetOrdersResponse,
  MarkDeliveredRequest,
  MarkDeliveredResponse,
  OrderNursery,
  OrderPayload,
  OrderStatusFilter,
  ShipperNurseryOrderDetailPayload,
  StartShippingRequest,
  StartShippingResponse,
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

const buildNurseryOrdersParams = (request?: GetNurseryOrdersRequest) => {
  if (!request) {
    return undefined;
  }

  const params: Record<string, number> = {};
  if (request.status !== undefined) {
    params.status = request.status;
  }
  if (request.pageNumber !== undefined) {
    params.pageNumber = request.pageNumber;
  }
  if (request.pageSize !== undefined) {
    params.pageSize = request.pageSize;
  }

  return Object.keys(params).length > 0 ? params : undefined;
};

const EMPTY_NURSERY_ORDERS_PAYLOAD: GetNurseryOrdersPayload = {
  items: [],
  totalCount: 0,
  pageNumber: 1,
  pageSize: 10,
  totalPages: 0,
  hasPrevious: false,
  hasNext: false,
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

  getNurseryOrders: async (
    request?: GetNurseryOrdersRequest
  ): Promise<GetNurseryOrdersPayload> => {
    try {
      const response = await api.get<GetNurseryOrdersResponse>(
        API.ENDPOINTS.NURSERY_ORDERS,
        {
          params: buildNurseryOrdersParams(request),
        }
      );
      return response.data.payload ?? EMPTY_NURSERY_ORDERS_PAYLOAD;
    } catch (error: any) {
      console.error('getNurseryOrders error:', error.response?.data || error.message);
      throw error;
    }
  },

  startShipping: async (
    orderId: number,
    request: StartShippingRequest
  ): Promise<OrderNursery> => {
    try {
      const response = await api.put<StartShippingResponse>(
        API.ENDPOINTS.START_SHIPPING(orderId),
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('startShipping error:', error.response?.data || error.message);
      throw error;
    }
  },

  markDelivered: async (
    orderId: number,
    request: MarkDeliveredRequest
  ): Promise<OrderNursery> => {
    const normalizedUri = request.deliveryImage?.uri?.trim();
    if (!normalizedUri) {
      throw new Error('Invalid delivery image uri');
    }

    const inferredFileName = normalizedUri.split('/').pop() || `delivery-${Date.now()}.jpg`;
    const fileName = request.deliveryImage.fileName?.trim() || inferredFileName;
    const mimeType = request.deliveryImage.mimeType?.trim() || 'image/jpeg';

    const formData = new FormData();
    const deliveryNote = typeof request.deliveryNote === 'string' ? request.deliveryNote.trim() : '';

    if (deliveryNote.length > 0) {
      formData.append('DeliveryNote', deliveryNote);
    }

    formData.append(
      'DeliveryImage',
      {
        uri: normalizedUri,
        name: fileName,
        type: mimeType,
      } as any
    );

    try {
      const response = await api.put<MarkDeliveredResponse>(
        API.ENDPOINTS.MARK_DELIVERED(orderId),
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('markDelivered error:', error.response?.data || error.message);
      throw error;
    }
  },

  markDeliveryFailed: async (
    orderId: number,
    request: MarkDeliveryFailedRequest
  ): Promise<OrderNursery> => {
    try {
      const response = await api.put<MarkDeliveryFailedResponse>(
        API.ENDPOINTS.MARK_DELIVERY_FAILED(orderId),
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('markDeliveryFailed error:', error.response?.data || error.message);
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

  getShipperNurseryOrderDetail: async (
    nurseryOrderId: number
  ): Promise<ShipperNurseryOrderDetailPayload> => {
    try {
      const response = await api.get<GetShipperNurseryOrderDetailResponse>(
        API.ENDPOINTS.SHIPPER_NURSERY_ORDER_DETAIL(nurseryOrderId)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error(
        'getShipperNurseryOrderDetail error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },

  cancelOrder: async (orderId: number): Promise<OrderPayload> => {
    try {
      const response = await api.patch<CancelOrderResponse>(
        API.ENDPOINTS.ORDER_CANCEL(orderId)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('cancelOrder error:', error.response?.data || error.message);
      throw error;
    }
  },
};
