type TranslateFn = (
  key: string,
  options?: {
    defaultValue?: string;
    [key: string]: unknown;
  }
) => string;

type StatusColor = {
  backgroundColor: string;
  textColor: string;
};

const DEFAULT_STATUS_COLOR: StatusColor = {
  backgroundColor: '#F3F4F6',
  textColor: '#4B5563',
};

const toTranslationKey = (status: string): string => {
  const sanitized = status.replace(/[^a-zA-Z0-9]/g, '');
  if (!sanitized) {
    return '';
  }

  return sanitized.charAt(0).toLowerCase() + sanitized.slice(1);
};

const normalizeStatusToken = (status: string): string => status.trim().toLowerCase();

export const getOrderStatusLabel = (
  status: string,
  translate: TranslateFn,
  apiLabel?: string
): string => {
  const translationKey = toTranslationKey(status);
  const fallbackLabel = apiLabel || status;

  if (!translationKey) {
    return fallbackLabel;
  }

  return translate(`orderHistory.status.${translationKey}`, {
    defaultValue: fallbackLabel,
  });
};

export const getOrderStatusColors = (status: string): StatusColor => {
  const token = normalizeStatusToken(status);

  if (!token) {
    return DEFAULT_STATUS_COLOR;
  }

  if (token.includes('refund')) {
    return {
      backgroundColor: '#F3ECFF',
      textColor: '#7A3DD4',
    };
  }

  if (token.includes('fail') || token.includes('reject')) {
    return {
      backgroundColor: '#FDEBEC',
      textColor: '#B42318',
    };
  }

  if (token.includes('cancel')) {
    return {
      backgroundColor: '#F3F4F6',
      textColor: '#6B7280',
    };
  }

  if (token.includes('ship') || token.includes('assign')) {
    return {
      backgroundColor: '#EAF2FF',
      textColor: '#2958A5',
    };
  }

  if (token.includes('remaining') && token.includes('pending')) {
    return {
      backgroundColor: '#FFF3E5',
      textColor: '#995200',
    };
  }

  if (token.includes('deliver') || token.includes('complete') || token.includes('paid')) {
    return {
      backgroundColor: '#E7F8EF',
      textColor: '#1B7F46',
    };
  }

  if (token.includes('pending')) {
    return {
      backgroundColor: '#FFF4CC',
      textColor: '#8A6D1F',
    };
  }

  return DEFAULT_STATUS_COLOR;
};
