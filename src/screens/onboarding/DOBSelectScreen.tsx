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
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingStackScreenProps } from '../../navigation/types';
import { setupApi } from '../../api';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';
import { subYears, isAfter } from 'date-fns';

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_AGE = 13;
const MAX_AGE = 100;
const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5; // must be odd
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING_VERTICAL = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT;

// Only 2 copies each side — enough to never show an edge during normal use.
// Months = 12 items → total 60 rows. Days = 31 → 155. Year = 87 → no looping needed.
const LOOP_COPIES = 2;

const MONTHS = [
  'Jan','Feb','Mar','Apr',
  'May','Jun','Jul','Aug',
  'Sep','Oct','Nov','Dec',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getDaysInMonth = (month: number, year: number) =>
  new Date(year, month + 1, 0).getDate();

/**
 * Build the looped array once. Returns:
 *  - looped: the full repeated array
 *  - realStart: index in `looped` where the "real" block starts
 */
function buildLooped<T>(items: T[]): { looped: T[]; realStart: number } {
  const copies: T[] = [];
  for (let i = 0; i < LOOP_COPIES * 2 + 1; i++) copies.push(...items);
  return { looped: copies, realStart: LOOP_COPIES * items.length };
}

/** Snap raw offset → nearest item offset */
const snap = (offset: number) => Math.round(offset / ITEM_HEIGHT) * ITEM_HEIGHT;

/** Convert any offset to a 0-based real index */
const toRealIdx = (offset: number, realLen: number) =>
  ((Math.round(offset / ITEM_HEIGHT) % realLen) + realLen) % realLen;

// ─── InfiniteWheel ───────────────────────────────────────────────────────────

interface WheelProps {
  items: (string | number)[];
  selectedIndex: number;           // 0-based into real items
  onIndexChange: (i: number) => void;
  width: number;
  daysInMonth?: number;            // Optional: for day wheel to know max valid day
}

// Memoized row component to prevent unnecessary re-renders
const WheelItem = React.memo(
({
  label,
  isSelected,
  disabled = false,
}: {
  label: string | number;
  isSelected: boolean;
  disabled?: boolean;
}) => (
  <View style={wStyles.item}>
    <Text
      style={[
        wStyles.label,
        disabled && { opacity: 0.15 },
        isSelected && wStyles.labelSelected,
      ]}
    >
      {label}
    </Text>
  </View>
));


const InfiniteWheel: React.FC<WheelProps> = ({
  items,
  selectedIndex,
  onIndexChange,
  width,
  daysInMonth,
}) => {
  const realLen = items.length;
  // Build looped data once per items reference change
  const { looped, realStart } = React.useMemo(() => buildLooped(items), [items]);

  const listRef = useRef<FlatList<any>>(null);
  const offsetRef = useRef(0);        // last known scroll offset (raw)
  const isScrolling = useRef(false);
  const suppressExternal = useRef(false); // prevent re-scroll while user is dragging

  // Scroll to the correct looped position for a given real index,
  // keeping us in the middle block.
  const scrollToIndex = useCallback(
    (realIdx: number, animated: boolean) => {
      // Find the looped index in the middle block
      const loopedIdx = realStart + realIdx;
      const targetOffset = loopedIdx * ITEM_HEIGHT;
      offsetRef.current = targetOffset;
      listRef.current?.scrollToOffset({ offset: targetOffset, animated });
    },
    [realStart]
  );

  // Re-position whenever items length changes
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      scrollToIndex(selectedIndex, false);
      prevIdx.current = selectedIndex;
    });

    return () => cancelAnimationFrame(raf);
  }, [realLen]);

  // External selectedIndex change (e.g. day clamped by parent)
  const prevIdx = useRef(selectedIndex);
  useEffect(() => {
    if (prevIdx.current === selectedIndex) return;
    prevIdx.current = selectedIndex;
    if (isScrolling.current || suppressExternal.current) return;
    scrollToIndex(selectedIndex, true);
  }, [selectedIndex, scrollToIndex]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  const handleScrollBegin = useCallback(() => {
    isScrolling.current = true;
    suppressExternal.current = true;
  }, []);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isScrolling.current = false;

      const raw = e.nativeEvent.contentOffset.y;
      const snapped = snap(raw);
      const realIdx = toRealIdx(snapped, realLen);

      // Always re-anchor to the middle block to avoid running out of items
      const anchoredOffset = (realStart + realIdx) * ITEM_HEIGHT;

      if (Math.abs(anchoredOffset - snapped) > 1) {
        // Silent jump — no animation, user won't notice
        offsetRef.current = anchoredOffset;
        listRef.current?.scrollToOffset({ offset: anchoredOffset, animated: false });
      } else {
        offsetRef.current = snapped;
      }

      prevIdx.current = realIdx;
      onIndexChange(realIdx);

      // Allow external updates again after the next frame
      requestAnimationFrame(() => { suppressExternal.current = false; });
    },
    [realLen, realStart, onIndexChange]
  );

  // Also handle drag-end (user lifts finger without momentum)
  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isScrolling.current) return; // already handled by momentum
      handleMomentumEnd(e);
    },
    [handleMomentumEnd]
  );

  // Build display data: only mark selected based on looped position vs current offset
  // We derive selectedLoopedIdx from offsetRef so highlight is always correct
  const data = React.useMemo(
    () =>
      looped.map((item, i) => ({
        label: item,
        isSelected:
          ((i - realStart) % realLen + realLen) % realLen === selectedIndex,
      })),
    [looped, selectedIndex, realLen, realStart]
  );

  const renderItem = ({ item, index }: ListRenderItemInfo<{ label: string | number; isSelected: boolean }>) => {
    const day = Number(item.label);
    const invalid = daysInMonth ? day > daysInMonth : false;
    return (
      <WheelItem
        label={item.label}
        isSelected={item.isSelected}
        disabled={invalid}
      />
    );
  };

  const keyExtractor = (_: any, i: number) => String(i);

  const getItemLayout = (_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  });

  return (
    <View style={[wStyles.container, { width }]}>
      {/* Selection band */}
      <View style={wStyles.band} pointerEvents="none" />

      <FlatList
        ref={listRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate={0.985}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: PADDING_VERTICAL }}
        removeClippedSubviews
        windowSize={3}
        initialNumToRender={VISIBLE_ITEMS + 2}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={100}
        scrollIndicatorInsets={{ right: 1 }}
      />

      {/* Fade overlays */}
      <View style={wStyles.fadeTop} pointerEvents="none" />
      <View style={wStyles.fadeBottom} pointerEvents="none" />
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  label: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
  },
  labelSelected: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PADDING_VERTICAL,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PADDING_VERTICAL,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
});

// ─── DOBSelectScreen ─────────────────────────────────────────────────────────

const DOBSelectScreen: React.FC<
  OnboardingStackScreenProps<'DOBSelect'>
> = ({ navigation }) => {
  const today = new Date();
  const currentYear = today.getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay]     = useState(today.getDate());
  const [selectedYear, setSelectedYear]   = useState(2010);
  const [saving, setSaving]               = useState(false);

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);

  // Keep stable forever
  const days = React.useMemo(
    () => Array.from({ length: 31 }, (_, i) => i + 1),
    []
  );
  const years = React.useMemo(
    () => Array.from({ length: 2020 - 1900 + 1 }, (_, i) => 2020 - i),
    []
  );

  const handleMonthChange = useCallback((idx: number) => {
    setSelectedMonth(idx);
    setSelectedDay(d => {
      const max = getDaysInMonth(idx, selectedYear);
      return d > max ? max : d;
    });
  }, [selectedYear]);

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

  const handleYearChange = useCallback((idx: number) => {
    const newYear = years[idx];
    setSelectedYear(newYear);
    setSelectedDay(d => {
      const max = getDaysInMonth(selectedMonth, newYear);
      return d > max ? max : d;
    });
  }, [years, selectedMonth]);

  const handleContinue = async () => {
    const selectedDate = new Date(selectedYear, selectedMonth, selectedDay);
    if (isAfter(selectedDate, subYears(new Date(), MIN_AGE))) {
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

  const dayIndex  = Math.min(selectedDay, daysInMonth) - 1;
  const yearIndex = years.indexOf(selectedYear);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.navigate('CompanionSelect', { skipRouting: true })} style={styles.backBtn}>
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
        <Text style={styles.subtitle}>This helps personalize your experience.</Text>

        <View style={styles.pickerRow}>
          <InfiniteWheel
            items={MONTHS}
            selectedIndex={selectedMonth}
            onIndexChange={handleMonthChange}
            width={80}
          />
          <InfiniteWheel
            items={days}
            selectedIndex={dayIndex}
            onIndexChange={handleDayChange}
            width={56}
            daysInMonth={daysInMonth}
          />
          <InfiniteWheel
            items={years}
            selectedIndex={yearIndex < 0 ? 0 : yearIndex}
            onIndexChange={handleYearChange}
            width={76}
          />
        </View>

        <View style={styles.spacer} />

        <Button title="Continue" onPress={handleContinue} loading={saving} fullWidth size="lg" />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.background },
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
    borderColor: colors.border,
  },
  backText:  { ...typography.body, color: colors.textSecondary, fontSize: 18 },
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
  title:     { ...typography.h1, color: '#fff', fontSize: 34, marginTop: 8 },
  subtitle:  { color: 'rgba(255,255,255,0.55)', fontSize: 15, marginTop: 10, lineHeight: 22, marginBottom: 40 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, height: WHEEL_HEIGHT },
  spacer:    { flex: 1 },
});

export default DOBSelectScreen;