import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { useProductStore, useCartStore } from '../../stores';
import { MainTabParamList, Product } from '../../types';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Home'>;

type HomePlant = {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  image: string;
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 3) / 2 - 2;

const FILTERS = ['Tất cả', 'Trong nhà', 'Ngoài trời', 'Để bàn'];

const MOCK_PLANTS: HomePlant[] = [
  {
    id: 'm1',
    name: 'Cây gà',
    subtitle: 'Dễ chăm sóc • Trong nhà',
    price: 250000,
    image:
      'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'm2',
    name: 'Cây gà',
    subtitle: 'Dễ chăm sóc • Trong nhà',
    price: 250000,
    image:
      'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'm3',
    name: 'Monstera',
    subtitle: 'Dễ chăm sóc • Trong nhà',
    price: 390000,
    image:
      'https://images.unsplash.com/photo-1604762524889-3e2fcc145683?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'm4',
    name: 'Kim tiền',
    subtitle: 'Dễ chăm sóc • Trong nhà',
    price: 290000,
    image:
      'https://images.unsplash.com/photo-1463320898484-cdee8141c787?auto=format&fit=crop&w=900&q=80',
  },
];

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { products, fetchProducts } = useProductStore();
  const totalItems = useCartStore((state) => state.totalItems);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const homePlants = useMemo<HomePlant[]>(() => {
    if (products.length === 0) {
      return MOCK_PLANTS;
    }

    return products.slice(0, 4).map((item: Product) => ({
      id: item.id,
      name: item.name,
      subtitle: 'Dễ chăm sóc • Trong nhà',
      price: item.salePrice ?? item.price,
      image: item.images?.[0] || MOCK_PLANTS[0].image,
    }));
  }, [products]);

  const renderPlantCard = ({ item }: { item: HomePlant }) => (
    <TouchableOpacity style={styles.productCard}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />

        <View style={styles.hotBadge}>
          <Text style={styles.hotBadgeText}>HOT</Text>
        </View>

        <TouchableOpacity style={styles.favoriteBtn}>
          <Ionicons name="heart-outline" size={16} color={COLORS.white} />
        </TouchableOpacity>

        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={10} color={COLORS.warning} />
          <Text style={styles.ratingBadgeText}>4.8</Text>
        </View>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productSub}>{item.subtitle}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>{item.price.toLocaleString('vi-VN')}đ</Text>
          <TouchableOpacity style={styles.plusBtn}>
            <Ionicons name="add" size={15} color={COLORS.black} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentWrap}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="menu" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <View style={styles.brandRow}>
            <Ionicons name="leaf" size={18} color={COLORS.primaryLight} />
            <Text style={styles.brandText}>PlantDecor</Text>
          </View>

          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('CartTab')}>
            <Ionicons name="bag-outline" size={21} color={COLORS.textPrimary} />
            {totalItems() > 0 && <View style={styles.cartDot} />}
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={20} color={COLORS.primary} />
            <Text style={styles.searchText}>Tìm kiếm cây...</Text>
          </View>
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="options-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={FILTERS}
          horizontal
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity style={[styles.filterChip, index === 0 && styles.filterChipActive]}>
              <Text style={[styles.filterText, index === 0 && styles.filterTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />

        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles" size={16} color={COLORS.primaryLight} />
          <Text style={styles.sectionTitle}>Gợi ý từ AI</Text>
        </View>

        <FlatList
          data={homePlants.slice(0, 2)}
          renderItem={renderPlantCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          scrollEnabled={false}
        />

        <LinearGradient
          colors={[COLORS.primaryDark, COLORS.primary]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.banner}
        >
          <View style={styles.bannerContent}>
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerTag}>MÙA HÈ XANH</Text>
              <Text style={styles.bannerTitle}>Giảm 20% các loại{`\n`}cây nhiệt đới</Text>
              <TouchableOpacity style={styles.bannerBtn}>
                <Text style={styles.bannerBtnText}>Khám phá ngay</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bannerRight}>
              <Ionicons name="leaf" size={72} color={COLORS.secondaryLight} />
            </View>
          </View>
        </LinearGradient>

        <Text style={styles.bestSellerTitle}>Bán chạy nhất</Text>

        <FlatList
          data={homePlants}
          renderItem={renderPlantCard}
          keyExtractor={(item) => `best-${item.id}`}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          scrollEnabled={false}
          contentContainerStyle={styles.bestList}
        />

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },
  contentWrap: {
    paddingHorizontal: SPACING.lg,
  },
  header: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  iconBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandText: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cartDot: {
    position: 'absolute',
    top: 6,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  searchWrap: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS['2xl'],
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  searchInputWrap: {
    flex: 1,
    height: 46,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  searchText: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.primary,
  },
  filterBtn: {
    height: 46,
    width: 46,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterList: {
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  filterChip: {
    backgroundColor: COLORS.gray200,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryLight,
    ...SHADOWS.md,
  },
  filterText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: COLORS.white,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.xl,
    padding: SPACING.sm,
  },
  imageWrap: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.gray200,
    height: CARD_WIDTH,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  hotBadge: {
    position: 'absolute',
    left: SPACING.sm,
    top: SPACING.sm,
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  hotBadgeText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  favoriteBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    left: SPACING.sm,
    bottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gray800,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  ratingBadgeText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  productInfo: {
    paddingTop: SPACING.sm,
    gap: 2,
  },
  productName: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  productSub: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.primary,
  },
  priceRow: {
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  plusBtn: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  banner: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    minHeight: 145,
  },
  bannerLeft: {
    flex: 2,
    padding: SPACING.lg,
    justifyContent: 'space-between',
  },
  bannerTag: {
    color: COLORS.secondaryLight,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  bannerTitle: {
    color: COLORS.white,
    fontSize: FONTS.sizes['3xl'],
    fontWeight: '700',
    lineHeight: 30,
  },
  bannerBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  bannerBtnText: {
    color: COLORS.black,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  bannerRight: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  bestSellerTitle: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
    fontSize: FONTS.sizes['3xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  bestList: {
    paddingBottom: SPACING.lg,
  },
  bottomSpace: {
    height: 80,
  },
});
