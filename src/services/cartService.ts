import { API } from '../constants';
import {
  AddCartItemRequest,
  AddCartItemResponse,
  ClearCartResponse,
  GetCartRequest,
  GetCartResponse,
  RemoveCartItemResponse,
  UpdateCartItemRequest,
  UpdateCartItemResponse,
} from '../types';
import api from './api';

const buildCartParams = (request?: GetCartRequest) => {
  if (!request) {
    return undefined;
  }

  const params: Record<string, number> = {};
  if (request.pageNumber !== undefined) {
    params.PageNumber = request.pageNumber;
  }
  if (request.pageSize !== undefined) {
    params.PageSize = request.pageSize;
  }
  if (request.skip !== undefined) {
    params.Skip = request.skip;
  }
  if (request.take !== undefined) {
    params.Take = request.take;
  }

  return Object.keys(params).length > 0 ? params : undefined;
};

export const cartService = {
  addCartItem: async (request: AddCartItemRequest) => {
    try {
      const response = await api.post<AddCartItemResponse>(
        API.ENDPOINTS.CART_ADD,
        request
      );
      const payload = response.data.payload;
      return payload;
    } catch (error: any) {
      console.error('[CartService][addCartItem] error:', {
        request,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  },
  getCart: async (request?: GetCartRequest) => {
    try {
      const response = await api.get<GetCartResponse>(API.ENDPOINTS.CART, {
        params: buildCartParams(request),
      });
      return response.data.payload;
    } catch (error: any) {
      console.error('getCart error:', error.response?.data || error.message);
      throw error;
    }
  },
  updateCartItem: async (cartItemId: number, request: UpdateCartItemRequest) => {
    try {
      const response = await api.patch<UpdateCartItemResponse>(
        API.ENDPOINTS.CART_UPDATE(cartItemId),
        request
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('updateCartItem error:', error.response?.data || error.message);
      throw error;
    }
  },
  removeCartItem: async (cartItemId: number) => {
    try {
      const response = await api.delete<RemoveCartItemResponse>(
        API.ENDPOINTS.CART_REMOVE(cartItemId)
      );
      return response.data;
    } catch (error: any) {
      console.error('removeCartItem error:', error.response?.data || error.message);
      throw error;
    }
  },
  clearCart: async () => {
    try {
      const response = await api.delete<ClearCartResponse>(API.ENDPOINTS.CART_CLEAR);
      return response.data;
    } catch (error: any) {
      console.error('clearCart error:', error.response?.data || error.message);
      throw error;
    }
  },
};
