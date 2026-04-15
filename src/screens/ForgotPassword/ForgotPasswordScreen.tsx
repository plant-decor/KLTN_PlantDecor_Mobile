import React, { useEffect, useMemo, useState } from 'react';
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
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { COLORS, RADIUS, SPACING } from '../../constants';
import { BrandedHeader } from '../../components/branding';
import { authService } from '../../services/authService';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;
type RouteParams = RouteProp<RootStackParamList, 'ForgotPassword'>;

const RESEND_SECONDS = 59;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();

  const [email, setEmail] = useState(route.params?.email ?? '');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setSeconds((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [seconds]);

  const formattedTime = useMemo(
    () => `00:${String(seconds).padStart(2, '0')}`,
    [seconds]
  );

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const apiMessage = error.response?.data?.message;
      if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
        return apiMessage;
      }

      if (!error.response || error.code === 'ECONNABORTED' || error.message === 'Network Error') {
        return t('forgotPassword.networkError', {
          defaultValue: 'Cannot connect to server. Please check your network and try again.',
        });
      }
    }

    return t('forgotPassword.defaultError', {
      defaultValue: 'Request failed. Please try again.',
    });
  };

  const validateEmail = (rawEmail: string) => {
    const normalized = rawEmail.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(normalized);
  };

  const handleSendOtp = async () => {
    if (!validateEmail(email)) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('forgotPassword.invalidEmail', { defaultValue: 'Please enter a valid email address.' })
      );
      return;
    }

    try {
      setIsSendingOtp(true);
      await authService.sendPasswordResetOTP(email.trim());
      setOtpSent(true);
      setSeconds(RESEND_SECONDS);

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('forgotPassword.otpSent', {
          defaultValue: 'OTP has been sent to your email. Please check your inbox.',
        })
      );
    } catch (error) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), getErrorMessage(error));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otpSent) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('forgotPassword.sendOtpFirst', { defaultValue: 'Please send OTP first.' })
      );
      return;
    }

    if (!otpCode.trim() || !newPassword || !confirmPassword) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('forgotPassword.fillAllFields', {
          defaultValue: 'Please fill in OTP, new password and confirm password.',
        })
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('forgotPassword.passwordMismatch', { defaultValue: 'Passwords do not match.' })
      );
      return;
    }

    try {
      setIsResetting(true);
      await authService.resetPassword({
        email: email.trim(),
        otpCode: otpCode.trim(),
        newPassword,
        confirmPassword,
      });

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('forgotPassword.resetSuccess', {
          defaultValue: 'Password has been reset. You can now login with your new password.',
        }),
        [
          {
            text: t('common.login', { defaultValue: 'Login' }),
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), getErrorMessage(error));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <BrandedHeader
          containerStyle={styles.headerRow}
          sideWidth={44}
          title={t('forgotPassword.title', { defaultValue: 'Forgot Password' })}
          left={
            <TouchableOpacity
              style={styles.backBtn}
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          }
          right={<View style={styles.headerPlaceholder} />}
        />

        <Text style={styles.subtitle}>
          {t('forgotPassword.subtitle', {
            defaultValue: 'Enter your email to receive an OTP, then set a new password.',
          })}
        </Text>

        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={20} color={COLORS.gray500} />
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('register.emailOrPhone', { defaultValue: 'Email' })}
            placeholderTextColor={COLORS.gray500}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            (isSendingOtp || (otpSent && seconds > 0)) && styles.disabledBtn,
          ]}
          activeOpacity={0.8}
          onPress={handleSendOtp}
          disabled={isSendingOtp || (otpSent && seconds > 0)}
        >
          <Text style={styles.actionBtnText}>
            {isSendingOtp
              ? t('common.loading', { defaultValue: 'Loading...' })
              : otpSent
                ? t('forgotPassword.resendOtp', { defaultValue: 'Resend OTP' })
                : t('forgotPassword.sendOtp', { defaultValue: 'Send OTP' })}
          </Text>
        </TouchableOpacity>

        {otpSent && (
          <View style={styles.otpMetaWrap}>
            <Text style={styles.otpMetaText}>
              {t('forgotPassword.otpSentToEmail', {
                defaultValue: 'OTP has been sent to {{email}}',
                email,
              })}
            </Text>
            <Text style={styles.otpMetaTime}>
              {seconds > 0
                ? t('forgotPassword.resendIn', {
                    defaultValue: 'Resend in {{time}}',
                    time: formattedTime,
                  })
                : t('forgotPassword.canResendNow', {
                    defaultValue: 'You can resend OTP now.',
                  })}
            </Text>
          </View>
        )}

        <View style={styles.inputWrap}>
          <Ionicons name="key-outline" size={20} color={COLORS.gray500} />
          <TextInput
            value={otpCode}
            onChangeText={setOtpCode}
            style={styles.input}
            keyboardType="number-pad"
            maxLength={6}
            placeholder={t('forgotPassword.otpCode', { defaultValue: 'OTP code' })}
            placeholderTextColor={COLORS.gray500}
          />
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray500} />
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            style={styles.input}
            secureTextEntry
            placeholder={t('forgotPassword.newPassword', { defaultValue: 'New password' })}
            placeholderTextColor={COLORS.gray500}
          />
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray500} />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
            secureTextEntry
            placeholder={t('forgotPassword.confirmNewPassword', {
              defaultValue: 'Confirm new password',
            })}
            placeholderTextColor={COLORS.gray500}
          />
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, styles.resetBtn, isResetting && styles.disabledBtn]}
          activeOpacity={0.8}
          onPress={handleResetPassword}
          disabled={isResetting}
        >
          <Text style={styles.actionBtnText}>
            {isResetting
              ? t('common.loading', { defaultValue: 'Loading...' })
              : t('forgotPassword.resetPassword', { defaultValue: 'Reset Password' })}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8F6',
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === 'ios' ? SPACING['4xl'] : SPACING['3xl'],
    paddingBottom: SPACING['4xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  subtitle: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  inputWrap: {
    marginTop: SPACING.md,
    height: 56,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8F9FD',
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  actionBtn: {
    marginTop: SPACING.lg,
    height: 56,
    borderRadius: 24,
    backgroundColor: '#13EC5B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#13EC5B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  resetBtn: {
    marginTop: SPACING['2xl'],
  },
  actionBtnText: {
    color: '#102216',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.65,
  },
  otpMetaWrap: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  otpMetaText: {
    color: '#166534',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  otpMetaTime: {
    marginTop: 4,
    color: '#15803D',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});
