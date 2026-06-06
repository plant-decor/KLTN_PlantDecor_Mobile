import React, { useCallback, useRef, useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants';
import { useCameraStore } from '../../stores';
import { ImageEditor, type ControlBarActions } from 'expo-dynamic-image-crop';

function CropActionsBridge({
  isEdit,
  onEditChange,
}: {
  isEdit: boolean;
  onEditChange: (isEdit: boolean) => void;
}) {
  useEffect(() => {
    onEditChange(isEdit);
  }, [isEdit, onEditChange]);

  return null;
}

export default function AppCameraScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropIsEdit, setCropIsEdit] = useState(false);
  const cropActionsRef = useRef<ControlBarActions | null>(null);
  const cameraRef = useRef<React.ElementRef<typeof CameraView> | null>(null);

  const resolveCamera = useCameraStore((state) => state.resolve);
  const setResolve = useCameraStore((state) => state.setResolve);

  // If user unmounts/goes back without capturing, we should resolve with canceled: true
  useEffect(() => {
    return () => {
      const currentResolve = useCameraStore.getState().resolve;
      if (currentResolve) {
        currentResolve({ canceled: true, assets: null });
        useCameraStore.getState().setResolve(null);
      }
    };
  }, []);

  const handleCapture = useCallback(async () => {
    if (isCapturing) {
      return;
    }

    const camera = cameraRef.current;
    if (!camera) {
      Alert.alert('Camera unavailable', 'The camera is not ready yet.');
      return;
    }

    setIsCapturing(true);
    try {
      const photo = await camera.takePictureAsync({
        quality: 0.9,
        skipProcessing: true,
      });

      if (!photo?.uri)  {
        Alert.alert('Capture failed', 'Could not take the photo. Please try again.');
        return;
      }
      
      setPreviewPhoto(photo);
    } catch {
      Alert.alert('Capture failed', 'Could not take the photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, resolveCamera, setResolve, navigation]);


  const handleRetake = useCallback(() => {
    setPreviewPhoto(null);
    setIsCropping(false);
    setCropIsEdit(false);
    cropActionsRef.current = null;
  }, []);

  const handleConfirm = useCallback(() => {
    if (!previewPhoto) return;
    
    if (resolveCamera) {
      const mimeType = previewPhoto.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const fileName = 'app-photo-' + Date.now() + '.jpg';

      resolveCamera({
        canceled: false,
        assets: [{
          uri: previewPhoto.uri,
          width: previewPhoto.width,
          height: previewPhoto.height,
          fileName: fileName,
          mimeType: mimeType,
        }]
      });
      setResolve(null);
      navigation.goBack();
    } else {
      navigation.goBack();
    }
  }, [previewPhoto, resolveCamera, setResolve, navigation]);

  if (!permission) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera access required</Text>
          <Text style={styles.permissionText}>
            Allow camera access to take a photo without leaving the app.
          </Text>
          <Pressable style={styles.permissionButton} onPress={() => void requestPermission()}>
            <Text style={styles.permissionButtonText}>Grant access</Text>
          </Pressable>
          <Pressable style={styles.permissionGhostButton} onPress={() => navigation.goBack()}>
            <Text style={styles.permissionGhostButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }


  if (previewPhoto && !isCropping) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Image source={{ uri: previewPhoto.uri }} style={styles.previewImage} resizeMode="contain" />

        <LinearGradient
          colors={['rgba(0,0,0,0.65)', 'transparent', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.42, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <SafeAreaView style={styles.previewOverlay} edges={['top']}>
          <View style={[styles.previewTopBar, { paddingTop: SPACING.sm }]}>
            <Pressable style={styles.iconButton} onPress={handleRetake}>
              <Ionicons name="close" size={24} color={COLORS.white} />
            </Pressable>

            <View style={styles.topTitleWrap}>
              <Text style={styles.topTitle}>Review photo</Text>
              <Text style={styles.topSubtitle}>Crop or use as-is</Text>
            </View>

            <View style={styles.iconButtonPlaceholder} />
          </View>

          <SafeAreaView edges={['bottom']} style={[styles.previewBottomSection, { paddingBottom: SPACING.md }]}>
            <View style={styles.previewActionsRow}>
              <Pressable style={styles.previewActionButton} onPress={handleRetake}>
                <View style={styles.previewActionIconWrap}>
                  <Ionicons name="refresh" size={22} color={COLORS.white} />
                </View>
                <Text style={styles.previewActionLabel}>Retake</Text>
              </Pressable>

              <Pressable style={styles.previewActionButton} onPress={() => setIsCropping(true)}>
                <View style={styles.previewActionIconWrap}>
                  <Ionicons name="crop" size={22} color={COLORS.white} />
                </View>
                <Text style={styles.previewActionLabel}>Crop</Text>
              </Pressable>
            </View>

            <Pressable style={styles.previewPrimaryButton} onPress={handleConfirm}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.white} />
              <Text style={styles.previewPrimaryButtonText}>Use photo</Text>
            </Pressable>
          </SafeAreaView>
        </SafeAreaView>
      </View>
    );
  }

  if (previewPhoto && isCropping) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ImageEditor
          isVisible={true}
          useModal={false}
          imageUri={previewPhoto.uri}
          dynamicCrop={true}
          editorOptions={{
            backgroundColor: '#000',
          }}
          customControlBar={(actions) => {
            cropActionsRef.current = actions;
            return <CropActionsBridge isEdit={actions.isEdit} onEditChange={setCropIsEdit} />;
          }}
          onEditingComplete={(croppedData) => {
            if (resolveCamera) {
              const mimeType = croppedData.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
              const fileName = 'app-photo-' + Date.now() + '.jpg';
              resolveCamera({
                canceled: false,
                assets: [{
                  uri: croppedData.uri,
                  width: croppedData.width,
                  height: croppedData.height,
                  fileName: fileName,
                  mimeType: mimeType,
                }]
              });
              setResolve(null);
              navigation.goBack();
            } else {
              navigation.goBack();
            }
          }}
          onEditingCancel={() => setIsCropping(false)}
        />

        <View style={styles.cropBottomOverlay} pointerEvents="box-none">
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.92)']}
            style={styles.cropBottomGradient}
            pointerEvents="none"
          />
          <SafeAreaView edges={['bottom']} style={[styles.cropBottomBar, { paddingBottom: SPACING.md }]}>
            {!cropIsEdit ? (
              <View style={styles.cropActionsRow}>
                <Pressable style={styles.cropSecondaryButton} onPress={() => setIsCropping(false)}>
                  <Ionicons name="arrow-back" size={20} color={COLORS.white} />
                  <Text style={styles.cropSecondaryButtonText}>Back</Text>
                </Pressable>
                <Pressable
                  style={styles.cropPrimaryButton}
                  onPress={() => void cropActionsRef.current?.onCrop()}
                >
                  <Ionicons name="crop" size={20} color={COLORS.white} />
                  <Text style={styles.cropPrimaryButtonText}>Apply crop</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.cropActionsRow}>
                <Pressable style={styles.cropSecondaryButton} onPress={() => cropActionsRef.current?.onBack()}>
                  <Ionicons name="arrow-back" size={20} color={COLORS.white} />
                  <Text style={styles.cropSecondaryButtonText}>Back</Text>
                </Pressable>
                <Pressable style={styles.cropPrimaryButton} onPress={() => cropActionsRef.current?.onSave()}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                  <Text style={styles.cropPrimaryButtonText}>Confirm</Text>
                </Pressable>
              </View>
            )}
          </SafeAreaView>
        </View>
      </View>
    );
  }


  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.78)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={[styles.topBar, { paddingTop: insets.top + SPACING.sm }]}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={COLORS.white} />
          </Pressable>

          <View style={styles.topTitleWrap}>
            <Text style={styles.topTitle}>Take a photo</Text>
            <Text style={styles.topSubtitle}></Text>
          </View>

          <Pressable
            style={styles.iconButton}
            onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
          >
            <Ionicons name="camera-reverse-outline" size={22} color={COLORS.white} />
          </Pressable>
        </View>

        <View style={styles.helpWrap}>
          <View style={styles.helpPill}>
            <Ionicons name="sparkles-outline" size={14} color={COLORS.white} />
            <Text style={styles.helpText}>Keep the subject centered and well lit.</Text>
          </View>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
          <Pressable
            style={styles.sideButton}
            onPress={() =>
              Alert.alert(
                'In-app camera',
                'This camera stays inside the app to reduce process interruptions.',
              )
            }
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.white} />
            <Text style={styles.sideButtonText}>In-app</Text>
          </Pressable>

          <Pressable
            style={[styles.captureButtonOuter, isCapturing && styles.captureButtonOuterDisabled]}
            onPress={() => void handleCapture()}
            disabled={isCapturing}
          >
            <View style={styles.captureButtonInner}>
              {isCapturing ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <View style={styles.captureButtonDot} />
              )}
            </View>
          </Pressable>

          <Pressable
            style={styles.sideButton}
            onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={COLORS.white} />
            <Text style={styles.sideButtonText}>Flip</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0A0D12',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  permissionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  permissionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 221, 89, 0.12)',
    marginBottom: SPACING.md,
  },
  permissionTitle: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: 22,
    marginBottom: SPACING.xs,
  },
  permissionText: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.medium,
    fontSize: 15,
  },
  permissionGhostButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  permissionGhostButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.medium,
    fontSize: 14,
    opacity: 0.85,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  topTitleWrap: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  topTitle: {
    color: COLORS.white,
    fontFamily: FONTS.medium,
    fontSize: 16,
  },
  topSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginTop: 2,
  },
  helpWrap: {
    alignItems: 'center',
  },
  helpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  helpText: {
    color: COLORS.white,
    fontFamily: FONTS.medium,
    fontSize: 13,
    marginLeft: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
  },
  sideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  sideButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.medium,
    fontSize: 12,
    marginLeft: 6,
  },
  captureButtonOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  captureButtonOuterDisabled: {
    opacity: 0.75,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  previewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  iconButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  previewBottomSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    gap: SPACING.md,
  },
  previewActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl * 2,
  },
  previewActionButton: {
    alignItems: 'center',
    gap: 6,
  },
  previewActionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  previewActionLabel: {
    color: COLORS.white,
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  previewPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
  },
  previewPrimaryButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  cropBottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  cropBottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
  },
  cropBottomBar: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  cropActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cropSecondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  cropSecondaryButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.medium,
    fontSize: 15,
  },
  cropPrimaryButton: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  cropPrimaryButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: 15,
  },
  captureButtonDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
  },
});
