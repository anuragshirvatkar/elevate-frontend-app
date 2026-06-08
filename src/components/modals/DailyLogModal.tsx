import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, Dimensions, FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import ImageSourceSheet from '../common/ImageSourceSheet';
import { useNavigation } from '@react-navigation/native';
import { activitiesApi, setupApi, uploadsApi, helpApi } from '../../api';
import { useUser } from '../../context/UserContext';
import type { ActivityLogEntry } from '../../types';
import { colors, spacing, typography, radius } from '../../theme';
import { format } from 'date-fns';
import type { MindSetup, CompanionDto } from '../../types';
import BicepIcon from '../../../assets/bicep.svg';
import BrainIcon from '../../../assets/brain.svg';
import CraftIcon from '../../../assets/craft.svg';
import PurityIcon from '../../../assets/purity.svg';
import { playPopUpSound } from '../../utils/playSound';

const getCompanionColor = (name: string): string => {
  const colorMap: Record<string, string> = {
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

interface DailyLogModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
  onNavigateToMind?: () => void;
  initialDate?: Date;
  initialSection?: string;
}

type Step = 'power' | 'craft' | 'purity' | 'mind' | 'done';

interface SectionActivity {
  activityId: string;
  name: string;
  isPrimary?: boolean;
  userBookId?: string;
}

type ActivityEntry = { didUserDo: boolean; hours: string; description: string; images: string[]; reasonIfNo?: string };

interface LogState {
  power: Record<string, ActivityEntry>;
  craft: Record<string, ActivityEntry>;
  purity: { relapseCount: string; reasonIfNo: string };
  mind: Record<string, { didUserDo: boolean; description: string; images: string[]; reasonIfNo?: string }>;
}

// per-activity phase after "Yes" or "No"
type ActivityPhase = 'hours' | 'notes' | 'images' | 'reason';

const STEP_ORDER: Step[] = ['power', 'craft', 'purity', 'mind', 'done'];

const NO_REASON_OPTIONS = ['Tired', 'No time', 'Forgot', 'No motivation', 'Sick', 'Other'];


const HOURS_OPTIONS = [
  { label: '< 45', minutes: 40 },
  { label: '1hr', minutes: 60 },
  { label: '1-1.5', minutes: 80 },
  { label: '< 2hr', minutes: 100 },
  { label: '2hr+', minutes: 125 },
];
const HOURS_LABEL_TO_MINUTES: Record<string, number> = Object.fromEntries(
  HOURS_OPTIONS.map((o) => [o.label, o.minutes])
);

// Convert API hours value back to the display label
const hoursValueToLabel = (hours?: number): string => {
  if (!hours) return '';
  if (hours <= 0.75) return '< 45';
  if (hours <= 1) return '1hr';
  if (hours <= 1.5) return '1-1.5';
  if (hours < 2) return '< 2hr';
  return '2hr+';
};


const DailyLogModal: React.FC<DailyLogModalProps> = ({ visible, onClose, onComplete, onNavigateToMind, initialDate, initialSection }) => {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState<Step>('power');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [powerActivities, setPowerActivities] = useState<SectionActivity[]>([]);
  const [craftActivities, setCraftActivities] = useState<SectionActivity[]>([]);
  const [mindBooks, setMindBooks] = useState<MindSetup['books']>([]);
  const [mindActive, setMindActive] = useState(true);
  const { profile } = useUser();
  const minDate = profile?.joinedAt ? new Date(profile.joinedAt) : undefined;

  const [logState, setLogState] = useState<LogState>({
    power: {},
    craft: {},
    purity: { relapseCount: '0', reasonIfNo: '' },
    mind: {},
  });
  const [loading, setLoading] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [companion, setCompanion] = useState<CompanionDto | null>(null);
  const [hasActivePhase, setHasActivePhase] = useState(false);
  const [hasPendingInput, setHasPendingInput] = useState(false);
  const [purityComplete, setPurityComplete] = useState(false);
  const [hadPurityLog, setHadPurityLog] = useState(false);
  const [pointsPopup, setPointsPopup] = useState<{ points: number; nextStep: Step; msgIdx: number } | null>(null);
  const usedMsgIndices = React.useRef<number[]>([]);
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [prefillLocked, setPrefillLocked] = useState(false);
  const [mindHasChanges, setMindHasChanges] = useState(false);

  useEffect(() => {
    if (step === 'mind') setMindHasChanges(false);
  }, [step]);

  useEffect(() => {
    if (visible) {
      const date = initialDate || new Date();
      setStep('power');
      setSelectedDate(date);
      setHasActivePhase(false);
      setHasPendingInput(false);
      setPurityComplete(false);
      setHadPurityLog(false);
      setCompletedSections(new Set());
      setPrefillLocked(false);
      loadSetup(date, initialSection as Step | undefined);
    }
  }, [visible]);

  const loadSetup = async (startDate: Date = new Date(), overrideSection?: Step) => {
    setLoadingSetup(true);
    let isMindActive = true;
    try {
      const [power, craft, mind, progress] = await Promise.allSettled([
        setupApi.getSection('power'),
        setupApi.getSection('craft'),
        setupApi.getMind(),
        setupApi.getProgress(),
      ]);
      if (power.status === 'fulfilled') setPowerActivities(
        (power.value.data.activities || []).map((a: any) => ({ activityId: a.activityId, name: a.name, isPrimary: a.isPrimary }))
      );
      if (craft.status === 'fulfilled') setCraftActivities(
        (craft.value.data.activities || []).map((a: any) => ({ activityId: a.activityId, name: a.name, isPrimary: a.isPrimary }))
      );
      if (mind.status === 'fulfilled') {
        const mindData = mind.value.data;
        isMindActive = mindData.isActive;
        setMindActive(isMindActive);
        setMindBooks(mindData.books || []);
      }
      if (progress.status === 'fulfilled') setCompanion(progress.value.data.selectedCompanion || null);
    } catch {}
    setLoadingSetup(false);
    await fetchAndPrepopulate(startDate, isMindActive, overrideSection);
  };

  const fetchAndPrepopulate = async (date: Date, isMindActive = mindActive, overrideSection?: Step) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      const res = await activitiesApi.getLog(dateStr);
      const logs: ActivityLogEntry[] = res.data;
      if (!logs.length) return;

      const newPower: Record<string, ActivityEntry> = {};
      const newCraft: Record<string, ActivityEntry> = {};
      let newPurity: { relapseCount: string; reasonIfNo: string } = { relapseCount: '0', reasonIfNo: '' };
      let hasPurityLog = false;
      const newMind: Record<string, { didUserDo: boolean; description: string; images: string[]; reasonIfNo?: string }> = {};

      for (const log of logs) {
        if (log.section === 'power' && log.activityId) {
          newPower[log.activityId] = {
            didUserDo: log.didUserDo ?? false,
            hours: hoursValueToLabel(log.hours),
            description: log.description ?? '',
            images: log.images ?? [],
            reasonIfNo: log.reasonIfNo ?? undefined,
          };
        } else if (log.section === 'craft' && log.activityId) {
          newCraft[log.activityId] = {
            didUserDo: log.didUserDo ?? false,
            hours: hoursValueToLabel(log.hours),
            description: log.description ?? '',
            images: log.images ?? [],
            reasonIfNo: log.reasonIfNo ?? undefined,
          };
        } else if (log.section === 'purity') {
          hasPurityLog = true;
          newPurity = {
            relapseCount: String(log.relapseCount ?? 0),
            reasonIfNo: log.reasonIfNo ?? '',
          };
        } else if (log.section === 'mind' && log.userBookId) {
          newMind[log.userBookId] = {
            didUserDo: log.didUserDo ?? false,
            description: log.description ?? '',
            images: log.images ?? [],
            reasonIfNo: log.reasonIfNo ?? undefined,
          };
        }
      }

      setLogState((prev) => ({
        ...prev,
        ...(Object.keys(newPower).length && { power: newPower }),
        ...(Object.keys(newCraft).length && { craft: newCraft }),
        ...(hasPurityLog && { purity: newPurity }),
        ...(Object.keys(newMind).length && { mind: newMind }),
      }));

      // Ensure logged activities that aren't in setup (e.g. old custom activities) are visible
      setPowerActivities((prev) => {
        const existingIds = new Set(prev.map((a) => a.activityId));
        const extra = logs
          .filter((l) => l.section === 'power' && l.activityId && l.activityName && !existingIds.has(l.activityId!))
          .map((l) => ({ activityId: l.activityId!, name: l.activityName! }));
        return extra.length ? [...prev, ...extra] : prev;
      });
      setCraftActivities((prev) => {
        const existingIds = new Set(prev.map((a) => a.activityId));
        const extra = logs
          .filter((l) => l.section === 'craft' && l.activityId && l.activityName && !existingIds.has(l.activityId!))
          .map((l) => ({ activityId: l.activityId!, name: l.activityName! }));
        return extra.length ? [...prev, ...extra] : prev;
      });

      // Advance to first section that has no logs yet
      const loggedSections = new Set(logs.map((l) => l.section));
      const completedFromLogs = new Set<string>();
      (['power', 'craft', 'purity', 'mind'] as const).forEach((s) => { if (loggedSections.has(s)) completedFromLogs.add(s); });
      if (!isMindActive) completedFromLogs.delete('mind');
      setCompletedSections(completedFromLogs);
      if (hasPurityLog) { setPurityComplete(true); setHadPurityLog(true); }
      if (overrideSection) {
        setPrefillLocked(true);
        setStep(overrideSection);
        return;
      }
      if (!loggedSections.has('power')) { setStep('power'); return; }
      if (!loggedSections.has('craft')) { setStep('craft'); return; }
      if (!loggedSections.has('purity')) { setStep('purity'); return; }
      if (!loggedSections.has('mind') && isMindActive) { setStep('mind'); return; }
      // All sections already logged — land on last relevant section, lock Next until user changes something
      setPrefillLocked(true);
      setStep(isMindActive ? 'mind' : 'purity');
    } catch {}
  };

  const EMPTY_ACTIVITY: ActivityEntry = { didUserDo: false, hours: '', description: '', images: [] };

  const updatePower = (id: string, field: string, value: boolean | string) => {
    setPrefillLocked(false);
    setLogState((prev) => {
      const existing = prev.power[id] || EMPTY_ACTIVITY;
      return { ...prev, power: { ...prev.power, [id]: { ...existing, [field]: value } } };
    });
  };

  const updatePowerImages = (id: string, images: string[]) => {
    setPrefillLocked(false);
    setLogState((prev) => {
      const existing = prev.power[id] || EMPTY_ACTIVITY;
      return { ...prev, power: { ...prev.power, [id]: { ...existing, images } } };
    });
  };

  const removePower = (id: string) => {
    setLogState((prev) => {
      const { [id]: _, ...rest } = prev.power;
      return { ...prev, power: rest };
    });
  };

  const updateCraft = (id: string, field: string, value: boolean | string) => {
    setPrefillLocked(false);
    setLogState((prev) => {
      const existing = prev.craft[id] || EMPTY_ACTIVITY;
      return { ...prev, craft: { ...prev.craft, [id]: { ...existing, [field]: value } } };
    });
  };

  const removeCraft = (id: string) => {
    setLogState((prev) => {
      const { [id]: _, ...rest } = prev.craft;
      return { ...prev, craft: rest };
    });
  };

  const updateCraftImages = (id: string, images: string[]) => {
    setPrefillLocked(false);
    setLogState((prev) => {
      const existing = prev.craft[id] || EMPTY_ACTIVITY;
      return { ...prev, craft: { ...prev.craft, [id]: { ...existing, images } } };
    });
  };

  const updatePurity = (field: string, val: string) => {
    setPrefillLocked(false);
    setLogState((p) => ({ ...p, purity: { ...p.purity, [field]: val } }));
  };

  const updateMind = (id: string, field: string, value: boolean | string) => {
    setPrefillLocked(false);
    setMindHasChanges(true);
    setLogState((prev) => {
      const existing = prev.mind[id] || { didUserDo: false, description: '', images: [] };
      return { ...prev, mind: { ...prev.mind, [id]: { ...existing, [field]: value } } };
    });
  };

  const updateMindImages = (id: string, images: string[]) => {
    setPrefillLocked(false);
    setMindHasChanges(true);
    setLogState((prev) => {
      const existing = prev.mind[id] || { didUserDo: false, description: '', images: [] };
      return { ...prev, mind: { ...prev.mind, [id]: { ...existing, images } } };
    });
  };

  const goNext = async () => {
    const idx = STEP_ORDER.indexOf(step);
    let nextStep = STEP_ORDER[idx + 1];
    if (nextStep === 'mind' && !mindActive) nextStep = 'done';

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setLoading(true);
    let points = 0;
    if (step === 'power') points = await submitPower(dateStr);
    if (step === 'craft') points = await submitCraft(dateStr);
    if (step === 'purity') points = await submitPurity(dateStr);
    if (step === 'mind') points = await submitMind(dateStr);
    setLoading(false);
    setHasActivePhase(false);
    setCompletedSections((prev) => new Set([...prev, step]));

    if (points !== 0) {
      if (points > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const pool = points > 0 ? GAIN_MSGS : LOSS_MSGS;
      const available = pool.map((_, i) => i).filter((i) => !usedMsgIndices.current.includes(i));
      const pickFrom = available.length > 0 ? available : pool.map((_, i) => i);
      if (available.length === 0) usedMsgIndices.current = [];
      const msgIdx = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      usedMsgIndices.current.push(msgIdx);
      setPointsPopup({ points, nextStep, msgIdx });
      if (points > 0) playPopUpSound();
    } else if (nextStep === 'done') {
      onComplete();
    } else {
      setStep(nextStep);
    }
  };

  const submitPower = async (dateStr: string): Promise<number> => {
    let totalPoints = 0;
    for (const [activityId, data] of Object.entries(logState.power)) {
      try {
        const res = await activitiesApi.logActivity({
          section: 'power',
          activityId,
          didUserDo: data.didUserDo,
          hours: data.didUserDo && data.hours
            ? (HOURS_LABEL_TO_MINUTES[data.hours] ?? parseFloat(data.hours)) / 60
            : undefined,
          description: data.description || undefined,
          images: data.images?.length ? data.images : undefined,
          reasonIfNo: !data.didUserDo ? data.reasonIfNo || undefined : undefined,
          date: dateStr,
        });
        const pts = (res.data as { points?: number }).points;
        if (pts) totalPoints += pts;
      } catch {}
    }
    return totalPoints;
  };

  const submitCraft = async (dateStr: string): Promise<number> => {
    let totalPoints = 0;
    for (const [activityId, data] of Object.entries(logState.craft)) {
      try {
        const res = await activitiesApi.logActivity({
          section: 'craft', activityId,
          didUserDo: data.didUserDo,
          hours: data.didUserDo && data.hours
            ? (HOURS_LABEL_TO_MINUTES[data.hours] ?? parseFloat(data.hours)) / 60
            : undefined,
          description: data.description || undefined,
          images: data.images?.length ? data.images : undefined,
          reasonIfNo: !data.didUserDo ? data.reasonIfNo || undefined : undefined,
          date: dateStr,
        });
        const pts = (res.data as { points?: number }).points;
        if (pts) totalPoints += pts;
      } catch {}
    }
    return totalPoints;
  };

  const submitPurity = async (dateStr: string): Promise<number> => {
    try {
      const res = await activitiesApi.logActivity({
        section: 'purity',
        relapseCount: parseInt(logState.purity.relapseCount || '0', 10),
        reasonIfNo: logState.purity.reasonIfNo || undefined,
        date: dateStr,
      });
      return (res.data as { points?: number }).points ?? 0;
    } catch { return 0; }
  };

  const submitMind = async (dateStr: string): Promise<number> => {
    let totalPoints = 0;
    for (const [bookId, data] of Object.entries(logState.mind)) {
      const book = mindBooks?.find((b) => b.userBookId === bookId);
      if (!book) continue;
      try {
        const res = await activitiesApi.logActivity({
          section: 'mind',
          userBookId: bookId,
          didUserDo: data.didUserDo,
          description: data.description || undefined,
          images: data.images?.length ? data.images : undefined,
          reasonIfNo: !data.didUserDo ? data.reasonIfNo || undefined : undefined,
          date: dateStr,
        });
        const pts = (res.data as { points?: number }).points;
        if (pts) totalPoints += pts;
      } catch {}
    }
    return totalPoints;
  };

  const isSectionPositive = (sec: string): boolean => {
    if (sec === 'power') { const e = Object.values(logState.power); return e.length === 0 || e.some(v => v.didUserDo); }
    if (sec === 'craft') { const e = Object.values(logState.craft); return e.length === 0 || e.some(v => v.didUserDo); }
    if (sec === 'mind') { const e = Object.values(logState.mind); return e.length === 0 || e.some(v => v.didUserDo); }
    if (sec === 'purity') return parseInt(logState.purity.relapseCount || '0', 10) === 0;
    return true;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          {/* Header */}
          <View style={styles.header}>
            {/* Left: back */}
            <TouchableOpacity onPress={onClose} style={styles.headerBack}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>

            {/* Center: section icons — display order: power, craft, purity, mind (hidden if inactive) */}
            <View style={styles.headerIconsRow}>
              {(['power', 'craft', 'purity', 'mind'] as const).filter((section) => {
                if (section === 'mind' && !mindActive) return false;
                return true;
              }).map((section) => {
                const completed = completedSections.has(section);
                const active = section === step;
                const IconComponent = { power: BicepIcon, craft: CraftIcon, mind: BrainIcon, purity: PurityIcon }[section];
                const baseActive = section === 'purity' ? 26 : 22;
                const baseInactive = section === 'purity' ? 20 : 16;
                const sz = active ? baseActive : baseInactive;
                return (
                  <TouchableOpacity
                    key={section}
                    activeOpacity={completed ? 0.6 : 1}
                    style={styles.headerIconItem}
                    onPress={() => {
                      if (!completed) return;
                      setHasActivePhase(false);
                      setPrefillLocked(false);
                      setStep(section);
                    }}
                  >
                    <IconComponent
                      width={sz}
                      height={sz}
                      fill={active ? '#FFFFFF' : completed ? '#666' : '#383838'}
                      stroke={active ? '#FFFFFF' : completed ? '#666' : '#383838'}
                      color={active ? '#FFFFFF' : completed ? '#666' : '#383838'}
                    />
                    {completed && (
                      <View style={[styles.completedTick, !isSectionPositive(section) && { backgroundColor: colors.error }]}>
                        <Ionicons name={isSectionPositive(section) ? 'checkmark' : 'close'} size={5} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Right: date */}
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.dateText}>
                {format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ? 'Today'
                  : format(selectedDate, 'dd MMM')}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#888" />
            </TouchableOpacity>
          </View>

          {loadingSetup ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator color={colors.text} />
            </View>
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              {/* Step content */}
              {step === 'power' && (
                <PowerStep
                  activities={powerActivities}
                  logState={logState.power}
                  onUpdate={updatePower}
                  onUpdateImages={updatePowerImages}
                  onRemoveActivity={removePower}
                  resetKey={format(selectedDate, 'yyyy-MM-dd')}
                  onAddActivity={async (name) => {
                    try {
                      const res = await activitiesApi.createCustom(name, 'power');
                      const act = res.data as any;
                      const newAct: SectionActivity = { activityId: act.id || act.activityId, name: act.name };
                      try {
                        const setupRes = await setupApi.getSection('power');
                        const currentActivities = (setupRes.data.activities || []).map((a: any) => ({ activityId: a.activityId, isPrimary: a.isPrimary ?? false }));
                        await setupApi.putSection('power', {
                          preferredTime: setupRes.data.preferredTime,
                          restDays: setupRes.data.restDays,
                          activities: [...currentActivities, { activityId: newAct.activityId, isPrimary: false }],
                        });
                      } catch {}
                      setPowerActivities((prev) => [...prev, newAct]);
                      return newAct;
                    } catch { return null; }
                  }}
                  onActivePhaseChange={setHasActivePhase}
                  companion={companion}
                />
              )}
              {step === 'craft' && (
                <CraftStep
                  activities={craftActivities}
                  logState={logState.craft}
                  onUpdate={updateCraft}
                  onUpdateImages={updateCraftImages}
                  onRemoveActivity={removeCraft}
                  resetKey={format(selectedDate, 'yyyy-MM-dd')}
                  onAddActivity={async (name) => {
                    try {
                      const res = await activitiesApi.createCustom(name, 'craft');
                      const act = res.data as any;
                      const newAct: SectionActivity = { activityId: act.id || act.activityId, name: act.name };
                      try {
                        const setupRes = await setupApi.getSection('craft');
                        const currentActivities = (setupRes.data.activities || []).map((a: any) => ({ activityId: a.activityId, isPrimary: a.isPrimary ?? false }));
                        await setupApi.putSection('craft', {
                          preferredTime: setupRes.data.preferredTime,
                          restDays: setupRes.data.restDays,
                          activities: [...currentActivities, { activityId: newAct.activityId, isPrimary: false }],
                        });
                      } catch {}
                      setCraftActivities((prev) => [...prev, newAct]);
                      return newAct;
                    } catch { return null; }
                  }}
                  onActivePhaseChange={setHasActivePhase}
                  companion={companion}
                />
              )}
              {step === 'purity' && (
                <PurityStep
                  state={logState.purity}
                  onUpdate={updatePurity}
                  companion={companion}
                  onCompleteChange={setPurityComplete}
                  initialConfirmed={hadPurityLog}
                />
              )}
              {step === 'mind' && (
                <MindStep
                  books={mindBooks || []}
                  logState={logState.mind}
                  onUpdate={updateMind}
                  onUpdateImages={updateMindImages}
                  companion={companion}
                  onAddBooks={() => { onClose(); onNavigateToMind?.(); }}
                  onActivePhaseChange={setHasActivePhase}
                  onPendingChange={setHasPendingInput}
                />
              )}
            </ScrollView>
          )}

          {!hasActivePhase && !(step === 'purity' && !mindActive && !purityComplete) && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.nextBtn, ((step === 'purity' && !purityComplete) || prefillLocked || hasPendingInput || (step === 'mind' && !mindHasChanges && (mindBooks?.length ?? 0) > 0)) && styles.nextBtnDisabled]}
                onPress={goNext}
                disabled={loading || (step === 'purity' && !purityComplete) || prefillLocked || hasPendingInput || (step === 'mind' && !mindHasChanges && (mindBooks?.length ?? 0) > 0)}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.nextBtnText}>Next</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              minimumDate={minDate}
              maximumDate={new Date()}
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (event.type === 'set' && date) {
                  setSelectedDate(date);
                  // Reset logState then prefill with whatever exists for the new date
                  setLogState({
                    power: {},
                    craft: {},
                    purity: { relapseCount: '0', reasonIfNo: '' },
                    mind: {},
                    });
                  setStep('power');
                  fetchAndPrepopulate(date);
                }
              }}
            />
          )}

          {pointsPopup && (
            <PointsPopup
              points={pointsPopup.points}
              msgIdx={pointsPopup.msgIdx}
              companion={companion}
              onContinue={() => {
                const next = pointsPopup.nextStep;
                setPointsPopup(null);
                if (next === 'done') {
                  onComplete();
                } else {
                  setStep(next);
                }
              }}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// ─── Sub-step components ────────────────────────────────────────────────────

const CompanionBubble: React.FC<{
  companion: CompanionDto | null;
  children: React.ReactNode;
}> = ({ companion, children }) => (
  <View style={styles.companionSection}>
    <View style={styles.companionIconWrapper}>
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
          <Image source={{ uri: companion.image }} style={styles.companionImage} resizeMode="cover" />
        )}
      </View>
    </View>
    {children}
  </View>
);

const TweetSummary: React.FC<{
  companion: CompanionDto | null;
  name: string;
  subtitle?: string;
  status: string;
  editable?: boolean;
}> = ({ companion, name, subtitle, status, editable }) => (
  <View style={styles.tweet}>
    <View style={styles.tweetRow}>
      <View style={[styles.tweetAvatar, { borderColor: getCompanionColor(companion?.name || '') + '80' }]}>
        {companion?.image && (
          <Image source={{ uri: companion.image }} style={styles.tweetAvatarImg} resizeMode="cover" />
        )}
      </View>
      <View style={styles.tweetBody}>
        <View style={styles.tweetHeader}>
          <Text style={styles.tweetName}>{name}</Text>
          {editable && <Text style={styles.tweetEdit}>✎</Text>}
        </View>
        <Text style={styles.tweetDetail}>
          {subtitle ? `${subtitle}  ·  ` : ''}{status}
        </Text>
      </View>
    </View>
  </View>
);


const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ImageUploadSection: React.FC<{
  images: string[];
  onImagesChange: (images: string[]) => void;
  onConfirm: () => void;
}> = ({ images, onImagesChange, onConfirm }) => {
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [showSourceSheet, setShowSourceSheet] = useState(false);

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      setSizeError(true);
      return;
    }
    setPendingUri(asset.uri);
    const ext = asset.uri.split('.').pop() || 'jpg';
    try {
      const res = await uploadsApi.uploadActivityImage({
        uri: asset.uri,
        name: `activity-${Date.now()}.${ext}`,
        type: `image/${ext}`,
      });
      const d = res.data as { urls?: string[]; url?: string };
      const url = d.urls?.[0] ?? d.url;
      if (url) onImagesChange([...images, url]);
    } catch {}
    setPendingUri(null);
  };

  const pickFromLibrary = async () => {
    setSizeError(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAsset(result.assets[0]);
  };

  const takeWithCamera = async () => {
    setSizeError(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAsset(result.assets[0]);
  };

  const handleAddPhoto = () => {
    if (images.length >= MAX_IMAGES || pendingUri) return;
    setShowSourceSheet(true);
  };

  const allThumbs = [
    ...images.map((uri) => ({ uri, uploading: false })),
    ...(pendingUri ? [{ uri: pendingUri, uploading: true }] : []),
  ];
  const hasImages = images.length > 0 || !!pendingUri;
  const canAddMore = images.length < MAX_IMAGES && !pendingUri;

  return (
    <View style={styles.imageSection}>
      {hasImages && (
        <View style={styles.imageThumbnails}>
          {allThumbs.map((thumb, idx) => (
            <View key={idx} style={styles.imageThumbnailWrap}>
              <Image source={{ uri: thumb.uri }} style={styles.imageThumbnail} resizeMode="cover" />
              {thumb.uploading ? (
                <View style={styles.imageThumbnailOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.imageThumbnailRemove}
                  onPress={() => { setSizeError(false); onImagesChange(images.filter((_, i) => i !== idx)); }}
                >
                  <Ionicons name="close" size={11} color="white" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
      {sizeError && (
        <Text style={styles.imageSizeError}>Image is too large (max 10 MB)</Text>
      )}
      <View style={styles.imageActions}>
        {canAddMore && (
          <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto}>
            <Ionicons name="camera-outline" size={17} color={colors.textSecondary} />
            <Text style={styles.addPhotoBtnText}>Add photo</Text>
          </TouchableOpacity>
        )}
        {images.length === 0 ? (
          <TouchableOpacity style={styles.skipBtn} onPress={onConfirm} disabled={!!pendingUri}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.imageDoneTickBtn} onPress={onConfirm} disabled={!!pendingUri}>
            <Ionicons name="checkmark" size={22} color={pendingUri ? colors.textMuted : colors.success} />
          </TouchableOpacity>
        )}
      </View>
      <ImageSourceSheet
        visible={showSourceSheet}
        onCamera={takeWithCamera}
        onLibrary={pickFromLibrary}
        onClose={() => setShowSourceSheet(false)}
      />
    </View>
  );
};

const ActivityLogStep: React.FC<{
  activities: SectionActivity[];
  logState: Record<string, ActivityEntry>;
  onUpdate: (id: string, field: string, value: boolean | string) => void;
  onUpdateImages: (id: string, images: string[]) => void;
  onRemoveActivity: (id: string) => void;
  onAddActivity: (name: string) => Promise<SectionActivity | null>;
  companion: CompanionDto | null;
  question: string;
  hoursQuestion: string;
  emptyText: string;
  resetKey?: string;
  onActivePhaseChange?: (active: boolean) => void;
  onSecondActivityAdded?: () => void;
}> = ({ activities, logState, onUpdate, onUpdateImages, onRemoveActivity, onAddActivity, companion, question, hoursQuestion, emptyText, resetKey, onActivePhaseChange, onSecondActivityAdded }) => {
  const [allActivities, setAllActivities] = useState<SectionActivity[]>(activities);
  // donePhases: tracks which phases are shown as list rows for the in-progress activity
  const [donePhases, setDonePhases] = useState<Array<'yesno' | 'hours' | 'notes'>>([]);
  const [confirmedIds, setConfirmedIds] = useState<string[]>(() =>
    activities.filter((a) => a.activityId in logState).map((a) => a.activityId)
  );
  const [activePhase, setActivePhase] = useState<{ id: string; phase: ActivityPhase } | null>(null);

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [customName, setCustomName] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  // Reason state (for No answer)
  const [selectedReason, setSelectedReason] = useState('');
  const [showCustomReason, setShowCustomReason] = useState(false);
  const [customReasonText, setCustomReasonText] = useState('');

  // Current activity shown in yes/no question — defaults to primary (or first)
  const getDefaultActivity = (acts: SectionActivity[], excludeIds: string[]): SectionActivity | null => {
    const available = acts.filter((a) => !excludeIds.includes(a.activityId));
    return available.find((a) => a.isPrimary) ?? available[0] ?? null;
  };

  const loggedIds = [...confirmedIds, ...(activePhase ? [activePhase.id] : [])];
  const [currentId, setCurrentId] = useState<string | null>(() => {
    // If logState already has entries (existing logs), don't set currentId
    // so that confirmedIds syncs properly and shows list view
    const hasExistingLogs = Object.keys(logState).length > 0;
    if (hasExistingLogs) return null;
    const def = getDefaultActivity(activities, []);
    return def?.activityId ?? null;
  });

  useEffect(() => {
    // Merge activities from props with local state, avoiding duplicates
    setAllActivities((prev) => {
      const existingIds = new Set(prev.map((a) => a.activityId));
      const newFromProps = activities.filter((a) => !existingIds.has(a.activityId));
      // Also check if any activities were removed from props - if so, reset to props
      const propIds = new Set(activities.map((a) => a.activityId));
      const hasRemoved = prev.some((a) => !propIds.has(a.activityId) && !a.activityId.startsWith('custom-'));
      if (newFromProps.length === 0 && !hasRemoved) return prev;
      // If there are new props or removed activities, rebuild from props + local custom activities
      const localCustom = prev.filter((a) => !propIds.has(a.activityId));
      return [...activities, ...localCustom];
    });
  }, [activities]);

  // Reset all state on date change
  const isFirstMount = React.useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    setActivePhase(null);
    setDonePhases([]);
    setShowDropdown(false);
    setCustomName('');
    setShowCustomInput(false);
    setConfirmedIds([]);
    setSelectedReason('');
    setShowCustomReason(false);
    setCustomReasonText('');
    // If logState already has entries (existing logs), don't set currentId
    // so that confirmedIds syncs properly and shows list view
    const hasExistingLogs = Object.keys(logState).length > 0;
    if (hasExistingLogs) {
      setCurrentId(null);
    } else {
      const def = getDefaultActivity(activities, []);
      setCurrentId(def?.activityId ?? null);
    }
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync confirmedIds when prepopulated from outside (e.g. logState arrives after mount)
  const logStateKey = Object.keys(logState).join(',');
  useEffect(() => {
    if (logStateKey.length > 0 && confirmedIds.length === 0 && activePhase === null) {
      setConfirmedIds(Object.keys(logState));
      setCurrentId(null);
      setDonePhases([]);
    }
  }, [logStateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onActivePhaseChange?.(activePhase !== null); }, [activePhase]);

  const currentActivity = currentId
    ? (allActivities.find((a) => a.activityId === currentId)
        ?? activities.find((a) => a.activityId === currentId)
        ?? null)
    : null;
  const phaseActivity = activePhase
    ? (allActivities.find((a) => a.activityId === activePhase.id)
        ?? activities.find((a) => a.activityId === activePhase.id)
        ?? null)
    : null;

  const pickableActivities = allActivities.filter((a) => !loggedIds.includes(a.activityId));

  const handlePickActivity = (act: SectionActivity) => {
    setCurrentId(act.activityId);
    setShowDropdown(false);
    setShowCustomInput(false);
    setCustomName('');
  };

  const handleAddCustom = async () => {
    const name = customName.trim();
    if (!name) return;
    setAddingCustom(true);
    const result = await onAddActivity(name);
    setAddingCustom(false);
    if (result) {
      setAllActivities((prev) => {
        // Avoid duplicates if activity already exists
        const exists = prev.some((a) => a.activityId === result.activityId);
        if (exists) return prev;
        return [...prev, result];
      });
      setCurrentId(result.activityId);
      setShowDropdown(false);
      setShowCustomInput(false);
      setCustomName('');
    }
  };

  const handleYesNo = (didDo: boolean) => {
    if (!currentActivity) return;
    onUpdate(currentActivity.activityId, 'didUserDo', didDo);
    setDonePhases(['yesno']);
    if (didDo) {
      setActivePhase({ id: currentActivity.activityId, phase: 'hours' });
    } else {
      setActivePhase({ id: currentActivity.activityId, phase: 'reason' });
      setSelectedReason('');
      setShowCustomReason(false);
      setCustomReasonText('');
    }
    setShowDropdown(false);
  };

  const handleHoursDone = () => {
    if (!activePhase) return;
    setDonePhases((prev) => [...prev, 'hours']);
    setActivePhase({ id: activePhase.id, phase: 'notes' });
  };

  const confirmNoActivity = (id: string) => {
    setConfirmedIds((prev) => [...prev, id]);
    setDonePhases([]);
    setActivePhase(null);
    setCurrentId(null);
    setSelectedReason('');
    setShowCustomReason(false);
    setCustomReasonText('');
  };

  const handleReasonSelect = (reason: string) => {
    if (!activePhase) return;
    setSelectedReason(reason);
    if (reason !== 'Other') {
      onUpdate(activePhase.id, 'reasonIfNo', reason);
      confirmNoActivity(activePhase.id);
    } else {
      setShowCustomReason(true);
      setCustomReasonText('');
    }
  };

  const handleCustomReasonConfirm = () => {
    if (!customReasonText.trim() || !activePhase) return;
    onUpdate(activePhase.id, 'reasonIfNo', customReasonText.trim());
    confirmNoActivity(activePhase.id);
  };

  const handleNotesDone = () => {
    if (!activePhase) return;
    setDonePhases((prev) => [...prev, 'notes']);
    setActivePhase({ id: activePhase.id, phase: 'images' });
  };

  const confirmActivity = (id: string) => {
    const wasSecondActivity = confirmedIds.length === 1;
    setConfirmedIds((prev) => [...prev, id]);
    setDonePhases([]);
    setActivePhase(null);
    setCurrentId(null);
    if (wasSecondActivity && onSecondActivityAdded) {
      onSecondActivityAdded();
    }
  };

  const handleEdit = (id: string, phase: 'yesno' | 'hours' | 'notes' | 'images' | 'reason' = 'yesno') => {
    setConfirmedIds((prev) => prev.filter((cid) => cid !== id));
    setDonePhases([]);
    if (phase === 'yesno') {
      setActivePhase(null);
      setCurrentId(id);
    } else if (phase === 'hours') {
      // Don't clear hours — chip highlights via s?.hours === opt.label
      setDonePhases(['yesno']);
      setActivePhase({ id, phase: 'hours' });
    } else if (phase === 'notes') {
      setDonePhases(['yesno', 'hours']);
      setActivePhase({ id, phase: 'notes' });
    } else if (phase === 'reason') {
      // Don't clear reason — pre-select from existing logState
      const existingReason = logState[id]?.reasonIfNo || '';
      const isPredefined = NO_REASON_OPTIONS.filter((r) => r !== 'Other').includes(existingReason);
      setDonePhases(['yesno']);
      setActivePhase({ id, phase: 'reason' });
      if (isPredefined) {
        setSelectedReason(existingReason);
        setShowCustomReason(false);
        setCustomReasonText('');
      } else if (existingReason) {
        setSelectedReason('Other');
        setShowCustomReason(true);
        setCustomReasonText(existingReason);
      } else {
        setSelectedReason('');
        setShowCustomReason(false);
        setCustomReasonText('');
      }
    } else {
      setDonePhases(['yesno', 'hours', 'notes']);
      setActivePhase({ id, phase: 'images' });
    }
  };

  return (
    <View style={styles.stepContent}>

      {/* Fully confirmed activity tweet rows */}
      {confirmedIds.map((id) => {
        const act = allActivities.find((a) => a.activityId === id);
        if (!act) return null;
        const s = logState[id];
        return (
          <React.Fragment key={id}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'yesno')}>
              <TweetSummary companion={companion} name={act.name}
                subtitle={`${question} it?`} status={s?.didUserDo ? 'Yes' : 'No'} editable />
            </TouchableOpacity>
            {!!s?.didUserDo && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'hours')}>
                <TweetSummary companion={companion} name={act.name}
                  subtitle="How many hours?" status={s?.hours || '—'} editable />
              </TouchableOpacity>
            )}
            {!!s?.didUserDo && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'notes')}>
                <TweetSummary companion={companion} name={act.name}
                  subtitle="How did it go?" status={s?.description || '—'} editable />
              </TouchableOpacity>
            )}
            {!!s?.didUserDo && !!(s?.images?.length) && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'images')}>
                <TweetSummary companion={companion} name={act.name}
                  subtitle="Session photos"
                  status={`${s!.images.length} photo${s!.images.length > 1 ? 's' : ''}`} editable />
              </TouchableOpacity>
            )}
            {!s?.didUserDo && !!s?.reasonIfNo && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'reason')}>
                <TweetSummary companion={companion} name={act.name}
                  subtitle="Why not?" status={s.reasonIfNo!} editable />
              </TouchableOpacity>
            )}
          </React.Fragment>
        );
      })}

      {/* Add second activity button — shown after first is confirmed, max 2 activities */}
      {confirmedIds.length > 0 && confirmedIds.length < 2 && !activePhase && currentId === null && !showCustomInput && (
        <TouchableOpacity
          style={styles.addSecondBtn}
          onPress={() => {
            const nextActivity = pickableActivities[0];
            if (nextActivity) {
              setCurrentId(nextActivity.activityId);
              setShowDropdown(false);
              setShowCustomInput(false);
            } else {
              // No pre-configured second activity — go straight to custom input
              setShowDropdown(true);
              setShowCustomInput(true);
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={16} color="#555" />
          <Text style={styles.addSecondBtnText}>Add second activity</Text>
        </TouchableOpacity>
      )}

      {/* Standalone custom input when no pre-configured second activity is available */}
      {currentId === null && confirmedIds.length > 0 && confirmedIds.length < 2 && showDropdown && showCustomInput && !activePhase && (
        <CompanionBubble companion={companion}>
          <View style={styles.actPickerCustomRow}>
            <TextInput
              style={styles.actPickerCustomInput}
              placeholder="Activity name..."
              placeholderTextColor={colors.textMuted}
              value={customName}
              onChangeText={setCustomName}
              autoFocus
              onSubmitEditing={handleAddCustom}
            />
            <TouchableOpacity
              style={styles.actPickerCustomConfirm}
              onPress={handleAddCustom}
              disabled={addingCustom || !customName.trim()}
            >
              {addingCustom
                ? <ActivityIndicator size="small" color="#000" />
                : <Ionicons name="checkmark" size={18} color="#000" />
              }
            </TouchableOpacity>
          </View>
        </CompanionBubble>
      )}

      {/* In-progress activity: show answered phases as list rows, then the active question */}
      {activePhase && phaseActivity && (() => {
        const s = logState[activePhase.id];
        return (
          <React.Fragment>
            {/* yes/no answered row */}
            {donePhases.includes('yesno') && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(activePhase.id, 'yesno')}>
                <TweetSummary companion={companion} name={phaseActivity.name}
                  subtitle={`${question} it?`} status={s?.didUserDo ? 'Yes' : 'No'} editable />
              </TouchableOpacity>
            )}
            {/* hours answered row */}
            {donePhases.includes('hours') && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(activePhase.id, 'hours')}>
                <TweetSummary companion={companion} name={phaseActivity.name}
                  subtitle="How many hours?" status={s?.hours || '—'} editable />
              </TouchableOpacity>
            )}
            {/* notes answered row */}
            {donePhases.includes('notes') && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(activePhase.id, 'notes')}>
                <TweetSummary companion={companion} name={phaseActivity.name}
                  subtitle="How did it go?" status={s?.description || '—'} editable />
              </TouchableOpacity>
            )}

            {/* Active question */}
            {activePhase.phase === 'hours' && (
              <CompanionBubble companion={companion}>
                <View style={styles.questionRow}>
                  <Text style={styles.questionText}>{hoursQuestion} </Text>
                  <Text style={styles.questionHighlight}>{phaseActivity.name}</Text>
                  <Text style={styles.questionText}>?</Text>
                </View>
                <View style={styles.hoursOptionsContainer}>
                  {/* First row - 3 options */}
                  <View style={styles.hoursOptionsRow}>
                    {HOURS_OPTIONS.slice(0, 3).map((opt) => {
                      const selected = s?.hours === opt.label;
                      return (
                        <TouchableOpacity
                          key={opt.label}
                          style={[styles.hoursOption, selected && styles.hoursOptionActive]}
                          onPress={() => { onUpdate(activePhase.id, 'hours', opt.label); handleHoursDone(); }}
                        >
                          <Text style={[styles.hoursOptionText, selected && styles.hoursOptionTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {/* Second row - 2 options */}
                  <View style={[styles.hoursOptionsRow, styles.hoursOptionsRowSecond]}>
                    {HOURS_OPTIONS.slice(3).map((opt) => {
                      const selected = s?.hours === opt.label;
                      return (
                        <TouchableOpacity
                          key={opt.label}
                          style={[styles.hoursOption, selected && styles.hoursOptionActive]}
                          onPress={() => { onUpdate(activePhase.id, 'hours', opt.label); handleHoursDone(); }}
                        >
                          <Text style={[styles.hoursOptionText, selected && styles.hoursOptionTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </CompanionBubble>
            )}
            {activePhase.phase === 'notes' && (
              <CompanionBubble companion={companion}>
                <View style={styles.questionRow}>
                  <Text style={styles.questionText}>Want to talk about how </Text>
                  <Text style={styles.questionHighlight}>{phaseActivity.name}</Text>
                  <Text style={styles.questionText}> went?</Text>
                </View>
                <View style={styles.hoursWrap}>
                  <View style={styles.inputWithTick}>
                    <TextInput
                      style={[styles.hoursInput, styles.descInput, styles.hoursInputPad]}
                      placeholder="How did the session go? (optional)"
                      placeholderTextColor={colors.textMuted}
                      value={s?.description || ''}
                      onChangeText={(v) => onUpdate(activePhase.id, 'description', v)}
                      multiline
                      autoFocus
                    />
                    <TouchableOpacity style={styles.inputTickBtn} onPress={handleNotesDone}>
                      <Ionicons name="checkmark" size={22} color={colors.success} />
                    </TouchableOpacity>
                  </View>
                </View>
              </CompanionBubble>
            )}
            {activePhase.phase === 'images' && (
              <CompanionBubble companion={companion}>
                <View style={styles.questionRow}>
                  <Text style={styles.questionText}>Share photos from </Text>
                  <Text style={styles.questionHighlight}>{phaseActivity.name}</Text>
                  <Text style={styles.questionText}> session?</Text>
                </View>
                <Text style={styles.optionalLabel}>optional</Text>
                <ImageUploadSection
                  images={s?.images || []}
                  onImagesChange={(imgs) => onUpdateImages(activePhase.id, imgs)}
                  onConfirm={() => confirmActivity(activePhase.id)}
                />
              </CompanionBubble>
            )}
            {activePhase.phase === 'reason' && (
              <CompanionBubble companion={companion}>
                <View style={styles.questionRow}>
                  <Text style={styles.questionText}>Why didn't you </Text>
                  <Text style={styles.questionHighlight}>{phaseActivity.name}</Text>
                  <Text style={styles.questionText}>?</Text>
                </View>
                <View style={styles.relapseCauses}>
                  {NO_REASON_OPTIONS.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[styles.relapseCauseChip, selectedReason === reason && styles.relapseCauseChipActive]}
                      onPress={() => handleReasonSelect(reason)}
                    >
                      <Text style={[styles.relapseCauseText, selectedReason === reason && styles.relapseCauseTextActive]}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {showCustomReason && (
                  <View style={styles.hoursWrap}>
                    <View style={styles.inputWithTick}>
                      <TextInput
                        style={[styles.hoursInput, styles.hoursInputPad]}
                        placeholder="Type your reason..."
                        placeholderTextColor={colors.textMuted}
                        value={customReasonText}
                        onChangeText={setCustomReasonText}
                        autoFocus
                      />
                      <TouchableOpacity style={styles.inputTickBtn} onPress={handleCustomReasonConfirm}>
                        <Ionicons name="checkmark" size={22} color={customReasonText.trim() ? colors.success : colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </CompanionBubble>
            )}
          </React.Fragment>
        );
      })()}

      {/* Yes/No with inline dropdown for activity selection */}
      {currentActivity && !activePhase && (
        <CompanionBubble companion={companion}>
          <View style={styles.questionRow}>
            <Text style={styles.questionText}>{question} </Text>
            {/* Bordered dropdown trigger — inline */}
            <TouchableOpacity
              style={[styles.actDropdownTrigger, showDropdown && styles.actDropdownTriggerOpen]}
              onPress={() => { setShowDropdown((v) => !v); setShowCustomInput(false); setCustomName(''); }}
              activeOpacity={0.8}
            >
              <Text style={styles.actDropdownTriggerText}>{currentActivity.name}</Text>
              <Ionicons name={showDropdown ? 'chevron-up' : 'chevron-down'} size={13} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.questionText}> ?</Text>
          </View>

          {/* Inline dropdown */}
          {showDropdown && (
            <View style={styles.actPickerList}>
              {pickableActivities.map((act) => {
                const isSelected = act.activityId === currentId;
                return (
                  <TouchableOpacity
                    key={act.activityId}
                    style={[styles.actPickerItem, isSelected && styles.actPickerItemSelected]}
                    onPress={() => handlePickActivity(act)}
                    activeOpacity={0.7}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color={colors.text} style={{ marginRight: 8 }} />
                    )}
                    <Text style={[styles.actPickerItemText, isSelected && styles.actPickerItemTextSelected]}>
                      {act.name}
                    </Text>
                    {act.isPrimary && (
                      <Text style={styles.actPickerPrimaryBadge}>Primary</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
              {pickableActivities.length === 0 && (
                <Text style={styles.actPickerEmptyText}>No activities</Text>
              )}
              <View style={styles.actPickerDivider} />
              {allActivities.length < 3 && (showCustomInput ? (
                <View style={styles.actPickerCustomRow}>
                  <TextInput
                    style={styles.actPickerCustomInput}
                    placeholder="Activity name..."
                    placeholderTextColor={colors.textMuted}
                    value={customName}
                    onChangeText={setCustomName}
                    autoFocus
                    onSubmitEditing={handleAddCustom}
                  />
                  <TouchableOpacity
                    style={styles.actPickerCustomConfirm}
                    onPress={handleAddCustom}
                    disabled={addingCustom || !customName.trim()}
                  >
                    {addingCustom
                      ? <ActivityIndicator size="small" color="#000" />
                      : <Ionicons name="checkmark" size={18} color="#000" />
                    }
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.actPickerAddCustom}
                  onPress={() => setShowCustomInput(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#555" />
                  <Text style={styles.actPickerAddCustomText}>Add custom activity</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {(() => {
            const preselected = currentId ? logState[currentId]?.didUserDo : undefined;
            return (
              <View style={styles.yesNo}>
                <TouchableOpacity style={[styles.yesBtn, preselected === true && styles.yesBtnActive]} onPress={() => handleYesNo(true)}>
                  <Text style={[styles.yesNoText, preselected === true && styles.yesNoTextActive]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.noBtn, preselected === false && styles.noBtnActive]} onPress={() => handleYesNo(false)}>
                  <Text style={styles.yesNoText}>No</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </CompanionBubble>
      )}

      {/* No activities configured */}
      {allActivities.length === 0 && (
        <CompanionBubble companion={companion}>
          <Text style={styles.questionText}>{emptyText}</Text>
          <View style={styles.actPickerBtnRow}>
            <TouchableOpacity
              style={styles.actPickerBtn}
              onPress={() => setShowDropdown((v) => !v)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={14} color="#000" />
              <Text style={styles.actPickerBtnText}>Add activity</Text>
            </TouchableOpacity>
          </View>
          {showDropdown && (
            <View style={styles.actPickerList}>
              <View style={styles.actPickerDivider} />
              {showCustomInput ? (
                <View style={styles.actPickerCustomRow}>
                  <TextInput
                    style={styles.actPickerCustomInput}
                    placeholder="Activity name..."
                    placeholderTextColor={colors.textMuted}
                    value={customName}
                    onChangeText={setCustomName}
                    autoFocus
                    onSubmitEditing={handleAddCustom}
                  />
                  <TouchableOpacity
                    style={styles.actPickerCustomConfirm}
                    onPress={handleAddCustom}
                    disabled={addingCustom || !customName.trim()}
                  >
                    {addingCustom
                      ? <ActivityIndicator size="small" color="#000" />
                      : <Ionicons name="checkmark" size={18} color="#000" />
                    }
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.actPickerAddCustom}
                  onPress={() => setShowCustomInput(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#555" />
                  <Text style={styles.actPickerAddCustomText}>Add custom activity</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </CompanionBubble>
      )}
    </View>
  );
};

const PowerStep: React.FC<{
  activities: SectionActivity[];
  logState: Record<string, ActivityEntry>;
  onUpdate: (id: string, field: string, value: boolean | string) => void;
  onUpdateImages: (id: string, images: string[]) => void;
  onRemoveActivity: (id: string) => void;
  onAddActivity: (name: string) => Promise<SectionActivity | null>;
  resetKey?: string;
  companion: CompanionDto | null;
  onActivePhaseChange?: (active: boolean) => void;
  onSecondActivityAdded?: () => void;
}> = ({ activities, logState, onUpdate, onUpdateImages, onRemoveActivity, onAddActivity, resetKey, companion, onActivePhaseChange, onSecondActivityAdded }) => (
  <ActivityLogStep
    activities={activities}
    logState={logState}
    onUpdate={onUpdate}
    onUpdateImages={onUpdateImages}
    onRemoveActivity={onRemoveActivity}
    onAddActivity={onAddActivity}
    resetKey={resetKey}
    companion={companion}
    question="Did you go to"
    hoursQuestion="Nice! How many hours did you spend on"
    emptyText="No power activities configured."
    onActivePhaseChange={onActivePhaseChange}
    onSecondActivityAdded={onSecondActivityAdded}
  />
);

const CraftStep: React.FC<{
  activities: SectionActivity[];
  logState: Record<string, ActivityEntry>;
  onUpdate: (id: string, field: string, value: boolean | string) => void;
  onUpdateImages: (id: string, images: string[]) => void;
  onRemoveActivity: (id: string) => void;
  onAddActivity: (name: string) => Promise<SectionActivity | null>;
  resetKey?: string;
  companion: CompanionDto | null;
  onActivePhaseChange?: (active: boolean) => void;
  onSecondActivityAdded?: () => void;
}> = ({ activities, logState, onUpdate, onUpdateImages, onRemoveActivity, onAddActivity, resetKey, companion, onActivePhaseChange, onSecondActivityAdded }) => (
  <ActivityLogStep
    activities={activities}
    logState={logState}
    onUpdate={onUpdate}
    onUpdateImages={onUpdateImages}
    onRemoveActivity={onRemoveActivity}
    onAddActivity={onAddActivity}
    resetKey={resetKey}
    companion={companion}
    question="Did you work on"
    hoursQuestion="Nice! How many hours did you put into"
    emptyText="No craft activities configured."
    onActivePhaseChange={onActivePhaseChange}
    onSecondActivityAdded={onSecondActivityAdded}
  />
);

const RELAPSE_CAUSES = ['Stress', 'Boredom', 'Loneliness', 'Online triggers', 'Late night', 'Other'];

const HELP_ACTIVITIES = [
  { id: '1', title: 'Take a walk', description: 'Step outside and take a slow walk. Fresh air and movement help reset your mind and break the urge.' },
  { id: '2', title: 'Do push ups', description: 'Drop and do push ups until you can\'t anymore. Physical exertion is one of the fastest ways to redirect energy.' },
  { id: '3', title: 'Call a friend', description: 'Pick up the phone and call someone you trust. Talking out loud shifts your headspace immediately.' },
  { id: '4', title: 'Go for a run', description: 'Put on your shoes and run. Even 10 minutes of running floods your brain with endorphins.' },
  { id: '5', title: 'Make something to eat', description: 'Go to the kitchen and cook or prepare something. Keeping your hands busy interrupts the pattern.' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HelpCarousel: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const [index, setIndex] = React.useState(0);
  const flatRef = React.useRef<FlatList>(null);

  const goTo = (i: number) => {
    setIndex(i);
    flatRef.current?.scrollToIndex({ index: i, animated: true });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.helpOverlay}>
        <View style={styles.helpSheet}>
          <TouchableOpacity style={styles.helpCloseBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.helpHeader}>Need help right now?</Text>
          <Text style={styles.helpSubHeader}>Try one of these instead</Text>
          <FlatList
            ref={flatRef}
            data={HELP_ACTIVITIES}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 48));
              setIndex(i);
            }}
            renderItem={({ item }) => (
              <View style={styles.helpCard}>
                <Text style={styles.helpCardTitle}>{item.title}</Text>
                <Text style={styles.helpCardDesc}>{item.description}</Text>
              </View>
            )}
          />
          <View style={styles.helpDots}>
            {HELP_ACTIVITIES.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => goTo(i)}>
                <View style={[styles.helpDot, i === index && styles.helpDotActive]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const PurityStep: React.FC<{
  state: { relapseCount: string; reasonIfNo: string };
  onUpdate: (field: string, val: string) => void;
  companion: CompanionDto | null;
  onCompleteChange?: (complete: boolean) => void;
  initialConfirmed?: boolean;
}> = ({ state, onUpdate, companion, onCompleteChange, initialConfirmed }) => {
  const [showHelp, setShowHelp] = React.useState(false);

  // null = user hasn't made a choice this session (fall back to pre-existing props)
  const [sessionChoice, setSessionChoice] = useState<null | 'clean' | 'relapsed'>(null);
  // null = user hasn't changed the cause this session (fall back to state.reasonIfNo)
  const [sessionCause, setSessionCause] = useState<null | string>(null);
  // true after user taps the tweet card to edit (overrides initialConfirmed for showing tweet)
  const [editingMode, setEditingMode] = useState(false);
  // true after user completes their choice in this session
  const [sessionConfirmed, setSessionConfirmed] = useState(false);

  // Reset session state whenever the modal re-opens (initialConfirmed resets to false)
  useEffect(() => {
    if (!initialConfirmed) {
      setSessionChoice(null);
      setSessionCause(null);
      setEditingMode(false);
      setSessionConfirmed(false);
    }
  }, [initialConfirmed]);

  // Derived values — always computed from session overrides OR incoming props
  const activeMode: 'question' | 'clean' | 'relapsed' =
    sessionChoice !== null ? sessionChoice
    : initialConfirmed ? (parseInt(state.relapseCount || '0', 10) > 0 ? 'relapsed' : 'clean')
    : 'question';

  const activeCause = sessionCause !== null ? sessionCause : (state.reasonIfNo || '');
  const showTweet = (sessionConfirmed || !!initialConfirmed) && !editingMode;
  const count = parseInt(state.relapseCount || '0', 10);

  const tweetStatus = activeMode === 'clean'
    ? 'Clean ✓'
    : `Relapsed × ${count}${state.reasonIfNo ? ` · ${state.reasonIfNo}` : ''}`;

  const handleHelp = async () => {
    try { await helpApi.trigger(); } catch {}
    setShowHelp(true);
  };

  const handleClean = () => {
    onUpdate('relapseCount', '0');
    onUpdate('reasonIfNo', '');
    setSessionChoice('clean');
    setSessionCause(null);
    setSessionConfirmed(true);
    setEditingMode(false);
    onCompleteChange?.(true);
  };

  const handleRelapsed = () => {
    if (activeMode !== 'relapsed') {
      // Only reset count/reason when switching away from relapsed
      onUpdate('relapseCount', '0');
      onUpdate('reasonIfNo', '');
      setSessionCause('');
    }
    setSessionChoice('relapsed');
  };

  const handleCauseSelect = (cause: string) => {
    setSessionCause(cause);
    if (cause !== 'Other') {
      onUpdate('reasonIfNo', cause);
      setSessionConfirmed(true);
      setEditingMode(false);
      onCompleteChange?.(true);
    } else {
      onUpdate('reasonIfNo', '');
    }
  };

  const handleOtherConfirm = () => {
    if (!state.reasonIfNo.trim()) return;
    setSessionConfirmed(true);
    setEditingMode(false);
    onCompleteChange?.(true);
  };

  const handleEdit = () => {
    setEditingMode(true);
    setSessionConfirmed(false);
    onCompleteChange?.(false);
  };

  return (
    <View style={styles.stepContent}>
      <HelpCarousel visible={showHelp} onClose={() => setShowHelp(false)} />

      {showTweet && (
        <TouchableOpacity activeOpacity={0.7} onPress={handleEdit}>
          <TweetSummary
            companion={companion}
            name="Purity"
            subtitle="Did you stay clean today?"
            status={tweetStatus}
            editable
          />
        </TouchableOpacity>
      )}

      {!showTweet && (
        <>
          <TouchableOpacity
            style={[styles.finishedBookBtn, { marginTop: 5 }]}
            onPress={handleHelp}
            activeOpacity={0.7}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="heart-outline" size={13} color={colors.background} />
            <Text style={styles.finishedBookBtnText}>Need Help?</Text>
          </TouchableOpacity>
        <CompanionBubble companion={companion}>
          <View style={styles.questionRow}>
            <Text style={styles.questionText}>Did you stay clean today?</Text>
          </View>

          <View style={styles.yesNo}>
            <TouchableOpacity
              style={[styles.yesBtn, activeMode === 'clean' && styles.yesBtnActive]}
              onPress={handleClean}
            >
              <Text style={[styles.yesNoText, activeMode === 'clean' && styles.yesNoTextActive]}>
                ✓ Clean
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.noBtn, activeMode === 'relapsed' && styles.noBtnActive]}
              onPress={handleRelapsed}
            >
              <Text style={styles.yesNoText}>Relapsed</Text>
            </TouchableOpacity>
          </View>

          {activeMode === 'relapsed' && (
            <View style={styles.hoursWrap}>
              {/* Step 1: How many times */}
              <View style={styles.relapseCountRow}>
                <Text style={styles.relapseLabel}>How many times?</Text>
                <View style={styles.relapseCounter}>
                  <TouchableOpacity onPress={() => onUpdate('relapseCount', String(Math.max(0, count - 1)))}>
                    <Text style={styles.counterBtn}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{count}</Text>
                  <TouchableOpacity onPress={() => onUpdate('relapseCount', String(count + 1))}>
                    <Text style={styles.counterBtn}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Step 2: Cause — only visible once count > 0 */}
              {count > 0 && (
                <>
                  <Text style={styles.relapseLabel}>Ok, what do you think caused it?</Text>
                  <View style={styles.relapseCauses}>
                    {RELAPSE_CAUSES.map((cause) => (
                      <TouchableOpacity
                        key={cause}
                        style={[styles.relapseCauseChip, activeCause === cause && styles.relapseCauseChipActive]}
                        onPress={() => handleCauseSelect(cause)}
                      >
                        <Text style={[styles.relapseCauseText, activeCause === cause && styles.relapseCauseTextActive]}>
                          {cause}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {activeCause === 'Other' && (
                    <View style={styles.inputWithTick}>
                      <TextInput
                        style={[styles.hoursInput, styles.hoursInputPad]}
                        placeholder="What caused it?"
                        placeholderTextColor={colors.textMuted}
                        value={state.reasonIfNo}
                        onChangeText={(v) => onUpdate('reasonIfNo', v)}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={styles.inputTickBtn}
                        onPress={handleOtherConfirm}
                      >
                        <Ionicons
                          name="checkmark"
                          size={22}
                          color={state.reasonIfNo.trim() ? colors.success : colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </CompanionBubble>
        </>
      )}
    </View>
  );
};

const MindStep: React.FC<{
  books: Array<{ userBookId: string; title: string; author?: string }>;
  logState: Record<string, { didUserDo: boolean; description: string; images: string[]; reasonIfNo?: string }>;
  onUpdate: (id: string, field: string, value: boolean | string) => void;
  onUpdateImages: (id: string, images: string[]) => void;
  companion: CompanionDto | null;
  onAddBooks?: () => void;
  onActivePhaseChange?: (active: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
}> = ({ books, logState, onUpdate, onUpdateImages, companion, onAddBooks, onActivePhaseChange, onPendingChange }) => {
  const alreadyLoggedIds = books.filter((b) => b.userBookId in logState).map((b) => b.userBookId);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    books.find((b) => !(b.userBookId in logState))?.userBookId ?? null
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<string[]>(alreadyLoggedIds);
  const [notesBookId, setNotesBookId] = useState<string | null>(null);
  const [imagesBookId, setImagesBookId] = useState<string | null>(null);
  const [reasonBookId, setReasonBookId] = useState<string | null>(null);
  const [selectedMindReason, setSelectedMindReason] = useState('');
  const [showCustomMindReason, setShowCustomMindReason] = useState(false);
  const [customMindReasonText, setCustomMindReasonText] = useState('');

  const activeId = notesBookId ?? imagesBookId;
  const tweetIds = activeId ? [...confirmedIds, activeId] : confirmedIds;
  const unanswered = books.filter((b) => !tweetIds.includes(b.userBookId) && b.userBookId !== reasonBookId);
  // Only show yes/no for explicitly selected book — never auto-advance to the next one
  const currentForYesNo = (activeId || reasonBookId) ? null : books.find((b) => b.userBookId === selectedId) ?? null;
  const notesBook = notesBookId ? books.find((b) => b.userBookId === notesBookId) : null;
  const imagesBook = imagesBookId ? books.find((b) => b.userBookId === imagesBookId) : null;

  // active = hide Next entirely (yes/no question or reason phase — mandatory interaction)
  // pending = show but disable Next (notes/images phase — optional but must confirm or skip)
  const notify = (sid: string | null, nid: string | null, iid: string | null, rid: string | null) => {
    onActivePhaseChange?.(!!(sid || rid));
    onPendingChange?.(!!(nid || iid));
  };

  const handleYesNo = (didDo: boolean) => {
    if (!currentForYesNo) return;
    onUpdate(currentForYesNo.userBookId, 'didUserDo', didDo);
    if (didDo) {
      setNotesBookId(currentForYesNo.userBookId);
      notify(null, currentForYesNo.userBookId, imagesBookId, reasonBookId);
    } else {
      setReasonBookId(currentForYesNo.userBookId);
      setSelectedMindReason('');
      setShowCustomMindReason(false);
      setCustomMindReasonText('');
      notify(null, notesBookId, imagesBookId, currentForYesNo.userBookId);
    }
    setSelectedId(null);
    setShowDropdown(false);
  };

  const handleMarkComplete = async (bookId: string) => {
    try { await setupApi.putMind({ books: [{ userBookId: bookId, isCompleted: true }] }); } catch {}
    handleYesNo(true);
  };

  const handleNotesDone = () => {
    if (!notesBookId) return;
    const id = notesBookId;
    setImagesBookId(id);
    setNotesBookId(null);
    notify(selectedId, null, id, reasonBookId);
  };

  const handleMindReasonSelect = (reason: string) => {
    if (!reasonBookId) return;
    setSelectedMindReason(reason);
    if (reason !== 'Other') {
      onUpdate(reasonBookId, 'reasonIfNo', reason);
      setConfirmedIds((prev) => [...prev, reasonBookId!]);
      setReasonBookId(null);
      setSelectedMindReason('');
      notify(selectedId, notesBookId, imagesBookId, null);
    } else {
      setShowCustomMindReason(true);
      setCustomMindReasonText('');
    }
  };

  const handleCustomMindReasonConfirm = () => {
    if (!customMindReasonText.trim() || !reasonBookId) return;
    onUpdate(reasonBookId, 'reasonIfNo', customMindReasonText.trim());
    setConfirmedIds((prev) => [...prev, reasonBookId!]);
    setReasonBookId(null);
    setSelectedMindReason('');
    setShowCustomMindReason(false);
    setCustomMindReasonText('');
    notify(selectedId, notesBookId, imagesBookId, null);
  };

  const confirmBook = (id: string) => {
    setConfirmedIds((prev) => [...prev, id]);
    setImagesBookId(null);
    setSelectedId(null);
    notify(null, notesBookId, null, reasonBookId);
  };

  const handleEdit = (id: string) => {
    if (notesBookId === id) setNotesBookId(null);
    if (imagesBookId === id) setImagesBookId(null);
    if (reasonBookId === id) { setReasonBookId(null); setSelectedMindReason(''); setShowCustomMindReason(false); setCustomMindReasonText(''); }
    setConfirmedIds((prev) => prev.filter((cid) => cid !== id));
    setSelectedId(id);
    notify(id, notesBookId === id ? null : notesBookId, imagesBookId === id ? null : imagesBookId, reasonBookId === id ? null : reasonBookId);
  };

  return (
    <View style={styles.stepContent}>
      {books.length === 0 && (
        <View style={styles.emptyStateRow}>
          <Text style={styles.emptyState}>No books in your reading list.</Text>
          <TouchableOpacity onPress={onAddBooks} activeOpacity={0.7}>
            <Text style={styles.emptyStateLink}>Add now →</Text>
          </TouchableOpacity>
        </View>
      )}

      {tweetIds.map((id) => {
        const book = books.find((b) => b.userBookId === id);
        if (!book) return null;
        const s = logState[id];
        const status = s?.didUserDo ? 'Read ✓' : `Skipped${s?.reasonIfNo ? ` · ${s.reasonIfNo}` : ''}`;
        return (
          <TouchableOpacity key={id} activeOpacity={0.7} onPress={() => handleEdit(id)}>
            <TweetSummary companion={companion} name={book.title} subtitle="Did you read it?" status={status} editable />
          </TouchableOpacity>
        );
      })}

      {/* Notes phase */}
      {notesBook && (
        <CompanionBubble companion={companion}>
          <View style={styles.questionRow}>
            <Text style={styles.questionText}>Nice! Any notes on </Text>
            <Text style={styles.questionHighlight}>{notesBook.title}</Text>
            <Text style={styles.questionText}>?</Text>
          </View>
          <View style={styles.hoursWrap}>
            <View style={styles.inputWithTick}>
              <TextInput
                style={[styles.hoursInput, styles.descInput, styles.hoursInputPad]}
                placeholder="Jot something down (optional)"
                placeholderTextColor={colors.textMuted}
                value={logState[notesBook.userBookId]?.description || ''}
                onChangeText={(v) => onUpdate(notesBook.userBookId, 'description', v)}
                multiline
                autoFocus
              />
              <TouchableOpacity style={styles.inputTickBtn} onPress={handleNotesDone}>
                <Ionicons name="checkmark" size={22} color={colors.success} />
              </TouchableOpacity>
            </View>
          </View>
        </CompanionBubble>
      )}

      {/* Images phase */}
      {imagesBook && (
        <CompanionBubble companion={companion}>
          <View style={styles.questionRow}>
            <Text style={styles.questionText}>Share photos from </Text>
            <Text style={styles.questionHighlight}>{imagesBook.title}</Text>
            <Text style={styles.questionText}> session?</Text>
          </View>
          <Text style={styles.optionalLabel}>optional</Text>
          <ImageUploadSection
            images={logState[imagesBook.userBookId]?.images || []}
            onImagesChange={(imgs) => onUpdateImages(imagesBook.userBookId, imgs)}
            onConfirm={() => confirmBook(imagesBook.userBookId)}
          />
        </CompanionBubble>
      )}

      {/* Reason for not reading */}
      {reasonBookId && (() => {
        const reasonBook = books.find((b) => b.userBookId === reasonBookId);
        if (!reasonBook) return null;
        return (
          <CompanionBubble companion={companion}>
            <View style={styles.questionRow}>
              <Text style={styles.questionText}>Why didn't you read </Text>
              <Text style={styles.questionHighlight}>{reasonBook.title}</Text>
              <Text style={styles.questionText}>?</Text>
            </View>
            <View style={styles.relapseCauses}>
              {NO_REASON_OPTIONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.relapseCauseChip, selectedMindReason === reason && styles.relapseCauseChipActive]}
                  onPress={() => handleMindReasonSelect(reason)}
                >
                  <Text style={[styles.relapseCauseText, selectedMindReason === reason && styles.relapseCauseTextActive]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {showCustomMindReason && (
              <View style={styles.hoursWrap}>
                <View style={styles.inputWithTick}>
                  <TextInput
                    style={[styles.hoursInput, styles.hoursInputPad]}
                    placeholder="Type your reason..."
                    placeholderTextColor={colors.textMuted}
                    value={customMindReasonText}
                    onChangeText={setCustomMindReasonText}
                    autoFocus
                  />
                  <TouchableOpacity style={styles.inputTickBtn} onPress={handleCustomMindReasonConfirm}>
                    <Ionicons name="checkmark" size={22} color={customMindReasonText.trim() ? colors.success : colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </CompanionBubble>
        );
      })()}

      {/* Yes / No question */}
      {currentForYesNo && (
        <>
          <TouchableOpacity
            style={[styles.finishedBookBtn, { marginTop: 5 }]}
            onPress={() => onAddBooks?.()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="checkmark-circle" size={13} color={colors.background} />
            <Text style={styles.finishedBookBtnText}>Mark book as complete</Text>
          </TouchableOpacity>
        <CompanionBubble companion={companion}>
          <View style={styles.questionRow}>
            <Text style={styles.questionText}>Did you read </Text>
            <TouchableOpacity
              style={[styles.actDropdownTrigger, showDropdown && styles.actDropdownTriggerOpen]}
              onPress={unanswered.length > 1 ? () => setShowDropdown((s) => !s) : undefined}
              activeOpacity={unanswered.length > 1 ? 0.8 : 1}
            >
              <Text style={styles.actDropdownTriggerText}>{currentForYesNo.title}</Text>
              {unanswered.length > 1 && <Ionicons name={showDropdown ? 'chevron-up' : 'chevron-down'} size={13} color={colors.text} />}
            </TouchableOpacity>
            <Text style={styles.questionText}>?</Text>
          </View>

          {currentForYesNo.author && <Text style={styles.bookAuthor}>{currentForYesNo.author}</Text>}

          {showDropdown && unanswered.length > 1 && (
            <View style={styles.dropdown}>
              {unanswered.map((book) => (
                <TouchableOpacity key={book.userBookId} style={styles.dropdownItem} onPress={() => { setSelectedId(book.userBookId); setShowDropdown(false); }}>
                  <Text style={styles.dropdownItemText}>{book.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {(() => {
            const preselected = selectedId ? logState[selectedId]?.didUserDo : undefined;
            return (
              <View style={styles.yesNo}>
                <TouchableOpacity style={[styles.yesBtn, preselected === true && styles.yesBtnActive]} onPress={() => handleYesNo(true)}>
                  <Text style={[styles.yesNoText, preselected === true && styles.yesNoTextActive]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.noBtn, preselected === false && styles.noBtnActive]} onPress={() => handleYesNo(false)}>
                  <Text style={styles.yesNoText}>No</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </CompanionBubble>
        </>
      )}
    </View>
  );
};

const GAIN_MSGS = [
  (n: string) => `${n} is impressed. Keep the streak alive.`,
  (n: string) => `${n} sees your dedication. Don't stop now.`,
  (n: string) => `${n} nods in approval. You're building real momentum.`,
  (n: string) => `${n} smiles. This is what greatness looks like.`,
  (n: string) => `${n} is watching. You're making them proud.`,
];
const LOSS_MSGS = [
  (n: string) => `${n} believes you can bounce back. Stay strong.`,
  (n: string) => `${n} hasn't given up on you. Get back up.`,
  (n: string) => `${n} says: every warrior falls. Rise again.`,
  (n: string) => `${n} reminds you — one slip doesn't define you.`,
];

const PointsPopup: React.FC<{
  points: number;
  msgIdx: number;
  companion: CompanionDto | null;
  onContinue: () => void;
}> = ({ points, msgIdx, companion, onContinue }) => {
  const isGain = points > 0;
  const name = companion?.name ?? 'Your companion';
  const badgeColor = isGain ? colors.success : colors.error;
  const title = isGain ? 'Points earned!' : 'Points lost';
  const subtitle = isGain ? GAIN_MSGS[msgIdx](name) : LOSS_MSGS[msgIdx](name);
  return (
    <View style={styles.pointsOverlay}>
      <View style={styles.pointsCard}>
        <View style={[
          styles.pointsCompanionRing,
          { borderColor: getCompanionColor(companion?.name || '') + '99' },
        ]}>
          {companion?.image && (
            <Image source={{ uri: companion.image }} style={styles.pointsCompanionImg} resizeMode="cover" />
          )}
        </View>
        <Text style={[styles.pointsBadge, { color: badgeColor }]}>
          {isGain ? '+' : ''}{points} pts
        </Text>
        <Text style={styles.pointsTitle}>{title}</Text>
        <Text style={styles.pointsSubtitle}>{subtitle}</Text>
        <TouchableOpacity style={styles.pointsContinueBtn} onPress={onContinue} activeOpacity={0.85}>
          <Text style={styles.pointsContinueBtnText}>Continue →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBack: {
    width: 36,
  },
  headerIconsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  headerIconItem: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    width: 60,
    justifyContent: 'flex-end',
  },
  dateText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xl },
  completedTick: {
    position: 'absolute',
    bottom: -1,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  stepContent: { gap: spacing.sm },
  activityCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  activityName: { ...typography.body, color: colors.text, flex: 1 },
  bookAuthor: { ...typography.caption, color: colors.textMuted },
  mindQuestionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', gap: spacing.sm },
  finishedBookBtn: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.text },
  finishedBookBtnText: { ...typography.caption, color: colors.background, fontWeight: '700' },
  yesNo: { flexDirection: 'row', gap: spacing.xs },
  yesBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: colors.border },
  yesBtnActive: { backgroundColor: colors.success + '33', borderColor: colors.success },
  noBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: colors.border },
  noBtnActive: { backgroundColor: colors.error + '22', borderColor: colors.error },
  yesNoText: { ...typography.bodySmall, color: colors.textSecondary },
  yesNoTextActive: { color: colors.success },
  optionalLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 4,
  },
  imageSection: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  imageThumbnails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  imageThumbnailWrap: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  imageThumbnail: {
    width: 72,
    height: 72,
    backgroundColor: colors.card,
  },
  imageThumbnailRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageThumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addPhotoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderStyle: 'dashed',
  },
  addPhotoBtnText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  hoursOptionsContainer: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  hoursOptionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  hoursOptionsRowSecond: {
    justifyContent: 'center',
    paddingHorizontal: '8%',
  },
  hoursOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  hoursOptionActive: {
    borderColor: colors.text,
    backgroundColor: colors.cardElevated,
  },
  hoursOptionText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  hoursOptionTextActive: {
    color: colors.text,
  },
  hoursInput: { ...typography.body, color: colors.text, backgroundColor: colors.background, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, minHeight: 40 },
  hoursInputPad: { paddingRight: 48 },
  inputWithTick: { position: 'relative' },
  inputTickBtn: { position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  imageSizeError: { ...typography.caption, color: colors.error, textAlign: 'center' },
  skipBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  skipBtnText: { ...typography.bodySmall, color: colors.textSecondary },
  imageDoneTickBtn: { paddingHorizontal: spacing.sm },
  descInput: { minHeight: 60, textAlignVertical: 'top' },
  addSecondBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  addSecondBtnText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  bonusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: '#0d2200', borderWidth: 1, borderColor: '#1a3d00',
  },
  bonusBadgeText: { fontSize: 11, fontWeight: '700', color: colors.success },
  relapseCountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  relapseLabel: { ...typography.body, color: colors.textSecondary },
  relapseCounter: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  counterBtn: { fontSize: 24, color: colors.text, fontWeight: '600', padding: spacing.sm },
  counterValue: { ...typography.h3, color: colors.text, minWidth: 30, textAlign: 'center' },
  emptyStateRow: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  emptyState: { ...typography.body, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center' },
  emptyStateLink: { ...typography.bodySmall, color: colors.text, fontWeight: '600', textDecorationLine: 'underline' },
  footer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  nextBtn: { backgroundColor: colors.text, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.35 },
  nextBtnText: { ...typography.button, color: colors.background, fontSize: 16 },

  // Companion + Question
  companionSection: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  companionIconWrapper: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  companionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.cardElevated,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  companionImage: {
    width: '100%',
    height: '100%',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  questionText: {
    ...typography.body,
    color: colors.text,
    fontSize: 16,
  },
  questionHighlight: {
    ...typography.body,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  activityDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDropdownText: {
    ...typography.body,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  dropdown: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    width: '80%',
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dropdownItemText: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
  },
  hoursWrap: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  confirmBtn: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.35,
  },
  confirmBtnText: {
    ...typography.button,
    color: colors.background,
    fontSize: 14,
  },
  relapseCauses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
    justifyContent: 'center',
  },
  relapseCauseChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  relapseCauseChipActive: {
    borderColor: colors.text,
    backgroundColor: colors.cardElevated,
  },
  relapseCauseText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  relapseCauseTextActive: {
    color: colors.text,
    fontWeight: '600',
  },

  // Help carousel
  helpOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  helpSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: spacing.lg, paddingBottom: spacing.xl, borderWidth: 1, borderColor: colors.border },
  helpCloseBtn: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 1 },
  helpHeader: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: 2 },
  helpSubHeader: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  helpCard: { width: SCREEN_WIDTH - 48, marginHorizontal: 24, backgroundColor: colors.cardElevated, borderRadius: 16, padding: spacing.xl, alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, minHeight: 180, justifyContent: 'center' },
  helpCardTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  helpCardDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  helpDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.lg },
  helpDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  helpDotActive: { backgroundColor: colors.text, width: 18 },

  // Points popup
  pointsOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  pointsCard: {
    width: '80%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pointsCompanionRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  pointsCompanionImg: {
    width: '100%',
    height: '100%',
  },
  pointsBadge: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  pointsTitle: {
    ...typography.h4,
    color: colors.text,
  },
  pointsSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  pointsContinueBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  pointsContinueBtnText: {
    ...typography.button,
    color: colors.background,
    fontSize: 15,
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
  tweetDetail: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  tweetEdit: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: 'auto',
  },

  // Activity dropdown trigger (inline in question row)
  actDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 6,
    backgroundColor: '#111',
  },
  actDropdownTriggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: '#111',
  },
  actDropdownTriggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  actPickerPrimaryBadge: {
    fontSize: 10,
    color: '#888',
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },

  // Activity picker
  actPickerBtnRow: {
    marginTop: 12,
  },
  actPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actPickerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  actPickerList: {
    marginTop: 0,
    backgroundColor: '#111',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#333',
    overflow: 'hidden',
    width: '100%',
  },
  actPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  actPickerItemText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  actPickerItemSelected: {
    backgroundColor: '#1a1a1a',
    borderLeftWidth: 2,
    borderLeftColor: colors.text,
  },
  actPickerItemTextSelected: {
    fontWeight: '600',
    color: colors.text,
  },
  actPickerEmptyText: {
    fontSize: 13,
    color: colors.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actPickerDivider: {
    height: 1,
    backgroundColor: '#222',
  },
  actPickerAddCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  actPickerAddCustomText: {
    fontSize: 14,
    color: '#555',
  },
  actPickerCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    width: '100%',
  },
  actPickerCustomInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 0,
  },
  actPickerCustomConfirm: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

export default DailyLogModal;
