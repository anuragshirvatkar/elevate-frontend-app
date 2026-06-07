import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Image, Modal, TextInput, Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingStackScreenProps } from '../../navigation/types';
import { setupApi, booksApi } from '../../api';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';
import type { BookDto, CompanionDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BrainIcon from '../../../assets/brain.svg';

const MIND_INTRO_SEEN_KEY = 'onboarding_mind_intro_seen';

const QUESTIONS = [
  "What are you reading or planning to read?",
  "When should your mind rest?",
  "When do you prefer to read?"
];

const SUBTITLES = [
  "Pick books you want to read or add your own.",
  "Select 1 rest day for your reading schedule.",
  "Choose your preferred reading time."
];

const DAY_MAP: Record<string, string> = {
  Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday',
  Thu: 'thursday', Fri: 'friday', Sat: 'saturday', Sun: 'sunday',
};

const REVERSE_DAY_MAP: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

function toTimeString(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

function formatTimeDisplay(timeStr: string): string {
  if (!timeStr) return 'Select time';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function timeDiffMinutes(t1: string, t2: string): number {
  const [h1, m1] = t1.split(':').map(Number);
  const [h2, m2] = t2.split(':').map(Number);
  const diff = Math.abs(h1 * 60 + m1 - (h2 * 60 + m2));
  return Math.min(diff, 1440 - diff);
}

const getCompanionColor = (name: string): string => {
  const colorMap: { [key: string]: string } = {
    'Captain Blackvein': '#3DFF86',
    'Tharok Warborn': '#FFC857',
    'Riven the Silent': '#FF5A5A',
    'Nova Emberlight': '#54A9FF',
  };
  return colorMap[name] || '#FFFFFF';
};

const SetupMindScreen: React.FC<OnboardingStackScreenProps<'SetupMind'>> = ({ navigation }) => {
  const { updateUser } = useAuth();
  const { showAlert } = useAlert();
  const [books, setBooks] = useState<BookDto[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [companion, setCompanion] = useState<CompanionDto | null>(null);
  const [screenLoading, setScreenLoading] = useState(true);
  const [animatedQuestion, setAnimatedQuestion] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [addingBook, setAddingBook] = useState(false);
  const [restDays, setRestDays] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState<string>('');
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timeDate, setTimeDate] = useState(new Date());
  const [mindIntroVisible, setMindIntroVisible] = useState(false);
  const [customBookIds, setCustomBookIds] = useState<Set<string>>(new Set());
  const [savedPowerTime, setSavedPowerTime] = useState<string>('');
  const [savedCraftTime, setSavedCraftTime] = useState<string>('');
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

        setBooks(optionsData.books);

        setCompanion(progressData.selectedCompanion || null);

        const mind = progressData.sections?.mind;

        // Try to fetch custom books, handle 404 gracefully
        let customIds: string[] = [];
        try {
          const { data: customBooksData } = await booksApi.getCustom();

          if (customBooksData.length > 0) {
            customIds = customBooksData.map((b: any) => b.id);
            setCustomBookIds(new Set(customIds));

            const mappedCustomBooks = customBooksData.map((b: any): BookDto => ({
              id: b.id,
              title: b.title,
              author: b.author,
              pages: b.pages,
            }));
            setBooks((prev) => [...prev, ...mappedCustomBooks]);
          }
        } catch (err: any) {
          if (err?.response?.status !== 404) {
            console.error('Failed to load custom books:', err);
          }
        }

        // Selection priority rule:
        // 1. Custom books always first (up to 3)
        // 2. If slots remain (<3), fill with system books that user had previously saved
        // 3. Never auto-select system books that weren't previously chosen
        const savedSystemIds: string[] = mind?.books
          ? (mind.books as any[])
              .map((b) => b.userBookId || b.id)
              .filter((id: string) => !customIds.includes(id))
          : [];

        const prioritized = [
          ...customIds.slice(0, 3),
          ...savedSystemIds.slice(0, Math.max(0, 3 - customIds.length)),
        ].slice(0, 3);

        if (prioritized.length > 0) {
          setSelectedBooks(prioritized);
        }

        if (mind?.restDays?.length) {
          setRestDays(mind.restDays.map((d: string) => REVERSE_DAY_MAP[d] || d));
        }

        if (mind?.preferredTime) {
          setPreferredTime(mind.preferredTime);

          const [h, m] = mind.preferredTime
            .split(':')
            .map(Number);

          const d = new Date();
          d.setHours(h, m, 0, 0);

          setTimeDate(d);
        }

        setSavedPowerTime(progressData.sections?.power?.preferredTime ?? '');
        setSavedCraftTime(progressData.sections?.craft?.preferredTime ?? '');

        const hasSavedBooks = (mind?.books?.length ?? 0) > 0;
        if (hasSavedBooks) {
          setStep(2);
          setMindIntroVisible(false);
        } else {
          const introSeen = await AsyncStorage.getItem(MIND_INTRO_SEEN_KEY);
          setMindIntroVisible(introSeen !== 'true');
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

  const dismissMindIntro = useCallback(async () => {
    await AsyncStorage.setItem(MIND_INTRO_SEEN_KEY, 'true');
    setMindIntroVisible(false);
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

  const customBooks = books.filter(book => customBookIds.has(book.id));
  const nonCustomBooks = books.filter(book => !customBookIds.has(book.id));
  
  // Calculate how many predefined items to show (5 - custom count)
  const customCount = customBooks.length;
  const predefinedCountToShow = Math.max(0, 5 - customCount);
  const displayedBooks = nonCustomBooks.slice(0, predefinedCountToShow);
  const hiddenBooks = nonCustomBooks.slice(predefinedCountToShow);

  const toggleBook = (id: string) => {
    if (selectedBooks.includes(id)) {
      setSelectedBooks((prev) => prev.filter((b) => b !== id));
    } else if (selectedBooks.length >= 3) {
      showAlert('Max 3 books', 'You can only select up to 3 books.');
    } else {
      setSelectedBooks((prev) => [...prev, id]);
    }
  };

  const handleAddBook = async () => {
    const title = customTitle.trim();
    if (!title) { showAlert('Error', 'Book title is required.'); return; }
    setAddingBook(true);
    try {
      const { data } = await booksApi.createCustom({ title, author: customAuthor.trim() || undefined });
      setBooks((prev) => [...prev, { id: data.id, title: data.title, author: data.author }]);
      setCustomBookIds((prev) => new Set(prev).add(data.id));
      setSelectedBooks((prev) => {
        if (prev.length >= 3) return prev;
        return [...prev, data.id];
      });
      setCustomTitle('');
      setCustomAuthor('');
      setCustomModalVisible(false);
    } catch {
      showAlert('Error', 'Failed to add book.');
    } finally {
      setAddingBook(false);
    }
  };

  const toggleDay = (day: string) => {
    setRestDays((prev) => {
      if (prev.includes(day)) return [];
      return [day];
    });
  };

  const handleSkipConfirm = async () => {
    setSaving(true);
    try {
      await setupApi.saveProgress({
        sections: {
          mind: {
            skipMind: true,
            preferredTime: undefined,
            restDays: [],
            bookIds: [],
          },
        },
      });
      await setupApi.complete();
      updateUser({ onboarding_completed: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      showAlert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    showAlert(
      'Skip Mind Section?',
      'You can always activate reading later from settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: handleSkipConfirm },
      ]
    );
  };

  const handleNext = () => {
    // Books validation
    if (selectedBooks.length === 0) {
      showAlert(
        'Select Books',
        'Please select at least one book or skip this section.'
      );
      return;
    }

    // Rest day validation
    if (step >= 1 && restDays.length === 0) {
      showAlert(
        'Select Rest Day',
        'Please select 1 rest day.'
      );
      return;
    }

    // Time validation
    if (step >= 2 && !preferredTime) {
      showAlert(
        'Select Time',
        'Please choose a preferred reading time.'
      );
      return;
    }

    if (step < 2) {
      Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Medium
      );

      setStep(step + 1);
      return;
    }

    handleSave();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setupApi.saveProgress({
        sections: {
          mind: {
            bookIds: selectedBooks,
            restDays: restDays.map((d) => DAY_MAP[d]),
            preferredTime,
          },
        },
      });
      await setupApi.complete();
      updateUser({ onboarding_completed: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      showAlert('Error', 'Failed to save. Please try again.');
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
          <TouchableOpacity
            onPress={() => navigation.replace('SetupCraft')}
            style={styles.backBtn}
          >
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
                strokeDashoffset={0}
                strokeLinecap="round"
                rotation="-90"
                origin="20, 20"
              />
            </Svg>
            <Text style={styles.stepText}>5/5</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {step === 0 && (
            <>
              {/* Companion + Question */}
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

              <View style={styles.grid}>
                {customBooks.map((book) => {
                  const isSelected = selectedBooks.includes(book.id);
                  return (
                    <TouchableOpacity key={book.id} style={styles.bookCard} onPress={() => toggleBook(book.id)} activeOpacity={0.7}>
                      <View style={[styles.bookInner, isSelected && styles.bookCardSelected]}>
                        <Text style={[styles.bookTitle, isSelected && styles.bookTitleSelected]} numberOfLines={1}>{book.title}</Text>
                        {book.author && <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>}
                        {isSelected && <Text style={styles.tick}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {displayedBooks.map((book) => {
                  const isSelected = selectedBooks.includes(book.id);
                  return (
                    <TouchableOpacity key={book.id} style={styles.bookCard} onPress={() => toggleBook(book.id)} activeOpacity={0.7}>
                      <View style={[styles.bookInner, isSelected && styles.bookCardSelected]}>
                        <Text style={[styles.bookTitle, isSelected && styles.bookTitleSelected]} numberOfLines={1}>{book.title}</Text>
                        {book.author && <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>}
                        {isSelected && <Text style={styles.tick}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity style={styles.bookCard} onPress={() => setCustomModalVisible(true)} activeOpacity={0.7}>
                  <View style={[styles.bookInner, styles.customCard]}>
                    <Text style={[styles.bookTitle, styles.customText]}>+ Custom</Text>
                  </View>
                </TouchableOpacity>

                {showMore && hiddenBooks.map((book) => {
                  const isSelected = selectedBooks.includes(book.id);
                  return (
                    <TouchableOpacity key={book.id} style={styles.bookCard} onPress={() => toggleBook(book.id)} activeOpacity={0.7}>
                      <View style={[styles.bookInner, isSelected && styles.bookCardSelected]}>
                        <Text style={[styles.bookTitle, isSelected && styles.bookTitleSelected]} numberOfLines={1}>{book.title}</Text>
                        {book.author && <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>}
                        {isSelected && <Text style={styles.tick}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {hiddenBooks.length > 0 && !showMore && (
                <TouchableOpacity onPress={() => setShowMore(true)} activeOpacity={0.7}>
                  <Text style={styles.moreText}>+ More</Text>
                </TouchableOpacity>
              )}
              {hiddenBooks.length > 0 && showMore && (
                <TouchableOpacity onPress={() => setShowMore(false)} activeOpacity={0.7}>
                  <Text style={styles.moreText}>− Hide</Text>
                </TouchableOpacity>
              )}

              {/* Skip Section */}
              <TouchableOpacity style={styles.skipRow} onPress={handleSkip} activeOpacity={0.7}>
                <Text style={styles.skipLabel}>Skip this section</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 1 && (
            <>
              {/* Book Summary */}
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
                        <Text style={styles.tweetName}>Books</Text>
                        <Text style={styles.tweetMeta}>· selected</Text>
                        <Text style={styles.tweetEdit}>✎</Text>
                      </View>
                      <Text style={styles.tweetText}>
                        {selectedBooks.map(id => books.find(b => b.id === id)?.title).filter(Boolean).join(', ')}
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

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
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

              <Text style={styles.note}>Pick 1 day to get recharged.</Text>
            </>
          )}

          {step === 2 && (
            <>
              {/* Book Summary */}
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
                        <Text style={styles.tweetName}>Books</Text>
                        <Text style={styles.tweetMeta}>· selected</Text>
                        <Text style={styles.tweetEdit}>✎</Text>
                      </View>
                      <Text style={styles.tweetText}>
                        {selectedBooks.map(id => books.find(b => b.id === id)?.title).filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </TouchableOpacity>

              {/* Rest Day Summary - Editable */}
              <TouchableOpacity activeOpacity={0.7} onPress={() => setStep(1)}>
                <Animated.View style={[styles.tweet, { opacity: textAnim, transform: [{ translateY: summarySlide }] }]}>
                  <View style={styles.tweetRow}>
                    <View style={[styles.tweetAvatar, { borderColor: getCompanionColor(companion?.name || '') + '80' }]}>
                      {companion?.image && (
                        <Image source={{ uri: companion.image }} style={styles.tweetAvatarImg} resizeMode="cover" />
                      )}
                    </View>
                    <View style={styles.tweetBody}>
                      <View style={styles.tweetHeader}>
                        <Text style={styles.tweetName}>Rest day</Text>
                        <Text style={styles.tweetMeta}>· selected</Text>
                        <Text style={styles.tweetEdit}>✎</Text>
                      </View>
                      <Text style={styles.tweetText}>
                        {restDays.join(', ') || 'None'}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </TouchableOpacity>

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
                  display={Platform.OS === 'android' ? 'clock' : 'spinner'}
                  onChange={(event, selectedDate) => {
                    setTimePickerVisible(Platform.OS === 'ios');
                    if (selectedDate) {
                      const newTime = toTimeString(selectedDate);
                      const conflicts: string[] = [];
                      if (savedPowerTime && timeDiffMinutes(newTime, savedPowerTime) < 60) {
                        conflicts.push(`Power (${formatTimeDisplay(savedPowerTime)})`);
                      }
                      if (savedCraftTime && timeDiffMinutes(newTime, savedCraftTime) < 60) {
                        conflicts.push(`Craft (${formatTimeDisplay(savedCraftTime)})`);
                      }
                      if (conflicts.length > 0) {
                        showAlert('Time Conflict', `Selected time is within 1 hour of your ${conflicts.join(' and ')} time. Please choose a different time.`);
                        return;
                      }
                      setTimeDate(selectedDate);
                      setPreferredTime(newTime);
                    }
                  }}
                />
              )}
            </>
          )}



          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Floating Footer */}
        <View style={styles.footer}>
          <Button
            title={step === 2 ? 'Finish Setup' : 'Continue'}
            onPress={handleNext}
            loading={saving}
            fullWidth
            size="lg"
          /></View>
      </View>

      {/* Mind pillar intro */}
      <Modal
        visible={mindIntroVisible}
        transparent
        animationType="fade"
        onRequestClose={dismissMindIntro}
      >
        <View style={styles.introOverlay}>
          <View style={styles.introCard}>
            <View style={styles.introIconWrap}>
              <BrainIcon width={40} height={40} fill={colors.text} stroke={colors.text} color={colors.text} />
            </View>
            <Text style={styles.introTitle}>Mind</Text>
            <Text style={styles.introBody}>
              This pillar focuses on your Reading. what you read, learn, and reflect on daily.
            </Text>
            <View style={styles.introBullets}>
              <Text style={styles.introBullet}>• Points as you complete reading sessions</Text>
              <Text style={styles.introBullet}>• Personalized reminders to keep you reading</Text>
              <Text style={styles.introBullet}>• Analytics to track your mental growth</Text>
            </View>
            <Button title="Choose my books" onPress={dismissMindIntro} fullWidth size="lg" />
          </View>
        </View>
      </Modal>

      {/* Custom Book Modal */}
      <Modal animationType="slide" transparent visible={customModalVisible} onRequestClose={() => setCustomModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add custom book</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Book title *"
              placeholderTextColor={colors.textMuted}
              value={customTitle}
              onChangeText={setCustomTitle}
              autoFocus
              maxLength={60}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Author (optional)"
              placeholderTextColor={colors.textMuted}
              value={customAuthor}
              onChangeText={setCustomAuthor}
              maxLength={40}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setCustomModalVisible(false); setCustomTitle(''); setCustomAuthor(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleAddBook} disabled={addingBook || !customTitle.trim()}>
                <Text style={styles.modalConfirmText}>{addingBook ? 'Adding...' : 'Add'}</Text>
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
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  backText: { ...typography.body, color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', textShadowColor: '#FFFFFF', textShadowRadius: 4 },
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

  scroll: { flex: 1, paddingHorizontal: spacing.lg },

  // Mind intro modal
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
    backgroundColor: '#0a0a0a',
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
  },
  introBullet: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 12,
    fontWeight: '400',
  },

  // Companion
  companionSection: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  companionIconWrapper: {
    alignItems: 'center',
  },
  companionIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    overflow: 'hidden',
  },
  companionImage: {
    width: '100%',
    height: '100%',
  },
  questionText: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 28,
  },
  subtitleText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Book Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  bookCard: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  bookInner: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
    position: 'relative',
    gap: 2,
  },
  bookCardSelected: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.text,
  },
  bookTitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  bookTitleSelected: {
    color: colors.text,
  },
  bookAuthor: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  tick: {
    position: 'absolute',
    top: 8,
    right: 10,
    fontSize: 12,
    color: colors.text,
    fontWeight: '700',
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

  // Note
  note: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Skip
  skipRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  skipLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Tweet Summary
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

  contentSection: {
    gap: spacing.md,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
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
});

export default SetupMindScreen;
