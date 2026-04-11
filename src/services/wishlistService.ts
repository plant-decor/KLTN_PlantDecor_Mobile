import { API } from '../constants';
import {
  AddWishlistItemResponse,
  CheckWishlistResponse,
  ClearWishlistResponse,
  GetWishlistPayload,
  GetWishlistRequest,
  GetWishlistResponse,
  RemoveWishlistItemResponse,
  SystemEnumGroup,
  WishlistItem,
  WishlistItemType,
} from '../types';
import api from './api';
import { enumService } from './enumService';

const WISHLIST_TYPES_RESOURCE = 'wishlist-types';

const FALLBACK_WISHLIST_TYPE_LOOKUP: Record<string, WishlistItemType> = {
  '0': 'Plant',
  plant: 'Plant',
  commonplant: 'Plant',
  '1': 'PlantInstance',
  plantinstance: 'PlantInstance',
  '2': 'PlantCombo',
  plantcombo: 'PlantCombo',
  nurseryplantcombo: 'PlantCombo',
  combo: 'PlantCombo',
  '3': 'Material',
  material: 'Material',
  nurserymaterial: 'Material',
};

const WISHLIST_ENUM_GROUP_KEYS = new Set(['wishlistitemtype']);

let wishlistTypeLookupPromise: Promise<Record<string, WishlistItemType>> | null = null;

type RawWishlistItem = Omit<WishlistItem, 'itemType'> & {
  itemType: unknown;
};

type GetWishlistResponseRaw = Omit<GetWishlistResponse, 'payload'> & {
  payload: Omit<GetWishlistPayload, 'items'> & {
    items: RawWishlistItem[];
  };
};

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

const normalizeLookupKey = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[^a-z0-9]/gi, '').toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
};

const toWishlistItemType = (value: unknown): WishlistItemType | null => {
  const normalized = normalizeLookupKey(value);
  if (!normalized) {
    return null;
  }

  return FALLBACK_WISHLIST_TYPE_LOOKUP[normalized] ?? null;
};

const setLookupAlias = (
  lookup: Record<string, WishlistItemType>,
  rawKey: unknown,
  itemType: WishlistItemType
) => {
  const normalized = normalizeLookupKey(rawKey);
  if (!normalized) {
    return;
  }

  lookup[normalized] = itemType;
};

const mergeEnumGroupsIntoLookup = (
  lookup: Record<string, WishlistItemType>,
  groups: SystemEnumGroup[]
): Record<string, WishlistItemType> => {
  groups.forEach((group) => {
    const groupKey = normalizeLookupKey(group.enumName);
    if (!groupKey || !WISHLIST_ENUM_GROUP_KEYS.has(groupKey)) {
      return;
    }

    group.values.forEach((entry) => {
      const resolvedType = toWishlistItemType(entry.name) ?? toWishlistItemType(entry.value);
      if (!resolvedType) {
        return;
      }

      setLookupAlias(lookup, entry.name, resolvedType);
      setLookupAlias(lookup, entry.value, resolvedType);
    });
  });

  return lookup;
};

const getWishlistTypeLookup = async (): Promise<Record<string, WishlistItemType>> => {
  if (!wishlistTypeLookupPromise) {
    wishlistTypeLookupPromise = enumService
      .getByName(WISHLIST_TYPES_RESOURCE)
      .then((groups) =>
        mergeEnumGroupsIntoLookup(
          { ...FALLBACK_WISHLIST_TYPE_LOOKUP },
          groups
        )
      )
      .catch(() => ({ ...FALLBACK_WISHLIST_TYPE_LOOKUP }));
  }

  return wishlistTypeLookupPromise;
};

const resolveWishlistItemType = (
  rawType: unknown,
  typeLookup: Record<string, WishlistItemType>
): WishlistItemType => {
  const normalized = normalizeLookupKey(rawType);
  if (normalized && typeLookup[normalized]) {
    return typeLookup[normalized];
  }

  return toWishlistItemType(rawType) ?? 'Plant';
};

const normalizeWishlistPayload = (
  payload: GetWishlistResponseRaw['payload'],
  typeLookup: Record<string, WishlistItemType>
): GetWishlistPayload => ({
  ...payload,
  items: (payload.items ?? []).map((item) => ({
    ...item,
    itemType: resolveWishlistItemType(item.itemType, typeLookup),
  })),
});

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
      const [response, typeLookup] = await Promise.all([
        api.get<GetWishlistResponseRaw>(API.ENDPOINTS.WISHLIST, {
          params: buildWishlistParams(request),
        }),
        getWishlistTypeLookup(),
      ]);

      return normalizeWishlistPayload(response.data.payload, typeLookup);
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
  clearWishlist: async () => {
    try {
      const response = await api.delete<ClearWishlistResponse>(API.ENDPOINTS.WISHLIST_CLEAR);
      return response.data;
    } catch (error: any) {
      console.error('clearWishlist error:', error.response?.data || error.message);
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
