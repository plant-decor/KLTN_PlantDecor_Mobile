export const resolveImageUri = (rawImage: unknown): string | null => {
  if (typeof rawImage === 'string') {
    const trimmed = rawImage.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!rawImage || typeof rawImage !== 'object') {
    return null;
  }

  const imageRecord = rawImage as {
    imageUrl?: unknown;
    url?: unknown;
    uri?: unknown;
  };

  const possibleValues = [imageRecord.imageUrl, imageRecord.url, imageRecord.uri];
  for (const value of possibleValues) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
};

const isPrimaryImage = (rawImage: unknown): boolean => {
  if (!rawImage || typeof rawImage !== 'object') {
    return false;
  }

  return (rawImage as { isPrimary?: unknown }).isPrimary === true;
};

export const resolveImageUris = (rawImages: unknown): string[] => {
  const list = Array.isArray(rawImages)
    ? rawImages
    : rawImages !== null && rawImages !== undefined
      ? [rawImages]
      : [];

  if (list.length === 0) {
    return [];
  }

  const sorted = [...list].sort((first, second) => {
    const firstPrimary = isPrimaryImage(first) ? 0 : 1;
    const secondPrimary = isPrimaryImage(second) ? 0 : 1;
    return firstPrimary - secondPrimary;
  });

  const uniqueUris: string[] = [];
  const seen = new Set<string>();

  for (const item of sorted) {
    const uri = resolveImageUri(item);
    if (!uri || seen.has(uri)) {
      continue;
    }

    seen.add(uri);
    uniqueUris.push(uri);
  }

  return uniqueUris;
};

export const resolvePrimaryImageUri = (rawImages: unknown): string | null => {
  const [firstImage] = resolveImageUris(rawImages);
  return firstImage ?? null;
};
