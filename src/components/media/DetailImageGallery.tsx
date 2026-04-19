import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants';

type DetailImageGalleryProps = {
  images: string[];
  height: number;
  overlay?: ReactNode;
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
  indicatorBottomOffset?: number;
};

const clampIndex = (index: number, length: number): number => {
  if (length <= 0) {
    return 0;
  }

  if (index < 0) {
    return 0;
  }

  if (index >= length) {
    return length - 1;
  }

  return index;
};

export default function DetailImageGallery({
  images,
  height,
  overlay,
  placeholderIcon = 'image-outline',
  indicatorBottomOffset = 32,
}: DetailImageGalleryProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const viewerListRef = useRef<FlatList<string>>(null);

  const normalizedImages = useMemo(
    () =>
      images
        .map((image) => (typeof image === 'string' ? image.trim() : ''))
        .filter((image) => image.length > 0),
    [images],
  );

  const galleryWidth = Math.max(1, screenWidth);

  useEffect(() => {
    if (normalizedImages.length === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((current) => clampIndex(current, normalizedImages.length));
  }, [normalizedImages.length]);

  useEffect(() => {
    if (!isViewerVisible || normalizedImages.length === 0) {
      return;
    }

    const nextOffset = clampIndex(activeIndex, normalizedImages.length) * galleryWidth;
    requestAnimationFrame(() => {
      viewerListRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
    });
  }, [activeIndex, galleryWidth, isViewerVisible, normalizedImages.length]);

  const updateActiveIndex = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = clampIndex(Math.round(offsetX / galleryWidth), normalizedImages.length);
      if (nextIndex !== activeIndex) {
        setActiveIndex(nextIndex);
      }
    },
    [activeIndex, galleryWidth, normalizedImages.length],
  );

  const openViewerAt = useCallback(
    (index: number) => {
      if (normalizedImages.length === 0) {
        return;
      }

      setActiveIndex(clampIndex(index, normalizedImages.length));
      setIsViewerVisible(true);
    },
    [normalizedImages.length],
  );

  const closeViewer = useCallback(() => {
    setIsViewerVisible(false);
  }, []);

  return (
    <>
      <View style={[styles.heroWrap, { height }]}> 
        {normalizedImages.length > 0 ? (
          <FlatList
            data={normalizedImages}
            horizontal
            scrollEnabled={normalizedImages.length > 1}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `${item}-${index}`}
            onMomentumScrollEnd={updateActiveIndex}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                activeOpacity={0.98}
                style={{ width: galleryWidth, height }}
                onPress={() => openViewerAt(index)}
              >
                <Image
                  source={{ uri: item }}
                  style={{ width: galleryWidth, height }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
            getItemLayout={(_, index) => ({
              length: galleryWidth,
              offset: galleryWidth * index,
              index,
            })}
          />
        ) : (
          <View style={styles.placeholderWrap}>
            <Ionicons name={placeholderIcon} size={52} color={COLORS.gray500} />
          </View>
        )}

        {normalizedImages.length > 1 ? (
          <View
            style={[styles.indexWrap, { bottom: indicatorBottomOffset }]}
            pointerEvents="none"
          >
            <Text style={styles.indexText}>{`${activeIndex + 1}/${normalizedImages.length}`}</Text>
          </View>
        ) : null}

        {overlay ? (
          <View style={styles.overlayWrap} pointerEvents="box-none">
            {overlay}
          </View>
        ) : null}
      </View>

      <Modal visible={isViewerVisible} animationType="fade" onRequestClose={closeViewer}>
        <SafeAreaView style={styles.viewerContainer} edges={['top', 'bottom']}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity style={styles.closeBtn} onPress={closeViewer}>
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.viewerCounter}>{`${activeIndex + 1}/${Math.max(
              normalizedImages.length,
              1,
            )}`}</Text>
            <View style={styles.closeBtn} />
          </View>

          <FlatList
            ref={viewerListRef}
            data={normalizedImages}
            horizontal
            scrollEnabled={normalizedImages.length > 1}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `viewer-${item}-${index}`}
            onMomentumScrollEnd={updateActiveIndex}
            renderItem={({ item }) => (
              <View style={[styles.viewerItem, { width: galleryWidth }]}> 
                <Image source={{ uri: item }} style={styles.viewerImage} resizeMode="contain" />
              </View>
            )}
            getItemLayout={(_, index) => ({
              length: galleryWidth,
              offset: galleryWidth * index,
              index,
            })}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    width: '100%',
    backgroundColor: COLORS.gray200,
  },
  placeholderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray200,
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  indexWrap: {
    position: 'absolute',
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  indexText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#050505',
  },
  viewerHeader: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  viewerCounter: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  viewerItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
});
