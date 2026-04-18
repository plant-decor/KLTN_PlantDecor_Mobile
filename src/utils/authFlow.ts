import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export type AuthenticatedHomeRoute = 'MainTabs' | 'ShipperHome' | 'CaretakerHome';
export type PostLoginRoute = AuthenticatedHomeRoute | 'Login';

const normalizeRoleInput = (role?: string | null): string => {
  if (typeof role !== 'string') {
    return '';
  }

  return role
    .trim()
    .toLowerCase()
    .replace(/[\[\]"']/g, '');
};

const compactRoleInput = (normalizedRole: string): string => {
  return normalizedRole.replace(/[^a-z]/g, '');
};

const splitRoleTokens = (normalizedRole: string): string[] => {
  return normalizedRole
    .split(/[\s,;|/_-]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

const hasRoleKeyword = (normalizedRole: string, roleKeyword: string): boolean => {
  if (normalizedRole === roleKeyword) {
    return true;
  }

  const compactRole = compactRoleInput(normalizedRole);
  if (compactRole === roleKeyword) {
    return true;
  }

  const tokens = splitRoleTokens(normalizedRole);

  return tokens.some((token) => {
    if (token === roleKeyword) {
      return true;
    }

    return compactRoleInput(token) === roleKeyword;
  });
};

export const isShipperRole = (role?: string | null): boolean => {
  const normalizedRole = normalizeRoleInput(role);
  return hasRoleKeyword(normalizedRole, 'shipper');
};

export const isCaretakerRole = (role?: string | null): boolean => {
  const normalizedRole = normalizeRoleInput(role);
  return hasRoleKeyword(normalizedRole, 'caretaker');
};

export const isCustomerRole = (role?: string | null): boolean => {
  const normalizedRole = normalizeRoleInput(role);
  return hasRoleKeyword(normalizedRole, 'customer');
};

export const isSupportedAppRole = (role?: string | null): boolean => {
  return isCustomerRole(role) || isShipperRole(role) || isCaretakerRole(role);
};

export const resolveAuthenticatedHomeRoute = (
  role?: string | null
): AuthenticatedHomeRoute => {
  if (isShipperRole(role)) {
    return 'ShipperHome';
  }

  if (isCaretakerRole(role)) {
    return 'CaretakerHome';
  }

  return 'MainTabs';
};

export const resolvePostLoginRoute = (
  role?: string | null
): PostLoginRoute => {
  if (isShipperRole(role)) {
    return 'ShipperHome';
  }

  if (isCaretakerRole(role)) {
    return 'CaretakerHome';
  }

  if (isCustomerRole(role)) {
    return 'MainTabs';
  }

  return 'Login';
};

export const resolveDeviceId = async (): Promise<string> => {
  try {
    if (Platform.OS === 'android') {
      const androidId = await Application.getAndroidId();
      return androidId ?? `${Application.applicationId}-android`;
    }

    if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      return iosId ?? `${Application.applicationId}-ios`;
    }

    return Device.deviceName ?? `${Platform.OS}-unknown`;
  } catch {
    return Device.deviceName ?? `${Platform.OS}-${Date.now()}`;
  }
};
