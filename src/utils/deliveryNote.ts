export interface ParsedDeliveryNote {
  note: string | null;
  deliveryImageUrl: string | null;
}

const DELIVERY_IMAGE_MARKER_REGEX = /\s*\|?\s*delivery image:\s*/i;
const DELIVERY_IMAGE_URL_REGEX = /https?:\/\/[^\s|]+/i;

export const parseDeliveryNoteWithImage = (
  rawDeliveryNote: string | null | undefined
): ParsedDeliveryNote => {
  if (typeof rawDeliveryNote !== 'string') {
    return {
      note: null,
      deliveryImageUrl: null,
    };
  }

  const trimmed = rawDeliveryNote.trim();
  if (!trimmed) {
    return {
      note: null,
      deliveryImageUrl: null,
    };
  }

  const markerMatch = DELIVERY_IMAGE_MARKER_REGEX.exec(trimmed);
  if (!markerMatch) {
    return {
      note: trimmed,
      deliveryImageUrl: null,
    };
  }

  const markerStart = markerMatch.index;
  const markerText = markerMatch[0];
  const notePart = trimmed.slice(0, markerStart).replace(/\s*\|\s*$/, '').trim();
  const markerTail = trimmed.slice(markerStart + markerText.length).trim();

  const urlMatch = DELIVERY_IMAGE_URL_REGEX.exec(markerTail);
  const deliveryImageUrl = urlMatch ? urlMatch[0].trim() : null;
  const fallbackNote = notePart || markerTail;

  return {
    note: fallbackNote || null,
    deliveryImageUrl,
  };
};
