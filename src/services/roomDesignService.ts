import { API } from '../constants';
import {
  ApiResponse,
  RoomDesignAllergyPlant,
  RoomDesignImageFile,
  RoomDesignAnalyzeRequest,
  RoomDesignAnalyzeResult,
  RoomDesignGeneratedImage,
  RoomDesignRecommendation,
  RoomDesignRecommendationEntityRef,
  RoomDesignRoomAnalysis,
  RoomDesignUploadedImage,
  RoomDesignAnalyzePayload,
} from '../types';
import { resolveImageUri, resolveImageUris } from '../utils/image';
import api from './api';

type UnknownRecord = Record<string, unknown>;

const ROOM_DESIGN_REQUEST_TIMEOUT = 120000;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const toRecord = (value: unknown): UnknownRecord | null =>
  isRecord(value) ? value : null;

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  return [];
};

const getValueByKeys = (record: UnknownRecord | null, keys: string[]): unknown => {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }

  return undefined;
};

const getRecordByKeys = (record: UnknownRecord | null, keys: string[]): UnknownRecord | null => {
  const candidate = getValueByKeys(record, keys);
  return toRecord(candidate);
};

const getArrayByKeys = (record: UnknownRecord | null, keys: string[]): unknown[] => {
  const candidate = getValueByKeys(record, keys);
  return toArray(candidate);
};

const unwrapEnvelope = <T>(value: ApiResponse<T> | unknown): unknown => {
  if (!isRecord(value)) {
    return value;
  }

  if ('payload' in value && value.payload !== undefined) {
    return value.payload;
  }

  if ('data' in value && value.data !== undefined) {
    return value.data;
  }

  return value;
};

const resolvePrimaryImageFromRecord = (record: UnknownRecord | null): string | null => {
  if (!record) {
    return null;
  }

  const directImage = resolveImageUri(
    getValueByKeys(record, [
      'imageUrl',
      'primaryImageUrl',
      'previewImageUrl',
      'plantCollageUrl',
      'aiResponseImageUrl',
      'url',
      'uri',
    ])
  );
  if (directImage) {
    return directImage;
  }

  const nestedImageRecord = getRecordByKeys(record, ['image', 'primaryImage']);
  if (nestedImageRecord) {
    const nestedImage = resolveImageUri(nestedImageRecord);
    if (nestedImage) {
      return nestedImage;
    }
  }

  const imageCollection = resolveImageUris(
    getValueByKeys(record, ['images', 'imageUrls', 'gallery'])
  );
  return imageCollection[0] ?? null;
};

const normalizeRecommendationEntity = (
  source: unknown
): RoomDesignRecommendationEntityRef | null => {
  const record = toRecord(source);
  if (!record) {
    return null;
  }

  return {
    id: toNumber(record.id),
    plantId:
      toNumber(record.plantId) ??
      toNumber(record.PlantId) ??
      toNumber(record.id),
    commonPlantId:
      toNumber(record.commonPlantId) ??
      toNumber(record.CommonPlantId) ??
      toNumber(record.id),
    plantInstanceId:
      toNumber(record.plantInstanceId) ??
      toNumber(record.PlantInstanceId) ??
      toNumber(record.id),
    name:
      toTrimmedString(record.name) ??
      toTrimmedString(record.plantName),
    plantName:
      toTrimmedString(record.plantName) ??
      toTrimmedString(record.name),
    imageUrl:
      toTrimmedString(record.imageUrl) ??
      toTrimmedString(record.primaryImageUrl) ??
      resolvePrimaryImageFromRecord(record),
    primaryImageUrl:
      toTrimmedString(record.primaryImageUrl) ??
      toTrimmedString(record.imageUrl) ??
      resolvePrimaryImageFromRecord(record),
    basePrice:
      toNumber(record.basePrice) ??
      toNumber(record.price),
    specificPrice:
      toNumber(record.specificPrice) ??
      toNumber(record.price),
    images: record.images,
  };
};

const isAnalyzeUploadRecommendationV2 = (record: UnknownRecord): boolean =>
  getValueByKeys(record, ['entityType', 'EntityType']) !== undefined ||
  getValueByKeys(record, ['reasonForRecommendation', 'ReasonForRecommendation']) !==
    undefined ||
  getValueByKeys(record, ['suggestedPlacement', 'SuggestedPlacement']) !== undefined ||
  getValueByKeys(record, ['matchScore', 'MatchScore']) !== undefined ||
  getValueByKeys(record, ['isPurchasable', 'IsPurchasable']) !== undefined;

const normalizeRecommendationV2 = (
  record: UnknownRecord,
  index: number
): RoomDesignRecommendation | null => {
  const name =
    toTrimmedString(getValueByKeys(record, ['name', 'Name'])) ??
    toTrimmedString(getValueByKeys(record, ['description', 'Description']))?.slice(0, 160) ??
    null;

  if (!name) {
    return null;
  }

  const entityTypeRaw =
    toTrimmedString(getValueByKeys(record, ['entityType', 'EntityType'])) ?? '';
  const entityTypeLower = entityTypeRaw.toLowerCase();
  const entityId = toNumber(getValueByKeys(record, ['entityId', 'EntityId']));
  const productId = toNumber(getValueByKeys(record, ['productId', 'ProductId']));

  let commonPlantId: number | null = null;
  let plantInstanceId: number | null = null;
  const plantId = productId ?? entityId ?? null;

  if (entityTypeLower.includes('instance')) {
    plantInstanceId = entityId ?? productId;
  } else {
    commonPlantId = productId ?? entityId;
  }

  const price = toNumber(getValueByKeys(record, ['price', 'Price']));
  const nurseryId = toNumber(getValueByKeys(record, ['nurseryId', 'NurseryId']));
  const matchScore = toNumber(getValueByKeys(record, ['matchScore', 'MatchScore']));
  const isPurchasableRaw = getValueByKeys(record, ['isPurchasable', 'IsPurchasable']);
  const isPurchasable =
    typeof isPurchasableRaw === 'boolean' ? isPurchasableRaw : null;

  const idStr =
    toTrimmedString(getValueByKeys(record, ['id', 'Id'])) ??
    `${entityTypeRaw || 'rec'}-${entityId ?? productId ?? 'x'}-${index}`;

  return {
    id: idStr,
    name,
    plantId,
    commonPlantId,
    plantInstanceId,
    imageUrl:
      toTrimmedString(getValueByKeys(record, ['imageUrl', 'ImageUrl'])) ??
      resolvePrimaryImageFromRecord(record),
    price,
    specificPrice: price,
    nurseryId,
    nurseryName: toTrimmedString(getValueByKeys(record, ['nurseryName', 'NurseryName'])),
    plantReason: toTrimmedString(
      getValueByKeys(record, ['reasonForRecommendation', 'ReasonForRecommendation'])
    ),
    placementPosition: toTrimmedString(
      getValueByKeys(record, ['suggestedPlacement', 'SuggestedPlacement'])
    ),
    placementReason: null,
    description: toTrimmedString(getValueByKeys(record, ['description', 'Description'])),
    entityType: entityTypeRaw || null,
    entityId,
    productId,
    fengShuiElement: toTrimmedString(
      getValueByKeys(record, ['fengShuiElement', 'FengShuiElement'])
    ),
    matchScore,
    careDifficulty: toTrimmedString(
      getValueByKeys(record, ['careDifficulty', 'CareDifficulty'])
    ),
    isPurchasable,
    commonPlant: null,
    plantInstance: null,
    raw: record,
  };
};

const normalizeRecommendation = (
  source: unknown,
  index: number
): RoomDesignRecommendation | null => {
  const record = toRecord(source);
  if (!record) {
    return null;
  }

  if (isAnalyzeUploadRecommendationV2(record)) {
    return normalizeRecommendationV2(record, index);
  }

  const commonPlant = normalizeRecommendationEntity(
    getValueByKeys(record, ['commonPlant', 'CommonPlant'])
  );
  const plantInstance = normalizeRecommendationEntity(
    getValueByKeys(record, ['plantInstance', 'PlantInstance'])
  );

  const commonPlantId =
    toNumber(record.commonPlantId) ??
    toNumber(record.CommonPlantId) ??
    commonPlant?.commonPlantId ??
    null;
  const plantInstanceId =
    toNumber(record.plantInstanceId) ??
    toNumber(record.PlantInstanceId) ??
    plantInstance?.plantInstanceId ??
    null;
  const plantId =
    toNumber(record.plantId) ??
    toNumber(record.PlantId) ??
    commonPlant?.plantId ??
    plantInstance?.plantId ??
    null;

  const name =
    toTrimmedString(record.name) ??
    toTrimmedString(record.plantName) ??
    commonPlant?.plantName ??
    commonPlant?.name ??
    plantInstance?.plantName ??
    plantInstance?.name ??
    (commonPlantId !== null
      ? `Common plant #${commonPlantId}`
      : plantInstanceId !== null
      ? `Plant instance #${plantInstanceId}`
      : plantId !== null
      ? `Plant #${plantId}`
      : null);

  if (!name) {
    return null;
  }

  const imageUrl =
    toTrimmedString(record.imageUrl) ??
    toTrimmedString(record.primaryImageUrl) ??
    commonPlant?.imageUrl ??
    commonPlant?.primaryImageUrl ??
    plantInstance?.imageUrl ??
    plantInstance?.primaryImageUrl ??
    resolvePrimaryImageFromRecord(record);

  return {
    id:
      toTrimmedString(record.id) ??
      toTrimmedString(record.layoutDesignPlantId) ??
      `${commonPlantId ?? 'cp'}-${plantInstanceId ?? 'pi'}-${plantId ?? index}`,
    name,
    plantId,
    commonPlantId,
    plantInstanceId,
    imageUrl,
    price:
      toNumber(record.price) ??
      toNumber(record.basePrice) ??
      commonPlant?.basePrice ??
      null,
    specificPrice:
      toNumber(record.specificPrice) ??
      plantInstance?.specificPrice ??
      null,
    nurseryName:
      toTrimmedString(record.nurseryName) ??
      toTrimmedString(record.currentNurseryName) ??
      null,
    plantReason:
      toTrimmedString(record.plantReason) ??
      toTrimmedString(record.reason) ??
      toTrimmedString(record.recommendationReason) ??
      null,
    placementPosition:
      toTrimmedString(record.placementPosition) ??
      toTrimmedString(record.position) ??
      null,
    placementReason:
      toTrimmedString(record.placementReason) ??
      toTrimmedString(record.positionReason) ??
      null,
    commonPlant,
    plantInstance,
    raw: source,
  };
};

const normalizeAnalyzeResult = (
  responseBody: ApiResponse<unknown> | unknown
): RoomDesignAnalyzeResult => {
  const unwrapped = unwrapEnvelope(responseBody);
  const rootRecord = toRecord(unwrapped);
  const layoutRecord =
    getRecordByKeys(rootRecord, ['layoutDesign', 'LayoutDesign', 'design', 'layout']) ??
    rootRecord;

  const recommendationCandidates = getArrayByKeys(rootRecord, [
    'recommendations',
    'recommendedPlants',
    'suggestedPlants',
    'layoutDesignPlants',
    'plants',
    'items',
  ]);
  const nestedRecommendationCandidates =
    recommendationCandidates.length === 0 && layoutRecord !== rootRecord
      ? getArrayByKeys(layoutRecord, [
          'recommendations',
          'recommendedPlants',
          'suggestedPlants',
          'layoutDesignPlants',
          'plants',
          'items',
        ])
      : [];

  const recommendations = [...recommendationCandidates, ...nestedRecommendationCandidates]
    .map((item, index) => normalizeRecommendation(item, index))
    .filter((item): item is RoomDesignRecommendation => Boolean(item));

  const roomAnalysisRecord = getRecordByKeys(rootRecord, ['roomAnalysis', 'RoomAnalysis']);
  let roomAnalysis: RoomDesignRoomAnalysis | null = null;
  if (roomAnalysisRecord) {
    const rawPalette = getArrayByKeys(roomAnalysisRecord, ['colorPalette', 'ColorPalette']);
    const colorPalette = rawPalette
      .map((c) => (typeof c === 'string' ? c.trim() : toTrimmedString(c)))
      .filter((c): c is string => Boolean(c && c.length > 0));

    roomAnalysis = {
      availableSpace: toTrimmedString(
        getValueByKeys(roomAnalysisRecord, ['availableSpace', 'AvailableSpace'])
      ),
      summary: toTrimmedString(getValueByKeys(roomAnalysisRecord, ['summary', 'Summary'])),
      colorPalette: colorPalette.length > 0 ? colorPalette : undefined,
    };
  }

  const summaryFromRoomAnalysis = roomAnalysis?.summary ?? null;

  return {
    layoutDesignId:
      toNumber(getValueByKeys(rootRecord, ['layoutDesignId', 'LayoutDesignId'])) ??
      toNumber(getValueByKeys(layoutRecord, ['id', 'Id'])) ??
      null,
    roomAnalysis,
    totalCount: toNumber(getValueByKeys(rootRecord, ['totalCount', 'TotalCount'])),
    processingTimeMs: toNumber(
      getValueByKeys(rootRecord, ['processingTimeMs', 'ProcessingTimeMs'])
    ),
    userId: toNumber(getValueByKeys(rootRecord, ['userId', 'UserId'])),
    previewImageUrl:
      toTrimmedString(getValueByKeys(layoutRecord, ['previewImageUrl', 'PreviewImageUrl'])) ??
      null,
    plantCollageUrl:
      toTrimmedString(getValueByKeys(layoutRecord, ['plantCollageUrl', 'PlantCollageUrl'])) ??
      null,
    aiResponseImageUrl:
      toTrimmedString(getValueByKeys(layoutRecord, ['aiResponseImageUrl', 'AIResponseImageUrl'])) ??
      null,
    fluxPromptUsed:
      toTrimmedString(getValueByKeys(layoutRecord, ['fluxPromptUsed', 'FluxPromptUsed'])) ??
      toTrimmedString(getValueByKeys(rootRecord, ['prompt', 'Prompt'])) ??
      null,
    roomImageUrl:
      toTrimmedString(getValueByKeys(rootRecord, ['roomImageUrl', 'RoomImageUrl', 'imageUrl'])) ??
      toTrimmedString(getValueByKeys(layoutRecord, ['roomImageUrl', 'RoomImageUrl'])) ??
      resolvePrimaryImageFromRecord(getRecordByKeys(rootRecord, ['roomImage', 'RoomImage'])),
    summary:
      summaryFromRoomAnalysis ??
      toTrimmedString(
        getValueByKeys(rootRecord, [
          'summary',
          'analysisSummary',
          'description',
          'message',
        ])
      ) ??
      null,
    recommendations,
    raw: unwrapped,
  };
};

const normalizeGeneratedImageItem = (
  source: unknown,
  index: number,
  fallbackPrompt?: string | null
): RoomDesignGeneratedImage | null => {
  const record = toRecord(source);
  if (!record) {
    const directImage = resolveImageUri(source);
    if (!directImage) {
      return null;
    }

    return {
      id: `generated-image-${index}`,
      imageUrl: directImage,
    };
  }

  const imageUrl = resolvePrimaryImageFromRecord(record);
  if (!imageUrl) {
    return null;
  }

  const parseNum = (val: unknown) => (typeof val === 'number' ? val : null);

  return {
    id:
      toTrimmedString(record.id) ??
      toTrimmedString(record.layoutDesignPlantId) ??
      `${imageUrl}-${index}`,
    imageUrl,
    layoutDesignPlantId: parseNum(record.layoutDesignPlantId),
    commonPlantId: parseNum(record.commonPlantId),
    plantInstanceId: parseNum(record.plantInstanceId),
    placementPosition: toTrimmedString(record.placementPosition) ?? null,
    isSuccess: typeof record.isSuccess === 'boolean' ? record.isSuccess : undefined,
  };
};

const createGeneratedImagesFallback = (
  record: UnknownRecord | null
): RoomDesignGeneratedImage[] => {
  if (!record) {
    return [];
  }

  const fallbackFields = [
    {
      id: 'preview',
      fieldKeys: ['previewImageUrl', 'PreviewImageUrl'],
      source: 'preview',
    },
    {
      id: 'plant-collage',
      fieldKeys: ['plantCollageUrl', 'PlantCollageUrl'],
      source: 'plant-collage',
    },
    {
      id: 'ai-response',
      fieldKeys: ['aiResponseImageUrl', 'AIResponseImageUrl'],
      source: 'ai-response',
    },
  ] as const;

  const images: RoomDesignGeneratedImage[] = [];
  const seen = new Set<string>();

  fallbackFields.forEach((field) => {
    const imageUrl = toTrimmedString(getValueByKeys(record, [...field.fieldKeys]));
    if (!imageUrl || seen.has(imageUrl)) {
      return;
    }

    seen.add(imageUrl);
    images.push({
      id: field.id,
      imageUrl,
    });
  });

  return images;
};

const normalizeGeneratedImages = (
  responseBody: ApiResponse<unknown> | unknown
): RoomDesignGeneratedImage[] => {
  const unwrapped = unwrapEnvelope(responseBody);

  if (Array.isArray(unwrapped)) {
    return unwrapped
      .map((item, index) => normalizeGeneratedImageItem(item, index))
      .filter((item): item is RoomDesignGeneratedImage => Boolean(item));
  }

  const rootRecord = toRecord(unwrapped);
  if (!rootRecord) {
    return [];
  }

  const prompt =
    toTrimmedString(getValueByKeys(rootRecord, ['fluxPromptUsed', 'FluxPromptUsed', 'prompt'])) ??
    null;
  const arrayCandidates = getArrayByKeys(rootRecord, [
    'generatedImages',
    'GeneratedImages',
    'images',
    'Images',
    'items',
    'Items',
    'results',
    'Results',
  ]);

  const generatedImages = arrayCandidates
    .map((item, index) => normalizeGeneratedImageItem(item, index, prompt))
    .filter((item): item is RoomDesignGeneratedImage => Boolean(item));

  if (generatedImages.length > 0) {
    return generatedImages;
  }

  return createGeneratedImagesFallback(rootRecord);
};

const normalizeAllergyPlant = (
  source: unknown,
  index: number
): RoomDesignAllergyPlant | null => {
  const record = toRecord(source);
  if (!record) {
    return null;
  }

  const id =
    toNumber(record.id) ??
    toNumber(record.plantId) ??
    toNumber(record.commonPlantId);
  const name =
    toTrimmedString(record.name) ??
    toTrimmedString(record.plantName) ??
    toTrimmedString(record.itemName);

  if (id === null || !name) {
    return null;
  }

  return {
    id,
    name,
    scientificName:
      toTrimmedString(record.specificName) ??
      toTrimmedString(record.scientificName) ??
      null,
    imageUrl: resolvePrimaryImageFromRecord(record),
  };
};

const extractAllergyPlantItems = (responseBody: ApiResponse<unknown> | unknown): unknown[] => {
  const unwrapped = unwrapEnvelope(responseBody);
  if (Array.isArray(unwrapped)) {
    return unwrapped;
  }

  const record = toRecord(unwrapped);
  if (!record) {
    return [];
  }

  const nestedItems = getArrayByKeys(record, ['items', 'plants', 'results', 'data']);
  if (nestedItems.length > 0) {
    return nestedItems;
  }

  const nestedPayload = unwrapEnvelope(record);
  if (Array.isArray(nestedPayload)) {
    return nestedPayload;
  }

  return [];
};

const normalizeRoomImageItem = (source: unknown): RoomDesignUploadedImage | null => {
  const record = toRecord(source);
  if (!record) {
    return null;
  }

  const id =
    toNumber(getValueByKeys(record, ['roomImageId', 'RoomImageId', 'id', 'Id'])) ??
    null;

  if (id === null) {
    return null;
  }

  return {
    roomImageId: id,
    imageUrl: toTrimmedString(getValueByKeys(record, ['imageUrl', 'ImageUrl', 'url', 'Url'])) ?? null,
    viewAngle: toTrimmedString(getValueByKeys(record, ['viewAngle', 'ViewAngle'])) ?? null,
    moderationStatus:
      toTrimmedString(getValueByKeys(record, ['moderationStatus', 'ModerationStatus'])) ?? null,
    moderationReason:
      toTrimmedString(getValueByKeys(record, ['moderationReason', 'ModerationReason'])) ?? null,
    uploadedAt: toTrimmedString(getValueByKeys(record, ['uploadedAt', 'UploadedAt'])) ?? null,
  };
};

const extractRoomImageItems = (responseBody: ApiResponse<unknown> | unknown): RoomDesignUploadedImage[] => {
  const unwrapped = unwrapEnvelope(responseBody);
  if (Array.isArray(unwrapped)) {
    return unwrapped
      .map((item) => normalizeRoomImageItem(item))
      .filter((item): item is RoomDesignUploadedImage => Boolean(item));
  }

  const root = toRecord(unwrapped);
  if (!root) {
    return [];
  }

  const candidates = getArrayByKeys(root, [
    'roomImages',
    'RoomImages',
    'items',
    'Images',
    'images',
  ]);

  return candidates
    .map((item) => normalizeRoomImageItem(item))
    .filter((item): item is RoomDesignUploadedImage => Boolean(item));
};

export const roomDesignService = {
  searchAllergyPlants: async (
    keyword?: string,
    take = 50
  ): Promise<RoomDesignAllergyPlant[]> => {
    const normalizedKeyword = keyword?.trim() ?? '';

    const response = await api.get<ApiResponse<unknown>>(
      API.ENDPOINTS.ROOM_DESIGN_ALLERGY_PLANTS,
      {
        params: {
          take,
          ...(normalizedKeyword ? { keyword: normalizedKeyword } : {}),
        },
      }
    );

    return extractAllergyPlantItems(response.data)
      .map((item, index) => normalizeAllergyPlant(item, index))
      .filter((item): item is RoomDesignAllergyPlant => Boolean(item));
  },

  uploadRoomImage: async (
    image: RoomDesignImageFile,
    viewAngle: string
  ): Promise<RoomDesignUploadedImage[]> => {
    const normalizedUri = image.uri.trim();
    if (!normalizedUri) {
      throw new Error('Invalid room image uri');
    }

    const inferredFileName =
      image.fileName?.trim() || normalizedUri.split('/').pop() || `room-${Date.now()}.jpg`;
    const mimeType = image.mimeType?.trim() || 'image/jpeg';

    const formData = new FormData();
    formData.append(
      'Images',
      {
        uri: normalizedUri,
        name: inferredFileName,
        type: mimeType,
      } as any
    );
    formData.append('ViewAngles', viewAngle);

    const response = await api.post<ApiResponse<unknown>>(
      API.ENDPOINTS.ROOM_IMAGE_UPLOAD,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: ROOM_DESIGN_REQUEST_TIMEOUT,
      }
    );

    return extractRoomImageItems(response.data);
  },

  analyzeUpload: async (
    request: RoomDesignAnalyzeRequest
  ): Promise<RoomDesignAnalyzeResult> => {
    const normalizedUri = request.image.uri.trim();
    if (!normalizedUri) {
      throw new Error('Invalid room image uri');
    }

    const inferredFileName =
      request.image.fileName?.trim() ||
      normalizedUri.split('/').pop() ||
      `room-${Date.now()}.jpg`;
    const mimeType = request.image.mimeType?.trim() || 'image/jpeg';

    const formData = new FormData();
    formData.append(
      'Image',
      {
        uri: normalizedUri,
        name: inferredFileName,
        type: mimeType,
      } as any
    );
    formData.append('RoomType', request.roomType);
    formData.append('RoomStyle', request.roomStyle);

    const fengShui = request.fengShuiElement?.trim();
    if (fengShui) {
      formData.append('FengShuiElement', fengShui);
    }

    if (request.roomArea != null && Number.isFinite(request.roomArea)) {
      formData.append('RoomArea', String(request.roomArea));
    }

    const lightDir = request.lightDirection?.trim();
    if (lightDir) {
      formData.append('LightDirection', lightDir);
    }

    const domDir = request.dominantDirection?.trim();
    if (domDir) {
      formData.append('DominantDirection', domDir);
    }

    const natLight = request.naturalLightLevel?.trim();
    if (natLight) {
      formData.append('NaturalLightLevel', natLight);
    }

    if (request.minBudget != null && Number.isFinite(request.minBudget)) {
      formData.append('MinBudget', String(request.minBudget));
    }

    if (request.maxBudget != null && Number.isFinite(request.maxBudget)) {
      formData.append('MaxBudget', String(request.maxBudget));
    }

    const careLevel = request.careLevelType?.trim();
    if (careLevel) {
      formData.append('CareLevelType', careLevel);
    }

    if (typeof request.hasAllergy === 'boolean') {
      formData.append('HasAllergy', request.hasAllergy ? 'true' : 'false');
    }

    if (request.hasAllergy === true) {
      const allergyNote = request.allergyNote?.trim();
      if (allergyNote) {
        formData.append('AllergyNote', allergyNote);
      }

      request.allergicPlantIds?.forEach((plantId) => {
        formData.append('AllergicPlantIds', String(plantId));
      });
    }

    if (typeof request.petSafe === 'boolean') {
      formData.append('PetSafe', request.petSafe ? 'true' : 'false');
    }

    if (typeof request.childSafe === 'boolean') {
      formData.append('ChildSafe', request.childSafe ? 'true' : 'false');
    }

    request.preferredNurseryIds?.forEach((nurseryId) => {
      formData.append('PreferredNurseryIds', String(nurseryId));
    });

    const response = await api.post<ApiResponse<unknown>>(
      API.ENDPOINTS.ROOM_DESIGN_ANALYZE_UPLOAD,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: ROOM_DESIGN_REQUEST_TIMEOUT,
      }
    );

    return normalizeAnalyzeResult(response.data);
  },

  analyze: async (
    payload: RoomDesignAnalyzePayload
  ): Promise<RoomDesignAnalyzeResult> => {
    const response = await api.post<ApiResponse<unknown>>(
      API.ENDPOINTS.ROOM_DESIGN_ANALYZE,
      payload,
      {
        timeout: ROOM_DESIGN_REQUEST_TIMEOUT,
      }
    );

    return normalizeAnalyzeResult(response.data);
  },

  generateImages: async (layoutDesignId: number): Promise<void> => {
    await api.post(
      API.ENDPOINTS.ROOM_DESIGN_GENERATE_IMAGES(layoutDesignId),
      undefined,
      {
        timeout: ROOM_DESIGN_REQUEST_TIMEOUT,
      }
    );
  },

  getGeneratedImages: async (
    layoutDesignId: number
  ): Promise<RoomDesignGeneratedImage[]> => {
    const response = await api.get<ApiResponse<unknown>>(
      API.ENDPOINTS.ROOM_DESIGN_GENERATED_IMAGES(layoutDesignId),
      {
        timeout: ROOM_DESIGN_REQUEST_TIMEOUT,
      }
    );

    return normalizeGeneratedImages(response.data);
  },
};
