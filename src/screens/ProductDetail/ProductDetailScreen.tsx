import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { useProductStore, useCartStore } from '../../stores';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'ProductDetail'>;

const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { productId } = route.params;

  const { selectedProduct, isLoading, fetchProductDetail } = useProductStore();
  const { addToCart, getItemQuantity } = useCartStore();

  useEffect(() => {
    fetchProductDetail(productId);
  }, [productId]);

  if (isLoading || !selectedProduct) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const product = selectedProduct;
  const price = product.salePrice ?? product.price;
  const quantityInCart = getItemQuantity(product.id);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Product Image */}
        <Image
          source={{ uri: product.images[0] }}
          style={styles.productImage}
          resizeMode="cover"
        />

        {/* Product Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.productName}>{product.name}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{price.toLocaleString('vi-VN')}đ</Text>
            {product.salePrice && (
              <Text style={styles.originalPrice}>
                {product.price.toLocaleString('vi-VN')}đ
              </Text>
            )}
          </View>

          {/* Rating & Reviews */}
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= product.rating ? 'star' : 'star-outline'}
                size={18}
                color={COLORS.warning}
              />
            ))}
            <Text style={styles.ratingText}>{product.rating}</Text>
            <Text style={styles.reviewCount}>
              ({product.reviewCount} đánh giá)
            </Text>
          </View>

          {/* Plant Info */}
          <View style={styles.plantInfoGrid}>
            <View style={styles.plantInfoItem}>
              <Ionicons name="water-outline" size={20} color={COLORS.info} />
              <Text style={styles.plantInfoLabel}>Tưới nước</Text>
              <Text style={styles.plantInfoValue}>
                {product.waterFrequency}
              </Text>
            </View>
            <View style={styles.plantInfoItem}>
              <Ionicons name="sunny-outline" size={20} color={COLORS.warning} />
              <Text style={styles.plantInfoLabel}>Ánh sáng</Text>
              <Text style={styles.plantInfoValue}>
                {product.lightRequirement === 'low'
                  ? 'Thấp'
                  : product.lightRequirement === 'medium'
                    ? 'Trung bình'
                    : 'Cao'}
              </Text>
            </View>
            <View style={styles.plantInfoItem}>
              <Ionicons name="leaf-outline" size={20} color={COLORS.success} />
              <Text style={styles.plantInfoLabel}>Chăm sóc</Text>
              <Text style={styles.plantInfoValue}>
                {product.careLevel === 'easy'
                  ? 'Dễ'
                  : product.careLevel === 'medium'
                    ? 'TB'
                    : 'Khó'}
              </Text>
            </View>
            <View style={styles.plantInfoItem}>
              <Ionicons name="resize-outline" size={20} color={COLORS.accent} />
              <Text style={styles.plantInfoLabel}>Kích thước</Text>
              <Text style={styles.plantInfoValue}>{product.size}</Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Mô tả</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.cartIconButton}
          onPress={() => navigation.navigate('Cart')}
        >
          <Ionicons name="cart-outline" size={24} color={COLORS.primary} />
          {quantityInCart > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{quantityInCart}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addToCartButton}
          onPress={() => addToCart(product)}
        >
          <Ionicons name="cart" size={20} color={COLORS.white} />
          <Text style={styles.addToCartText}>Thêm vào giỏ</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  productImage: {
    width: width,
    height: width,
    backgroundColor: COLORS.gray100,
  },
  infoContainer: {
    padding: SPACING.lg,
  },
  productName: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  price: {
    fontSize: FONTS.sizes['3xl'],
    fontWeight: '700',
    color: COLORS.primary,
  },
  originalPrice: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.md,
  },
  ratingText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: SPACING.xs,
  },
  reviewCount: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  plantInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  plantInfoItem: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  plantInfoLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  plantInfoValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  descriptionSection: {
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOWS.lg,
  },
  cartIconButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.full,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  addToCartText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
});
