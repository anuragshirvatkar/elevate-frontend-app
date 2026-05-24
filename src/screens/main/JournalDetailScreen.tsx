import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Image, PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { journalsApi, setupApi } from '../../api';
import { colors, spacing, typography, radius } from '../../theme';
import type { JournalEntry, CompanionDto } from '../../types';
import { format, parseISO } from 'date-fns';

type JournalDetailRouteParams = { entry?: JournalEntry };
type JournalDetailRouteProp = RouteProp<{ JournalDetail: JournalDetailRouteParams }, 'JournalDetail'>;
type Step = 'mood' | 'win' | 'lesson' | 'mission' | 'done';

const STEP_ORDER: Step[] = ['mood', 'win', 'lesson', 'mission', 'done'];
const MOOD_LABELS = ['', 'Very Low', 'Low', 'Neutral', 'Good', 'Excellent'];

const getCompanionColor = (name: string): string => {
  const colorMap: Record<string, string> = {
    'Captain Blackvein': '#3DFF86', 'Tharok Warborn': '#FFC857',
    'Arkan Veylor': '#FF5A5A', 'Seris Astraea': '#54A9FF',
    Monk: '#FFC857', Warrior: '#FF5A5A', Sage: '#54A9FF',
  };
  return colorMap[name] || '#3DFF86';
};

// ─── Shared sub-components (matching DailyLogModal) ──────────────────────────

const CompanionBubble: React.FC<{ companion: CompanionDto | null; children: React.ReactNode }> = ({ companion, children }) => (
  <View style={styles.companionSection}>
    <View style={styles.companionIconWrapper}>
      <View style={[
        styles.companionIcon,
        {
          borderColor: getCompanionColor(companion?.name || '') + '80',
          shadowColor: getCompanionColor(companion?.name || ''),
          shadowOpacity: 0.9, shadowRadius: 40,
          shadowOffset: { width: 0, height: 0 }, elevation: 40,
        },
      ]}>
        {companion?.image && (
          <Image source={{ uri: companion.image }} style={styles.companionImage} resizeMode="cover" />
        )}
      </View>
    </View>
    {children}
  </View>
);

const TweetSummary: React.FC<{
  companion: CompanionDto | null;
  name: string;
  subtitle?: string;
  status: string;
  onEdit?: () => void;
}> = ({ companion, name, subtitle, status, onEdit }) => (
  <TouchableOpacity activeOpacity={0.7} onPress={onEdit}>
    <View style={styles.tweet}>
      <View style={styles.tweetRow}>
        <View style={[styles.tweetAvatar, { borderColor: getCompanionColor(companion?.name || '') + '80' }]}>
          {companion?.image && (
            <Image source={{ uri: companion.image }} style={styles.tweetAvatarImg} resizeMode="cover" />
          )}
        </View>
        <View style={styles.tweetBody}>
          <View style={styles.tweetHeader}>
            <Text style={styles.tweetName}>{name}</Text>
            <Text style={styles.tweetEdit}>✎</Text>
          </View>
          <Text style={styles.tweetDetail}>{subtitle ? `${subtitle}  ·  ` : ''}{status}</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
);

// ─── Main screen ─────────────────────────────────────────────────────────────

const JournalDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<JournalDetailRouteProp>();
  const { entry } = route.params;
  const isEditMode = !!entry;

  const [selectedDate, setSelectedDate] = useState(() => entry?.date ? parseISO(entry.date) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [step, setStep] = useState<Step>('mood');
  const [mood, setMood] = useState(entry?.mood || 3);
  const [win, setWin] = useState(entry?.win_of_the_day || '');
  const [lesson, setLesson] = useState(entry?.lesson_learned || '');
  const [mission, setMission] = useState(entry?.tomorrow_mission || '');
  const [saving, setSaving] = useState(false);
  const [companion, setCompanion] = useState<CompanionDto | null>(null);
  const [loadingCompanion, setLoadingCompanion] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [sliderWidth, setSliderWidth] = useState(0);

  const lastMoodRef = useRef(mood);
  const handleSliderXRef = useRef<(x: number) => void>(() => {});
  handleSliderXRef.current = (x: number) => {
    if (sliderWidth === 0) return;
    const ratio = Math.max(0, Math.min(x / sliderWidth, 1));
    // Quantize ratio to reduce jitter near boundaries
    const snappedRatio = Math.round(ratio * 40) / 40;
    const newMood = Math.min(5, Math.max(1, Math.round(snappedRatio * 4) + 1));
    if (newMood !== lastMoodRef.current) {
      lastMoodRef.current = newMood;
      setMood(newMood);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const moodPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => handleSliderXRef.current(evt.nativeEvent.locationX),
      onPanResponderMove: evt => handleSliderXRef.current(evt.nativeEvent.locationX),
    })
  ).current;

  useEffect(() => {
    setupApi.getProgress()
      .then(r => setCompanion(r.data.selectedCompanion || null))
      .catch(() => {})
      .finally(() => setLoadingCompanion(false));

    if (isEditMode && entry) {
      const done = new Set<Step>();
      if (entry.mood) done.add('mood');
      if (entry.win_of_the_day) done.add('win');
      if (entry.lesson_learned) done.add('lesson');
      if (entry.tomorrow_mission) done.add('mission');
      setCompletedSteps(done);
      const firstIncomplete = STEP_ORDER.find(s => !done.has(s) && s !== 'done');
      if (firstIncomplete) setStep(firstIncomplete);
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await journalsApi.upsert({
        date: format(selectedDate, 'yyyy-MM-dd'),
        mood,
        win_of_the_day: win || undefined,
        lesson_learned: lesson || undefined,
        tomorrow_mission: mission || undefined,
      });
      navigation.goBack();
    } catch {}
    setSaving(false);
  };

  const goNext = () => {
    const idx = STEP_ORDER.indexOf(step);
    const next = STEP_ORDER[idx + 1];
    setCompletedSteps(prev => new Set([...prev, step]));
    if (next === 'done') handleSave();
    else setStep(next);
  };

  const handleEdit = (s: Step) => {
    setCompletedSteps(prev => { const n = new Set(prev); n.delete(s); return n; });
    setStep(s);
  };

  if (loadingCompanion) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingCenter}><ActivityIndicator color={colors.text} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Text style={styles.dateText}>
            {format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              ? 'Today'
              : format(selectedDate, 'dd MMM')}
          </Text>
          <Ionicons name="chevron-down" size={12} color="#888" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Completed step tweets */}
        {completedSteps.has('mood') && step !== 'mood' && (
          <TweetSummary companion={companion} name="Mood" subtitle="How are you feeling?"
            status={MOOD_LABELS[mood]} onEdit={() => handleEdit('mood')} />
        )}
        {completedSteps.has('win') && step !== 'win' && (
          <TweetSummary companion={companion} name="Win of the Day" subtitle="What went well?"
            status={win || '—'} onEdit={() => handleEdit('win')} />
        )}
        {completedSteps.has('lesson') && step !== 'lesson' && (
          <TweetSummary companion={companion} name="Lesson Learned" subtitle="What did you learn?"
            status={lesson || '—'} onEdit={() => handleEdit('lesson')} />
        )}
        {completedSteps.has('mission') && step !== 'mission' && (
          <TweetSummary companion={companion} name="Tomorrow's Mission" subtitle="What's the focus?"
            status={mission || '—'} onEdit={() => handleEdit('mission')} />
        )}

        {/* Mood step */}
        {step === 'mood' && (
          <CompanionBubble companion={companion}>
            <View style={styles.questionRow}>
              <Text style={styles.questionText}>How are you feeling today?</Text>
            </View>
            <View style={styles.moodSliderOuter}>
              <Text style={styles.moodSelectedLabel}>{MOOD_LABELS[mood]}</Text>
              <View
                style={styles.sliderHitArea}
                onLayout={e => setSliderWidth(e.nativeEvent.layout.width)}
                {...moodPanResponder.panHandlers}
              >
                {/* background track */}
                <View style={styles.sliderTrack} pointerEvents="none" />
                {/* filled track */}
                {sliderWidth > 0 && (
                  <View style={[styles.sliderFill, { width: ((mood - 1) / 4) * sliderWidth }]} pointerEvents="none" />
                )}
                {/* thumb */}
                {sliderWidth > 0 && (
                  <View style={[
                    styles.sliderThumb,
                    { left: ((mood - 1) / 4) * sliderWidth },
                  ]} pointerEvents="none" />
                )}
                {/* value dots */}
                {sliderWidth > 0 && [1, 2, 3, 4, 5].map(v => (
                  <View
                    key={v}
                    pointerEvents="none"
                    style={[
                      styles.sliderValueDot,
                      { left: ((v - 1) / 4) * sliderWidth },
                      v === mood && styles.sliderValueDotActive,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.moodLabels}>
                <Text style={styles.moodLabel}>Very Low</Text>
                <Text style={styles.moodLabel}>Excellent</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Next</Text>
            </TouchableOpacity>
          </CompanionBubble>
        )}

        {/* Win step */}
        {step === 'win' && (
          <CompanionBubble companion={companion}>
            <View style={styles.questionRow}>
              <Text style={styles.questionText}>What went well today?</Text>
            </View>
            <View style={styles.inputWrap}>
              <View style={styles.inputWithTick}>
                <TextInput
                  style={[styles.textInput, styles.textInputMultiline, styles.textInputPad]}
                  placeholder="Share your win..."
                  placeholderTextColor={colors.textMuted}
                  value={win}
                  onChangeText={setWin}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
                <TouchableOpacity style={styles.inputTickBtn} onPress={goNext}>
                  <Ionicons name="checkmark" size={22} color={colors.success} />
                </TouchableOpacity>
              </View>
            </View>
          </CompanionBubble>
        )}

        {/* Lesson step */}
        {step === 'lesson' && (
          <CompanionBubble companion={companion}>
            <View style={styles.questionRow}>
              <Text style={styles.questionText}>What did you learn today?</Text>
            </View>
            <View style={styles.inputWrap}>
              <View style={styles.inputWithTick}>
                <TextInput
                  style={[styles.textInput, styles.textInputMultiline, styles.textInputPad]}
                  placeholder="Share your lesson..."
                  placeholderTextColor={colors.textMuted}
                  value={lesson}
                  onChangeText={setLesson}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
                <TouchableOpacity style={styles.inputTickBtn} onPress={goNext}>
                  <Ionicons name="checkmark" size={22} color={colors.success} />
                </TouchableOpacity>
              </View>
            </View>
          </CompanionBubble>
        )}

        {/* Mission step */}
        {step === 'mission' && (
          <CompanionBubble companion={companion}>
            <View style={styles.questionRow}>
              <Text style={styles.questionText}>What will you focus on tomorrow?</Text>
            </View>
            <View style={styles.inputWrap}>
              <View style={styles.inputWithTick}>
                <TextInput
                  style={[styles.textInput, styles.textInputMultiline, styles.textInputPad]}
                  placeholder="Set your mission..."
                  placeholderTextColor={colors.textMuted}
                  value={mission}
                  onChangeText={setMission}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
                <TouchableOpacity style={styles.inputTickBtn} onPress={goNext}>
                  <Ionicons name="checkmark" size={22} color={colors.success} />
                </TouchableOpacity>
              </View>
            </View>
          </CompanionBubble>
        )}

        {saving && (
          <View style={styles.savingRow}>
            <ActivityIndicator color={colors.text} size="small" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (event.type === 'set' && date) setSelectedDate(date);
          }}
        />
      )}
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
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 60, justifyContent: 'flex-end' },
  dateText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.xl },

  // Companion (matching DailyLogModal exactly)
  companionSection: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md, gap: spacing.sm },
  companionIconWrapper: { alignItems: 'center', marginBottom: spacing.xs },
  companionIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.cardElevated, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  companionImage: { width: '100%', height: '100%' },

  // Question row (matching DailyLogModal)
  questionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  questionText: { ...typography.body, color: colors.text, fontSize: 16 },

  // Tweet summary (matching DailyLogModal)
  tweet: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md },
  tweetRow: { flexDirection: 'row', gap: spacing.md },
  tweetAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, overflow: 'hidden' },
  tweetAvatarImg: { width: '100%', height: '100%' },
  tweetBody: { flex: 1, gap: 2 },
  tweetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tweetName: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 15 },
  tweetEdit: { fontSize: 14, color: colors.textMuted, marginLeft: 'auto' },
  tweetDetail: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },

  // Mood slider
  moodSliderOuter: { width: '100%', marginTop: spacing.sm, gap: spacing.xs },
  moodSelectedLabel: { ...typography.body, color: colors.text, fontWeight: '600', fontSize: 15, textAlign: 'center' },
  sliderHitArea: {
    width: '100%', height: 44,
    justifyContent: 'center', position: 'relative',
  },
  sliderTrack: {
    position: 'absolute', left: 0, right: 0, top: 21,
    height: 2, backgroundColor: '#2a2a2a', borderRadius: 1,
  },
  sliderFill: {
    position: 'absolute', left: 0, top: 21,
    height: 2, backgroundColor: colors.text, borderRadius: 1,
  },
  sliderThumb: {
    position: 'absolute', top: 11,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.text,
    transform: [{ translateX: -11 }],
    shadowColor: colors.text, shadowOpacity: 0.5,
    shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  sliderValueDot: {
    position: 'absolute', top: 19,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.text,
    transform: [{ translateX: -3 }],
  },
  sliderValueDotActive: {
    width: 10, height: 10, borderRadius: 5,
    top: 17,
    transform: [{ translateX: -5 }],
  },
  moodLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  moodLabel: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  nextBtn: {
    marginTop: spacing.xs, backgroundColor: colors.text,
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 40, alignItems: 'center',
  },
  nextBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },

  // Input (matching DailyLogModal)
  inputWrap: { width: '100%', marginTop: spacing.xs },
  inputWithTick: { position: 'relative' },
  textInput: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.background,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.inputBorder,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, minHeight: 40,
  },
  textInputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  textInputPad: { paddingRight: 48 },
  inputTickBtn: { position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },

  savingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  savingText: { ...typography.bodySmall, color: colors.textMuted },
});

export default JournalDetailScreen;
