import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { jwtDecode } from 'jwt-decode';
import { Platform } from 'react-native';
import { API, APP_CONFIG } from '../constants';
import {
  ApiResponse,
  AuthJwtClaims,
  AuthTokens,
  LogoutAllRequest,
  LogoutAllResponse,
  User,
  UserGender,
  UpdateProfileRequest,
  LoginRequest,
  GoogleLoginRequest,
  LoginResponse,
  GoogleLoginResponse,
  RegisterRequest,
  RegisterResponse,
  ChangeAvatarPayload,
  ChangeAvatarRequest,
  SendOTPRequest,
  SendOTPResponse,
  SendPasswordResetOTPRequest,
  SendPasswordResetOTPResponse,
  VerifyOTPRequest,
  VerifyOTPResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '../types';
import api from './api';
import {
  clearStoredTokens,
  notifyAuthFailure,
  refreshAccessToken,
  setAuthFailureHandler,
} from './authSession';

const EMPTY_DATE = new Date(0).toISOString();

const getEnvelopeData = <T>(response: ApiResponse<T>): T => {
  const body = response.data ?? response.payload;
  if (!body) {
    throw new Error('Invalid API response: missing data/payload');
  }
  return body;
};

const normalizeBirthYear = (rawBirthYear: unknown): number | undefined => {
  if (typeof rawBirthYear === 'number' && Number.isInteger(rawBirthYear)) {
    return rawBirthYear;
  }

  if (typeof rawBirthYear === 'string' && rawBirthYear.trim().length > 0) {
    const parsed = Number(rawBirthYear);
    return Number.isInteger(parsed) ? parsed : undefined;
  }

  return undefined;
};

const normalizeGender = (
  rawGender: unknown
): { gender?: UserGender; genderCode?: number } => {
  if (typeof rawGender === 'number' && Number.isInteger(rawGender)) {
    return {
      genderCode: rawGender,
    };
  }

  if (typeof rawGender === 'string') {
    const trimmed = rawGender.trim();
    if (trimmed.length === 0) {
      return {};
    }

    const parsed = Number(trimmed);
    if (Number.isInteger(parsed)) {
      return {
        genderCode: parsed,
      };
    }

    return {
      gender: trimmed,
    };
  }

  return {};
};

const normalizeCoordinate = (rawCoordinate: unknown): number | undefined => {
  if (typeof rawCoordinate === 'number' && Number.isFinite(rawCoordinate)) {
    return rawCoordinate;
  }

  if (typeof rawCoordinate === 'string' && rawCoordinate.trim().length > 0) {
    const parsed = Number(rawCoordinate);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const normalizeUpdateGender = (rawGender: unknown): UserGender => {
  if (typeof rawGender === 'string') {
    const trimmed = rawGender.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (typeof rawGender === 'number' && Number.isInteger(rawGender)) {
    return String(rawGender);
  }

  return 'Unknown';
};

const pickFirstNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = pickFirstNonEmptyString(entry);
      if (resolved) {
        return resolved;
      }
    }
  }

  return undefined;
};

const readClaimAsString = (claims: AuthJwtClaims, keys: string[]): string | undefined => {
  const claimRecord = claims as Record<string, unknown>;

  for (const key of keys) {
    const resolved = pickFirstNonEmptyString(claimRecord[key]);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
};

const ROLE_PRIORITY = ['shipper', 'caretaker', 'admin', 'manager', 'staff', 'customer'] as const;

const isRoleFieldName = (fieldName: string): boolean => {
  const compact = fieldName.trim().toLowerCase().replace(/[^a-z]/g, '');

  return (
    compact === 'role' ||
    compact === 'roles' ||
    compact === 'rolename' ||
    compact === 'userrole'
  );
};

const flattenStringValues = (
  value: unknown,
  visitedObjects: WeakSet<object> = new WeakSet<object>(),
  options?: { restrictObjectFields?: boolean }
): string[] => {
  if (typeof value === 'string') {
    return value
      .split(/[,;|]/g)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (visitedObjects.has(value as object)) {
      return [];
    }

    visitedObjects.add(value as object);

    const objectEntries = Object.entries(value as Record<string, unknown>);
    const candidateEntries = options?.restrictObjectFields
      ? objectEntries.filter(([key]) => isRoleFieldName(key))
      : objectEntries;

    return candidateEntries.flatMap(([, entry]) =>
      flattenStringValues(entry, visitedObjects, options)
    );
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => flattenStringValues(entry, visitedObjects, options));
};

const normalizeRoleCandidate = (rawRole: string): string | undefined => {
  const normalized = rawRole.trim().toLowerCase();
  if (normalized.length === 0) {
    return undefined;
  }

  const cleaned = normalized.replace(/[\[\]"']/g, ' ').trim();
  if (cleaned.length === 0) {
    return undefined;
  }

  const roleTokens = cleaned
    .split(/[\s,;|/_-]+/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const compactRoleTokens = roleTokens.map((entry) => entry.replace(/[^a-z]/g, ''));
  const compactCleaned = cleaned.replace(/[^a-z]/g, '');

  const matchedRole = ROLE_PRIORITY.find(
    (role) =>
      cleaned === role ||
      compactCleaned === role ||
      roleTokens.includes(role) ||
      compactRoleTokens.includes(role)
  );

  return matchedRole;
};

const resolveNormalizedRole = (...candidates: unknown[]): string | undefined => {
  for (const candidate of candidates) {
    const roleValues =
      candidate && typeof candidate === 'object'
        ? flattenStringValues(candidate, new WeakSet<object>(), {
            restrictObjectFields: true,
          })
        : flattenStringValues(candidate);

    if (roleValues.length === 0) {
      continue;
    }

    for (const roleValue of roleValues) {
      const normalizedRole = normalizeRoleCandidate(roleValue);
      if (normalizedRole) {
        return normalizedRole;
      }
    }
  }

  return undefined;
};

const normalizeUser = (rawUser: any): User => {
  const normalizedGender = normalizeGender(rawUser?.gender);
  const normalizedPhoneNumber =
    typeof rawUser?.phoneNumber === 'string' && rawUser.phoneNumber.trim().length > 0
      ? rawUser.phoneNumber
      : typeof rawUser?.phone === 'string' && rawUser.phone.trim().length > 0
        ? rawUser.phone
        : undefined;
  const normalizedAvatarUrl =
    typeof rawUser?.avatarUrl === 'string' && rawUser.avatarUrl.trim().length > 0
      ? rawUser.avatarUrl
      : typeof rawUser?.avatarURL === 'string' && rawUser.avatarURL.trim().length > 0
        ? rawUser.avatarURL
        : typeof rawUser?.avatar === 'string' && rawUser.avatar.trim().length > 0
          ? rawUser.avatar
          : undefined;
  const normalizedLatitude = normalizeCoordinate(rawUser?.latitude);
  const normalizedLongitude = normalizeCoordinate(rawUser?.longitude);
  const normalizedReceiveNotifications =
    typeof rawUser?.receiveNotifications === 'boolean'
      ? rawUser.receiveNotifications
      : typeof rawUser?.receiveNotification === 'boolean'
        ? rawUser.receiveNotification
        : undefined;
  const normalizedRole = resolveNormalizedRole(
    rawUser?.role,
    rawUser?.Role,
    rawUser?.roles,
    rawUser?.roleName,
    rawUser?.RoleName,
    rawUser?.userRole,
    rawUser?.UserRole
  );

  return {
    id: String(rawUser?.id ?? rawUser?.sub ?? ''),
    email: rawUser?.email ?? '',
    username: rawUser?.username ?? rawUser?.userName ?? undefined,
    fullName: rawUser?.fullName ?? rawUser?.username ?? rawUser?.name ?? '',
    phone: normalizedPhoneNumber,
    phoneNumber: normalizedPhoneNumber,
    avatar: normalizedAvatarUrl,
    avatarUrl: normalizedAvatarUrl,
    address:
      typeof rawUser?.address === 'string'
        ? rawUser.address
        : rawUser?.address?.fullAddress ?? undefined,
    birthYear: normalizeBirthYear(rawUser?.birthYear),
    gender: normalizedGender.gender,
    genderCode: normalizedGender.genderCode,
    latitude: normalizedLatitude,
    longitude: normalizedLongitude,
    receiveNotifications: normalizedReceiveNotifications,
    receiveNotification: normalizedReceiveNotifications,
    profileCompleteness:
      typeof rawUser?.profileCompleteness === 'number'
        ? rawUser.profileCompleteness
        : undefined,
    createdAt: rawUser?.createdAt ?? EMPTY_DATE,
    updatedAt: rawUser?.updatedAt,
    status: rawUser?.status,
    isVerified: rawUser?.isVerified,
    role: normalizedRole,
  };
};

const buildUserFromToken = (accessToken: string): User | null => {
  try {
    const claims = jwtDecode<AuthJwtClaims>(accessToken);
    const claimRecord = claims as Record<string, unknown>;

    // Force refresh flow when the access token has expired.
    if (typeof claims?.exp === 'number') {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (claims.exp <= nowInSeconds) {
        return null;
      }
    }

    const tokenSubject = readClaimAsString(claims, [
      'sub',
      'nameid',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    ]);
    const tokenEmail = readClaimAsString(claims, [
      'email',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      'preferred_username',
      'upn',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
    ]);

    if (!tokenSubject && !tokenEmail) {
      return null;
    }

    const tokenName = readClaimAsString(claims, [
      'name',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    ]);
    const tokenRole = resolveNormalizedRole(
      claimRecord.Role,
      claimRecord.role,
      claimRecord.roles,
      claimRecord.roleName,
      claimRecord.RoleName,
      claimRecord.userRole,
      claimRecord.UserRole,
      claimRecord['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
      claimRecord['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role']
    );
    const tokenAvatar = readClaimAsString(claims, ['avatarURL', 'avatarUrl']);

    return normalizeUser({
      id: tokenSubject,
      email: tokenEmail,
      name: tokenName,
      role: tokenRole,
      avatarURL: tokenAvatar,
    });
  } catch {
    return null;
  }
};

const resolveDeviceId = async (): Promise<string> => {
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

type SignOutTokenSnapshot = {
  accessToken: string | null;
  refreshToken: string | null;
};

const readStoredTokenSnapshot = async (): Promise<SignOutTokenSnapshot> => {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN),
    SecureStore.getItemAsync(APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN),
  ]);

  return {
    accessToken,
    refreshToken,
  };
};

let signOutRequestInFlight: Promise<void> | null = null;
const runSignOutRequest = async (requestFactory: () => Promise<void>): Promise<void> => {
  if (signOutRequestInFlight) {
    return signOutRequestInFlight;
  }

  signOutRequestInFlight = requestFactory().finally(() => {
    signOutRequestInFlight = null;
  });

  return signOutRequestInFlight;
};

export const authService = {
  setAuthFailureHandler,
  notifyAuthFailure,
  getStoredTokenSnapshot: async (): Promise<SignOutTokenSnapshot> => {
    return readStoredTokenSnapshot();
  },
  clearSessionTokens: async () => {
    await clearStoredTokens();
  },
  login: async (email: string, password: string, deviceId: string) => {
    const loginRequest: LoginRequest = { email, password, deviceId };
    const response = await api.post<LoginResponse>(
      API.ENDPOINTS.LOGIN,
      loginRequest
    );

    const { accessToken, refreshToken } = response.data.payload;
    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN,
      accessToken
    );
    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN,
      refreshToken
    );

    const user = buildUserFromToken(accessToken);
    return { user, tokens: { accessToken, refreshToken } };
  },

  loginWithGoogle: async (accessToken: string, deviceId: string) => {
    const request: GoogleLoginRequest = { accessToken, deviceId };
    const response = await api.post<GoogleLoginResponse>(
      API.ENDPOINTS.LOGIN_GOOGLE,
      request
    );

    const {
      accessToken: appAccessToken,
      refreshToken,
    } = response.data.payload;

    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN,
      appAccessToken
    );
    await SecureStore.setItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.REFRESH_TOKEN,
      refreshToken
    );

    const user = buildUserFromToken(appAccessToken);
    return { user, tokens: { accessToken: appAccessToken, refreshToken } };
  },

  refreshToken: async (refreshToken?: string) => {
    const tokens = await refreshAccessToken(refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = tokens;

    const user = buildUserFromToken(accessToken);
    return { user, tokens: { accessToken, refreshToken: newRefreshToken } };
  },

  register: async (data: RegisterRequest) => {
    const response = await api.post<RegisterResponse>(
      API.ENDPOINTS.REGISTER,
      data
    );

    // Registration doesn't return tokens - user must verify email first
    const registerData = getEnvelopeData(response.data);
    return {
      user: normalizeUser(registerData.user),
      message: response.data.message,
    };
  },

  logout: async (tokenSnapshot?: SignOutTokenSnapshot) => {
    await runSignOutRequest(async () => {
      try {
        const { accessToken, refreshToken } =
          tokenSnapshot ?? (await readStoredTokenSnapshot());
        const deviceId = await resolveDeviceId();
        if (accessToken || refreshToken) {
          await api.post(API.ENDPOINTS.LOGOUT, {
            accessToken,
            refreshToken,
            deviceId,
          });
        }
      } catch {
        // Ignore logout API errors
      } finally {
        if (!tokenSnapshot) {
          await clearStoredTokens();
        }
      }
    });
  },

  logoutAll: async (tokenSnapshot?: SignOutTokenSnapshot) => {
    await runSignOutRequest(async () => {
      try {
        const { accessToken, refreshToken } =
          tokenSnapshot ?? (await readStoredTokenSnapshot());
        if (accessToken && refreshToken) {
          const request: LogoutAllRequest = {
            accessToken,
            refreshToken,
            deviceId: await resolveDeviceId(),
          };
          await api.post<LogoutAllResponse>(API.ENDPOINTS.LOGOUT_ALL, request);
        }
      } catch {
        // Ignore logout API errors
      } finally {
        if (!tokenSnapshot) {
          await clearStoredTokens();
        }
      }
    });
  },

  getProfile: async () => {
    const response = await api.get<ApiResponse<User>>(API.ENDPOINTS.PROFILE);
    return normalizeUser(getEnvelopeData(response.data));
  },

  updateProfile: async (data: UpdateProfileRequest) => {
    const requestPayload: UpdateProfileRequest = {
      userName: data.userName.trim(),
      phoneNumber: data.phoneNumber.trim(),
      fullName: data.fullName.trim(),
      address: data.address.trim(),
      birthYear: data.birthYear,
      gender: normalizeUpdateGender(data.gender),
      latitude: Number.isFinite(data.latitude) ? data.latitude : 0,
      longitude: Number.isFinite(data.longitude) ? data.longitude : 0,
      receiveNotifications: Boolean(data.receiveNotifications),
    };

    const response = await api.put<ApiResponse<User>>(
      API.ENDPOINTS.UPDATE_PROFILE,
      requestPayload
    );
    return normalizeUser(getEnvelopeData(response.data));
  },

  changeAvatar: async (request: ChangeAvatarRequest) => {
    const normalizedUri = request.uri?.trim();
    if (!normalizedUri) {
      throw new Error('Invalid avatar file uri');
    }

    const inferredFileName = normalizedUri.split('/').pop() || `avatar-${Date.now()}.jpg`;
    const fileName = request.fileName?.trim() || inferredFileName;
    const mimeType = request.mimeType?.trim() || 'image/jpeg';

    const formData = new FormData();
    formData.append(
      'file',
      {
        uri: normalizedUri,
        name: fileName,
        type: mimeType,
      } as any
    );

    const response = await api.put<ApiResponse<ChangeAvatarPayload>>(
      API.ENDPOINTS.CHANGE_AVATAR,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    const payload = getEnvelopeData(response.data);
    const avatarURL = payload?.avatarURL;

    if (typeof avatarURL !== 'string' || avatarURL.trim().length === 0) {
      throw new Error('Invalid avatar upload response');
    }

    return avatarURL;
  },

  getUserFromStoredToken: async (): Promise<User | null> => {
    const token = await SecureStore.getItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN
    );
    if (!token) {
      return null;
    }
    return buildUserFromToken(token);
  },

  checkAuthStatus: async (): Promise<boolean> => {
    const token = await SecureStore.getItemAsync(
      APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN
    );
    return !!token;
  },

  sendOTP: async (email: string) => {
    const request: SendOTPRequest = { email };
    const response = await api.post<SendOTPResponse>(
      API.ENDPOINTS.SEND_OTP_EMAIL,
      request
    );
    return response.data;
  },

  sendPasswordResetOTP: async (email: string) => {
    const request: SendPasswordResetOTPRequest = { email };
    const response = await api.post<SendPasswordResetOTPResponse>(
      API.ENDPOINTS.SEND_OTP_PASSWORD_RESET,
      request
    );
    return response.data;
  },

  verifyOTP: async (email: string, otpCode: string) => {
    const request: VerifyOTPRequest = { email, otpCode };
    const response = await api.post<VerifyOTPResponse>(
      API.ENDPOINTS.VERIFY_OTP_EMAIL,
      request
    );
    return response.data;
  },

  resetPassword: async (data: ResetPasswordRequest) => {
    const request: ResetPasswordRequest & { otp?: string; password?: string } = {
      ...data,
      // Keep aliases for backend naming variants to improve compatibility.
      otp: data.otpCode,
      password: data.newPassword,
    };

    const response = await api.post<ResetPasswordResponse>(
      API.ENDPOINTS.RESET_PASSWORD,
      request
    );
    return response.data;
  },
};
