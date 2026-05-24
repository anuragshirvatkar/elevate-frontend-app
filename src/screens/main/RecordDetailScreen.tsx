import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import type { ActivityLogEntry } from '../../types';
import DailyLogModal from '../../components/modals/DailyLogModal';
import { setupApi } from '../../api';
import BicepIcon from '../../../assets/bicep.svg';
import BrainIcon from '../../../assets/brain.svg';
import CraftIcon from '../../../assets/craft.svg';
import PurityIcon from '../../../assets/purity.svg';

type RecordDetailParams = { date: string; logs: ActivityLogEntry[] };
type RecordDetailRoute = RouteProp<{ RecordDetail: RecordDetailParams }, 'RecordDetail'>;

const SECTION_ICONS = { power: BicepIcon, mind: BrainIcon, craft: CraftIcon, purity: PurityIcon };
const SECTION_LABELS: Record<string, string> = {
  power: 'Power', craft: 'Craft', mind: 'Mind', purity: 'Purity',
};

const formatHours = (hours?: number): string => {
  if (!hours || hours <= 0) return '';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const RecordDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RecordDetailRoute>();
  const { date, logs } = route.params;
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSection, setEditSection] = useState<string | undefined>();
  const [bookTitles, setBookTitles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setupApi.getProgress()
      .then(r => {
        const mindBooks = (r.data.sections?.mind as any)?.books;
        if (Array.isArray(mindBooks)) {
          const map = new Map<string, string>();
          mindBooks.forEach((b: any) => {
            if (b.userBookId && b.title) map.set(b.userBookId, b.title);
          });
          setBookTitles(map);
        }
      })
      .catch(() => {});
  }, []);

  const formatDate = (dateStr: string): string => {
    const today = new Date().toISOString().split('T')[0];
    const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Today';
    if (dateStr === yest) return 'Yesterday';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const sectionMap = new Map<string, ActivityLogEntry>();
  for (const log of logs) {
    if (!sectionMap.has(log.section) || log.didUserDo) sectionMap.set(log.section, log);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerDate}>{formatDate(date)}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {(['power', 'craft', 'mind', 'purity'] as const).map(section => {
          const log = sectionMap.get(section);
          if (!log) return null;
          const Icon = SECTION_ICONS[section];
          const isCompleted = section === 'purity'
            ? (log.relapseCount ?? 0) === 0
            : !!log.didUserDo;
          const hoursStr = formatHours(log.hours);
          const bookTitle = section === 'mind' && log.userBookId
            ? bookTitles.get(log.userBookId)
            : undefined;

          const parts: string[] = [];
          parts.push(isCompleted ? 'Completed' : 'Missed');
          if (hoursStr) parts.push(hoursStr);
          if (section === 'purity') {
            const r = log.relapseCount ?? 0;
            parts.push(r === 0 ? 'Clean' : `${r} relapse${r !== 1 ? 's' : ''}`);
          }
          if (bookTitle) parts.push(bookTitle);

          return (
            <View key={section} style={styles.row}>
              {/* White SVG icon — no circle */}
              <View style={styles.iconCol}>
                <Icon width={20} height={20} fill="#fff" stroke="#fff" />
              </View>

              <View style={styles.rowBody}>
                <View style={styles.rowHeader}>
                  <Text style={styles.sectionName}>{SECTION_LABELS[section]}</Text>
                  <TouchableOpacity
                    onPress={() => { setEditSection(section); setShowEditModal(true); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.editText}>✎ Edit</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.subtitle}>{parts.join('  ·  ')}</Text>

                {!!log.description && (
                  <Text style={styles.note}>{log.description}</Text>
                )}
                {!log.didUserDo && !!log.reasonIfNo && (
                  <Text style={styles.note}>"{log.reasonIfNo}"</Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <DailyLogModal
        visible={showEditModal}
        onClose={() => { setShowEditModal(false); setEditSection(undefined); }}
        onComplete={() => { setShowEditModal(false); setEditSection(undefined); navigation.goBack(); }}
        initialDate={new Date(date + 'T00:00:00')}
        initialSection={editSection}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36 },
  headerDate: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16 },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconCol: {
    width: 24, marginTop: 2,
    alignItems: 'center',
  },
  rowBody: { flex: 1, gap: 4 },
  rowHeader: { flexDirection: 'row', alignItems: 'center' },
  sectionName: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 15, flex: 1 },
  editText: { color: colors.textMuted, fontSize: 14 },
  subtitle: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 18 },
  note: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2, lineHeight: 20, fontStyle: 'italic' },
});

export default RecordDetailScreen;
