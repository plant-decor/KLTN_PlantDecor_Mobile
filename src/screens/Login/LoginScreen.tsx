import React, { useState } from 'react';
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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const { width } = Dimensions.get('window');

const TOP_IMAGE =
  'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=1400&q=80';

export default function LoginScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.heroWrap}>
        <Image source={{ uri: TOP_IMAGE }} style={styles.topImage} resizeMode="cover" />
        <View style={styles.heroOverlay} />

        <View style={styles.logoWrap}>
          <View style={styles.logoGrid}>
            {new Array(9).fill(null).map((_, i) => (
              <View key={i} style={styles.logoDot} />
            ))}
          </View>
          <Text style={styles.logoText}>PlantDecor</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.formWrap}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('login.title')}</Text>
            <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

            <View style={styles.switchRow}>
              <TouchableOpacity style={[styles.switchBtn, styles.switchBtnActive]}>
                <Text style={[styles.switchText, styles.switchTextActive]}>{t('common.login')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.switchBtn}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.switchText}>{t('common.register')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color={COLORS.gray500} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('login.emailOrPhone')}
                placeholderTextColor={COLORS.gray500}
                style={styles.input}
              />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray500} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('login.password')}
                placeholderTextColor={COLORS.gray500}
                secureTextEntry
                style={styles.input}
              />
            </View>

            <TouchableOpacity style={styles.forgotWrap}>
              <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{t('common.login')}</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.orText}>{t('common.or')}</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity style={styles.googleBtn}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleText}>{t('common.continueWithGoogle')}</Text>
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
    backgroundColor: '#F6F8F6',
  },
  heroWrap: {
    width: '100%',
    height: 344,
    position: 'relative',
    overflow: 'hidden',
  },
  topImage: {
    width,
    height: 396,
    position: 'absolute',
    top: -52,
    left: 0,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  logoWrap: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  logoGrid: {
    width: 46,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 4,
  },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#13EC5B',
  },
  logoText: {
    color: COLORS.white,
    fontSize: 45,
    lineHeight: 54,
    fontWeight: '700',
    letterSpacing: 0.75,
  },
  formWrap: {
    flex: 1,
    marginTop: -14,
  },
  card: {
    backgroundColor: '#F6F8F6',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: SPACING.xl,
    paddingTop: 26,
    paddingBottom: 36,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
  },
  switchRow: {
    marginTop: 24,
    backgroundColor: '#E5E7EB',
    borderRadius: 24,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  switchBtn: {
    flex: 1,
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchBtnActive: {
    backgroundColor: COLORS.white,
  },
  switchText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  switchTextActive: {
    color: '#0F172A',
  },
  inputWrap: {
    marginTop: 16,
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
    marginTop: 16,
    alignItems: 'flex-end',
  },
  forgotText: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  primaryBtn: {
    marginTop: 16,
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
  primaryBtnText: {
    color: '#102216',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  dividerRow: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  orText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  googleBtn: {
    marginTop: 24,
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
  googleIcon: {
    color: '#EA4335',
    fontSize: 26,
    fontWeight: '700',
  },
  googleText: {
    color: '#102216',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  termsWrap: {
    marginTop: 28,
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
