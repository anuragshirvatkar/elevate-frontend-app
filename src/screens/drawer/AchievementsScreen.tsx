import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { profileApi } from '../../api';
import { colors, spacing, typography, radius } from '../../theme';
import type { Achievement } from '../../types';

const SECTION_COLORS: Record<string, string> = {
  power: colors.power, craft: colors.craft, mind: colors.mind,
  purity: colors.purity, consistency: colors.consistency,
};

const AchievementsScreen = () => {
  const navigation = useNavigation();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profileApi.get().then(({ data }) => setAchievements(data.achievements)).finally(() => setLoading(false));
  }, []);

  const unlocked = achievements.filter((a) => a.isUnlocked);
  const locked = achievements.filter((a) => !a.isUnlocked);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Achievements</Text>
        <Text style={styles.count}>{unlocked.length}/{achievements.length}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator color={colors.text} /></View>
      ) : (
        <FlatList
          data={[...unlocked, ...locked]}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={[styles.badge, !item.isUnlocked && styles.badgeLocked]}>
              <Text style={styles.badgeIcon}>{item.isUnlocked ? '🏆' : '🔒'}</Text>
              <Text style={[styles.badgeName, !item.isUnlocked && styles.badgeNameLocked]} numberOfLines={2}>
                {item.name}
              </Text>
              {item.section && (
                <Text style={[styles.badgeSection, { color: SECTION_COLORS[item.section] || colors.textMuted }]}>
                  {item.section.toUpperCase()}
                </Text>
              )}
              {item.isUnlocked && item.unlockedAt && (
                <Text style={styles.unlockedAt}>
                  {new Date(item.unlockedAt).toLocaleDateString()}
                </Text>
              )}
              {!item.isUnlocked && item.description && (
                <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs, marginRight: spacing.sm },
  title: { ...typography.h2, color: colors.text, flex: 1 },
  count: { ...typography.body, color: colors.textSecondary },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { padding: spacing.lg, paddingBottom: 40 },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  badge: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
    minHeight: 120,
  },
  badgeLocked: { opacity: 0.45 },
  badgeIcon: { fontSize: 32 },
  badgeName: { ...typography.bodySmall, color: colors.text, textAlign: 'center', fontWeight: '600' },
  badgeNameLocked: { color: colors.textMuted },
  badgeSection: { ...typography.caption, fontSize: 9, letterSpacing: 1, fontWeight: '700' },
  unlockedAt: { ...typography.caption, color: colors.textMuted },
  description: { ...typography.caption, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },
});

export default AchievementsScreen;
