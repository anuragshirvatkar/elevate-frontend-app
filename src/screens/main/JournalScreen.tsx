import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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

  const loadEntries = useCallback(async (pageNum = 1, reset = true) => {
    try {
      const { data } = await journalsApi.getList({ page: pageNum, limit: 20 });
      if (reset) setEntries(data.data);
      else setEntries(prev => [...prev, ...data.data]);
      setPage(pageNum);
      setHasMore(data.data.length === 20);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => { loadEntries(1, true); }, [loadEntries])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEntries(1, true);
  };

  const navigateToDetail = (entry?: JournalEntry) => {
    navigation.navigate('JournalDetail', { entry });
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
      <TouchableOpacity onPress={() => navigateToDetail(item)} activeOpacity={0.7} style={styles.entryCard}>
        <View style={styles.entryCardHeader}>
          <Text style={styles.entryDate}>{formatDate(item.date)}</Text>
          <View style={styles.moodMini}>
            {[1, 2, 3, 4, 5].map(v => (
              <View key={v} style={[styles.moodMiniDot, v <= moodVal && styles.moodMiniDotFilled]} />
            ))}
            {moodVal > 0 && <Text style={styles.moodMiniLabel}>{MOOD_LABELS[moodVal]}</Text>}
          </View>
        </View>
        {(item.win_of_the_day || item.lesson_learned || item.tomorrow_mission) && (
          <View style={styles.entrySnippets}>
            {item.win_of_the_day && <Text style={styles.entrySnippet} numberOfLines={1}>🏆  {item.win_of_the_day}</Text>}
            {item.lesson_learned && <Text style={styles.entrySnippet} numberOfLines={1}>📚  {item.lesson_learned}</Text>}
            {item.tomorrow_mission && <Text style={styles.entrySnippet} numberOfLines={1}>🎯  {item.tomorrow_mission}</Text>}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Journal</Text>
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Journal</Text>
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
        <TouchableOpacity style={styles.newEntryBtn} onPress={() => navigateToDetail()} activeOpacity={0.85}>
          <Text style={styles.newEntryBtnText}>New Entry</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { ...typography.h2, color: colors.text },
  listContainer: { padding: spacing.lg, gap: spacing.md, paddingBottom: 24 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { ...typography.body, color: colors.textMuted },

  // Entry card
  entryCard: {
    backgroundColor: '#111', borderRadius: 12,
    borderWidth: 1, borderColor: '#1e1e1e',
    padding: spacing.md, gap: 6,
  },
  entryCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryDate: { color: colors.text, fontSize: 14, fontWeight: '600' },
  moodMini: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moodMiniDot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#333' },
  moodMiniDotFilled: { backgroundColor: colors.text, borderColor: colors.text },
  moodMiniLabel: { color: '#555', fontSize: 11, fontWeight: '500', marginLeft: 2 },
  entrySnippets: { gap: 2, marginTop: 2 },
  entrySnippet: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },

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
    backgroundColor: colors.text, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  newEntryBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },
});

export default JournalScreen;
