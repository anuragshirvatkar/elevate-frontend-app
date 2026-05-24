import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { profileApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { colors, spacing, typography, radius } from '../../theme';
import type { Achievement, Avatar } from '../../types';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import SectionBadge from '../../components/common/SectionBadge';

const SECTION_COLORS: Record<string, string> = {
  power: colors.power, craft: colors.craft, mind: colors.mind, purity: colors.purity,
};

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const { profile, fetchProfile, isLoadingProfile } = useUser();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!profile) fetchProfile();
    else setUsername(profile.username || '');
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const handleSaveUsername = async () => {
    if (!username.trim()) { Alert.alert('Error', 'Username cannot be empty.'); return; }
    setSaving(true);
    try {
      const { data: valid } = await profileApi.isValidUsername(username.trim());
      if (!valid.isValid) { Alert.alert('Invalid Username', valid.reason || 'Please choose another username.'); setSaving(false); return; }
      await profileApi.edit({ username: username.trim() });
      await fetchProfile();
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to update username.');
    } finally {
      setSaving(false);
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
  const unlockedAchievements = profile?.achievements?.filter((a) => a.isUnlocked) || [];
  const selectedAvatar = profile?.avatars?.find((a) => a.isSelected);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
      >
        {/* Avatar & Name */}
        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarCircle}>
              {selectedAvatar ? (
                <Text style={styles.avatarEmoji}>⚔️</Text>
              ) : (
                <Text style={styles.avatarLetter}>
                  {(profile?.username || user?.email || 'U')[0].toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              {editing ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.usernameInput}
                    value={username}
                    onChangeText={setUsername}
                    autoFocus
                    maxLength={30}
                    autoCapitalize="none"
                  />
                  <View style={styles.editBtns}>
                    <TouchableOpacity onPress={() => setEditing(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                    <Button title="Save" onPress={handleSaveUsername} loading={saving} size="sm" />
                  </View>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.profileName}>{profile?.username || user?.email?.split('@')[0] || 'User'}</Text>
                  <TouchableOpacity onPress={() => { setUsername(profile?.username || ''); setEditing(true); }}>
                    <Ionicons name="pencil" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <Text style={styles.profilePoints}>{(profile?.stats?.totalPoints || 0).toLocaleString()} pts total</Text>
            </View>
          </View>
        </Card>

        {/* Streaks */}
        <Card>
          <Text style={styles.cardTitle}>Current Streaks</Text>
          <View style={styles.streakGrid}>
            {(['power', 'craft', 'mind', 'purity'] as const).map((s) => (
              <View key={s} style={[styles.streakItem, { borderColor: SECTION_COLORS[s] + '44' }]}>
                <Text style={[styles.streakNum, { color: SECTION_COLORS[s] }]}>{streaks?.[s] ?? 0}</Text>
                <Text style={styles.streakLabel}>{s}</Text>
                <Text style={styles.streakBest}>Best: {longestStreaks?.[s] ?? 0}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Active Companion */}
        {profile?.companions?.length ? (
          <Card>
            <Text style={styles.cardTitle}>Your Companion</Text>
            {profile.companions.filter((c) => c.isActive).map((c) => (
              <View key={c.id} style={styles.companionRow}>
                <Text style={styles.companionEmoji}>🦁</Text>
                <View>
                  <Text style={styles.companionName}>{c.name}</Text>
                  {c.description && <Text style={styles.companionDesc}>{c.description}</Text>}
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Achievements */}
        {unlockedAchievements.length > 0 && (
          <Card>
            <Text style={styles.cardTitle}>Achievements ({unlockedAchievements.length})</Text>
            <View style={styles.achievementGrid}>
              {unlockedAchievements.slice(0, 6).map((a) => (
                <View key={a.id} style={styles.achievementBadge}>
                  <Text style={styles.achievementIcon}>🏆</Text>
                  <Text style={styles.achievementName} numberOfLines={2}>{a.name}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Logout */}
        <Button title="Log Out" onPress={logout} variant="outline" fullWidth style={styles.logoutBtn} />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...typography.h2, color: colors.text },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  profileCard: {},
  profileTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 32 },
  avatarLetter: { ...typography.h2, color: colors.text },
  profileInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  profileName: { ...typography.h3, color: colors.text },
  profileEmail: { ...typography.bodySmall, color: colors.textMuted },
  profilePoints: { ...typography.bodySmall, color: colors.textSecondary },
  editRow: { gap: spacing.xs },
  usernameInput: { ...typography.body, color: colors.text, backgroundColor: colors.inputBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  editBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cancelText: { ...typography.body, color: colors.textSecondary },
  cardTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.md },
  streakGrid: { flexDirection: 'row', gap: spacing.sm },
  streakItem: { flex: 1, alignItems: 'center', gap: 2, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  streakNum: { fontSize: 24, fontWeight: '700' },
  streakLabel: { ...typography.caption, color: colors.textMuted, textTransform: 'capitalize' },
  streakBest: { ...typography.caption, color: colors.textMuted },
  companionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  companionEmoji: { fontSize: 32 },
  companionName: { ...typography.h4, color: colors.text },
  companionDesc: { ...typography.bodySmall, color: colors.textSecondary },
  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  achievementBadge: { alignItems: 'center', gap: 4, width: 80 },
  achievementIcon: { fontSize: 28 },
  achievementName: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  logoutBtn: { marginTop: spacing.sm },
});

export default ProfileScreen;
