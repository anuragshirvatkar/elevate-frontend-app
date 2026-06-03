import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
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
const PODIUM_HEIGHT: Record<number, number> = { 1: 220, 2: 180, 3: 180 };
const PODIUM_AVATAR: Record<number, number> = { 1: 56, 2: 44, 3: 44 };
const PODIUM_WIDTH: Record<number, number> = { 1: 1.2, 2: 1, 3: 1 };

interface PodiumBoxProps {
  entry?: LeaderboardEntry;
  rank: number;
  isMe: boolean;
}

const PodiumBox: React.FC<PodiumBoxProps> = ({ entry, rank, isMe }) => {
  const color = PODIUM_COLOR[rank];
  const height = PODIUM_HEIGHT[rank];
  const avatarSize = PODIUM_AVATAR[rank];
  const flex = PODIUM_WIDTH[rank];
  const isEmpty = !entry;

  return (
    <View
      style={[
        styles.podiumBox,
        { height, borderColor: color + '60', flex },
        {
          shadowColor: color,
          shadowOpacity: rank === 1 ? 0.6 : 0.35,
          shadowRadius: rank === 1 ? 24 : 18,
          shadowOffset: { width: 0, height: 0 },
          elevation: rank === 1 ? 12 : 8,
        },
      ]}
    >
      {/* Inner card overlay */}
      <View style={styles.podiumInnerCard} />

      {/* Rank badge — top-right */}
      <View style={[styles.podiumRankBadge, { backgroundColor: color }]}>
        <Text style={styles.podiumRankText}>#{rank}</Text>
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
        {!isEmpty && entry.profileImageUrl ? (
          <Image
            source={{ uri: entry.profileImageUrl }}
            style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }}
          />
        ) : (
          <Text style={[styles.podiumAvatarText, { fontSize: rank === 1 ? 22 : 16 }]}>
            {isEmpty ? '?' : (entry.name[0]?.toUpperCase() || '?')}
          </Text>
        )}
      </View>

      {/* Points */}
      <Text style={[styles.podiumPoints, { color, fontSize: rank === 1 ? 28 : 22 }]}>
        {isEmpty ? '—' : entry.points.toLocaleString()}
        {!isEmpty && <Text style={styles.podiumPtsSuffix}> pts</Text>}
      </Text>

      {/* Name */}
      <Text style={[styles.podiumName, { fontSize: rank === 1 ? 13 : 11 }]} numberOfLines={1}>
        {isEmpty ? '—' : entry.name}
      </Text>
    </View>
  );
};

const LeaderboardScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<{ rank: number; points: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialSectionApplied = useRef(false);

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

  // Apply section filter from route params on initial mount
  useEffect(() => {
    const sectionParam = route.params?.section as LeaderboardSection | undefined;
    if (sectionParam && SECTIONS.some(s => s.value === sectionParam) && !initialSectionApplied.current) {
      initialSectionApplied.current = true;
      activeFilter.current.section = sectionParam;
      setSection(sectionParam);
      setPendingSection(sectionParam);
      setLoading(true);
      load(activeFilter.current.period, sectionParam);
    }
  }, [route.params, load]);

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
        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>#{item.rank}</Text>
        </View>
        <View style={[styles.rowAvatar, isMe && styles.rowAvatarMe]}>
          {item.profileImageUrl ? (
            <Image
              source={{ uri: item.profileImageUrl }}
              style={{ width: 32, height: 32, borderRadius: 16 }}
            />
          ) : (
            <Text style={[styles.rowAvatarText, isMe && { color: '#000' }]}>{item.name[0]?.toUpperCase() || '?'}</Text>
          )}
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

  const myEntry = myRank && myRank.rank > 3
    ? rankings.find(e => e.userId === myUserId) || { userId: myUserId, name: 'You', rank: myRank.rank, points: myRank.points }
    : null;

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

              </>
            ) : null
          }
          ListEmptyComponent={
            rankings.length === 0 ? (
              <Text style={styles.empty}>No rankings yet.</Text>
            ) : null
          }
          renderItem={renderRow}
          ListFooterComponent={
            myEntry ? (
              <View style={styles.myEntryRow}>
                <View style={[styles.rankBadge, { backgroundColor: '#111' }]}>
                  <Text style={styles.rankBadgeText}>#{myEntry.rank}</Text>
                </View>
                <View style={[styles.rowAvatar, { borderColor: '#000', backgroundColor: '#e0e0e0' }]}>
                  {myEntry.profileImageUrl ? (
                    <Image
                      source={{ uri: myEntry.profileImageUrl }}
                      style={{ width: 32, height: 32, borderRadius: 16 }}
                    />
                  ) : (
                    <Text style={[styles.rowAvatarText, { color: '#000' }]}>{myEntry.name[0]?.toUpperCase() || '?'}</Text>
                  )}
                </View>
                <Text style={styles.myEntryName} numberOfLines={1}>{myEntry.name} (you)</Text>
                <Text style={styles.myEntryPoints}>{myEntry.points.toLocaleString()} pts</Text>
              </View>
            ) : null
          }
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
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  podiumBox: {
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    position: 'relative',
    gap: 8,
  },
  podiumInnerCard: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 16,
    backgroundColor: '#151515',
  },
  podiumRankBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  podiumRankText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.5,
  },
  podiumAvatar: {
    borderWidth: 2,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumAvatarText: {
    color: colors.text,
    fontWeight: '600',
  },
  podiumPoints: {
    fontWeight: '700',
    textAlign: 'center',
  },
  podiumPtsSuffix: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
  podiumName: {
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },

  // List rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowMe: {
    backgroundColor: '#fff',
    borderBottomColor: '#ddd',
  },
  rankBadge: {
    minWidth: 34,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeMe: { backgroundColor: '#222' },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarMe: { borderColor: '#aaa', backgroundColor: '#e8e8e8' },
  rowAvatarText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  rowName: { flex: 1, color: '#aaa', fontSize: 14, fontWeight: '500' },
  rowNameMe: { color: '#000', fontWeight: '700' },
  rowPoints: { fontSize: 13, color: '#555', fontWeight: '500' },
  rowPointsMe: { color: '#000', fontWeight: '700' },
  rowProfileBtn: { padding: 6 },

  // My entry (you) — appended after list
  myEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    backgroundColor: '#fff',
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  myEntryName: { flex: 1, color: '#000', fontSize: 14, fontWeight: '700' },
  myEntryPoints: { fontSize: 13, color: '#333', fontWeight: '700' },

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
