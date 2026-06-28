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
import { useUser } from '../../context/UserContext';
import { format } from 'date-fns';
import { colors, spacing, typography } from '../../theme';
import type { LeaderboardDateRange, LeaderboardEntry, LeaderboardPeriod, LeaderboardSection } from '../../types';
import { optimizeCloudinaryUrl } from '../../utils/cloudinary';

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

const medalColor = (rank: number) => PODIUM_COLOR[rank];

const PERIOD_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  all_time: 'All Time',
};

const formatDateRange = (range: LeaderboardDateRange | null): { label: string; range: string } | null => {
  if (!range) return null;
  const label = PERIOD_LABEL[range.period] ?? 'Leaderboard';

  if (!range.start) {
    return { label, range: 'Since the beginning' };
  }

  const start = new Date(range.start);
  const end = new Date(range.end);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = format(start, sameYear ? 'MMM d' : 'MMM d, yyyy');
  const endStr = format(end, 'MMM d, yyyy');
  return { label, range: `${startStr} – ${endStr}` };
};

interface PodiumBoxProps {
  entry: LeaderboardEntry;
  isMe: boolean;
  onPress?: () => void;
}

const AVATAR_AREA_HEIGHT = 92;

const PodiumBox: React.FC<PodiumBoxProps> = ({ entry, isMe, onPress }) => {
  const rank = entry.rank;
  const color = medalColor(rank) ?? '#666';
  const avatarSize = rank === 1 ? 72 : 54;
  const pressable = !isMe && !!onPress;
  const ringSize = avatarSize + 10;

  return (
    <TouchableOpacity
      activeOpacity={pressable ? 0.75 : 1}
      onPress={pressable ? onPress : undefined}
      style={styles.podiumColumn}
    >
      <View style={styles.podiumAvatarArea}>
        <View
          style={[
            styles.podiumRing,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderColor: color,
              shadowColor: color,
              shadowOpacity: 1,
              shadowRadius: rank === 1 ? 40 : 28,
              shadowOffset: { width: 0, height: 0 },
              elevation: rank === 1 ? 40 : 24,
            },
          ]}
        >
          <View style={[
            styles.podiumAvatarInner,
            { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
          ]}>
            {entry.profileImageUrl ? (
              <Image
                source={{ uri: optimizeCloudinaryUrl(entry.profileImageUrl, 72) }}
                style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }}
              />
            ) : (
              <Text style={[styles.podiumAvatarText, { fontSize: rank === 1 ? 26 : 20 }]}>
                {entry.name[0]?.toUpperCase() || '?'}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.podiumRankPill, { backgroundColor: color }]}>
        <Text style={styles.podiumRankPillText}>#{rank}</Text>
      </View>

      <Text style={styles.podiumName} numberOfLines={1}>
        {entry.name}{isMe ? ' (you)' : ''}
      </Text>

      <Text style={[styles.podiumPoints, { color }]}>
        {entry.points.toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
};

const LeaderboardScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { profile } = useUser();
  const isFemale = profile?.gender === 'female';
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<{ rank: number; points: number } | null>(null);
  const [dateRange, setDateRange] = useState<LeaderboardDateRange | null>(null);
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
      setDateRange(data.dateRange ?? null);
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

  // Top 3 people on podium — ring color follows each entry's rank (handles ties)
  const podium = rankings.slice(0, 3);
  // Display order places the top entry in the center (left = 2nd, center = 1st, right = 3rd)
  const podiumDisplay = podium.length === 3
    ? [podium[1], podium[0], podium[2]]
    : podium.length === 2
      ? [podium[1], podium[0]]
      : podium;
  const afterPodium = rankings.slice(3);
  const tierListEntries = afterPodium.filter((e) => e.rank <= 3);
  const restEntries = afterPodium.filter((e) => e.rank > 3 && e.userId !== myUserId);

  const isOnPodium = podium.some((e) => e.userId === myUserId);
  const isInTierList = tierListEntries.some((e) => e.userId === myUserId);
  const showPinnedMe = !!myRank && !isOnPodium && !isInTierList;

  const myEntry = showPinnedMe
    ? rankings.find((e) => e.userId === myUserId) || {
      userId: myUserId,
      name: 'You',
      rank: myRank!.rank,
      points: myRank!.points,
    }
    : null;

  const openProfile = (entry: LeaderboardEntry) => {
    navigation.navigate('PublicProfile', { userId: entry.userId, username: entry.name });
  };

  const renderLeaderboardRow = (item: LeaderboardEntry, useMedalBadge: boolean) => {
    const isMe = item.userId === myUserId;
    const badgeColor = useMedalBadge ? medalColor(item.rank) : undefined;
    return (
      <TouchableOpacity
        key={item.userId}
        style={[styles.row, isMe && styles.rowMe]}
        activeOpacity={isMe ? 1 : 0.7}
        disabled={isMe}
        onPress={isMe ? undefined : () => openProfile(item)}
      >
        <View style={[styles.rankBadge, badgeColor ? { backgroundColor: badgeColor } : null]}>
          <Text style={[styles.rankBadgeText, badgeColor ? { color: '#000' } : null]}>#{item.rank}</Text>
        </View>
        <View style={[styles.rowAvatar, isMe && styles.rowAvatarMe]}>
          {item.profileImageUrl ? (
            <Image
              source={{ uri: optimizeCloudinaryUrl(item.profileImageUrl, 32) }}
              style={{ width: 32, height: 32, borderRadius: 16 }}
            />
          ) : (
            <Text style={[styles.rowAvatarText, isMe && { color: '#000' }]}>
              {item.name[0]?.toUpperCase() || '?'}
            </Text>
          )}
        </View>
        <Text style={[styles.rowName, isMe && styles.rowNameMe]} numberOfLines={1}>
          {item.name}{isMe ? ' (you)' : ''}
        </Text>
        <Text style={[styles.rowPoints, isMe && styles.rowPointsMe]}>
          {item.points.toLocaleString()} pts
        </Text>
      </TouchableOpacity>
    );
  };

  const renderRow = ({ item }: { item: LeaderboardEntry }) => renderLeaderboardRow(item, false);

  const rangeInfo = formatDateRange(dateRange);

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

      {/* Date range banner */}
      {rangeInfo && (
        <View style={styles.rangeBanner}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.rangeLabel}>{rangeInfo.label}</Text>
          <View style={styles.rangeDot} />
          <Text style={styles.rangeText}>{rangeInfo.range}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={restEntries}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={rankings.length === 0 ? styles.emptyContainer : undefined}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
          ListHeaderComponent={
            rankings.length > 0 ? (
              <>
                {podium.length > 0 && (
                  <View style={styles.podiumRow}>
                    {podiumDisplay.map((entry) => {
                      const isMe = entry.userId === myUserId;
                      return (
                        <PodiumBox
                          key={entry.userId}
                          entry={entry}
                          isMe={isMe}
                          onPress={!isMe ? () => openProfile(entry) : undefined}
                        />
                      );
                    })}
                  </View>
                )}

                {tierListEntries.map((entry) => renderLeaderboardRow(entry, true))}

                {myEntry && (
                  <>
                    <View style={styles.myEntryRow}>
                      <View style={[styles.rankBadge, { backgroundColor: '#111' }]}>
                        <Text style={styles.rankBadgeText}>#{myEntry.rank}</Text>
                      </View>
                      <View style={[styles.rowAvatar, { borderColor: '#000', backgroundColor: '#e0e0e0' }]}>
                        {myEntry.profileImageUrl ? (
                          <Image
                            source={{ uri: optimizeCloudinaryUrl(myEntry.profileImageUrl, 32) }}
                            style={{ width: 32, height: 32, borderRadius: 16 }}
                          />
                        ) : (
                          <Text style={[styles.rowAvatarText, { color: '#000' }]}>
                            {myEntry.name[0]?.toUpperCase() || '?'}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.myEntryName} numberOfLines={1}>{myEntry.name} (you)</Text>
                      <Text style={styles.myEntryPoints}>{myEntry.points.toLocaleString()} pts</Text>
                    </View>
                    <View style={styles.myEntrySeparator} />
                  </>
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
          ListFooterComponent={null}
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
              {SECTIONS.filter(s => s.value !== 'purity' || !isFemale).map(s => (
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

  // Date range banner
  rangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rangeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.3,
  },
  rangeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
  },
  rangeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },

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
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  podiumAvatarArea: {
    height: AVATAR_AREA_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  podiumRing: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumAvatarInner: {
    backgroundColor: '#1c1c1c',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  podiumAvatarText: {
    color: colors.text,
    fontWeight: '700',
  },
  podiumRankPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  podiumRankPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.3,
  },
  podiumName: {
    color: '#ccc',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 12,
    maxWidth: 90,
  },
  podiumPoints: {
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 13,
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

  // My entry (you) — pinned after podium
  myEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  myEntrySeparator: {
    height: 6,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
