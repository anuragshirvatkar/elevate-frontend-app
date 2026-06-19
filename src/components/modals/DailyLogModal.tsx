import React, { useState, useEffect, useRef } from 'react';
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
import { getActivityDisplayName } from '../../utils/activityDisplayName';
import { InAppNotificationBanner } from '../common/InAppNotification';
import { useInAppNotification } from '../../context/InAppNotificationContext';
import {
  CompanionPointsPopup,
  COMPANION_GAIN_MSGS,
  COMPANION_LOSS_MSGS,
} from '../common/CompanionPointsPopup';

const getCompanionColor = (name: string): string => {
  const colorMap: Record<string, string> = {
    'Captain Blackvein': '#3DFF86',
    'Arkan Veylor': '#FF5A5A',
    'Zedra Morvain': '#C77DFF',
    'Tharok Warborn': '#FFC857',
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
  onComplete: (loggedDate?: Date) => void;
  onNavigateToMind?: () => void;
  onNavigateToPillars?: (section: 'power' | 'craft') => void;
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

const STEP_ORDER_ALL: Step[] = ['power', 'craft', 'purity', 'mind', 'done'];
const STEP_ORDER_FEMALE: Step[] = ['power', 'craft', 'mind', 'done'];

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


const DailyLogModal: React.FC<DailyLogModalProps> = ({ visible, onClose, onComplete, onNavigateToMind, onNavigateToPillars, initialDate, initialSection }) => {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState<Step>('power');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [powerActivities, setPowerActivities] = useState<SectionActivity[]>([]);
  const [craftActivities, setCraftActivities] = useState<SectionActivity[]>([]);
  const [powerLogNames, setPowerLogNames] = useState<Record<string, string>>({});
  const [craftLogNames, setCraftLogNames] = useState<Record<string, string>>({});
  const [mindBooks, setMindBooks] = useState<MindSetup['books']>([]);
  const [mindReadonlyBooks, setMindReadonlyBooks] = useState<Array<{ userBookId: string; title: string; author?: string }>>([]);
  const allMindBooksRef = useRef<MindSetup['books']>([]);
  const [mindActive, setMindActive] = useState(true);
  const { profile } = useUser();
  const minDate = profile?.joinedAt ? new Date(profile.joinedAt) : undefined;
  const isFemale = profile?.gender === 'female';
  const STEP_ORDER = isFemale ? STEP_ORDER_FEMALE : STEP_ORDER_ALL;

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
  const [logPrefillKey, setLogPrefillKey] = useState(0);

  useEffect(() => {
    if (step === 'mind') setMindHasChanges(false);
  }, [step]);

  const { setModalOverlayActive } = useInAppNotification();

  useEffect(() => {
    if (!visible) return;
    setModalOverlayActive(true);
    return () => setModalOverlayActive(false);
  }, [visible, setModalOverlayActive]);

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
      setPowerLogNames({});
      setCraftLogNames({});
      setMindReadonlyBooks([]);
      setLogState({
        power: {},
        craft: {},
        purity: { relapseCount: '0', reasonIfNo: '' },
        mind: {},
      });
      loadSetup(date, initialSection as Step | undefined);
    }
  }, [visible]);

  const loadSetup = async (startDate: Date = new Date(), overrideSection?: Step) => {
    setLoadingSetup(true);
    let isMindActive = true;
    try {
      const [power, craft, mind, progress, options] = await Promise.allSettled([
        setupApi.getSection('power'),
        setupApi.getSection('craft'),
        setupApi.getMind(),
        setupApi.getProgress(),
        setupApi.getOptions(),
      ]);
      const catalog = options.status === 'fulfilled' ? options.value.data.activities : null;
      const resolveActName = (sec: 'power' | 'craft', id: string, name?: string) =>
        name?.trim() || catalog?.[sec]?.find((a) => a.id === id)?.name || '';

      if (power.status === 'fulfilled') setPowerActivities(
        (power.value.data.activities || []).map((a: { activityId: string; name?: string; isPrimary?: boolean }) => ({
          activityId: a.activityId,
          name: resolveActName('power', a.activityId, a.name),
          isPrimary: a.isPrimary,
        })).filter((a) => a.name),
      );
      if (craft.status === 'fulfilled') setCraftActivities(
        (craft.value.data.activities || []).map((a: { activityId: string; name?: string; isPrimary?: boolean }) => ({
          activityId: a.activityId,
          name: resolveActName('craft', a.activityId, a.name),
          isPrimary: a.isPrimary,
        })).filter((a) => a.name),
      );
      if (mind.status === 'fulfilled') {
        const mindData = mind.value.data;
        isMindActive = mindData.isActive;
        setMindActive(isMindActive);
        const allBooks = mindData.books || [];
        allMindBooksRef.current = allBooks;
        setMindBooks(allBooks.filter((b) => !b.isCompleted));
      }
      if (progress.status === 'fulfilled') setCompanion(progress.value.data.selectedCompanion || null);
    } catch {}
    setLoadingSetup(false);
    await fetchAndPrepopulate(startDate, isMindActive, overrideSection);
  };

  const fetchAndPrepopulate = async (date: Date, isMindActive = mindActive, overrideSection?: Step) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const newPower: Record<string, ActivityEntry> = {};
    const newCraft: Record<string, ActivityEntry> = {};
    const powerNames: Record<string, string> = {};
    const craftNames: Record<string, string> = {};
    let newPurity: { relapseCount: string; reasonIfNo: string } = { relapseCount: '0', reasonIfNo: '' };
    let hasPurityLog = false;
    const newMind: Record<string, { didUserDo: boolean; description: string; images: string[]; reasonIfNo?: string }> = {};

    try {
      const res = await activitiesApi.getLog(dateStr);
      const logs: ActivityLogEntry[] = res.data ?? [];

      for (const log of logs) {
        if (log.section === 'power' && log.activityId) {
          if (log.activityName) powerNames[log.activityId] = log.activityName;
          newPower[log.activityId] = {
            didUserDo: log.didUserDo ?? false,
            hours: hoursValueToLabel(log.hours),
            description: log.description ?? '',
            images: log.images ?? [],
            reasonIfNo: log.reasonIfNo ?? undefined,
          };
        } else if (log.section === 'craft' && log.activityId) {
          if (log.activityName) craftNames[log.activityId] = log.activityName;
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

      const activeBookIds = new Set(
        allMindBooksRef.current.filter((b) => !b.isCompleted).map((b) => b.userBookId),
      );
      setMindReadonlyBooks(
        Object.keys(newMind)
          .filter((id) => !activeBookIds.has(id))
          .map((id) => {
            const log = logs.find((l) => l.section === 'mind' && l.userBookId === id);
            const fromSetup = allMindBooksRef.current.find((b) => b.userBookId === id);
            return {
              userBookId: id,
              title: log?.bookTitle || fromSetup?.title || 'Book',
              author: fromSetup?.author,
            };
          }),
      );

      setLogState({
        power: newPower,
        craft: newCraft,
        purity: hasPurityLog ? newPurity : { relapseCount: '0', reasonIfNo: '' },
        mind: newMind,
      });
      setPowerLogNames(powerNames);
      setCraftLogNames(craftNames);
      setLogPrefillKey((k) => k + 1);

      if (!logs.length) {
        setCompletedSections(new Set());
        setPurityComplete(false);
        setHadPurityLog(false);
        setPrefillLocked(false);
        if (overrideSection) {
          setStep(overrideSection);
        }
        return;
      }

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
      if (!isFemale && !loggedSections.has('purity')) { setStep('purity'); return; }
      if (!loggedSections.has('mind') && isMindActive) { setStep('mind'); return; }
      setPrefillLocked(true);
      setStep(isMindActive ? 'mind' : (isFemale ? 'craft' : 'purity'));
    } catch {
      setMindReadonlyBooks([]);
      setLogState({
        power: {},
        craft: {},
        purity: { relapseCount: '0', reasonIfNo: '' },
        mind: {},
      });
      setPowerLogNames({});
      setCraftLogNames({});
      setLogPrefillKey((k) => k + 1);
    }
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

  const addSetupActivity = async (
    section: 'power' | 'craft',
    activityId: string,
    name: string,
    setActivities: React.Dispatch<React.SetStateAction<SectionActivity[]>>,
  ): Promise<SectionActivity | null> => {
    try {
      const setupRes = await setupApi.getSection(section);
      const currentActivities = (setupRes.data.activities || []).map((a: { activityId: string; isPrimary?: boolean }) => ({
        activityId: a.activityId,
        isPrimary: a.isPrimary ?? false,
      }));
      if (!currentActivities.some((a) => a.activityId === activityId)) {
        await setupApi.putSection(section, {
          preferredTime: setupRes.data.preferredTime,
          restDays: setupRes.data.restDays,
          activities: [...currentActivities, { activityId, isPrimary: false }],
        });
      }
      const newAct: SectionActivity = { activityId, name };
      setActivities((prev) => (prev.some((a) => a.activityId === activityId) ? prev : [...prev, newAct]));
      if (section === 'craft') {
        setCraftLogNames((prev) => ({ ...prev, [activityId]: name }));
      } else {
        setPowerLogNames((prev) => ({ ...prev, [activityId]: name }));
      }
      return newAct;
    } catch {
      return null;
    }
  };

type SectionSubmitResult = { points: number; didSubmit: boolean };

  const resolveSectionPoints = async (
    dateStr: string,
    section: Step,
    delta: number,
    didSubmit: boolean,
  ): Promise<number> => {
    if (delta !== 0 || !didSubmit || section === 'done') return delta;
    try {
      const res = await activitiesApi.getLog(dateStr);
      const sectionTotal = (res.data ?? [])
        .filter((log) => log.section === section)
        .reduce((sum, log) => sum + (log.points ?? 0), 0);
      return sectionTotal !== 0 ? sectionTotal : delta;
    } catch {
      return delta;
    }
  };

  const purityRelapseCount = () => parseInt(logState.purity.relapseCount || '0', 10);

  const goNext = async () => {
    const idx = STEP_ORDER.indexOf(step);
    let nextStep = STEP_ORDER[idx + 1];
    if (nextStep === 'mind' && !mindActive) nextStep = 'done';

    if (step === 'mind') {
      const mindNotesValid = Object.values(logState.mind).every(
        (d) => !d.didUserDo || !!d.description?.trim(),
      );
      if (!mindNotesValid) return;
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setLoading(true);
    let points = 0;
    let didSubmit = false;
    if (step === 'power') {
      const result = await submitPower(dateStr);
      points = result.points;
      didSubmit = result.didSubmit;
    }
    if (step === 'craft') {
      const result = await submitCraft(dateStr);
      points = result.points;
      didSubmit = result.didSubmit;
    }
    if (step === 'purity') {
      const result = await submitPurity(dateStr);
      points = result.points;
      didSubmit = result.didSubmit;
    }
    if (step === 'mind') {
      const result = await submitMind(dateStr);
      points = result.points;
      didSubmit = result.didSubmit;
    }
    points = await resolveSectionPoints(dateStr, step, points, didSubmit);
    const relapses = purityRelapseCount();
    if (step === 'purity' && relapses > 0 && points === 0 && didSubmit) {
      points = -20 * relapses;
    }
    setLoading(false);
    setHasActivePhase(false);
    setCompletedSections((prev) => new Set([...prev, step]));

    const showCompanionPopup =
      points !== 0
      || (didSubmit && isSectionPositive(step))
      || (didSubmit && step === 'purity' && relapses > 0);

    if (showCompanionPopup) {
      if (points > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (points < 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      const isGain = points >= 0;
      const pool = isGain ? COMPANION_GAIN_MSGS : COMPANION_LOSS_MSGS;
      const available = pool.map((_, i) => i).filter((i) => !usedMsgIndices.current.includes(i));
      const pickFrom = available.length > 0 ? available : pool.map((_, i) => i);
      if (available.length === 0) usedMsgIndices.current = [];
      const msgIdx = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      usedMsgIndices.current.push(msgIdx);
      setPointsPopup({ points, nextStep, msgIdx });
      if (points > 0 || (points === 0 && isGain)) playPopUpSound();
    } else if (nextStep === 'done') {
      onComplete(selectedDate);
    } else {
      setStep(nextStep);
    }
  };

  const submitPower = async (dateStr: string): Promise<SectionSubmitResult> => {
    let totalPoints = 0;
    let didSubmit = false;
    const orderedIds = [
      ...powerActivities.map((a) => a.activityId),
      ...Object.keys(logState.power),
    ].filter((id, i, arr) => arr.indexOf(id) === i && logState.power[id]);

    for (const activityId of orderedIds) {
      const data = logState.power[activityId];
      let act = powerActivities.find((a) => a.activityId === activityId);
      if (!act) {
        const name = powerLogNames[activityId];
        if (!name) continue;
        act = await addSetupActivity('power', activityId, name, setPowerActivities) ?? undefined;
        if (!act) continue;
      }
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
        didSubmit = true;
        totalPoints += res.data.points ?? 0;
      } catch {}
    }
    return { points: totalPoints, didSubmit };
  };

  const submitCraft = async (dateStr: string): Promise<SectionSubmitResult> => {
    let totalPoints = 0;
    let didSubmit = false;
    const orderedIds = [
      ...craftActivities.map((a) => a.activityId),
      ...Object.keys(logState.craft),
    ].filter((id, i, arr) => arr.indexOf(id) === i && logState.craft[id]);

    for (const activityId of orderedIds) {
      const data = logState.craft[activityId];
      let act = craftActivities.find((a) => a.activityId === activityId);
      if (!act) {
        const name = craftLogNames[activityId];
        if (!name) continue;
        act = await addSetupActivity('craft', activityId, name, setCraftActivities) ?? undefined;
        if (!act) continue;
      }
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
        didSubmit = true;
        totalPoints += res.data.points ?? 0;
      } catch {}
    }
    return { points: totalPoints, didSubmit };
  };

  const submitPurity = async (dateStr: string): Promise<SectionSubmitResult> => {
    try {
      const res = await activitiesApi.logActivity({
        section: 'purity',
        relapseCount: parseInt(logState.purity.relapseCount || '0', 10),
        reasonIfNo: logState.purity.reasonIfNo || undefined,
        date: dateStr,
      });
      return { points: res.data.points ?? 0, didSubmit: true };
    } catch {
      return { points: 0, didSubmit: false };
    }
  };

  const submitMind = async (dateStr: string): Promise<SectionSubmitResult> => {
    let totalPoints = 0;
    let didSubmit = false;
    for (const [bookId, data] of Object.entries(logState.mind)) {
      const book = mindBooks?.find((b) => b.userBookId === bookId);
      if (!book) continue;
      if (data.didUserDo && !data.description?.trim()) continue;
      try {
        const res = await activitiesApi.logActivity({
          section: 'mind',
          userBookId: bookId,
          didUserDo: data.didUserDo,
          description: data.didUserDo ? data.description.trim() : undefined,
          images: data.images?.length ? data.images : undefined,
          reasonIfNo: !data.didUserDo ? data.reasonIfNo || undefined : undefined,
          date: dateStr,
        });
        didSubmit = true;
        totalPoints += res.data.points ?? 0;
      } catch {}
    }
    return { points: totalPoints, didSubmit };
  };

  const isSectionPositive = (sec: string): boolean => {
    if (sec === 'power') { const e = Object.values(logState.power); return e.length === 0 || e.some(v => v.didUserDo); }
    if (sec === 'craft') { const e = Object.values(logState.craft); return e.length === 0 || e.some(v => v.didUserDo); }
    if (sec === 'mind') { const e = Object.values(logState.mind); return e.length === 0 || e.some(v => v.didUserDo); }
    if (sec === 'purity') return parseInt(logState.purity.relapseCount || '0', 10) === 0;
    return true;
  };

  const mindNotesValid = Object.values(logState.mind).every(
    (d) => !d.didUserDo || !!d.description?.trim(),
  );
  const mindDayLogged = Object.keys(logState.mind).some((bookId) => {
    const entry = logState.mind[bookId];
    return !!entry && (!entry.didUserDo || !!entry.description?.trim());
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safe}>
        <InAppNotificationBanner />
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
                if (section === 'purity' && isFemale) return false;
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
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              decelerationRate="normal"
              scrollEventThrottle={16}
              overScrollMode="always"
            >
              {/* Step content */}
              {step === 'power' && (
                <PowerStep
                  activities={powerActivities}
                  logState={logState.power}
                  onUpdate={updatePower}
                  onUpdateImages={updatePowerImages}
                  onRemoveActivity={removePower}
                  resetKey={format(selectedDate, 'yyyy-MM-dd')}
                  prefillKey={logPrefillKey}
                  logActivityNames={powerLogNames}
                  onActivePhaseChange={setHasActivePhase}
                  companion={companion}
                  onNavigateToPillars={() => {
                    onClose();
                    onNavigateToPillars?.('power');
                  }}
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
                  prefillKey={logPrefillKey}
                  logActivityNames={craftLogNames}
                  onActivePhaseChange={setHasActivePhase}
                  companion={companion}
                  onNavigateToPillars={() => {
                    onClose();
                    onNavigateToPillars?.('craft');
                  }}
                />
              )}
              {step === 'purity' && !isFemale && (
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
                  key={format(selectedDate, 'yyyy-MM-dd')}
                  books={mindBooks || []}
                  readonlyBooks={mindReadonlyBooks}
                  logState={logState.mind}
                  onUpdate={updateMind}
                  onUpdateImages={updateMindImages}
                  companion={companion}
                  onAddBooks={() => { onClose(); onNavigateToMind?.(); }}
                  onBookMarkedComplete={(bookId) => {
                    setMindBooks((prev) => prev?.filter((b) => b.userBookId !== bookId) ?? []);
                  }}
                  onActivePhaseChange={setHasActivePhase}
                  onPendingChange={setHasPendingInput}
                />
              )}
            </ScrollView>
          )}

          {!hasActivePhase && !(step === 'purity' && !mindActive && !purityComplete) && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.nextBtn, ((step === 'purity' && !purityComplete) || prefillLocked || hasPendingInput || (step === 'mind' && ((!mindDayLogged && !mindHasChanges && (mindBooks?.length ?? 0) > 0) || !mindNotesValid))) && styles.nextBtnDisabled]}
                onPress={goNext}
                disabled={loading || (step === 'purity' && !purityComplete) || prefillLocked || hasPendingInput || (step === 'mind' && ((!mindDayLogged && !mindHasChanges && (mindBooks?.length ?? 0) > 0) || !mindNotesValid))}
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
                  setPowerLogNames({});
                  setCraftLogNames({});
                  // Reset logState then prefill with whatever exists for the new date
                  setLogState({
                    power: {},
                    craft: {},
                    purity: { relapseCount: '0', reasonIfNo: '' },
                    mind: {},
                    });
                  setMindReadonlyBooks([]);
                  setStep('power');
                  fetchAndPrepopulate(date);
                }
              }}
            />
          )}

        </KeyboardAvoidingView>

        {pointsPopup && (
          <CompanionPointsPopup
            visible
            presentation="overlay"
            points={pointsPopup.points}
            companion={companion}
            subtitle={
              (pointsPopup.points >= 0 ? COMPANION_GAIN_MSGS : COMPANION_LOSS_MSGS)[pointsPopup.msgIdx](
                companion?.name ?? 'Your companion',
              )
            }
            onContinue={() => {
              const next = pointsPopup.nextStep;
              setPointsPopup(null);
              if (next === 'done') {
                onComplete(selectedDate);
              } else {
                setStep(next);
              }
            }}
          />
        )}
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
  section: 'power' | 'craft';
  companion: CompanionDto | null;
  question: string;
  hoursQuestion: string;
  emptyText: string;
  logActivityNames?: Record<string, string>;
  resetKey?: string;
  prefillKey?: number;
  onActivePhaseChange?: (active: boolean) => void;
  onSecondActivityAdded?: () => void;
  onNavigateToPillars?: () => void;
}> = ({ activities, logState, onUpdate, onUpdateImages, onRemoveActivity, section, companion, question, hoursQuestion, emptyText, logActivityNames = {}, resetKey, prefillKey = 0, onActivePhaseChange, onSecondActivityAdded, onNavigateToPillars }) => {
  const activityLabel = (name: string) => getActivityDisplayName(section, name);
  const [allActivities, setAllActivities] = useState<SectionActivity[]>(activities);

  const effectiveActivities = allActivities;
  const resolveActivity = (id: string): SectionActivity | null => {
    const fromEffective = effectiveActivities.find((a) => a.activityId === id);
    if (fromEffective) return fromEffective;
    const logName = logActivityNames[id];
    if (logName) return { activityId: id, name: logName };
    return null;
  };
  // donePhases: tracks which phases are shown as list rows for the in-progress activity
  const [donePhases, setDonePhases] = useState<Array<'yesno' | 'hours' | 'notes'>>([]);
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const [activePhase, setActivePhase] = useState<{ id: string; phase: ActivityPhase } | null>(null);

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSecondActivityChoice, setShowSecondActivityChoice] = useState(false);
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
    setAllActivities(activities);
  }, [activities]);

  // Reset all state on date change
  const isFirstMount = React.useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    setActivePhase(null);
    setDonePhases([]);
    setShowDropdown(false);
    setShowSecondActivityChoice(false);
    setConfirmedIds([]);
    setSelectedReason('');
    setShowCustomReason(false);
    setCustomReasonText('');
    const hasExistingLogs = Object.keys(logState).length > 0;
    if (hasExistingLogs) {
      setCurrentId(null);
    } else {
      const def = getDefaultActivity(activities, []);
      setCurrentId(def?.activityId ?? null);
    }
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync confirmedIds only when parent finishes loading saved logs for this date
  useEffect(() => {
    const ids = Object.keys(logState);
    if (ids.length === 0) {
      setConfirmedIds([]);
      return;
    }
    setConfirmedIds(ids);
    setCurrentId(null);
    setDonePhases([]);
  }, [prefillKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onActivePhaseChange?.(activePhase !== null); }, [activePhase]);

  const currentActivity = currentId ? resolveActivity(currentId) : null;
  const phaseActivity = activePhase ? resolveActivity(activePhase.id) : null;

  const pickableActivities = effectiveActivities.filter(
    (a) => !loggedIds.includes(a.activityId) && !!a.name?.trim(),
  );

  const handlePickActivity = (act: SectionActivity) => {
    setCurrentId(act.activityId);
    setShowDropdown(false);
  };

  const closePickers = () => {
    setShowDropdown(false);
    setShowSecondActivityChoice(false);
  };

  const renderActivityPickerFooter = () => {
    if (!onNavigateToPillars) return null;
    return (
      <>
        <View style={styles.actPickerDivider} />
        <TouchableOpacity
          style={styles.actPickerPillarsRow}
          onPress={() => {
            setShowDropdown(false);
            closePickers();
            onNavigateToPillars();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={16} color="#888" />
          <Text style={styles.actPickerPillarsText}>Add different activity in Pillars</Text>
        </TouchableOpacity>
      </>
    );
  };

  const handlePickSetupActivity = (act: SectionActivity) => {
    setCurrentId(act.activityId);
    setShowSecondActivityChoice(false);
    setShowDropdown(false);
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
        const act = resolveActivity(id);
        if (!act) return null;
        const s = logState[id];
        return (
          <React.Fragment key={id}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'yesno')}>
              <TweetSummary companion={companion} name={activityLabel(act.name)}
                subtitle={`${question} it?`} status={s?.didUserDo ? 'Yes' : 'No'} editable />
            </TouchableOpacity>
            {!!s?.didUserDo && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'hours')}>
                <TweetSummary companion={companion} name={activityLabel(act.name)}
                  subtitle="How many hours?" status={s?.hours || '—'} editable />
              </TouchableOpacity>
            )}
            {!!s?.didUserDo && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'notes')}>
                <TweetSummary companion={companion} name={activityLabel(act.name)}
                  subtitle="How did it go?" status={s?.description || '—'} editable />
              </TouchableOpacity>
            )}
            {!!s?.didUserDo && !!(s?.images?.length) && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'images')}>
                <TweetSummary companion={companion} name={activityLabel(act.name)}
                  subtitle="Session photos"
                  status={`${s!.images.length} photo${s!.images.length > 1 ? 's' : ''}`} editable />
              </TouchableOpacity>
            )}
            {!s?.didUserDo && !!s?.reasonIfNo && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'reason')}>
                <TweetSummary companion={companion} name={activityLabel(act.name)}
                  subtitle="Why not?" status={s.reasonIfNo!} editable />
              </TouchableOpacity>
            )}
          </React.Fragment>
        );
      })}

      {/* Add second activity button — shown after first is confirmed, max 2 per day */}
      {confirmedIds.length > 0 && confirmedIds.length < 2 && !activePhase && currentId === null
        && !showSecondActivityChoice && (
        <TouchableOpacity
          style={styles.addSecondBtn}
          onPress={() => {
            if (pickableActivities.length > 0) {
              setShowSecondActivityChoice(true);
            } else {
              onNavigateToPillars?.();
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={16} color="#555" />
          <Text style={styles.addSecondBtnText}>Add second activity</Text>
        </TouchableOpacity>
      )}

      {/* Choose setup activity or pick a different one from catalog */}
      {showSecondActivityChoice && !activePhase && currentId === null && (
        <CompanionBubble companion={companion}>
          <Text style={styles.questionText}>Pick a second activity</Text>
          {pickableActivities.map((act) => (
            <TouchableOpacity
              key={act.activityId}
              style={styles.secondActivityRow}
              onPress={() => handlePickSetupActivity(act)}
              activeOpacity={0.7}
            >
              <Text style={styles.secondActivityRowText}>{activityLabel(act.name)}</Text>
              <Ionicons name="chevron-forward" size={16} color="#555" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.secondActivityDifferentRow}
            onPress={() => {
              setShowSecondActivityChoice(false);
              onNavigateToPillars?.();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={16} color="#888" />
            <Text style={styles.secondActivityDifferentText}>Add different activity in Pillars</Text>
          </TouchableOpacity>
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
                <TweetSummary companion={companion} name={activityLabel(phaseActivity.name)}
                  subtitle={`${question} it?`} status={s?.didUserDo ? 'Yes' : 'No'} editable />
              </TouchableOpacity>
            )}
            {/* hours answered row */}
            {donePhases.includes('hours') && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(activePhase.id, 'hours')}>
                <TweetSummary companion={companion} name={activityLabel(phaseActivity.name)}
                  subtitle="How many hours?" status={s?.hours || '—'} editable />
              </TouchableOpacity>
            )}
            {/* notes answered row */}
            {donePhases.includes('notes') && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(activePhase.id, 'notes')}>
                <TweetSummary companion={companion} name={activityLabel(phaseActivity.name)}
                  subtitle="How did it go?" status={s?.description || '—'} editable />
              </TouchableOpacity>
            )}

            {/* Active question */}
            {activePhase.phase === 'hours' && (
              <CompanionBubble companion={companion}>
                <View style={styles.questionRow}>
                  <Text style={styles.questionText}>{hoursQuestion} </Text>
                  <Text style={styles.questionHighlight}>{activityLabel(phaseActivity.name)}</Text>
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
                  <Text style={styles.questionHighlight}>{activityLabel(phaseActivity.name)}</Text>
                  <Text style={styles.questionText}> went?</Text>
                </View>
                <View style={styles.hoursWrap}>
                  <View style={styles.notesRow}>
                    <TextInput
                      style={[styles.hoursInput, styles.descInput, styles.notesInput]}
                      placeholder="How did the session go? (optional)"
                      placeholderTextColor={colors.textMuted}
                      value={s?.description || ''}
                      onChangeText={(v) => onUpdate(activePhase.id, 'description', v)}
                      multiline
                      autoFocus
                      scrollEnabled
                    />
                    <TouchableOpacity style={styles.notesDoneBtn} onPress={handleNotesDone}>
                      <Text style={styles.inputDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </CompanionBubble>
            )}
            {activePhase.phase === 'images' && (
              <CompanionBubble companion={companion}>
                <View style={styles.questionRow}>
                  <Text style={styles.questionText}>Share photos from </Text>
                  <Text style={styles.questionHighlight}>{activityLabel(phaseActivity.name)}</Text>
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
                  <Text style={styles.questionHighlight}>{activityLabel(phaseActivity.name)}</Text>
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
              onPress={() => setShowDropdown((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={styles.actDropdownTriggerText}>{activityLabel(currentActivity.name)}</Text>
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
                      {activityLabel(act.name)}
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
              {renderActivityPickerFooter()}
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
          {onNavigateToPillars ? (
            <View style={styles.actPickerBtnRow}>
              <TouchableOpacity
                style={styles.actPickerBtn}
                onPress={onNavigateToPillars}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={14} color="#000" />
                <Text style={styles.actPickerBtnText}>Add activity in Pillars</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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
  logActivityNames?: Record<string, string>;
  resetKey?: string;
  prefillKey?: number;
  companion: CompanionDto | null;
  onActivePhaseChange?: (active: boolean) => void;
  onSecondActivityAdded?: () => void;
  onNavigateToPillars?: () => void;
}> = ({ activities, logState, onUpdate, onUpdateImages, onRemoveActivity, logActivityNames, resetKey, prefillKey, companion, onActivePhaseChange, onSecondActivityAdded, onNavigateToPillars }) => (
  <ActivityLogStep
    activities={activities}
    logState={logState}
    onUpdate={onUpdate}
    onUpdateImages={onUpdateImages}
    onRemoveActivity={onRemoveActivity}
    logActivityNames={logActivityNames}
    section="power"
    resetKey={resetKey}
    prefillKey={prefillKey}
    companion={companion}
    question="Did you go to"
    hoursQuestion="Nice! How many hours did you spend on"
    emptyText="No power activities configured."
    onActivePhaseChange={onActivePhaseChange}
    onSecondActivityAdded={onSecondActivityAdded}
    onNavigateToPillars={onNavigateToPillars}
  />
);

const CraftStep: React.FC<{
  activities: SectionActivity[];
  logState: Record<string, ActivityEntry>;
  onUpdate: (id: string, field: string, value: boolean | string) => void;
  onUpdateImages: (id: string, images: string[]) => void;
  onRemoveActivity: (id: string) => void;
  logActivityNames?: Record<string, string>;
  resetKey?: string;
  prefillKey?: number;
  companion: CompanionDto | null;
  onActivePhaseChange?: (active: boolean) => void;
  onSecondActivityAdded?: () => void;
  onNavigateToPillars?: () => void;
}> = ({ activities, logState, onUpdate, onUpdateImages, onRemoveActivity, logActivityNames, resetKey, prefillKey, companion, onActivePhaseChange, onSecondActivityAdded, onNavigateToPillars }) => (
  <ActivityLogStep
    activities={activities}
    logState={logState}
    onUpdate={onUpdate}
    onUpdateImages={onUpdateImages}
    onRemoveActivity={onRemoveActivity}
    logActivityNames={logActivityNames}
    section="craft"
    resetKey={resetKey}
    prefillKey={prefillKey}
    companion={companion}
    question="Did you work on"
    hoursQuestion="Nice! How many hours did you put into"
    emptyText="No craft activities configured."
    onActivePhaseChange={onActivePhaseChange}
    onSecondActivityAdded={onSecondActivityAdded}
    onNavigateToPillars={onNavigateToPillars}
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
  readonlyBooks?: Array<{ userBookId: string; title: string; author?: string }>;
  logState: Record<string, { didUserDo: boolean; description: string; images: string[]; reasonIfNo?: string }>;
  onUpdate: (id: string, field: string, value: boolean | string) => void;
  onUpdateImages: (id: string, images: string[]) => void;
  companion: CompanionDto | null;
  onAddBooks?: () => void;
  onBookMarkedComplete?: (bookId: string) => void;
  onActivePhaseChange?: (active: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
}> = ({ books, readonlyBooks = [], logState, onUpdate, onUpdateImages, companion, onAddBooks, onBookMarkedComplete, onActivePhaseChange, onPendingChange }) => {
  const isBookLogComplete = (bookId: string) => {
    const entry = logState[bookId];
    return !!entry && (!entry.didUserDo || !!entry.description?.trim());
  };
  const alreadyLoggedIds = Object.keys(logState).filter((id) => isBookLogComplete(id));
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    alreadyLoggedIds.length > 0
      ? null
      : books.find((b) => !(b.userBookId in logState))?.userBookId ?? books[0]?.userBookId ?? null,
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<string[]>(alreadyLoggedIds);
  const [notesBookId, setNotesBookId] = useState<string | null>(null);
  const [imagesBookId, setImagesBookId] = useState<string | null>(null);
  const [reasonBookId, setReasonBookId] = useState<string | null>(null);
  const [selectedMindReason, setSelectedMindReason] = useState('');
  const [showCustomMindReason, setShowCustomMindReason] = useState(false);
  const [customMindReasonText, setCustomMindReasonText] = useState('');

  useEffect(() => {
    const needsNotes = books.find((b) => {
      const entry = logState[b.userBookId];
      return entry?.didUserDo && !entry.description?.trim();
    });
    if (needsNotes && !notesBookId && !imagesBookId && !reasonBookId) {
      setNotesBookId(needsNotes.userBookId);
      onActivePhaseChange?.(true);
    }
  }, [books, logState, notesBookId, imagesBookId, reasonBookId, onActivePhaseChange]);

  const activeId = notesBookId ?? imagesBookId;
  const tweetIds = activeId ? [...confirmedIds, activeId] : confirmedIds;
  const unanswered = books.filter((b) => !tweetIds.includes(b.userBookId) && b.userBookId !== reasonBookId);
  const hasAnyLogForDay = alreadyLoggedIds.length > 0;
  // One book per day — only prompt when no book has been logged yet for this day
  const canPromptNewBook = !hasAnyLogForDay && !activeId && !reasonBookId;
  const currentForYesNo = canPromptNewBook
    ? books.find((b) => b.userBookId === selectedId) ?? null
    : null;
  const notesBook = notesBookId ? books.find((b) => b.userBookId === notesBookId) : null;
  const imagesBook = imagesBookId ? books.find((b) => b.userBookId === imagesBookId) : null;

  // active = hide Next entirely (yes/no, notes, or reason phase — mandatory interaction)
  // pending = show but disable Next (images phase — optional but must confirm or skip)
  const notify = (sid: string | null, nid: string | null, iid: string | null, rid: string | null) => {
    onActivePhaseChange?.(!!(sid || rid || nid));
    onPendingChange?.(!!iid);
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
    onBookMarkedComplete?.(bookId);
    handleYesNo(true);
  };

  const handleNotesDone = () => {
    if (!notesBookId) return;
    const description = logState[notesBookId]?.description?.trim();
    if (!description) return;
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
    const entry = logState[id];
    if (entry?.didUserDo && !entry.description?.trim()) return;
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

  const handleEditNotes = (id: string) => {
    setConfirmedIds((prev) => prev.filter((cid) => cid !== id));
    setImagesBookId(null);
    setNotesBookId(id);
    notify(selectedId, id, null, reasonBookId);
  };

  return (
    <View style={styles.stepContent}>
      {readonlyBooks.map((book) => {
        const s = logState[book.userBookId];
        if (!s || !isBookLogComplete(book.userBookId)) return null;
        const status = s.didUserDo ? 'Read ✓' : `Skipped${s.reasonIfNo ? ` · ${s.reasonIfNo}` : ''}`;
        return (
          <React.Fragment key={`readonly-${book.userBookId}`}>
            <TweetSummary companion={companion} name={book.title} subtitle="Did you read it?" status={status} />
            {!!s.didUserDo && (
              <TweetSummary companion={companion} name={book.title} subtitle="How did it go?" status={s.description || '—'} />
            )}
          </React.Fragment>
        );
      })}

      {books.length === 0 && readonlyBooks.length === 0 && (
        <View style={styles.emptyStateRow}>
          <Text style={styles.emptyState}>No books in your reading list.</Text>
          <TouchableOpacity onPress={onAddBooks} activeOpacity={0.7}>
            <Text style={styles.emptyStateLink}>Add now →</Text>
          </TouchableOpacity>
        </View>
      )}

      {tweetIds.filter((id) => books.some((b) => b.userBookId === id)).map((id) => {
        const book = books.find((b) => b.userBookId === id);
        if (!book) return null;
        const s = logState[id];
        const status = s?.didUserDo ? 'Read ✓' : `Skipped${s?.reasonIfNo ? ` · ${s.reasonIfNo}` : ''}`;
        return (
          <React.Fragment key={id}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id)}>
              <TweetSummary companion={companion} name={book.title} subtitle="Did you read it?" status={status} editable />
            </TouchableOpacity>
            {!!s?.didUserDo && (confirmedIds.includes(id) || imagesBookId === id) && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEditNotes(id)}>
                <TweetSummary companion={companion} name={book.title} subtitle="How did it go?" status={s?.description || '—'} editable />
              </TouchableOpacity>
            )}
          </React.Fragment>
        );
      })}

      {/* Notes phase */}
      {notesBook && (() => {
        const notesText = logState[notesBook.userBookId]?.description?.trim() || '';
        const notesValid = notesText.length > 0;
        return (
        <CompanionBubble companion={companion}>
          <View style={styles.questionRow}>
            <Text style={styles.questionText}>How did it go with </Text>
            <Text style={styles.questionHighlight}>{notesBook.title}</Text>
            <Text style={styles.questionText}>?</Text>
          </View>
          <View style={styles.hoursWrap}>
            <View style={styles.notesRow}>
              <TextInput
                style={[styles.hoursInput, styles.descInput, styles.notesInput]}
                placeholder="Add your notes (required)"
                placeholderTextColor={colors.textMuted}
                value={logState[notesBook.userBookId]?.description || ''}
                onChangeText={(v) => onUpdate(notesBook.userBookId, 'description', v)}
                multiline
                autoFocus
                scrollEnabled
              />
              <TouchableOpacity
                style={[styles.notesDoneBtn, !notesValid && styles.notesDoneBtnDisabled]}
                onPress={handleNotesDone}
                disabled={!notesValid}
              >
                <Text style={[styles.inputDoneText, !notesValid && styles.inputDoneTextDisabled]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </CompanionBubble>
        );
      })()}

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
  inputDoneText: { fontSize: 12, fontWeight: '700' as const, color: colors.success },
  notesRow: { gap: 8 },
  notesInput: { width: '100%', maxHeight: 130 },
  notesDoneBtn: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.success },
  notesDoneBtnDisabled: { opacity: 0.35, borderColor: colors.textMuted },
  inputDoneTextDisabled: { color: colors.textMuted },
  addSecondBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  addSecondBtnText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  secondActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  secondActivityRowText: { fontSize: 15, color: colors.text, flex: 1 },
  secondActivityDifferentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  secondActivityDifferentText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
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
  actPickerListStandalone: {
    marginTop: 12,
    borderTopWidth: 1,
    borderRadius: 10,
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
  actPickerPillarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  actPickerPillarsText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

export default DailyLogModal;
