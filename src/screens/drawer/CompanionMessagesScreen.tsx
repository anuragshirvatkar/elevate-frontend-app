import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { companionApi } from '../../api';
import { colors, spacing, typography } from '../../theme';
import type { CompanionMessage } from '../../types';

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const CompanionMessagesScreen = () => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await companionApi.getAllMessages();
      setMessages(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleMarkRead = async (id: string) => {
    try {
      await companionApi.markRead(id);
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, isRead: true } : m));
    } catch {}
  };

  const renderItem = ({ item }: { item: CompanionMessage }) => {
    const imageUrl = (item.metadata as any)?.imageUrl as string | undefined;
    return (
      <View style={[styles.row, !item.isRead && styles.rowUnread]}>
        {/* Top: date + unread dot */}
        <View style={styles.rowTop}>
          <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text>
          <View style={styles.rowTopRight}>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
        </View>

        {/* Type label */}
        <Text style={styles.typeLabel}>{item.type.replace(/_/g, ' ')}</Text>

        {/* Title */}
        <Text style={styles.rowTitle}>{item.title}</Text>

        {/* Optional image */}
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.msgImage} resizeMode="cover" />
        ) : null}

        {/* Message body */}
        <Text style={styles.rowBody}>{item.message}</Text>

        {/* Footer: companion name + mark as read */}
        <View style={styles.rowFooter}>
          <Text style={styles.companionName}>— {item.companionName}</Text>
          {!item.isRead && (
            <TouchableOpacity onPress={() => handleMarkRead(item.id)} activeOpacity={0.7}>
              <Text style={styles.markReadBtn}>Mark as read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            messages.length === 0 ? styles.emptyContainer : styles.listContainer
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No messages yet. Keep going!</Text>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBack: { width: 36 },
  headerTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16 },

  listContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: 32 },
  emptyContainer: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  emptyText: { ...typography.body, color: colors.textMuted },

  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 5,
  },
  rowUnread: {},

  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowDate: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 15 },
  rowTopRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: colors.text,
  },

  typeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 15 },

  msgImage: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginTop: spacing.xs,
  },

  rowBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  companionName: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  markReadBtn: { fontSize: 12, fontWeight: '600', color: colors.text, textDecorationLine: 'underline' },
});

export default CompanionMessagesScreen;
