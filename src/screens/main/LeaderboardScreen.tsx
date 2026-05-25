import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { leaderboardApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardSection } from '../../types';

const GOLD = '#FFD700';
const SILVER = '#C0C0C0';
const BRONZE = '#CD7F32';

const PERIODS: { label: string; value: LeaderboardPeriod }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'All Time', value: 'all_time' },
];

const SECTIONS: { label: string; value: LeaderboardSection }[] = [
  { label: 'All', value: 'all' },
  { label: 'Power', value: 'power' },
  { label: 'Craft', value: 'craft' },
  { label: 'Mind', value: 'mind' },
  { label: 'Purity', value: 'purity' },
];

const PODIUM_COLOR: Record<number, string> = { 1: GOLD, 2: SILVER, 3: BRONZE };
const PODIUM_HEIGHT: Record<number, number> = { 1: 190, 2: 152, 3: 128 };
const PODIUM_AVATAR: Record<number, number> = { 1: 50, 2: 42, 3: 36 };

interface PodiumBoxProps {
  entry?: LeaderboardEntry;
  rank: number;
  isMe: boolean;
}

const PodiumBox: React.FC<PodiumBoxProps> = ({ entry, rank, isMe }) => {
  const color = PODIUM_COLOR[rank];
  const height = PODIUM_HEIGHT[rank];
  const avatarSize = PODIUM_AVATAR[rank];
  const isEmpty = !entry;

  return (
    <View
      style={[
        styles.podiumBox,
        { height, borderColor: color, backgroundColor: color + '10' },
        isMe && {
          shadowColor: color,
          shadowOpacity: 0.85,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
          elevation: 14,
        },
      ]}
    >
      {/* Rank badge — top-right */}
      <View style={styles.podiumRankBadge}>
        <Text style={[styles.podiumRankText, { color }]}>#{rank}</Text>
      </View>

      {/* Avatar */}
      <View
        style={[
          styles.podiumAvatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            borderColor: color,
          },
        ]}
      >
        <Text style={[styles.podiumAvatarText, { fontSize: rank === 1 ? 20 : 15 }]}>
          {isEmpty ? '?' : (entry.name[0]?.toUpperCase() || '?')}
        </Text>
      </View>

      {/* Points */}
      <Text style={[styles.podiumPoints, { color, fontSize: rank === 1 ? 14 : 12 }]}>
        {isEmpty ? '—' : entry.points.toLocaleString()}
        {!isEmpty && <Text style={styles.podiumPtsSuffix}> pts</Text>}
      </Text>

      {/* Name */}
      <Text style={[styles.podiumName, { fontSize: rank === 1 ? 12 : 10 }]} numberOfLines={1}>
        {isEmpty ? '—' : entry.name}
      </Text>
    </View>
  );
};

const LeaderboardScreen = () => {
  const { user } = useAuth();
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<{ rank: number; points: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [section, setSection] = useState<LeaderboardSection>('all');
  const [pendingPeriod, setPendingPeriod] = useState<LeaderboardPeriod>('weekly');
  const [pendingSection, setPendingSection] = useState<LeaderboardSection>('all');

  const activeFilter = useRef({ period: 'weekly' as LeaderboardPeriod, section: 'all' as LeaderboardSection });
  const isFilterActive = period !== 'weekly' || section !== 'all';

  const load = useCallback(async (p: LeaderboardPeriod, s: LeaderboardSection) => {
    try {
      const { data } = await leaderboardApi.get({ period: p, section: s });
      setRankings(data.rankings);
      setMyRank(data.currentUser);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load(activeFilter.current.period, activeFilter.current.section);
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(activeFilter.current.period, activeFilter.current.section);
  };

  const openFilter = () => {
    setPendingPeriod(period);
    setPendingSection(section);
    setShowFilterModal(true);
  };

  const clearFilters = () => {
    activeFilter.current = { period: 'weekly', section: 'all' };
    setPeriod('weekly');
    setSection('all');
    setPendingPeriod('weekly');
    setPendingSection('all');
    setShowFilterModal(false);
    setLoading(true);
    load('weekly', 'all');
  };

  const applyFilters = () => {
    activeFilter.current = { period: pendingPeriod, section: pendingSection };
    setPeriod(pendingPeriod);
    setSection(pendingSection);
    setShowFilterModal(false);
    setLoading(true);
    load(pendingPeriod, pendingSection);
  };

  const myUserId = user?.id || '';
  const top3 = [1, 2, 3].map(r => rankings.find(e => e.rank === r));
  const rest = rankings.filter(e => e.rank > 3);

  const renderRow = ({ item }: { item: LeaderboardEntry }) => {
    const isMe = item.userId === myUserId;
    return (
      <View style={[styles.row, isMe && styles.rowMe]}>
        <Text style={[styles.rowRank, isMe && styles.rowRankMe]}>#{item.rank}</Text>
        <View style={[styles.rowAvatar, isMe && styles.rowAvatarMe]}>
          <Text style={styles.rowAvatarText}>{item.name[0]?.toUpperCase() || '?'}</Text>
        </View>
        <Text style={[styles.rowName, isMe && styles.rowNameMe]} numberOfLines={1}>
          {item.name}{isMe ? ' (you)' : ''}
        </Text>
        <Text style={[styles.rowPoints, isMe && styles.rowPointsMe]}>
          {item.points.toLocaleString()} pts
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <TouchableOpacity style={styles.filterBtn} onPress={openFilter} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={20} color={colors.text} />
          {isFilterActive && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={item => item.userId}
          contentContainerStyle={rankings.length === 0 ? styles.emptyContainer : undefined}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
          ListHeaderComponent={
            rankings.length > 0 ? (
              <>
                {/* Podium */}
                <View style={styles.podiumRow}>
                  {[2, 1, 3].map(rank => (
                    <PodiumBox
                      key={rank}
                      rank={rank}
                      entry={top3[rank - 1]}
                      isMe={top3[rank - 1]?.userId === myUserId}
                    />
                  ))}
                </View>

                {/* Current user rank banner (only if not in top 3) */}
                {myRank && myRank.rank > 3 && (
                  <View style={styles.myRankBanner}>
                    <Text style={styles.myRankLabel}>Your Rank</Text>
                    <View style={styles.myRankRight}>
                      <Text style={styles.myRankNum}>#{myRank.rank}</Text>
                      <Text style={styles.myRankPts}>{myRank.points.toLocaleString()} pts</Text>
                    </View>
                  </View>
                )}
              </>
            ) : null
          }
          ListEmptyComponent={
            rankings.length === 0 ? (
              <Text style={styles.empty}>No rankings yet.</Text>
            ) : null
          }
          renderItem={renderRow}
        />
      )}

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setShowFilterModal(false)}>
          <View style={styles.filterSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Filter Leaderboard</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionLabel}>Period</Text>
            <View style={styles.filterOptions}>
              {PERIODS.map(p => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.filterOption, pendingPeriod === p.value && styles.filterOptionActive]}
                  onPress={() => setPendingPeriod(p.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterOptionText, pendingPeriod === p.value && styles.filterOptionTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionLabel}>Section</Text>
            <View style={styles.filterOptions}>
              {SECTIONS.map(s => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.filterOption, pendingSection === s.value && styles.filterOptionActive]}
                  onPress={() => setPendingSection(s.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterOptionText, pendingSection === s.value && styles.filterOptionTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterClearBtn} onPress={clearFilters} activeOpacity={0.7}>
                <Text style={styles.filterClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyBtn} onPress={applyFilters} activeOpacity={0.85}>
                <Text style={styles.filterApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { ...typography.h3, color: colors.text },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Filter icon
  filterBtn: { padding: 6, position: 'relative' },
  filterDot: {
    position: 'absolute', top: 4, right: 4,
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success,
  },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  // Podium
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  podiumBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    position: 'relative',
    gap: 5,
  },
  podiumRankBadge: {
    position: 'absolute',
    top: 7,
    right: 8,
  },
  podiumRankText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  podiumAvatar: {
    borderWidth: 2,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  podiumAvatarText: {
    color: colors.text,
    fontWeight: '700',
  },
  podiumPoints: {
    fontWeight: '700',
    textAlign: 'center',
  },
  podiumPtsSuffix: {
    fontSize: 10,
    fontWeight: '400',
  },
  podiumName: {
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },

  // My rank banner
  myRankBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  myRankLabel: { ...typography.bodySmall, color: colors.textSecondary },
  myRankRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  myRankNum: { ...typography.h4, color: colors.text },
  myRankPts: { ...typography.bodySmall, color: colors.textMuted },

  // Twitter-style list rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowMe: {
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 10,
    marginHorizontal: spacing.sm,
    marginVertical: 2,
    paddingHorizontal: spacing.md,
    backgroundColor: '#111',
  },
  rowRank: {
    ...typography.bodySmall,
    color: colors.textMuted,
    width: 30,
    textAlign: 'center',
  },
  rowRankMe: { color: colors.textSecondary },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarMe: {
    borderColor: colors.text,
    backgroundColor: colors.card,
  },
  rowAvatarText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  rowName: {
    flex: 1,
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
  },
  rowNameMe: { color: colors.text, fontWeight: '600' },
  rowPoints: { ...typography.bodySmall, color: colors.textMuted },
  rowPointsMe: { color: colors.text, fontWeight: '600' },

  // Filter modal (mirrors JournalScreen)
  filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  filterSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
  },
  filterSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  filterSheetTitle: { ...typography.h3, color: colors.text },
  filterSectionLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#0f0f0f',
  },
  filterOptionActive: { borderColor: colors.text, backgroundColor: '#1a1a1a' },
  filterOptionText: { color: '#666', fontSize: 13 },
  filterOptionTextActive: { color: colors.text, fontWeight: '600' },
  filterActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  filterClearBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#333', alignItems: 'center',
  },
  filterClearText: { color: '#666', fontSize: 14, fontWeight: '600' },
  filterApplyBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: colors.text, alignItems: 'center',
  },
  filterApplyText: { color: colors.background, fontSize: 14, fontWeight: '700' },
});

export default LeaderboardScreen;
