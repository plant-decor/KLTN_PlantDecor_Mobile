import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import BrandedHeader from '../../components/branding/BrandedHeader';
import { useUserPlantStore } from '../../stores/useUserPlantStore';
import { UserPlant } from '../../types';

export default function UserPlantsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const {
    userPlants,
    isLoading,
    selectedGuide,
    isGuideLoading,
    fetchUserPlants,
    fetchPlantGuide,
  } = useUserPlantStore();

  const [refreshing, setRefreshing] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [guideImageUri, setGuideImageUri] = useState<string | null>(null);

  useEffect(() => {
    void fetchUserPlants();
  }, [fetchUserPlants]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchUserPlants();
    } finally {
      setRefreshing(false);
    }
  }, [fetchUserPlants]);

  const openGuide = useCallback(async (plant: UserPlant) => {
    setGuideImageUri(plant.primaryImageUrl ?? null);
    setGuideVisible(true);
    await fetchPlantGuide(plant.plantId);
  }, [fetchPlantGuide]);

  const closeGuide = useCallback(() => {
    setGuideVisible(false);
    setGuideImageUri(null);
  }, []);

  const getHealthColor = (status: string | undefined) => {
    if (!status) return COLORS.textSecondary;
    const lower = status.toLowerCase();
    if (lower.includes('good') || lower.includes('healthy') || lower.includes('tốt') || lower.includes('khỏe')) return COLORS.success;
    if (lower.includes('fair') || lower.includes('bình thường')) return COLORS.warning;
    if (lower.includes('poor') || lower.includes('yếu') || lower.includes('bad') || lower.includes('sick')) return COLORS.error;
    return COLORS.primary;
  };

  const renderItem = ({ item }: { item: UserPlant }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.card}
      onPress={() => openGuide(item)}
    >
      <View style={styles.imageContainer}>
        {item.primaryImageUrl ? (
          <Image source={{ uri: item.primaryImageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="leaf" size={32} color={COLORS.gray400} />
          </View>
        )}
      </View>
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.plantName} numberOfLines={1}>{item.plantName}</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />
        </View>
        
        {item.plantSpecificName ? (
          <Text style={styles.specificName} numberOfLines={1}>{item.plantSpecificName}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {item.location || t('userPlants.noLocation', { defaultValue: 'No location' })}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="water-outline" size={14} color={COLORS.primary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {item.lastWateredDate 
              ? `${t('userPlants.lastWatered', { defaultValue: 'Watered:' })} ${item.lastWateredDate}`
              : t('userPlants.neverWatered', { defaultValue: 'Not watered yet' })}
          </Text>
        </View>

        {item.healthStatus ? (
          <View style={[styles.healthBadge, { backgroundColor: `${getHealthColor(item.healthStatus)}15` }]}>
            <View style={[styles.healthDot, { backgroundColor: getHealthColor(item.healthStatus) }]} />
            <Text style={[styles.healthText, { color: getHealthColor(item.healthStatus) }]}>
              {item.healthStatus}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="leaf-outline" size={64} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>
        {t('userPlants.emptyTitle', { defaultValue: 'No plants yet' })}
      </Text>
      <Text style={styles.emptyDescription}>
        {t('userPlants.emptyDescription', { defaultValue: 'Your collection of plants will appear here.' })}
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.emptyButtonText}>
          {t('userPlants.explorePlants', { defaultValue: 'Explore Plants' })}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderGuideSection = (title: string, content: string | undefined | null, icon: keyof typeof Ionicons.glyphMap) => {
    if (!content) return null;
    return (
      <View style={styles.guideSection}>
        <View style={styles.guideSectionHeader}>
          <View style={styles.guideIconContainer}>
            <Ionicons name={icon} size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.guideSectionTitle}>{title}</Text>
        </View>
        <Text style={styles.guideSectionContent}>{content}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <BrandedHeader 
        title={t('userPlants.title', { defaultValue: 'My Garden' })} 
        brandVariant="none"
        left={
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        } 
      />

      {isLoading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={userPlants}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={userPlants?.length ? styles.listContainer : styles.emptyListContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}

      <Modal 
        visible={guideVisible} 
        animationType="slide" 
        presentationStyle="pageSheet"
        onRequestClose={closeGuide}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {t('userPlants.guideTitle', { defaultValue: 'Care Guide' })}
          </Text>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={closeGuide}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons name="close-circle" size={28} color={COLORS.gray400} />
          </TouchableOpacity>
        </View>

        {isGuideLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {t('userPlants.loadingGuide', { defaultValue: 'Loading care guide...' })}
            </Text>
          </View>
        ) : selectedGuide ? (
          <ScrollView 
            contentContainerStyle={styles.guideScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.guideHeroSection}>
              {guideImageUri ? (
                <Image source={{ uri: guideImageUri }} style={styles.guideHeroImage} resizeMode="cover" />
              ) : (
                <View style={styles.guideHeroIcon}>
                  <Ionicons name="book-outline" size={32} color={COLORS.primary} />
                </View>
              )}
              <Text style={styles.guideHeroTitle}>{selectedGuide.plantName}</Text>
              <Text style={styles.guideHeroSubtitle}>
                {t('userPlants.guideSubtitle', { defaultValue: 'Essential care instructions for your plant to thrive.' })}
              </Text>
            </View>

            <View style={styles.guideContentCard}>
              {renderGuideSection(t('userPlants.watering', { defaultValue: 'Watering' }), selectedGuide.watering, 'water')}
              <View style={styles.divider} />
              {renderGuideSection(t('userPlants.temperature', { defaultValue: 'Temperature' }), selectedGuide.temperature, 'thermometer')}
              <View style={styles.divider} />
              {renderGuideSection(t('userPlants.humidity', { defaultValue: 'Humidity' }), selectedGuide.humidity, 'water-outline')}
              <View style={styles.divider} />
              {renderGuideSection(t('userPlants.soil', { defaultValue: 'Soil' }), selectedGuide.soil, 'leaf')}
              <View style={styles.divider} />
              {renderGuideSection(t('userPlants.fertilizing', { defaultValue: 'Fertilizing' }), selectedGuide.fertilizing, 'flask')}
              <View style={styles.divider} />
              {renderGuideSection(t('userPlants.pruning', { defaultValue: 'Pruning' }), selectedGuide.pruning, 'cut')}
              
              {selectedGuide.careNotes ? (
                <>
                  <View style={styles.divider} />
                  {renderGuideSection(t('userPlants.careNotes', { defaultValue: 'Care Notes' }), selectedGuide.careNotes, 'information-circle')}
                </>
              ) : null}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.centerContainer}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.gray300} />
            <Text style={styles.errorText}>
              {t('userPlants.guideUnavailable', { defaultValue: 'Care guide is currently unavailable.' })}
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={closeGuide}
            >
              <Text style={styles.retryButtonText}>{t('common.goBack', { defaultValue: 'Go Back' })}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  listContainer: { 
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  imageContainer: {
    width: 90,
    height: 100,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  image: { 
    width: '100%', 
    height: '100%', 
  },
  imagePlaceholder: {
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: { 
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  plantName: { 
    flex: 1,
    fontSize: FONTS.sizes.lg, 
    fontWeight: '700', 
    color: COLORS.textPrimary,
    marginRight: SPACING.sm,
  },
  specificName: { 
    fontSize: FONTS.sizes.sm, 
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: { 
    fontSize: FONTS.sizes.sm, 
    color: COLORS.textSecondary, 
    marginLeft: 6,
    flex: 1,
  },
  healthBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: SPACING.sm, 
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  healthText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  emptyContainer: { 
    flex: 1,
    padding: SPACING.xl, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptyDescription: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    ...SHADOWS.sm,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  guideScrollContent: { 
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },
  guideHeroSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingTop: SPACING.md,
  },
  guideHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  guideHeroImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.gray100,
  },
  guideHeroTitle: { 
    fontSize: FONTS.sizes['2xl'], 
    fontWeight: '700', 
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  guideHeroSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  guideContentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  guideSection: {
    paddingVertical: SPACING.xs,
  },
  guideSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  guideIconContainer: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  guideSectionTitle: { 
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  guideSectionContent: { 
    fontSize: FONTS.sizes.md,
    color: COLORS.gray700,
    lineHeight: 24,
    paddingLeft: 44,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.gray100,
    marginVertical: SPACING.md,
    marginLeft: 44,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.full,
  },
  retryButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
});