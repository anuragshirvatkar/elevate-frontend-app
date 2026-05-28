import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal,
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

// ── Ring chart ──────────────────────────────────────────────────────────────
const RingChart = ({ percent, size = 80, stroke = 8 }: { percent: number; size?: number; stroke?: number }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, percent)) / 100);
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke="#1c1c1c" strokeWidth={stroke} fill="none" />
      <Circle cx={c} cy={c} r={r} stroke="#ffffff" strokeWidth={stroke} fill="none"
        strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
        strokeLinecap="round" rotation="-90" origin={`${c}, ${c}`}
      />
    </Svg>
  );
};

// ── Progress bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ value, height = 3, color = '#fff' }: { value: number; height?: number; color?: string }) => (
  <View style={[s.barTrack, { height }]}>
    <View style={[s.barFill, { width: `${Math.min(100, Math.max(0, value))}%`, height, backgroundColor: color }]} />
  </View>
);

// ── Activity row ─────────────────────────────────────────────────────────────
const ActivityRow = ({ label, pct }: { label: string; pct: number }) => (
  <View style={s.actRow}>
    <Text style={s.actName}>{label}</Text>
    <View style={s.actBarWrap}>
      <ProgressBar value={pct} height={3} />
    </View>
    <Text style={s.actPct}>{pct}%</Text>
  </View>
);

// ── Grid stat cell ───────────────────────────────────────────────────────────
const GridStat = ({ label, value }: { label: string; value: string }) => (
  <View style={s.gridCell}>
    <Text style={s.gridValue}>{value}</Text>
    <Text style={s.gridLabel}>{label}</Text>
  </View>
);

// ── Section card ─────────────────────────────────────────────────────────────
const SectionCard = ({
  Icon, title, rate, stats: gridStats, children,
}: {
  Icon: React.ComponentType<any>;
  title: string;
  rate: number;
  stats: { label: string; value: string }[];
  children?: React.ReactNode;
}) => (
  <View style={[s.card, { flex: 1 }]}>
    <View style={s.cardHeader}>
      <View style={s.cardLeft}>
        <View style={s.cardIconWrap}>
          <Icon width={18} height={18} fill="#fff" stroke="#fff" color="#fff" />
        </View>
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      <Text style={s.cardRate}>{Math.round(rate)}%</Text>
    </View>
    <ProgressBar value={rate} height={2} />
    <View style={s.gridWrap}>
      {gridStats.map((g, i) => <GridStat key={i} label={g.label} value={g.value} />)}
    </View>
    {children}
  </View>
);

// ── Screen ───────────────────────────────────────────────────────────────────
const AnalyticsScreen = () => {
  const navigation = useNavigation();
  const [period, setPeriod] = useState<StatsPeriod>('30d');
  const [pendingPeriod, setPendingPeriod] = useState<StatsPeriod>('30d');
  const [showFilterModal, setShowFilterModal] = useState(false);
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

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

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

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.text} /></View>
      ) : !stats ? (
        <View style={s.center}><Text style={s.empty}>Failed to load analytics.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Period label + filter ──────────────── */}
          <View style={s.periodRow}>
            <View>
              <Text style={s.periodLabelText}>Last {PERIODS.find(p => p.value === period)?.label ?? ''}</Text>
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

          {/* ── Overview tiles ────────────────────── */}
          <View style={s.tilesRow}>
            <View style={s.tile}>
              <Ionicons name="star-outline" size={18} color="#888" />
              <Text style={s.tileLabel}>Points</Text>
              <Text style={s.tileNum}>{stats.overview.totalPoints.toLocaleString()}</Text>
            </View>
            <View style={s.tile}>
              <Ionicons name="trophy-outline" size={18} color="#888" />
              <Text style={s.tileLabel}>Achievements</Text>
              <Text style={s.tileNum}>{stats.overview.achievementsUnlocked}</Text>
            </View>
            <View style={s.tile}>
              <Ionicons name="person-outline" size={18} color="#888" />
              <Text style={s.tileLabel}>Avatars</Text>
              <Text style={s.tileNum}>{stats.overview.avatarsUnlocked}</Text>
            </View>
          </View>

          {/* ── Overall Consistency ───────────────── */}
          <View style={s.consistencyCard}>
            {/* Top: ring left, note right */}
            <View style={s.consistencyTop}>
              <View style={s.ringWrap}>
                <RingChart percent={stats.consistency.overallCompletionRate} size={80} stroke={8} />
                <View style={s.ringInner}>
                  <Text style={s.ringPct}>{Math.round(stats.consistency.overallCompletionRate)}%</Text>
                </View>
              </View>
              <View style={s.consistencyRight}>
                <Text style={s.consistencyTitle}>Overall Consistency</Text>
                <Text style={s.consistencyDesc}>
                  You showed up on {stats.consistency.activeDays} of the last {stats.consistency.activeDays + stats.consistency.missedDays} days.
                </Text>
              </View>
            </View>
            {/* Divider */}
            <View style={s.consistencyDivider} />
            {/* Stats row */}
            <View style={s.consistencyStatsRow}>
              <View style={s.cStat}>
                <Text style={s.cStatNum}>{stats.consistency.activeDays}</Text>
                <Text style={s.cStatLabel}>Active Days</Text>
              </View>
              <View style={s.cStatDivider} />
              <View style={s.cStat}>
                <Text style={s.cStatNum}>{stats.consistency.missedDays}</Text>
                <Text style={s.cStatLabel}>Missed Days</Text>
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

          {/* ── Power + Craft row ─────────────────── */}
          <View style={s.cardRow}>
            <SectionCard
              Icon={BicepIcon}
              title="Power"
              rate={stats.power.completionRate}
              stats={[
                { label: 'Active Days', value: `${stats.power.completedDays} / ${stats.power.totalDays}` },
                { label: 'Hours', value: `${stats.power.totalHours.toFixed(1)}h` },
              ]}
            />
            <SectionCard
              Icon={CraftIcon}
              title="Craft"
              rate={stats.craft.completionRate}
              stats={[
                { label: 'Active Days', value: `${stats.craft.completedDays} / ${stats.craft.totalDays}` },
                { label: 'Hours', value: `${stats.craft.totalHours.toFixed(1)}h` },
              ]}
            />
          </View>

          {/* ── Mind + Purity row ─────────────────── */}
          <View style={s.cardRow}>
            <View style={[{ flex: 1 }, !mindActive && s.mindInactive]}>
              <SectionCard
                Icon={BrainIcon}
                title="Mind"
                rate={mindActive && mindData ? mindData.completionRate : 0}
                stats={mindActive && mindData ? [
                  { label: 'Active Days', value: `${mindData.completedDays} / ${mindData.totalDays}` },
                  { label: 'Books Done', value: `${mindData.booksCompleted}` },
                ] : [
                  { label: 'Days', value: '—' },
                  { label: 'Books', value: '—' },
                ]}
              />
              {!mindActive && (
                <View style={s.mindInactiveBadge}>
                  <Text style={s.mindInactiveBadgeText}>Disabled</Text>
                </View>
              )}
            </View>
            <View style={[s.card, { flex: 1 }]}>
              <View style={s.cardHeader}>
                <View style={s.cardLeft}>
                  <View style={s.cardIconWrap}>
                    <PurityIcon width={18} height={18} fill="#fff" stroke="#fff" color="#fff" />
                  </View>
                  <Text style={s.cardTitle}>Purity</Text>
                </View>
              </View>
              <View style={s.miniGrid}>
                <View style={s.miniCell}>
                  <Text style={[s.gridValue, stats.purity.totalRelapses > 0 && s.relapse]}>{stats.purity.totalRelapses}</Text>
                  <Text style={s.gridLabel}>Relapses</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Journaling ────────────────────────── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.cardLeft}>
                <View style={s.cardIconWrap}>
                  <Ionicons name="journal-outline" size={18} color="#fff" />
                </View>
                <Text style={s.cardTitle}>Journaling</Text>
              </View>
            </View>
            <ProgressBar
              value={stats.journaling.totalDays > 0
                ? (stats.journaling.completedDays / stats.journaling.totalDays) * 100 : 0}
              height={2}
            />
            <View style={s.statRow}>
              <View style={s.statCell}>
                <Text style={s.gridValue}>{stats.journaling.completedDays}</Text>
                <Text style={s.gridLabel}>Entries</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCell}>
                <Text style={s.gridValue}>{stats.journaling.totalDays}</Text>
                <Text style={s.gridLabel}>Total Days</Text>
              </View>
              {stats.journaling.averageMood != null && (
                <>
                  <View style={s.statDivider} />
                  <View style={s.statCell}>
                    <Text style={s.gridValue}>{stats.journaling.averageMood.toFixed(1)} / 5</Text>
                    <Text style={s.gridLabel}>Avg Mood</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── Bottom insight ────────────────────── */}
          {(stats.consistency.bestSection || stats.consistency.weakestSection) && (
            <View style={s.insightCard}>
              <Ionicons name="trending-up" size={16} color="#555" style={{ marginBottom: 6 }} />
              <Text style={s.insightText}>
                {`You showed up on ${stats.consistency.activeDays} of the last ${stats.consistency.activeDays + stats.consistency.missedDays} days.`}
                {stats.consistency.bestSection ? ` ${stats.consistency.bestSection} is leading your growth.` : ''}
                {stats.consistency.weakestSection ? ` ${stats.consistency.weakestSection} has the biggest opportunity right now.` : ''}
              </Text>
            </View>
          )}

          <View style={{ height: 52 }} />
        </ScrollView>
      )}

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
  inactive: { fontSize: 13, color: '#555', paddingTop: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { width: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 12, color: '#555', marginTop: 2 },
  filterBtn: { width: 36, alignItems: 'flex-end', position: 'relative' },
  filterDot: { position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },

  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodLabelText: { fontSize: 13, color: colors.text, fontWeight: '700' },
  periodDateText: { fontSize: 11, color: '#555', marginTop: 2 },

  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

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

  // Overview tiles
  tilesRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1, backgroundColor: '#111', borderRadius: 16, borderWidth: 1,
    borderColor: '#222', paddingVertical: 16, paddingHorizontal: 12,
    alignItems: 'center', gap: 6,
  },
  tileLabel: { fontSize: 11, color: '#555', fontWeight: '500', textAlign: 'center' },
  tileNum: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },

  // Consistency card
  consistencyCard: {
    backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e1e', padding: 16,
  },
  consistencyTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  ringWrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  ringInner: { position: 'absolute', alignItems: 'center' },
  ringPct: { fontSize: 18, fontWeight: '700', color: colors.text },
  consistencyRight: { flex: 1 },
  consistencyTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  consistencyDesc: { fontSize: 12, color: '#555', lineHeight: 18 },
  consistencyDivider: { height: 1, backgroundColor: '#1e1e1e', marginBottom: 14 },
  consistencyStatsRow: { flexDirection: 'row', alignItems: 'center' },
  cStat: { flex: 1, alignItems: 'center', gap: 3 },
  cStatDivider: { width: 1, height: 28, backgroundColor: '#1e1e1e' },
  cStatNum: { fontSize: 14, fontWeight: '700', color: colors.text },
  cStatLabel: { fontSize: 10, color: '#555', fontWeight: '500' },

  cardRow: { flexDirection: 'row', gap: 10 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  statCell: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, height: 28, backgroundColor: '#1e1e1e' },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 4 },
  miniCell: { flex: 1, minWidth: '45%', gap: 2 },

  // Section card
  card: {
    backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e1e', padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardIconWrap: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#1a1a1a',
    borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  cardRate: { fontSize: 16, fontWeight: '800', color: colors.text },
  // 2x2 grid
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 10, overflow: 'hidden' },
  gridCell: { width: '50%', padding: 12, gap: 3 },
  gridValue: { fontSize: 12, fontWeight: '700', color: colors.text },
  gridLabel: { fontSize: 10, color: '#555', fontWeight: '500' },

  // Progress bar
  barTrack: { backgroundColor: '#1c1c1c', borderRadius: 2 },
  barFill: { borderRadius: 2 },

  // Activities
  activitiesWrap: { marginTop: 12, gap: 8 },
  activitiesLabel: { fontSize: 11, color: '#444', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actName: { width: 70, fontSize: 12, color: '#888' },
  actBarWrap: { flex: 1 },
  actPct: { width: 36, fontSize: 12, fontWeight: '700', color: '#888', textAlign: 'right' },

  // Book
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bookThumb: {
    width: 32, height: 40, backgroundColor: '#1a1a1a', borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a',
  },
  bookInfo: { flex: 1 },
  bookTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  bookAuthor: { fontSize: 11, color: '#555', marginTop: 1 },

  // Purity
  purityStats: { flexDirection: 'row', marginTop: 12 },
  purityStat: { flex: 1, alignItems: 'center', gap: 2 },
  purityDivider: { width: 1, backgroundColor: '#1e1e1e' },
  purityBestRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  purityNum: { fontSize: 24, fontWeight: '700', color: colors.text },
  purityLabel: { fontSize: 10, color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  puritySub: { fontSize: 10, color: '#444', letterSpacing: 0.3 },
  purityDate: { fontSize: 10, color: '#333', marginTop: 2 },
  relapse: { color: '#FF4444' },

  // Mood
  moodWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  moodLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  moodNum: { fontSize: 20, fontWeight: '700', color: colors.text },
  moodLabel: { fontSize: 11, color: '#555' },
  moodDots: { flexDirection: 'row', gap: 4 },
  moodDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1e1e1e' },
  moodDotOn: { backgroundColor: colors.text },

  // Mind inactive
  mindInactive: { opacity: 0.4 },
  mindInactiveBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 10,
  },
  mindInactiveBadgeText: { fontSize: 10, color: '#555', fontWeight: '600' },

  // Insight
  insightCard: {
    backgroundColor: '#0d0d0d', borderRadius: 14, borderWidth: 1,
    borderColor: '#1a1a1a', padding: 14,
  },
  insightText: { fontSize: 12, color: '#555', lineHeight: 18 },
});

export default AnalyticsScreen;
