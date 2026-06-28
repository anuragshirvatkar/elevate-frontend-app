import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { booksApi } from '../../api';
import { colors, spacing, typography } from '../../theme';
import type { BookWithRecords } from '../../types';

const BookRecordsScreen = () => {
  const navigation = useNavigation<any>();
  const [books, setBooks] = useState<BookWithRecords[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await booksApi.getBooksWithRecords();
      setBooks(data || []);
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const renderRow = ({ item }: { item: BookWithRecords }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.tweet}
      onPress={() =>
        navigation.navigate('BookRecordDetail', {
          bookId: item.userBookId,
          bookTitle: item.title,
        })
      }
    >
      <View style={styles.tweetHeader}>
        <View style={styles.tweetTitleRow}>
          <Ionicons name="book-outline" size={15} color={colors.mind} />
          <Text style={styles.tweetName} numberOfLines={1}>{item.title}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color="#666" />
      </View>
      {item.author ? <Text style={styles.tweetAuthor} numberOfLines={1}>{item.author}</Text> : null}
      <View style={styles.tweetMetaRow}>
        <View style={styles.metaChip}>
          <Ionicons name="document-text-outline" size={11} color={colors.textSecondary} />
          <Text style={styles.metaText}>
            {item.recordCount} {item.recordCount === 1 ? 'record' : 'records'}
          </Text>
        </View>
        {item.lastEntryDate ? (
          <View style={styles.metaChip}>
            <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
            <Text style={styles.metaText}>last {formatShort(item.lastEntryDate)}</Text>
          </View>
        ) : null}
        {item.isCompleted ? (
          <View style={styles.metaChip}>
            <Ionicons name="checkmark-circle" size={11} color={colors.mind} />
            <Text style={[styles.metaText, { color: colors.mind }]}>Completed</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={styles.headerTitle}>Book Records</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator color={colors.text} /></View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => b.userBookId}
          renderItem={renderRow}
          contentContainerStyle={books.length === 0 ? styles.emptyContainer : styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No reading records yet. Log your reading reflections to see them here.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

function formatShort(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBack: { width: 36 },
  headerTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 24 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, paddingHorizontal: spacing.lg },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  tweet: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    gap: 4,
  },
  tweetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tweetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: spacing.sm },
  tweetName: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 15, flexShrink: 1 },
  tweetAuthor: { ...typography.bodySmall, color: colors.textMuted, marginLeft: 23 },
  tweetMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4, marginLeft: 23, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...typography.caption, color: colors.textSecondary },
});

export default BookRecordsScreen;
