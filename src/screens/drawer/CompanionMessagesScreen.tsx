import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { companionApi } from '../../api';
import { colors, spacing, typography, radius } from '../../theme';
import type { CompanionMessage } from '../../types';
import Card from '../../components/common/Card';
import { formatDistanceToNow, parseISO } from 'date-fns';

const MSG_TYPE_ICONS: Record<string, string> = {
  ACHIEVEMENT: '🏆',
  AVATAR_UNLOCKED: '⚔️',
  AVATAR_REVOKED: '🔒',
  LEADERBOARD_ENTERED: '📊',
  LEADERBOARD_MOVED: '📈',
  LEADERBOARD_NEAR: '🎯',
  MILESTONE: '🎉',
  RECOVERY: '💪',
  INSIGHT: '💡',
  MIND_SKIPPED: '📚',
  MIND_ACTIVATED: '✅',
  MIND_PAUSED: '⏸️',
};

const CompanionMessagesScreen = () => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMessages = async (p = 1) => {
    try {
      const { data } = await companionApi.getMessages(p, 20);
      if (p === 1) setMessages(data.messages);
      else setMessages((prev) => [...prev, ...data.messages]);
      setTotal(data.pagination.total);
      setPage(p);
    } catch {}
  };

  useEffect(() => {
    loadMessages().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMessages(1);
    setRefreshing(false);
  };

  const handleRead = async (id: string) => {
    try {
      await companionApi.markRead(id);
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, isRead: true } : m));
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator color={colors.text} /></View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
          ListEmptyComponent={<Text style={styles.empty}>No messages yet. Keep going!</Text>}
          onEndReached={() => { if (messages.length < total) loadMessages(page + 1); }}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => !item.isRead && handleRead(item.id)}
              activeOpacity={0.9}
            >
              <Card style={[styles.msgCard, !item.isRead ? styles.msgCardUnread : undefined]}>
                <View style={styles.msgHeader}>
                  <Text style={styles.msgIcon}>{MSG_TYPE_ICONS[item.type] || '💬'}</Text>
                  <View style={styles.msgMeta}>
                    <Text style={styles.msgTitle}>{item.title}</Text>
                    <Text style={styles.msgTime}>
                      {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
                    </Text>
                  </View>
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.msgBody}>{item.message}</Text>
                <Text style={styles.companionName}>— {item.companionName}</Text>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  title: { ...typography.h2, color: colors.text },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm },
  msgCard: {},
  msgCardUnread: { borderColor: colors.borderLight },
  msgHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  msgIcon: { fontSize: 20 },
  msgMeta: { flex: 1 },
  msgTitle: { ...typography.label, color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  msgTime: { ...typography.caption, color: colors.textMuted },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text, marginTop: 4 },
  msgBody: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  companionName: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
});

export default CompanionMessagesScreen;
