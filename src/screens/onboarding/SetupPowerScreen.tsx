import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Alert, Image, Modal, TextInput, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingStackScreenProps } from '../../navigation/types';
import { setupApi, activitiesApi } from '../../api';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';
import type { ActivityDto, CompanionDto } from '../../types';
import BicepIcon from '../../../assets/bicep.svg';

const POWER_INTRO_SEEN_KEY = 'onboarding_power_intro_seen';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const QUESTIONS = [
  "What workout do you prefer?",
  "Which days do you want to rest?",
  "When do you prefer to workout?",
];

const SUBTITLES = [
  "Pick your power activities to track.",
  "Rest days help prevent burnout.",
  "Choose your preferred time.",
];

function toTimeString(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

function formatTimeDisplay(timeStr: string): string {
  if (!timeStr) return 'Select time';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const ACTIVITY_ICONS: Record<string, string> = {
  'gym': '💪',
  'workout': '💪',
  'exercise': '💪',
  'running': '🏃',
  'run': '🏃',
  'swimming': '🏊',
  'swim': '🏊',
  'cycling': '🚴',
  'cycle': '🚴',
  'yoga': '🧘',
  'meditation': '🧘',
  'martial arts': '🥋',
  'boxing': '🥊',
  'sports': '⚽',
  'hiking': '🥾',
  'calisthenics': '🤸',
  'calisthenic': '🤸',
  'stretching': '🙆',
  'default': '⚡',
};

const getCompanionColor = (name: string): string => {
  const colorMap: { [key: string]: string } = {
    'Captain Blackvein': '#3DFF86',
    'Tharok Warborn': '#FFC857',
    'Arkan Veylor': '#FF5A5A',
    'Seris Astraea': '#54A9FF',
    Monk: '#FFC857',
    Warrior: '#FF5A5A',
    Sage: '#54A9FF',
  };
  return colorMap[name] || '#3DFF86';
};

function getActivityIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const key of Object.keys(ACTIVITY_ICONS)) {
    if (lower.includes(key)) return ACTIVITY_ICONS[key];
  }
  return ACTIVITY_ICONS.default;
}

const SetupPowerScreen: React.FC<OnboardingStackScreenProps<'SetupPower'>> = ({ navigation }) => {
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [restDays, setRestDays] = useState<string[]>(['Sat', 'Sun']);
  const [step, setStep] = useState(0);
  const [preferredTime, setPreferredTime] = useState<string>('');
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timeDate, setTimeDate] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [companion, setCompanion] = useState<CompanionDto | null>(null);
  const [screenLoading, setScreenLoading] = useState(true);
  const [animatedQuestion, setAnimatedQuestion] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCreating, setCustomCreating] = useState(false);
  const [powerIntroVisible, setPowerIntroVisible] = useState(false);
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  const subtitleSlide = textAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] });
  const summarySlide = textAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  useEffect(() => {
    const loadData = async () => {
      try {
        setScreenLoading(true);

        const [{ data: optionsData }, { data: progressData }] =
          await Promise.all([
            setupApi.getOptions(),
            setupApi.getProgress(),
          ]);

        setActivities(optionsData.activities.power);

        setCompanion(progressData.selectedCompanion || null);

        const power = progressData.sections?.power;

        if (power?.activities?.length) {
          setSelectedActivities(
            power.activities.map((a: any) => a.id)
          );
        }

        if (power?.restDays?.length) {
          setRestDays(
            power.restDays.map(
              (d: string) => REVERSE_DAY_MAP[d] || d
            )
          );
        } else {
          setRestDays([]);
        }

        if (power?.preferredTime) {
          setPreferredTime(power.preferredTime);

          const [h, m] = power.preferredTime
            .split(':')
            .map(Number);

          const d = new Date();
          d.setHours(h, m, 0, 0);

          setTimeDate(d);
        }

        const hasSavedActivities = (power?.activities?.length ?? 0) > 0;
        if (hasSavedActivities) {
          setStep(2);
          setPowerIntroVisible(false);
        } else {
          const introSeen = await AsyncStorage.getItem(POWER_INTRO_SEEN_KEY);
          setPowerIntroVisible(introSeen !== 'true');
        }

      } catch (err) {
        console.log(err);
      } finally {
        setScreenLoading(false);
        animateIn();
      }
    };

    loadData();
  }, []);

  const dismissPowerIntro = useCallback(async () => {
    await AsyncStorage.setItem(POWER_INTRO_SEEN_KEY, 'true');
    setPowerIntroVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  useEffect(() => {
    animateIn();
  }, [step]);

  // Animate loading spinner
  useEffect(() => {
    if (screenLoading) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [screenLoading]);

  // Typewriter effect for question
  useEffect(() => {
    let currentIndex = 0;
    setAnimatedQuestion('');

    const text = QUESTIONS[step];

    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setAnimatedQuestion(text.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [step]);

  const animateIn = () => {
    bubbleAnim.setValue(0);
    textAnim.setValue(0);
    Animated.parallel([
      Animated.spring(bubbleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(textAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const COMMON_ORDER = [
    'gym',
    'calisthenics',
    'running',
    'yoga',
    'badminton',
  ];

  const sortedActivities = [...activities].sort((a, b) => {
    const aIndex = COMMON_ORDER.findIndex(x =>
      a.name.toLowerCase().includes(x)
    );
    const bIndex = COMMON_ORDER.findIndex(x =>
      b.name.toLowerCase().includes(x)
    );
    return (
      (aIndex === -1 ? 999 : aIndex) -
      (bIndex === -1 ? 999 : bIndex)
    );
  });

  const displayedActivities = sortedActivities.slice(0, 5);
  const hiddenActivities = sortedActivities.slice(5);

  const toggleActivity = (id: string) => {
    setSelectedActivities((prev) => {
      if (prev.includes(id)) return prev.filter((a) => a !== id);
      if (prev.length >= 3) {
        Alert.alert('Max 3 activities', 'You can only select up to 3 power activities.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleCreateCustom = async () => {
    const name = customName.trim();
    if (!name) return;
    setCustomCreating(true);
    try {
      const { data } = await activitiesApi.createCustom(name, 'power');
      setActivities((prev) => [...prev, data]);
      setSelectedActivities((prev) => {
        if (prev.length >= 3) return prev;
        return [...prev, data.id];
      });
      setCustomName('');
      setCustomModalVisible(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create activity. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setCustomCreating(false);
    }
  };

  const toggleDay = (day: string) => {
    setRestDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      if (prev.length >= 2) {
        Alert.alert('Max 2 rest days', 'You can only select up to 2 rest days.');
        return prev;
      }
      return [...prev, day];
    });
  };

  const handleNext = () => {
    if (step === 0 && selectedActivities.length === 0) {
      Alert.alert('Select Activities', 'Please select at least one power activity.');
      return;
    }
    if (step < 2) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep(step + 1);
      return;
    }
    handleSave();
  };

  const DAY_MAP: Record<string, string> = {
    Mon: 'monday',
    Tue: 'tuesday',
    Wed: 'wednesday',
    Thu: 'thursday',
    Fri: 'friday',
    Sat: 'saturday',
    Sun: 'sunday',
  };

  const REVERSE_DAY_MAP: Record<string, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setupApi.saveProgress({
        sections: {
          power: {
            activityIds: selectedActivities,
            restDays: restDays.map((d) => DAY_MAP[d]),
            preferredTime,
          },
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('SetupCraft');
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (screenLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background,
          }}
        >
          <Animated.View
            style={{
              transform: [{
                rotate: spinAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              }],
            }}
          >
            <Svg width={44} height={44} viewBox="0 0 44 44">
              {/* background ring */}
              <Circle
                cx="22"
                cy="22"
                r="18"
                stroke={colors.border}
                strokeWidth="3"
                fill="none"
              />

              {/* spinning arc */}
              <Circle
                cx="22"
                cy="22"
                r="18"
                stroke={colors.text}
                strokeWidth="3"
                fill="none"
                strokeDasharray="70 50"
                strokeLinecap="round"
                rotation="-90"
                origin="22,22"
              />
            </Svg>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.replace('DOBSelect')} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          <View style={styles.progressRing}>
            <Svg width={40} height={40} viewBox="0 0 40 40">
              <Circle
                cx={20} cy={20} r={16}
                stroke={colors.border}
                strokeWidth={3}
                fill="none"
              />
              <Circle
                cx={20} cy={20} r={16}
                stroke={colors.text}
                strokeWidth={3}
                fill="none"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 * (1 - 3 / 5)}
                strokeLinecap="round"
                rotation="-90"
                origin="20, 20"
              />
            </Svg>
            <Text style={styles.stepText}>3/5</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {/* Content */}
          {step === 0 && (
            <>
              {/* Companion + Question */}
              <View style={styles.companionSection}>
                <Animated.View
                  style={[
                    styles.companionIconWrapper,
                    { opacity: bubbleAnim, transform: [{ scale: bubbleAnim }] },
                  ]}
                >
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
                      <Image
                        source={{ uri: companion.image }}
                        style={styles.companionImage}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                </Animated.View>
                <Animated.Text style={[styles.questionText, { opacity: textAnim }]}>
                  {animatedQuestion}
                </Animated.Text>
                <Animated.Text style={[styles.subtitleText, { opacity: textAnim, transform: [{ translateX: subtitleSlide }] }]}>
                  {SUBTITLES[step]}
                </Animated.Text>
              </View>

              <View style={styles.grid}>
                {/* Displayed activities */}
                {displayedActivities.map((act) => {
                  const isSelected = selectedActivities.includes(act.id);
                  return (
                    <TouchableOpacity
                      key={act.id}
                      style={styles.activityCard}
                      onPress={() => toggleActivity(act.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.activityInner, isSelected && styles.activityCardSelected]}>
                        <Text style={[styles.activityText, isSelected && styles.activityTextSelected]}>
                          {act.name}
                        </Text>
                        {isSelected && (
                          <Text style={styles.tick}>✓</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Custom */}
                <TouchableOpacity
                  style={styles.activityCard}
                  onPress={() => setCustomModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.activityInner, styles.customCard]}>
                    <Text style={[styles.activityText, styles.customText]}>
                      + Custom
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Hidden activities */}
                {showMore && hiddenActivities.map((act) => {
                  const isSelected = selectedActivities.includes(act.id);
                  return (
                    <TouchableOpacity
                      key={act.id}
                      style={styles.activityCard}
                      onPress={() => toggleActivity(act.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.activityInner, isSelected && styles.activityCardSelected]}>
                        <Text style={[styles.activityText, isSelected && styles.activityTextSelected]}>
                          {act.name}
                        </Text>
                        {isSelected && (
                          <Text style={styles.tick}>✓</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {hiddenActivities.length > 0 && !showMore && (
                <TouchableOpacity onPress={() => setShowMore(true)} activeOpacity={0.7}>
                  <Text style={styles.moreText}>+ More</Text>
                </TouchableOpacity>
              )}

              {hiddenActivities.length > 0 && showMore && (
                <TouchableOpacity onPress={() => setShowMore(false)} activeOpacity={0.7}>
                  <Text style={styles.moreText}>− Hide</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {step === 1 && (
            <View style={styles.contentSection}>
              {/* Activity Summary */}
              <TouchableOpacity activeOpacity={0.7} onPress={() => setStep(0)}>
                <Animated.View style={[styles.tweet, { opacity: textAnim, transform: [{ translateY: summarySlide }] }]}>
                  <View style={styles.tweetRow}>
                    <View style={[styles.tweetAvatar, { borderColor: getCompanionColor(companion?.name || '') + '80' }]}>
                      {companion?.image && (
                        <Image source={{ uri: companion.image }} style={styles.tweetAvatarImg} resizeMode="cover" />
                      )}
                    </View>
                    <View style={styles.tweetBody}>
                      <View style={styles.tweetHeader}>
                        <Text style={styles.tweetName}>Power activities</Text>
                        <Text style={styles.tweetMeta}>· selected</Text>
                        <Text style={styles.tweetEdit}>✎</Text>
                      </View>
                      <Text style={styles.tweetText}>
                        {selectedActivities.map(id => activities.find(a => a.id === id)?.name).filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </TouchableOpacity>

              {/* Companion + Rest Day Question */}
              <View style={styles.companionSection}>
                <Animated.View style={[styles.companionIconWrapper, { opacity: bubbleAnim, transform: [{ scale: bubbleAnim }] }]}>
                  <View style={[styles.companionIcon, {
                    borderColor: getCompanionColor(companion?.name || '') + '80',
                    shadowColor: getCompanionColor(companion?.name || ''),
                    shadowOpacity: 0.9,
                    shadowRadius: 40,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 40,
                  }]}>
                    {companion?.image && (
                      <Image source={{ uri: companion.image }} style={styles.companionImage} resizeMode="cover" />
                    )}
                  </View>
                </Animated.View>
                <Animated.Text style={[styles.questionText, { opacity: textAnim }]}>
                  {animatedQuestion}
                </Animated.Text>
                <Animated.Text style={[styles.subtitleText, { opacity: textAnim, transform: [{ translateX: subtitleSlide }] }]}>
                  {SUBTITLES[step]}
                </Animated.Text>
              </View>

              <View style={styles.daysGrid}>
                {DAYS.map((day) => {
                  const isRest = restDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayCard, isRest && styles.dayCardRest]}
                      onPress={() => toggleDay(day)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dayText, isRest && styles.dayTextRest]}>{day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.note}>Rest days are days you won't be expected to log power activities.</Text>
            </View>
          )}

          {step === 2 && (
            <View style={styles.contentSection}>
              {/* Activity Summary */}
              <Animated.View style={[styles.tweet, { opacity: textAnim, transform: [{ translateY: summarySlide }] }]}>
                <View style={styles.tweetRow}>
                  <View style={[styles.tweetAvatar, { borderColor: getCompanionColor(companion?.name || '') + '80' }]}>
                    {companion?.image && (
                      <Image source={{ uri: companion.image }} style={styles.tweetAvatarImg} resizeMode="cover" />
                    )}
                  </View>
                  <View style={styles.tweetBody}>
                    <View style={styles.tweetHeader}>
                      <Text style={styles.tweetName}>Power activities</Text>
                      <Text style={styles.tweetMeta}>· selected</Text>
                    </View>
                    <Text style={styles.tweetText}>
                      {selectedActivities.map(id => activities.find(a => a.id === id)?.name).filter(Boolean).join(', ')}
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Rest Day Summary */}
              <Animated.View style={[styles.tweet, { opacity: textAnim, transform: [{ translateY: summarySlide }] }]}>
                <View style={styles.tweetRow}>
                  <View style={[styles.tweetAvatar, { borderColor: getCompanionColor(companion?.name || '') + '80' }]}>
                    {companion?.image && (
                      <Image source={{ uri: companion.image }} style={styles.tweetAvatarImg} resizeMode="cover" />
                    )}
                  </View>
                  <View style={styles.tweetBody}>
                    <View style={styles.tweetHeader}>
                      <Text style={styles.tweetName}>Rest days</Text>
                      <Text style={styles.tweetMeta}>· selected</Text>
                    </View>
                    <Text style={styles.tweetText}>
                      {restDays.join(', ') || 'None'}
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Companion + Time Question */}
              <View style={styles.companionSection}>
                <Animated.View style={[styles.companionIconWrapper, { opacity: bubbleAnim, transform: [{ scale: bubbleAnim }] }]}>
                  <View style={[styles.companionIcon, {
                    borderColor: getCompanionColor(companion?.name || '') + '80',
                    shadowColor: getCompanionColor(companion?.name || ''),
                    shadowOpacity: 0.9,
                    shadowRadius: 40,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 40,
                  }]}>
                    {companion?.image && (
                      <Image source={{ uri: companion.image }} style={styles.companionImage} resizeMode="cover" />
                    )}
                  </View>
                </Animated.View>
                <Animated.Text style={[styles.questionText, { opacity: textAnim }]}>
                  {animatedQuestion}
                </Animated.Text>
                <Animated.Text style={[styles.subtitleText, { opacity: textAnim, transform: [{ translateX: subtitleSlide }] }]}>
                  {SUBTITLES[step]}
                </Animated.Text>
              </View>

              <TouchableOpacity
                style={styles.timeCard}
                onPress={() => setTimePickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.timeLabel}>Preferred time</Text>
                <Text style={styles.timeValue}>{formatTimeDisplay(preferredTime)}</Text>
              </TouchableOpacity>

              {timePickerVisible && (
                <DateTimePicker
                  value={timeDate}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setTimePickerVisible(Platform.OS === 'ios');
                    if (selectedDate) {
                      setTimeDate(selectedDate);
                      setPreferredTime(toTimeString(selectedDate));
                    }
                  }}
                />
              )}
            </View>
          )}

          {/* Spacer for scroll */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Floating Footer */}
        <View style={styles.footer}>
          <Button
            title='Continue'
            onPress={handleNext}
            loading={saving}
            fullWidth
            size="lg"
          />
        </View>
      </View>

      {/* Power pillar intro — first visit to workout selection */}
      <Modal
        visible={powerIntroVisible}
        transparent
        animationType="fade"
        onRequestClose={dismissPowerIntro}
      >
        <View style={styles.introOverlay}>
          <View style={styles.introCard}>
            <View style={styles.introIconWrap}>
              <BicepIcon
                width={40}
                height={40}
                fill={colors.text}
                stroke={colors.text}
                color={colors.text}
              />
            </View>

            <Text style={styles.introTitle}>Power</Text>
            <Text style={styles.introBody}>
              This pillar focuses on your physical activities — what you do, when you rest, and when you train.
            </Text>

            <View style={styles.introBullets}>
              <Text style={styles.introBullet}>• Collect points as you complete activities</Text>
              <Text style={styles.introBullet}>• Personalized reminders to keep you moving</Text>
              <Text style={styles.introBullet}>• Advanced analytics to measure your growth</Text>
            </View>

            <Button
              title="Choose my activities"
              onPress={dismissPowerIntro}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </Modal>

      {/* Custom Activity Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={customModalVisible}
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add custom activity</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Skipping..."
              placeholderTextColor={colors.textMuted}
              value={customName}
              onChangeText={setCustomName}
              autoFocus
              maxLength={30}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setCustomModalVisible(false); setCustomName(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleCreateCustom}
                disabled={customCreating || !customName.trim()}
              >
                <Text style={styles.modalConfirmText}>
                  {customCreating ? 'Creating...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: { ...typography.body, color: colors.textSecondary, fontSize: 18 },
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

  // Scroll
  scroll: { flex: 1, paddingHorizontal: spacing.lg },

  // Companion Section
  companionSection: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  companionIconWrapper: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  companionIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.cardElevated,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  companionImage: {
    width: '100%',
    height: '100%',
  },
  companionEmoji: { fontSize: 56 },

  // Question
  questionText: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitleText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Activity Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  activityCard: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  activityInner: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activityCardSelected: {
    borderColor: colors.text,
    backgroundColor: colors.cardElevated,
  },
  activityText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  activityTextSelected: {
    color: colors.text,
  },
  tick: {
    position: 'absolute',
    top: 8,
    right: 10,
    fontSize: 12,
    color: colors.text,
    fontWeight: '700',
  },
  contentSection: {
    gap: spacing.md,
  },

  // Tweet-style Summary
  tweet: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  tweetRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tweetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  tweetAvatarImg: {
    width: '100%',
    height: '100%',
  },
  tweetBody: {
    flex: 1,
    gap: 2,
  },
  tweetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tweetName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  tweetMeta: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  tweetEdit: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  tweetText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 20,
    marginTop: 2,
  },
  customCard: {
    borderStyle: 'dashed',
    borderColor: colors.borderLight,
  },
  customText: {
    color: colors.textSecondary,
  },
  moreText: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    paddingVertical: spacing.sm,
    paddingLeft: 4,
  },

  // Power intro modal
  introOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  introCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.cardElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  introIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  introTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    fontSize: 22,
    marginTop: spacing.xs,
  },
  introBody: {
    ...typography.bodySmall,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  introBullets: {
    marginVertical: spacing.sm,
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  introBullet: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 14,
    fontWeight: '400',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.cardElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  modalInput: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancel: {
    flex: 1,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 1,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },

  // Time Picker
  timeCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  timeLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  timeValue: {
    ...typography.h3,
    color: colors.text,
    fontSize: 28,
  },

  // Day Cards
  daysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dayCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardRest: {
    borderColor: colors.text,
    backgroundColor: colors.card,
  },
  dayText: { ...typography.body, color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  dayTextRest: { color: colors.text },

  // Note
  note: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
  },
});

export default SetupPowerScreen;
