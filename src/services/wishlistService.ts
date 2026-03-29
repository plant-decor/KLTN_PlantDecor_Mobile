import { API } from '../constants';
import {
  AddWishlistItemResponse,
  CheckWishlistResponse,
  GetWishlistRequest,
  GetWishlistResponse,
  RemoveWishlistItemResponse,
  WishlistItemType,
} from '../types';
import api from './api';

const buildWishlistParams = (request?: GetWishlistRequest) => {
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

export const wishlistService = {
  addWishlistItem: async (itemType: WishlistItemType, itemId: number) => {
    try {
      const response = await api.post<AddWishlistItemResponse>(
        API.ENDPOINTS.WISHLIST_ADD(itemType, itemId)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('addWishlistItem error:', error.response?.data || error.message);
      throw error;
    }
  },
  getWishlist: async (request?: GetWishlistRequest) => {
    try {
      const response = await api.get<GetWishlistResponse>(API.ENDPOINTS.WISHLIST, {
        params: buildWishlistParams(request),
      });
      return response.data.payload;
    } catch (error: any) {
      console.error('getWishlist error:', error.response?.data || error.message);
      throw error;
    }
  },
  removeWishlistItem: async (itemType: WishlistItemType, itemId: number) => {
    try {
      const response = await api.delete<RemoveWishlistItemResponse>(
        API.ENDPOINTS.WISHLIST_REMOVE(itemType, itemId)
      );
      return response.data;
    } catch (error: any) {
      console.error('removeWishlistItem error:', error.response?.data || error.message);
      throw error;
    }
  },
  checkWishlistItem: async (itemType: WishlistItemType, itemId: number) => {
    try {
      const response = await api.get<CheckWishlistResponse>(
        API.ENDPOINTS.WISHLIST_CHECK(itemType, itemId)
      );
      return response.data.payload;
    } catch (error: any) {
      console.error('checkWishlistItem error:', error.response?.data || error.message);
      throw error;
    }
  },
};
