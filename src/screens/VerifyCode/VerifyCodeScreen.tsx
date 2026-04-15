import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants';
import { BrandedHeader } from '../../components/branding';
import { RootStackParamList } from '../../types';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../stores/useAuthStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'VerifyCode'>;
type RouteParams = RouteProp<RootStackParamList, 'VerifyCode'>;

const OTP_LENGTH = 6;
const INITIAL_SECONDS = 59;

export default function VerifyCodeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { email, password } = route.params;
  const { login } = useAuthStore();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [seconds, setSeconds] = useState(INITIAL_SECONDS);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Get device ID
  useEffect(() => {
    const resolveDeviceId = async () => {
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

    resolveDeviceId().then(setDeviceId);
  }, []);

  // Send OTP on mount
  useEffect(() => {
    sendOTPCode();
  }, []);

  const sendOTPCode = async () => {
    try {
      setIsResending(true);
      await authService.sendOTP(email);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || 'Failed to send OTP';
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    if (seconds === 0) return;

    const timer = setTimeout(() => {
      setSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [seconds]);

  const formattedTime = `00:${String(seconds).padStart(2, '0')}`;

  const handleChange = (value: string, index: number) => {
    const safeValue = value.replace(/[^0-9]/g, '').slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = safeValue;
    setOtp(nextOtp);

    if (safeValue && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (seconds > 0) return;
    setOtp(Array(OTP_LENGTH).fill(''));
    setSeconds(INITIAL_SECONDS);
    inputRefs.current[0]?.focus();
    await sendOTPCode();
  };

  const handleConfirm = async () => {
    if (!isOtpComplete) return;

    try {
      setIsLoading(true);
      const otpCode = otp.join('');

      // First verify OTP
      await authService.verifyOTP(email, otpCode);

      // Then auto-login
      const loggedInUser = await login(email, password, deviceId || 'unknown-device');

      // Navigate to main app
      const isShipper = loggedInUser?.role?.toLowerCase() === 'shipper';
      navigation.replace(isShipper ? 'ShipperHome' : 'MainTabs');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || 'Verification or login failed';
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const isOtpComplete = otp.every((digit) => digit.length === 1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.bgLeafTop}>
          <Ionicons name="leaf-outline" size={120} color={COLORS.primaryLight} />
        </View>

        <View style={styles.bgLeafBottom}>
          <Ionicons name="leaf-outline" size={250} color={COLORS.primaryLight} />
        </View>

        <View style={styles.contentWrap}>
          <BrandedHeader
            containerStyle={styles.header}
            sideWidth={44}
            title={t('verifyCode.headerTitle')}
            left={
              <TouchableOpacity
                style={styles.headerBackBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            }
            right={<View style={styles.headerRightPlaceholder} />}
          />

          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark-outline" size={30} color={COLORS.primaryLight} />
            </View>

            <Text style={styles.title}>{t('verifyCode.title')}</Text>
            <Text style={styles.subtitle}>{t('verifyCode.subtitle')}</Text>

            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  value={digit}
                  style={styles.otpInput}
                  onChangeText={(value) => handleChange(value, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectionColor={COLORS.primaryLight}
                />
              ))}
            </View>

            <Text style={styles.helpText}>{t('verifyCode.didNotReceive')}</Text>

            <View style={styles.resendRow}>
              <TouchableOpacity onPress={handleResend} disabled={seconds > 0}>
                <Text style={[styles.resendText, seconds > 0 && styles.resendTextDisabled]}>
                  {t('verifyCode.resend')}
                </Text>
              </TouchableOpacity>

              <View style={styles.separator} />

              <View style={styles.timerPill}>
                <Ionicons name="time-outline" size={14} color={COLORS.textPrimary} />
                <Text style={styles.timerText}>{formattedTime}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, (!isOtpComplete || isLoading) && styles.confirmButtonDisabled]}
            activeOpacity={0.85}
            disabled={!isOtpComplete || isLoading}
            onPress={handleConfirm}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.black} />
            ) : (
              <>
                <Text style={styles.confirmButtonText}>{t('verifyCode.confirm')}</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.black} />
              </>
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
  flex: {
    flex: 1,
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING['3xl'],
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
  },
  headerRightPlaceholder: {
    width: 40,
    height: 40,
  },
  content: {
    alignItems: 'center',
    marginTop: SPACING['5xl'],
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(19, 236, 19, 0.20)',
    marginBottom: SPACING['3xl'],
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 40 / 1.4,
    fontWeight: '800',
    lineHeight: 38,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xl,
    lineHeight: 26,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING['4xl'],
    marginBottom: SPACING['3xl'],
  },
  otpInput: {
    width: 44,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E4E4E7',
    backgroundColor: COLORS.background,
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  helpText: {
    color: '#71717A',
    fontSize: FONTS.sizes.lg,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resendText: {
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  resendTextDisabled: {
    opacity: 0.65,
  },
  separator: {
    width: 1,
    height: 16,
    backgroundColor: '#D4D4D8',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  timerText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  confirmButton: {
    height: 56,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: COLORS.primaryLight,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  confirmButtonDisabled: {
    opacity: 0.45,
  },
  confirmButtonText: {
    color: COLORS.black,
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
  },
  bgLeafTop: {
    position: 'absolute',
    top: -26,
    left: -20,
    opacity: 0.1,
    transform: [{ rotate: '-12deg' }],
  },
  bgLeafBottom: {
    position: 'absolute',
    bottom: -60,
    right: -90,
    opacity: 0.1,
    transform: [{ rotate: '12deg' }],
  },
});
