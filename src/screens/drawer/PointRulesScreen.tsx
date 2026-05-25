import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '../../theme';
import BicepIcon from '../../../assets/bicep.svg';
import BrainIcon from '../../../assets/brain.svg';
import CraftIcon from '../../../assets/craft.svg';
import PurityIcon from '../../../assets/purity.svg';

interface Rule {
  label: string;
  points: string;
}

interface Section {
  key: string;
  label: string;
  Icon: React.ComponentType<any>;
  iconSize?: number;
  rules: Rule[];
}

const SECTIONS: Section[] = [
  {
    key: 'power',
    label: 'Power',
    Icon: BicepIcon,
    iconSize: 18,
    rules: [
      { label: 'Did activity', points: '+10' },
      { label: 'Has description', points: '+2' },
      { label: 'Rest day bonus', points: '+15' },
      { label: 'Did not do', points: '0' },
    ],
  },
  {
    key: 'mind',
    label: 'Mind',
    Icon: BrainIcon,
    rules: [
      { label: 'Did activity', points: '+10' },
      { label: 'Has description', points: '+2' },
      { label: 'Rest day bonus', points: '+15' },
      { label: 'Did not do', points: '0' },
    ],
  },
  {
    key: 'craft',
    label: 'Craft',
    Icon: CraftIcon,
    rules: [
      { label: 'Did activity', points: '+10' },
      { label: 'Extra hours (beyond 2)', points: '+2 / hr' },
      { label: 'Has description', points: '+2' },
      { label: 'Rest day bonus', points: '+15' },
      { label: 'Did not do', points: '0' },
    ],
  },
  {
    key: 'purity',
    label: 'Purity',
    Icon: PurityIcon,
    rules: [
      { label: 'Clean day (0 relapses)', points: '+10' },
      { label: '1 relapse', points: '−20' },
      { label: '2 relapses', points: '−40' },
      { label: '3 relapses', points: '−60' },
    ],
  },
];

const NOTES = [
  'Rest days are configured per section in your initial setup.',
  'Points are calculated per activity log entry.',
  'If a log is updated, points are recalculated and the delta is applied automatically.',
];

const getPointColor = (pts: string) => {
  if (pts.startsWith('+')) return colors.text;
  if (pts.startsWith('−') || pts.startsWith('-')) return '#FF4444';
  return colors.textMuted;
};

const PointRulesScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={styles.headerTitle}>Point Rules</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section, sIdx) => (
          <View key={section.key}>
            {/* Section label */}
            <View style={styles.sectionHeader}>
              <section.Icon
                width={section.iconSize ?? 16}
                height={section.iconSize ?? 16}
                fill="#fff"
                stroke="#fff"
                color="#fff"
              />
              <Text style={styles.sectionLabel}>{section.label}</Text>
            </View>

            {/* Rules */}
            {section.rules.map((rule, rIdx) => (
              <View
                key={rIdx}
                style={[
                  styles.ruleRow,
                  rIdx < section.rules.length - 1 && styles.ruleRowBorder,
                ]}
              >
                <Text style={styles.ruleLabel}>{rule.label}</Text>
                <Text style={[styles.rulePoints, { color: getPointColor(rule.points) }]}>
                  {rule.points} pts
                </Text>
              </View>
            ))}

            {sIdx < SECTIONS.length - 1 && <View style={styles.separator} />}
          </View>
        ))}

        {/* Notes */}
        <View style={styles.separator} />
        <Text style={styles.notesHeading}>Notes</Text>
        {NOTES.map((note, idx) => (
          <View key={idx} style={styles.noteRow}>
            <Text style={styles.noteBullet}>·</Text>
            <Text style={styles.noteText}>{note}</Text>
          </View>
        ))}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36 },
  headerTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },

  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  ruleRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  ruleLabel: {
    color: '#888',
    fontSize: 14,
    flex: 1,
  },
  rulePoints: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },

  separator: {
    height: 1,
    backgroundColor: '#1E1E1E',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },

  notesHeading: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  noteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 5,
  },
  noteBullet: { color: '#444', fontSize: 16, lineHeight: 20 },
  noteText: { color: '#555', fontSize: 13, flex: 1, lineHeight: 20 },
});

export default PointRulesScreen;
