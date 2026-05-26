import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { setupApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { colors, spacing, typography, radius } from '../../theme';
import Card from '../../components/common/Card';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { logout } = useAuth();
  const { showAlert } = useAlert();
  const [mindActive, setMindActive] = useState(true);
  const [togglingMind, setTogglingMind] = useState(false);

  const toggleMind = async (value: boolean) => {
    setTogglingMind(true);
    try {
      await setupApi.putMind({ isActive: value });
      setMindActive(value);
    } catch {
      showAlert('Error', 'Failed to update mind section.');
    } finally {
      setTogglingMind(false);
    }
  };

  const handleLogout = () => {
    showAlert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Sections */}
        <Card>
          <Text style={styles.cardTitle}>Sections</Text>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Mind Section</Text>
              <Text style={styles.settingDesc}>Track reading progress</Text>
            </View>
            <Switch
              value={mindActive}
              onValueChange={toggleMind}
              disabled={togglingMind}
              trackColor={{ false: colors.border, true: colors.mind + '88' }}
              thumbColor={mindActive ? colors.mind : colors.textMuted}
            />
          </View>
        </Card>

        {/* Account */}
        <Card>
          <Text style={styles.cardTitle}>Account</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => (navigation as any).navigate('Profile')}>
            <Text style={styles.menuItemText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => (navigation as any).navigate('Support')}>
            <Text style={styles.menuItemText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Danger zone */}
        <Card>
          <TouchableOpacity style={styles.dangerItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.dangerText}>Log Out</Text>
          </TouchableOpacity>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  title: { ...typography.h2, color: colors.text },
  content: { padding: spacing.lg, gap: spacing.md },
  cardTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.md },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { ...typography.body, color: colors.text },
  settingDesc: { ...typography.bodySmall, color: colors.textMuted },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  menuItemText: { ...typography.body, color: colors.text },
  dangerItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  dangerText: { ...typography.body, color: colors.error },
});

export default SettingsScreen;
