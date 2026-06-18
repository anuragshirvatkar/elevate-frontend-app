import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ActivityDto } from '../../types';
import { colors, spacing, typography, radius } from '../../theme';
import {
  getActivityDisplayName,
  CRAFT_COMMON_ORDER,
  POWER_COMMON_ORDER,
} from '../../utils/activityDisplayName';

const SECTION_CONFIG = {
  power: {
    commonOrder: POWER_COMMON_ORDER,
    getDisplayName: (name: string) => getActivityDisplayName('power', name),
  },
  craft: {
    commonOrder: CRAFT_COMMON_ORDER,
    getDisplayName: (name: string) => getActivityDisplayName('craft', name),
  },
} as const;

interface ActivityPickerGridProps {
  activities: ActivityDto[];
  customActivityIds: Set<string>;
  section: 'power' | 'craft';
  onSelect: (activity: ActivityDto) => void;
  onCustomPress: () => void;
  showCustom?: boolean;
  customLabel?: string;
}

const ActivityPickerGrid: React.FC<ActivityPickerGridProps> = ({
  activities,
  customActivityIds,
  section,
  onSelect,
  onCustomPress,
  showCustom = true,
  customLabel = '+ Custom',
}) => {
  const [showMore, setShowMore] = useState(false);
  const { commonOrder, getDisplayName } = SECTION_CONFIG[section];

  const { customActivities, displayedActivities, hiddenActivities } = useMemo(() => {
    const named = activities.filter((a) => a.name?.trim());
    const sorted = [...named].sort((a, b) => {
      const aName = getDisplayName(a.name).toLowerCase();
      const bName = getDisplayName(b.name).toLowerCase();
      const aIndex = commonOrder.findIndex((x) => aName.includes(x));
      const bIndex = commonOrder.findIndex((x) => bName.includes(x));
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    const custom = sorted.filter((act) => customActivityIds.has(act.id));
    const nonCustom = sorted.filter((act) => !customActivityIds.has(act.id));
    const predefinedCountToShow = Math.max(0, 5 - custom.length);

    return {
      customActivities: custom,
      displayedActivities: nonCustom.slice(0, predefinedCountToShow),
      hiddenActivities: nonCustom.slice(predefinedCountToShow),
    };
  }, [activities, customActivityIds, commonOrder, getDisplayName]);

  const renderCard = (act: ActivityDto) => (
    <TouchableOpacity
      key={act.id}
      style={styles.activityCard}
      onPress={() => onSelect(act)}
      activeOpacity={0.7}
    >
      <View style={styles.activityInner}>
        <Text style={styles.activityText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
          {getDisplayName(act.name)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderCustomCard = () => (
    <TouchableOpacity style={styles.activityCard} onPress={onCustomPress} activeOpacity={0.7}>
      <View style={[styles.activityInner, styles.customCard]}>
        <Text
          style={[styles.activityText, styles.customText]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {customLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (activities.filter((a) => a.name?.trim()).length === 0) {
    return (
      <View>
        {activities.length > 0 && (
          <Text style={styles.emptyText}>No activities available</Text>
        )}
        {showCustom && (
        <View style={styles.grid}>
          {renderCustomCard()}
        </View>
        )}
      </View>
    );
  }

  return (
    <View>
      <View style={styles.grid}>
        {customActivities.map(renderCard)}
        {displayedActivities.map(renderCard)}
        {showCustom && renderCustomCard()}
        {showMore && hiddenActivities.map(renderCard)}
      </View>

      {hiddenActivities.length > 0 && !showMore && (
        <TouchableOpacity onPress={() => setShowMore(true)} activeOpacity={0.7}>
          <Text style={styles.moreText}>+ More</Text>
        </TouchableOpacity>
      )}
      {hiddenActivities.length > 0 && showMore && (
        <TouchableOpacity onPress={() => setShowMore(false)} activeOpacity={0.7}>
          <Text style={styles.moreText}>− Hide</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    alignItems: 'stretch',
  },
  activityCard: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  activityInner: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
    position: 'relative',
  },
  activityText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
    width: '100%',
  },
  customCard: {
    borderStyle: 'dashed',
    borderColor: colors.borderLight,
  },
  customText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  moreText: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    paddingVertical: spacing.sm,
    paddingLeft: 4,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});

export default ActivityPickerGrid;
