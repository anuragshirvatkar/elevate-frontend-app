import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { leaderboardApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography, radius } from '../../theme';
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardSection } from '../../types';
import Card from '../../components/common/Card';

const PERIODS: { label: string; value: LeaderboardPeriod }[] = [
  { label: 'Week', value: 'weekly' },
  { label: 'Month', value: 'monthly' },
  { label: 'Year', value: 'yearly' },
  { label: 'All Time', value: 'all_time' },
];

const SECTIONS: { label: string; value: LeaderboardSection }[] = [
  { label: 'All', value: 'all' },
  { label: 'Power', value: 'power' },
  { label: 'Craft', value: 'craft' },
  { label: 'Mind', value: 'mind' },
  { label: 'Purity', value: 'purity' },
];

const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];

const LeaderboardScreen = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [section, setSection] = useState<LeaderboardSection>('all');
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<{ rank: number; points: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const { data } = await leaderboardApi.get({ period, section });
      setRankings(data.rankings);
      setMyRank(data.currentUser);
    } catch {}
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [period, section]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
      </View>

      {/* Period filter */}
      <View style={styles.filterRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.filterChip, period === p.value && styles.filterChipActive]}
            onPress={() => setPeriod(p.value)}
          >
            <Text style={[styles.filterText, period === p.value && styles.filterTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Section filter */}
      <View style={[styles.filterRow, { paddingTop: 0 }]}>
        {SECTIONS.map((s) => (
          <TouchableOpacity
            key={s.value}
            style={[styles.sectionChip, section === s.value && styles.sectionChipActive]}
            onPress={() => setSection(s.value)}
          >
            <Text style={[styles.filterText, section === s.value && styles.filterTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* My rank */}
      {myRank && (
        <Card style={styles.myRankCard}>
          <View style={styles.myRankRow}>
            <Text style={styles.myRankLabel}>Your Rank</Text>
            <View style={styles.myRankRight}>
              <Text style={styles.myRankNum}>#{myRank.rank}</Text>
              <Text style={styles.myRankPoints}>{myRank.points.toLocaleString()} pts</Text>
            </View>
          </View>
        </Card>
      )}

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={rankings}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
          ListEmptyComponent={<Text style={styles.empty}>No rankings yet.</Text>}
          renderItem={({ item }) => {
            const isMe = item.userId === (user?.id || '');
            const rankColor = item.rank <= 3 ? RANK_COLORS[item.rank - 1] : colors.textSecondary;
            return (
              <View style={[styles.rankRow, isMe && styles.rankRowMe]}>
                <Text style={[styles.rankNum, { color: rankColor }]}>
                  {item.rank <= 3 ? ['🥇', '🥈', '🥉'][item.rank - 1] : `#${item.rank}`}
                </Text>
                <View style={styles.rankAvatar}>
                  <Text style={styles.rankAvatarText}>{item.name[0]?.toUpperCase() || '?'}</Text>
                </View>
                <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
                  {item.name} {isMe ? '(you)' : ''}
                </Text>
                <Text style={styles.rankPoints}>{item.points.toLocaleString()}</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...typography.h2, color: colors.text },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  sectionChip: { paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sectionChipActive: { backgroundColor: colors.cardElevated, borderColor: colors.textSecondary },
  filterText: { ...typography.bodySmall, color: colors.textSecondary },
  filterTextActive: { color: colors.background, fontWeight: '600' },
  myRankCard: { marginHorizontal: spacing.lg, marginVertical: spacing.sm },
  myRankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  myRankLabel: { ...typography.body, color: colors.textSecondary },
  myRankRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  myRankNum: { ...typography.h3, color: colors.text },
  myRankPoints: { ...typography.bodySmall, color: colors.textMuted },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
  rankRowMe: { backgroundColor: colors.card, borderColor: colors.border },
  rankNum: { width: 32, ...typography.body, fontWeight: '700', textAlign: 'center' },
  rankAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cardElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  rankAvatarText: { ...typography.body, color: colors.text, fontWeight: '600' },
  rankName: { flex: 1, ...typography.body, color: colors.textSecondary },
  rankNameMe: { color: colors.text, fontWeight: '600' },
  rankPoints: { ...typography.body, color: colors.text, fontWeight: '600' },
});

export default LeaderboardScreen;
