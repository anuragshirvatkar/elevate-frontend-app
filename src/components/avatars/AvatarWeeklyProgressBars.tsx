import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { WeeklyAvatarProgress } from '../../types';
import { buildWeeklyProgressRows } from '../../utils/avatarProgress';

type Props = {
  progress: WeeklyAvatarProgress;
  compact?: boolean;
};

/** 3 columns for Renji, 2 for Verin/Aelius — each column = one Mon–Sun week, dashes = days logged. */
export function AvatarWeeklyProgressBars({ progress, compact = false }: Props) {
  const rows = buildWeeklyProgressRows(progress);
  const barHeight = compact ? 3 : 5;
  const emptyColor = compact ? '#1e1e1e' : '#1a1a1a';

  return (
    <View style={[styles.row, compact ? styles.rowCompact : styles.rowRegular]}>
      {rows.map((week) => (
        <View key={`week-${week.week}`} style={styles.weekCol}>
          {Array.from({ length: progress.requiredDaysPerWeek }).map((_, dayIndex) => {
            const filledDays = Math.min(week.days, progress.requiredDaysPerWeek);
            const isFilled = dayIndex < filledDays;
            return (
              <View
                key={dayIndex}
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    borderRadius: barHeight / 2,
                    backgroundColor: isFilled ? '#fff' : emptyColor,
                  },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  rowCompact: {
    marginTop: 5,
    gap: 6,
  },
  rowRegular: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    gap: 8,
  },
  weekCol: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  bar: {
    flex: 1,
  },
});
