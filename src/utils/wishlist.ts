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
  const entityId = toPositiveNumber(plant.id);
  const commonPlantId = toPositiveNumber(plant.commonPlantId);
  const shouldUsePlantInstanceTarget =
    plant.isUniqueInstance ||
    (entityId !== null && commonPlantId !== null && entityId !== commonPlantId);

  if (shouldUsePlantInstanceTarget && entityId) {
    return { itemType: 'PlantInstance', itemId: entityId };
  }

  const comboId = toPositiveNumber(plant.nurseryPlantComboId);
  if (comboId) {
    return { itemType: 'PlantCombo', itemId: comboId };
  }

  const materialId = toPositiveNumber(plant.nurseryMaterialId);
  if (materialId) {
    return { itemType: 'Material', itemId: materialId };
  }

  const plantId = commonPlantId ?? entityId;
  if (plantId) {
    return { itemType: 'Plant', itemId: plantId };
  }

  return null;
};
