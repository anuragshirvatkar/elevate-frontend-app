import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { statsApi, activityLogsApi, activitiesApi } from '../../api';
import { useUser } from '../../context/UserContext';
import { colors, spacing, typography } from '../../theme';
import {
  enrichMonthlyMindFromLogs,
  getMonthlyMindEntries,
  getMonthlySectionEntries,
  hasMonthlyMindGreenDots,
  shouldShowMonthlyMind,
} from '../../utils/monthlyMind';
import type {
  StatsResponse, StatsPeriod, MonthlyActivityResponse, MonthlyDayEntry,
} from '../../types';
import BicepIcon from '../../../assets/bicep.svg';
import BrainIcon from '../../../assets/brain.svg';
import CraftIcon from '../../../assets/craft.svg';
import PurityIcon from '../../../assets/purity.svg';


const PERIODS: { label: string; value: StatsPeriod }[] = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' },
];

const POWER_COLOR  = '#A855F7';
const CRAFT_COLOR  = '#FF6B9D';
const MIND_COLOR   = '#54A9FF';
const PURITY_COLOR = '#3DFF86';
const JOURNAL_COLOR = '#F97316';

type ActivitySection = 'power' | 'craft' | 'mind' | 'purity';

const SECTION_ICONS: Record<ActivitySection, React.ComponentType<any>> = {
  power: BicepIcon,
  craft: CraftIcon,
  mind: BrainIcon,
  purity: PurityIcon,
};

const getMonthLabel = (monthValue: string, availableMonths: { value: string; label: string }[]) =>
  availableMonths.find((m) => m.value === monthValue)?.label ?? monthValue;

const isCountableDay = (day: MonthlyDayEntry | undefined) =>
  day?.didUserDo === true || day?.didUserDo === false;

const getDotStyle = (
  entry: MonthlyDayEntry | undefined,
  section: ActivitySection,
  rangeDay?: MonthlyDayEntry,
) => {
  const grey = { backgroundColor: '#1a1a1a' as const, borderColor: '#333' as const };
  const red = { backgroundColor: '#FF4444' as const, borderColor: '#FF4444' as const };
  const green = { backgroundColor: colors.success, borderColor: colors.success };

  if (section === 'purity') {
    if (!entry) return grey;
    if (entry.didUserRelapse === false) return green;
    if (entry.didUserRelapse === true) return red;
    return grey;
  }

  if (section === 'mind') {
    if (!isCountableDay(rangeDay)) return grey;
    if (entry?.didUserDo === true) return green;
    return red;
  }

  if (!entry) return grey;
  if (entry.didUserDo === true) return green;
  if (entry.didUserDo === false) return red;
  return grey;
};

// ── Donut chart ──────────────────────────────────────────────────────────────
const DonutChart = ({
  percent, color, size = 68, stroke = 6,
}: { percent: number; color: string; size?: number; stroke?: number }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, percent)) / 100);
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke="#1e1e1e" strokeWidth={stroke} fill="none" />
      <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
        strokeLinecap="round" rotation="-90" origin={`${c}, ${c}`}
      />
    </Svg>
  );
};

// ── Section card (full width) ────────────────────────────────────────────────
const SectionCard = ({
  Icon, title, rate, color, stats: gridStats, children, inactive,
}: {
  Icon: React.ComponentType<any>;
  title: string;
  rate: number;
  color: string;
  stats: { label: string; value: string }[];
  children?: React.ReactNode;
  inactive?: boolean;
}) => (
  <View style={s.card}>
    {inactive && (
      <View style={s.inactiveBadge}>
        <Text style={s.inactiveBadgeText}>Disabled</Text>
      </View>
    )}
    <View style={s.cardHeader}>
      <View style={s.cardLeft}>
        <View style={[s.cardIconWrap, { backgroundColor: color + '18', borderColor: color + '38' }]}>
          <Icon width={18} height={18} fill={inactive ? '#444' : color} stroke={inactive ? '#444' : color} color={inactive ? '#444' : color} />
        </View>
        <View>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={[s.cardRateLine, { color: inactive ? '#444' : color + 'bb' }]}>
            {inactive ? 'Not active' : `${Math.round(rate)}% completion`}
          </Text>
        </View>
      </View>
      <View style={s.donutWrap}>
        <DonutChart percent={inactive ? 0 : rate} color={inactive ? '#333' : color} size={68} stroke={6} />
        <View style={s.donutInner}>
          <Text style={[s.donutPct, { color: inactive ? '#444' : color }]}>
            {inactive ? '—' : `${Math.round(rate)}%`}
          </Text>
        </View>
      </View>
    </View>
    <View style={s.statsRow}>
      {gridStats.map((g, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={s.statDivider} />}
          <View style={s.statCell}>
            <Text style={[s.statValue, { color: inactive ? '#444' : colors.text }]}>{g.value}</Text>
            <Text style={s.statLabel}>{g.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
    {children}
  </View>
);

const chunkMonthDays = (days: MonthlyDayEntry[], size = 15): MonthlyDayEntry[][] => {
  if (!days.length) return [];
  return [days.slice(0, size), days.slice(size)].filter((chunk) => chunk.length > 0);
};

const MonthlyHalfGrid = ({
  days,
  sections,
  monthlyData,
}: {
  days: MonthlyDayEntry[];
  sections: ActivitySection[];
  monthlyData: MonthlyActivityResponse;
}) => (
  <View style={s.halfGrid}>
    <View style={s.halfRow}>
      <View style={s.pillarIconCol} />
      {days.map((day) => (
        <View key={`num-${day.date}`} style={s.halfDayCol}>
          <Text style={s.halfDayNum}>{parseInt(day.date.slice(8, 10), 10)}</Text>
        </View>
      ))}
    </View>

    {sections.map((section) => {
      const entries = getMonthlySectionEntries(monthlyData, section);
      const Icon = SECTION_ICONS[section];
      return (
        <View key={section} style={s.halfRow}>
          <View style={s.pillarIconCol}>
            <Icon
              width={section === 'power' ? 16 : 14}
              height={section === 'power' ? 16 : 14}
              fill="#FFFFFF"
              stroke="#FFFFFF"
              color="#FFFFFF"
              strokeWidth={section === 'power' ? 2.2 : 1.4}
            />
          </View>
          {days.map((day) => {
            const entry = entries.find((e) => e.date === day.date);
            const rangeDay = section === 'mind'
              ? monthlyData.power.find((e) => e.date === day.date)
              : undefined;
            const dotColors = getDotStyle(entry, section, rangeDay);
            return (
              <View key={`${day.date}-${section}`} style={s.halfDayCol}>
                <View style={[s.pillarDot, dotColors]} />
              </View>
            );
          })}
        </View>
      );
    })}
  </View>
);

const MonthlyPillarGrid = ({
  monthDays,
  sections,
  monthlyData,
}: {
  monthDays: MonthlyDayEntry[];
  sections: ActivitySection[];
  monthlyData: MonthlyActivityResponse;
}) => {
  const halves = chunkMonthDays(monthDays, 15);
  return (
    <View style={s.pillarGrid}>
      {halves.map((days, idx) => (
        <View key={`half-${idx}`} style={idx > 0 ? s.halfGridSpaced : undefined}>
          {idx > 0 && <View style={s.halfDivider} />}
          <MonthlyHalfGrid days={days} sections={sections} monthlyData={monthlyData} />
        </View>
      ))}
    </View>
  );
};

// ── Screen ───────────────────────────────────────────────────────────────────
const AnalyticsScreen = () => {
  const { profile, fetchProfile } = useUser();
  const isFemale = profile?.gender === 'female';
  const [period, setPeriod] = useState<StatsPeriod>('30d');
  const [pendingPeriod, setPendingPeriod] = useState<StatsPeriod>('30d');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyActivityResponse | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const selectedMonthRef = useRef<string | undefined>();

  const loadMonthly = useCallback(async (month?: string) => {
    setMonthlyLoading(true);
    try {
      const { data } = await activityLogsApi.getMonthly(month);
      let nextData = data;

      if (!Array.isArray(data.mind)) {
        const existingMind = getMonthlyMindEntries(data.mind);
        if (hasMonthlyMindGreenDots(existingMind)) {
          nextData = { ...data, mind: { isActive: false, days: existingMind } };
        } else {
          try {
            const { data: logs } = await activitiesApi.getAllLogs();
            nextData = enrichMonthlyMindFromLogs(data, logs);
          } catch {}
        }
      }

      setMonthlyData(nextData);
    } catch {
      if (!month) setMonthlyData(null);
    }
    setMonthlyLoading(false);
  }, []);

  const load = useCallback(async (p: StatsPeriod) => {
    setLoading(true);
    try {
      const { data } = await statsApi.get({ period: p });
      setStats(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(period); }, [period, load]);
  useEffect(() => {
    if (monthlyData?.selectedMonth) {
      selectedMonthRef.current = monthlyData.selectedMonth;
    }
  }, [monthlyData?.selectedMonth]);
  useFocusEffect(useCallback(() => {
    fetchProfile();
    load(period);
    loadMonthly(selectedMonthRef.current);
  }, [period, load, loadMonthly, fetchProfile]));

  const mindActive = stats && !('isActive' in stats.mind);
  const mindData = mindActive ? (stats!.mind as Exclude<StatsResponse['mind'], { isActive: false }>) : null;

  const monthlyMindVisible = shouldShowMonthlyMind(monthlyData?.mind);

  const monthlySections = useMemo(() => (
    (['power', 'craft', 'mind', 'purity'] as const).filter((section) => {
      if (section === 'mind' && !monthlyMindVisible) return false;
      if (section === 'purity' && isFemale) return false;
      return true;
    })
  ), [monthlyMindVisible, isFemale]);

  const monthDays = monthlyData?.power ?? [];

  const handleMonthSelect = (value: string) => {
    if (value === monthlyData?.selectedMonth) return;
    setShowMonthPicker(false);
    loadMonthly(value);
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const overallRate = stats?.consistency.overallCompletionRate ?? 0;
  const overallColor = overallRate >= 70 ? CRAFT_COLOR : overallRate >= 40 ? POWER_COLOR : '#FF5A5A';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Analytics</Text>
      </View>

      {loading && !stats && monthlyLoading ? (
        <View style={s.center}><ActivityIndicator color={colors.text} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Monthly Activity ───────────────────── */}
          <View style={s.activityCard}>
            {monthlyLoading && !monthlyData ? (
              <ActivityIndicator color={colors.text} style={s.sectionLoader} />
            ) : monthlyData ? (
              <>
                <View style={s.monthlyToolbar}>
                  <TouchableOpacity
                    style={s.monthSelector}
                    onPress={() => setShowMonthPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.monthSelectorText}>
                      {getMonthLabel(monthlyData.selectedMonth, monthlyData.availableMonths)}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                  <Text style={s.monthScoreText}>
                    <Text style={s.monthScoreGreen}>{monthlyData.score.green}</Text>
                    <Text style={s.monthScoreMuted}> / {monthlyData.score.total}</Text>
                  </Text>
                </View>

                {monthlyLoading && <ActivityIndicator color={colors.text} style={s.inlineLoader} />}

                <MonthlyPillarGrid
                  monthDays={monthDays}
                  sections={monthlySections}
                  monthlyData={monthlyData}
                />
              </>
            ) : (
              <Text style={s.sectionEmpty}>Failed to load monthly activity.</Text>
            )}
          </View>

          {loading && !stats ? (
            <View style={s.statsLoader}><ActivityIndicator color={colors.text} /></View>
          ) : !stats ? (
            <Text style={s.sectionEmpty}>Failed to load analytics.</Text>
          ) : (
          <>
          {/* ── Period row ──────────────────────────── */}
          <View style={s.periodRow}>
            <View>
              <Text style={s.periodLabelText}>
                {PERIODS.find(p => p.value === period)?.label ?? ''} Overview
              </Text>
              {stats?.filters && (
                <Text style={s.periodDateText}>
                  {fmtDate(stats.filters.startDate)} – {fmtDate(stats.filters.endDate)}
                </Text>
              )}
            </View>
            <TouchableOpacity style={s.filterBtn} onPress={() => { setPendingPeriod(period); setShowFilterModal(true); }} activeOpacity={0.7}>
              <Ionicons name="options-outline" size={18} color={colors.text} />
              {period !== '30d' && <View style={s.filterDot} />}
            </TouchableOpacity>
          </View>

          {/* ── Insight ────────────────────────────── */}
          {(stats.consistency.bestSection || stats.consistency.weakestSection) && (
            <View style={s.insightCard}>
              <View style={s.insightIconRow}>
                <Ionicons name="trending-up" size={15} color={CRAFT_COLOR} />
                <Text style={s.insightTitle}>Insight</Text>
              </View>
              <Text style={s.insightText}>
                {`You showed up on ${stats.consistency.activeDays} of the last ${stats.consistency.activeDays + stats.consistency.missedDays} days.`}
                {stats.consistency.bestSection ? ` ${stats.consistency.bestSection} is leading your growth.` : ''}
                {stats.consistency.weakestSection ? ` ${stats.consistency.weakestSection} has the biggest opportunity right now.` : ''}
              </Text>
            </View>
          )}

          {/* ── Overview tiles ────────────────────── */}
          <View style={s.tilesRow}>
            <View style={s.tile}>
              <Ionicons name="star" size={18} color={POWER_COLOR} />
              <Text style={s.tileLabel}>Points</Text>
              <Text style={s.tileNum}>{stats.overview.totalPoints.toLocaleString()}</Text>
            </View>
            <View style={s.tile}>
              <Ionicons name="trophy" size={18} color={CRAFT_COLOR} />
              <Text style={s.tileLabel}>Achievements</Text>
              <Text style={s.tileNum}>{stats.overview.achievementsUnlocked}</Text>
            </View>
            <View style={s.tile}>
              <Ionicons name="person" size={18} color={MIND_COLOR} />
              <Text style={s.tileLabel}>Avatars</Text>
              <Text style={s.tileNum}>{stats.overview.avatarsUnlocked}</Text>
            </View>
          </View>

          {/* ── Overall Consistency ───────────────── */}
          <View style={s.consistencyCard}>
            <View style={s.consistencyTop}>
              <View style={s.ringWrap}>
                <DonutChart percent={overallRate} color={overallColor} size={88} stroke={8} />
                <View style={s.ringInner}>
                  <Text style={[s.ringPct, { color: overallColor }]}>{Math.round(overallRate)}%</Text>
                </View>
              </View>
              <View style={s.consistencyRight}>
                <Text style={s.consistencyTitle}>Overall Consistency</Text>
                <Text style={s.consistencyDesc}>
                  You showed up on{' '}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{stats.consistency.activeDays}</Text>
                  {' '}of the last{' '}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {stats.consistency.activeDays + stats.consistency.missedDays}
                  </Text>
                  {' '}days.
                </Text>
              </View>
            </View>
            <View style={s.consistencyDivider} />
            <View style={s.consistencyStatsRow}>
              <View style={s.cStat}>
                <Text style={s.cStatNum}>{stats.consistency.activeDays}</Text>
                <Text style={s.cStatLabel}>Active Days</Text>
              </View>
              <View style={s.cStatDivider} />
              <View style={s.cStat}>
                <Text style={s.cStatNum}>{stats.consistency.missedDays}</Text>
                <Text style={s.cStatLabel}>Missed</Text>
              </View>
              {stats.consistency.bestSection && (
                <>
                  <View style={s.cStatDivider} />
                  <View style={s.cStat}>
                    <Text style={s.cStatNum}>{stats.consistency.bestSection}</Text>
                    <Text style={s.cStatLabel}>Best</Text>
                  </View>
                </>
              )}
              {stats.consistency.weakestSection && (
                <>
                  <View style={s.cStatDivider} />
                  <View style={s.cStat}>
                    <Text style={s.cStatNum}>{stats.consistency.weakestSection}</Text>
                    <Text style={s.cStatLabel}>Improve</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── Power ─────────────────────────────── */}
          <SectionCard
            Icon={BicepIcon}
            title="Power"
            rate={stats.power.completionRate}
            color={POWER_COLOR}
            stats={[
              { label: 'Active Days', value: `${stats.power.completedDays} / ${stats.power.totalDays}` },
              { label: 'Total Hours', value: `${stats.power.totalHours.toFixed(1)}h` },
            ]}
          />

          {/* ── Craft ─────────────────────────────── */}
          <SectionCard
            Icon={CraftIcon}
            title="Craft"
            rate={stats.craft.completionRate}
            color={CRAFT_COLOR}
            stats={[
              { label: 'Active Days', value: `${stats.craft.completedDays} / ${stats.craft.totalDays}` },
              { label: 'Total Hours', value: `${stats.craft.totalHours.toFixed(1)}h` },
            ]}
          />

          {/* ── Mind ─────────────────────────────── */}
          <SectionCard
            Icon={BrainIcon}
            title="Mind"
            rate={mindActive && mindData ? mindData.completionRate : 0}
            color={MIND_COLOR}
            inactive={!mindActive}
            stats={mindActive && mindData ? [
              { label: 'Active Days', value: `${mindData.completedDays} / ${mindData.totalDays}` },
              { label: 'Books Done', value: `${mindData.booksCompleted}` },
            ] : [
              { label: 'Days', value: '—' },
              { label: 'Books', value: '—' },
            ]}
          />

          {/* ── Purity ─────────────────────────────── */}
          {!isFemale && <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.cardLeft}>
                <View style={[s.cardIconWrap, { backgroundColor: PURITY_COLOR + '18', borderColor: PURITY_COLOR + '38' }]}>
                  <PurityIcon width={18} height={18} fill={PURITY_COLOR} stroke={PURITY_COLOR} color={PURITY_COLOR} />
                </View>
                <View>
                  <Text style={s.cardTitle}>Purity</Text>
                  <Text style={[s.cardRateLine, { color: stats.purity.totalRelapses === 0 ? PURITY_COLOR + 'bb' : '#FF5A5Abb' }]}>
                    {stats.purity.totalRelapses === 0 ? 'Staying clean' : `${stats.purity.totalRelapses} relapse${stats.purity.totalRelapses !== 1 ? 's' : ''}`}
                  </Text>
                </View>
              </View>
              <View style={s.purityFraction}>
                <View style={s.purityFractionTop}>
                  <Text style={[s.purityFractionNum, { color: stats.purity.totalRelapses === 0 ? PURITY_COLOR : '#FF5A5A' }]}>
                    {stats.purity.totalRelapses}
                  </Text>
                  <Text style={s.purityFractionSlash}>/</Text>
                  <Text style={[s.purityFractionNum, { color: PURITY_COLOR }]}>
                    {stats.consistency.activeDays}
                  </Text>
                </View>
                <Text style={s.purityFractionLabel}>Relapses / Active Days</Text>
              </View>
            </View>
            {!!stats.purity.insightNote && (
              <View style={s.purityInsightRow}>
                <Text style={s.purityInsightText}>{stats.purity.insightNote}</Text>
              </View>
            )}
          </View>}

          {/* ── Journaling ────────────────────────── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.cardLeft}>
                <View style={[s.cardIconWrap, { backgroundColor: JOURNAL_COLOR + '18', borderColor: JOURNAL_COLOR + '38' }]}>
                  <Ionicons name="journal-outline" size={18} color={JOURNAL_COLOR} />
                </View>
                <View>
                  <Text style={s.cardTitle}>Journaling</Text>
                  <Text style={[s.cardRateLine, { color: JOURNAL_COLOR + 'bb' }]}>
                    {stats.journaling.totalDays > 0
                      ? `${Math.round((stats.journaling.completedDays / stats.journaling.totalDays) * 100)}% completion`
                      : 'No data'}
                  </Text>
                </View>
              </View>
              <View style={s.donutWrap}>
                <DonutChart
                  percent={stats.journaling.totalDays > 0
                    ? (stats.journaling.completedDays / stats.journaling.totalDays) * 100 : 0}
                  color={JOURNAL_COLOR} size={68} stroke={6}
                />
                <View style={s.donutInner}>
                  <Text style={[s.donutPct, { color: JOURNAL_COLOR }]}>
                    {stats.journaling.totalDays > 0
                      ? `${Math.round((stats.journaling.completedDays / stats.journaling.totalDays) * 100)}%`
                      : '—'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={s.statsRow}>
              <View style={s.statCell}>
                <Text style={s.statValue}>{stats.journaling.completedDays}</Text>
                <Text style={s.statLabel}>Entries</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCell}>
                <Text style={s.statValue}>{stats.journaling.totalDays}</Text>
                <Text style={s.statLabel}>Total Days</Text>
              </View>
              {stats.journaling.averageMood != null && (
                <>
                  <View style={s.statDivider} />
                  <View style={s.statCell}>
                    <Text style={s.statValue}>{stats.journaling.averageMood.toFixed(1)} / 5</Text>
                    <Text style={s.statLabel}>Avg Mood</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={{ height: 52 }} />
          </>
          )}
        </ScrollView>
      )}

      {/* Month Picker Modal */}
      <Modal visible={showMonthPicker} transparent animationType="slide" onRequestClose={() => setShowMonthPicker(false)}>
        <TouchableOpacity style={s.filterOverlay} activeOpacity={1} onPress={() => setShowMonthPicker(false)}>
          <View style={s.filterSheet} onStartShouldSetResponder={() => true}>
            <View style={s.filterSheetHeader}>
              <Text style={s.filterSheetTitle}>Select Month</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.monthPickerList} showsVerticalScrollIndicator={false}>
              {[...(monthlyData?.availableMonths ?? [])].reverse().map((m) => {
                const selected = m.value === monthlyData?.selectedMonth;
                return (
                  <TouchableOpacity
                    key={m.value}
                    style={[s.monthPickerItem, selected && s.monthPickerItemActive]}
                    onPress={() => handleMonthSelect(m.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.monthPickerItemText, selected && s.monthPickerItemTextActive]}>
                      {m.label}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={18} color={colors.text} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity style={s.filterOverlay} activeOpacity={1} onPress={() => setShowFilterModal(false)}>
          <View style={s.filterSheet} onStartShouldSetResponder={() => true}>
            <View style={s.filterSheetHeader}>
              <Text style={s.filterSheetTitle}>Filter Analytics</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={s.filterSectionLabel}>Period</Text>
            <View style={s.filterOptions}>
              {PERIODS.map(p => (
                <TouchableOpacity
                  key={p.value}
                  style={[s.filterOption, pendingPeriod === p.value && s.filterOptionActive]}
                  onPress={() => setPendingPeriod(p.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.filterOptionText, pendingPeriod === p.value && s.filterOptionTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.filterActions}>
              <TouchableOpacity style={s.filterClearBtn} onPress={() => { setPeriod('30d'); setPendingPeriod('30d'); setShowFilterModal(false); }} activeOpacity={0.7}>
                <Text style={s.filterClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.filterApplyBtn} onPress={() => { setPeriod(pendingPeriod); setShowFilterModal(false); }} activeOpacity={0.85}>
                <Text style={s.filterApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 14, color: colors.textMuted },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  filterBtn: { width: 36, alignItems: 'flex-end', position: 'relative' },
  filterDot: { position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },

  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodLabelText: { fontSize: 15, color: colors.text, fontWeight: '700' },
  periodDateText: { fontSize: 11, color: '#555', marginTop: 2 },

  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  activityCard: {
    backgroundColor: '#070707', borderRadius: 18, borderWidth: 1, borderColor: '#1e1e1e', padding: 14,
  },
  monthlyToolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthSelector: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthSelectorText: { fontSize: 14, fontWeight: '700', color: colors.text },
  monthScoreText: { fontSize: 14, fontWeight: '700' },
  monthScoreGreen: { color: colors.text },
  monthScoreMuted: { color: colors.textMuted, fontWeight: '600' },
  pillarGrid: { gap: 0 },
  halfGrid: { gap: 3 },
  halfGridSpaced: { marginTop: 4 },
  halfDivider: { height: 1, backgroundColor: '#1a1a1a', marginBottom: 10, marginTop: 6 },
  halfRow: { flexDirection: 'row', alignItems: 'center' },
  pillarIconCol: { width: 22, alignItems: 'center', justifyContent: 'center' },
  halfDayCol: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 16 },
  halfDayNum: { fontSize: 8, fontWeight: '600', color: '#555', marginBottom: 3 },
  pillarDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
  monthPickerList: { maxHeight: 320 },
  monthPickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  monthPickerItemActive: { backgroundColor: '#111' },
  monthPickerItemText: { fontSize: 14, color: '#888' },
  monthPickerItemTextActive: { color: colors.text, fontWeight: '600' },
  sectionLoader: { marginVertical: 20 },
  inlineLoader: { marginVertical: 8 },
  sectionEmpty: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginVertical: 16 },
  statsLoader: { paddingVertical: 40, alignItems: 'center' },

  // Overview tiles
  tilesRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1, backgroundColor: '#070707', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e1e',
    paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center', gap: 6,
  },
  tileLabel: { fontSize: 11, color: '#555', fontWeight: '500', textAlign: 'center' },
  tileNum: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: colors.text },

  // Consistency card
  consistencyCard: {
    backgroundColor: '#070707', borderRadius: 18, borderWidth: 1, borderColor: '#1e1e1e', padding: 18,
  },
  consistencyTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  ringWrap: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  ringInner: { position: 'absolute', alignItems: 'center' },
  ringPct: { fontSize: 16, fontWeight: '700' },
  consistencyRight: { flex: 1 },
  consistencyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 5 },
  consistencyDesc: { fontSize: 12, color: '#666', lineHeight: 19 },
  consistencyDivider: { height: 1, backgroundColor: '#1e1e1e', marginBottom: 16 },
  consistencyStatsRow: { flexDirection: 'row', alignItems: 'center' },
  cStat: { flex: 1, alignItems: 'center', gap: 3 },
  cStatDivider: { width: 1, height: 28, backgroundColor: '#1e1e1e' },
  cStatNum: { fontSize: 13, fontWeight: '700', color: colors.text },
  cStatLabel: { fontSize: 10, color: '#555', fontWeight: '500' },

  // Donut
  donutWrap: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  donutInner: { position: 'absolute', alignItems: 'center' },
  donutPct: { fontSize: 12, fontWeight: '700' },

  // Section cards (full width)
  card: {
    backgroundColor: '#070707', borderRadius: 18, borderWidth: 1, borderColor: '#1e1e1e', padding: 18,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  cardRateLine: { fontSize: 12, fontWeight: '500' },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#1e1e1e',
  },
  statCell: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, height: 28, backgroundColor: '#1e1e1e' },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 10, color: '#555', fontWeight: '500' },

  // Inactive badge
  inactiveBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: '#1a1a1a', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, zIndex: 1,
  },
  inactiveBadgeText: { fontSize: 10, color: '#555', fontWeight: '600' },

  // Insight
  insightCard: {
    backgroundColor: '#070707', borderRadius: 16, borderWidth: 0.5,
    borderColor: '#444444', padding: 16,
  },
  insightIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  insightTitle: { fontSize: 12, fontWeight: '700', color: colors.text },
  insightText: { fontSize: 12, color: '#666', lineHeight: 19 },

  // Filter modal
  filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  filterSheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  filterSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  filterSheetTitle: { ...typography.h3, color: colors.text },
  filterSectionLabel: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterOption: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: '#0f0f0f',
  },
  filterOptionActive: { borderColor: colors.text, backgroundColor: '#1a1a1a' },
  filterOptionText: { color: '#666', fontSize: 13 },
  filterOptionTextActive: { color: colors.text, fontWeight: '600' },
  filterActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  filterClearBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  filterClearText: { color: '#666', fontSize: 14, fontWeight: '600' },
  filterApplyBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center' },
  filterApplyText: { color: colors.background, fontSize: 14, fontWeight: '700' },
  purityFraction: { alignItems: 'center', justifyContent: 'center' },
  purityFractionTop: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  purityFractionNum: { fontSize: 22, fontWeight: '800' },
  purityFractionSlash: { fontSize: 18, fontWeight: '400', color: '#555', marginHorizontal: 2 },
  purityFractionLabel: { fontSize: 10, color: colors.textMuted, marginTop: 3, textAlign: 'center' },
  purityInsightRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
  },
  purityInsightText: { fontSize: 12, color: '#666', lineHeight: 18 },
});

export default AnalyticsScreen;
