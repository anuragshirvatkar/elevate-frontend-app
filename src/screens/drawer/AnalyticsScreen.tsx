import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { statsApi } from '../../api';
import { colors, spacing, typography } from '../../theme';
import type { StatsResponse, StatsPeriod } from '../../types';
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

const MOOD_LABELS = ['', 'Very Low', 'Low', 'Neutral', 'Good', 'Excellent'];

// ── Ring chart ─────────────────────────────────────────────────────────────
const RingChart = ({ percent, size = 136, stroke = 11 }: { percent: number; size?: number; stroke?: number }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, percent)) / 100);
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke="#1c1c1c" strokeWidth={stroke} fill="none" />
      <Circle
        cx={c} cy={c} r={r}
        stroke="#ffffff"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${c}, ${c}`}
      />
    </Svg>
  );
};

// ── Thin progress bar ───────────────────────────────────────────────────────
const Bar = ({ value }: { value: number }) => (
  <View style={s.barTrack}>
    <View style={[s.barFill, { width: `${Math.min(100, Math.max(0, value))}%` }]} />
  </View>
);

// ── Metric row (label + value, separator below) ─────────────────────────────
const Row = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View style={[s.row, last && s.rowLast]}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={s.rowValue}>{value}</Text>
  </View>
);

// ── Section heading (white SVG icon + bold text) ────────────────────────────
const Head = ({ Icon, label }: { Icon: React.ComponentType<any>; label: string }) => (
  <View style={s.head}>
    <Icon width={16} height={16} fill="#fff" stroke="#fff" color="#fff" />
    <Text style={s.headLabel}>{label}</Text>
  </View>
);

// ── Horizontal labelled bar (for comparison + activity breakdown) ───────────
const LabelBar = ({ label, value, pct }: { label: string; value: number; pct: string }) => (
  <View style={s.labelBarRow}>
    <Text style={s.labelBarName}>{label}</Text>
    <View style={s.labelBarTrack}>
      <View style={[s.labelBarFill, { width: `${Math.min(100, Math.max(0, value))}%` }]} />
    </View>
    <Text style={s.labelBarPct}>{pct}</Text>
  </View>
);

// ── Screen ──────────────────────────────────────────────────────────────────
const AnalyticsScreen = () => {
  const navigation = useNavigation();
  const [period, setPeriod] = useState<StatsPeriod>('30d');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: StatsPeriod) => {
    setLoading(true);
    try {
      const { data } = await statsApi.get({ period: p });
      setStats(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(period); }, [period, load]);
  useFocusEffect(useCallback(() => { load(period); }, [period, load]));

  const mindActive = stats && !('isActive' in stats.mind);
  const mindData = mindActive ? (stats!.mind as Exclude<StatsResponse['mind'], { isActive: false }>) : null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={s.headerTitle}>Analytics</Text>
      </View>

      {/* Period filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.periodRow}
        style={s.periodScroll}
      >
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[s.chip, period === p.value && s.chipActive]}
            onPress={() => setPeriod(p.value)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, period === p.value && s.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.text} /></View>
      ) : !stats ? (
        <View style={s.center}><Text style={s.empty}>Failed to load analytics.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Overview ─────────────────────────── */}
          <View style={s.overviewRow}>
            <View style={s.overviewItem}>
              <Text style={s.overviewNum}>{stats.overview.totalPoints.toLocaleString()}</Text>
              <Text style={s.overviewLabel}>Points</Text>
            </View>
            <View style={s.vDivider} />
            <View style={s.overviewItem}>
              <Text style={s.overviewNum}>{stats.overview.achievementsUnlocked}</Text>
              <Text style={s.overviewLabel}>Achievements</Text>
            </View>
            <View style={s.vDivider} />
            <View style={s.overviewItem}>
              <Text style={s.overviewNum}>{stats.overview.avatarsUnlocked}</Text>
              <Text style={s.overviewLabel}>Avatars</Text>
            </View>
          </View>

          <View style={s.sep} />

          {/* ── Consistency ───────────────────────── */}
          <Text style={s.sectionTitle}>Consistency</Text>

          <View style={s.ringBlock}>
            {/* Donut */}
            <View style={s.ringWrap}>
              <RingChart percent={stats.consistency.overallCompletionRate} />
              <View style={s.ringInner}>
                <Text style={s.ringPct}>{Math.round(stats.consistency.overallCompletionRate)}%</Text>
                <Text style={s.ringSub}>overall</Text>
              </View>
            </View>

            {/* Stats beside ring */}
            <View style={s.ringSide}>
              <View style={s.ringStat}>
                <Text style={s.ringStatNum}>{stats.consistency.activeDays}</Text>
                <Text style={s.ringStatLabel}>Active days</Text>
              </View>
              <View style={s.ringStat}>
                <Text style={s.ringStatNum}>{stats.consistency.missedDays}</Text>
                <Text style={s.ringStatLabel}>Missed days</Text>
              </View>
              {stats.consistency.bestSection && (
                <View style={s.ringStat}>
                  <Text style={s.ringStatNum}>{stats.consistency.bestSection}</Text>
                  <Text style={s.ringStatLabel}>Best section</Text>
                </View>
              )}
              {stats.consistency.weakestSection && (
                <View style={s.ringStat}>
                  <Text style={s.ringStatNum}>{stats.consistency.weakestSection}</Text>
                  <Text style={s.ringStatLabel}>Weakest section</Text>
                </View>
              )}
            </View>
          </View>

          {/* Section comparison chart */}
          <View style={s.compBlock}>
            {[
              { label: 'Power', value: stats.power.completionRate },
              { label: 'Craft', value: stats.craft.completionRate },
              ...(mindActive ? [{ label: 'Mind', value: mindData!.completionRate }] : []),
              {
                label: 'Journal',
                value: stats.journaling.totalDays > 0
                  ? (stats.journaling.completedDays / stats.journaling.totalDays) * 100
                  : 0,
              },
            ].map((item) => (
              <LabelBar
                key={item.label}
                label={item.label}
                value={item.value}
                pct={`${Math.round(item.value)}%`}
              />
            ))}
          </View>

          <View style={s.sep} />

          {/* ── Power ─────────────────────────────── */}
          <Head Icon={BicepIcon} label="Power" />
          <Row label="Completion" value={`${Math.round(stats.power.completionRate)}%`} />
          <Bar value={stats.power.completionRate} />
          <Row label="Active days" value={`${stats.power.completedDays} / ${stats.power.totalDays}`} />
          <Row label="Total hours" value={`${stats.power.totalHours.toFixed(1)}h`} last />
          {stats.power.activities.length > 0 && (
            <View style={s.subBlock}>
              {stats.power.activities.map((a) => (
                <LabelBar key={a.activityId} label={a.activityName} value={a.percentage} pct={`${a.percentage}%`} />
              ))}
            </View>
          )}

          <View style={s.sep} />

          {/* ── Craft ─────────────────────────────── */}
          <Head Icon={CraftIcon} label="Craft" />
          <Row label="Completion" value={`${Math.round(stats.craft.completionRate)}%`} />
          <Bar value={stats.craft.completionRate} />
          <Row label="Active days" value={`${stats.craft.completedDays} / ${stats.craft.totalDays}`} />
          <Row label="Total hours" value={`${stats.craft.totalHours.toFixed(1)}h`} last />
          {stats.craft.activities.length > 0 && (
            <View style={s.subBlock}>
              {stats.craft.activities.map((a) => (
                <LabelBar key={a.activityId} label={a.activityName} value={a.percentage} pct={`${a.percentage}%`} />
              ))}
            </View>
          )}

          <View style={s.sep} />

          {/* ── Mind ──────────────────────────────── */}
          <Head Icon={BrainIcon} label="Mind" />
          {mindActive && mindData ? (
            <>
              <Row label="Completion" value={`${Math.round(mindData.completionRate)}%`} />
              <Bar value={mindData.completionRate} />
              <Row label="Active days" value={`${mindData.completedDays} / ${mindData.totalDays}`} />
              <Row label="Books completed" value={`${mindData.booksCompleted}`} last />
              {mindData.books.length > 0 && (
                <View style={s.subBlock}>
                  {mindData.books.map((b) => (
                    <LabelBar key={b.bookId} label={b.title} value={b.percentage} pct={`${b.percentage}%`} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={s.inactive}>Mind section not active.</Text>
          )}

          <View style={s.sep} />

          {/* ── Purity ────────────────────────────── */}
          <Head Icon={PurityIcon} label="Purity" />
          <View style={s.purityRow}>
            <View style={s.purityItem}>
              <Text style={s.purityNum}>{stats.purity.currentStreak.days}</Text>
              <Text style={s.purityLabel}>Current{'\n'}streak</Text>
            </View>
            <View style={s.vDivider} />
            <View style={s.purityItem}>
              <Text style={s.purityNum}>{stats.purity.longestStreak.days}</Text>
              <Text style={s.purityLabel}>Best{'\n'}streak</Text>
            </View>
            <View style={s.vDivider} />
            <View style={s.purityItem}>
              <Text style={[s.purityNum, stats.purity.totalRelapses > 0 && s.relapse]}>
                {stats.purity.totalRelapses}
              </Text>
              <Text style={s.purityLabel}>Total{'\n'}relapses</Text>
            </View>
          </View>
          {stats.purity.currentStreak.startDate ? (
            <Text style={s.puritySince}>
              Streak started{' '}
              {new Date(stats.purity.currentStreak.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          ) : null}

          <View style={s.sep} />

          {/* ── Journaling ────────────────────────── */}
          <Text style={s.sectionTitle}>Journaling</Text>
          <Row
            label="Entries"
            value={`${stats.journaling.completedDays} / ${stats.journaling.totalDays} days`}
          />
          <Bar
            value={
              stats.journaling.totalDays > 0
                ? (stats.journaling.completedDays / stats.journaling.totalDays) * 100
                : 0
            }
          />
          {stats.journaling.averageMood != null && (
            <View style={s.moodRow}>
              <Text style={s.rowLabel}>Avg mood</Text>
              <View style={s.moodRight}>
                <View style={s.moodDots}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <View
                      key={v}
                      style={[s.moodDot, v <= Math.round(stats.journaling.averageMood!) && s.moodDotOn]}
                    />
                  ))}
                </View>
                <Text style={s.rowValue}>
                  {stats.journaling.averageMood.toFixed(1)}{' '}
                  <Text style={s.moodWord}>{MOOD_LABELS[Math.round(stats.journaling.averageMood)]}</Text>
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 52 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { ...typography.body, color: colors.textMuted },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { width: 36 },
  headerTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16 },

  // Period chips
  periodScroll: { borderBottomWidth: 1, borderBottomColor: colors.border },
  periodRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 8 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#0f0f0f',
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  chipTextActive: { color: colors.background },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sep: { height: 1, backgroundColor: '#1E1E1E', marginVertical: spacing.lg },

  // Overview
  overviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  overviewItem: { flex: 1, alignItems: 'center', gap: 6 },
  overviewNum: { fontSize: 30, fontWeight: '700', color: colors.text },
  overviewLabel: { fontSize: 10, color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  vDivider: { width: 1, height: 44, backgroundColor: '#1a1a1a' },

  // Section heading
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  headLabel: { color: colors.text, fontSize: 18, fontWeight: '700' },

  // Ring chart
  ringBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg },
  ringWrap: { width: 136, height: 136, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ringInner: { position: 'absolute', alignItems: 'center' },
  ringPct: { fontSize: 26, fontWeight: '700', color: colors.text },
  ringSub: { fontSize: 10, color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  ringSide: { flex: 1, gap: spacing.md },
  ringStat: { gap: 2 },
  ringStatNum: { fontSize: 18, fontWeight: '700', color: colors.text },
  ringStatLabel: { fontSize: 10, color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Comparison / activity bar
  compBlock: { gap: 10, marginBottom: spacing.xs },
  subBlock: { gap: 8, marginTop: spacing.sm },
  labelBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  labelBarName: { width: 58, fontSize: 12, color: '#666', fontWeight: '500' },
  labelBarTrack: { flex: 1, height: 3, backgroundColor: '#1c1c1c', borderRadius: 2 },
  labelBarFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  labelBarPct: { width: 34, fontSize: 12, fontWeight: '700', color: '#888', textAlign: 'right' },

  // Thin progress bar (between rows)
  barTrack: { height: 2, backgroundColor: '#1c1c1c', borderRadius: 1, marginBottom: spacing.xs },
  barFill: { height: 2, backgroundColor: '#fff', borderRadius: 1 },

  // Metric row
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 14, color: '#888' },
  rowValue: { fontSize: 14, fontWeight: '700', color: colors.text },

  // Purity
  purityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  purityItem: { flex: 1, alignItems: 'center', gap: 6 },
  purityNum: { fontSize: 30, fontWeight: '700', color: colors.text },
  purityLabel: { fontSize: 10, color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  puritySince: { fontSize: 12, color: '#555', textAlign: 'center', marginTop: -spacing.xs },
  relapse: { color: '#FF4444' },

  // Mood
  moodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
  moodRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moodDots: { flexDirection: 'row', gap: 3 },
  moodDot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#2a2a2a' },
  moodDotOn: { backgroundColor: colors.text, borderColor: colors.text },
  moodWord: { fontSize: 12, color: '#666', fontWeight: '400' },

  inactive: { fontSize: 14, color: '#555', paddingVertical: spacing.sm },
});

export default AnalyticsScreen;
