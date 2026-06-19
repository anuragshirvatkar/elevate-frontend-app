import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Modal,
} from 'react-native';
import { colors, spacing, typography, radius } from '../../theme';
import type { CompanionDto } from '../../types';

const getCompanionColor = (name: string): string => {
  const colorMap: Record<string, string> = {
    'Captain Blackvein': '#3DFF86', 'Arkan Veylor': '#FF5A5A',
    'Zedra Morvain': '#C77DFF', 'Tharok Warborn': '#FFC857', 'Seris Astraea': '#54A9FF',
    Monk: '#FFC857', Warrior: '#FF5A5A', Sage: '#54A9FF',
  };
  return colorMap[name] || '#3DFF86';
};

export const COMPANION_GAIN_MSGS = [
  (n: string) => `${n} is proud of you. Keep showing up.`,
  (n: string) => `${n} is impressed. Keep the streak alive.`,
  (n: string) => `${n} sees your dedication. Don't stop now.`,
  (n: string) => `${n} nods in approval. You're building real momentum.`,
  (n: string) => `${n} smiles. This is what greatness looks like.`,
  (n: string) => `${n} is watching. You're making them proud.`,
];

export const COMPANION_LOSS_MSGS = [
  (n: string) => `${n} believes you can bounce back. Stay strong.`,
  (n: string) => `${n} hasn't given up on you. Get back up.`,
  (n: string) => `${n} says: every warrior falls. Rise again.`,
  (n: string) => `${n} reminds you — one slip doesn't define you.`,
];

interface CompanionPointsPopupProps {
  visible: boolean;
  points: number;
  companion: CompanionDto | null;
  subtitle: string;
  onContinue: () => void;
  /** Use overlay when already inside another Modal (e.g. DailyLogModal). */
  presentation?: 'modal' | 'overlay';
}

export const CompanionPointsPopup: React.FC<CompanionPointsPopupProps> = ({
  visible,
  points,
  companion,
  subtitle,
  onContinue,
  presentation = 'modal',
}) => {
  if (!visible) return null;

  const isGain = points >= 0;
  const badgeColor = isGain ? colors.success : colors.error;
  const title = points > 0 ? 'Points earned!' : points < 0 ? 'Points lost' : 'Activity logged!';

  const content = (
    <View style={[styles.pointsOverlay, presentation === 'overlay' && styles.pointsOverlayEmbedded]}>
      <View style={styles.pointsCard}>
        <View style={[
          styles.pointsCompanionRing,
          { borderColor: getCompanionColor(companion?.name || '') + '99' },
        ]}>
          {companion?.image && (
            <Image source={{ uri: companion.image }} style={styles.pointsCompanionImg} resizeMode="cover" />
          )}
        </View>
        <Text style={[styles.pointsBadge, { color: badgeColor }]}>
          {isGain ? '+' : ''}{points} pts
        </Text>
        <Text style={styles.pointsTitle}>{title}</Text>
        <Text style={styles.pointsSubtitle}>{subtitle}</Text>
        <TouchableOpacity style={styles.pointsContinueBtn} onPress={onContinue} activeOpacity={0.85}>
          <Text style={styles.pointsContinueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (presentation === 'overlay') return content;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  pointsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pointsOverlayEmbedded: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  pointsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    gap: spacing.sm,
  },
  pointsCompanionRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  pointsCompanionImg: { width: '100%', height: '100%' },
  pointsBadge: { fontSize: 32, fontWeight: '800' },
  pointsTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  pointsSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  pointsContinueBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  pointsContinueBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },
});
