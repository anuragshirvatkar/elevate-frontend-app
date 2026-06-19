import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Linking, Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const AVATAR_CARD_W = Math.floor((SCREEN_WIDTH - 32 * 2 - 12) / 2.0);

const AVATAR_ACTIVITY: Record<string, string> = {
  renji: 'Craft', verin: 'Reading', aelius: 'Workout', kael: 'Purity',
};

const formatUnlockReq = (name: string, req: any): string => {
  if (!req || typeof req !== 'object') return req ? String(req) : '';
  const { weeks, days_per_week, min_streak_days, min_logged_days, max_relapses_per_month } = req as any;
  if (min_logged_days !== undefined) {
    const relapses = max_relapses_per_month ?? 0;
    return `Maintain no fap for ${min_logged_days} days with ${relapses} relapse${relapses !== 1 ? 's' : ''} allowed`;
  }
  if (min_streak_days !== undefined) {
    const clause = max_relapses_per_month !== undefined
      ? ` with ≤${max_relapses_per_month} relapse${max_relapses_per_month !== 1 ? 's' : ''}/mo`
      : '';
    return `Stay clean ≥${min_streak_days} days${clause}`;
  }
  const activity = AVATAR_ACTIVITY[name?.toLowerCase()] ?? 'activity';
  return `${activity}: ${days_per_week ?? '?'}d/wk for ${weeks ?? '?'} wk${Number(weeks) !== 1 ? 's' : ''}`;
};
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { profileApi } from '../../api';
import { useAlert } from '../../context/AlertContext';
import { colors, spacing, typography } from '../../theme';
import type { Avatar, AvatarProgress, WeeklyAvatarProgress, PurityAvatarProgress } from '../../types';
import { sortAvatars } from '../../utils/avatars';
import { AvatarWeeklyProgressBars } from '../../components/avatars/AvatarWeeklyProgressBars';

const renderCompactProgress = (progress: AvatarProgress) => {
  if (progress.type === 'weekly') {
    return <AvatarWeeklyProgressBars progress={progress as WeeklyAvatarProgress} compact />;
  }
  if (progress.type === 'purity') {
    const { relapsesThisMonth, maxRelapsesAllowed, loggedDays, requiredLoggedDays } = progress as PurityAvatarProgress;
    const livesRemaining = Math.max(0, maxRelapsesAllowed - relapsesThisMonth);
    return (
      <View style={{ marginTop: 5, gap: 3 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: maxRelapsesAllowed }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < livesRemaining ? 'heart' : 'heart-outline'}
              size={13}
              color={i < livesRemaining ? '#3DFF86' : '#FF4444'}
            />
          ))}
        </View>
        <Text style={{ color: '#444', fontSize: 9 }}>{loggedDays}/{requiredLoggedDays}d</Text>
      </View>
    );
  }
  return null;
};

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
  const [selectingAvatarId, setSelectingAvatarId] = useState<string | null>(null);
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

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const openStoryModal = (av: Pick<Avatar, 'name' | 'story' | 'fullBodyImageUrl' | 'profileImageUrl'>) => {
    if (!av.story) return;
    setStoryModal({
      name: av.name,
      story: av.story,
      fullBodyImageUrl: av.fullBodyImageUrl,
      profileImageUrl: av.profileImageUrl,
    });
  };

  const handleAvatarSelect = async (av: Avatar) => {
    if (!av.isUnlocked || av.isSelected) return;

    setSelectingAvatarId(av.id);
    try {
      await profileApi.edit({ avatarId: av.id });
      await fetchProfile();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.message || 'Failed to select avatar.');
    } finally {
      setSelectingAvatarId(null);
    }
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
  const isFemale = profile?.gender === 'female';
  const visibleAvatars = sortAvatars(
    isFemale ? (profile?.avatars ?? []).filter((a) => a.slug !== 'kael') : (profile?.avatars ?? []),
    undefined,
    isFemale,
  );
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
          {socialLinks.length > 0 && (
            <View style={[styles.socialRow, { marginBottom: 10 }]}>
              {socialLinks.map((link, i) => (
                <TouchableOpacity key={i} style={styles.socialChip} onPress={() => Linking.openURL(link.url)} activeOpacity={0.7}>
                  <Ionicons name={(PLATFORM_ICONS[link.platform.toLowerCase()] || 'link-outline') as any} size={15} color={colors.text} />
                  <Text style={styles.socialChipText}>{link.platform}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.addSocialBtn} activeOpacity={0.7} onPress={() => navigation.navigate('EditProfile')}>
            <Ionicons name="add-circle-outline" size={16} color={colors.textMuted} />
            <Text style={styles.addSocialText}>Add social media</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* ── Avatar ── */}
        {visibleAvatars.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>Avatars</Text>

            {/* Selected avatar detail card */}
            {selectedAvatar ? (
              <View style={[styles.avatarCardRow, { marginBottom: spacing.lg }]}>
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
                    <>
                      <Text style={styles.avatarStory} numberOfLines={4}>{selectedAvatar.story}</Text>
                      <TouchableOpacity
                        onPress={() => openStoryModal(selectedAvatar)}
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
            ) : null}

            {/* All avatars carousel (locked + unlocked) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: spacing.lg }}>
              {visibleAvatars.map((av) => {
                const isLocked = !av.isUnlocked;
                const isSelected = av.isSelected;
                const isSelecting = selectingAvatarId === av.id;
                const unlockText = isLocked && av.unlockRequirement
                  ? formatUnlockReq(av.name, av.unlockRequirement)
                  : null;
                return (
                  <View
                    key={av.id}
                    style={[styles.avCarouselCard, isSelected && styles.avCarouselCardSelected, { width: AVATAR_CARD_W }]}
                  >
                    <TouchableOpacity
                      activeOpacity={isLocked ? 1 : 0.75}
                      disabled={isLocked || isSelecting}
                      onPress={() => handleAvatarSelect(av)}
                    >
                      <View style={[styles.avCarouselImgWrap, { width: AVATAR_CARD_W }]}>
                        {av.fullBodyImageUrl ? (
                          <Image
                            source={{ uri: av.fullBodyImageUrl }}
                            style={[styles.avCarouselImg, { width: AVATAR_CARD_W }, isLocked && styles.dimmed]}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.avCarouselImgPlaceholder, { width: AVATAR_CARD_W }, isLocked && styles.dimmed]}>
                            <Ionicons name="person" size={36} color={isLocked ? '#333' : '#555'} />
                          </View>
                        )}
                        {isSelecting && (
                          <View style={styles.avSelectingOverlay}>
                            <ActivityIndicator color="#fff" />
                          </View>
                        )}
                        {unlockText ? (
                          <View style={styles.avUnlockCapsule}>
                            <Ionicons name="lock-closed" size={8} color="#ccc" />
                            <Text style={styles.avUnlockCapsuleText} numberOfLines={2}>{unlockText}</Text>
                          </View>
                        ) : null}
                        {isLocked && (
                          <View style={styles.avLockOverlay}>
                            <Ionicons name="lock-closed" size={22} color="#aaa" />
                          </View>
                        )}
                        {isSelected && (
                          <View style={styles.avSelectedBadge}>
                            <Ionicons name="checkmark" size={12} color="#000" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    <View style={styles.avCarouselInfo}>
                      <Text style={[styles.avCarouselName, isLocked && { color: '#444' }]} numberOfLines={1}>{av.name}</Text>
                      {av.title ? <Text style={styles.avCarouselTitle} numberOfLines={1}>{av.title}</Text> : null}
                      {!isLocked && av.story ? (
                        <>
                          <Text style={styles.avCarouselStory} numberOfLines={2}>{av.story}</Text>
                          <TouchableOpacity
                            onPress={() => openStoryModal(av)}
                            activeOpacity={0.7}
                            style={styles.avViewBtn}
                          >
                            <Text style={styles.avViewText}>View</Text>
                            <Ionicons name="chevron-forward" size={10} color={colors.textMuted} />
                          </TouchableOpacity>
                        </>
                      ) : null}
                      {isLocked && av.progress && av.progress.type !== 'default'
                        ? renderCompactProgress(av.progress)
                        : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {visibleAvatars.length > 0 ? <View style={styles.divider} /> : null}

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

        <View style={styles.divider} />

        {/* ── Danger Zone ── */}
        <View style={styles.dangerSection}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => showAlert('Log Out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: logout },
            ])}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={16} color={colors.error} />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
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
  avatarBodyWrap: { width: 116, position: 'relative' },
  avatarFullBody: { width: 116, height: 190, borderRadius: 12, backgroundColor: '#111' },
  avatarBodyPlaceholder: {
    width: 116, height: 190, borderRadius: 12,
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
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  logoutBtnText: {
    ...typography.body,
    color: colors.error,
    fontSize: 15,
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

  // Avatar carousel (all avatars)
  avCarouselCard: {
    borderRadius: 12, borderWidth: 1, borderColor: '#1e1e1e',
    backgroundColor: '#0a0a0a', overflow: 'hidden',
  },
  avCarouselCardSelected: { borderColor: colors.text },
  avCarouselImgWrap: { position: 'relative', overflow: 'hidden' },
  avCarouselImg: { height: 190, borderRadius: 0 },
  avCarouselImgPlaceholder: {
    height: 190, backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  dimmed: { opacity: 0.35 },
  avLockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  avSelectingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  avUnlockCapsule: {
    position: 'absolute', bottom: 6, left: 6, right: 6,
    flexDirection: 'row', alignItems: 'flex-start', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 4,
  },
  avUnlockCapsuleText: { color: '#ccc', fontSize: 9, flex: 1, lineHeight: 13 },
  avSelectedBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center',
  },
  avCarouselInfo: { paddingHorizontal: 8, paddingVertical: 7 },
  avCarouselName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  avCarouselTitle: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  avCarouselStory: { color: colors.textSecondary, fontSize: 10, lineHeight: 14, marginTop: 4 },
  avViewBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4, alignSelf: 'flex-start' },
  avViewText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },

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
