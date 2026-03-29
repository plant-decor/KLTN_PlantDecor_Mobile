import { Plant, WishlistItemType } from '../types';

type WishlistTarget = {
  itemType: WishlistItemType;
  itemId: number;
};

export const getWishlistKey = (itemType: WishlistItemType, itemId: number) =>
  `${itemType}:${itemId}`;

const toPositiveNumber = (value: unknown) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return numericValue > 0 ? numericValue : null;
};

export const resolveWishlistTarget = (plant: Plant): WishlistTarget | null => {
  const materialId = toPositiveNumber(plant.nurseryMaterialId);
  if (materialId) {
    return { itemType: 'NurseryMaterial', itemId: materialId };
  }

  const comboId = toPositiveNumber(plant.nurseryPlantComboId);
  if (comboId) {
    return { itemType: 'NurseryPlantCombo', itemId: comboId };
  }

  if (plant.isUniqueInstance) {
    const instanceId = toPositiveNumber(plant.id);
    if (instanceId) {
      return { itemType: 'PlantInstance', itemId: instanceId };
    }
  }

  const commonPlantId = toPositiveNumber(plant.commonPlantId ?? plant.id);
  if (commonPlantId) {
    return { itemType: 'CommonPlant', itemId: commonPlantId };
  }

  return null;
};
