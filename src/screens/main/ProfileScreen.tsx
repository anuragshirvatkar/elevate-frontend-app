import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Linking, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { profileApi } from '../../api';
import { useAlert } from '../../context/AlertContext';
import { colors, spacing, typography } from '../../theme';

const SECTION_COLORS: Record<string, string> = {
  power: colors.power, craft: colors.craft, mind: colors.mind, purity: colors.purity,
};

const SECTION_LABELS: Record<string, string> = {
  power: 'Power', craft: 'Craft', mind: 'Mind', purity: 'Purity',
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

const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const { profile, fetchProfile, isLoadingProfile } = useUser();
  const { showAlert } = useAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [storyModal, setStoryModal] = useState<{ name: string; story: string; fullBodyImageUrl?: string; profileImageUrl?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    showAlert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await profileApi.deleteAccount();
              logout();
            } catch {
              showAlert('Error', 'Failed to delete account. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  useEffect(() => { if (!profile) fetchProfile(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  if (isLoadingProfile && !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingCenter}><ActivityIndicator color={colors.text} /></View>
      </SafeAreaView>
    );
  }

  const streaks = profile?.stats?.currentStreaks;
  const longestStreaks = profile?.stats?.longestStreaks;
  const achievements = profile?.achievements || [];
  const selectedAvatar = profile?.avatars?.find((a) => a.isSelected);
  const activeCompanion = profile?.companions?.find((c) => c.isActive);
  const socialLinks = profile?.socialLinks || [];
  const displayName = profile?.username || user?.email?.split('@')[0] || 'User';
  const initials = displayName[0].toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header — back left, title right (like Journal) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        contentContainerStyle={styles.content}
      >
        {/* ── Identity ── */}
        <View style={styles.identityBlock}>
          <View style={styles.identityTop}>
            <View style={{ position: 'relative' }}>
              <View style={styles.avatarCircle}>
                {selectedAvatar?.profileImageUrl ? (
                  <Image source={{ uri: selectedAvatar.profileImageUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarLetter}>{initials}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.avatarEditBadge}
                onPress={() => navigation.navigate('EditProfile')}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={10} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.identityInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
                <View style={styles.pointsInline}>
                  <Ionicons name="star" size={10} color="#FFD700" />
                  <Text style={styles.pointsInlineText}>{(profile?.stats?.totalPoints || 0).toLocaleString()}</Text>
                </View>
              </View>
              <Text style={styles.infoMuted}>{profile?.email || user?.email || '—'}</Text>
              {profile?.dateOfBirth && <Text style={styles.infoMuted}>{fmtDate(profile.dateOfBirth)}</Text>}
              <Text style={styles.infoMuted}>Joined {fmtDate(profile?.joinedAt)}</Text>
            </View>
          </View>
        </View>

        {/* ── Social ── */}
        <View style={styles.socialSection}>
          {socialLinks.length === 0 ? (
            <TouchableOpacity style={styles.addSocialBtn} activeOpacity={0.7} onPress={() => navigation.navigate('EditProfile')}>
              <Ionicons name="add-circle-outline" size={16} color={colors.textMuted} />
              <Text style={styles.addSocialText}>Add social media</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.socialRow}>
              {socialLinks.map((link, i) => (
                <TouchableOpacity key={i} style={styles.socialChip} onPress={() => Linking.openURL(link.url)} activeOpacity={0.7}>
                  <Ionicons name={(PLATFORM_ICONS[link.platform.toLowerCase()] || 'link-outline') as any} size={15} color={colors.text} />
                  <Text style={styles.socialChipText}>{link.platform}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* ── Avatar ── */}
        {selectedAvatar ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Avatar</Text>
            <View style={styles.avatarCardRow}>
              {/* Full body */}
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
              {/* Story */}
              <View style={styles.avatarInfo}>
                <Text style={styles.avatarName}>{selectedAvatar.name}</Text>
                {selectedAvatar.title ? <Text style={styles.avatarTitle}>{selectedAvatar.title}</Text> : null}
                {selectedAvatar.story ? (
                  <>
                    <Text style={styles.avatarStory} numberOfLines={4}>{selectedAvatar.story}</Text>
                    <TouchableOpacity
                      onPress={() => setStoryModal({ name: selectedAvatar.name, story: selectedAvatar.story!, fullBodyImageUrl: selectedAvatar.fullBodyImageUrl, profileImageUrl: selectedAvatar.profileImageUrl })}
                      activeOpacity={0.7}
                      style={styles.viewMoreBtn}
                    >
                      <Text style={styles.viewMoreText}>View more</Text>
                      <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
                    </TouchableOpacity>
                  </>
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
        ) : null}

        {selectedAvatar ? <View style={styles.divider} /> : null}

        {/* ── Companion ── */}
        {activeCompanion ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Companion</Text>
            <View style={styles.companionCard}>
              {/* Image square — like CompanionSelectScreen card */}
              <View style={styles.companionImgWrap}>
                {activeCompanion.imageUrl ? (
                  <Image source={{ uri: activeCompanion.imageUrl }} style={styles.companionImg} resizeMode="cover" />
                ) : (
                  <View style={styles.companionImgPlaceholder}>
                    <Ionicons name="people" size={36} color="#333" />
                  </View>
                )}
                <View style={styles.companionActiveDot} />
              </View>
              <View style={styles.companionInfo}>
                <Text style={styles.avatarName}>{activeCompanion.name}</Text>
                <View style={styles.unlockBadge}>
                  <Ionicons name="checkmark-circle" size={11} color="#3DFF86" />
                  <Text style={styles.unlockBadgeText}>Active companion</Text>
                </View>
                {activeCompanion.description ? (
                  <Text style={styles.companionDesc} numberOfLines={5}>{activeCompanion.description}</Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {activeCompanion ? <View style={styles.divider} /> : null}

        {/* ── Achievements ── */}
        {achievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            {achievements.map((a, idx) => (
              <View key={a.id} style={[styles.achievementRow, idx < achievements.length - 1 && styles.achievementBorder]}>
                <View style={[styles.achievementIconWrap, !a.isUnlocked && styles.achievementIconWrapLocked]}>
                  {!a.isUnlocked ? (
                    <Ionicons name="lock-closed" size={16} color="#444" />
                  ) : a.iconUrl ? (
                    <Image
                      source={{ uri: a.iconUrl }}
                      style={styles.achievementIconImg}
                      resizeMode="cover"
                      tintColor={['Opened the Book', 'Thinking Begins', 'Strong Mind'].includes(a.name) ? undefined : '#ffffff'}
                    />
                  ) : (
                    <Ionicons name="trophy" size={17} color="#fff" />
                  )}
                </View>
                <View style={styles.achievementBody}>
                  <Text style={[styles.achievementName, !a.isUnlocked && styles.achievementLocked]}>{a.name}</Text>
                  <Text style={styles.achievementDesc} numberOfLines={1}>{a.description}</Text>
                  {a.isUnlocked ? (
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
                  ) : null}
                </View>
                {a.isUnlocked && <Ionicons name="checkmark-circle" size={18} color="#3DFF86" />}
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {/* ── Danger Zone ── */}
        <View style={styles.dangerSection}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
            disabled={deleting}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={styles.deleteBtnText}>{deleting ? 'Deleting...' : 'Delete Account'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Story Modal */}
      <Modal visible={!!storyModal} transparent animationType="slide" onRequestClose={() => setStoryModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setStoryModal(null)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            {/* Close button */}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setStoryModal(null)}>
              <Ionicons name="close" size={18} color="#888" />
            </TouchableOpacity>
            <View style={styles.modalBody}>
              {/* Left: full body image */}
              {storyModal?.fullBodyImageUrl ? (
                <Image source={{ uri: storyModal.fullBodyImageUrl }} style={styles.modalFullBody} resizeMode="cover" />
              ) : (
                <View style={styles.modalFullBodyPlaceholder}>
                  <Ionicons name="person" size={48} color="#333" />
                </View>
              )}
              {/* Right: story */}
              <View style={styles.modalStoryWrap}>
                <Text style={styles.modalTitle}>{storyModal?.name}</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalStory}>{storyModal?.story}</Text>
                </ScrollView>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  headerTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16 },
  headerEditIcon: { marginLeft: spacing.sm, padding: 4 },

  content: { paddingBottom: 40 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  section: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  sectionTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 15 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },

  // Identity
  identityBlock: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  socialSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.lg },
  identityTop: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#111', borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    flexShrink: 0,
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
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },

  addSocialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addSocialText: { ...typography.bodySmall, color: colors.textMuted },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  socialChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: '#0f0f0f',
  },
  socialChipText: { color: colors.text, fontSize: 13, textTransform: 'capitalize' },

  // Streaks — monochrome premium
  streakGrid: { flexDirection: 'row', gap: spacing.sm },
  streakItem: {
    flex: 1, alignItems: 'center', gap: 4,
    paddingVertical: spacing.md,
    borderRadius: 12, borderWidth: 1, borderColor: '#1e1e1e',
    backgroundColor: '#0a0a0a',
  },
  streakNum: { fontSize: 26, fontWeight: '800', color: colors.text },
  streakLabel: { ...typography.caption, color: colors.textMuted, textTransform: 'capitalize', fontSize: 11 },
  streakBestRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
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
  viewMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  viewMoreText: { ...typography.caption, color: colors.textMuted, fontSize: 12 },
  unlockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unlockBadgeText: { ...typography.caption, color: '#3DFF86', fontSize: 11 },

  // Companion — card like CompanionSelectScreen
  companionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  companionImgWrap: { position: 'relative' },
  companionImg: { width: 96, height: 96, borderRadius: 16, backgroundColor: '#111' },
  companionImgPlaceholder: {
    width: 96, height: 96, borderRadius: 16,
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
  },
  companionActiveDot: {
    position: 'absolute', bottom: 6, right: 6,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#3DFF86', borderWidth: 2, borderColor: colors.background,
  },
  companionInfo: { flex: 1, gap: 5 },
  companionDesc: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 18, marginTop: 2 },

  // Achievements
  achievementRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
  },
  achievementBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  achievementIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#222',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  achievementIconWrapLocked: { backgroundColor: '#0d0d0d', borderColor: '#1a1a1a' },
  achievementIconImg: { width: 42, height: 42, borderRadius: 21 },
  achievementBody: { flex: 1, gap: 2 },
  achievementName: { ...typography.body, color: colors.text, fontWeight: '600', fontSize: 14 },
  achievementLocked: { color: '#444' },
  achievementDesc: { ...typography.bodySmall, color: colors.textMuted, fontSize: 12 },
  achievementMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  achievementMetaText: { color: '#555', fontSize: 10 },
  achievementMetaDot: { color: '#444', fontSize: 10 },

  // Danger zone
  dangerSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  deleteBtnText: {
    ...typography.body,
    color: colors.error,
    fontSize: 15,
  },
  deleteHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 12,
  },

  // Story modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    height: '72%',
    borderTopWidth: 1, borderTopColor: colors.border,
    overflow: 'hidden',
  },
  modalCloseBtn: {
    position: 'absolute', top: 12, right: 14, zIndex: 10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { flex: 1, flexDirection: 'row' },
  modalFullBody: { width: '42%', height: '100%', borderTopLeftRadius: 20 },
  modalFullBodyPlaceholder: {
    width: '42%', height: '100%', backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 20,
  },
  modalStoryWrap: { flex: 1, padding: spacing.lg, paddingTop: spacing.xl + 4 },
  modalTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.sm },
  modalStory: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20, paddingBottom: spacing.xl },
});

export default ProfileScreen;
