import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, PanResponder, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { journalsApi, setupApi } from '../../api';
import { colors, spacing, typography, radius } from '../../theme';
import type { JournalEntry, CompanionDto } from '../../types';
import { format, parseISO } from 'date-fns';
import { playPopUpSound } from '../../utils/playSound';
import { CompanionPointsPopup, COMPANION_GAIN_MSGS } from '../../components/common/CompanionPointsPopup';

type JournalDetailRouteParams = { entry?: JournalEntry; isNewEntry?: boolean };
type JournalDetailRouteProp = RouteProp<{ JournalDetail: JournalDetailRouteParams }, 'JournalDetail'>;
type EditSection = 'mood' | 'win' | 'lesson' | 'mission' | null;
type Step = 'mood' | 'win' | 'lesson' | 'mission' | 'done';

const MOOD_LABELS = ['', 'Very Low', 'Low', 'Neutral', 'Good', 'Excellent'];

const getCompanionColor = (name: string): string => {
  const colorMap: Record<string, string> = {
    'Captain Blackvein': '#3DFF86', 'Arkan Veylor': '#FF5A5A',
    'Zedra Morvain': '#C77DFF', 'Tharok Warborn': '#FFC857', 'Seris Astraea': '#54A9FF',
    Monk: '#FFC857', Warrior: '#FF5A5A', Sage: '#54A9FF',
  };
  return colorMap[name] || '#3DFF86';
};

// ─── Main screen ─────────────────────────────────────────────────────────────

const STEP_ORDER: Step[] = ['mood', 'win', 'lesson', 'mission', 'done'];

// Tweet Summary Component - for completed answers (like DailyLogModal)
interface TweetSummaryProps {
  companion: CompanionDto | null;
  name: string;
  subtitle?: string;
  status: string;
  onEdit?: () => void;
}

const TweetSummary = ({ companion, name, subtitle, status, onEdit }: TweetSummaryProps) => (
  <TouchableOpacity style={styles.tweet} onPress={onEdit} activeOpacity={0.7}>
    <View style={styles.tweetRow}>
      <View style={[styles.tweetAvatar, { borderColor: getCompanionColor(companion?.name || '') + '80' }]}>
        {companion?.image && (
          <Image source={{ uri: companion.image }} style={styles.tweetAvatarImg} resizeMode="cover" />
        )}
      </View>
      <View style={styles.tweetBody}>
        <View style={styles.tweetHeader}>
          <Text style={styles.tweetName}>{name}</Text>
          {onEdit && <Text style={styles.tweetEdit}>✎</Text>}
        </View>
        <Text style={styles.tweetDetail}>
          {subtitle ? `${subtitle}  ·  ` : ''}{status}
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

// Icon Row - for view/edit mode rows with Ionicons (matching record card)
const ICON_ROW_CONFIG: Record<string, { icon: string; color: string }> = {
  mood:    { icon: 'happy-outline',  color: '#ffffff' },
  win:     { icon: 'trophy',         color: '#ffffff' },
  lesson:  { icon: 'book',           color: '#ffffff' },
  mission: { icon: 'flag',           color: '#ffffff' },
};

interface IconRowProps {
  iconKey: 'mood' | 'win' | 'lesson' | 'mission';
  name: string;
  subtitle: string;
  status: string;
  onEdit?: () => void;
}

const IconRow = ({ iconKey, name, subtitle, status, onEdit }: IconRowProps) => {
  const { icon, color } = ICON_ROW_CONFIG[iconKey];
  return (
    <TouchableOpacity style={styles.tweet} onPress={onEdit} activeOpacity={0.7}>
      <View style={styles.tweetRow}>
        <View style={styles.iconRowAvatar}>
          <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <View style={styles.tweetBody}>
          <View style={styles.tweetHeader}>
            <Text style={styles.tweetName}>{name}</Text>
            {onEdit && <Text style={styles.tweetEdit}>✎</Text>}
          </View>
          <Text style={styles.tweetDetail}>
            {subtitle ? `${subtitle}  ·  ` : ''}{status}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Companion Bubble Component - for current question
interface CompanionBubbleProps {
  companion: CompanionDto | null;
  children: React.ReactNode;
}

const CompanionBubble = ({ companion, children }: CompanionBubbleProps) => (
  <View style={styles.companionSection}>
    <View style={styles.companionIconWrapper}>
      <View style={[
        styles.companionIcon,
        {
          borderColor: getCompanionColor(companion?.name || '') + '80',
          shadowColor: getCompanionColor(companion?.name || ''),
          shadowOpacity: 0.9,
          shadowRadius: 40,
          shadowOffset: { width: 0, height: 0 },
          elevation: 40,
        },
      ]}>
        {companion?.image && (
          <Image source={{ uri: companion.image }} style={styles.companionImage} resizeMode="cover" />
        )}
      </View>
    </View>
    <View style={styles.bubble}>
      {children}
    </View>
  </View>
);

const JournalDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<JournalDetailRouteProp>();
  const { entry, isNewEntry } = route.params || {};
  const isExistingEntry = !!entry;
  const isNewEntryMode = isNewEntry || false;

  const [selectedDate, setSelectedDate] = useState(entry?.date || format(new Date(), 'yyyy-MM-dd'));

  // Update selectedDate when entry changes (navigation to different record)
  useEffect(() => {
    if (entry?.date) {
      setSelectedDate(entry.date);
    }
  }, [entry?.date]);
  const [mood, setMood] = useState(entry?.mood || 3);
  const [win, setWin] = useState(entry?.win_of_the_day || '');
  const [lesson, setLesson] = useState(entry?.lesson_learned || '');
  const [mission, setMission] = useState(entry?.tomorrow_mission || '');
  const [saving, setSaving] = useState(false);
  const [companion, setCompanion] = useState<CompanionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      return () => setPointsEarned(null);
    }, [])
  );
  const [sliderWidth, setSliderWidth] = useState(0);

  // View/Edit mode states (for existing entries)
  const [editSection, setEditSection] = useState<EditSection>(null);

  useEffect(() => {
    if (editSection !== null) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [editSection]);

  // New entry mode states (step-by-step)
  const [step, setStep] = useState<Step>('mood');
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());

  const scrollViewRef = useRef<ScrollView>(null);
  const lastMoodRef = useRef(mood);
  const handleSliderXRef = useRef<(x: number) => void>(() => { });
  handleSliderXRef.current = (x: number) => {
    if (sliderWidth === 0) return;
    const ratio = Math.max(0, Math.min(x / sliderWidth, 1));
    const snappedRatio = Math.round(ratio * 40) / 40;
    const newMood = Math.min(5, Math.max(1, Math.round(snappedRatio * 4) + 1));
    if (newMood !== lastMoodRef.current) {
      lastMoodRef.current = newMood;
      setMood(newMood);
      Haptics.selectionAsync().catch(() => { });
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

  // Load companion
  useEffect(() => {
    const loadData = async () => {
      try {
        const progressRes = await setupApi.getProgress();
        setCompanion(progressRes.data.selectedCompanion || null);
      } catch {
        // Ignore errors
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);


  const handleSave = async () => {
    setSaving(true);
    try {
      await journalsApi.upsert({
        date: selectedDate,
        mood,
        win_of_the_day: win || undefined,
        lesson_learned: lesson || undefined,
        tomorrow_mission: mission || undefined,
      });
      // After save, close edit section and stay in view mode
      setEditSection(null);
    } catch { }
    setSaving(false);
  };

  const handleEditClose = () => {
    setEditSection(null);
  };

  const openEditSection = (section: EditSection) => {
    setEditSection(section);
  };

  // Step navigation for new entry mode
  const goNext = () => {
    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex < STEP_ORDER.length - 1) {
      setCompletedSteps(prev => new Set([...prev, step]));
      setStep(STEP_ORDER[currentIndex + 1]);
    }
  };

  const handleNewEntrySave = async () => {
    setSaving(true);
    try {
      const { data } = await journalsApi.upsert({
        date: selectedDate,
        mood,
        win_of_the_day: win || undefined,
        lesson_learned: lesson || undefined,
        tomorrow_mission: mission || undefined,
      });
      if (data.pointsEarned && data.pointsEarned > 0) {
        setPointsEarned(data.pointsEarned);
        playPopUpSound();
      } else {
        navigation.goBack();
      }
    } catch {
      navigation.goBack();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerDateText}>Loading...</Text>
        </View>
        <View style={styles.loadingCenter}><ActivityIndicator color={colors.text} /></View>
      </SafeAreaView>
    );
  }

  // Render a view row using SVG icon
  const renderViewRow = (label: string, value: string, section: EditSection, iconKey: 'mood' | 'win' | 'lesson' | 'mission', subtitle: string) => (
    <IconRow
      iconKey={iconKey}
      name={label}
      subtitle={subtitle}
      status={value || '—'}
      onEdit={() => openEditSection(section)}
    />
  );

  // Render mood edit section (collapsible)
  const renderMoodEdit = () => {
    if (editSection !== 'mood') return null;
    return (
      <View style={styles.editSection}>
        <View style={styles.editSectionHeader}>
          <Text style={styles.editSectionTitle}>How are you feeling?</Text>
          <TouchableOpacity onPress={handleEditClose}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <View style={styles.moodSliderOuter}>
          <Text style={styles.moodSelectedLabel}>{MOOD_LABELS[mood]}</Text>
          <View
            style={styles.sliderHitArea}
            onLayout={e => setSliderWidth(e.nativeEvent.layout.width)}
            {...moodPanResponder.panHandlers}
          >
            <View style={styles.sliderTrack} pointerEvents="none" />
            {sliderWidth > 0 && (
              <View style={[styles.sliderFill, { width: ((mood - 1) / 4) * sliderWidth }]} pointerEvents="none" />
            )}
            {sliderWidth > 0 && (
              <View style={[styles.sliderThumb, { left: ((mood - 1) / 4) * sliderWidth }]} pointerEvents="none" />
            )}
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
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render text input edit section (collapsible)
  const renderTextEdit = (section: EditSection, title: string, value: string, setter: (v: string) => void, placeholder: string) => {
    if (editSection !== section) return null;
    return (
      <View style={styles.editSection}>
        <View style={styles.editSectionHeader}>
          <Text style={styles.editSectionTitle}>{title}</Text>
          <TouchableOpacity onPress={handleEditClose}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <TextInput
          style={[styles.textInput, styles.textInputMultiline]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={setter}
          multiline
          autoFocus
          textAlignVertical="top"
        />
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Format date for header display
  const formatHeaderDate = (dateStr: string) => {
    if (isNewEntryMode) return 'New Entry';

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    if (dateStr === todayStr) {
      return 'Your journaling for Today';
    }

    // Split manually — avoid timezone issues entirely
    const [year, month, day] = dateStr.split('-').map(Number);

    const localDate = new Date(year, month - 1, day);

    return `Your journaling for ${format(localDate, 'do MMM')}`;
  };

  // NEW ENTRY MODE: Step-by-step flow with companion
  const renderNewEntryContent = () => (
    <>
      {/* Completed step summaries - Tweet style like DailyLogModal */}
      {completedSteps.has('mood') && step !== 'mood' && (
        <TweetSummary
          companion={companion}
          name="Mood"
          subtitle="How are you feeling?"
          status={MOOD_LABELS[mood]}
          onEdit={() => setStep('mood')}
        />
      )}
      {completedSteps.has('win') && step !== 'win' && (
        <TweetSummary
          companion={companion}
          name="Win of the Day"
          subtitle="What went well?"
          status={win || '—'}
          onEdit={() => setStep('win')}
        />
      )}
      {completedSteps.has('lesson') && step !== 'lesson' && (
        <TweetSummary
          companion={companion}
          name="Lesson Learned"
          subtitle="What did you learn?"
          status={lesson || '—'}
          onEdit={() => setStep('lesson')}
        />
      )}
      {completedSteps.has('mission') && step !== 'mission' && (
        <TweetSummary
          companion={companion}
          name="Tomorrow's Mission"
          subtitle="What's the focus?"
          status={mission || '—'}
          onEdit={() => setStep('mission')}
        />
      )}

      {/* Current step */}
      {step === 'mood' && (
        <CompanionBubble companion={companion}>
          <Text style={styles.questionText}>How are you feeling today?</Text>
          <View style={styles.moodSliderOuter}>
            <Text style={styles.moodSelectedLabel}>{MOOD_LABELS[mood]}</Text>
            <View
              style={styles.sliderHitArea}
              onLayout={e => setSliderWidth(e.nativeEvent.layout.width)}
              {...moodPanResponder.panHandlers}
            >
              <View style={styles.sliderTrack} pointerEvents="none" />
              {sliderWidth > 0 && (
                <View style={[styles.sliderFill, { width: ((mood - 1) / 4) * sliderWidth }]} pointerEvents="none" />
              )}
              {sliderWidth > 0 && (
                <View style={[styles.sliderThumb, { left: ((mood - 1) / 4) * sliderWidth }]} pointerEvents="none" />
              )}
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

      {step === 'win' && (
        <CompanionBubble companion={companion}>
          <Text style={styles.questionText}>What went well today?</Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline]}
            placeholder="Share your win..."
            placeholderTextColor={colors.textMuted}
            value={win}
            onChangeText={setWin}
            multiline
            autoFocus
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Next</Text>
          </TouchableOpacity>
        </CompanionBubble>
      )}

      {step === 'lesson' && (
        <CompanionBubble companion={companion}>
          <Text style={styles.questionText}>What did you learn today?</Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline]}
            placeholder="Share your lesson..."
            placeholderTextColor={colors.textMuted}
            value={lesson}
            onChangeText={setLesson}
            multiline
            autoFocus
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Next</Text>
          </TouchableOpacity>
        </CompanionBubble>
      )}

      {step === 'mission' && (
        <CompanionBubble companion={companion}>
          <Text style={styles.questionText}>What will you focus on tomorrow?</Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline]}
            placeholder="Set your mission..."
            placeholderTextColor={colors.textMuted}
            value={mission}
            onChangeText={setMission}
            multiline
            autoFocus
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.saveBtn} onPress={handleNewEntrySave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Entry'}</Text>
          </TouchableOpacity>
        </CompanionBubble>
      )}
    </>
  );

  // EDIT MODE: View existing entry with collapsible edit sections
  const renderEditContent = () => (
    <>
      {/* View Mode: Display all values - tapping any row opens edit */}
      {renderViewRow('Mood', MOOD_LABELS[mood], 'mood', 'mood', 'How are you feeling?')}
      {renderViewRow('Win of the Day', win, 'win', 'win', 'What went well?')}
      {renderViewRow('Lesson Learned', lesson, 'lesson', 'lesson', 'What did you learn?')}
      {renderViewRow("Tomorrow's Mission", mission, 'mission', 'mission', "What's the focus?")}

      {/* Edit Sections - Collapsible, user opens what they want to edit */}
      {renderMoodEdit()}
      {renderTextEdit('win', 'What went well today?', win, setWin, 'Share your win...')}
      {renderTextEdit('lesson', 'What did you learn today?', lesson, setLesson, 'Share your lesson...')}
      {renderTextEdit('mission', 'What will you focus on tomorrow?', mission, setMission, 'Set your mission...')}
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <CompanionPointsPopup
        visible={pointsEarned !== null}
        points={pointsEarned ?? 0}
        companion={companion}
        subtitle={COMPANION_GAIN_MSGS[0](companion?.name ?? 'Your companion')}
        onContinue={() => {
          setPointsEarned(null);
          navigation.goBack();
        }}
      />

      {/* Header: Back left, Date text right */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerDateText}>{formatHeaderDate(selectedDate)}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView ref={scrollViewRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {isNewEntryMode ? renderNewEntryContent() : renderEditContent()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header with date text and edit button
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBack: { width: 36 },
  headerDateText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },

  // Scroll content
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.xl },

  // Edit section (collapsible)
  editSection: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  editSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  editSectionTitle: { ...typography.body, color: colors.text, fontWeight: '600' },

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

  // Input
  textInput: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.background,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.inputBorder,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 40,
  },
  textInputMultiline: { minHeight: 100, textAlignVertical: 'top' },

  // Save button
  saveBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  saveBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },

  // Tweet Summary (like DailyLogModal)
  tweet: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md },
  tweetRow: { flexDirection: 'row', gap: spacing.md },
  tweetAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, overflow: 'hidden' },
  tweetAvatarImg: { width: '100%', height: '100%' },
  iconRowAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  tweetBody: { flex: 1, gap: 2 },
  tweetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tweetName: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 15 },
  tweetEdit: { fontSize: 14, color: colors.textMuted, marginLeft: 'auto' },
  tweetDetail: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },

  // New Entry Mode - Companion
  companionSection: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  companionIconWrapper: { alignItems: 'center', marginBottom: spacing.sm },
  companionIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.cardElevated, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  companionImage: { width: '100%', height: '100%' },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
  },
  questionText: { ...typography.body, color: colors.text, fontWeight: '600', marginBottom: spacing.md },

  // New Entry Mode - Next button
  nextBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  nextBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },
});

export default JournalDetailScreen;
