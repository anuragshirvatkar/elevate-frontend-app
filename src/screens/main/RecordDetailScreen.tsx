import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import type { ActivityLogEntry } from '../../types';
import DailyLogModal from '../../components/modals/DailyLogModal';
import BicepIcon from '../../../assets/bicep.svg';
import BrainIcon from '../../../assets/brain.svg';
import CraftIcon from '../../../assets/craft.svg';
import PurityIcon from '../../../assets/purity.svg';

type RecordDetailParams = { date: string; logs: ActivityLogEntry[]; section?: string; onEdited?: () => void };
type RecordDetailRoute = RouteProp<{ RecordDetail: RecordDetailParams }, 'RecordDetail'>;

const SECTION_ICONS: Record<string, React.FC<any>> = { power: BicepIcon, mind: BrainIcon, craft: CraftIcon, purity: PurityIcon };
const SECTION_LABELS: Record<string, string> = { power: 'Power', craft: 'Craft', mind: 'Mind', purity: 'Purity' };

const formatHours = (hours?: number): string => {
  if (!hours || hours <= 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const SCREEN = Dimensions.get('window');

interface CapsuleProps {
  icon?: string;
  SvgIcon?: React.FC<any>;
  text: string;
  dim?: boolean;
}

const Capsule = ({ icon, SvgIcon, text, dim }: CapsuleProps) => (
  <View style={styles.capsule}>
    {SvgIcon ? (
      <SvgIcon width={12} height={12} fill={dim ? '#555' : '#aaa'} stroke={dim ? '#555' : '#aaa'} color={dim ? '#555' : '#aaa'} strokeWidth={1.5} />
    ) : icon ? (
      <Ionicons name={icon as any} size={13} color={dim ? '#555' : '#aaa'} />
    ) : null}
    <Text style={[styles.capsuleText, dim && { color: '#555' }]}>{text}</Text>
  </View>
);

const RecordDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RecordDetailRoute>();
  const { date, logs, section: initialSection, onEdited } = route.params;
  const [showEditModal, setShowEditModal] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const formatDate = (dateStr: string): string => {
    const today = new Date().toLocaleDateString('en-CA');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yest = yesterday.toLocaleDateString('en-CA');
    if (dateStr === today) return 'Today';
    if (dateStr === yest) return 'Yesterday';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const section = (initialSection || 'power') as 'power' | 'craft' | 'mind' | 'purity';
  const sectionLogs = logs.filter(l => l.section === section);
  const log = sectionLogs.find(l => l.didUserDo) ?? sectionLogs[0];
  const Icon = SECTION_ICONS[section];

  const renderImages = (images: string[]) => (
    <View style={styles.imagesSection}>
      <Text style={styles.sectionLabel}>Photos ({images.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {images.map((uri, i) => (
          <TouchableOpacity key={i} onPress={() => setLightboxUri(uri)} activeOpacity={0.85}>
            <Image source={{ uri }} style={styles.thumbnail} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderContent = () => {
    if (section === 'purity') {
      const relapseCount = log?.relapseCount ?? null;
      const isClean = log ? (relapseCount ?? 0) === 0 : null;

      return (
        <>
          <View style={styles.capsulesRow}>
            <Capsule icon="shield-checkmark-outline" text={!log ? '—' : isClean ? 'Clean' : `${relapseCount} relapse${relapseCount !== 1 ? 's' : ''}`} dim={!log} />
          </View>
          {log?.reasonIfNo ? (
            <View style={styles.descSection}>
              <Text style={styles.sectionLabel}>Reason</Text>
              <Text style={styles.descText}>{log.reasonIfNo}</Text>
            </View>
          ) : null}
        </>
      );
    }

    if (section === 'mind') {
      const didDo = log?.didUserDo;

      return (
        <>
          <View style={styles.capsulesRow}>
            {log?.bookTitle ? <Capsule icon="book-outline" text={log.bookTitle} /> : null}
            <Capsule icon={didDo ? 'checkmark-circle-outline' : 'close-circle-outline'} text={!log ? '—' : didDo ? 'Yes' : 'No'} dim={!log} />
          </View>
          {didDo && log?.description ? (
            <View style={styles.descSection}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.descText}>{log.description}</Text>
            </View>
          ) : null}
          {!didDo && log?.reasonIfNo ? (
            <View style={styles.descSection}>
              <Text style={styles.sectionLabel}>Reason</Text>
              <Text style={styles.descText}>{log.reasonIfNo}</Text>
            </View>
          ) : null}
          {didDo && log?.images && log.images.length > 0 ? renderImages(log.images) : null}
        </>
      );
    }

    if (sectionLogs.length === 0) {
      return (
        <View style={styles.capsulesRow}>
          <Capsule icon="remove-circle-outline" text="No record" dim />
        </View>
      );
    }

    return (
      <>
        {sectionLogs.map((actLog, idx) => {
          const didDo = actLog.didUserDo;
          const hoursStr = didDo && actLog.hours && actLog.hours > 0 ? formatHours(actLog.hours) : null;

          return (
            <React.Fragment key={actLog.id || idx}>
              {idx > 0 && <View style={styles.divider} />}
              <View style={styles.capsulesRow}>
                {actLog.activityName ? <Capsule SvgIcon={Icon} text={actLog.activityName} /> : null}
                <Capsule icon={didDo ? 'checkmark-circle-outline' : 'close-circle-outline'} text={didDo ? 'Yes' : 'No'} />
                {hoursStr ? <Capsule icon="time-outline" text={hoursStr} /> : null}
              </View>
              {didDo && actLog.description ? (
                <View style={styles.descSection}>
                  <Text style={styles.sectionLabel}>Notes</Text>
                  <Text style={styles.descText}>{actLog.description}</Text>
                </View>
              ) : null}
              {!didDo && actLog.reasonIfNo ? (
                <View style={styles.descSection}>
                  <Text style={styles.sectionLabel}>Reason</Text>
                  <Text style={styles.descText}>{actLog.reasonIfNo}</Text>
                </View>
              ) : null}
              {didDo && actLog.images && actLog.images.length > 0 ? renderImages(actLog.images) : null}
            </React.Fragment>
          );
        })}
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
        {renderContent()}
      </ScrollView>

      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUri(null)} activeOpacity={0.8}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {lightboxUri && (
            <Image source={{ uri: lightboxUri }} style={styles.lightboxImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      <DailyLogModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onComplete={(_loggedDate?: Date) => { onEdited?.(); setShowEditModal(false); navigation.goBack(); }}
        initialDate={new Date(date + 'T00:00:00')}
        initialSection={section}
        onNavigateToPillars={(pillarSection) => {
          setShowEditModal(false);
          navigation.getParent()?.navigate('Pillars', {
            tab: pillarSection === 'power' ? 'Power' : 'Craft',
          });
        }}
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
  sectionIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 18, flex: 1 },
  noRecordBadge: { color: '#555', fontSize: 12, fontWeight: '600' },

  capsulesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  capsuleText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },

  divider: { height: 1, backgroundColor: '#111' },

  descSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  sectionLabel: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  descText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },

  imagesSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  thumbnail: { width: 80, height: 80, borderRadius: 8, marginRight: spacing.sm },

  lightboxOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  lightboxImage: { width: SCREEN.width, height: SCREEN.height * 0.8 },
  lightboxClose: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default RecordDetailScreen;
