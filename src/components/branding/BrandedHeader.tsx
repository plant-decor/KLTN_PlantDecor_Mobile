import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../constants';
import BrandMark, { BrandSizePreset, BrandVariant } from './BrandMark';

type BrandedHeaderProps = {
  left?: React.ReactNode;
  right?: React.ReactNode;
  title?: string;
  brandVariant?: BrandVariant | 'none';
  brandSize?: BrandSizePreset;
  sideWidth?: number;
  containerStyle?: StyleProp<ViewStyle>;
  centerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
};

export default function BrandedHeader({
  left,
  right,
  title,
  brandVariant = 'logoWithText',
  brandSize = 'majorHeader',
  sideWidth = 78,
  containerStyle,
  centerStyle,
  titleStyle,
}: BrandedHeaderProps) {
  const shouldCompactBrand = Boolean(title);

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.side, { width: sideWidth }]}>{left}</View>

      <View style={[styles.center, centerStyle]}>
        {brandVariant !== 'none' ? (
          <BrandMark
            variant={brandVariant}
            size={brandSize}
            width={shouldCompactBrand ? 108 : undefined}
            height={shouldCompactBrand ? 26 : undefined}
          />
        ) : null}

        {title ? (
          <Text style={[styles.title, titleStyle]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>

      <View style={[styles.side, styles.rightSide, { width: sideWidth }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  side: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  rightSide: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  title: {
    maxWidth: '52%',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
