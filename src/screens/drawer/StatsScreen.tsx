import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { statsApi } from '../../api';
import { colors, spacing, typography, radius } from '../../theme';
import type { StatsResponse, StatsPeriod } from '../../types';
import Card from '../../components/common/Card';

const PERIODS: { label: string; value: StatsPeriod }[] = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: '1 Year', value: '1y' },
  { label: 'All', value: 'all' },
];

const ProgressBar: React.FC<{ value: number; color: string }> = ({ value, color }) => (
  <View style={styles.progressTrack}>
    <View style={[styles.progressFill, { width: `${Math.min(100, value)}%`, backgroundColor: color }]} />
  </View>
);

const StatsScreen = () => {
  const navigation = useNavigation();
  const [period, setPeriod] = useState<StatsPeriod>('30d');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    statsApi.get({ period }).then(({ data }) => setStats(data)).finally(() => setLoading(false));
  }, [period]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Stats</Text>
      </View>

      {/* Period selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.periodChip, period === p.value && styles.periodChipActive]}
            onPress={() => setPeriod(p.value)}
          >
            <Text style={[styles.periodText, period === p.value && styles.periodTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator color={colors.text} /></View>
      ) : stats ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Overview */}
          <Card>
            <Text style={styles.cardTitle}>Overview</Text>
            <View style={styles.overviewRow}>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewNum}>{stats.overview.totalPoints.toLocaleString()}</Text>
                <Text style={styles.overviewLabel}>Points</Text>
              </View>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewNum}>{stats.overview.achievementsUnlocked}</Text>
                <Text style={styles.overviewLabel}>Achievements</Text>
              </View>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewNum}>{stats.overview.avatarsUnlocked}</Text>
                <Text style={styles.overviewLabel}>Avatars</Text>
              </View>
            </View>
          </Card>

          {/* Consistency */}
          <Card>
            <Text style={styles.cardTitle}>Consistency</Text>
            <View style={styles.consistencyRow}>
              <View style={styles.consistencyItem}>
                <Text style={styles.bigNum}>{stats.consistency.overallCompletionRate.toFixed(0)}%</Text>
                <Text style={styles.smallLabel}>Overall</Text>
              </View>
              <View style={styles.consistencyItem}>
                <Text style={styles.bigNum}>{stats.consistency.activeDays}</Text>
                <Text style={styles.smallLabel}>Active Days</Text>
              </View>
              <View style={styles.consistencyItem}>
                <Text style={styles.bigNum}>{stats.consistency.missedDays}</Text>
                <Text style={styles.smallLabel}>Missed</Text>
              </View>
            </View>
            <ProgressBar value={stats.consistency.overallCompletionRate} color={colors.consistency} />
          </Card>

          {/* Power */}
          <Card>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionDot, { color: colors.power }]}>●</Text>
              <Text style={styles.cardTitle}>Power</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Completion</Text>
              <Text style={styles.metricVal}>{stats.power.completionRate.toFixed(0)}%</Text>
            </View>
            <ProgressBar value={stats.power.completionRate} color={colors.power} />
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Total Hours</Text>
              <Text style={styles.metricVal}>{stats.power.totalHours.toFixed(1)}h</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Active Days</Text>
              <Text style={styles.metricVal}>{stats.power.completedDays}/{stats.power.totalDays}</Text>
            </View>
          </Card>

          {/* Craft */}
          <Card>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionDot, { color: colors.craft }]}>●</Text>
              <Text style={styles.cardTitle}>Craft</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Completion</Text>
              <Text style={styles.metricVal}>{stats.craft.completionRate.toFixed(0)}%</Text>
            </View>
            <ProgressBar value={stats.craft.completionRate} color={colors.craft} />
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Total Hours</Text>
              <Text style={styles.metricVal}>{stats.craft.totalHours.toFixed(1)}h</Text>
            </View>
          </Card>

          {/* Purity */}
          <Card>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionDot, { color: colors.purity }]}>●</Text>
              <Text style={styles.cardTitle}>Purity</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Current Streak</Text>
              <Text style={[styles.metricVal, { color: colors.purity }]}>{stats.purity.currentStreak.days} days</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Longest Streak</Text>
              <Text style={styles.metricVal}>{stats.purity.longestStreak.days} days</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Total Relapses</Text>
              <Text style={styles.metricVal}>{stats.purity.totalRelapses}</Text>
            </View>
          </Card>

          {/* Mind */}
          {'isActive' in stats.mind ? (
            <Card><Text style={styles.inactiveText}>Mind section is not active.</Text></Card>
          ) : (
            <Card>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionDot, { color: colors.mind }]}>●</Text>
                <Text style={styles.cardTitle}>Mind</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Completion</Text>
                <Text style={styles.metricVal}>{stats.mind.completionRate.toFixed(0)}%</Text>
              </View>
              <ProgressBar value={stats.mind.completionRate} color={colors.mind} />
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Books Completed</Text>
                <Text style={styles.metricVal}>{stats.mind.booksCompleted}</Text>
              </View>
            </Card>
          )}

          {/* Journaling */}
          <Card>
            <Text style={styles.cardTitle}>Journaling</Text>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Entries</Text>
              <Text style={styles.metricVal}>{stats.journaling.completedDays}/{stats.journaling.totalDays}</Text>
            </View>
            {stats.journaling.averageMood && (
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Avg Mood</Text>
                <Text style={styles.metricVal}>{stats.journaling.averageMood.toFixed(1)}/5</Text>
              </View>
            )}
          </Card>

          <View style={{ height: 32 }} />
        </ScrollView>
      ) : (
        <Text style={styles.empty}>Failed to load stats.</Text>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  title: { ...typography.h2, color: colors.text },
  periodRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  periodChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  periodChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  periodText: { ...typography.bodySmall, color: colors.textSecondary },
  periodTextActive: { color: colors.background, fontWeight: '600' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.md },
  cardTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  sectionDot: { fontSize: 12 },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-around' },
  overviewItem: { alignItems: 'center', gap: 4 },
  overviewNum: { fontSize: 28, fontWeight: '700', color: colors.text },
  overviewLabel: { ...typography.caption, color: colors.textMuted },
  consistencyRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md },
  consistencyItem: { alignItems: 'center', gap: 4 },
  bigNum: { ...typography.h3, color: colors.text },
  smallLabel: { ...typography.caption, color: colors.textMuted },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  metricLabel: { ...typography.body, color: colors.textSecondary },
  metricVal: { ...typography.body, color: colors.text, fontWeight: '600' },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: spacing.xs, marginBottom: spacing.sm },
  progressFill: { height: 4, borderRadius: 2 },
  inactiveText: { ...typography.body, color: colors.textMuted, fontStyle: 'italic' },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
});

export default StatsScreen;
