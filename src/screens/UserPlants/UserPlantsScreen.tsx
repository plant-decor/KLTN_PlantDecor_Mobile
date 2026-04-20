import React, { useEffect, useState } from 'react';
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
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants';
import BrandedHeader from '../../components/branding/BrandedHeader';
import { useUserPlantStore } from '../../stores/useUserPlantStore';
import { PlantGuide, UserPlant } from '../../types';
import { Ionicons } from '@expo/vector-icons';

export default function UserPlantsScreen() {
  const { t } = useTranslation();
  const {
    userPlants,
    isLoading,
    selectedGuide,
    isGuideLoading,
    fetchUserPlants,
    fetchPlantGuide,
    clearError,
  } = useUserPlantStore();

  const [refreshing, setRefreshing] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);

  useEffect(() => {
    void fetchUserPlants();
  }, [fetchUserPlants]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchUserPlants();
    } finally {
      setRefreshing(false);
    }
  };

  const openGuide = async (plant: UserPlant) => {
    await fetchPlantGuide(plant.plantId);
    setGuideVisible(true);
  };

  const renderItem = ({ item }: { item: UserPlant }) => (
    <TouchableOpacity style={styles.card} onPress={() => openGuide(item)}>
      <Image source={{ uri: item.primaryImageUrl ?? '' }} style={styles.image} />
      <View style={styles.info}>
        <Text style={styles.name}>{item.plantName}</Text>
        {item.plantSpecificName ? (
          <Text style={styles.specific}>{item.plantSpecificName}</Text>
        ) : null}
        <Text style={styles.meta}>{item.location ?? ''}</Text>
        <Text style={styles.meta}>{`${t('userPlants.lastWatered') ?? 'Last watered'}: ${item.lastWateredDate ?? '—'}`}</Text>
        <Text style={styles.health}>{item.healthStatus ?? ''}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <BrandedHeader title={t('userPlants.title') || 'My Plants'} brandVariant="none"
      left={
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.back()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>} />

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={userPlants}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}><Text>{t('userPlants.empty') ?? 'You have no plants yet.'}</Text></View>
          )}
        />
      )}

      <Modal visible={guideVisible} animationType="slide" onRequestClose={() => setGuideVisible(false)}>
        <SafeAreaView style={styles.safe}>
          <BrandedHeader title={t('userPlants.guide') || 'Plant Guide'} brandVariant="none" />
          <ScrollView contentContainerStyle={styles.guideContainer}>
            {isGuideLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : selectedGuide ? (
              <View>
                <Text style={styles.guideTitle}>{selectedGuide.plantName}</Text>
                <Text style={styles.guideHeading}>{t('userPlants.watering') ?? 'Watering'}</Text>
                <Text style={styles.guideText}>{selectedGuide.watering ?? '—'}</Text>

                <Text style={styles.guideHeading}>{t('userPlants.fertilizing') ?? 'Fertilizing'}</Text>
                <Text style={styles.guideText}>{selectedGuide.fertilizing ?? '—'}</Text>

                <Text style={styles.guideHeading}>{t('userPlants.pruning') ?? 'Pruning'}</Text>
                <Text style={styles.guideText}>{selectedGuide.pruning ?? '—'}</Text>

                <Text style={styles.guideHeading}>{t('userPlants.temperature') ?? 'Temperature'}</Text>
                <Text style={styles.guideText}>{selectedGuide.temperature ?? '—'}</Text>

                <Text style={styles.guideHeading}>{t('userPlants.humidity') ?? 'Humidity'}</Text>
                <Text style={styles.guideText}>{selectedGuide.humidity ?? '—'}</Text>

                <Text style={styles.guideHeading}>{t('userPlants.soil') ?? 'Soil'}</Text>
                <Text style={styles.guideText}>{selectedGuide.soil ?? '—'}</Text>

                <Text style={styles.guideHeading}>{t('userPlants.careNotes') ?? 'Care notes'}</Text>
                <Text style={styles.guideText}>{selectedGuide.careNotes ?? '—'}</Text>
              </View>
            ) : (
              <View style={styles.empty}><Text>{t('userPlants.guideUnavailable') ?? 'Guide not available.'}</Text></View>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={() => setGuideVisible(false)}>
              <Text style={styles.closeText}>{t('common.close') ?? 'Close'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: SPACING.md },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  image: { width: 84, height: 84, borderRadius: RADIUS.md, marginRight: SPACING.md, backgroundColor: COLORS.gray100 },
  info: { flex: 1 },
  name: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textPrimary },
  specific: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  meta: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  health: { marginTop: 6, fontSize: FONTS.sizes.sm, color: COLORS.success },
  empty: { padding: SPACING.lg, alignItems: 'center' },
  guideContainer: { padding: SPACING.md },
  guideTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', marginBottom: SPACING.sm },
  guideHeading: { marginTop: SPACING.md, fontWeight: '700' },
  guideText: { marginTop: SPACING.xs, color: COLORS.textSecondary },
  closeButton: { marginTop: SPACING.lg, alignItems: 'center' },
  closeText: { color: COLORS.primary, fontWeight: '700' },
  headerIconBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
