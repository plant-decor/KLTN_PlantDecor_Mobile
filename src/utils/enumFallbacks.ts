import { SystemEnumGroup, SystemEnumValue } from '../types';

const normalizeKey = (value: string): string =>
  value.replace(/[^a-z0-9]/gi, '').toLowerCase();

const FALLBACK_GROUPS: Record<string, SystemEnumValue[]> = {
  PlacementType: [
    { value: 1, name: 'Indoor' },
    { value: 2, name: 'Outdoor' },
    { value: 3, name: 'SemiShade' },
  ],
  CareLevelType: [
    { value: 1, name: 'Easy' },
    { value: 2, name: 'Medium' },
    { value: 3, name: 'Hard' },
    { value: 4, name: 'Expert' },
  ],
  PlantSort: [
    { value: 'name asc', name: 'NameAsc' },
    { value: 'createdAt desc', name: 'Newest' },
    { value: 'basePrice asc', name: 'PriceAsc' },
    { value: 'basePrice desc', name: 'PriceDesc' },
  ],
  PlantSize: [
    { value: 1, name: 'Mini' },
    { value: 2, name: 'Small' },
    { value: 3, name: 'Medium' },
    { value: 4, name: 'Large' },
  ],
  GrowthRate: [
    { value: 1, name: 'Slow' },
    { value: 2, name: 'Moderate' },
    { value: 3, name: 'Fast' },
  ],
  ComboType: [
    { value: 1, name: 'Space' },
    { value: 2, name: 'Fengshui' },
    { value: 3, name: 'Theme' },
  ],
  SeasonType: [
    { value: 1, name: 'All' },
    { value: 2, name: 'Spring' },
    { value: 3, name: 'Summer' },
    { value: 4, name: 'Autumn' },
    { value: 5, name: 'Winter' },
    { value: 6, name: 'Tet' },
  ],
  UnifiedSearchSortBy: [
    { value: 1, name: 'Name' },
    { value: 2, name: 'Price' },
    { value: 3, name: 'Size' },
    { value: 4, name: 'AvailableInstances' },
    { value: 5, name: 'CreatedAt' },
  ],
  SortDirection: [
    { value: 1, name: 'Asc' },
    { value: 2, name: 'Desc' },
  ],
  FengShuiElement: [
    { value: 1, name: 'Metal' },
    { value: 2, name: 'Wood' },
    { value: 3, name: 'Water' },
    { value: 4, name: 'Fire' },
    { value: 5, name: 'Earth' },
  ],
  Gender: [
    { value: 1, name: 'Male' },
    { value: 2, name: 'Female' },
    { value: 3, name: 'Other' },
  ],
  PaymentStrategy: [
    { value: 1, name: 'VNPay' },
    { value: 2, name: 'COD' },
  ],
  OrderType: [
    { value: 1, name: 'OtherProduct' },
    { value: 2, name: 'PlantInstance' },
    { value: 3, name: 'OtherProductBuyNow' },
    { value: 4, name: 'Service' },
  ],
  BuyNowItemType: [
    { value: 1, name: 'CommonPlant' },
    { value: 2, name: 'NurseryPlantCombo' },
    { value: 3, name: 'NurseryMaterial' },
  ],
  OrderStatus: [
    { value: 'Pending', name: 'Pending' },
    { value: 'DepositPaid', name: 'DepositPaid' },
    { value: 'Paid', name: 'Paid' },
    { value: 'Assigned', name: 'Assigned' },
    { value: 'Shipping', name: 'Shipping' },
    { value: 'Delivered', name: 'Delivered' },
    { value: 'RemainingPaymentPending', name: 'RemainingPaymentPending' },
    { value: 'Completed', name: 'Completed' },
    { value: 'Cancelled', name: 'Cancelled' },
    { value: 'Failed', name: 'Failed' },
    { value: 'RefundRequested', name: 'RefundRequested' },
    { value: 'Refunded', name: 'Refunded' },
    { value: 'Rejected', name: 'Rejected' },
    { value: 'PendingConfirmation', name: 'PendingConfirmation' },
  ],
  WishlistItemType: [
    { value: 0, name: 'Plant' },
    { value: 1, name: 'PlantInstance' },
    { value: 2, name: 'PlantCombo' },
    { value: 3, name: 'Material' },
  ],
  PreferredShift: [
    { value: 1, name: 'Morning' },
    { value: 2, name: 'Afternoon' },
    { value: 3, name: 'Evening' },
  ],
  LightRequirement: [
    { value: 1, name: 'LowLight' },
    { value: 2, name: 'IndirectLight' },
    { value: 3, name: 'PartialSun' },
    { value: 4, name: 'FullSun' },
  ],
  RoomType: [
    { value: 1, name: 'LivingRoom' },
    { value: 2, name: 'Bedroom' },
    { value: 3, name: 'Kitchen' },
    { value: 4, name: 'Bathroom' },
    { value: 5, name: 'HomeOffice' },
    { value: 6, name: 'Balcony' },
    { value: 7, name: 'Corridor' },
    { value: 8, name: 'DiningRoom' },
  ],
};

const GROUP_ALIASES: Record<string, string[]> = {
  PlacementType: ['PlacementType', 'placementType', 'placement', 'plantPlacementType'],
  CareLevelType: ['CareLevelType', 'careLevelType', 'careLevel'],
  PlantSort: ['PlantSort', 'plantSort', 'plant-sort', 'sortBy'],
  PlantSize: ['PlantSize', 'plantSize', 'size'],
  GrowthRate: ['GrowthRate', 'growthRate', 'plantGrowthRate'],
  ComboType: ['ComboType', 'comboType'],
  SeasonType: ['SeasonType', 'seasonType', 'comboSeason'],
  UnifiedSearchSortBy: ['UnifiedSearchSortBy', 'unifiedSearchSortBy', 'shopSortBy'],
  SortDirection: ['SortDirection', 'sortDirection'],
  FengShuiElement: ['FengShuiElement', 'fengShuiElement', 'fengShui'],
  Gender: ['Gender', 'gender', 'userGender'],
  PaymentStrategy: ['PaymentStrategy', 'paymentStrategy', 'paymentMethod'],
  OrderType: ['OrderType', 'orderType'],
  BuyNowItemType: ['BuyNowItemType', 'buyNowItemType'],
  OrderStatus: ['OrderStatus', 'orderStatus', 'status'],
  PreferredShift: ['PreferredShift', 'preferredShift', 'shift', 'workShift'],
  LightRequirement: [
    'LightRequirement',
    'lightRequirement',
    'suitableSpace',
    'light',
  ],
  RoomType: ['RoomType', 'roomType', 'suitableRooms', 'room'],
  WishlistItemType: [
    'WishlistItemType',
    'wishlistItemType',
    'wishlistType',
    'wishlistItem',
  ],
};

const RESOURCE_GROUPS: Record<string, string[]> = {
  plants: [
    'PlacementType',
    'PlantSize',
    'GrowthRate',
    'CareLevelType',
    'FengShuiElement',
  ],
  combos: ['ComboType', 'SeasonType'],
  shopunified: ['ComboType', 'SeasonType', 'UnifiedSearchSortBy', 'SortDirection'],
  shopsearchconfigshopunified: [
    'ComboType',
    'SeasonType',
    'UnifiedSearchSortBy',
    'SortDirection',
  ],
  plantsort: ['PlantSort'],
  users: ['Gender'],
  orders: ['OrderStatus', 'OrderType', 'BuyNowItemType'],
  serviceregistration: ['PreferredShift'],
  serviceregistrations: ['PreferredShift'],
  payments: ['PaymentStrategy'],
  wishlist: ['WishlistItemType'],
  wishlisttypes: ['WishlistItemType'],
  lightrequirement: ['LightRequirement'],
  roomtype: ['RoomType'],
  combodetail: ['LightRequirement', 'RoomType'],
};

const normalizedAliasMap = Object.entries(GROUP_ALIASES).reduce<Record<string, string>>(
  (accumulator, [groupName, aliases]) => {
    aliases.forEach((alias) => {
      accumulator[normalizeKey(alias)] = groupName;
    });
    return accumulator;
  },
  {}
);

const toCloneValues = (values: SystemEnumValue[]): SystemEnumValue[] =>
  values.map((item) => ({ ...item }));

export const getCanonicalEnumGroupName = (name: string): string => {
  const normalized = normalizeKey(name);
  return normalizedAliasMap[normalized] ?? name;
};

export const getFallbackEnumValues = (groupNames: string[]): SystemEnumValue[] => {
  for (const groupName of groupNames) {
    const canonicalName = getCanonicalEnumGroupName(groupName);
    const values = FALLBACK_GROUPS[canonicalName];
    if (values && values.length > 0) {
      return toCloneValues(values);
    }
  }

  return [];
};

export const getFallbackEnumGroupsByResource = (resourceName: string): SystemEnumGroup[] => {
  const groupNames = RESOURCE_GROUPS[normalizeKey(resourceName)] ?? [];

  return groupNames
    .map((groupName) => {
      const values = FALLBACK_GROUPS[groupName] ?? [];
      return {
        enumName: groupName,
        values: toCloneValues(values),
      };
    })
    .filter((group) => group.values.length > 0);
};

export const getFallbackEnumValuesByResource = (resourceName: string): Record<string, SystemEnumValue[]> => {
  return getFallbackEnumGroupsByResource(resourceName).reduce<
    Record<string, SystemEnumValue[]>
  >((accumulator, group) => {
    accumulator[group.enumName] = toCloneValues(group.values);
    return accumulator;
  }, {});
};

export const normalizeEnumLookupKey = normalizeKey;
