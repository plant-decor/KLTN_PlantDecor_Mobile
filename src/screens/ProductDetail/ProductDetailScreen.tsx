import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { useProductStore, useCartStore } from '../../stores';
import { RootStackParamList, Product } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'ProductDetail'>;

const { width } = Dimensions.get('window');
const IMAGE_HEIGHT = 396;
const ATTR_CARD_WIDTH = (width - SPACING.xl * 2 - 12) / 2;

// ---------- Attribute card helper ----------
type AttributeProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
};

function AttributeCard({ icon, iconColor, iconBg, label, value }: AttributeProps) {
  return (
    <View style={styles.attrCard}>
      <View style={[styles.attrIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.attrLabel}>{label}</Text>
        <Text style={styles.attrValue}>{value}</Text>
      </View>
    </View>
  );
}

// ---------- Mock review (matches Figma) ----------
const MOCK_REVIEW = {
  id: 'r1',
  userName: 'Linh Nguyễn',
  rating: 5,
  daysAgo: 2,
  comment:
    'Cây rất khỏe và đẹp, đóng gói cẩn thận. Giao hàng nhanh hơn dự kiến!',
  commentEn:
    'The plant is very healthy and beautiful, carefully packed. Delivery was faster than expected!',
};

// ---------- Mock related products ----------
const MOCK_RELATED: {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  image: string;
}[] = [
  {
    id: 'rel1',
    name: 'Cây gà',
    subtitle: 'Dễ chăm sóc • Trong nhà',
    price: 250000,
    image:
      'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'rel2',
    name: 'Cây gà',
    subtitle: 'Dễ chăm sóc • Trong nhà',
    price: 250000,
    image:
      'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'rel3',
    name: 'Monstera',
    subtitle: 'Dễ chăm sóc • Trong nhà',
    price: 390000,
    image:
      'https://images.unsplash.com/photo-1604762524889-3e2fcc145683?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'rel4',
    name: 'Kim tiền',
    subtitle: 'Dễ chăm sóc • Trong nhà',
    price: 290000,
    image:
      'https://images.unsplash.com/photo-1463320898484-cdee8141c787?auto=format&fit=crop&w=900&q=80',
  },
];

// ============================================================
export default function ProductDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { productId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const { selectedProduct, isLoading, fetchProductDetail, products } =
    useProductStore();
  const { addToCart } = useCartStore();

  useEffect(() => {
    fetchProductDetail(productId);
  }, [productId]);

  const product = selectedProduct;

  // Related products from store (exclude current), fall back to mock
  const relatedPlants = useMemo(() => {
    const pool = products.filter((p) => p.id !== productId).slice(0, 4);
    if (pool.length > 0) {
      return pool.map((p: Product) => ({
        id: p.id,
        name: p.name,
        subtitle: t('productDetail.defaultSubtitle'),
        price: p.salePrice ?? p.price,
        image: p.images?.[0] || MOCK_RELATED[0].image,
      }));
    }
    return MOCK_RELATED;
  }, [products, productId, t]);

  // ---------- helpers ----------
  const getCareLabel = () => {
    if (!product) return '';
    switch (product.careLevel) {
      case 'easy':
        return t('productDetail.careEasy');
      case 'medium':
        return t('productDetail.careMedium');
      case 'hard':
        return t('productDetail.careHard');
    }
  };

  const getLightLabel = () => {
    if (!product) return '';
    switch (product.lightRequirement) {
      case 'low':
        return t('productDetail.lightLow');
      case 'medium':
        return t('productDetail.lightIndirect');
      case 'high':
        return t('productDetail.lightBright');
    }
  };

  // ---------- loading / empty state ----------
  if (isLoading || !product) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const price = product.salePrice ?? product.price;

  // ============ RENDER ============
  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ===== Hero image ===== */}
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: product.images[0] }}
            style={styles.heroImage}
            resizeMode="cover"
          />

          {/* Overlay nav buttons */}
          <View style={styles.heroOverlay}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={22} color="#0D1B12" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.heartBtn}>
              <Ionicons name="heart-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== Content card (overlaps image) ===== */}
        <View style={styles.contentCard}>
          {/* Drag handle */}
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>

          {/* Name + rating */}
          <View style={styles.nameRow}>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={16} color="#EAB308" />
              <Text style={styles.ratingText}>{product.rating}</Text>
            </View>
          </View>

          {/* Price */}
          <Text style={styles.price}>{price.toLocaleString(locale)} ₫</Text>

          {/* Description */}
          <Text style={styles.description}>{product.description}</Text>

          {/* ===== Biological Properties ===== */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>
              {t('productDetail.biologicalProperties')}
            </Text>
            <View style={styles.attrGrid}>
              <AttributeCard
                icon="leaf-outline"
                iconColor="#15803D"
                iconBg="#DBEAFE"
                label={t('productDetail.location')}
                value={
                  product.size === 'small' || product.size === 'medium'
                    ? t('productDetail.locationTable')
                    : t('productDetail.locationFloor')
                }
              />
              <AttributeCard
                icon="flower-outline"
                iconColor="#EA580C"
                iconBg="#FFEDD5"
                label={t('productDetail.care')}
                value={getCareLabel()}
              />
              <AttributeCard
                icon="sunny-outline"
                iconColor="#CA8A04"
                iconBg="#FEF9C3"
                label={t('productDetail.light')}
                value={getLightLabel()}
              />
              <AttributeCard
                icon="water-outline"
                iconColor="#2563EB"
                iconBg="#DBEAFE"
                label={t('productDetail.water')}
                value={product.waterFrequency}
              />
              <AttributeCard
                icon="water"
                iconColor="#0891B2"
                iconBg="#CFFAFE"
                label={t('productDetail.humidity')}
                value={t('productDetail.humidityHigh')}
              />
              <AttributeCard
                icon="paw-outline"
                iconColor="#E11D48"
                iconBg="#FFE4E6"
                label={t('productDetail.petSafety')}
                value={t('productDetail.petToxicMild')}
              />
            </View>
          </View>

          {/* ===== Reviews ===== */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {t('productDetail.reviews')}
              </Text>
              <TouchableOpacity>
                <Text style={styles.viewAllText}>
                  {t('productDetail.viewAll')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAvatarPlaceholder}>
                  <Text style={styles.reviewAvatarText}>
                    {MOCK_REVIEW.userName.charAt(0)}
                  </Text>
                </View>
                <View style={styles.reviewMeta}>
                  <Text style={styles.reviewName}>{MOCK_REVIEW.userName}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name="star"
                        size={12}
                        color={
                          s <= MOCK_REVIEW.rating ? '#EAB308' : COLORS.gray300
                        }
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewDate}>
                  {t('productDetail.daysAgo', { count: MOCK_REVIEW.daysAgo })}
                </Text>
              </View>
              <Text style={styles.reviewComment}>
                {i18n.language === 'vi'
                  ? MOCK_REVIEW.comment
                  : MOCK_REVIEW.commentEn}
              </Text>
            </View>
          </View>

          {/* ===== You may also like ===== */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>
              {t('productDetail.youMayAlsoLike')}
            </Text>
          </View>
        </View>

        {/* Horizontal related products (outside card padding for full bleed) */}
        <FlatList
          data={relatedPlants}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.relatedList}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.relatedCard}
              onPress={() =>
                navigation.push('ProductDetail', { productId: item.id })
              }
            >
              <View style={styles.relatedImageWrap}>
                <Image
                  source={{ uri: item.image }}
                  style={styles.relatedImage}
                  resizeMode="cover"
                />
                <TouchableOpacity style={styles.relatedHeartBtn}>
                  <Ionicons
                    name="heart-outline"
                    size={16}
                    color={COLORS.white}
                  />
                </TouchableOpacity>
                <View style={styles.relatedRatingBadge}>
                  <Ionicons name="star" size={10} color="#FACC15" />
                  <Text style={styles.relatedRatingText}>4.8</Text>
                </View>
                <View style={styles.relatedHotBadge}>
                  <Text style={styles.relatedHotText}>{t('home.hot')}</Text>
                </View>
              </View>
              <Text style={styles.relatedName}>{item.name}</Text>
              <Text style={styles.relatedSub}>{item.subtitle}</Text>
              <View style={styles.relatedPriceRow}>
                <Text style={styles.relatedPrice}>
                  {item.price.toLocaleString(locale)}₫
                </Text>
                <View style={styles.relatedPlusBtn}>
                  <Ionicons name="add" size={14} color={COLORS.black} />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />

        {/* Bottom spacer for sticky bar */}
        <View style={{ height: 84 }} />
      </ScrollView>

      {/* ===== Sticky bottom bar ===== */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.addToCartBtn}
          onPress={() => addToCart(product)}
        >
          <Ionicons name="cart-outline" size={22} color="#102216" />
          <Text style={styles.addToCartText}>
            {t('productDetail.addToCart')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8F6',
  },
  scrollContent: {
    paddingBottom: 0,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F8F6',
  },

  // ---- Hero ----
  heroWrap: {
    width,
    height: IMAGE_HEIGHT,
    backgroundColor: COLORS.gray200,
  },
  heroImage: {
    width,
    height: IMAGE_HEIGHT,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ---- Content card ----
  contentCard: {
    marginTop: -24,
    backgroundColor: '#F6F8F6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 32,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 0,
  },
  dragHandleWrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dragHandle: {
    width: 48,
    height: 4,
    borderRadius: 9999,
    backgroundColor: '#D1D5DB',
  },

  // ---- Name + rating ----
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productName: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#0D1B12',
    lineHeight: 30,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(19,236,91,0.10)',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: SPACING.sm,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D1B12',
  },

  // ---- Price ----
  price: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '700',
    color: '#13EC5B',
    lineHeight: 32,
  },

  // ---- Description ----
  description: {
    marginTop: SPACING.lg,
    fontSize: 16,
    fontWeight: '400',
    color: '#4B5563',
    lineHeight: 26,
  },

  // ---- Section ----
  sectionWrap: {
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D1B12',
    lineHeight: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#13EC5B',
    lineHeight: 20,
  },

  // ---- Attribute grid ----
  attrGrid: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attrCard: {
    width: ATTR_CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    ...SHADOWS.sm,
  },
  attrIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attrLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 16,
  },
  attrValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D1B12',
    lineHeight: 20,
  },

  // ---- Review ----
  reviewCard: {
    marginTop: SPACING.lg,
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    gap: 7,
    ...SHADOWS.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  reviewMeta: {
    flex: 1,
  },
  reviewName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D1B12',
    lineHeight: 20,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 16,
  },
  reviewComment: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4B5563',
    lineHeight: 20,
  },

  // ---- Related / You may also like ----
  relatedList: {
    paddingHorizontal: SPACING.xl,
    gap: 16,
    paddingBottom: SPACING.lg,
  },
  relatedCard: {
    width: 196,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
  },
  relatedImageWrap: {
    width: 172,
    height: 215,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    position: 'relative',
  },
  relatedImage: {
    width: '100%',
    height: '100%',
  },
  relatedHeartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedRatingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  relatedRatingText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.white,
    lineHeight: 16,
  },
  relatedHotBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  relatedHotText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 15,
  },
  relatedName: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#0D1B12',
    lineHeight: 22,
  },
  relatedSub: {
    fontSize: 12,
    fontWeight: '400',
    color: '#4C9A66',
    lineHeight: 16,
  },
  relatedPriceRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  relatedPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#13EC5B',
    lineHeight: 24,
  },
  relatedPlusBtn: {
    width: 18,
    height: 18,
    borderRadius: 9999,
    backgroundColor: '#13EC5B',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ---- Bottom bar ----
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    paddingBottom: SPACING.lg,
    alignItems: 'center',
  },
  addToCartBtn: {
    width: '100%',
    height: 56,
    backgroundColor: '#13EC5B',
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#13EC5B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addToCartText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#102216',
    lineHeight: 24,
  },
});
