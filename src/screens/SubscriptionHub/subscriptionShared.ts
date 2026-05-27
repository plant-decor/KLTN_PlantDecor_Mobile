import { COLORS } from '../../constants';
import { SubscriptionRecord } from '../../types';

export const formatCurrency = (value: number) =>
  `${value.toLocaleString('vi-VN')} VND`;

export const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const getThresholdShade = (tierLevel: number) => {
  if (tierLevel >= 3) {
    return '#D4AF37';
  }

  if (tierLevel === 2) {
    return '#94A3B8';
  }

  return COLORS.primary;
};

export const clampProgress = (value: number) => Math.max(0, Math.min(100, value));

export const getSubscriptionStatusCopy = (
  item: SubscriptionRecord,
  activeLabel: string,
  expiredLabel: string
) => (item.isActive ? activeLabel : expiredLabel);
