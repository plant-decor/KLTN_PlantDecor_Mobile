import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { BrandedHeader } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

type ServiceOption = {
  icon: keyof typeof Ionicons.glyphMap;
  key: 'care' | 'design';
  route: 'CareServiceRegistration' | 'DesignService';
};

const SERVICE_OPTIONS: ServiceOption[] = [
  {
    key: 'care',
    icon: 'leaf-outline',
    route: 'CareServiceRegistration',
  },
  {
    key: 'design',
    icon: 'color-wand-outline',
    route: 'DesignService',
  },
];

export default function ServiceHubScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        title={t('serviceHub.title', { defaultValue: 'Services' })}
        brandVariant="none"
      />

      <View style={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>
            {t('serviceHub.heading', { defaultValue: 'Choose the service you want to continue with' })}
          </Text>
          <Text style={styles.heroSubtitle}>
            {t('serviceHub.subtitle', {
              defaultValue: 'Care service helps maintain your plants, while design service guides full space styling.',
            })}
          </Text>
        </View>

        {SERVICE_OPTIONS.map((option) => {
          const titleKey =
            option.key === 'care' ? 'serviceHub.careTitle' : 'serviceHub.designTitle';
          const subtitleKey =
            option.key === 'care'
              ? 'serviceHub.careSubtitle'
              : 'serviceHub.designSubtitle';
          const ctaKey =
            option.key === 'care' ? 'serviceHub.careAction' : 'serviceHub.designAction';

          return (
            <TouchableOpacity
              key={option.key}
              style={styles.optionCard}
              activeOpacity={0.9}
              onPress={() => navigation.navigate(option.route)}
            >
              <View style={styles.optionIconWrap}>
                <Ionicons name={option.icon} size={26} color={COLORS.primaryDark} />
              </View>

              <View style={styles.optionBody}>
                <Text style={styles.optionTitle}>{t(titleKey)}</Text>
                <Text style={styles.optionSubtitle}>{t(subtitleKey)}</Text>
              </View>

              <View style={styles.optionCtaWrap}>
                <Text style={styles.optionCta}>{t(ctaKey)}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING['4xl'],
    gap: SPACING.lg,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  heroTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes['2xl'],
    color: COLORS.textPrimary,
  },
  heroSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  optionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  optionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBody: {
    gap: SPACING.xs,
  },
  optionTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
  },
  optionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  optionCtaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  optionCta: {
    fontFamily: FONTS.medium,
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
  },
});
