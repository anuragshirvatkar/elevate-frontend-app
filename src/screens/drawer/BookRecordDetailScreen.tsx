import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { booksApi } from '../../api';
import { colors, spacing, typography, radius } from '../../theme';
import type { BookRecord } from '../../types';

type TabKey = 'daily' | 'full' | 'summary';

type TabConfig = { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap };

const BASE_TABS: TabConfig[] = [
  { key: 'daily', label: 'Daily', icon: 'calendar-outline' },
  { key: 'full', label: 'Full Story', icon: 'document-text-outline' },
];

const SUMMARY_TAB: TabConfig = { key: 'summary', label: 'Summary', icon: 'sparkles-outline' };

const BookRecordDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { bookId, bookTitle } = route.params as { bookId: string; bookTitle: string };

  const [records, setRecords] = useState<BookRecord[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('daily');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tabs = summary ? [...BASE_TABS, SUMMARY_TAB] : BASE_TABS;

  const load = useCallback(async () => {
    try {
      const [recordsRes, summaryRes] = await Promise.allSettled([
        booksApi.getBookRecords(bookId),
        booksApi.getSummary(bookId),
      ]);
      setRecords(recordsRes.status === 'fulfilled' ? (recordsRes.value.data?.records || []) : []);
      setSummary(
        summaryRes.status === 'fulfilled' && summaryRes.value.data?.summary?.trim()
          ? summaryRes.value.data.summary
          : null,
      );
    } catch {
      setRecords([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabsRow}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={t.icon} size={15} color={active ? colors.background : colors.textSecondary} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator color={colors.text} /></View>
      ) : tab === 'summary' ? (
        <ScrollView contentContainerStyle={styles.fullContent} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryBadge}>
            <Ionicons name="sparkles" size={13} color={colors.mind} />
            <Text style={styles.summaryBadgeText}>AI Summary</Text>
          </View>
          <Text style={styles.fullBody}>{summary}</Text>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : records.length === 0 ? (
        <Text style={styles.empty}>No records for this book yet.</Text>
      ) : tab === 'daily' ? (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {records.map((rec) => {
            const expanded = expandedId === rec.id;
            return (
              <View key={rec.id} style={styles.tweet}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setExpandedId(expanded ? null : rec.id)}
                >
                  <View style={styles.tweetHeader}>
                    <Text style={styles.tweetDate}>{formatLong(rec.date)}</Text>
                    <View style={styles.tweetHeaderRight}>
                      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#666" />
                    </View>
                  </View>
                  {rec.title ? (
                    <Text style={styles.tweetTitle} numberOfLines={expanded ? undefined : 1}>{rec.title}</Text>
                  ) : null}
                  <Text style={styles.tweetBody} numberOfLines={expanded ? undefined : 2}>
                    {rec.description}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.fullContent} showsVerticalScrollIndicator={false}>
          {records.map((rec, idx) => (
            <View key={rec.id} style={idx > 0 ? styles.fullEntrySpacing : undefined}>
              {rec.title ? <Text style={styles.fullTitle}>{rec.title}</Text> : null}
              <Text style={styles.fullDate}>{formatLong(rec.date)}</Text>
              <Text style={styles.fullBody}>{rec.description}</Text>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

function formatLong(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBack: { width: 36 },
  headerTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16, flex: 1, textAlign: 'center' },

  tabsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.mind, borderColor: colors.mind },
  tabText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.background },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },

  listContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  tweet: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    gap: 4,
  },
  tweetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tweetHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tweetDate: { ...typography.caption, color: colors.mind, fontWeight: '700' },
  tweetTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 2 },
  tweetBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20, marginTop: 2 },

  summaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  summaryBadgeText: { ...typography.caption, color: colors.mind, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  fullContent: { padding: spacing.lg },
  fullEntrySpacing: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xl },
  fullTitle: { ...typography.h3, color: colors.text, marginBottom: 2 },
  fullDate: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  fullBody: { ...typography.body, color: colors.text, fontSize: 16, lineHeight: 28 },
});

export default BookRecordDetailScreen;
