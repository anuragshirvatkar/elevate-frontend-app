import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, RefreshControl, ActivityIndicator, Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { journalsApi } from '../../api';
import { colors, spacing, typography } from '../../theme';
import type { JournalEntry } from '../../types';
import { format, parseISO } from 'date-fns';

const MOOD_LABELS = ['', 'Very Low', 'Low', 'Neutral', 'Good', 'Excellent'];

const JournalScreen = () => {
  const navigation = useNavigation<any>();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [todayEntry, setTodayEntry] = useState<JournalEntry | null>(null);

  // Filter state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const isFilterActive = !!(fromDate || toDate);

  const loadEntries = useCallback(async (pageNum = 1, reset = true) => {
    try {
      const params: any = { page: pageNum, limit: 20 };
      if (fromDate) params.startDate = format(fromDate, 'yyyy-MM-dd');
      if (toDate) params.endDate = format(toDate, 'yyyy-MM-dd');
      const { data } = await journalsApi.getList(params);
      if (reset) setEntries(data.data);
      else setEntries(prev => [...prev, ...data.data]);
      setPage(pageNum);
      setHasMore(data.data.length === 20);

      // Check for today's entry
      const today = format(new Date(), 'yyyy-MM-dd');
      const foundToday = data.data.find(e => e.date === today);
      setTodayEntry(foundToday || null);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [fromDate, toDate]);

  useFocusEffect(
    useCallback(() => { loadEntries(1, true); }, [loadEntries])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEntries(1, true);
  };

  const clearFilters = () => {
    setFromDate(null);
    setToDate(null);
    setShowFilterModal(false);
    loadEntries(1, true);
  };

  const applyFilters = () => {
    setShowFilterModal(false);
    loadEntries(1, true);
  };

  const navigateToDetail = (entry?: JournalEntry, isNewEntry = false) => {
    navigation.navigate('JournalDetail', { entry, isNewEntry });
  };

  const handleBottomButtonPress = () => {
    if (todayEntry) {
      // Edit today's record
      navigateToDetail(todayEntry, false);
    } else {
      // Create new entry for today
      navigateToDetail(undefined, true);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = parseISO(dateStr);
    const today = format(new Date(), 'yyyy-MM-dd');
    const yest = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    const ds = format(d, 'yyyy-MM-dd');
    if (ds === today) return 'Today';
    if (ds === yest) return 'Yesterday';
    return format(d, 'EEE, MMM d');
  };

  const renderCard = ({ item }: { item: JournalEntry }) => {
    const moodVal = item.mood ?? 0;
    return (
      <TouchableOpacity onPress={() => navigateToDetail(item)} activeOpacity={0.7} style={styles.tweet}>
        <View style={styles.tweetHeader}>
          <Text style={styles.tweetName}>{formatDate(item.date)}</Text>
          <View style={styles.tweetHeaderRight}>
            <Text style={styles.tweetMoodLabel} numberOfLines={1} ellipsizeMode="tail">
              {MOOD_LABELS[moodVal]}
            </Text>
            <View style={styles.moodDots}>
              {[1, 2, 3, 4, 5].map(v => (
                <View key={v} style={[styles.moodDot, v <= moodVal && styles.moodDotFilled]} />
              ))}
            </View>
            <Ionicons name="chevron-forward" size={14} color="#666" />
          </View>
        </View>
        {(item.win_of_the_day || item.lesson_learned || item.tomorrow_mission) && (
          <View style={styles.tweetContent}>
            {item.win_of_the_day && (
              <View style={styles.tweetContentRow}>
                <Ionicons name="trophy" size={12} color="#FFD700" />
                <Text style={styles.tweetContentText} numberOfLines={1}>{item.win_of_the_day}</Text>
              </View>
            )}
            {item.lesson_learned && (
              <View style={styles.tweetContentRow}>
                <Ionicons name="book" size={12} color="#54A9FF" />
                <Text style={styles.tweetContentText} numberOfLines={1}>{item.lesson_learned}</Text>
              </View>
            )}
            {item.tomorrow_mission && (
              <View style={styles.tweetContentRow}>
                <Ionicons name="flag" size={12} color="#3DFF86" />
                <Text style={styles.tweetContentText} numberOfLines={1}>{item.tomorrow_mission}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <Text style={styles.headerTitle}>Journal</Text>
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header with back button and title */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={styles.headerTitle}>Journal</Text>
      </View>

      {/* Filter bar below header */}
      <View style={styles.filterBar}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilterModal(true)} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={20} color={colors.text} />
          {isFilterActive && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={item => item.id}
        renderItem={renderCard}
        contentContainerStyle={entries.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>No journal entries yet.</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        ListFooterComponent={
          hasMore && entries.length > 0 ? (
            <TouchableOpacity style={styles.loadMoreBtn} onPress={() => loadEntries(page + 1, false)} activeOpacity={0.7}>
              <Text style={styles.loadMoreText}>Load more</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.newEntryBtn} onPress={handleBottomButtonPress} activeOpacity={0.85}>
          <Text style={styles.newEntryBtnText}>
            {todayEntry ? "Edit today's record" : 'Add Entry'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setShowFilterModal(false)}>
          <View style={styles.filterSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Filter Journal</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionLabel}>Date Range</Text>
            <View style={styles.filterDateRow}>
              <TouchableOpacity
                style={[styles.filterDateBtn, !!fromDate && styles.filterDateBtnActive]}
                onPress={() => setShowFromPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={14} color={fromDate ? '#fff' : '#666'} />
                <Text style={[styles.filterDateBtnText, !!fromDate && styles.filterDateBtnTextActive]}>
                  {fromDate ? format(fromDate, 'MMM d, yyyy') : 'From'}
                </Text>
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={14} color="#444" />
              <TouchableOpacity
                style={[styles.filterDateBtn, !!toDate && styles.filterDateBtnActive]}
                onPress={() => setShowToPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={14} color={toDate ? '#fff' : '#666'} />
                <Text style={[styles.filterDateBtnText, !!toDate && styles.filterDateBtnTextActive]}>
                  {toDate ? format(toDate, 'MMM d, yyyy') : 'To'}
                </Text>
              </TouchableOpacity>
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

      {showFromPicker && (
        <DateTimePicker
          value={fromDate || new Date()}
          mode="date"
          display="default"
          maximumDate={toDate || new Date()}
          onChange={(event, date) => {
            setShowFromPicker(false);
            if (event.type === 'set' && date) setFromDate(date);
          }}
        />
      )}

      {showToPicker && (
        <DateTimePicker
          value={toDate || new Date()}
          mode="date"
          display="default"
          maximumDate={new Date()}
          minimumDate={fromDate || undefined}
          onChange={(event, date) => {
            setShowToPicker(false);
            if (event.type === 'set' && date) setToDate(date);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBack: { width: 36 },
  headerTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  listContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: 24 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { ...typography.body, color: colors.textMuted },

  // Tweet-like entry
  tweet: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    gap: 4,
  },
  tweetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tweetHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  tweetMoodLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
    maxWidth: 80,
  },
  tweetName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  moodDots: { flexDirection: 'row', alignItems: 'center', gap: 3, marginHorizontal: spacing.xs },
  moodDot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#333' },
  moodDotFilled: { backgroundColor: colors.text, borderColor: colors.text },
  tweetContent: {
    marginTop: spacing.xs,
    gap: 4,
  },
  tweetContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tweetContentText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
  },

  loadMoreBtn: {
    marginHorizontal: spacing.lg, marginBottom: spacing.lg,
    paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#222', alignItems: 'center',
  },
  loadMoreText: { color: '#555', fontSize: 13 },

  bottomBar: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  newEntryBtn: {
    backgroundColor: colors.text, borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  newEntryBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },

  // Filter
  filterBtn: { padding: 6, position: 'relative' },
  filterDot: {
    position: 'absolute', top: 4, right: 4,
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success,
  },
  filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  filterSheet: { backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  filterSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  filterSheetTitle: { ...typography.h3, color: colors.text },
  filterSectionLabel: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  filterDateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filterDateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, padding: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: '#333', backgroundColor: '#0f0f0f' },
  filterDateBtnActive: { borderColor: colors.text, backgroundColor: '#1a1a1a' },
  filterDateBtnText: { color: '#666', fontSize: 13 },
  filterDateBtnTextActive: { color: colors.text },
  filterActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  filterClearBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  filterClearText: { color: '#666', fontSize: 14, fontWeight: '600' },
  filterApplyBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center' },
  filterApplyText: { color: colors.background, fontSize: 14, fontWeight: '700' },
});

export default JournalScreen;
