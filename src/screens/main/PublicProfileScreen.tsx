import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { profileApi } from '../../api';
import { colors, spacing, typography } from '../../theme';
import type { DrawerParamList } from '../../navigation/types';

type RouteProps = RouteProp<DrawerParamList, 'PublicProfile'>;

const SECTION_COLORS: Record<string, string> = {
  power: colors.power, craft: colors.craft, mind: colors.mind, purity: colors.purity,
};

const PLATFORM_ICONS: Record<string, string> = {
  twitter: 'logo-twitter', instagram: 'logo-instagram', linkedin: 'logo-linkedin',
  github: 'logo-github', youtube: 'logo-youtube', facebook: 'logo-facebook',
};

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

interface PublicProfile {
  id: string;
  username: string;
  joinedAt: string;
  lastSeenAt?: string;
  socialLinks: { platform: string; url: string }[];
  stats: {
    totalPoints: number;
    currentStreaks: { power: number; mind: number; craft: number; purity: number };
    longestStreaks: { power: number; mind: number; craft: number; purity: number };
  };
  avatars: Array<{
    id: string;
    name: string;
    title?: string;
    story?: string;
    fullBodyImageUrl?: string;
    profileImageUrl?: string;
    isSelected: boolean;
    lastReason?: string;
  }>;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    section?: string;
    iconUrl?: string;
    isUnlocked: boolean;
    unlockedAt?: string;
    usersUnlockedCount?: number;
  }>;
}

const PublicProfileScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const { userId, username } = route.params;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    profileApi.getPublic(userId)
      .then(({ data }) => setProfile(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  const selectedAvatar = profile?.avatars?.find((a) => a.isSelected);
  const displayName = profile?.username || username || 'User';
  const initials = displayName[0]?.toUpperCase() || '?';
  const streaks = profile?.stats?.currentStreaks;
  const longestStreaks = profile?.stats?.longestStreaks;
  const achievements = (profile?.achievements || []).filter((a) => a.isUnlocked);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={styles.headerTitle}>{displayName}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load profile.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* ── Identity ── */}
          <View style={styles.identityBlock}>
            <View style={styles.identityTop}>
              <View style={styles.avatarCircle}>
                {selectedAvatar?.profileImageUrl ? (
                  <Image source={{ uri: selectedAvatar.profileImageUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarLetter}>{initials}</Text>
                )}
              </View>
              <View style={styles.identityInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
                  <View style={styles.pointsInline}>
                    <Ionicons name="star" size={10} color="#FFD700" />
                    <Text style={styles.pointsInlineText}>{(profile?.stats?.totalPoints || 0).toLocaleString()}</Text>
                  </View>
                </View>
                <Text style={styles.infoMuted}>Joined {fmtDate(profile?.joinedAt)}</Text>
                {profile?.lastSeenAt && (
                  <Text style={styles.infoMuted}>Last seen {fmtDate(profile.lastSeenAt)}</Text>
                )}
              </View>
            </View>
          </View>

          {/* ── Social links ── */}
          {(profile?.socialLinks?.length ?? 0) > 0 && (
            <View style={styles.socialSection}>
              <View style={styles.socialRow}>
                {profile!.socialLinks.map((link, i) => (
                  <TouchableOpacity
                    key={i} style={styles.socialChip}
                    onPress={() => Linking.openURL(link.url)} activeOpacity={0.7}
                  >
                    <Ionicons
                      name={(PLATFORM_ICONS[link.platform.toLowerCase()] || 'link-outline') as any}
                      size={15} color={colors.text}
                    />
                    <Text style={styles.socialChipText}>{link.platform}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.divider} />

          {/* ── Current Streaks ── */}
          {streaks && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Streaks</Text>
              <View style={styles.streakGrid}>
                {(['power', 'mind', 'craft', 'purity'] as const).map((key) => (
                  <View key={key} style={styles.streakItem}>
                    <Text style={styles.streakNum}>{streaks[key]}</Text>
                    <Text style={styles.streakLabel}>{key}</Text>
                    {longestStreaks && (
                      <Text style={styles.streakBest}>best {longestStreaks[key]}</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.divider} />

          {/* ── Avatar ── */}
          {selectedAvatar && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Avatar</Text>
              <View style={styles.avatarCardRow}>
                <View style={styles.avatarBodyWrap}>
                  {selectedAvatar.fullBodyImageUrl ? (
                    <Image source={{ uri: selectedAvatar.fullBodyImageUrl }} style={styles.avatarFullBody} resizeMode="cover" />
                  ) : (
                    <View style={styles.avatarBodyPlaceholder}>
                      <Ionicons name="person" size={44} color="#333" />
                    </View>
                  )}
                  {selectedAvatar.profileImageUrl && (
                    <View style={styles.avatarPicOverlay}>
                      <Image source={{ uri: selectedAvatar.profileImageUrl }} style={styles.avatarPicSmall} />
                    </View>
                  )}
                </View>
                <View style={styles.avatarInfo}>
                  <Text style={styles.avatarName}>{selectedAvatar.name}</Text>
                  {selectedAvatar.title ? <Text style={styles.avatarTitle}>{selectedAvatar.title}</Text> : null}
                  {selectedAvatar.story ? (
                    <Text style={styles.avatarStory} numberOfLines={5}>{selectedAvatar.story}</Text>
                  ) : null}
                  {selectedAvatar.lastReason && (
                    <View style={styles.unlockBadge}>
                      <Ionicons name="lock-open-outline" size={10} color="#3DFF86" />
                      <Text style={styles.unlockBadgeText}>{selectedAvatar.lastReason}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {selectedAvatar && <View style={styles.divider} />}

          {/* ── Achievements ── */}
          {achievements.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              {achievements.map((a, idx) => (
                <View
                  key={a.id}
                  style={[styles.achievementRow, idx < achievements.length - 1 && styles.achievementBorder]}
                >
                  <View style={styles.achievementIconWrap}>
                    {a.iconUrl ? (
                      <Image source={{ uri: a.iconUrl }} style={styles.achievementIconImg} resizeMode="cover" />
                    ) : (
                      <Ionicons name="trophy" size={17} color="#fff" />
                    )}
                  </View>
                  <View style={styles.achievementBody}>
                    <Text style={styles.achievementName}>{a.name}</Text>
                    <Text style={styles.achievementDesc} numberOfLines={1}>{a.description}</Text>
                    <View style={styles.achievementMeta}>
                      <Ionicons name="time-outline" size={10} color="#555" />
                      <Text style={styles.achievementMetaText}>{fmtDate(a.unlockedAt)}</Text>
                      {a.usersUnlockedCount !== undefined && (
                        <>
                          <Text style={styles.achievementMetaDot}>·</Text>
                          <Ionicons name="people-outline" size={10} color="#555" />
                          <Text style={styles.achievementMetaText}>{a.usersUnlockedCount.toLocaleString()} others</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color="#3DFF86" />
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.textMuted, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBack: { width: 36 },
  headerTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16 },

  content: { paddingBottom: 40 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  section: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  sectionTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: spacing.md },

  // Identity
  identityBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  identityTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#111', borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { ...typography.h1, color: colors.text },
  identityInfo: { flex: 1, gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' as any },
  displayName: { ...typography.h3, color: colors.text, flexShrink: 1 },
  pointsInline: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#1a1500', paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 20, borderWidth: 1, borderColor: '#332800',
  },
  pointsInlineText: { color: '#FFD700', fontSize: 11, fontWeight: '700' },
  infoMuted: { ...typography.bodySmall, color: colors.textMuted },

  // Social
  socialSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.lg },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  socialChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: '#0f0f0f',
  },
  socialChipText: { color: colors.text, fontSize: 13, textTransform: 'capitalize' },

  // Streaks
  streakGrid: { flexDirection: 'row', gap: spacing.sm },
  streakItem: {
    flex: 1, alignItems: 'center', gap: 4,
    paddingVertical: spacing.md,
    borderRadius: 12, borderWidth: 1, borderColor: '#1e1e1e', backgroundColor: '#0a0a0a',
  },
  streakNum: { fontSize: 24, fontWeight: '800', color: colors.text },
  streakLabel: { ...typography.caption, color: colors.textMuted, textTransform: 'capitalize', fontSize: 11 },
  streakBest: { ...typography.caption, color: '#555', fontSize: 10 },

  // Avatar
  avatarCardRow: { flexDirection: 'row', gap: spacing.md },
  avatarBodyWrap: { width: 96, position: 'relative' },
  avatarFullBody: { width: 96, height: 152, borderRadius: 12, backgroundColor: '#111' },
  avatarBodyPlaceholder: {
    width: 96, height: 152, borderRadius: 12,
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
  },
  avatarPicOverlay: {
    position: 'absolute', bottom: 6, right: -8,
    borderRadius: 16, borderWidth: 2, borderColor: colors.background, overflow: 'hidden',
  },
  avatarPicSmall: { width: 32, height: 32, borderRadius: 16 },
  avatarInfo: { flex: 1, gap: 5 },
  avatarName: { ...typography.h4, color: colors.text },
  avatarTitle: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  avatarStory: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 18 },
  unlockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unlockBadgeText: { ...typography.caption, color: '#3DFF86', fontSize: 11 },

  // Achievements
  achievementRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md,
  },
  achievementBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  achievementIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#222',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  achievementIconImg: { width: 42, height: 42, borderRadius: 21 },
  achievementBody: { flex: 1, gap: 2 },
  achievementName: { ...typography.body, color: colors.text, fontWeight: '600', fontSize: 14 },
  achievementDesc: { ...typography.bodySmall, color: colors.textMuted, fontSize: 12 },
  achievementMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  achievementMetaText: { color: '#555', fontSize: 10 },
  achievementMetaDot: { color: '#444', fontSize: 10 },
});

export default PublicProfileScreen;
