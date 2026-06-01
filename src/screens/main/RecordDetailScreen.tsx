import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
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

type RecordDetailParams = { date: string; logs: ActivityLogEntry[]; section?: string };
type RecordDetailRoute = RouteProp<{ RecordDetail: RecordDetailParams }, 'RecordDetail'>;

const SECTION_ICONS: Record<string, React.FC<any>> = { power: BicepIcon, mind: BrainIcon, craft: CraftIcon, purity: PurityIcon };
const SECTION_LABELS: Record<string, string> = {
  power: 'Power', craft: 'Craft', mind: 'Mind', purity: 'Purity',
};

const formatHours = (hours?: number): string => {
  if (!hours || hours <= 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

interface FieldRowProps { icon: string; iconColor: string; label: string; value: string; empty?: boolean; }
const FieldRow = ({ icon, iconColor, label, value, empty }: FieldRowProps) => (
  <View style={styles.fieldRow}>
    <View style={styles.fieldIcon}>
      <Ionicons name={icon as any} size={18} color={empty ? '#444' : '#ffffff'} />
    </View>
    <View style={styles.fieldBody}>
      <Text style={[styles.fieldLabel, empty && { color: '#444' }]}>{label}</Text>
      <Text style={[styles.fieldValue, empty && { color: '#444' }]}>{value}</Text>
    </View>
  </View>
);

const RecordDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RecordDetailRoute>();
  const { date, logs, section: initialSection } = route.params;
  const [showEditModal, setShowEditModal] = useState(false);
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

  const section = (initialSection || 'power') as 'power' | 'craft' | 'mind' | 'purity';
  const log = sectionMap.get(section);
  const Icon = SECTION_ICONS[section];

  const renderSectionFields = () => {
    if (section === 'purity') {
      const relapseCount = log?.relapseCount ?? null;
      const isClean = log ? (relapseCount ?? 0) === 0 : null;
      return (
        <>
          <FieldRow
            icon="shield-checkmark"
            iconColor={isClean === true ? colors.success : '#FF4444'}
            label="Did you stay clean?"
            value={log ? (isClean ? 'Yes — Clean' : `No — ${relapseCount} relapse${relapseCount !== 1 ? 's' : ''}`) : '—'}
            empty={!log}
          />
          {!isClean && log?.reasonIfNo ? (
            <FieldRow icon="close-circle-outline" iconColor="#FF4444" label="Reason" value={log.reasonIfNo} />
          ) : null}
        </>
      );
    }
    if (section === 'mind') {
      const bookTitle = log?.userBookId ? (bookTitles.get(log.userBookId) || log.userBookId) : null;
      const didDo = log?.didUserDo;
      return (
        <>
          <FieldRow icon="book" iconColor="#54A9FF" label="Did you read?" value={log ? (didDo ? 'Yes' : 'No') : '—'} empty={!log} />
          {bookTitle && <FieldRow icon="library" iconColor="#54A9FF" label="Book" value={bookTitle} />}
          {didDo && log?.description ? <FieldRow icon="chatbubble-outline" iconColor="#54A9FF" label="Notes" value={log.description} /> : null}
          {!didDo && log?.reasonIfNo ? <FieldRow icon="close-circle-outline" iconColor="#FF4444" label="Reason" value={log.reasonIfNo} /> : null}
          {didDo && log?.images && log.images.length > 0 && (
            <View style={styles.imagesSection}>
              <Text style={styles.imagesLabel}>Photos ({log.images.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {log.images.map((uri, i) => <Image key={i} source={{ uri }} style={styles.thumbnail} />)}
              </ScrollView>
            </View>
          )}
        </>
      );
    }
    const didDo = log?.didUserDo;
    const iconColor = section === 'power' ? '#FFC857' : '#3DFF86';
    return (
      <>
        <FieldRow icon="checkmark-circle-outline" iconColor={iconColor} label={section === 'power' ? 'Did you train?' : 'Did you work on your craft?'} value={log ? (didDo ? 'Yes' : 'No') : '—'} empty={!log} />
        {didDo && log?.hours ? <FieldRow icon="time-outline" iconColor={iconColor} label="Hours" value={formatHours(log.hours)} /> : null}
        {didDo && log?.description ? <FieldRow icon="chatbubble-outline" iconColor={iconColor} label="Notes" value={log.description} /> : null}
        {!didDo && log?.reasonIfNo ? <FieldRow icon="close-circle-outline" iconColor="#FF4444" label="Reason" value={log.reasonIfNo} /> : null}
        {didDo && log?.images && log.images.length > 0 && (
          <View style={styles.imagesSection}>
            <Text style={styles.imagesLabel}>Photos ({log.images.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {log.images.map((uri, i) => <Image key={i} source={{ uri }} style={styles.thumbnail} />)}
            </ScrollView>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerDate}>{formatDate(date)}</Text>
        <TouchableOpacity style={styles.editBtn} onPress={() => setShowEditModal(true)} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconCircle}>
          <Icon width={22} height={22} fill="#fff" stroke="#fff" color="#fff" />
        </View>
        <Text style={styles.sectionTitle}>{SECTION_LABELS[section]}</Text>
        {!log && <Text style={styles.noRecordBadge}>No record</Text>}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {renderSectionFields()}
      </ScrollView>

      <DailyLogModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onComplete={() => { setShowEditModal(false); navigation.goBack(); }}
        initialDate={new Date(date + 'T00:00:00')}
        initialSection={section}
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

  editBtn: { width: 36, alignItems: 'flex-end' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sectionIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 18, flex: 1 },
  noRecordBadge: { color: '#555', fontSize: 12, fontWeight: '600' },
  fieldRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  fieldIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  fieldBody: { flex: 1, gap: 3 },
  fieldLabel: { ...typography.bodySmall, color: colors.textMuted, fontSize: 12 },
  fieldValue: { ...typography.body, color: colors.text, fontSize: 14 },
  imagesSection: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  imagesLabel: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.sm },
  thumbnail: { width: 80, height: 80, borderRadius: 8, marginRight: spacing.sm },
});

export default RecordDetailScreen;
