import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image, FlatList,
  KeyboardAvoidingView, Platform, Modal, Dimensions, Linking, ActionSheetIOS,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { profileApi, setupApi } from '../../api';
import { useUser } from '../../context/UserContext';
import { useAlert } from '../../context/AlertContext';
import { colors, spacing, typography } from '../../theme';
import type { Avatar, SocialLink, CompanionDto, AvatarProgress, WeeklyAvatarProgress, PurityAvatarProgress } from '../../types';
import { sortCompanions } from '../../utils/companions';
import { sortAvatars } from '../../utils/avatars';
import { optimizeCloudinaryUrl } from '../../utils/cloudinary';
import { AvatarWeeklyProgressBars } from '../../components/avatars/AvatarWeeklyProgressBars';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Avatar name → activity mapping
const AVATAR_ACTIVITY: Record<string, string> = {
  renji:  'Craft',
  verin:  'Reading',
  aelius: 'Workout',
  kael:   'Purity',
};

const formatUnlockRequirement = (name: string, req: any): string => {
  if (!req || typeof req !== 'object') return req ? String(req) : '';
  const { weeks, days_per_week, min_streak_days, min_logged_days, max_relapses_per_month } = req as {
    weeks?: number;
    days_per_week?: number;
    min_streak_days?: number;
    min_logged_days?: number;
    max_relapses_per_month?: number;
  };
  if (min_logged_days !== undefined) {
    const relapses = max_relapses_per_month ?? 0;
    return `Maintain no fap for ${min_logged_days} days with ${relapses} relapse${relapses !== 1 ? 's' : ''} allowed`;
  }
  if (min_streak_days !== undefined) {
    const relapseClause = max_relapses_per_month !== undefined
      ? ` with at most ${max_relapses_per_month} relapse${max_relapses_per_month !== 1 ? 's' : ''} per month`
      : '';
    return `Stay clean for at least ${min_streak_days} days${relapseClause}`;
  }
  const activity = AVATAR_ACTIVITY[name?.toLowerCase()] ?? 'activity';
  const w = weeks ?? '?';
  const d = days_per_week ?? '?';
  return `Maintain a ${activity} streak of at least ${d} days a week for ${w} consecutive week${Number(w) !== 1 ? 's' : ''}`;
};

const SOCIAL_PLATFORMS = [
  { key: 'instagram', icon: 'logo-instagram', label: 'Instagram' },
  { key: 'twitter',   icon: 'logo-twitter',   label: 'Twitter / X' },
  { key: 'snapchat',  icon: 'logo-snapchat',  label: 'Snapchat' },
  { key: 'reddit',    icon: 'logo-reddit',    label: 'Reddit' },
  { key: 'website',   icon: 'globe-outline',  label: 'Website' },
];

const fmtDateDisplay = (iso?: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const renderWeeklyProgress = (p: WeeklyAvatarProgress) => (
  <AvatarWeeklyProgressBars progress={p} />
);

const renderPurityProgress = (p: PurityAvatarProgress) => {
  const livesRemaining = Math.max(0, p.maxRelapsesAllowed - p.relapsesThisMonth);
  return (
    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a', gap: 10 }}>
      {/* Lives row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Array.from({ length: p.maxRelapsesAllowed }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < livesRemaining ? 'heart' : 'heart-outline'}
              size={30}
              color={i < livesRemaining ? '#3DFF86' : '#FF4444'}
            />
          ))}
        </View>
        <View style={{ gap: 2 }}>
          <Text style={{ color: livesRemaining > 0 ? '#3DFF86' : '#FF4444', fontSize: 13, fontWeight: '700' }}>
            {livesRemaining} life{livesRemaining !== 1 ? 's' : ''} remaining
          </Text>
          <Text style={{ color: '#444', fontSize: 10 }}>
            {p.relapsesThisMonth} / {p.maxRelapsesAllowed} relapses used
          </Text>
        </View>
      </View>
      {/* Days logged row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, height: 3, borderRadius: 1.5, backgroundColor: '#1a1a1a', overflow: 'hidden' }}>
          <View style={{
            width: `${Math.min(100, (p.loggedDays / p.requiredLoggedDays) * 100)}%` as any,
            height: '100%',
            backgroundColor: p.loggedDays >= p.requiredLoggedDays ? '#3DFF86' : '#555',
            borderRadius: 1.5,
          }} />
        </View>
        <Text style={{ color: '#444', fontSize: 9, width: 36, textAlign: 'right' }}>
          {p.loggedDays}/{p.requiredLoggedDays}d
        </Text>
      </View>
    </View>
  );
};

const renderAvatarProgress = (progress: AvatarProgress | undefined) => {
  if (!progress || progress.type === 'default') return null;
  if (progress.type === 'weekly') return renderWeeklyProgress(progress as WeeklyAvatarProgress);
  if (progress.type === 'purity') return renderPurityProgress(progress as PurityAvatarProgress);
  return null;
};

const EditProfileScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { profile, fetchProfile } = useUser();
  const { showAlert } = useAlert();
  const scrollViewRef = useRef<ScrollView>(null);
  const avatarListRef = useRef<FlatList<Avatar>>(null);
  const avatarSectionY = useRef(0);

  // ── Form state ──
  const [username, setUsername] = useState(profile?.username || '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [usernameReason, setUsernameReason] = useState<string | null>(null);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DOB — date picker
  const initialDob = profile?.dateOfBirth ? new Date(profile.dateOfBirth.split('T')[0] + 'T00:00:00') : null;
  const [dobDate, setDobDate] = useState<Date | null>(initialDob);
  const [showDobPicker, setShowDobPicker] = useState(false);

  // Social links
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    (profile?.socialLinks || []).forEach((l) => { map[l.platform.toLowerCase()] = l.url; });
    return map;
  });
  const [showSocialPopup, setShowSocialPopup] = useState(false);
  const [newPlatform, setNewPlatform] = useState(SOCIAL_PLATFORMS[0].key);
  const [newUrl, setNewUrl] = useState('');

  // Avatar
  const [selectedAvatarId, setSelectedAvatarId] = useState(
    profile?.avatars?.find((a) => a.isSelected)?.id || ''
  );

  // Companion
  const [selectedCompanionId, setSelectedCompanionId] = useState(
    profile?.companions?.find((c) => c.isActive)?.id || ''
  );
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [companionIndex, setCompanionIndex] = useState(0);

  const [saving, setSaving] = useState(false);
  const isSavingRef = useRef(false); // ref so beforeRemove closure always sees the current value
  const [storyPopup, setStoryPopup] = useState<{ name: string; story: string } | null>(null);

  const [allCompanions, setAllCompanions] = useState<CompanionDto[]>([]);
  useEffect(() => {
    setupApi.getOptions()
      .then(({ data }) => setAllCompanions(sortCompanions((data as any).companions ?? [])))
      .catch(() => {});
  }, []);

  // ── Scroll to section on mount ──
  useEffect(() => {
    const scrollTo = route.params?.scrollToSection;
    if (scrollTo === 'avatar' && scrollViewRef.current && avatarSectionY.current > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: avatarSectionY.current, animated: true });
      }, 300);
    }
  }, [route.params]);

  // ── Unsaved changes guard ──
  const origUsername = profile?.username || '';
  const origDob = profile?.dateOfBirth ? new Date(profile.dateOfBirth.split('T')[0] + 'T00:00:00').toDateString() : null;
  const origSocialLinks = (() => {
    const map: Record<string, string> = {};
    (profile?.socialLinks || []).forEach((l) => { map[l.platform.toLowerCase()] = l.url; });
    return JSON.stringify(map);
  })();
  const origAvatarId = profile?.avatars?.find((a) => a.isSelected)?.id || '';
  const origCompanionId = profile?.companions?.find((c) => c.isActive)?.id || '';

  const hasChanges =
    username !== origUsername ||
    (dobDate ? dobDate.toDateString() : null) !== origDob ||
    JSON.stringify(socialLinks) !== origSocialLinks ||
    selectedAvatarId !== origAvatarId ||
    selectedCompanionId !== origCompanionId;

  // Keep refs to latest values for the beforeRemove listener (defined below)
  const onSaveRef = useRef<(() => Promise<void>) | null>(null);
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;

  const promptUnsavedChanges = useCallback((onDiscard: () => void) => {
    showAlert(
      'Unsaved Changes',
      'You have unsaved changes. What would you like to do?',
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: onDiscard,
        },
        {
          text: 'Save',
          style: 'default',
          onPress: async () => { await onSaveRef.current?.(); },
        },
      ],
    );
  }, [showAlert]);

  const handleBack = useCallback(() => {
    if (hasChangesRef.current && !isSavingRef.current) {
      promptUnsavedChanges(() => navigation.goBack());
      return;
    }
    navigation.goBack();
  }, [navigation, promptUnsavedChanges]);

  // Block navigation when there are unsaved changes (both nav back button and Android hardware back)
  useFocusEffect(
    React.useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
        if (!hasChangesRef.current || isSavingRef.current) return;
        e.preventDefault();
        promptUnsavedChanges(() => navigation.dispatch(e.data.action));
      });

      const backHandler = Platform.OS === 'android'
        ? BackHandler.addEventListener('hardwareBackPress', () => {
            if (hasChangesRef.current && !isSavingRef.current) {
              promptUnsavedChanges(() => navigation.goBack());
              return true;
            }
            return false;
          })
        : null;

      return () => {
        unsubscribe();
        backHandler?.remove();
      };
    }, [navigation, promptUnsavedChanges])
  );

  const isFemale = profile?.gender === 'female';
  const allAvatars: Avatar[] = (profile?.avatars || []).filter(a => !isFemale || a.slug !== 'kael');
  const avatarList = sortAvatars(allAvatars, selectedAvatarId, isFemale);

  useEffect(() => {
    const avatarId = route.params?.avatarId;
    if (!avatarId || allAvatars.length === 0) return;

    const avatar = allAvatars.find((a) => a.id === avatarId);
    if (avatar?.isUnlocked) {
      setSelectedAvatarId(avatarId);
    }
  }, [route.params?.avatarId, allAvatars]);

  useEffect(() => {
    const avatarId = route.params?.avatarId;
    if (!avatarId) return;

    const idx = avatarList.findIndex((a) => a.id === avatarId);
    if (idx === -1) return;

    setAvatarIndex(idx);
    const timer = setTimeout(() => {
      avatarListRef.current?.scrollToIndex({ index: idx, animated: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [route.params?.avatarId, avatarList]);

  const companions = sortCompanions(allCompanions.length > 0 ? allCompanions : (profile?.companions || []) as any[]);

  // ── Username validation ──
  const onUsernameChange = (val: string) => {
    setUsername(val);
    setUsernameStatus('idle');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (!val || val === profile?.username) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    usernameTimer.current = setTimeout(async () => {
      try {
        const { data } = await profileApi.isValidUsername(val);
        setUsernameStatus(data.isValid ? 'valid' : 'invalid');
        setUsernameReason(data.reason);
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
  };

  // ── Save ──
  const onSave = async () => {
    if (usernameStatus === 'invalid') {
      showAlert('Invalid Username', usernameReason || 'Username is not available.');
      return;
    }
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);
    try {
      const links: SocialLink[] = Object.entries(socialLinks)
        .filter(([, url]) => url.trim().length > 0)
        .map(([platform, url]) => ({ platform, url: url.trim() }));

      const origAvatarId = profile?.avatars?.find((a) => a.isSelected)?.id || '';
      const origCompanionId = profile?.companions?.find((c) => c.isActive)?.id || '';

      await profileApi.edit({
        username: username !== profile?.username ? username : undefined,
        dateOfBirth: dobDate ? `${dobDate.getFullYear()}-${String(dobDate.getMonth() + 1).padStart(2, '0')}-${String(dobDate.getDate()).padStart(2, '0')}` : undefined,
        socialLinks: links,
        avatarId: selectedAvatarId !== origAvatarId ? selectedAvatarId : undefined,
        companionId: selectedCompanionId !== origCompanionId ? selectedCompanionId : undefined,
      });
      await fetchProfile();
      navigation.goBack();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.message || 'Failed to save changes.');
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
  };

  // Link onSave to ref for beforeRemove listener
  onSaveRef.current = onSave;

  const usernameIcon = () => {
    if (usernameStatus === 'checking') return <ActivityIndicator size="small" color={colors.textMuted} />;
    if (usernameStatus === 'valid') return <Ionicons name="checkmark-circle" size={18} color="#3DFF86" />;
    if (usernameStatus === 'invalid') return <Ionicons name="close-circle" size={18} color="#FF4444" />;
    return null;
  };

  const addSocialLink = () => {
    if (!newUrl.trim()) return;
    setSocialLinks((prev) => ({ ...prev, [newPlatform]: newUrl.trim() }));
    setNewUrl('');
    setShowSocialPopup(false);
  };

  const CARD_WIDTH = SCREEN_WIDTH * 0.62;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header — back + title only */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>

        <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── Username (Save button inline with section title) ── */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Username</Text>
              <TouchableOpacity onPress={onSave} disabled={saving} style={styles.saveBtn}>
                {saving
                  ? <ActivityIndicator size="small" color={colors.background} />
                  : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
            <View style={[
              styles.inputRow,
              usernameStatus === 'valid' && styles.inputValid,
              usernameStatus === 'invalid' && styles.inputInvalid,
            ]}>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={onUsernameChange}
                placeholder="Enter username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {usernameIcon()}
            </View>
            {usernameStatus === 'invalid' && usernameReason && (
              <Text style={styles.inputError}>{usernameReason}</Text>
            )}
            {usernameStatus === 'valid' && (
              <Text style={styles.inputSuccess}>Username is available</Text>
            )}
          </View>

          {/* ── Date of Birth ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date of Birth</Text>
            <TouchableOpacity style={styles.inputRow} onPress={() => setShowDobPicker(true)} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.input, { paddingVertical: 0, color: dobDate ? colors.text : colors.textMuted }]}>
                {dobDate ? new Date(dobDate.getFullYear(), dobDate.getMonth(), dobDate.getDate()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Select date of birth'}
              </Text>
            </TouchableOpacity>
            {showDobPicker && Platform.OS === 'ios' && (
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={dobDate || new Date(2000, 0, 1)}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_, date) => { if (date) setDobDate(date); }}
                  textColor={colors.text}
                />
                <TouchableOpacity style={styles.iosPickerDone} onPress={() => setShowDobPicker(false)}>
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
            {showDobPicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={dobDate || new Date(2000, 0, 1)}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(e, date) => {
                  setShowDobPicker(false);
                  if (e.type === 'set' && date) setDobDate(date);
                }}
              />
            )}
          </View>

          {/* ── Social Links ── */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Social Links</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => { setNewUrl(''); setShowSocialPopup(true); }}>
                <Ionicons name="add" size={16} color={colors.background} />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {Object.keys(socialLinks).length === 0 ? (
              <Text style={styles.emptyHint}>No social links added yet</Text>
            ) : (
              <View style={styles.socialList}>
                {Object.entries(socialLinks).map(([platform, url]) => {
                  const p = SOCIAL_PLATFORMS.find((s) => s.key === platform);
                  const slug = url.split('/').filter(Boolean).pop() || url;
                  const handleChipPress = () => {
                    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
                    if (Platform.OS === 'ios') {
                      ActionSheetIOS.showActionSheetWithOptions(
                        { options: ['Cancel', 'Open in App', 'Open in Browser'], cancelButtonIndex: 0 },
                        (i) => {
                          if (i === 1) Linking.openURL(fullUrl);
                          if (i === 2) Linking.openURL(fullUrl);
                        }
                      );
                    } else {
                      showAlert(
                        `Open ${p?.label || platform}`,
                        url,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Open', onPress: () => Linking.openURL(fullUrl) },
                        ]
                      );
                    }
                  };
                  return (
                    <TouchableOpacity key={platform} style={styles.socialChip} onPress={handleChipPress} activeOpacity={0.75}>
                      <Ionicons name={(p?.icon || 'link-outline') as any} size={16} color={colors.text} />
                      <Text style={styles.socialChipText} numberOfLines={1}>@{slug}</Text>
                      <TouchableOpacity onPress={() => setSocialLinks((prev) => { const n = { ...prev }; delete n[platform]; return n; })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={14} color="#555" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Avatars ── */}
          <View style={styles.section} onLayout={(e) => { avatarSectionY.current = e.nativeEvent.layout.y; }}>
            <Text style={styles.sectionTitle}>Avatar</Text>
            <Text style={styles.sectionSub}>Swipe to browse · tap to select</Text>
            <FlatList
              ref={avatarListRef}
              horizontal
              data={avatarList}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 12}
              decelerationRate="fast"
              contentContainerStyle={{ gap: 12 }}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  avatarListRef.current?.scrollToIndex({ index: info.index, animated: true });
                }, 100);
              }}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + 12));
                setAvatarIndex(idx);
              }}
              renderItem={({ item }) => {
                const isSelected = selectedAvatarId === item.id;
                const isLocked = !item.isUnlocked;
                const unlockText = isLocked && item.unlockRequirement
                  ? formatUnlockRequirement(item.name, item.unlockRequirement)
                  : null;
                return (
                  <TouchableOpacity
                    style={[
                      styles.avatarCard,
                      { width: CARD_WIDTH },
                      isSelected && styles.avatarCardSelected,
                    ]}
                    onPress={() => { if (!isLocked) setSelectedAvatarId(item.id); }}
                    activeOpacity={isLocked ? 1 : 0.85}
                  >
                    {/* Full body image */}
                    <View style={[styles.avatarCardImgWrap, { width: CARD_WIDTH }]}>
                      {item.fullBodyImageUrl ? (
                        <Image
                          source={{ uri: optimizeCloudinaryUrl(item.fullBodyImageUrl, CARD_WIDTH) }}
                          style={[styles.avatarCardImg, { width: CARD_WIDTH }, isLocked && styles.dimmed]}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.avatarCardImgPlaceholder, { width: CARD_WIDTH }, isLocked && styles.dimmed]}>
                          <Ionicons name="person" size={48} color={isLocked ? '#333' : '#555'} />
                        </View>
                      )}
                      {/* Unlock capsule — bottom left inside image */}
                      {unlockText ? (
                        <View style={styles.unlockCapsule}>
                          <Ionicons name="lock-closed" size={10} color="#ccc" />
                          <Text style={styles.unlockCapsuleText} numberOfLines={2}>{unlockText}</Text>
                        </View>
                      ) : null}
                      {/* Lock overlay */}
                      {isLocked && (
                        <View style={styles.avatarLockOverlay}>
                          <Ionicons name="lock-closed" size={28} color="#aaa" />
                        </View>
                      )}
                      {/* Selected badge */}
                      {isSelected && (
                        <View style={styles.avatarSelectedBadge}>
                          <Ionicons name="checkmark" size={14} color="#000" />
                        </View>
                      )}
                    </View>
                    {/* Info below image */}
                    <View style={styles.avatarCardInfo}>
                      <Text style={[styles.avatarCardName, isLocked && styles.mutedText]}>{item.name}</Text>
                      {item.title ? <Text style={styles.avatarCardTitle}>{item.title}</Text> : null}
                      {item.story ? (
                        <View>
                          <Text style={styles.avatarCardStory} numberOfLines={3}>{item.story}</Text>
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation(); setStoryPopup({ name: item.name, story: item.story! }); }}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={styles.storyViewBtn}>View full story</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                      {isLocked ? renderAvatarProgress(item.progress) : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            {/* Dots */}
            {avatarList.length > 1 && (
              <View style={styles.dotsRow}>
                {avatarList.map((_, i) => (
                  <View key={i} style={[styles.dot, i === avatarIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>

          {/* ── Companion ── */}
          {companions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Companion</Text>
              <Text style={styles.sectionSub}>Swipe to browse · tap to select</Text>
              <FlatList
                horizontal
                data={companions}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + 12}
                decelerationRate="fast"
                contentContainerStyle={{ gap: 12 }}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + 12));
                  setCompanionIndex(idx);
                }}
                renderItem={({ item }) => {
                  const isActive = selectedCompanionId === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.companionCard, { width: CARD_WIDTH }, isActive && styles.avatarCardSelected]}
                      onPress={() => setSelectedCompanionId(item.id)}
                      activeOpacity={0.85}
                    >
                      {item.imageUrl || item.image ? (
                        <Image source={{ uri: optimizeCloudinaryUrl(item.imageUrl ?? item.image, CARD_WIDTH) }} style={[styles.companionImg, { width: CARD_WIDTH }]} resizeMode="cover" />
                      ) : (
                        <View style={[styles.companionImgPlaceholder, { width: CARD_WIDTH }]}>
                          <Ionicons name="people" size={48} color="#444" />
                        </View>
                      )}
                      {isActive && (
                        <View style={styles.avatarSelectedBadge}>
                          <Ionicons name="checkmark" size={14} color="#000" />
                        </View>
                      )}
                      <View style={styles.avatarCardInfo}>
                        <Text style={styles.avatarCardName}>{item.name}</Text>
                        {item.description ? (
                          <Text style={styles.avatarCardTitle} numberOfLines={2}>{item.description}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
              {/* Dots */}
              {companions.length > 1 && (
                <View style={styles.dotsRow}>
                  {companions.map((_, i) => (
                    <View key={i} style={[styles.dot, i === companionIndex && styles.dotActive]} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Bottom Save button ── */}
          <TouchableOpacity onPress={onSave} disabled={saving} style={[styles.saveBtn, styles.bottomSaveBtn]}>
            {saving
              ? <ActivityIndicator size="small" color={colors.background} />
              : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Story Popup ── */}
      <Modal visible={!!storyPopup} transparent animationType="fade" onRequestClose={() => setStoryPopup(null)}>
        <View style={styles.popupOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setStoryPopup(null)} />
          <View style={styles.popup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.popupTitle, { flex: 1, marginBottom: 0 }]}>{storyPopup?.name}</Text>
              <TouchableOpacity onPress={() => setStoryPopup(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator
              indicatorStyle="white"
              style={{ maxHeight: 340 }}
              contentContainerStyle={{ paddingRight: 6, paddingBottom: 8 }}
              nestedScrollEnabled
            >
              <Text style={styles.storyFullText}>{storyPopup?.story}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Social Add Popup ── */}
      <Modal visible={showSocialPopup} transparent animationType="fade" onRequestClose={() => setShowSocialPopup(false)}>
        <TouchableOpacity style={styles.popupOverlay} activeOpacity={1} onPress={() => setShowSocialPopup(false)}>
          <View style={styles.popup} onStartShouldSetResponder={() => true}>
            <Text style={styles.popupTitle}>Add Social Link</Text>

            {/* Platform selector */}
            <Text style={styles.popupLabel}>Platform</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
              {SOCIAL_PLATFORMS.map(({ key, icon, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.platformChip, newPlatform === key && styles.platformChipActive]}
                  onPress={() => setNewPlatform(key)}
                >
                  <Ionicons name={icon as any} size={15} color={newPlatform === key ? colors.background : colors.textMuted} />
                  <Text style={[styles.platformChipText, newPlatform === key && styles.platformChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* URL input */}
            <Text style={styles.popupLabel}>URL</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={newUrl}
                onChangeText={setNewUrl}
                placeholder="https://"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                autoFocus
              />
            </View>

            <View style={styles.popupActions}>
              <TouchableOpacity style={styles.popupCancel} onPress={() => setShowSocialPopup(false)}>
                <Text style={styles.popupCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.popupAdd} onPress={addSocialLink}>
                <Text style={styles.popupAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBack: { width: 36 },
  headerTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16 },

  content: { paddingBottom: 40 },

  saveBtn: {
    backgroundColor: colors.text, paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, minWidth: 56, alignItems: 'center', flexDirection: 'row', gap: 4,
  },
  saveBtnText: { color: colors.background, fontWeight: '700', fontSize: 13 },
  bottomSaveBtn: {
    alignSelf: 'center', paddingHorizontal: 48, paddingVertical: 13,
    marginTop: spacing.lg, marginHorizontal: spacing.lg,
  },

  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  sectionTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 15 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionSub: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.md, marginTop: 2 },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#000', borderWidth: 1, borderColor: '#222',
    borderRadius: 12, paddingHorizontal: 14, height: 48, gap: 8,
  },
  inputValid: { borderColor: '#1a4d2e' },
  inputInvalid: { borderColor: '#4d1a1a' },
  input: { flex: 1, color: colors.text, fontSize: 14 },
  inputError: { color: '#FF4444', fontSize: 12, marginTop: 5 },
  inputSuccess: { color: '#3DFF86', fontSize: 12, marginTop: 5 },

  // iOS date picker
  iosPickerWrap: {
    backgroundColor: '#111', borderRadius: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#222', overflow: 'hidden',
  },
  iosPickerDone: {
    alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#222',
  },
  iosPickerDoneText: { color: colors.text, fontWeight: '600', fontSize: 14 },

  // Social
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.text, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: { color: colors.background, fontSize: 13, fontWeight: '600' },
  emptyHint: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  socialList: { gap: 8, marginTop: 4 },
  socialChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#222',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  socialChipText: { flex: 1, color: colors.textMuted, fontSize: 12 },

  // Avatar / Companion carousel
  avatarCard: {
    borderRadius: 16, backgroundColor: '#0a0a0a',
    borderWidth: 1, borderColor: '#1e1e1e', overflow: 'hidden',
  },
  avatarCardSelected: { borderColor: colors.text, borderWidth: 2 },
  // phone-like portrait: width*1.6 ratio
  avatarCardImgWrap: { position: 'relative' },
  avatarCardImg: { width: '100%' as any, aspectRatio: 0.6 },
  avatarCardImgPlaceholder: {
    width: '100%' as any, aspectRatio: 0.6, backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  dimmed: { opacity: 0.35 },
  avatarCardPicOverlay: {
    position: 'absolute', bottom: 10, right: 10,
    borderRadius: 22, borderWidth: 2, borderColor: '#0a0a0a', overflow: 'hidden',
  },
  avatarCardPic: { width: 44, height: 44, borderRadius: 22 },
  avatarLockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  avatarSelectedBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center',
  },
  avatarCardInfo: { padding: 12, gap: 4 },
  avatarCardName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  avatarCardTitle: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  avatarCardStory: { color: '#888', fontSize: 12, lineHeight: 17, marginTop: 4 },
  storyViewBtn: { color: colors.textMuted, fontSize: 11, marginTop: 4, textDecorationLine: 'underline' },
  storyFullText: { color: '#ccc', fontSize: 14, lineHeight: 22 },
  // Unlock capsule inside image bottom-left
  unlockCapsule: {
    position: 'absolute', bottom: 10, left: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5,
    flexDirection: 'row', alignItems: 'flex-start', gap: 5,
  },
  unlockCapsuleText: { flex: 1, color: '#ccc', fontSize: 10, lineHeight: 14 },
  unlockHintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 6 },
  avatarCardLockHint: { flex: 1, color: '#666', fontSize: 11, lineHeight: 16 },
  mutedText: { color: '#555' },
  // Dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
  dotActive: { backgroundColor: colors.text, width: 18 },

  // Companion card
  companionCard: {
    borderRadius: 16, backgroundColor: '#0f0f0f',
    borderWidth: 1, borderColor: '#1e1e1e', overflow: 'hidden', position: 'relative',
  },
  companionImg: { height: 220 },
  companionImgPlaceholder: {
    height: 220, backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },

  // Social popup
  popupOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg,
  },
  popup: {
    width: '100%', backgroundColor: '#111',
    borderRadius: 20, padding: spacing.lg,
    borderWidth: 1, borderColor: '#222',
  },
  popupTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.lg },
  popupLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  platformChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: '#0f0f0f',
  },
  platformChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  platformChipText: { color: colors.textMuted, fontSize: 13 },
  platformChipTextActive: { color: colors.background, fontWeight: '600' },
  popupActions: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  popupCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#333', alignItems: 'center',
  },
  popupCancelText: { color: colors.textMuted, fontWeight: '600' },
  popupAdd: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.text, alignItems: 'center',
  },
  popupAddText: { color: colors.background, fontWeight: '700' },
});

export default EditProfileScreen;
