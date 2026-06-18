import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingStackScreenProps } from '../../navigation/types';
import { setupApi } from '../../api';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';

type Gender = 'male' | 'female';

const GenderSelectScreen: React.FC<OnboardingStackScreenProps<'GenderSelect'>> = ({
  navigation,
}) => {
  const [selected, setSelected] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setupApi.getProgress().then(({ data }) => {
      if (data.gender) {
        // Already set — skip ahead
        navigation.navigate('SetupPower');
        return;
      }
      setChecking(false);
    }).catch(() => setChecking(false));
  }, []);

  const handleSelect = (gender: Gender) => {
    setSelected(gender);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await setupApi.saveProgress({ gender: selected });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('SetupPower');
    } catch {
      Alert.alert('Error', 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (checking) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('DOBSelect')}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.progressRing}>
            <Svg width={40} height={40} viewBox="0 0 40 40">
              <Circle
                cx={20}
                cy={20}
                r={16}
                stroke={colors.border}
                strokeWidth={3}
                fill="none"
              />
              <Circle
                cx={20}
                cy={20}
                r={16}
                stroke={colors.text}
                strokeWidth={3}
                fill="none"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 * (1 - 3 / 6)}
                strokeLinecap="round"
                rotation="-90"
                origin="20, 20"
              />
            </Svg>
            <Text style={styles.stepText}>3/6</Text>
          </View>
        </View>

        <Text style={styles.title}>What's your{'\n'}gender?</Text>
        <Text style={styles.subtitle}>
          This helps personalize your experience.
        </Text>

        {/* Gender cards */}
        <View style={styles.cardsRow}>
          <TouchableOpacity
            style={[styles.card, selected === 'male' && styles.cardSelected]}
            onPress={() => handleSelect('male')}
            activeOpacity={0.8}
          >
            <Text style={styles.cardEmoji}>♂</Text>
            <Text style={[styles.cardLabel, selected === 'male' && styles.cardLabelSelected]}>
              Male
            </Text>
            {selected === 'male' && <View style={styles.cardCheckmark}><Text style={styles.checkmarkText}>✓</Text></View>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, selected === 'female' && styles.cardSelected]}
            onPress={() => handleSelect('female')}
            activeOpacity={0.8}
          >
            <Text style={styles.cardEmoji}>♀</Text>
            <Text style={[styles.cardLabel, selected === 'female' && styles.cardLabelSelected]}>
              Female
            </Text>
            {selected === 'female' && <View style={styles.cardCheckmark}><Text style={styles.checkmarkText}>✓</Text></View>}
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />

        <Button
          title="Continue"
          onPress={handleContinue}
          loading={saving}
          disabled={!selected}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  progressRing: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    ...typography.label,
    color: colors.text,
    fontSize: 11,
    position: 'absolute',
  },
  title: { ...typography.h1, color: '#fff', fontSize: 34, marginTop: 8 },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    marginTop: 10,
    lineHeight: 22,
    marginBottom: 48,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  card: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#222',
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    position: 'relative',
  },
  cardSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: '#111',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  cardEmoji: {
    fontSize: 40,
    color: '#fff',
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  cardLabelSelected: {
    color: '#fff',
  },
  cardCheckmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  spacer: { flex: 1 },
});

export default GenderSelectScreen;
