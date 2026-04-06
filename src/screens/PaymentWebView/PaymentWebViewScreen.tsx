import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING } from '../../constants';
import { useCartStore } from '../../stores';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PaymentWebView'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'PaymentWebView'>;

type PaymentResult = 'success' | 'failed' | null;

const getQueryParam = (url: string, key: string): string | null => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = url.match(new RegExp(`[?&]${escapedKey}=([^&#]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const resolvePaymentResult = (url: string): PaymentResult => {
  const responseCode = getQueryParam(url, 'vnp_ResponseCode');
  const txStatus = getQueryParam(url, 'vnp_TransactionStatus');

  if (responseCode === '00' || txStatus === '00') {
    return 'success';
  }

  if (responseCode !== null || txStatus !== null) {
    return 'failed';
  }

  return null;
};

export default function PaymentWebViewScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { paymentUrl, orderId } = route.params;
  const clearCart = useCartStore((state) => state.clearCart);

  const hasHandledResultRef = useRef(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isProcessingResult, setIsProcessingResult] = useState(false);

  const handleResolvedResult = async (result: PaymentResult) => {
    if (!result || hasHandledResultRef.current) {
      return;
    }

    hasHandledResultRef.current = true;

    if (result === 'success') {
      setIsProcessingResult(true);

      try {
        await clearCart();
      } catch {
        // Ignore clear cart failures here; user already paid.
      }

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('checkout.paymentSuccessMessage', {
          orderId,
          defaultValue: 'Payment completed successfully.',
        }),
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.replace('OrderHistory');
            },
          },
        ]
      );

      return;
    }

    Alert.alert(
      t('common.error', { defaultValue: 'Error' }),
      t('checkout.paymentFailedMessage', {
        defaultValue: 'Payment failed or was cancelled.',
      }),
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handleUrl = (url: string) => {
    const result = resolvePaymentResult(url);
    void handleResolvedResult(result);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isProcessingResult}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('checkout.paymentMethod', { defaultValue: 'Payment' })}
        </Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <WebView
        source={{ uri: paymentUrl }}
        onLoadStart={() => setIsPageLoading(true)}
        onLoadEnd={() => setIsPageLoading(false)}
        onNavigationStateChange={(event) => {
          handleUrl(event.url);
        }}
        onShouldStartLoadWithRequest={(request) => {
          handleUrl(request.url);
          return true;
        }}
      />

      {(isPageLoading || isProcessingResult) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    height: 52,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.gray100,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248, 249, 250, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
