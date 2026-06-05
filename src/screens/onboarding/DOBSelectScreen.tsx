import React, { useState, useRef, useEffect, useCallback } from 'react';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ListRenderItemInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingStackScreenProps } from '../../navigation/types';
import { setupApi } from '../../api';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';
import { isAfter } from 'date-fns';

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_AGE = 13;
const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5; // must be odd
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING_VERTICAL = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr',
  'May', 'Jun', 'Jul', 'Aug',
  'Sep', 'Oct', 'Nov', 'Dec',
];

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getDaysInMonth = (month: number, year: number) =>
  new Date(year, month + 1, 0).getDate();

// ─── Wheel ───────────────────────────────────────────────────────────────────

interface WheelProps {
  items: (string | number)[];
  selectedIndex: number;
  onIndexChange: (i: number) => void;
  width: number;
  daysInMonth?: number;
}

/**
 * Twitter / iOS-style wheel picker.
 *
 * Math:
 *   When scrollY === index * ITEM_HEIGHT, the item at `index` is exactly
 *   centered in the selection band (because contentContainerStyle reserves
 *   PADDING_VERTICAL on top, which equals the offset from viewport-top to
 *   band-top).
 *
 * Performance:
 *   - FlatList virtualizes — only ~6 items mounted at a time per wheel.
 *   - Reanimated scroll handler runs on the UI thread (no JS-thread lag).
 *   - Each WheelItem's useAnimatedStyle reads scrollY directly, so the
 *     "selected" visual tracks the finger frame-by-frame.
 */
const WheelItem = React.memo(function WheelItem({
  label,
  index,
  scrollY,
  disabled = false,
}: {
  label: string | number;
  index: number;
  scrollY: SharedValue<number>;
  disabled?: boolean;
}) {
  const animStyle = useAnimatedStyle(() => {
    const dist = Math.abs(scrollY.value - index * ITEM_HEIGHT);
    return {
      opacity: disabled
        ? 0.15
        : interpolate(
            dist,
            [0, ITEM_HEIGHT, ITEM_HEIGHT * 2],
            [1, 0.45, 0.18],
            Extrapolation.CLAMP
          ),
      transform: [
        {
          scale: interpolate(
            dist,
            [0, ITEM_HEIGHT],
            [1.06, 0.88],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <Animated.View style={[wStyles.item, animStyle]}>
      <Text style={wStyles.label}>{label}</Text>
    </Animated.View>
  );
});

const Wheel: React.FC<WheelProps> = ({
  items,
  selectedIndex,
  onIndexChange,
  width,
  daysInMonth,
}) => {
  const listRef = useRef<FlatList<any>>(null);
  const scrollY = useSharedValue(selectedIndex * ITEM_HEIGHT);
  const lastHapticIdx = useSharedValue(selectedIndex);
  const isDragging = useRef(false);
  const prevIdx = useRef(selectedIndex);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  // UI-thread scroll handler — updates scrollY every frame, no JS bridge hop
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      const idx = Math.round(e.contentOffset.y / ITEM_HEIGHT);
      if (idx !== lastHapticIdx.value && idx >= 0 && idx < items.length) {
        lastHapticIdx.value = idx;
        runOnJS(triggerHaptic)();
      }
    },
  });

  // Re-position when items.length changes (month change → day count differs)
  useEffect(() => {
    const safeIdx = Math.min(Math.max(0, selectedIndex), items.length - 1);
    const offset = safeIdx * ITEM_HEIGHT;
    scrollY.value = offset;
    lastHapticIdx.value = safeIdx;
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [items.length]);

  // External selectedIndex change (parent clamped the day)
  useEffect(() => {
    if (prevIdx.current === selectedIndex) return;
    prevIdx.current = selectedIndex;
    if (isDragging.current) return;
    listRef.current?.scrollToOffset({
      offset: selectedIndex * ITEM_HEIGHT,
      animated: true,
    });
  }, [selectedIndex]);

  const settleAt = useCallback(
    (rawY: number) => {
      const idx = Math.round(rawY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      if (prevIdx.current !== clamped) {
        prevIdx.current = clamped;
        onIndexChange(clamped);
      }
    },
    [items.length, onIndexChange]
  );

  const onScrollBeginDrag = useCallback(() => {
    isDragging.current = true;
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  }, []);

  // Fallback for very slow drags where momentum doesn't fire
  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const rawY = e.nativeEvent.contentOffset.y;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        if (isDragging.current) {
          isDragging.current = false;
          settleAt(rawY);
        }
      }, 120);
    },
    [settleAt]
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
      isDragging.current = false;
      settleAt(e.nativeEvent.contentOffset.y);
    },
    [settleAt]
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<string | number>) => {
      const day = Number(item);
      const invalid = daysInMonth != null && day > daysInMonth;
      return (
        <WheelItem
          label={item}
          index={index}
          scrollY={scrollY}
          disabled={invalid}
        />
      );
    },
    [daysInMonth, scrollY]
  );

  const keyExtractor = useCallback((_: any, i: number) => String(i), []);
  const getItemLayout = useCallback(
    (_: any, i: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * i,
      index: i,
    }),
    []
  );

  return (
    <View style={[wStyles.container, { width }]}>
      <AnimatedFlatList
        ref={listRef as any}
        data={items as any}
        renderItem={renderItem as any}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
        onScroll={scrollHandler}
        scrollEventThrottle={1}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{ paddingVertical: PADDING_VERTICAL }}
        initialNumToRender={VISIBLE_ITEMS + 4}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        initialScrollIndex={selectedIndex}
      />

      {/* Selection band — drawn on top, pointerEvents=none so it doesn't block scroll */}
      <View style={wStyles.band} pointerEvents="none" />
    </View>
  );
};

const wStyles = StyleSheet.create({
  container: {
    height: WHEEL_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  band: {
    position: 'absolute',
    top: PADDING_VERTICAL,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  label: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
});

// ─── DOBSelectScreen ─────────────────────────────────────────────────────────

const DOBSelectScreen: React.FC<OnboardingStackScreenProps<'DOBSelect'>> = ({
  navigation,
}) => {
  const today = new Date();

  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedYear, setSelectedYear] = useState(2010);
  const [saving, setSaving] = useState(false);

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);

  const days = React.useMemo(
    () => Array.from({ length: 31 }, (_, i) => i + 1),
    []
  );
  const years = React.useMemo(
    () => Array.from({ length: 2020 - 1900 + 1 }, (_, i) => 2020 - i),
    []
  );

  const handleMonthChange = useCallback(
    (idx: number) => {
      setSelectedMonth(idx);
      setSelectedDay((d) => {
        const max = getDaysInMonth(idx, selectedYear);
        return d > max ? max : d;
      });
    },
    [selectedYear]
  );

  const handleDayChange = useCallback((idx: number) => {
    setSelectedDay(idx + 1);
  }, []);

  // Pre-fill saved DOB
  useEffect(() => {
    setupApi.getProgress().then(({ data }) => {
      if (data.dob) {
        const [y, m, d] = data.dob.split('-').map(Number);
        setSelectedYear(y);
        setSelectedMonth(m - 1);
        setSelectedDay(d);
      }
    });
  }, []);

  const handleYearChange = useCallback(
    (idx: number) => {
      const newYear = years[idx];
      setSelectedYear(newYear);
      setSelectedDay((d) => {
        const max = getDaysInMonth(selectedMonth, newYear);
        return d > max ? max : d;
      });
    },
    [years, selectedMonth]
  );

  const handleContinue = async () => {
    const selectedDate = new Date(selectedYear, selectedMonth, selectedDay);
    const minDOB = new Date();
    minDOB.setFullYear(minDOB.getFullYear() - MIN_AGE);
    if (isAfter(selectedDate, minDOB)) {
      Alert.alert('Age Requirement', `You must be at least ${MIN_AGE} years old.`);
      return;
    }
    setSaving(true);
    try {
      const formattedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      await setupApi.saveProgress({ dob: formattedDate });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('SetupPower');
    } catch {
      Alert.alert('Error', 'Failed to save date of birth. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const dayIndex = Math.min(selectedDay, daysInMonth) - 1;
  const yearIndex = years.indexOf(selectedYear);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('CompanionSelect', { skipRouting: true })
            }
            style={styles.backBtn}
          >
            <Text style={styles.backText}>←</Text>
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
                strokeDashoffset={2 * Math.PI * 16 * (1 - 2 / 5)}
                strokeLinecap="round"
                rotation="-90"
                origin="20, 20"
              />
            </Svg>
            <Text style={styles.stepText}>2/5</Text>
          </View>
        </View>

        <Text style={styles.title}>What's your{'\n'}birth date?</Text>
        <Text style={styles.subtitle}>
          This helps personalize your experience.
        </Text>

        <View style={styles.pickerRow}>
          <Wheel
            items={MONTHS}
            selectedIndex={selectedMonth}
            onIndexChange={handleMonthChange}
            width={80}
          />
          <Wheel
            items={days}
            selectedIndex={dayIndex}
            onIndexChange={handleDayChange}
            width={56}
            daysInMonth={daysInMonth}
          />
          <Wheel
            items={years}
            selectedIndex={yearIndex < 0 ? 0 : yearIndex}
            onIndexChange={handleYearChange}
            width={76}
          />
        </View>

        <View style={styles.spacer} />

        <Button
          title="Continue"
          onPress={handleContinue}
          loading={saving}
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
  title: { ...typography.h1, color: '#fff', fontSize: 34, marginTop: 8 },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    marginTop: 10,
    lineHeight: 22,
    marginBottom: 40,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    height: WHEEL_HEIGHT,
  },
  spacer: { flex: 1 },
});

export default DOBSelectScreen;