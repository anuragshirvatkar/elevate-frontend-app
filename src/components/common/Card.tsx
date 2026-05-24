import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, radius, spacing, shadows } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  noPadding?: boolean;
}

const Card: React.FC<CardProps> = ({ children, style, elevated = false, noPadding = false }) => (
  <View style={[styles.card, elevated && styles.elevated, noPadding && styles.noPad, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.cardElevated,
    ...shadows.md,
  },
  noPad: { padding: 0 },
});

export default Card;
