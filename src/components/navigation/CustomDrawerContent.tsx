import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { useAlert } from '../../context/AlertContext';

interface MenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: string;
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Pillars', icon: 'layers-outline', screen: 'Pillars' },
  { label: 'Achievements', icon: 'medal-outline', screen: 'Achievements' },
  { label: 'Support', icon: 'help-circle-outline', screen: 'Support' },
  { label: 'Point Rules', icon: 'star-outline', screen: 'PointRules' },
  { label: 'About', icon: 'information-circle-outline', screen: 'About' },
];

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const { logout, user } = useAuth();
  const { profile } = useUser();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const selectedAvatar = profile?.avatars?.find((a: any) => a.isSelected);
  const profileImageUrl = selectedAvatar?.profileImageUrl;

  const confirmLogout = () => {
    showAlert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const navigate = (screen: string) => {
    props.navigation.navigate(screen as never);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          {profileImageUrl ? (
            <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Ionicons name="person" size={24} color={colors.textMuted} />
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.username}>{profile?.username || user?.email?.split('@')[0] || 'User'}</Text>
          <Text style={styles.points}>{profile?.stats?.totalPoints || 0} pts</Text>
        </View>
        <TouchableOpacity onPress={() => props.navigation.closeDrawer()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Menu Items */}
      <ScrollView style={styles.menu} showsVerticalScrollIndicator={false}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.screen}
            style={styles.menuItem}
            onPress={() => navigate(item.screen)}
            activeOpacity={0.7}
          >
            <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#ffffff',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  headerInfo: { flex: 1 },
  username: { ...typography.h4, color: colors.text },
  points: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { padding: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  menu: { flex: 1, paddingTop: spacing.sm },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  menuLabel: { ...typography.body, color: colors.text, flex: 1 },
  chevron: { marginLeft: 'auto' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logoutText: { ...typography.body, color: colors.error },
});

export default CustomDrawerContent;
