import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { companionApi } from '../../api';
import { useUser } from '../../context/UserContext';
import { colors, spacing, typography } from '../../theme';
import type { CompanionMessage } from '../../types';

// Same 3 as AchievementsScreen — real raster images, skip tint
const IMAGE_ACHIEVEMENTS = ['Opened the Book', 'Thinking Begins', 'Strong Mind'];

// For ACHIEVEMENT / AVATAR_UNLOCKED types the imageUrl in metadata is a small icon
// rendered inside a circle (same style as AchievementsScreen).
// For all other types it's a banner image shown full-width.
const ICON_TYPES = ['ACHIEVEMENT', 'AVATAR_UNLOCKED'];

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
  const { profile } = useUser();
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const markedReadIds = useRef<Set<string>>(new Set());

  const companionImageUrl: string | undefined =
    (profile?.companions?.[0] as any)?.imageUrl ||
    (profile?.companions?.[0] as any)?.image;

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

  const markRead = useCallback(async (id: string) => {
    if (markedReadIds.current.has(id)) return;
    markedReadIds.current.add(id);
    try {
      await companionApi.markRead(id);
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, isRead: true } : m));
    } catch {}
  }, []);

  // Auto mark-as-read when item becomes visible
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    viewableItems.forEach(({ item }: { item: CompanionMessage }) => {
      if (!item.isRead) markRead(item.id);
    });
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const formatType = (type: string) =>
    type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const renderItem = ({ item }: { item: CompanionMessage }) => {
    const imageUrl = (item.metadata as any)?.imageUrl as string | undefined;
    const isIconType = ICON_TYPES.includes(item.type);

    return (
      <View style={[styles.row, !item.isRead && styles.rowUnread]}>
        {/* Twitter layout: companion avatar left, content right */}
        <View style={styles.tweetRow}>
          {/* Left: companion avatar */}
          <View style={styles.avatarCol}>
            {companionImageUrl ? (
              <Image source={{ uri: companionImageUrl }} style={styles.companionAvatar} resizeMode="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={18} color="#444" />
              </View>
            )}
          </View>

          {/* Right: content */}
          <View style={styles.contentCol}>
            {/* Name + date + unread dot */}
            <View style={styles.nameRow}>
              <Text style={styles.companionName}>{item.companionName}</Text>
              {!item.isRead && <View style={styles.unreadDot} />}
              <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text>
            </View>

            {/* Type chip */}
            <Text style={styles.typeLabel}>{formatType(item.type)}</Text>

            {/* Large full-width circular image for achievement/avatar types */}
            {imageUrl && isIconType ? (
              <View style={styles.iconCircleWrap}>
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.iconCircleImg}
                  resizeMode="cover"
                  tintColor={item.type === 'ACHIEVEMENT' && !IMAGE_ACHIEVEMENTS.some(n => n.toLowerCase() === item.title.toLowerCase()) ? '#ffffff' : undefined}
                />
              </View>
            ) : null}

            {/* Title */}
            <Text style={styles.rowTitle}>{item.title}</Text>

            {/* Banner image for non-icon types */}
            {imageUrl && !isIconType ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.msgImage}
                resizeMode="cover"
              />
            ) : null}

            {/* Message body */}
            <Text style={styles.rowBody}>{item.message}</Text>

            {item.type === 'ACHIEVEMENT' && (
              <TouchableOpacity
                style={styles.showBtn}
                onPress={() => (navigation as any).navigate('Achievements')}
                activeOpacity={0.7}
              >
                <Text style={styles.showBtnText}>Show</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.background} />
              </TouchableOpacity>
            )}

            {(item.type === 'LEADERBOARD_ENTERED' || item.type === 'LEADERBOARD_MOVED' || item.type === 'LEADERBOARD_NEAR') && (
              <TouchableOpacity
                style={styles.showBtn}
                onPress={() => {
                  const meta = item.metadata as any;
                  const validSections = ['power', 'purity', 'craft', 'mind', 'all'];
                  const metaSection = validSections.includes(meta?.section) ? meta.section : undefined;
                  const titleSection = validSections.find(s => item.title?.toLowerCase().includes(s));
                  const section = metaSection ?? titleSection ?? 'all';
                  (navigation as any).navigate('Leaderboard', { section });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.showBtnText}>View Leaderboard</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.background} />
              </TouchableOpacity>
            )}

            {item.type === 'AVATAR_UNLOCKED' && (
              <TouchableOpacity
                style={styles.showBtn}
                onPress={() => (navigation as any).navigate('EditProfile', { scrollToSection: 'avatar' })}
                activeOpacity={0.7}
              >
                <Text style={styles.showBtnText}>Change Avatar</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.background} />
              </TouchableOpacity>
            )}
          </View>
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
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
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
  },
  rowUnread: {
    borderLeftWidth: 2,
    borderLeftColor: colors.text,
    paddingLeft: spacing.sm,
  },

  // Twitter-like layout
  tweetRow: { flexDirection: 'row', gap: 12 },
  avatarCol: { width: 42, alignItems: 'center', paddingTop: 2 },
  companionAvatar: {
    width: 42, height: 42, borderRadius: 21,
  },
  avatarPlaceholder: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
  },
  contentCol: { flex: 1, gap: 4 },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  companionName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  unreadDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: colors.text,
  },
  rowDate: { color: colors.textMuted, fontSize: 12, marginLeft: 'auto' },

  typeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  iconCircleWrap: {
    width: '80%',
    aspectRatio: 1,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    alignSelf: 'center',
    marginBottom: 4,
  },
  iconCircleImg: { width: '100%', height: '100%' },
  rowTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },

  msgImage: {
    width: '100%',
    height: 130,
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: '#111',
  },

  rowBody: {
    ...typography.bodySmall,
    color: colors.text,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  showBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: spacing.sm,
  },
  showBtnText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 12,
  },
});

export default CompanionMessagesScreen;
