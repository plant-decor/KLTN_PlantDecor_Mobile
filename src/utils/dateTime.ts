import { format as formatDate } from 'date-fns';
import { enUS, vi } from 'date-fns/locale';
import type { Locale } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const ISO_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_WITH_TIMEZONE_REGEX = /(Z|[+-]\d{2}:\d{2})$/;
const DATETIME_WITHOUT_TIMEZONE_REGEX =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

const isVietnamLocale = (locale: string): boolean => locale.toLowerCase().startsWith('vi');

const resolveLocale = (locale: string): Locale =>
  isVietnamLocale(locale) ? vi : enUS;

const resolveDatePattern = (locale: string): string =>
  isVietnamLocale(locale) ? 'dd/MM/yyyy' : 'MM/dd/yyyy';

const resolveDateTimePattern = (locale: string, hour12?: boolean): string => {
  if (hour12 === true) {
    return isVietnamLocale(locale) ? 'dd/MM/yyyy hh:mm a' : 'MM/dd/yyyy hh:mm a';
  }

  if (hour12 === false) {
    return isVietnamLocale(locale) ? 'dd/MM/yyyy HH:mm' : 'MM/dd/yyyy HH:mm';
  }

  return isVietnamLocale(locale) ? 'dd/MM/yyyy HH:mm' : 'MM/dd/yyyy hh:mm a';
};

const parseDateInput = (value: Date | string | number): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (ISO_DATE_KEY_REGEX.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map((item) => Number(item));
    return new Date(year, month - 1, day);
  }

  if (
    DATETIME_WITHOUT_TIMEZONE_REGEX.test(trimmed) &&
    !DATETIME_WITH_TIMEZONE_REGEX.test(trimmed)
  ) {
    const normalized = trimmed.replace(' ', 'T');
    const parsed = new Date(`${normalized}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildIsoDateKey = (year: number, month: number, day: number): string => {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const sanitizeIsoDateKey = (value?: string | null): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().slice(0, 10);
  return ISO_DATE_KEY_REGEX.test(normalized) ? normalized : '';
};

export const isIsoDateKey = (value: string): boolean =>
  sanitizeIsoDateKey(value) === value;

export const parseIsoDateKeyToDate = (
  value: string,
  fallback: Date = new Date()
): Date => {
  const dateKey = sanitizeIsoDateKey(value);
  if (!dateKey) {
    return fallback;
  }

  const [year, month, day] = dateKey.split('-').map((item) => Number(item));
  return new Date(year, month - 1, day);
};

export const formatDateToIsoKey = (value: Date): string => {
  return buildIsoDateKey(
    value.getFullYear(),
    value.getMonth() + 1,
    value.getDate()
  );
};

export const addDaysToIsoDateKey = (value: string, days: number): string => {
  const dateKey = sanitizeIsoDateKey(value);
  if (!dateKey) {
    return '';
  }

  const [year, month, day] = dateKey.split('-').map((item) => Number(item));
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);

  return buildIsoDateKey(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth() + 1,
    utcDate.getUTCDate()
  );
};

export const getVietnamDateKey = (value: Date | string | number = new Date()): string => {
  if (typeof value === 'string') {
    const dateKey = sanitizeIsoDateKey(value);
    if (dateKey) {
      return dateKey;
    }
  }

  const parsed = parseDateInput(value);
  if (!parsed) {
    return '';
  }

  return formatInTimeZone(parsed, VIETNAM_TIME_ZONE, 'yyyy-MM-dd');
};

export const getVietnamDateKeyAfterHours = (
  leadHours: number,
  from: Date = new Date()
): string => {
  const afterLeadTime = new Date(from.getTime() + leadHours * MILLISECONDS_PER_HOUR);
  return getVietnamDateKey(afterLeadTime);
};

export const getMinimumVietnamDateKeyForLeadHours = (
  leadHours: number,
  from: Date = new Date()
): string => getVietnamDateKeyAfterHours(leadHours, from);

const getVietnamEndOfDay = (dateKey: string): Date | null => {
  const normalized = sanitizeIsoDateKey(dateKey);
  if (!normalized) {
    return null;
  }

  const [year, month, day] = normalized.split('-').map((item) => Number(item));
  return fromZonedTime(
    new Date(year, month - 1, day, 23, 59, 59, 999),
    VIETNAM_TIME_ZONE
  );
};

export const isVietnamDateKeyMeetingLeadHours = (
  dateKey: string,
  leadHours: number,
  from: Date = new Date()
): boolean => {
  const selectedDateEnd = getVietnamEndOfDay(dateKey);
  if (!selectedDateEnd) {
    return false;
  }

  const minimumDateTime = new Date(from.getTime() + leadHours * MILLISECONDS_PER_HOUR);
  return selectedDateEnd.getTime() >= minimumDateTime.getTime();
};

export const formatVietnamDate = (
  value: Date | string | number | null | undefined,
  locale: string,
  options?: {
    empty?: string;
  }
): string => {
  const empty = options?.empty ?? '--';

  if (value === null || value === undefined) {
    return empty;
  }

  if (typeof value === 'string') {
    const dateKey = sanitizeIsoDateKey(value);
    if (dateKey) {
      const keyDate = parseIsoDateKeyToDate(dateKey);
      return formatDate(keyDate, resolveDatePattern(locale), {
        locale: resolveLocale(locale),
      });
    }
  }

  const parsed = parseDateInput(value);
  if (!parsed) {
    return typeof value === 'string' ? value : empty;
  }

  return formatInTimeZone(parsed, VIETNAM_TIME_ZONE, resolveDatePattern(locale), {
    locale: resolveLocale(locale),
  });
};

export const formatVietnamDateTime = (
  value: Date | string | number | null | undefined,
  locale: string,
  options?: {
    empty?: string;
    hour12?: boolean;
  }
): string => {
  const empty = options?.empty ?? '--';

  if (value === null || value === undefined) {
    return empty;
  }

  const parsed = parseDateInput(value);
  if (!parsed) {
    return typeof value === 'string' ? value : empty;
  }

  return formatInTimeZone(parsed, VIETNAM_TIME_ZONE, resolveDateTimePattern(locale, options?.hour12), {
    locale: resolveLocale(locale),
  });
};

export const toVietnamTimestamp = (value: Date | string | number): number => {
  const parsed = parseDateInput(value);
  return parsed ? parsed.getTime() : 0;
};
