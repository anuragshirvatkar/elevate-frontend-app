import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { activitiesApi, setupApi, uploadsApi } from '../../api';
import type { ActivityLogEntry } from '../../types';
import { colors, spacing, typography, radius } from '../../theme';
import { format } from 'date-fns';
import type { MindSetup, CompanionDto } from '../../types';
import BicepIcon from '../../../assets/bicep.svg';
import BrainIcon from '../../../assets/brain.svg';
import CraftIcon from '../../../assets/craft.svg';
import PurityIcon from '../../../assets/purity.svg';

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
  userBookId?: string;
}

type ActivityEntry = { didUserDo: boolean; hours: string; description: string; images: string[] };

interface LogState {
  power: Record<string, ActivityEntry>;
  craft: Record<string, ActivityEntry>;
  purity: { relapseCount: string; description: string };
  mind: Record<string, { didUserDo: boolean; description: string; images: string[] }>;
}

// per-activity phase after "Yes"
type ActivityPhase = 'hours' | 'notes' | 'images';

const STEP_ORDER: Step[] = ['power', 'craft', 'purity', 'mind', 'done'];


const HOURS_OPTIONS = [
  { label: '< 1h', minutes: 50 },
  { label: '1-2h', minutes: 100 },
  { label: '2h+', minutes: 140 },
];
const HOURS_LABEL_TO_MINUTES: Record<string, number> = Object.fromEntries(
  HOURS_OPTIONS.map((o) => [o.label, o.minutes])
);

// Convert API hours value back to the display label
const hoursValueToLabel = (hours?: number): string => {
  if (!hours) return '';
  if (hours <= 1) return '< 1h';
  if (hours <= 2) return '1-2h';
  return '2h+';
};


const DailyLogModal: React.FC<DailyLogModalProps> = ({ visible, onClose, onComplete, onNavigateToMind, initialDate, initialSection }) => {
  const [step, setStep] = useState<Step>('power');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [powerActivities, setPowerActivities] = useState<SectionActivity[]>([]);
  const [craftActivities, setCraftActivities] = useState<SectionActivity[]>([]);
  const [mindBooks, setMindBooks] = useState<MindSetup['books']>([]);
  const [mindActive, setMindActive] = useState(true);
  const [logState, setLogState] = useState<LogState>({
    power: {},
    craft: {},
    purity: { relapseCount: '0', description: '' },
    mind: {},
  });
  const [loading, setLoading] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [companion, setCompanion] = useState<CompanionDto | null>(null);
  const [hasActivePhase, setHasActivePhase] = useState(false);
  const [purityComplete, setPurityComplete] = useState(false);
  const [pointsPopup, setPointsPopup] = useState<{ points: number; nextStep: Step } | null>(null);
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
      setPurityComplete(false);
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
      if (power.status === 'fulfilled') setPowerActivities(power.value.data.activities || []);
      if (craft.status === 'fulfilled') setCraftActivities(craft.value.data.activities || []);
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
      let newPurity = { relapseCount: '0', description: '' };
      let hasPurityLog = false;
      const newMind: Record<string, { didUserDo: boolean; description: string }> = {};

      for (const log of logs) {
        if (log.section === 'power' && log.activityId) {
          newPower[log.activityId] = {
            didUserDo: log.didUserDo ?? false,
            hours: hoursValueToLabel(log.hours),
            description: log.description ?? '',
            images: log.images ?? [],
          };
        } else if (log.section === 'craft' && log.activityId) {
          newCraft[log.activityId] = {
            didUserDo: log.didUserDo ?? false,
            hours: hoursValueToLabel(log.hours),
            description: log.description ?? '',
            images: log.images ?? [],
          };
        } else if (log.section === 'purity') {
          hasPurityLog = true;
          newPurity = {
            relapseCount: String(log.relapseCount ?? 0),
            description: log.description ?? '',
          };
        } else if (log.section === 'mind' && log.userBookId) {
          newMind[log.userBookId] = {
            didUserDo: log.didUserDo ?? false,
            description: log.description ?? '',
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

      // Advance to first section that has no logs yet
      const loggedSections = new Set(logs.map((l) => l.section));
      const completedFromLogs = new Set<string>();
      (['power', 'craft', 'purity', 'mind'] as const).forEach((s) => { if (loggedSections.has(s)) completedFromLogs.add(s); });
      if (!isMindActive) completedFromLogs.delete('mind');
      setCompletedSections(completedFromLogs);
      if (hasPurityLog) setPurityComplete(true);
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

  const updateCraft = (id: string, field: string, value: boolean | string) => {
    setPrefillLocked(false);
    setLogState((prev) => {
      const existing = prev.craft[id] || EMPTY_ACTIVITY;
      return { ...prev, craft: { ...prev.craft, [id]: { ...existing, [field]: value } } };
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
      setPointsPopup({ points, nextStep });
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
          date: dateStr,
        });
        const pts = (res.data as { points?: number }).points;
        if (pts) totalPoints += pts;
      } catch {}
    }
    for (const act of powerActivities) {
      if (!logState.power[act.activityId]) {
        try {
          const res = await activitiesApi.logActivity({ section: 'power', activityId: act.activityId, didUserDo: false, date: dateStr });
          const pts = (res.data as { points?: number }).points;
          if (pts) totalPoints += pts;
        } catch {}
      }
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
          date: dateStr,
        });
        const pts = (res.data as { points?: number }).points;
        if (pts) totalPoints += pts;
      } catch {}
    }
    for (const act of craftActivities) {
      if (!logState.craft[act.activityId]) {
        try {
          const res = await activitiesApi.logActivity({ section: 'craft', activityId: act.activityId, didUserDo: false, date: dateStr });
          const pts = (res.data as { points?: number }).points;
          if (pts) totalPoints += pts;
        } catch {}
      }
    }
    return totalPoints;
  };

  const submitPurity = async (dateStr: string): Promise<number> => {
    try {
      const res = await activitiesApi.logActivity({
        section: 'purity',
        relapseCount: parseInt(logState.purity.relapseCount || '0', 10),
        description: logState.purity.description || undefined,
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
          date: dateStr,
        });
        const pts = (res.data as { points?: number }).points;
        if (pts) totalPoints += pts;
      } catch {}
    }
    return totalPoints;
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

            {/* Center: section icons — display order: power, craft, mind, purity */}
            <View style={styles.headerIconsRow}>
              {(['power', 'craft', 'purity', 'mind'] as const).map((section) => {
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
                      <View style={styles.completedTick}>
                        <Ionicons name="checkmark" size={5} color="white" />
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
                  initialConfirmed={purityComplete}
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
                />
              )}
            </ScrollView>
          )}

          {!hasActivePhase && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.nextBtn, ((step === 'purity' && !purityComplete) || prefillLocked || (step === 'mind' && !mindHasChanges && (mindBooks?.length ?? 0) > 0)) && styles.nextBtnDisabled]}
                onPress={goNext}
                disabled={loading || (step === 'purity' && !purityComplete) || prefillLocked || (step === 'mind' && !mindHasChanges && (mindBooks?.length ?? 0) > 0)}
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
              maximumDate={new Date()}
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (event.type === 'set' && date) {
                  setSelectedDate(date);
                  // Reset logState then prefill with whatever exists for the new date
                  setLogState({
                    power: {},
                    craft: {},
                    purity: { relapseCount: '0', description: '' },
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

  const pickAndUpload = async () => {
    if (images.length >= MAX_IMAGES || pendingUri) return;
    setSizeError(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      setSizeError(true);
      return;
    }

    // show local preview immediately — no waiting for upload
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
          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickAndUpload}>
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
    </View>
  );
};

const ActivityLogStep: React.FC<{
  activities: SectionActivity[];
  logState: Record<string, ActivityEntry>;
  onUpdate: (id: string, field: string, value: boolean | string) => void;
  onUpdateImages: (id: string, images: string[]) => void;
  companion: CompanionDto | null;
  question: string;
  hoursQuestion: string;
  emptyText: string;
  onActivePhaseChange?: (active: boolean) => void;
}> = ({ activities, logState, onUpdate, onUpdateImages, companion, question, hoursQuestion, emptyText, onActivePhaseChange }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<string[]>(() =>
    activities.filter((a) => a.activityId in logState).map((a) => a.activityId)
  );
  const [activePhase, setActivePhase] = useState<{ id: string; phase: ActivityPhase } | null>(null);

  useEffect(() => {
    onActivePhaseChange?.(activePhase !== null);
  }, [activePhase]);

  // activity is in the list as soon as answered (even mid-flow), so user can always see + edit it
  const tweetIds = activePhase
    ? [...confirmedIds, activePhase.id]
    : confirmedIds;

  const unanswered = activities.filter((a) => !tweetIds.includes(a.activityId));

  // yes/no question only shows when no activity is mid-flow
  const currentForYesNo = activePhase
    ? null
    : (activities.find((a) => a.activityId === selectedId) || unanswered[0]);

  const phaseActivity = activePhase
    ? activities.find((a) => a.activityId === activePhase.id)
    : null;

  const handleYesNo = (didDo: boolean) => {
    if (!currentForYesNo) return;
    onUpdate(currentForYesNo.activityId, 'didUserDo', didDo);
    if (didDo) {
      setActivePhase({ id: currentForYesNo.activityId, phase: 'hours' });
    } else {
      setConfirmedIds((prev) => [...prev, currentForYesNo.activityId]);
    }
    setSelectedId(null);
    setShowDropdown(false);
  };

  const handleHoursDone = () => {
    if (!activePhase) return;
    setActivePhase({ id: activePhase.id, phase: 'notes' });
  };

  const handleNotesDone = () => {
    if (!activePhase) return;
    setActivePhase({ id: activePhase.id, phase: 'images' });
  };

  const confirmActivity = (id: string) => {
    setConfirmedIds((prev) => [...prev, id]);
    setActivePhase(null);
  };

  const handleEdit = (id: string, phase: 'yesno' | 'hours' | 'notes' | 'images' = 'yesno') => {
    setConfirmedIds((prev) => prev.filter((cid) => cid !== id));
    if (phase === 'yesno') {
      onUpdate(id, 'didUserDo', false);
      onUpdate(id, 'hours', '');
      onUpdate(id, 'description', '');
      onUpdateImages(id, []);
      setActivePhase(null);
      setSelectedId(id);
    } else if (phase === 'hours') {
      onUpdate(id, 'hours', '');
      setActivePhase({ id, phase: 'hours' });
    } else if (phase === 'notes') {
      setActivePhase({ id, phase: 'notes' });
    } else {
      // images — keep everything, just re-open the images picker
      setActivePhase({ id, phase: 'images' });
    }
  };

  return (
    <View style={styles.stepContent}>
      {activities.length === 0 && <Text style={styles.emptyState}>{emptyText}</Text>}

      {/* One row per answered phase per activity */}
      {tweetIds.map((id) => {
        const act = activities.find((a) => a.activityId === id);
        if (!act) return null;
        const s = logState[id];
        const isActive = activePhase?.id === id;
        const isConfirmed = confirmedIds.includes(id);
        const inNotesOrLater = isActive && (activePhase?.phase === 'notes' || activePhase?.phase === 'images');
        const inImagesPhase = isActive && activePhase?.phase === 'images';
        const showHoursRow = !!s?.didUserDo && (isConfirmed || inNotesOrLater);
        const showNotesRow = !!s?.didUserDo && (isConfirmed || inImagesPhase);
        const showImagesRow = isConfirmed && !!s?.didUserDo && !!(s?.images?.length);

        return (
          <React.Fragment key={id}>
            {/* Row 1 — Yes / No */}
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'yesno')}>
              <TweetSummary
                companion={companion}
                name={act.name}
                subtitle={`${question} it?`}
                status={s?.didUserDo ? 'Yes' : 'No'}
                editable
              />
            </TouchableOpacity>

            {/* Row 2 — Hours */}
            {showHoursRow && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'hours')}>
                <TweetSummary
                  companion={companion}
                  name={act.name}
                  subtitle="How many hours?"
                  status={s?.hours || '—'}
                  editable
                />
              </TouchableOpacity>
            )}

            {/* Row 3 — Notes */}
            {showNotesRow && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'notes')}>
                <TweetSummary
                  companion={companion}
                  name={act.name}
                  subtitle="How did it go?"
                  status={s?.description || '—'}
                  editable
                />
              </TouchableOpacity>
            )}

            {/* Row 4 — Photos (only if user added some) */}
            {showImagesRow && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => handleEdit(id, 'images')}>
                <TweetSummary
                  companion={companion}
                  name={act.name}
                  subtitle="Session photos"
                  status={`${s!.images.length} photo${s!.images.length > 1 ? 's' : ''}`}
                  editable
                />
              </TouchableOpacity>
            )}
          </React.Fragment>
        );
      })}

      {/* Phase-specific companion question */}
      {phaseActivity && activePhase?.phase === 'hours' && (
        <CompanionBubble companion={companion}>
          <View style={styles.questionRow}>
            <Text style={styles.questionText}>{hoursQuestion} </Text>
            <Text style={styles.questionHighlight}>{phaseActivity.name}</Text>
            <Text style={styles.questionText}>?</Text>
          </View>
          <View style={styles.hoursOptionsRow}>
            {HOURS_OPTIONS.map((opt) => {
              const selected = logState[phaseActivity.activityId]?.hours === opt.label;
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[styles.hoursOption, selected && styles.hoursOptionActive]}
                  onPress={() => {
                    onUpdate(phaseActivity.activityId, 'hours', opt.label);
                    handleHoursDone();
                  }}
                >
                  <Text style={[styles.hoursOptionText, selected && styles.hoursOptionTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </CompanionBubble>
      )}

      {phaseActivity && activePhase?.phase === 'notes' && (
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
                value={logState[phaseActivity.activityId]?.description || ''}
                onChangeText={(v) => onUpdate(phaseActivity.activityId, 'description', v)}
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

      {phaseActivity && activePhase?.phase === 'images' && (
        <CompanionBubble companion={companion}>
          <View style={styles.questionRow}>
            <Text style={styles.questionText}>Share photos from </Text>
            <Text style={styles.questionHighlight}>{phaseActivity.name}</Text>
            <Text style={styles.questionText}> session?</Text>
          </View>
          <Text style={styles.optionalLabel}>optional</Text>
          <ImageUploadSection
            images={logState[phaseActivity.activityId]?.images || []}
            onImagesChange={(imgs) => onUpdateImages(phaseActivity.activityId, imgs)}
            onConfirm={() => confirmActivity(phaseActivity.activityId)}
          />
        </CompanionBubble>
      )}

      {/* Companion yes/no question for next unanswered activity */}
      {currentForYesNo && (
        <CompanionBubble companion={companion}>
          <View style={styles.questionRow}>
            <Text style={styles.questionText}>{question} </Text>
            {activities.length > 2 ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowDropdown((s) => !s)}
                style={styles.activityDropdownBtn}
              >
                <Text style={styles.activityDropdownText}>
                  {currentForYesNo.name} <Ionicons name="chevron-down" size={14} color={colors.text} />
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.questionHighlight}>{currentForYesNo.name}</Text>
            )}
            <Text style={styles.questionText}>?</Text>
          </View>

          {showDropdown && activities.length > 2 && (
            <View style={styles.dropdown}>
              {unanswered.map((act) => (
                <TouchableOpacity
                  key={act.activityId}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedId(act.activityId);
                    setShowDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{act.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.yesNo}>
            <TouchableOpacity style={styles.yesBtn} onPress={() => handleYesNo(true)}>
              <Text style={styles.yesNoText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.noBtn} onPress={() => handleYesNo(false)}>
              <Text style={styles.yesNoText}>No</Text>
            </TouchableOpacity>
          </View>
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
  companion: CompanionDto | null;
  onActivePhaseChange?: (active: boolean) => void;
}> = ({ activities, logState, onUpdate, onUpdateImages, companion, onActivePhaseChange }) => (
  <ActivityLogStep
    activities={activities}
    logState={logState}
    onUpdate={onUpdate}
    onUpdateImages={onUpdateImages}
    companion={companion}
    question="Did you go to"
    hoursQuestion="Nice! How many hours did you spend on"
    emptyText="No power activities configured."
    onActivePhaseChange={onActivePhaseChange}
  />
);

const CraftStep: React.FC<{
  activities: SectionActivity[];
  logState: Record<string, ActivityEntry>;
  onUpdate: (id: string, field: string, value: boolean | string) => void;
  onUpdateImages: (id: string, images: string[]) => void;
  companion: CompanionDto | null;
  onActivePhaseChange?: (active: boolean) => void;
}> = ({ activities, logState, onUpdate, onUpdateImages, companion, onActivePhaseChange }) => (
  <ActivityLogStep
    activities={activities}
    logState={logState}
    onUpdate={onUpdate}
    onUpdateImages={onUpdateImages}
    companion={companion}
    question="Did you work on"
    hoursQuestion="Nice! How many hours did you put into"
    emptyText="No craft activities configured."
    onActivePhaseChange={onActivePhaseChange}
  />
);

const RELAPSE_CAUSES = ['Stress', 'Boredom', 'Loneliness', 'Online triggers', 'Late night', 'Other'];

const PurityStep: React.FC<{
  state: { relapseCount: string; description: string };
  onUpdate: (field: string, val: string) => void;
  companion: CompanionDto | null;
  onCompleteChange?: (complete: boolean) => void;
  initialConfirmed?: boolean;
}> = ({ state, onUpdate, companion, onCompleteChange, initialConfirmed }) => {
  const [mode, setMode] = useState<'question' | 'clean' | 'relapsed'>(() => {
    if (!initialConfirmed) return 'question';
    return parseInt(state.relapseCount || '0', 10) === 0 ? 'clean' : 'relapsed';
  });
  const [selectedCause, setSelectedCause] = useState(() =>
    initialConfirmed && state.description ? state.description : ''
  );
  const [confirmed, setConfirmed] = useState(initialConfirmed ?? false);

  const count = parseInt(state.relapseCount || '0', 10);

  const confirm = (clean: boolean) => {
    setConfirmed(true);
    onCompleteChange?.(true);
    if (clean) onCompleteChange?.(true);
  };

  const handleClean = () => {
    onUpdate('relapseCount', '0');
    onUpdate('description', '');
    setMode('clean');
    setConfirmed(true);
    onCompleteChange?.(true);
  };

  const handleRelapsed = () => {
    onUpdate('relapseCount', '0');
    onUpdate('description', '');
    setSelectedCause('');
    setMode('relapsed');
  };

  const handleCauseSelect = (cause: string) => {
    setSelectedCause(cause);
    if (cause !== 'Other') {
      onUpdate('description', cause);
      setConfirmed(true);
      onCompleteChange?.(true);
    } else {
      onUpdate('description', '');
    }
  };

  const handleOtherConfirm = () => {
    if (!state.description.trim()) return;
    setConfirmed(true);
    onCompleteChange?.(true);
  };

  const handleEdit = () => {
    setConfirmed(false);
    setSelectedCause('');
    setMode('question');
    onUpdate('relapseCount', '0');
    onUpdate('description', '');
    onCompleteChange?.(false);
  };

  const tweetStatus = mode === 'clean'
    ? 'Clean ✓'
    : `Relapsed × ${count}${state.description ? ` · ${state.description}` : ''}`;

  return (
    <View style={styles.stepContent}>
      {confirmed && (
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

      {!confirmed && (
        <CompanionBubble companion={companion}>
          <View style={styles.questionRow}>
            <Text style={styles.questionText}>Did you stay clean today?</Text>
          </View>

          <View style={styles.yesNo}>
            <TouchableOpacity
              style={[styles.yesBtn, mode === 'clean' && styles.yesBtnActive]}
              onPress={handleClean}
            >
              <Text style={[styles.yesNoText, mode === 'clean' && styles.yesNoTextActive]}>
                ✓ Clean
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.noBtn, mode === 'relapsed' && styles.noBtnActive]}
              onPress={handleRelapsed}
            >
              <Text style={styles.yesNoText}>Relapsed</Text>
            </TouchableOpacity>
          </View>

          {mode === 'relapsed' && (
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
                        style={[styles.relapseCauseChip, selectedCause === cause && styles.relapseCauseChipActive]}
                        onPress={() => handleCauseSelect(cause)}
                      >
                        <Text style={[styles.relapseCauseText, selectedCause === cause && styles.relapseCauseTextActive]}>
                          {cause}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {selectedCause === 'Other' && (
                    <View style={styles.inputWithTick}>
                      <TextInput
                        style={[styles.hoursInput, styles.hoursInputPad]}
                        placeholder="What caused it?"
                        placeholderTextColor={colors.textMuted}
                        value={state.description}
                        onChangeText={(v) => onUpdate('description', v)}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={styles.inputTickBtn}
                        onPress={handleOtherConfirm}
                      >
                        <Ionicons
                          name="checkmark"
                          size={22}
                          color={state.description.trim() ? colors.success : colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </CompanionBubble>
      )}
    </View>
  );
};

const MindStep: React.FC<{
  books: Array<{ userBookId: string; title: string; author?: string }>;
  logState: Record<string, { didUserDo: boolean; description: string; images: string[] }>;
  onUpdate: (id: string, field: string, value: boolean | string) => void;
  onUpdateImages: (id: string, images: string[]) => void;
  companion: CompanionDto | null;
  onAddBooks?: () => void;
}> = ({ books, logState, onUpdate, onUpdateImages, companion, onAddBooks }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<string[]>(() =>
    books.filter((b) => b.userBookId in logState).map((b) => b.userBookId)
  );
  const [notesBookId, setNotesBookId] = useState<string | null>(null);
  const [imagesBookId, setImagesBookId] = useState<string | null>(null);

  const activeId = notesBookId ?? imagesBookId;
  const tweetIds = activeId ? [...confirmedIds, activeId] : confirmedIds;
  const unanswered = books.filter((b) => !tweetIds.includes(b.userBookId));
  const currentForYesNo = activeId ? null : (books.find((b) => b.userBookId === selectedId) || unanswered[0]);
  const notesBook = notesBookId ? books.find((b) => b.userBookId === notesBookId) : null;
  const imagesBook = imagesBookId ? books.find((b) => b.userBookId === imagesBookId) : null;

  const handleYesNo = (didDo: boolean) => {
    if (!currentForYesNo) return;
    onUpdate(currentForYesNo.userBookId, 'didUserDo', didDo);
    if (didDo) setNotesBookId(currentForYesNo.userBookId);
    else setConfirmedIds((prev) => [...prev, currentForYesNo.userBookId]);
    setSelectedId(null);
    setShowDropdown(false);
  };

  const handleMarkComplete = async (bookId: string) => {
    try { await setupApi.putMind({ books: [{ userBookId: bookId, isCompleted: true }] }); } catch {}
    handleYesNo(true);
  };

  const handleNotesDone = () => {
    if (!notesBookId) return;
    setImagesBookId(notesBookId);
    setNotesBookId(null);
  };

  const confirmBook = (id: string) => {
    setConfirmedIds((prev) => [...prev, id]);
    setImagesBookId(null);
  };

  const handleEdit = (id: string) => {
    onUpdate(id, 'didUserDo', false);
    onUpdate(id, 'description', '');
    onUpdateImages(id, []);
    if (notesBookId === id) setNotesBookId(null);
    if (imagesBookId === id) setImagesBookId(null);
    setConfirmedIds((prev) => prev.filter((cid) => cid !== id));
    setSelectedId(id);
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
        const status = s?.didUserDo ? 'Read ✓' : 'Skipped';
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

      {/* Yes / No question */}
      {currentForYesNo && (
        <>
          <TouchableOpacity
            style={styles.finishedBookBtn}
            onPress={() => handleMarkComplete(currentForYesNo.userBookId)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="checkmark-circle" size={13} color={colors.background} />
            <Text style={styles.finishedBookBtnText}>Mark book as complete</Text>
          </TouchableOpacity>
        <CompanionBubble companion={companion}>
          <View style={styles.questionRow}>
            <Text style={styles.questionText}>Did you read </Text>
            {books.length > 2 ? (
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowDropdown((s) => !s)} style={styles.activityDropdownBtn}>
                <Text style={styles.activityDropdownText}>
                  {currentForYesNo.title} <Ionicons name="chevron-down" size={14} color={colors.text} />
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.questionHighlight}>{currentForYesNo.title}</Text>
            )}
            <Text style={styles.questionText}>?</Text>
          </View>

          {currentForYesNo.author && <Text style={styles.bookAuthor}>{currentForYesNo.author}</Text>}

          {showDropdown && books.length > 2 && (
            <View style={styles.dropdown}>
              {unanswered.map((book) => (
                <TouchableOpacity key={book.userBookId} style={styles.dropdownItem} onPress={() => { setSelectedId(book.userBookId); setShowDropdown(false); }}>
                  <Text style={styles.dropdownItemText}>{book.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.yesNo}>
            <TouchableOpacity style={styles.yesBtn} onPress={() => handleYesNo(true)}>
              <Text style={styles.yesNoText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.noBtn} onPress={() => handleYesNo(false)}>
              <Text style={styles.yesNoText}>No</Text>
            </TouchableOpacity>
          </View>
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
  companion: CompanionDto | null;
  onContinue: () => void;
}> = ({ points, companion, onContinue }) => {
  const [msgIdx] = useState(() => Math.floor(Math.random() * (points > 0 ? GAIN_MSGS.length : LOSS_MSGS.length)));
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
    inset: 0,
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
  hoursOptionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    width: '100%',
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
});

export default DailyLogModal;
