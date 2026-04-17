import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { BrandedHeader } from '../../components/branding';
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
  const fetchCart = useCartStore((state) => state.fetchCart);

  const hasHandledResultRef = useRef(false);
  const hasRefreshedCartRef = useRef(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isProcessingResult, setIsProcessingResult] = useState(false);

  const refreshCartOnce = useCallback(async () => {
    if (hasRefreshedCartRef.current) {
      return;
    }

    hasRefreshedCartRef.current = true;

    try {
      await fetchCart({ pageNumber: 1, pageSize: 20 });
    } catch {
      // Keep payment navigation flow resilient even when cart refresh fails.
    }
  }, [fetchCart]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (hasHandledResultRef.current) {
        return;
      }

      void refreshCartOnce();
    });

    return unsubscribe;
  }, [navigation, refreshCartOnce]);

  const handleResolvedResult = async (result: PaymentResult) => {
    if (!result || hasHandledResultRef.current) {
      return;
    }

    hasHandledResultRef.current = true;
    setIsProcessingResult(true);

    await refreshCartOnce();

    if (result === 'success') {
      navigation.replace('PaymentSuccess', { orderId });

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
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={44}
        title={t('checkout.paymentMethod', { defaultValue: 'Payment' })}
        left={
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={isProcessingResult}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
        right={<View style={styles.backButtonPlaceholder} />}
        brandVariant='none'
      />

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
