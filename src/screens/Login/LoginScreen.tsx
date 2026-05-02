import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, ICONS, IMAGES, RADIUS, SPACING } from '../../constants';
import { BrandMark } from '../../components/branding';
import { googleSignInService } from '../../services/googleSignInService';
import { RootStackParamList } from '../../types';
import { useAuthStore } from '../../stores/useAuthStore';
import { resolveDeviceId } from '../../utils/authFlow';
import {
  isEmailVerificationRequiredError,
  resolveGoogleAuthErrorMessage,
  resolveLoginErrorMessage,
} from '../../utils/authErrors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const HERO_HEIGHT = 352;
const CARD_TOP_SPACER = HERO_HEIGHT - 48;

const TOP_IMAGE = IMAGES.loginBG;

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const login = useAuthStore((state) => state.login);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const cardMinHeight = Math.max(0, windowHeight - CARD_TOP_SPACER);
  const isExpoGoRuntime =
    (Application.applicationId ?? '').toLowerCase() === 'host.exp.exponent';

  const registerLabel = i18n.language?.startsWith('vi')
    ? 'Đăng\u00A0ký'
    : t('common.register', { defaultValue: 'Register' });

  useEffect(() => {
    resolveDeviceId().then(setDeviceId);
  }, []);

  const handleLogin = async () => {
    const normalizedEmail = email.trim();
    const hasPassword = password.trim().length > 0;

    if (!normalizedEmail || !hasPassword) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('login.fillAllFields', { defaultValue: 'Please fill in all fields.' })
      );
      return;
    }

    try {
      await login(normalizedEmail, password, deviceId || 'unknown-device');
    } catch (err) {
      if (isEmailVerificationRequiredError(err)) {
        Alert.alert(
          t('login.verifyEmailTitle', { defaultValue: 'Email verification required' }),
          t('login.verifyEmailMessage', {
            defaultValue: 'Your email is not verified. Please verify it to continue.',
          }),
          [
            {
              text: t('common.cancel', { defaultValue: 'Cancel' }),
              style: 'cancel',
            },
            {
              text: t('login.verifyEmailAction', { defaultValue: 'Verify now' }),
              onPress: () =>
                navigation.navigate('VerifyCode', {
                  email: normalizedEmail,
                  password,
                }),
            },
          ]
        );
        return;
      }

      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        resolveLoginErrorMessage(err, t)
      );
    }
  };

  const handleGoogleLogin = async () => {
    if (isExpoGoRuntime) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        'Google Sign-In is not supported in Expo Go. Please run a development build (npx expo run:android) and try again.'
      );
      return;
    }

    setIsGoogleLoading(true);
    try {
      const googleAccessToken = await googleSignInService.getGoogleAccessToken();
      if (!googleAccessToken) {
        return;
      }

      await loginWithGoogle(googleAccessToken, deviceId || 'unknown-device');
    } catch (err) {
      if (googleSignInService.isGoogleSignInCancelledError(err)) {
        return;
      }

      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        resolveGoogleAuthErrorMessage(err, t)
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };


  return (
    <View style={styles.container}>
      {/* Hero background */}
      <View style={styles.heroWrap}>
        <Image source={TOP_IMAGE} style={styles.topImage} resizeMode="cover" />

        <View style={styles.brandWrap}>
            <BrandMark variant="logoWithText" size="hero" />
        </View>
      </View>

      {/* Back to home button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.navigate('MainTabs')}
        activeOpacity={0.7}
      >
        <Ionicons name="home-outline" size={20} color={COLORS.white} />
        <Text style={styles.backBtnText}>{t('common.backToHome')}</Text>
      </TouchableOpacity>

      {/* Scrollable content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Spacer so card starts below the hero */}
          <View style={{ height: CARD_TOP_SPACER }} />

          <View style={[styles.card, { minHeight: cardMinHeight }]}>
            <View style={styles.headerTexts}>
              <Text style={styles.title}>{t('login.title')}</Text>
              <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
            </View>

            <View style={styles.switchRow}>
              <TouchableOpacity style={[styles.switchBtn, styles.switchBtnActive]}>
                <Text style={[styles.switchText, styles.switchTextActive]} allowFontScaling={false}>
                  {t('common.login')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.switchBtn}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.switchText} allowFontScaling={false}>
                  {registerLabel}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={20} color="#9CA3AF" />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('login.emailOrPhone')}
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('login.password')}
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  style={styles.input}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.forgotWrap}
              onPress={() =>
                navigation.navigate('ForgotPassword', {
                  email: email.trim() || undefined,
                })
              }
            >
              <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryBtnText}>
                {isLoading
                  ? t('common.loading', { defaultValue: 'Loading...' })
                  : t('common.login', { defaultValue: 'Login' })}
              </Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.orText}>{t('common.or')}</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={[styles.googleBtn, (isLoading || isGoogleLoading) && styles.googleBtnDisabled]}
              onPress={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
            >
              <ICONS.google width={24} height={24} />
              <Text style={styles.googleText}>
                {isGoogleLoading
                  ? t('common.loading', { defaultValue: 'Loading...' })
                  : t('common.continueWithGoogle')}
              </Text>
            </TouchableOpacity>

            <View style={styles.termsWrap}>
              <Text style={styles.termsText}>{t('common.termsPrefix')}</Text>
              <Text style={[styles.termsText, styles.termsBold]}>{t('common.terms')}</Text>
              <Text style={styles.termsText}>{t('common.and')}</Text>
              <Text style={[styles.termsText, styles.termsBold]}>{t('common.privacyPolicy')}</Text>
              <Text style={styles.termsText}>{t('common.termsSuffix')}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  heroWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topImage: {
    width: '100%',
    height: HERO_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  brandWrap: {
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 38,
    left: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.30)',
    zIndex: 10,
  },
  backBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
  },
  card: {
    marginHorizontal: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 32,
    gap: 32,
  },
  headerTexts: {
    width: '100%',
    gap: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
  },
  switchRow: {
    width: '100%',
    backgroundColor: '#E5E7EB',
    borderRadius: RADIUS.full,
    padding: 4,
    flexDirection: 'row',
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBtnActive: {
    backgroundColor: COLORS.white,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  switchText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  switchTextActive: {
    color: '#0F172A',
  },
  inputGroup: {
    width: '100%',
    gap: 16,
  },
  inputWrap: {
    width: '100%',
    height: 56,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8F9FD',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0F172A',
  },
  forgotWrap: {
    width: '100%',
    alignItems: 'flex-end',
  },
  forgotText: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  primaryBtn: {
    width: '100%',
    height: 56,
    borderRadius: 24,
    backgroundColor: '#13EC5B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#13EC5B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#102216',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  primaryBtnDisabled: {
    backgroundColor: '#9CA3AF',
    shadowColor: '#9CA3AF',
    opacity: 0.6,
  },
  dividerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  orText: {
    paddingHorizontal: 16,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  googleBtn: {
    width: '100%',
    height: 56,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    backgroundColor: COLORS.white,
  },
  googleBtnDisabled: {
    opacity: 0.6,
  },
  googleText: {
    color: '#102216',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  termsWrap: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  termsText: {
    fontSize: 10,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    lineHeight: 16,
    letterSpacing: 1,
    textAlign: 'center',
  },
  termsBold: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
