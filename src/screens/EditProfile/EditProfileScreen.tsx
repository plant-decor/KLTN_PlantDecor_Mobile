import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import {
  RootStackParamList,
  UpdateProfileRequest,
  UserGender,
  UserGenderCode,
} from '../../types';
import { useAuthStore } from '../../stores';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditProfile'>;

const CURRENT_YEAR = new Date().getFullYear();
const MIN_BIRTH_YEAR = 1900;

const GENDER_OPTIONS: {
  value: UserGenderCode;
  labelKey: 'profile.editFormGenderMale' | 'profile.editFormGenderFemale' | 'profile.editFormGenderOther';
}[] = [
  { value: 1, labelKey: 'profile.editFormGenderMale' },
  { value: 2, labelKey: 'profile.editFormGenderFemale' },
  { value: 3, labelKey: 'profile.editFormGenderOther' },
];

const mapGenderToCode = (gender?: UserGender): UserGenderCode => {
  if (gender === 'Female') {
    return 2;
  }
  if (gender === 'Other') {
    return 3;
  }
  return 1;
};

const normalizeGenderCode = (rawCode: unknown): UserGenderCode | null => {
  if (rawCode === 1 || rawCode === 2 || rawCode === 3) {
    return rawCode;
  }
  return null;
};

export default function EditProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();

  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [username, setUsername] = useState(user?.username ?? '');
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [address, setAddress] = useState(
    typeof user?.address === 'string' ? user.address : user?.address?.fullAddress ?? ''
  );
  const [birthYear, setBirthYear] = useState(
    typeof user?.birthYear === 'number' ? String(user.birthYear) : ''
  );
  const [gender, setGender] = useState<UserGenderCode>(
    normalizeGenderCode(user?.genderCode) ?? mapGenderToCode(user?.gender)
  );
  const [receiveNotifications, setReceiveNotifications] = useState(
    user?.receiveNotifications ?? user?.receiveNotification ?? false
  );

  const handleUpdateProfile = async () => {
    const trimmedUsername = username.trim();
    const trimmedFullName = fullName.trim();
    const trimmedAddress = address.trim();
    const parsedBirthYear = Number(birthYear);

    if (!trimmedUsername || !trimmedFullName || !trimmedAddress || !birthYear.trim()) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('profile.editFormRequired', {
          defaultValue: 'Please fill in all required fields.',
        })
      );
      return;
    }

    if (
      !Number.isInteger(parsedBirthYear) ||
      parsedBirthYear < MIN_BIRTH_YEAR ||
      parsedBirthYear > CURRENT_YEAR
    ) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('profile.editFormBirthYearInvalid', {
          min: MIN_BIRTH_YEAR,
          max: CURRENT_YEAR,
          defaultValue: `Birth year must be between ${MIN_BIRTH_YEAR} and ${CURRENT_YEAR}.`,
        })
      );
      return;
    }

    const payload: UpdateProfileRequest = {
      username: trimmedUsername,
      fullName: trimmedFullName,
      address: trimmedAddress,
      birthYear: parsedBirthYear,
      gender,
      receiveNotifications,
    };

    try {
      await updateProfile(payload);

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('profile.editFormUpdateSuccess', {
          defaultValue: 'Profile updated successfully.',
        }),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;

      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('profile.editFormUpdateFailed', {
              defaultValue: 'Unable to update profile. Please try again.',
            })
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('profile.editProfile')}</Text>
          <View style={styles.headerButtonPlaceholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>{t('profile.editFormSectionTitle')}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile.editFormUsername')}</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder={t('profile.editFormUsernamePlaceholder')}
                placeholderTextColor={COLORS.gray500}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile.editFormFullName')}</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t('profile.editFormFullNamePlaceholder')}
                placeholderTextColor={COLORS.gray500}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile.editFormAddress')}</Text>
              <TextInput
                style={[styles.input, styles.addressInput]}
                value={address}
                onChangeText={setAddress}
                placeholder={t('profile.editFormAddressPlaceholder')}
                placeholderTextColor={COLORS.gray500}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile.editFormBirthYear')}</Text>
              <TextInput
                style={styles.input}
                value={birthYear}
                onChangeText={setBirthYear}
                placeholder={t('profile.editFormBirthYearPlaceholder')}
                placeholderTextColor={COLORS.gray500}
                keyboardType="number-pad"
                maxLength={4}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile.editFormGender')}</Text>
              <View style={styles.genderRow}>
                {GENDER_OPTIONS.map((option) => {
                  const isSelected = gender === option.value;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.genderOption,
                        isSelected && styles.genderOptionSelected,
                      ]}
                      onPress={() => setGender(option.value)}
                      disabled={isLoading}
                    >
                      <Text
                        style={[
                          styles.genderOptionText,
                          isSelected && styles.genderOptionTextSelected,
                        ]}
                      >
                        {t(option.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={styles.notificationRow}
              onPress={() => setReceiveNotifications((prev) => !prev)}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <View style={styles.notificationTextWrap}>
                <Text style={styles.inputLabel}>{t('profile.editFormReceiveNotification')}</Text>
                <Text style={styles.notificationHint}>
                  {t('profile.editFormReceiveNotificationHint')}
                </Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  receiveNotifications && styles.toggleEnabled,
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    receiveNotifications && styles.toggleThumbEnabled,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleUpdateProfile}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <Text style={styles.saveButtonText}>{t('common.updating')}</Text>
            ) : (
              <Text style={styles.saveButtonText}>{t('profile.editFormSaveButton')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    height: 56,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  headerButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['2xl'],
  },
  formCard: {
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  addressInput: {
    minHeight: 84,
  },
  genderRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  genderOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  genderOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
  },
  genderOptionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  genderOptionTextSelected: {
    color: COLORS.primaryDark,
  },
  notificationRow: {
    marginTop: SPACING.xs,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTextWrap: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  notificationHint: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 999,
    backgroundColor: COLORS.gray300,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleEnabled: {
    backgroundColor: COLORS.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    transform: [{ translateX: 0 }],
  },
  toggleThumbEnabled: {
    transform: [{ translateX: 22 }],
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
  },
  saveButton: {
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.white,
  },
});
