import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { usePlantStore, useCartStore } from '../../stores';
import { MainTabParamList, RootStackParamList, Plant } from '../../types';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type HomePlant = {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  image?: string;
};

type HomeSortKey = 'newest' | 'priceAsc' | 'priceDesc';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 3) / 2 - 2;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { plants, fetchPlants } = usePlantStore();
  const totalItems = useCartStore((state) => state.totalItems);
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const [selectedSort, setSelectedSort] = useState<HomeSortKey>('newest');
  const [keyword, setKeyword] = useState('');
  const [aiListWidth, setAiListWidth] = useState(0);
  const [aiContentWidth, setAiContentWidth] = useState(0);
  const [aiScrollX, setAiScrollX] = useState(0);

  const sortOptions: Array<{ key: HomeSortKey; label: string }> = [
    { key: 'newest', label: 'Newest' },
    { key: 'priceAsc', label: 'Price Low-High' },
    { key: 'priceDesc', label: 'Price High-Low' },
  ];

  useEffect(() => {
    if (selectedSort === 'priceAsc') {
      fetchPlants({ sortBy: 'basePrice', sortDirection: 'asc' });
      return;
    }

    if (selectedSort === 'priceDesc') {
      fetchPlants({ sortBy: 'basePrice', sortDirection: 'desc' });
      return;
    }

    fetchPlants({ sortBy: 'createdAt', sortDirection: 'desc' });
  }, [fetchPlants, selectedSort]);

  const homePlants = useMemo<HomePlant[]>(() => {
    if (plants.length === 0) {
      return [];
    }

    return plants.slice(0, 4).map((item: Plant) => ({
      id: String(item.id),
      name: item.name,
      subtitle: t('home.defaultSubtitle'),
      price: item.basePrice ?? 0,
      image: item.images?.find((image) => typeof image === 'string' && image.trim().length > 0),
    }));
  }, [plants, t]);

  const renderPlantCard = ({ item }: { item: HomePlant }) => {
    const imageUri = item.image?.trim();

    return (
      <TouchableOpacity
        style={styles.plantCard}
        onPress={() => navigation.navigate('PlantDetail', { plantId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.imageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.plantImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="leaf-outline" size={32} color={COLORS.gray500} />
            </View>
          )}

          <View style={styles.hotBadge}>
            <Text style={styles.hotBadgeText}>{t('home.hot')}</Text>
          </View>

          <TouchableOpacity style={styles.favoriteBtn}>
            <Ionicons name="heart-outline" size={16} color={COLORS.white} />
          </TouchableOpacity>

          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color={COLORS.warning} />
            <Text style={styles.ratingBadgeText}>4.8</Text>
          </View>
        </View>

        <View style={styles.plantInfo}>
          <Text style={styles.plantName}>{item.name}</Text>
          <Text style={styles.plantSub}>{item.subtitle}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.plantPrice}>{(item.price || 0).toLocaleString(locale)}đ</Text>
            <TouchableOpacity style={styles.plusBtn}>
              <Ionicons name="add" size={15} color={COLORS.black} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const hasMoreAiItems = homePlants.length > 1;
  const showAiArrowLeft = aiScrollX > 4;
  const showAiArrowRight = hasMoreAiItems
    ? aiContentWidth === 0 || aiContentWidth - aiListWidth - aiScrollX > 4
    : false;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentWrap}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.stickyHeader}>
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
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={COLORS.primary} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('home.searchPlaceholder')}
                placeholderTextColor="#0DA84D"
                value={keyword}
                onChangeText={setKeyword}
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles" size={16} color={COLORS.primaryLight} />
          <Text style={styles.sectionTitle}>{t('home.aiSuggestions')}</Text>
        </View>

        <View
          style={styles.aiSliderWrap}
          onLayout={(event) => setAiListWidth(event.nativeEvent.layout.width)}
        >
          <FlatList
            data={homePlants}
            renderItem={renderPlantCard}
            keyExtractor={(item) => `ai-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.aiList}
            ItemSeparatorComponent={() => <View style={styles.aiSeparator} />}
            snapToInterval={CARD_WIDTH + SPACING.md}
            snapToAlignment="start"
            decelerationRate="fast"
            onContentSizeChange={(width) => setAiContentWidth(width)}
            onScroll={(event) => setAiScrollX(event.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
          />
          <View style={styles.aiArrowOverlay} pointerEvents="none">
            {showAiArrowLeft && (
              <View style={[styles.aiArrow, styles.aiArrowLeft]}>
                <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
              </View>
            )}
            {showAiArrowRight && (
              <View style={[styles.aiArrow, styles.aiArrowRight]}>
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </View>
            )}
          </View>
        </View>

        <LinearGradient
          colors={[COLORS.primaryDark, COLORS.primary]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.banner}
        >
          <View style={styles.bannerContent}>
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerTag}>{t('home.summerTag')}</Text>
              <Text style={styles.bannerTitle}>{t('home.summerTitle', { newline: '\n' })}</Text>
              <TouchableOpacity style={styles.bannerBtn}>
                <Text style={styles.bannerBtnText}>{t('home.discoverNow')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bannerRight}>
              <Ionicons name="leaf" size={72} color={COLORS.secondaryLight} />
            </View>
          </View>
        </LinearGradient>

        <Text style={styles.bestSellerTitle}>{t('home.bestSeller')}</Text>

        <FlatList
          data={homePlants}
          renderItem={renderPlantCard}
          keyExtractor={(item) => `best-${item.id}`}
          numColumns={2}
          columnWrapperStyle={styles.plantRow}
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
    backgroundColor: COLORS.background,
  },
  contentWrap: {
    paddingHorizontal: SPACING.lg,
  },
  stickyHeader: {
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
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
  searchContainer: {
    flexDirection: 'row',
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7FDF0',
    borderRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderWidth: 0.5,
    borderColor: '#0DA84D',
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: '#0DA84D',
    padding: 0,
  },
  filterToggle: {
    width: 40,
    height: 40,
    backgroundColor: '#E7FDF0',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#0DA84D',
  },
  sortList: {
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  sortChip: {
    backgroundColor: COLORS.gray200,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
  },
  sortChipActive: {
    backgroundColor: COLORS.primaryLight,
    ...SHADOWS.md,
  },
  sortText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sortTextActive: {
    color: COLORS.white,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  aiSliderWrap: {
    position: 'relative',
  },
  aiList: {
    paddingRight: SPACING.lg,
  },
  aiSeparator: {
    width: SPACING.md,
  },
  aiArrowOverlay: {
    position: 'absolute',
    top: 0,
    height: CARD_WIDTH,
    left: -10,
    right: 0,
    alignItems: 'center',
  },
  aiArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiArrowLeft: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -8,
  },
  aiArrowRight: {
    position: 'absolute',
    right: 4,
    top: '50%',
    marginTop: -8,
  },
  sectionTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  plantRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  plantCard: {
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
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantImage: {
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
  plantInfo: {
    paddingTop: SPACING.sm,
    gap: 2,
  },
  plantName: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  plantSub: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
  },
  priceRow: {
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plantPrice: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.primaryLight,
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
    marginTop: SPACING.sm,
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
