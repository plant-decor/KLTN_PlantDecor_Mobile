import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PaymentSuccess'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'PaymentSuccess'>;

export default function PaymentSuccessScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const orderId = route.params?.orderId;

  const successMessage = orderId
    ? t('checkout.paymentSuccessMessage', {
        orderId,
        defaultValue: `Payment completed successfully for order #${orderId}.`,
      })
    : t('checkout.paymentSuccessMessage', {
        defaultValue: 'Payment completed successfully.',
      });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark" size={48} color={COLORS.white} />
        </View>

        <Text style={styles.title}>
          {t('common.success', { defaultValue: 'Success' })}
        </Text>
        <Text style={styles.subtitle}>{successMessage}</Text>

        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.replace('OrderHistory')}
          >
            <Text style={styles.primaryBtnText}>
              {t('orderHistory.title', { defaultValue: 'Order history' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.replace('MainTabs')}
          >
            <Text style={styles.secondaryBtnText}>
              {t('home.title', { defaultValue: 'Continue shopping' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FBF7',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    backgroundColor: '#13A454',
  },
  title: {
    textAlign: 'center',
    fontSize: FONTS.sizes['4xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
    lineHeight: 24,
    marginBottom: SPACING['3xl'],
  },
  actionGroup: {
    gap: SPACING.md,
  },
  primaryBtn: {
    backgroundColor: '#13EC5B',
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: '#102216',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#13A454',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: '#13A454',
  },
});
