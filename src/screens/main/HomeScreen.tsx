import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Animated, Modal, Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions, useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { colors, spacing, typography } from '../../theme';
import DailyLogModal from '../../components/modals/DailyLogModal';
import BicepIcon from '../../../assets/bicep.svg';
import BrainIcon from '../../../assets/brain.svg';
import CraftIcon from '../../../assets/craft.svg';
import PurityIcon from '../../../assets/purity.svg';
import GrowIcon from '../../../assets/grow.svg';
import { activityLogsApi } from '../../api/activityLogs';
import { activitiesApi } from '../../api/activities';
import { companionApi } from '../../api';
import type { ActivityLogEntry, CompanionMessage } from '../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

const SECTION_COLORS: Record<string, string> = {
  power: colors.power,
  craft: colors.craft,
  mind: colors.mind,
  purity: colors.purity,
};

const SECTION_ICONS = {
  power: BicepIcon,
  mind: BrainIcon,
  craft: CraftIcon,
  purity: PurityIcon,
};

const SECTION_LABELS: Record<string, string> = {
  power: 'Power', craft: 'Craft', mind: 'Mind', purity: 'Purity',
};

const getCompanionColor = (name: string): string => {
  const colorMap: { [key: string]: string } = {
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

const getAvatarBorderColor = (slug: string): string => {
  const colorMap: { [key: string]: string } = {
    'riven': '#666666',
    'renji': '#8B0000',
    'verin': '#1E90FF',
    'aelius': '#DAA520',
    'kael': '#B8860B',
  };
  return colorMap[slug] || '#666666';
};

const getAvatarHasShadow = (slug: string): boolean => {
  return slug === 'riven';
};

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile, fetchProfile, isLoadingProfile } = useUser();
  const [last7DaysData, setLast7DaysData] = useState<any>(null);
  const [isLoadingLast7Days, setIsLoadingLast7Days] = useState(false);
  const [isStreakCollapsed, setIsStreakCollapsed] = useState(false);
  const [hasLogs, setHasLogs] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  const [recordsData, setRecordsData] = useState<Record<string, ActivityLogEntry[]>>({});
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState({ days: 7, sections: ['power', 'craft', 'purity', 'mind'] as string[], fromDate: null as Date | null, toDate: null as Date | null });
  const [pendingFilter, setPendingFilter] = useState({ days: 7, sections: ['power', 'craft', 'purity', 'mind'] as string[], fromDate: null as Date | null, toDate: null as Date | null });
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const isFilterActive = activeFilter.days !== 7 || activeFilter.sections.length < 4 || !!(activeFilter.fromDate && activeFilter.toDate);

  // Companion notification
  const [notifMessage, setNotifMessage] = useState<CompanionMessage | null>(null);
  const notifSlide = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const loadRecords = useCallback(async (days: number = 7, sections: string[] = ['power', 'craft', 'purity', 'mind'], fromDate?: Date | null, toDate?: Date | null) => {
    setIsLoadingRecords(true);
    try {
      const dates: string[] = [];
      if (fromDate && toDate) {
        const cur = new Date(fromDate);
        cur.setHours(0, 0, 0, 0);
        const end = new Date(toDate);
        end.setHours(0, 0, 0, 0);
        while (cur <= end) {
          dates.push(cur.toISOString().split('T')[0]);
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        for (let i = 0; i < days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split('T')[0]);
        }
      }
      const results = await Promise.allSettled(dates.map(date => activitiesApi.getLog(date)));
      const records: Record<string, ActivityLogEntry[]> = {};
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.data.length > 0) {
          const filtered = (result.value.data as ActivityLogEntry[]).filter(log => sections.includes(log.section));
          if (filtered.length > 0) records[dates[idx]] = filtered;
        }
      });
      setRecordsData(records);
    } catch {}
    setIsLoadingRecords(false);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsLoadingLast7Days(true);
      const response = await activityLogsApi.getLast7Days();
      setLast7DaysData(response.data);

      // Check if user has any logs
      const hasAnyLogs = (['power', 'craft', 'mind', 'purity'] as const).some((section) => {
        const entries = response.data?.[section];
        if (Array.isArray(entries)) {
          return entries.some((entry: any) => entry.didUserDo === true || entry.didUserRelapse === true);
        }
        return false;
      });
      setHasLogs(hasAnyLogs);
    } catch (error) {
      console.log('Error fetching last 7 days:', error);
    } finally {
      setIsLoadingLast7Days(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchProfile();
      await Promise.all([loadData(), loadRecords(7)]);
      setLoading(false);
    };
    init();
  }, [loadData]);

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: isStreakCollapsed ? 0 : 120,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isStreakCollapsed]);

  useFocusEffect(useCallback(() => {
    companionApi.getUnreadMessages().then(({ data }) => {
      if (data.length > 0 && !notifMessage) {
        setNotifMessage(data[0]);
        notifSlide.setValue(-SCREEN_WIDTH);
        Animated.spring(notifSlide, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 10,
        }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }).catch(() => {});
  }, []));

  const dismissNotif = () => {
    Animated.timing(notifSlide, {
      toValue: -SCREEN_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setNotifMessage(null));
  };

  const handleMarkRead = async () => {
    if (!notifMessage) return;
    try {
      await companionApi.markRead(notifMessage.id);
    } catch {}
    dismissNotif();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), loadData(), loadRecords(activeFilter.days, activeFilter.sections, activeFilter.fromDate, activeFilter.toDate)]);
    setRefreshing(false);
  };

  const formatRecordDate = (dateStr: string): string => {
    const today = new Date().toISOString().split('T')[0];
    const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Today';
    if (dateStr === yest) return 'Yesterday';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getLast7DaysDates = () => {
    const days = [];
    const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toISOString().split('T')[0],
        weekday: weekdays[date.getDay()],
      });
    }
    return days;
  };

  const streaks = profile?.stats?.currentStreaks;
  const totalPoints = profile?.stats?.totalPoints || 0;
  const username = profile?.username || user?.email?.split('@')[0] || 'Champion';
  const selectedAvatar = profile?.avatars?.find(a => a.isSelected);
  const profileImageUrl = selectedAvatar?.profileImageUrl;
  const avatarSlug = selectedAvatar?.slug || 'riven';
  const avatarBorderColor = getAvatarBorderColor(avatarSlug);
  const avatarHasShadow = getAvatarHasShadow(avatarSlug);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
      >
        {/* Top Row */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.companionBtn} onPress={() => (navigation as any).navigate('CompanionMessages')}>
            {profile?.companions?.[0]?.imageUrl ? (
              <View style={[
                styles.companionAvatarWrapper,
                {
                  shadowColor: getCompanionColor(profile.companions[0].name),
                  borderColor: getCompanionColor(profile.companions[0].name),
                },
              ]}>
                <Image source={{ uri: profile.companions[0].imageUrl }} style={styles.companionAvatar} resizeMode="cover" />
              </View>
            ) : (
              <Ionicons name="person-circle" size={42} color={colors.text} />
            )}
          </TouchableOpacity>

          {/* Speech bubble inline */}
          {notifMessage ? (
            <Animated.View style={[styles.notifBubble, { transform: [{ translateX: notifSlide }] }]}>
              <View style={styles.notifTail} />
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle} numberOfLines={1}>{notifMessage.title}</Text>
                <Text style={styles.notifMsg} numberOfLines={1}>{notifMessage.message}</Text>
              </View>
              <TouchableOpacity onPress={dismissNotif} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={13} color="#555" />
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <TouchableOpacity
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={styles.iconBtn}
          >
            <Ionicons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Profile */}
        <View style={styles.profileRow}>
          <View style={[
            styles.profilePicContainer,
            {
              borderColor: '#FFFFFF',
              shadowColor: '#FFFFFF',
              shadowOpacity: 0.5,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 0 },
              elevation: 16,
            },
          ]}>
            {profileImageUrl ? (
              <Image source={{ uri: profileImageUrl }} style={styles.profilePic} resizeMode="cover" />
            ) : (
              <View style={styles.profilePicPlaceholder}>
                <Ionicons
                  name="person"
                  size={24}
                  color={colors.textMuted}
                />
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>
                {username}
              </Text>
              <TouchableOpacity style={styles.editIconWrapper} onPress={() => navigation.navigate('Profile' as never)}>
                <Ionicons
                  name="eye-outline"
                  size={18}
                  color="#888888"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.pointsRow}>
              <Ionicons
                name="star"
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.profilePoints}>
                {totalPoints.toLocaleString()} points
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.separator} />

        {/* 7 Day Streak */}
        <View style={styles.streakContainer}>

          <View style={[styles.streakHeader, isStreakCollapsed && { marginBottom: 0 }]}>
            <Text style={styles.streakTitle}>
              7 Day Streak
            </Text>

            <TouchableOpacity onPress={() => setIsStreakCollapsed(!isStreakCollapsed)}>
              <Ionicons
                name={isStreakCollapsed ? "chevron-down" : "chevron-up"}
                size={20}
                color="#888"
              />
            </TouchableOpacity>
          </View>

          <Animated.View style={{ height: animatedHeight, overflow: 'hidden' }}>
            <View style={styles.tableHeader}>
              <View style={styles.headerSpacer} />

              {getLast7DaysDates().map((day, i) => (
                <Text key={i} style={styles.weekdayLabel}>
                  {day.weekday}
                </Text>
              ))}
            </View>

            {(['power','craft','mind','purity'] as const).map(
              (section) => (
                <View
                  key={section}
                  style={styles.streakRow}
                >
                  <View style={styles.sectionIconWrapper}>
                    {React.createElement(
                      SECTION_ICONS[section],
                      {
                        width: section === 'power' ? 18 : 16,
                        height: section === 'power' ? 18 : 16,
                        fill: "#FFFFFF",
                        stroke: "#FFFFFF",
                        color: "#FFFFFF",
                        strokeWidth: section === 'power' ? 2.2 : 1.4,
                        opacity: 1,
                      }
                    )}
                  </View>

                  <View style={styles.dotsRow}>
                    {getLast7DaysDates().map((day,i)=>{
                      const sectionData = last7DaysData?.[section];
                      const entry = Array.isArray(sectionData)
                        ? sectionData.find((entry:any) => entry.date === day.date)
                        : undefined;
                      const isPurity = section === 'purity';
                      const value = isPurity ? entry?.didUserRelapse : entry?.didUserDo;

                      let dotStyle: any = styles.dot;

                      if (value === true) {
                        dotStyle = [
                          styles.dot,
                          {
                            backgroundColor: colors.success,
                            borderColor: colors.success,
                          }
                        ];
                      } else if (value === false) {
                        dotStyle = [
                          styles.dot,
                          {
                            backgroundColor: '#FF4444',
                            borderColor: '#FF4444',
                          }
                        ];
                      }

                      return (
                        <View
                          key={i}
                          style={styles.dotContainer}
                        >
                          <View style={dotStyle} />
                        </View>
                      )
                    })}
                  </View>
                </View>
              )
            )}
          </Animated.View>
        </View>

        <View style={[styles.separator, { marginTop: spacing.sm, marginBottom: spacing.sm }]} />

        {/* Records */}
        <View style={styles.recordsContainer}>
          <View style={styles.recordsHeader}>
            <Text style={styles.recordsTitle}>Records</Text>
            <TouchableOpacity style={styles.filterBtn} onPress={() => { setPendingFilter(activeFilter); setShowFilterModal(true); }} activeOpacity={0.7}>
              <Ionicons name="options-outline" size={20} color={colors.text} />
              {isFilterActive && <View style={styles.filterDot} />}
            </TouchableOpacity>
          </View>

          {isLoadingRecords ? (
            <ActivityIndicator color={colors.text} style={{ marginTop: 16 }} />
          ) : Object.keys(recordsData).length === 0 ? (
            <Text style={styles.noRecordsText}>No records in this period</Text>
          ) : (
            Object.entries(recordsData)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, logs]) => {
                const sectionMap = new Map<string, ActivityLogEntry>();
                for (const log of logs) {
                  if (!sectionMap.has(log.section) || log.didUserDo) sectionMap.set(log.section, log);
                }
                return (
                  <View key={date} style={styles.recordsDateGroup}>
                    <Text style={styles.recordsDateLabel}>{formatRecordDate(date)}</Text>
                    <View style={styles.recordsList}>
                      {(['power', 'craft', 'mind', 'purity'] as const)
                        .filter(sec => sectionMap.has(sec))
                        .map(sec => {
                          const log = sectionMap.get(sec)!;
                          const Icon = SECTION_ICONS[sec];
                          const completed = sec === 'purity' ? (log.relapseCount ?? 0) === 0 : !!log.didUserDo;
                          const hoursStr = log.hours && log.hours > 0
                            ? `${Math.floor(log.hours)}h${Math.round((log.hours % 1) * 60) > 0 ? ` ${Math.round((log.hours % 1) * 60)}m` : ''}`
                            : null;
                          const isPurity = sec === 'purity';
                          const statusText = isPurity
                            ? ((log.relapseCount ?? 0) === 0 ? 'Clean' : `${log.relapseCount} relapse${(log.relapseCount ?? 0) !== 1 ? 's' : ''}`)
                            : (completed ? 'Completed' : 'Missed');
                          return (
                            <TouchableOpacity
                              key={sec}
                              style={styles.recordRow}
                              onPress={() => (navigation as any).navigate('RecordDetail', { date, logs, section: sec })}
                              activeOpacity={0.7}
                            >
                              <View style={styles.recordRowIcon}>
                                <Icon width={18} height={18} fill="#fff" stroke="#fff" color="#fff" />
                              </View>
                              <View style={styles.recordRowBody}>
                                <Text style={styles.recordRowSection}>{SECTION_LABELS[sec]}</Text>
                                <Text style={styles.recordRowStatus} numberOfLines={1}>{statusText}</Text>
                              </View>
                              {hoursStr && <Text style={styles.recordRowHours}>{hoursStr}</Text>}
                              <Ionicons name="eye-outline" size={16} color="#555" style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  </View>
                );
              })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <View style={styles.fabContainer}>
        {!hasLogs && showTooltip && (
          <View style={styles.fabTooltip}>
            <TouchableOpacity
              style={styles.tooltipCloseButton}
              onPress={() => setShowTooltip(false)}
            >
              <Ionicons name="close" size={14} color={colors.background} />
            </TouchableOpacity>
            <Text style={styles.fabTooltipTitle}>Start your journey</Text>
            <Text style={styles.fabTooltipText}>
              Tap to log your first activity
            </Text>
            <View style={styles.fabTooltipArrow} />
          </View>
        )}
        <TouchableOpacity style={styles.fab} onPress={() => setShowLogModal(true)} activeOpacity={0.85}>
          <GrowIcon width={18} height={18} fill={colors.background} />
        </TouchableOpacity>
      </View>

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setShowFilterModal(false)}>
          <View style={styles.filterSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Filter Records</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionLabel}>Sections</Text>
            <View style={styles.filterChipsRow}>
              {(['power', 'craft', 'purity', 'mind'] as const).map(sec => {
                const on = pendingFilter.sections.includes(sec);
                return (
                  <TouchableOpacity
                    key={sec}
                    style={[styles.filterChip, on && styles.filterChipActive]}
                    onPress={() => setPendingFilter(prev => ({
                      ...prev,
                      sections: on ? prev.sections.filter(s => s !== sec) : [...prev.sections, sec],
                    }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipText, on && styles.filterChipTextActive]}>{sec}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterSectionLabel}>Quick Range</Text>
            <View style={styles.filterChipsRow}>
              {([7, 14, 30] as const).map(days => {
                const on = !pendingFilter.fromDate && pendingFilter.days === days;
                return (
                  <TouchableOpacity
                    key={days}
                    style={[styles.filterChip, on && styles.filterChipActive]}
                    onPress={() => setPendingFilter(prev => ({ ...prev, days, fromDate: null, toDate: null }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipText, on && styles.filterChipTextActive]}>{days} days</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterSectionLabel}>Custom Date Range</Text>
            <View style={styles.filterDateRow}>
              <TouchableOpacity
                style={[styles.filterDateBtn, !!pendingFilter.fromDate && styles.filterDateBtnActive]}
                onPress={() => setShowFromPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={14} color={pendingFilter.fromDate ? '#fff' : '#666'} />
                <Text style={[styles.filterDateBtnText, !!pendingFilter.fromDate && styles.filterDateBtnTextActive]}>
                  {pendingFilter.fromDate
                    ? pendingFilter.fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'From'}
                </Text>
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={14} color="#444" />
              <TouchableOpacity
                style={[styles.filterDateBtn, !!pendingFilter.toDate && styles.filterDateBtnActive]}
                onPress={() => setShowToPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={14} color={pendingFilter.toDate ? '#fff' : '#666'} />
                <Text style={[styles.filterDateBtnText, !!pendingFilter.toDate && styles.filterDateBtnTextActive]}>
                  {pendingFilter.toDate
                    ? pendingFilter.toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'To'}
                </Text>
              </TouchableOpacity>
              {(pendingFilter.fromDate || pendingFilter.toDate) && (
                <TouchableOpacity
                  onPress={() => setPendingFilter(prev => ({ ...prev, fromDate: null, toDate: null, days: 7 }))}
                  style={styles.filterDateClear}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={18} color="#555" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity
                style={styles.filterClearBtn}
                onPress={() => {
                  setPendingFilter({ days: 7, sections: ['power', 'craft', 'purity', 'mind'], fromDate: null, toDate: null });
                  setActiveFilter({ days: 7, sections: ['power', 'craft', 'purity', 'mind'], fromDate: null, toDate: null });
                  loadRecords(7, ['power', 'craft', 'purity', 'mind'], null, null);
                  setShowFilterModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.filterClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => {
                  const f = pendingFilter.sections.length === 0
                    ? { ...pendingFilter, sections: ['power', 'craft', 'purity', 'mind'] }
                    : pendingFilter;
                  setActiveFilter(f);
                  loadRecords(f.days, f.sections, f.fromDate, f.toDate);
                  setShowFilterModal(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.filterApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {showFromPicker && (
        <DateTimePicker
          value={pendingFilter.fromDate || new Date()}
          mode="date"
          display="default"
          maximumDate={pendingFilter.toDate || new Date()}
          onChange={(event, date) => {
            setShowFromPicker(false);
            if (event.type === 'set' && date) {
              setPendingFilter(prev => ({ ...prev, fromDate: date, days: 0 }));
            }
          }}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={pendingFilter.toDate || new Date()}
          mode="date"
          display="default"
          minimumDate={pendingFilter.fromDate || undefined}
          maximumDate={new Date()}
          onChange={(event, date) => {
            setShowToPicker(false);
            if (event.type === 'set' && date) {
              setPendingFilter(prev => ({ ...prev, toDate: date, days: 0 }));
            }
          }}
        />
      )}


      {/* Daily Log Modal */}
      <DailyLogModal
        visible={showLogModal}
        onClose={() => setShowLogModal(false)}
        onComplete={() => { setShowLogModal(false); onRefresh(); }}
        onNavigateToMind={() => navigation.navigate('Pillars' as never)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar:{
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center',
    marginTop:-16,
    marginBottom:8,
  },
  iconBtn:{
    width:44,
    height:44,
    borderRadius:22,
    backgroundColor:'#111',
    alignItems:'center',
    justifyContent:'center',
  },
  companionBtn:{
    width:44,
    height:44,
    borderRadius:22,
    zIndex: 2,
  },
  companionAvatarWrapper:{
    width:44,
    height:44,
    borderRadius:22,
    borderWidth:0.5,
    overflow:'hidden',
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  companionAvatar:{
    width:44,
    height:44,
    borderRadius:22,
  },
  profileRow:{
    flexDirection:'row',
    alignItems:'center',
    marginBottom:0,
  },
  profilePicContainer:{
    width:72,
    height:72,
    borderRadius:36,
    borderWidth:0.5,
    marginRight:16,
    overflow:'hidden',
    justifyContent:'center',
    alignItems:'center',
  },
  profilePic:{
    width:'100%',
    height:'100%',
    borderRadius:36,
  },
  profilePicPlaceholder:{
    width:'100%',
    height:'100%',
    borderRadius:36,
    backgroundColor:'#171717',
    justifyContent:'center',
    alignItems:'center',
  },
  profileInfo:{
    flex:1,
    justifyContent:'center',
  },
  nameRow:{
    flexDirection:'row',
    alignItems:'center',
  },
  editIconWrapper:{
    justifyContent:'center',
    alignItems:'center',
    marginTop:-2,
    marginLeft:10,
  },
  profileName:{
    fontSize:18,
    fontWeight:'600',
    color:'white',
    marginBottom:0,
    lineHeight:22,
  },
  pointsRow:{
    flexDirection:'row',
    alignItems:'center',
  },
  profilePoints:{
    color:'#AAA',
    marginLeft:8,
    fontSize:15,
  },
  separator:{
    height:1,
    backgroundColor:'#1E1E1E',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  streakContainer:{
    padding: 8,
  },
  streakHeader:{
    flexDirection:'row',
    justifyContent:'space-between',
    marginBottom:4,
  },
  streakTitle:{
    color:'white',
    fontSize:18,
    fontWeight:'700',
  },
  hideText:{
    color:'#888',
    fontSize:15,
  },
  streakRow:{
    flexDirection:'row',
    alignItems:'center',
    marginBottom:3,
  },
  sectionIconWrapper:{
    width:24,
    height:24,
    justifyContent:'center',
    alignItems:'center',
    marginRight:16,
  },
  sectionIcon:{
    width:20,
    height:20,
  },
  tableHeader:{
    flexDirection:'row',
    alignItems:'center',
    marginBottom:6,
  },
  headerSpacer:{
    width:44,
  },
  weekdayLabel:{
    flex:1,
    textAlign:'center',
    color:'#666',
    fontSize:10,
    fontWeight:'600',
  },
  dotsRow:{
    flex:1,
    flexDirection:'row',
  },
  dotContainer:{
    flex:1,
    alignItems:'center',
  },
  dot:{
    width:8,
    height:8,
    borderRadius:4,
    borderWidth:1,
    borderColor:'#333',
  },
  scroll: { flex: 1 },

  // Records
  recordsContainer: { gap: 10 },
  recordsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordsTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  filterBtn: { position: 'relative', padding: 4 },
  filterDot: {
    position: 'absolute', top: 2, right: 2,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: colors.success,
    borderWidth: 1.5, borderColor: colors.background,
  },
  noRecordsText: { color: '#555', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  recordsDateGroup: { gap: 8 },
  recordsDateLabel: { color: '#888', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  recordsList: { gap: 0 },
  recordRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  recordRowIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  recordRowBody: { flex: 1, gap: 2 },
  recordRowSection: { color: '#fff', fontSize: 14, fontWeight: '700' },
  recordRowStatus: { color: '#666', fontSize: 12 },
  recordRowHours: { color: '#888', fontSize: 12, fontWeight: '600' },

  // Filter modal
  filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  filterSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  filterSheetTitle: { ...typography.h3, color: colors.text },
  filterSectionLabel: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#333',
    backgroundColor: '#0f0f0f',
  },
  filterChipActive: { borderColor: colors.text, backgroundColor: '#1a1a1a' },
  filterChipText: { color: '#666', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  filterChipTextActive: { color: colors.text },
  filterDateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filterDateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    gap: 6, padding: spacing.sm,
    borderRadius: 8, borderWidth: 1, borderColor: '#333',
    backgroundColor: '#0f0f0f',
  },
  filterDateBtnActive: { borderColor: colors.text, backgroundColor: '#1a1a1a' },
  filterDateBtnText: { color: '#666', fontSize: 13 },
  filterDateBtnTextActive: { color: colors.text },
  filterDateClear: { padding: 2 },
  filterActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  filterClearBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  filterClearText: { color: '#666', fontSize: 14, fontWeight: '600' },
  filterApplyBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center' },
  filterApplyText: { color: colors.background, fontSize: 14, fontWeight: '700' },
  fabContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    alignItems: 'flex-end',
  },
  fabTooltip: {
    backgroundColor: colors.text,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  tooltipCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabTooltipTitle: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  fabTooltipText: {
    color: colors.background,
    fontSize: 12,
    opacity: 0.9,
  },
  fabTooltipArrow: {
    position: 'absolute',
    bottom: -6,
    right: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.text,
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },

  // Companion notification speech bubble (inline in topBar)
  notifBubble: {
    flex: 1,
    height: 44,
    marginLeft: -16,  // pull bubble further left under companion icon
    backgroundColor: '#1a1a1a',
    borderRadius: 22,
    borderTopLeftRadius: 4,   // flat on the icon side
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
    gap: 6,
    overflow: 'hidden',
  },
  notifTail: {},   // no tail needed — bubble is flush with icon
  notifContent: { flex: 1, gap: 0, overflow: 'hidden' },
  notifTitle: { color: '#fff', fontSize: 12, fontWeight: '700' },
  notifMsg: { color: '#666', fontSize: 11, lineHeight: 14 },
  notifReadBtn: { color: '#fff', fontSize: 11, fontWeight: '600', textDecorationLine: 'underline' },
});

export default HomeScreen;
