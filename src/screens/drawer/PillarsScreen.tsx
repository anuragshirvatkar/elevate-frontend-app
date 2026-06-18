import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Platform, Modal, TextInput, FlatList,
  ActivityIndicator, KeyboardAvoidingView, BackHandler,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, typography, radius } from '../../theme';
import { getActivityDisplayName, isSameActivity } from '../../utils/activityDisplayName';
import { useAlert } from '../../context/AlertContext';
import { setupApi } from '../../api/setup';
import { activitiesApi } from '../../api/activities';
import { booksApi, getBookSummaryPdfUrl } from '../../api/books';
import type { SectionSetup, MindSetup, SetupOptionsResponse, ActivityDto, BookDto } from '../../types';

type Tab = 'Power' | 'Craft' | 'Mind';
const TABS: Tab[] = ['Power', 'Craft', 'Mind'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MAX_REST_DAYS: Record<'power' | 'craft', number> = { power: 2, craft: 1 };

type PillarsRouteParams = { tab?: Tab };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseTime = (t?: string): Date => {
  const d = new Date();
  if (!t) return d;
  const [h, m] = t.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

const formatTime = (d: Date): string => {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

const formatDisplay = (t?: string): string => {
  if (!t) return 'Not set';
  const d = parseTime(t);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
};

const timeDiffMinutes = (t1: string, t2: string): number => {
  const [h1, m1] = t1.split(':').map(Number);
  const [h2, m2] = t2.split(':').map(Number);
  const diff = Math.abs(h1 * 60 + m1 - (h2 * 60 + m2));
  return Math.min(diff, 1440 - diff);
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityItem {
  activityId: string;
  name: string;
  isPrimary: boolean;
}

interface SectionState {
  preferredTime?: string;
  restDays: string[];
  activities: ActivityItem[];
}

interface MindState {
  isActive: boolean;
  preferredTime?: string;
  restDays: string[];
  books: Array<{
    userBookId: string;
    title: string;
    author?: string;
    isCompleted: boolean;
    aiSummary?: string | null;
    summaryPdfUrl?: string | null;
    summaryPdfFilename?: string | null;
  }>;
}

const buildPillarsSnapshot = (power: SectionState, craft: SectionState, mind: MindState) => JSON.stringify({
  power: {
    preferredTime: power.preferredTime ?? null,
    restDays: [...power.restDays].sort(),
    activities: power.activities.map((a) => ({
      activityId: a.activityId,
      isPrimary: a.isPrimary,
    })),
  },
  craft: {
    preferredTime: craft.preferredTime ?? null,
    restDays: [...craft.restDays].sort(),
    activities: craft.activities.map((a) => ({
      activityId: a.activityId,
      isPrimary: a.isPrimary,
    })),
  },
  mind: {
    isActive: mind.isActive,
    preferredTime: mind.preferredTime ?? null,
    restDays: [...mind.restDays].sort(),
    books: mind.books.map((b) => ({
      userBookId: b.userBookId,
      isCompleted: !!b.isCompleted,
    })),
  },
});

// ─── Main Component ───────────────────────────────────────────────────────────

const PillarsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ Pillars: PillarsRouteParams }, 'Pillars'>>();
  const { showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState<Tab>('Power');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [power, setPower] = useState<SectionState>({ restDays: [], activities: [] });
  const [craft, setCraft] = useState<SectionState>({ restDays: [], activities: [] });
  const [mind, setMind] = useState<MindState>({ isActive: true, restDays: [], books: [] });

  // options cache for activity picker
  const optionsCache = useRef<SetupOptionsResponse['activities'] | null>(null);

  // time picker
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<Tab>('Power');
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // activity picker modal
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [activityPickerSection, setActivityPickerSection] = useState<'power' | 'craft'>('power');
  const [pickerOptions, setPickerOptions] = useState<ActivityDto[]>([]);
  const [pickerCustomIds, setPickerCustomIds] = useState<Set<string>>(new Set());
  const [pickerCustomModalVisible, setPickerCustomModalVisible] = useState(false);
  const [pickerCustomName, setPickerCustomName] = useState('');
  const [pickerCreatingCustom, setPickerCreatingCustom] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);

  // ── Unsaved changes guard ─────────────────────────────────────────────────

  const hasUnsavedChanges = useRef(false);
  const baselineSnapshot = useRef('');
  const isSavingRef = useRef(false);
  const mindEnabledUnsaved = useRef(false);
  const saveAllRef = useRef<(() => Promise<boolean>) | null>(null);
  const loadAllRef = useRef<(() => Promise<void>) | null>(null);

  const syncDirtyState = useCallback((p: SectionState, c: SectionState, m: MindState) => {
    hasUnsavedChanges.current = buildPillarsSnapshot(p, c, m) !== baselineSnapshot.current;
  }, []);

  const setBaseline = useCallback((p: SectionState, c: SectionState, m: MindState) => {
    baselineSnapshot.current = buildPillarsSnapshot(p, c, m);
    hasUnsavedChanges.current = false;
  }, []);

  const resetMindEnableDraft = useCallback(() => {
    if (mindEnabledUnsaved.current) {
      setMind((s) => ({ ...s, isActive: false }));
      mindEnabledUnsaved.current = false;
    }
  }, []);

  const promptUnsavedChanges = useCallback((onProceed: () => void) => {
    showAlert(
      'Unsaved Changes',
      'You have unsaved changes. What would you like to do?',
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            resetMindEnableDraft();
            await loadAllRef.current?.();
            hasUnsavedChanges.current = false;
            onProceed();
          },
        },
        {
          text: 'Save',
          onPress: async () => {
            isSavingRef.current = true;
            const ok = await saveAllRef.current?.();
            isSavingRef.current = false;
            if (ok) onProceed();
          },
        },
      ],
    );
  }, [resetMindEnableDraft, showAlert]);

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges.current && !isSavingRef.current) {
      promptUnsavedChanges(() => navigation.goBack());
      return;
    }
    navigation.goBack();
  }, [navigation, promptUnsavedChanges]);

  useEffect(() => {
    if (loading) return;
    syncDirtyState(power, craft, mind);
  }, [power, craft, mind, loading, syncDirtyState]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
        if (!hasUnsavedChanges.current || isSavingRef.current) return;
        e.preventDefault();
        promptUnsavedChanges(() => navigation.dispatch(e.data.action));
      });

      const backHandler = Platform.OS === 'android'
        ? BackHandler.addEventListener('hardwareBackPress', () => {
            if (hasUnsavedChanges.current && !isSavingRef.current) {
              promptUnsavedChanges(() => navigation.goBack());
              return true;
            }
            return false;
          })
        : null;

      return () => {
        unsubscribe();
        backHandler?.remove();
      };
    }, [navigation, promptUnsavedChanges]),
  );

  const handleTabChange = (tab: Tab) => {
    if (tab === activeTab) return;

    const applyTabChange = () => {
      if (activeTab === 'Mind' && mindEnabledUnsaved.current && mind.books.length === 0) {
        setMind((s) => ({ ...s, isActive: false }));
        mindEnabledUnsaved.current = false;
      }
      setActiveTab(tab);
    };

    if (hasUnsavedChanges.current && !isSavingRef.current) {
      promptUnsavedChanges(applyTabChange);
      return;
    }

    applyTabChange();
  };

  useEffect(() => {
    const tab = route.params?.tab;
    if (tab && TABS.includes(tab)) {
      setActiveTab(tab);
    }
  }, [route.params?.tab]);

  // ── Load ──────────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, []),
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [powerRes, craftRes, mindRes] = await Promise.all([
        setupApi.getSection('power'),
        setupApi.getSection('craft'),
        setupApi.getMind(),
      ]);
      const p = powerRes.data as SectionSetup;
      const loadedPower: SectionState = {
        preferredTime: p.preferredTime,
        restDays: p.restDays ?? [],
        activities: (p.activities ?? []).map((a: { activityId?: string; id?: string; name: string; isPrimary?: boolean }) => ({
          activityId: a.activityId ?? a.id ?? '',
          name: a.name,
          isPrimary: a.isPrimary ?? false,
        })).filter((a) => a.activityId && a.name),
      };
      const c = craftRes.data as SectionSetup;
      const loadedCraft: SectionState = {
        preferredTime: c.preferredTime,
        restDays: c.restDays ?? [],
        activities: (c.activities ?? []).map((a: { activityId?: string; id?: string; name: string; isPrimary?: boolean }) => ({
          activityId: a.activityId ?? a.id ?? '',
          name: a.name,
          isPrimary: a.isPrimary ?? false,
        })).filter((a) => a.activityId && a.name),
      };
      const mn = mindRes.data as MindSetup;
      const loadedMind: MindState = {
        isActive: mn.isActive ?? true,
        preferredTime: mn.preferredTime,
        restDays: mn.restDays ?? [],
        books: (mn.books ?? []).map((b) => ({
          userBookId: b.userBookId,
          title: b.title,
          author: b.author,
          isCompleted: !!b.isCompleted,
          aiSummary: b.aiSummary ?? null,
          summaryPdfUrl: b.summaryPdfUrl ?? null,
          summaryPdfFilename: b.summaryPdfFilename ?? null,
        })),
      };
      setPower(loadedPower);
      setCraft(loadedCraft);
      setMind(loadedMind);
      setBaseline(loadedPower, loadedCraft, loadedMind);
    } catch {
      showAlert('Error', 'Failed to load pillar settings.');
    } finally {
      setLoading(false);
    }
  };

  loadAllRef.current = loadAll;

  // ── Rest days ─────────────────────────────────────────────────────────────

  const toggleDay = (target: Tab, key: string) => {
    const section = target === 'Power' ? 'power' : target === 'Craft' ? 'craft' : null;
    const setter =
      target === 'Power' ? setPower
      : target === 'Craft' ? setCraft
      : null;

    if (setter && section) {
      const limit = MAX_REST_DAYS[section];
      setter((s) => {
        if (s.restDays.includes(key)) {
          return { ...s, restDays: s.restDays.filter((d) => d !== key) };
        }
        if (s.restDays.length >= limit) {
          // radio behaviour: replace existing selection
          return { ...s, restDays: [key] };
        }
        return { ...s, restDays: [...s.restDays, key] };
      });
    } else {
      setMind((s) => ({
        ...s,
        restDays: s.restDays.includes(key)
          ? s.restDays.filter((d) => d !== key)
          : [...s.restDays, key],
      }));
    }
  };

  // ── Activities ────────────────────────────────────────────────────────────

  const togglePrimary = (section: 'power' | 'craft', activityId: string) => {
    const setter = section === 'power' ? setPower : setCraft;
    setter((s) => ({
      ...s,
      activities: s.activities.map((a) => ({
        ...a,
        isPrimary: a.activityId === activityId ? !a.isPrimary : false,
      })),
    }));
  };

  const removeActivity = (section: 'power' | 'craft', activityId: string) => {
    const setter = section === 'power' ? setPower : setCraft;
    setter((s) => ({ ...s, activities: s.activities.filter((a) => a.activityId !== activityId) }));
  };

  const openActivityPicker = async (section: 'power' | 'craft') => {
    setActivityPickerSection(section);
    setPickerCustomName('');
    setPickerLoading(true);
    setShowActivityPicker(true);
    try {
      const [{ data: optionsData }, { data: customData }] = await Promise.all([
        setupApi.getOptions(),
        activitiesApi.getCustom(),
      ]);
      if (!optionsCache.current) {
        optionsCache.current = optionsData.activities;
      }
      const sectionOptions = optionsData.activities[section] ?? [];
      const sectionCustom = (customData as Array<{ id: string; name: string; section: string }>)
        .filter((a) => a.section === section);
      const customIds = new Set(sectionCustom.map((a) => a.id));
      const merged = [...sectionOptions];
      for (const custom of sectionCustom) {
        if (!merged.some((a) => a.id === custom.id)) {
          merged.push({ id: custom.id, name: custom.name, section: custom.section as ActivityDto['section'] });
        }
      }
      const current = section === 'power' ? power.activities : craft.activities;
      setPickerCustomIds(customIds);
      setPickerOptions(merged.filter((option) => !current.some((selected) => isSameActivity(
        section,
        { activityId: selected.activityId, name: selected.name },
        { id: option.id, name: option.name },
      ))));
    } catch {
      showAlert('Error', 'Failed to load activities.');
      setShowActivityPicker(false);
    } finally {
      setPickerLoading(false);
    }
  };

  const addActivityFromPicker = (activity: ActivityDto) => {
    const setter = activityPickerSection === 'power' ? setPower : setCraft;
    setter((s) => {
      if (s.activities.some((a) => isSameActivity(activityPickerSection, a, { id: activity.id, name: activity.name }))) {
        return s;
      }
      return {
        ...s,
        activities: [
          ...s.activities,
          { activityId: activity.id, name: activity.name, isPrimary: false },
        ],
      };
    });
    setShowActivityPicker(false);
  };

  const createCustomActivity = async () => {
    const name = pickerCustomName.trim();
    if (!name) return;
    const state = activityPickerSection === 'power' ? power : craft;
    if (state.activities.some((a) => isSameActivity(activityPickerSection, a, { name }))) {
      showAlert('Already added', 'This activity is already in your list.');
      return;
    }
    setPickerCreatingCustom(true);
    try {
      const res = await activitiesApi.createCustom(name, activityPickerSection);
      const created = res.data;
      const setter = activityPickerSection === 'power' ? setPower : setCraft;
      setter((s) => {
        if (s.activities.some((a) => isSameActivity(activityPickerSection, a, { id: created.id, name: created.name }))) {
          return s;
        }
        return {
          ...s,
          activities: [
            ...s.activities,
            { activityId: created.id, name: created.name, isPrimary: false },
          ],
        };
      });
      setPickerCustomModalVisible(false);
      setShowActivityPicker(false);
      setPickerCustomName('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create activity.';
      showAlert('Error', msg);
    } finally {
      setPickerCreatingCustom(false);
    }
  };

  // ── Books ─────────────────────────────────────────────────────────────────

  // ── Enable-mind modal ─────────────────────────────────────────────────────
  const [showEnableMindModal, setShowEnableMindModal] = useState(false);
  const [enableMindBook, setEnableMindBook] = useState<{ id: string; title: string; author?: string } | null>(null);
  const [enableMindTime, setEnableMindTime] = useState<string | undefined>(undefined);
  const [enableMindTimePickerVisible, setEnableMindTimePickerVisible] = useState(false);
  const [enableMindBookSearch, setEnableMindBookSearch] = useState('');
  const [enableMindBookOptions, setEnableMindBookOptions] = useState<BookDto[]>([]);
  const [enableMindBookLoading, setEnableMindBookLoading] = useState(false);
  const [enableMindSaving, setEnableMindSaving] = useState(false);

  const openEnableMindModal = async () => {
    setEnableMindBook(null);
    setEnableMindTime(undefined);
    setEnableMindBookSearch('');
    setEnableMindBookLoading(true);
    setShowEnableMindModal(true);
    try {
      let opts = optionsCache.current;
      if (!opts) {
        const res = await setupApi.getOptions();
        opts = (res.data as SetupOptionsResponse).activities;
        optionsCache.current = opts;
        (optionsCache as any).books = (res.data as any).books ?? [];
      }
      setEnableMindBookOptions((optionsCache as any).books ?? []);
    } catch {
      showAlert('Error', 'Failed to load books.');
      setShowEnableMindModal(false);
    } finally {
      setEnableMindBookLoading(false);
    }
  };

  const confirmEnableMind = async () => {
    if (!enableMindBook) {
      showAlert('Required', 'Please select at least one book to enable the Mind section.');
      return;
    }
    setEnableMindSaving(true);
    try {
      await setupApi.saveProgress({
        sections: {
          mind: {
            preferredTime: enableMindTime,
            restDays: [],
            bookIds: [enableMindBook.id],
          },
        },
      });
      setMind((prev) => ({
        ...prev,
        isActive: true,
        preferredTime: enableMindTime,
        books: prev.books.some((b) => b.userBookId === enableMindBook.id)
          ? prev.books
          : [...prev.books, { userBookId: enableMindBook.id, title: enableMindBook.title, author: enableMindBook.author, isCompleted: false }],
      }));
      setShowEnableMindModal(false);
    } catch {
      showAlert('Error', 'Failed to enable Mind section.');
    } finally {
      setEnableMindSaving(false);
    }
  };

  const discardEnableMind = () => {
    setShowEnableMindModal(false);
  };

  // book picker
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [bookPickerSearch, setBookPickerSearch] = useState('');
  const [bookPickerOptions, setBookPickerOptions] = useState<BookDto[]>([]);
  const [bookPickerLoading, setBookPickerLoading] = useState(false);
  // custom book modal
  const [showCustomBook, setShowCustomBook] = useState(false);
  const [customBookTitle, setCustomBookTitle] = useState('');
  const [customBookAuthor, setCustomBookAuthor] = useState('');
  const [customBookPages, setCustomBookPages] = useState('');
  const [addingCustomBook, setAddingCustomBook] = useState(false);
  // AI summary
  const [generatingSummary, setGeneratingSummary] = useState<string | null>(null);
  const [editSummaryBookId, setEditSummaryBookId] = useState<string | null>(null);
  const [editSummaryText, setEditSummaryText] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);
  const [completingBookId, setCompletingBookId] = useState<string | null>(null);
  const [viewSummaryBook, setViewSummaryBook] = useState<{
    title: string;
    summary: string;
    userBookId: string;
    filename: string;
    loading: boolean;
  } | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  const openBookPicker = async () => {
    setBookPickerSearch('');
    setBookPickerLoading(true);
    setShowBookPicker(true);
    try {
      let opts = optionsCache.current;
      if (!opts) {
        const res = await setupApi.getOptions();
        opts = (res.data as SetupOptionsResponse).activities;
        optionsCache.current = opts;
        // cache books too
        (optionsCache as any).books = (res.data as any).books ?? [];
      }
      const systemBooks: BookDto[] = (optionsCache as any).books ?? [];
      const currentIds = new Set(mind.books.map((b) => b.userBookId));
      setBookPickerOptions(systemBooks.filter((b) => !currentIds.has(b.id)));
    } catch {
      showAlert('Error', 'Failed to load books.');
      setShowBookPicker(false);
    } finally {
      setBookPickerLoading(false);
    }
  };

  const addSystemBook = async (book: BookDto) => {
    const activeCount = mind.books.filter((b) => !b.isCompleted).length;
    if (activeCount >= 3) {
      showAlert('Max 3 active books', 'You can only have up to 3 active books at a time. Mark one as complete to add another.');
      setShowBookPicker(false);
      return;
    }
    setShowBookPicker(false);
    setBookPickerLoading(true);
    try {
      const existingUserBookIds = mind.books.map((b) => b.userBookId);
      const existingSet = new Set(existingUserBookIds);

      // Step 1: create user_book association for the new system book (bookId != userBookId)
      await setupApi.saveProgress({
        sections: { mind: { bookIds: [book.id] } },
      });

      // Step 2: reload to discover the new book's userBookId
      const midRes = await setupApi.getMind();
      const freshBooks = (midRes.data as MindSetup).books ?? [];

      if (existingUserBookIds.length === 0) {
        setMind((s) => ({
          ...s,
          books: freshBooks.map((b) => ({
            userBookId: b.userBookId, title: b.title, author: b.author,
            isCompleted: b.isCompleted, aiSummary: b.aiSummary ?? null, summaryPdfUrl: b.summaryPdfUrl ?? null,
          })),
        }));
      } else {
        const newBook = freshBooks.find((b) => !existingSet.has(b.userBookId));
        if (newBook) {
          // Step 3: restore all books (existing + new) via putMind which accepts userBookIds
          await setupApi.putMind({
            books: [...existingUserBookIds, newBook.userBookId].map((id) => ({ userBookId: id })),
          });
          const finalRes = await setupApi.getMind();
          const finalBooks = (finalRes.data as MindSetup).books ?? [];
          setMind((s) => ({
            ...s,
            books: finalBooks.map((b) => ({
              userBookId: b.userBookId, title: b.title, author: b.author,
              isCompleted: b.isCompleted, aiSummary: b.aiSummary ?? null,
            })),
          }));
        } else {
          setMind((s) => ({
            ...s,
            books: freshBooks.map((b) => ({
              userBookId: b.userBookId, title: b.title, author: b.author,
              isCompleted: b.isCompleted, aiSummary: b.aiSummary ?? null,
            })),
          }));
        }
      }
      mindEnabledUnsaved.current = false;
    } catch {
      showAlert('Error', 'Failed to add book.');
    } finally {
      setBookPickerLoading(false);
    }
  };

  const handleAddCustomBook = async () => {
    const title = customBookTitle.trim();
    if (!title) { showAlert('Error', 'Title is required.'); return; }
    const activeCount = mind.books.filter((b) => !b.isCompleted).length;
    if (activeCount >= 3) { showAlert('Max 3 active books', 'You can only have up to 3 active books at a time. Mark one as complete to add another.'); return; }
    setAddingCustomBook(true);
    try {
      const { data } = await booksApi.createCustom({
        title,
        author: customBookAuthor.trim() || undefined,
        pages: customBookPages ? Number(customBookPages) : undefined,
      });
      setMind((s) => ({
        ...s,
        books: [...s.books, { userBookId: data.id, title: data.title, author: data.author, isCompleted: false }],
      }));
      setCustomBookTitle('');
      setCustomBookAuthor('');
      setCustomBookPages('');
      setShowCustomBook(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to add book.';
      showAlert('Error', msg);
    } finally {
      setAddingCustomBook(false);
    }
  };

  const removeBook = (userBookId: string) => {
    setMind((s) => ({ ...s, books: s.books.filter((b) => b.userBookId !== userBookId) }));
  };

  const toggleBook = (userBookId: string) => {
    const book = mind.books.find((b) => b.userBookId === userBookId);
    if (!book || book.isCompleted) return;

    showAlert(
      'Mark as Complete',
      `Have you finished "${book.title}"? This can't be changed later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Complete',
          style: 'default',
          onPress: async () => {
            setMind((s) => ({
              ...s,
              books: s.books.map((b) =>
                b.userBookId === userBookId ? { ...b, isCompleted: true } : b
              ),
            }));
            setCompletingBookId(userBookId);
            try {
              await booksApi.markComplete(userBookId);
            } catch {
              setMind((s) => ({
                ...s,
                books: s.books.map((b) =>
                  b.userBookId === userBookId ? { ...b, isCompleted: false } : b
                ),
              }));
              showAlert('Error', 'Failed to mark book complete.');
            } finally {
              setCompletingBookId(null);
            }
          },
        },
      ]
    );
  };

  const downloadSummaryPdfToCache = async (userBookId: string, filename: string) => {
    const token = await AsyncStorage.getItem('accessToken');
    const url = getBookSummaryPdfUrl(userBookId);
    const localUri = `${FileSystem.cacheDirectory}${filename}`;
    const result = await FileSystem.downloadAsync(url, localUri, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return result.uri;
  };

  const openSummaryView = async (userBookId: string, title: string, filename: string) => {
    setViewSummaryBook({ title, summary: '', userBookId, filename, loading: true });
    try {
      const cached = mind.books.find((b) => b.userBookId === userBookId);
      if (cached?.aiSummary) {
        setViewSummaryBook({
          title,
          summary: cached.aiSummary,
          userBookId,
          filename,
          loading: false,
        });
        return;
      }

      const { data } = await booksApi.getSummary(userBookId);
      setMind((s) => ({
        ...s,
        books: s.books.map((b) => b.userBookId === userBookId
          ? {
            ...b,
            aiSummary: data.summary,
            summaryPdfUrl: data.pdfUrl,
            summaryPdfFilename: data.pdfFilename,
          }
          : b),
      }));
      setViewSummaryBook({
        title: data.bookName,
        summary: data.summary,
        userBookId,
        filename: data.pdfFilename,
        loading: false,
      });
    } catch {
      setViewSummaryBook(null);
      showAlert('Error', 'Could not load summary.');
    }
  };

  const downloadSummaryPdf = async (userBookId: string, filename: string) => {
    setDownloadingPdfId(userBookId);
    try {
      const localUri = await downloadSummaryPdfToCache(userBookId, filename);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        showAlert('Saved', 'Summary PDF downloaded.');
      }
    } catch {
      showAlert('Error', 'Could not download summary PDF.');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleGenerateSummary = async (userBookId: string) => {
    setGeneratingSummary(userBookId);
    try {
      const { data } = await booksApi.generateSummary(userBookId);
      const res = data as any;
      if (res.success === false) {
        showAlert('Cannot Generate Summary', res.message || 'Not enough reflections to generate summary.');
        return;
      }
      const pdfUrl = res.pdfUrl ?? getBookSummaryPdfUrl(userBookId);
      const pdfFilename = res.pdfFilename ?? `${userBookId}-summary.pdf`;
      const summary = res.summary ?? '';
      setMind((s) => ({
        ...s,
        books: s.books.map((b) => b.userBookId === userBookId
          ? { ...b, summaryPdfUrl: pdfUrl, summaryPdfFilename: pdfFilename, aiSummary: summary || b.aiSummary }
          : b),
      }));
      const bookTitle = mind.books.find((b) => b.userBookId === userBookId)?.title ?? '';
      await openSummaryView(userBookId, bookTitle, pdfFilename);
    } catch (err: any) {
      showAlert('Error', err?.response?.data?.message || 'Not enough reflections to generate summary.');
    } finally {
      setGeneratingSummary(null);
    }
  };

  const openEditSummary = (userBookId: string, current: string) => {
    setEditSummaryBookId(userBookId);
    setEditSummaryText(current);
  };

  const handleSaveSummary = async () => {
    if (!editSummaryBookId) return;
    setSavingSummary(true);
    try {
      await booksApi.editSummary(editSummaryBookId, editSummaryText);
      setMind((s) => ({
        ...s,
        books: s.books.map((b) => b.userBookId === editSummaryBookId
          ? {
            ...b,
            aiSummary: editSummaryText,
            summaryPdfUrl: b.summaryPdfUrl ?? getBookSummaryPdfUrl(editSummaryBookId),
          }
          : b),
      }));
      setEditSummaryBookId(null);
    } catch {
      showAlert('Error', 'Failed to save summary.');
    } finally {
      setSavingSummary(false);
    }
  };

  // ── Time picker ───────────────────────────────────────────────────────────

  const openTimePicker = (target: Tab) => {
    setTimePickerTarget(target);
    const current =
      target === 'Power' ? power.preferredTime
      : target === 'Craft' ? craft.preferredTime
      : mind.preferredTime;
    setTempDate(parseTime(current));
    setShowTimePicker(true);
  };

  const onTimeChange = (_: any, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (!date) return;
    setTempDate(date);
    if (Platform.OS === 'android') applyTime(timePickerTarget, date);
  };

  const applyTime = (target: Tab, date: Date) => {
    const val = formatTime(date);
    const conflicts: string[] = [];

    if (target === 'Power') {
      if (craft.preferredTime && timeDiffMinutes(val, craft.preferredTime) < 60) {
        conflicts.push(`Craft (${formatDisplay(craft.preferredTime)})`);
      }
      if (mind.preferredTime && timeDiffMinutes(val, mind.preferredTime) < 60) {
        conflicts.push(`Mind (${formatDisplay(mind.preferredTime)})`);
      }
    } else if (target === 'Craft') {
      if (power.preferredTime && timeDiffMinutes(val, power.preferredTime) < 60) {
        conflicts.push(`Power (${formatDisplay(power.preferredTime)})`);
      }
      if (mind.preferredTime && timeDiffMinutes(val, mind.preferredTime) < 60) {
        conflicts.push(`Mind (${formatDisplay(mind.preferredTime)})`);
      }
    } else {
      if (power.preferredTime && timeDiffMinutes(val, power.preferredTime) < 60) {
        conflicts.push(`Power (${formatDisplay(power.preferredTime)})`);
      }
      if (craft.preferredTime && timeDiffMinutes(val, craft.preferredTime) < 60) {
        conflicts.push(`Craft (${formatDisplay(craft.preferredTime)})`);
      }
    }

    if (conflicts.length > 0) {
      showAlert('Time Conflict', `Selected time is within 1 hour of your ${conflicts.join(' and ')} time. Please choose a different time.`);
      setShowTimePicker(false);
      return;
    }

    if (target === 'Power') setPower((s) => ({ ...s, preferredTime: val }));
    else if (target === 'Craft') setCraft((s) => ({ ...s, preferredTime: val }));
    else setMind((s) => ({ ...s, preferredTime: val }));
    setShowTimePicker(false);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const saveAll = async (): Promise<boolean> => {
    setSaving(true);
    try {
      await Promise.all([
        setupApi.putSection('power', {
          preferredTime: power.preferredTime,
          restDays: power.restDays,
          activities: power.activities.map((a) => ({ activityId: a.activityId, isPrimary: a.isPrimary })),
        }),
        setupApi.putSection('craft', {
          preferredTime: craft.preferredTime,
          restDays: craft.restDays,
          activities: craft.activities.map((a) => ({ activityId: a.activityId, isPrimary: a.isPrimary })),
        }),
        setupApi.putMind({
          isActive: mind.isActive,
          preferredTime: mind.preferredTime,
          restDays: mind.restDays,
          books: mind.books.map((b) => ({ userBookId: b.userBookId, isCompleted: b.isCompleted })),
        }),
      ]);
      setBaseline(power, craft, mind);
      mindEnabledUnsaved.current = false;
      return true;
    } catch {
      showAlert('Error', 'Failed to save changes.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  saveAllRef.current = saveAll;

  const save = async () => {
    setSaving(true);
    try {
      if (activeTab === 'Power') {
        await setupApi.putSection('power', {
          preferredTime: power.preferredTime,
          restDays: power.restDays,
          activities: power.activities.map((a) => ({ activityId: a.activityId, isPrimary: a.isPrimary })),
        });
      } else if (activeTab === 'Craft') {
        await setupApi.putSection('craft', {
          preferredTime: craft.preferredTime,
          restDays: craft.restDays,
          activities: craft.activities.map((a) => ({ activityId: a.activityId, isPrimary: a.isPrimary })),
        });
      } else {
        await setupApi.putMind({
          isActive: mind.isActive,
          preferredTime: mind.preferredTime,
          restDays: mind.restDays,
          books: mind.books.map((b) => ({ userBookId: b.userBookId, isCompleted: b.isCompleted })),
        });
      }
      setBaseline(power, craft, mind);
      mindEnabledUnsaved.current = false;
      showAlert('Saved', 'Changes saved successfully.');
    } catch {
      showAlert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderDayChips = (target: Tab, restDays: string[], maxDays?: number) => (
    <View style={s.dayRow}>
      {DAYS.map((day, i) => {
        const key = DAY_KEYS[i];
        const active = restDays.includes(key);
        return (
          <TouchableOpacity
            key={day}
            style={[s.dayChip, active && s.dayChipActive]}
            onPress={() => toggleDay(target, key)}
            activeOpacity={0.7}
          >
            <Text style={[s.dayChipText, active && s.dayChipTextActive]}>
              {day}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderSectionTab = (section: 'power' | 'craft') => {
    const state = section === 'power' ? power : craft;
    const tab: Tab = section === 'power' ? 'Power' : 'Craft';

    const handleAddActivity = () => {
      openActivityPicker(section);
    };

    return (
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Preferred Time */}
        <View style={s.rowGroup}>
          <Text style={s.groupLabel}>Preferred Time</Text>
          <TouchableOpacity style={s.row} onPress={() => openTimePicker(tab)} activeOpacity={0.7}>
            <Text style={s.rowLabel}>Workout time</Text>
            <View style={s.rowRight}>
              <Text style={s.rowValue}>{formatDisplay(state.preferredTime)}</Text>
              <Ionicons name="chevron-forward" size={14} color="#444" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={s.sep} />

        {/* Rest Days */}
        <View style={s.rowGroup}>
          <View style={s.groupLabelRow}>
            <Text style={s.groupLabel}>Rest Days</Text>
            <Text style={s.groupHint}>{state.restDays.length}/{MAX_REST_DAYS[section]}</Text>
          </View>
          <View style={s.chipContainer}>{renderDayChips(tab, state.restDays, MAX_REST_DAYS[section])}</View>
        </View>

        <View style={s.sep} />

        {/* Activities */}
        <View style={s.rowGroup}>
          <View style={s.groupLabelRow}>
            <Text style={s.groupLabel}>Activities</Text>
            <View style={s.rowRight}>
              <TouchableOpacity style={s.addBookBtn} onPress={handleAddActivity} activeOpacity={0.7}>
                <Ionicons name="add" size={14} color="#000" />
                <Text style={s.addBookBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {state.activities.map((a, idx) => (
            <View
              key={a.activityId}
              style={[s.activityRow, idx < state.activities.length - 1 && s.rowBorder]}
            >
              <TouchableOpacity
                onPress={() => removeActivity(section, a.activityId)}
                style={s.removeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="remove-circle" size={18} color="#333" />
              </TouchableOpacity>
              <Text style={[s.rowLabel, { flex: 1, marginLeft: 10 }]}>
                {getActivityDisplayName(section, a.name)}
              </Text>
              <View style={s.rowRight}>
                <Text style={s.rowValueSmall}>Primary</Text>
                <Switch
                  value={a.isPrimary}
                  onValueChange={() => togglePrimary(section, a.activityId)}
                  trackColor={{ false: '#1a1a1a', true: '#fff' }}
                  thumbColor={a.isPrimary ? '#000' : '#555'}
                  ios_backgroundColor="#1a1a1a"
                />
              </View>
            </View>
          ))}

          {state.activities.length === 0 && (
            <Text style={s.emptyText}>No activities added yet.</Text>
          )}

        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderMindTab = () => (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      {/* Reading toggle */}
      <View style={s.rowGroup}>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Enable Mind Section</Text>
            <Text style={s.rowSub}>Track your daily reading progress</Text>
          </View>
          <Switch
            value={mind.isActive}
            onValueChange={(v) => {
              if (v) {
                if (mind.books.length > 0) {
                  setMind((s) => ({ ...s, isActive: true }));
                } else {
                  showAlert(
                    'Enable Mind Section',
                    'To enable Mind, please select a book, preferred reading time, and rest days in the Mind tab.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Set Up',
                        onPress: () => {
                          setMind((s) => ({ ...s, isActive: true }));
                          mindEnabledUnsaved.current = true;
                          setActiveTab('Mind');
                          openBookPicker();
                        },
                      },
                    ]
                  );
                }
              } else {
                setMind((s) => ({ ...s, isActive: false }));
              }
            }}
            trackColor={{ false: '#1a1a1a', true: '#fff' }}
            thumbColor={mind.isActive ? '#000' : '#555'}
            ios_backgroundColor="#1a1a1a"
          />
        </View>
      </View>

      {!mind.isActive && (
        <View style={s.mindDisabledBanner}>
          <Ionicons name="eye-off-outline" size={14} color="#555" />
          <Text style={s.mindDisabledText}>Mind section is disabled. Enable it to edit settings.</Text>
        </View>
      )}

      <View style={s.sep} />

      <View style={[!mind.isActive && s.mindDisabledSection]} pointerEvents={mind.isActive ? 'auto' : 'none'}>

      {/* Preferred Time */}
      <View style={s.rowGroup}>
        <Text style={s.groupLabel}>Preferred Time</Text>
        <TouchableOpacity style={s.row} onPress={() => openTimePicker('Mind')} activeOpacity={0.7}>
          <Text style={s.rowLabel}>Reading time</Text>
          <View style={s.rowRight}>
            <Text style={s.rowValue}>{formatDisplay(mind.preferredTime)}</Text>
            <Ionicons name="chevron-forward" size={14} color="#444" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={s.sep} />

      {/* Rest day — max 1 */}
      <View style={s.rowGroup}>
        <View style={s.groupLabelRow}>
          <Text style={s.groupLabel}>Rest Day</Text>
          <Text style={s.groupHint}>{mind.restDays.length}/1</Text>
        </View>
        <View style={s.chipContainer}>
          <View style={s.dayRow}>
            {DAYS.map((day, i) => {
              const key = DAY_KEYS[i];
              const active = mind.restDays.includes(key);
              return (
                <TouchableOpacity
                  key={day}
                  style={[s.dayChip, active && s.dayChipActive]}
                  onPress={() => setMind((prev) => ({
                    ...prev,
                    restDays: active ? [] : [key],
                  }))}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dayChipText, active && s.dayChipTextActive]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={s.sep} />

      {/* Books */}
      <View style={s.rowGroup}>
        <View style={s.groupLabelRow}>
          <Text style={s.groupLabel}>Books ({mind.books.filter((b) => !b.isCompleted).length}/3 active)</Text>
          {mind.books.filter((b) => !b.isCompleted).length < 3 && (
            <TouchableOpacity style={s.addBookBtn} onPress={openBookPicker} activeOpacity={0.7}>
              <Ionicons name="add" size={14} color="#000" />
              <Text style={s.addBookBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {mind.books.length === 0 ? (
          <Text style={s.emptyText}>No books added yet.</Text>
        ) : (
          mind.books.map((b, idx) => (
            <View key={b.userBookId} style={[s.bookCard, idx < mind.books.length - 1 && s.rowBorder]}>
              {/* Title row */}
              <View style={s.bookCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{b.title}</Text>
                  {b.author ? <Text style={s.bookAuthor}>{b.author}</Text> : null}
                </View>
                <View style={s.rowRight}>
                  {b.isCompleted ? (
                    <Text style={s.rowValueSmall}>Completed ✓</Text>
                  ) : (
                    <>
                      <Text style={s.rowValueSmall}>Mark Complete</Text>
                      {completingBookId === b.userBookId ? (
                        <ActivityIndicator size="small" color="#888" />
                      ) : (
                        <Switch
                          value={false}
                          onValueChange={() => toggleBook(b.userBookId)}
                          trackColor={{ false: '#1a1a1a', true: '#fff' }}
                          thumbColor={'#555'}
                          ios_backgroundColor="#1a1a1a"
                          disabled={completingBookId === b.userBookId}
                        />
                      )}
                    </>
                  )}
                </View>
              </View>

              {/* PDF summary row */}
              {b.summaryPdfUrl ? (
                <View style={s.pdfRow}>
                  <Ionicons name="document-text-outline" size={13} color="#555" />
                  <Text style={s.pdfName} numberOfLines={1}>{b.summaryPdfFilename ?? `${b.title}-summary.pdf`}</Text>
                  <TouchableOpacity
                    onPress={() => openSummaryView(b.userBookId, b.title, b.summaryPdfFilename ?? `${b.userBookId}-summary.pdf`)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="eye-outline" size={15} color="#888" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => downloadSummaryPdf(b.userBookId, b.summaryPdfFilename ?? `${b.userBookId}-summary.pdf`)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    disabled={downloadingPdfId === b.userBookId}
                  >
                    {downloadingPdfId === b.userBookId ? (
                      <ActivityIndicator size="small" color="#888" />
                    ) : (
                      <Ionicons name="download-outline" size={15} color="#888" />
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Action row */}
              <View style={s.bookActions}>
                {b.isCompleted && !b.summaryPdfUrl && (
                  <TouchableOpacity
                    style={s.summaryGenBtn}
                    onPress={() => handleGenerateSummary(b.userBookId)}
                    disabled={generatingSummary === b.userBookId}
                    activeOpacity={0.7}
                  >
                    {generatingSummary === b.userBookId ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Ionicons name="sparkles-outline" size={13} color="#000" />
                        <Text style={s.summaryGenBtnText}>{b.summaryPdfUrl ? 'Regenerate Summary' : 'Generate AI Summary'}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                {!b.isCompleted && !b.summaryPdfUrl && (
                  <TouchableOpacity
                    onPress={() => removeBook(b.userBookId)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#333" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      </View>{/* end mindDisabledSection */}

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  // ── Activity Picker Modal ─────────────────────────────────────────────────

  const renderActivityPicker = () => (
    <Modal
      visible={showActivityPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowActivityPicker(false)}
    >
      <KeyboardAvoidingView
        style={s.pickerOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.pickerSheet}>
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle}>Add Activity</Text>
            <TouchableOpacity onPress={() => setShowActivityPicker(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {pickerLoading ? (
            <View style={s.pickerLoading}>
              <ActivityIndicator color={colors.text} />
            </View>
          ) : (
            <FlatList
              data={pickerOptions}
              keyExtractor={(item) => item.id}
              style={s.pickerList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListFooterComponent={(
                <TouchableOpacity
                  style={s.pickerListRow}
                  onPress={() => setPickerCustomModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={s.pickerListCustomText}>Add custom activity</Text>
                </TouchableOpacity>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.pickerListRow}
                  onPress={() => addActivityFromPicker(item)}
                  activeOpacity={0.7}
                >
                  <Text style={s.pickerListText}>{getActivityDisplayName(activityPickerSection, item.name)}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#444" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal
        animationType="slide"
        transparent
        visible={pickerCustomModalVisible}
        onRequestClose={() => { setPickerCustomModalVisible(false); setPickerCustomName(''); }}
      >
        <View style={s.customModalOverlay}>
          <View style={s.customModalContent}>
            <Text style={s.customModalTitle}>Add custom activity</Text>
            <TextInput
              style={s.customModalInput}
              placeholder={activityPickerSection === 'power' ? 'e.g. Gym...' : 'e.g. Work...'}
              placeholderTextColor={colors.textMuted}
              value={pickerCustomName}
              onChangeText={setPickerCustomName}
              autoFocus
              maxLength={30}
            />
            <View style={s.customModalActions}>
              <TouchableOpacity
                style={s.customModalCancel}
                onPress={() => { setPickerCustomModalVisible(false); setPickerCustomName(''); }}
              >
                <Text style={s.customModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.customModalConfirm}
                onPress={createCustomActivity}
                disabled={pickerCreatingCustom || !pickerCustomName.trim()}
              >
                <Text style={s.customModalConfirmText}>
                  {pickerCreatingCustom ? 'Creating...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );

  // ── Screen ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={s.headerTitle}>Pillars</Text>
      </View>

      <View style={s.tabsRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tabChip, activeTab === tab && s.tabChipActive]}
            onPress={() => handleTabChange(tab)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabChipText, activeTab === tab && s.tabChipTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <>
          {activeTab === 'Power' && renderSectionTab('power')}
          {activeTab === 'Craft' && renderSectionTab('craft')}
          {activeTab === 'Mind' && renderMindTab()}
        </>
      )}

      {!loading && (
        <View style={s.bottomBar}>
          <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.8} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={s.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* iOS time picker modal */}
      {showTimePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={s.timePickerOverlay}>
            <View style={s.timePickerSheet}>
              <View style={s.pickerHeader}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={s.pickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => applyTime(timePickerTarget, tempDate)}>
                  <Text style={s.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="time"
                display="spinner"
                onChange={onTimeChange}
                textColor={colors.text}
              />
            </View>
          </View>
        </Modal>
      )}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          onChange={onTimeChange}
        />
      )}

      {renderActivityPicker()}

      {/* ── Book Picker Modal ── */}
      <Modal visible={showBookPicker} transparent animationType="slide" onRequestClose={() => setShowBookPicker(false)}>
        <KeyboardAvoidingView style={s.pickerOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.pickerSheet}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Add Book</Text>
              <TouchableOpacity onPress={() => setShowBookPicker(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={16} color="#444" />
              <TextInput
                style={s.searchInput}
                placeholder="Search books…"
                placeholderTextColor="#444"
                value={bookPickerSearch}
                onChangeText={setBookPickerSearch}
                autoCapitalize="words"
              />
              {bookPickerSearch.length > 0 && (
                <TouchableOpacity onPress={() => setBookPickerSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#444" />
                </TouchableOpacity>
              )}
            </View>
            {/* Add custom button */}
            <TouchableOpacity
              style={s.createCustomRow}
              onPress={() => { setShowBookPicker(false); setShowCustomBook(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.text} />
              <Text style={s.createCustomText}>Add custom book…</Text>
            </TouchableOpacity>
            {bookPickerLoading ? (
              <View style={s.pickerLoading}><ActivityIndicator color={colors.text} /></View>
            ) : (
              <FlatList
                data={bookPickerOptions.filter((b) =>
                  b.title.toLowerCase().includes(bookPickerSearch.toLowerCase()) ||
                  (b.author ?? '').toLowerCase().includes(bookPickerSearch.toLowerCase())
                )}
                keyExtractor={(b) => b.id}
                style={s.pickerList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[s.pickerRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 2 }]}
                    onPress={() => addSystemBook(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.pickerRowText}>{item.title}</Text>
                    {item.author ? <Text style={s.bookAuthor}>{item.author}</Text> : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={s.emptyText}>No matching books.</Text>}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Custom Book Modal ── */}
      <Modal visible={showCustomBook} transparent animationType="slide" onRequestClose={() => setShowCustomBook(false)}>
        <KeyboardAvoidingView style={s.pickerOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.pickerSheet, { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }]}>
            <View style={[s.pickerHeader, { paddingHorizontal: 0 }]}>
              <Text style={s.pickerTitle}>Custom Book</Text>
              <TouchableOpacity onPress={() => setShowCustomBook(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.customInput}
              placeholder="Title *"
              placeholderTextColor="#444"
              value={customBookTitle}
              onChangeText={setCustomBookTitle}
            />
            <TextInput
              style={s.customInput}
              placeholder="Author"
              placeholderTextColor="#444"
              value={customBookAuthor}
              onChangeText={setCustomBookAuthor}
            />
            <TextInput
              style={s.customInput}
              placeholder="Pages"
              placeholderTextColor="#444"
              value={customBookPages}
              onChangeText={setCustomBookPages}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={[s.saveBtn, { marginTop: 12 }]}
              onPress={handleAddCustomBook}
              disabled={addingCustomBook}
              activeOpacity={0.8}
            >
              {addingCustomBook
                ? <ActivityIndicator color="#000" />
                : <Text style={s.saveBtnText}>Add Book</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Summary View Modal ── */}
      <Modal visible={!!viewSummaryBook} animationType="slide" onRequestClose={() => setViewSummaryBook(null)}>
        <SafeAreaView style={s.pdfModalContainer}>
          <View style={s.pdfModalHeader}>
            <Text style={s.pdfModalTitle} numberOfLines={1}>
              {viewSummaryBook?.title} — Reading Summary
            </Text>
            <TouchableOpacity onPress={() => setViewSummaryBook(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          {viewSummaryBook?.loading ? (
            <View style={s.pdfLoading}>
              <ActivityIndicator size="large" color={colors.text} />
            </View>
          ) : (
            <>
              <ScrollView
                style={s.summaryViewScroll}
                contentContainerStyle={s.summaryViewContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={s.summaryFullText}>
                  {viewSummaryBook?.summary?.trim()
                    ? viewSummaryBook.summary
                    : 'Summary text is not available. You can still download the PDF below.'}
                </Text>
              </ScrollView>
              {viewSummaryBook?.userBookId ? (
                <TouchableOpacity
                  style={s.summaryDownloadBtn}
                  onPress={() => downloadSummaryPdf(viewSummaryBook.userBookId, viewSummaryBook.filename)}
                  disabled={downloadingPdfId === viewSummaryBook.userBookId}
                  activeOpacity={0.8}
                >
                  {downloadingPdfId === viewSummaryBook.userBookId ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={16} color="#000" />
                      <Text style={s.summaryDownloadBtnText}>Download PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Enable Mind Modal ── */}
      <Modal visible={showEnableMindModal} transparent animationType="slide" onRequestClose={discardEnableMind}>
        <KeyboardAvoidingView style={s.pickerOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.pickerSheet, { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }]}>
            <View style={[s.pickerHeader, { paddingHorizontal: 0 }]}>
              <Text style={s.pickerTitle}>Enable Mind Section</Text>
              <TouchableOpacity onPress={discardEnableMind}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Book selection */}
            <Text style={[s.groupLabel, { marginBottom: 8 }]}>Select a Book <Text style={{ color: colors.error }}>*</Text></Text>
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={16} color="#444" />
              <TextInput
                style={s.searchInput}
                placeholder="Search books…"
                placeholderTextColor="#444"
                value={enableMindBookSearch}
                onChangeText={setEnableMindBookSearch}
                autoCapitalize="words"
              />
            </View>
            {enableMindBook && (
              <View style={[s.pickerRow, { backgroundColor: '#111', borderRadius: 8, marginBottom: 4 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pickerRowText}>{enableMindBook.title}</Text>
                  {enableMindBook.author ? <Text style={s.bookAuthor}>{enableMindBook.author}</Text> : null}
                </View>
                <Ionicons name="checkmark-circle" size={18} color={colors.text} />
              </View>
            )}
            {enableMindBookLoading ? (
              <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.text} />
              </View>
            ) : (
              <FlatList
                data={enableMindBookOptions.filter((b) =>
                  b.title.toLowerCase().includes(enableMindBookSearch.toLowerCase()) ||
                  (b.author ?? '').toLowerCase().includes(enableMindBookSearch.toLowerCase())
                )}
                keyExtractor={(b) => b.id}
                style={{ maxHeight: 160, marginBottom: 8 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[s.pickerRow, enableMindBook?.id === item.id && { backgroundColor: '#111' }]}
                    onPress={() => setEnableMindBook({ id: item.id, title: item.title, author: item.author })}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.pickerRowText}>{item.title}</Text>
                      {item.author ? <Text style={s.bookAuthor}>{item.author}</Text> : null}
                    </View>
                    {enableMindBook?.id === item.id && <Ionicons name="checkmark-circle" size={18} color={colors.text} />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={s.emptyText}>No matching books.</Text>}
              />
            )}

            {/* Preferred time */}
            <Text style={[s.groupLabel, { marginTop: 8, marginBottom: 8 }]}>Preferred Reading Time</Text>
            <TouchableOpacity
              style={s.row}
              onPress={() => setEnableMindTimePickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={s.rowLabel}>Reading time</Text>
              <View style={s.rowRight}>
                <Text style={s.rowValue}>{enableMindTime ? formatDisplay(enableMindTime) : 'Not set'}</Text>
                <Ionicons name="chevron-forward" size={14} color="#444" />
              </View>
            </TouchableOpacity>
            {enableMindTimePickerVisible && Platform.OS === 'ios' && (
              <DateTimePicker
                value={enableMindTime ? parseTime(enableMindTime) : new Date()}
                mode="time"
                display="spinner"
                onChange={(_, date) => { if (date) setEnableMindTime(formatTime(date)); }}
                textColor={colors.text}
              />
            )}
            {enableMindTimePickerVisible && Platform.OS === 'android' && (
              <DateTimePicker
                value={enableMindTime ? parseTime(enableMindTime) : new Date()}
                mode="time"
                display="default"
                onChange={(_, date) => { setEnableMindTimePickerVisible(false); if (date) setEnableMindTime(formatTime(date)); }}
              />
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[s.saveBtn, { flex: 1, backgroundColor: '#1a1a1a' }]}
                onPress={discardEnableMind}
                activeOpacity={0.8}
              >
                <Text style={[s.saveBtnText, { color: '#aaa' }]}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { flex: 1 }]}
                onPress={confirmEnableMind}
                disabled={enableMindSaving}
                activeOpacity={0.8}
              >
                {enableMindSaving
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.saveBtnText}>Enable Mind</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Summary Modal ── */}
      <Modal visible={!!editSummaryBookId} transparent animationType="slide" onRequestClose={() => setEditSummaryBookId(null)}>
        <KeyboardAvoidingView style={s.pickerOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.pickerSheet, { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }]}>
            <View style={[s.pickerHeader, { paddingHorizontal: 0 }]}>
              <Text style={s.pickerTitle}>Edit Summary</Text>
              <TouchableOpacity onPress={() => setEditSummaryBookId(null)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[s.customInput, { height: 160, textAlignVertical: 'top', paddingTop: 12 }]}
              value={editSummaryText}
              onChangeText={setEditSummaryText}
              multiline
              placeholder="Write summary…"
              placeholderTextColor="#444"
            />
            <TouchableOpacity
              style={[s.saveBtn, { marginTop: 12 }]}
              onPress={handleSaveSummary}
              disabled={savingSummary}
              activeOpacity={0.8}
            >
              {savingSummary
                ? <ActivityIndicator color="#000" />
                : <Text style={s.saveBtnText}>Save Summary</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { width: 36 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabChip: {
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  tabChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  tabChipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  tabChipTextActive: { color: '#000' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  sep: { height: 1, backgroundColor: '#1E1E1E', marginVertical: spacing.md },

  groupLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  groupLabel: { fontSize: 11, fontWeight: '600', color: '#444', textTransform: 'uppercase', letterSpacing: 1.2 },
  groupHint: { fontSize: 11, color: '#333' },

  rowGroup: {},
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, justifyContent: 'space-between' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  rowLabel: { fontSize: 15, color: colors.text },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { fontSize: 14, color: '#555' },
  rowValueSmall: { fontSize: 12, color: '#444', marginRight: 4 },

  chipContainer: { paddingVertical: 4 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#222' },
  dayChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  dayChipDisabled: { borderColor: '#111', opacity: 0.4 },
  dayChipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  dayChipTextActive: { color: '#000' },
  dayChipTextDisabled: { color: '#333' },

  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  removeBtn: { padding: 2 },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    marginTop: 2,
  },
  addRowText: { fontSize: 14, color: '#555' },

  rowSub: { fontSize: 12, color: '#444', marginTop: 2 },

  mindDisabledSection: { opacity: 0.3 },
  mindDisabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: '#0d0d0d',
  },
  mindDisabledText: { fontSize: 12, color: '#555' },
  disabledOverlay: { opacity: 0.2 },
  bookInfo: { flex: 1 },
  bookAuthor: { fontSize: 12, color: '#555', marginTop: 2 },
  emptyText: { fontSize: 14, color: '#444', paddingVertical: spacing.md },

  addBookBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.text, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
  },
  addBookBtnText: { color: '#000', fontSize: 12, fontWeight: '600' },

  bookCard: { paddingVertical: 14 },
  bookCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },

  summaryBox: { marginTop: 8, backgroundColor: '#0a0a0a', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#1a1a1a' },
  summaryText: { color: '#888', fontSize: 12, lineHeight: 18 },
  summaryActions: { flexDirection: 'row', gap: 14, marginTop: 6 },
  summaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryBtnText: { color: '#888', fontSize: 12 },

  summaryGenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.text, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12,
  },
  summaryGenBtnText: { color: '#000', fontSize: 12, fontWeight: '600' },

  customInput: {
    backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 14, marginTop: 10,
  },

  summaryOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  summarySheet: { width: '100%', backgroundColor: '#111', borderRadius: 16, padding: spacing.lg, borderWidth: 1, borderColor: '#222' },
  summaryFullText: { color: '#ccc', fontSize: 14, lineHeight: 22 },

  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: 28,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: { backgroundColor: colors.text, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },

  // Time picker (iOS)
  timePickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  timePickerSheet: { backgroundColor: '#111', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  pickerCancel: { fontSize: 15, color: '#555' },
  pickerDone: { fontSize: 15, fontWeight: '600', color: colors.text },

  // Activity picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#0d0d0d',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  pickerLoading: { paddingVertical: 40, alignItems: 'center' },
  pickerGridScroll: { maxHeight: '70%' },
  pickerGridContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  pickerList: { maxHeight: '70%' },
  pickerListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: spacing.sm,
  },
  pickerListText: { flex: 1, fontSize: 15, color: colors.text },
  pickerListCustomText: { flex: 1, fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  customModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  customModalContent: {
    backgroundColor: colors.cardElevated,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  customModalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  customModalInput: {
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  customModalActions: { flexDirection: 'row', gap: spacing.md },
  customModalCancel: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customModalCancelText: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  customModalConfirm: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customModalConfirmText: { fontSize: 15, color: colors.background, fontWeight: '700' },
  pickerList: { paddingHorizontal: spacing.lg },
  createCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  createCustomText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  pickerRowText: { fontSize: 15, color: colors.text },

  pdfRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 6, paddingTop: 6,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
  },
  pdfName: { flex: 1, fontSize: 11, color: '#555' },
  pdfModalContainer: { flex: 1, backgroundColor: colors.background },
  pdfModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  pdfModalTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
  pdfLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  summaryViewScroll: { flex: 1 },
  summaryViewContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  summaryDownloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: spacing.lg, marginBottom: spacing.lg, paddingVertical: 14,
    backgroundColor: colors.text, borderRadius: radius.md,
  },
  summaryDownloadBtnText: { fontSize: 14, fontWeight: '600', color: '#000' },
});

export default PillarsScreen;
