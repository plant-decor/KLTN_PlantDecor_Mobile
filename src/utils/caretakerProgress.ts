import { ServiceProgress } from '../types';
import { fromZonedTime } from 'date-fns-tz';
import { sanitizeIsoDateKey, VIETNAM_TIME_ZONE } from './dateTime';

export type CaretakerStatusPalette = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

const CHECK_IN_WINDOW_MINUTES = 30;
const MILLISECONDS_PER_MINUTE = 60 * 1000;

const normalizeToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const isCaretakerAssignedStatus = (statusName: string): boolean => {
  const token = normalizeToken(statusName);
  return token.includes('assigned') || token.includes('pending');
};

export const isCaretakerInProgressStatus = (statusName: string): boolean => {
  const token = normalizeToken(statusName);
  return token.includes('inprogress') || token.includes('processing');
};

export const isCaretakerCompletedStatus = (statusName: string): boolean => {
  const token = normalizeToken(statusName);
  return token.includes('completed') || token.includes('done') || token.includes('finished');
};

export const sanitizeCaretakerTaskDateKey = (value?: string | null): string =>
  sanitizeIsoDateKey(value);

export const sortCaretakerProgressesByTaskDate = (items: ServiceProgress[]): ServiceProgress[] => {
  return [...items].sort((left, right) => {
    const leftDate = sanitizeCaretakerTaskDateKey(left.taskDate);
    const rightDate = sanitizeCaretakerTaskDateKey(right.taskDate);

    if (leftDate === rightDate) {
      return left.id - right.id;
    }

    return leftDate.localeCompare(rightDate);
  });
};

export const getCaretakerStatusPalette = (statusName: string): CaretakerStatusPalette => {
  if (isCaretakerCompletedStatus(statusName)) {
    return {
      backgroundColor: '#E8FAEF',
      borderColor: '#BCEBCB',
      textColor: '#1E7040',
    };
  }

  if (isCaretakerInProgressStatus(statusName)) {
    return {
      backgroundColor: '#FFF8E5',
      borderColor: '#FFE6A5',
      textColor: '#9A6A00',
    };
  }

  if (isCaretakerAssignedStatus(statusName)) {
    return {
      backgroundColor: '#E8F4FF',
      borderColor: '#B8DAFF',
      textColor: '#1D5FA7',
    };
  }

  return {
    backgroundColor: '#EEF1F4',
    borderColor: '#D8E0E8',
    textColor: '#4D6173',
  };
};

export const canCheckInCaretakerProgress = (
  progress: ServiceProgress,
  todayDateKey: string
): boolean => {
  const taskDate = sanitizeCaretakerTaskDateKey(progress.taskDate);

  if (
    !isCaretakerAssignedStatus(progress.statusName) ||
    taskDate !== todayDateKey ||
    Boolean(progress.actualStartTime)
  ) {
    return false;
  }

  const shiftStartTimestamp = getProgressShiftStartTimestamp(progress);
  if (shiftStartTimestamp === null) {
    return true;
  }

  return Date.now() >= shiftStartTimestamp - CHECK_IN_WINDOW_MINUTES * MILLISECONDS_PER_MINUTE;
};

export const isLateCheckInCaretakerProgress = (
  progress: ServiceProgress,
  todayDateKey: string
): boolean => {
  const taskDate = sanitizeCaretakerTaskDateKey(progress.taskDate);

  if (
    !isCaretakerAssignedStatus(progress.statusName) ||
    taskDate !== todayDateKey ||
    Boolean(progress.actualStartTime)
  ) {
    return false;
  }

  const shiftStartTimestamp = getProgressShiftStartTimestamp(progress);
  if (shiftStartTimestamp === null) {
    return false;
  }

  return Date.now() > shiftStartTimestamp + CHECK_IN_WINDOW_MINUTES * MILLISECONDS_PER_MINUTE;
};

export const canCheckOutCaretakerProgress = (progress: ServiceProgress): boolean => {
  return (
    isCaretakerInProgressStatus(progress.statusName) &&
    Boolean(progress.actualStartTime) &&
    !progress.actualEndTime
  );
};

const getProgressShiftStartTimestamp = (progress: ServiceProgress): number | null => {
  const taskDate = sanitizeCaretakerTaskDateKey(progress.taskDate);
  const shiftStartTime = progress.shift?.startTime?.trim();

  if (!taskDate || !shiftStartTime) {
    return null;
  }

  const parsedTime = parseShiftTime(shiftStartTime);
  if (!parsedTime) {
    return null;
  }

  const vietnamShiftDateTime = `${taskDate} ${parsedTime.hours}:${parsedTime.minutes}:${parsedTime.seconds}`;
  const shiftStart = fromZonedTime(vietnamShiftDateTime, VIETNAM_TIME_ZONE);

  return Number.isNaN(shiftStart.getTime()) ? null : shiftStart.getTime();
};

const parseShiftTime = (
  value: string
): { hours: string; minutes: string; seconds: string } | null => {
  const matched = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!matched) {
    return null;
  }

  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);
  const seconds = matched[3] ? Number(matched[3]) : 0;

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
};
