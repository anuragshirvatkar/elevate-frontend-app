import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { profileApi } from '../../api';
import { colors, spacing, typography } from '../../theme';
import type { Achievement } from '../../types';

const IMAGE_ACHIEVEMENTS = ['Opened the Book', 'Thinking Begins', 'Strong Mind'];

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const AchievementsScreen = () => {
  const navigation = useNavigation();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profileApi.get().then(({ data }) => setAchievements(data.achievements)).finally(() => setLoading(false));
  }, []);

  const unlocked = achievements.filter((a) => a.isUnlocked);
  const sorted = [...unlocked, ...achievements.filter((a) => !a.isUnlocked)];

  const renderItem = ({ item: a, index }: { item: Achievement; index: number }) => (
    <View style={[styles.row, index < sorted.length - 1 && styles.rowBorder]}>
      <View style={[styles.iconWrap, !a.isUnlocked && styles.iconWrapLocked]}>
        {!a.isUnlocked ? (
          <Ionicons name="lock-closed" size={16} color="#444" />
        ) : a.iconUrl ? (
          <Image
            source={{ uri: a.iconUrl }}
            style={styles.iconImg}
            resizeMode="cover"
            tintColor={IMAGE_ACHIEVEMENTS.includes(a.name) ? undefined : '#ffffff'}
          />
        ) : (
          <Ionicons name="trophy" size={17} color="#fff" />
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, !a.isUnlocked && styles.nameLocked]}>{a.name}</Text>
        <Text style={styles.desc} numberOfLines={1}>{a.description}</Text>
        {a.isUnlocked && (
          <View style={styles.meta}>
            <Ionicons name="time-outline" size={10} color="#555" />
            <Text style={styles.metaText}>{fmtDate(a.unlockedAt)}</Text>
            {a.usersUnlockedCount !== undefined && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Ionicons name="people-outline" size={10} color="#555" />
                <Text style={styles.metaText}>{a.usersUnlockedCount.toLocaleString()} others</Text>
              </>
            )}
          </View>
        )}
      </View>

      {a.isUnlocked && <Ionicons name="checkmark-circle" size={18} color="#3DFF86" />}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={styles.title}>Achievements</Text>
        {!loading && (
          <Text style={styles.count}>{unlocked.length}/{achievements.length}</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator color={colors.text} /></View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  backBtn: { width: 36 },
  title: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16 },
  count: { ...typography.bodySmall, color: colors.textMuted, marginLeft: spacing.sm },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },

  iconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#222',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    flexShrink: 0,
  },
  iconWrapLocked: { backgroundColor: '#0d0d0d', borderColor: '#1a1a1a' },
  iconImg: { width: 42, height: 42, borderRadius: 21 },

  body: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.text, fontWeight: '600', fontSize: 14 },
  nameLocked: { color: '#444' },
  desc: { ...typography.bodySmall, color: colors.textMuted, fontSize: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  metaText: { color: '#555', fontSize: 10 },
  metaDot: { color: '#444', fontSize: 10 },
});

export default AchievementsScreen;
