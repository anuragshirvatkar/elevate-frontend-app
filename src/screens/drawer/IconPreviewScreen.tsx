import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../../theme';

const appLogo = require('../../../assets/elevate-logo.png');

const IconPreviewScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={styles.headerTitle}>Icon Preview</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Full brand logo */}
        <Image source={appLogo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.caption}>assets/elevate-logo.png</Text>

        {/* Notification icon — uses elevate-logo.png */}
        <Text style={styles.sectionLabel}>Notification icon</Text>
        <View style={styles.badge}>
          <Image source={appLogo} style={styles.badgeImg} resizeMode="contain" />
        </View>

        <Text style={styles.note}>
          The notification icon now uses assets/elevate-logo.png.
        </Text>
      </ScrollView>
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

  content: { padding: spacing.lg, alignItems: 'center', gap: spacing.md },
  logo: {
    width: 200, height: 200,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  caption: { ...typography.bodySmall, color: colors.textMuted },

  sectionLabel: {
    ...typography.label, color: colors.textSecondary,
    alignSelf: 'flex-start', marginTop: spacing.xl, marginBottom: spacing.xs,
  },
  badge: {
    width: 160, aspectRatio: 1, borderRadius: radius.lg,
    backgroundColor: '#000000',
    alignItems: 'center', justifyContent: 'center',
  },
  badgeImg: { width: '70%', height: '70%' },

  note: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.lg, lineHeight: 18 },
});

export default IconPreviewScreen;
