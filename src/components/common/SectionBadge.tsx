import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, typography } from '../../theme';
import type { Section } from '../../types';

const SECTION_COLORS: Record<string, string> = {
  power: colors.power,
  craft: colors.craft,
  mind: colors.mind,
  purity: colors.purity,
  consistency: colors.consistency,
};

const SectionBadge: React.FC<{ section: Section; small?: boolean }> = ({ section, small }) => (
  <View style={[styles.badge, { backgroundColor: SECTION_COLORS[section] + '22' }, small && styles.small]}>
    <Text style={[styles.text, { color: SECTION_COLORS[section] }, small && styles.smallText]}>
      {section.toUpperCase()}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  small: { paddingHorizontal: 7, paddingVertical: 2 },
  text: { ...typography.label, fontSize: 11 },
  smallText: { fontSize: 9 },
});

export default SectionBadge;
