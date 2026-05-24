import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme';

interface StreakDotsProps {
  data: Array<{ didUserDo?: boolean; didUserRelapse?: boolean }>;
  activeColor?: string;
}

const StreakDots: React.FC<StreakDotsProps> = ({ data, activeColor = colors.success }) => (
  <View style={styles.row}>
    {data.map((d, i) => {
      const active = d.didUserDo === true;
      const relapsed = d.didUserRelapse === true;
      const dot = relapsed ? colors.error : active ? activeColor : colors.border;
      return <View key={i} style={[styles.dot, { backgroundColor: dot }]} />;
    })}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: radius.full },
});

export default StreakDots;
