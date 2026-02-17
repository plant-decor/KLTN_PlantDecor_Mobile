import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { useProductStore, useAuthStore } from '../../stores';
import { RootStackParamList, Product, Category } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 3) / 2;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { products, categories, isLoading, fetchProducts, fetchCategories } =
    useProductStore();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.categoryItem}
      onPress={() =>
        navigation.navigate('CategoryProducts', {
          categoryId: item.id,
          categoryName: item.name,
        })
      }
    >
      <View style={styles.categoryIcon}>
        <Ionicons name="leaf" size={24} color={COLORS.primary} />
      </View>
      <Text style={styles.categoryName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
    >
      <Image
        source={{ uri: item.images[0] }}
        style={styles.productImage}
        resizeMode="cover"
      />
      {item.salePrice && (
        <View style={styles.saleBadge}>
          <Text style={styles.saleBadgeText}>
            -{Math.round(((item.price - item.salePrice) / item.price) * 100)}%
          </Text>
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>
            {(item.salePrice ?? item.price).toLocaleString('vi-VN')}đ
          </Text>
          {item.salePrice && (
            <Text style={styles.originalPrice}>
              {item.price.toLocaleString('vi-VN')}đ
            </Text>
          )}
        </View>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color={COLORS.warning} />
          <Text style={styles.ratingText}>{item.rating}</Text>
          <Text style={styles.reviewCount}>({item.reviewCount})</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {isAuthenticated ? `Xin chào, ${user?.fullName}` : 'Xin chào! 👋'}
            </Text>
            <Text style={styles.subtitle}>Khám phá không gian xanh của bạn</Text>
          </View>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => navigation.navigate('Search')}
          >
            <Ionicons name="search" size={22} color={COLORS.gray700} />
          </TouchableOpacity>
        </View>

        {/* AI Design Banner */}
        <TouchableOpacity
          style={styles.aiBanner}
          onPress={() => navigation.navigate('AIDesign')}
        >
          <View style={styles.aiBannerContent}>
            <Ionicons name="sparkles" size={28} color={COLORS.white} />
            <View style={styles.aiBannerText}>
              <Text style={styles.aiBannerTitle}>Thiết kế AI</Text>
              <Text style={styles.aiBannerSubtitle}>
                Tạo không gian xanh thông minh với AI
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={COLORS.white} />
          </View>
        </TouchableOpacity>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danh mục</Text>
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          />
        </View>

        {/* Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sản phẩm nổi bật</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
              style={styles.loader}
            />
          ) : (
            <FlatList
              data={products.slice(0, 6)}
              renderItem={renderProductItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.productRow}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  greeting: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  aiBanner: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  aiBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  aiBannerText: {
    flex: 1,
  },
  aiBannerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  aiBannerSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.secondaryLight,
    marginTop: 2,
  },
  section: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  seeAll: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  categoryList: {
    gap: SPACING.md,
  },
  categoryItem: {
    alignItems: 'center',
    width: 72,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  categoryName: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  productImage: {
    width: '100%',
    height: CARD_WIDTH,
    backgroundColor: COLORS.gray100,
  },
  saleBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  saleBadgeText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  productInfo: {
    padding: SPACING.sm,
  },
  productName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  productPrice: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  originalPrice: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: SPACING.xs,
  },
  ratingText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  reviewCount: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  loader: {
    marginVertical: SPACING['3xl'],
  },
});
