import type { ActivityLogEntry, MonthlyActivityResponse, MonthlyDayEntry } from '../types';

const isDayEntry = (value: unknown): value is MonthlyDayEntry =>
  typeof value === 'object'
  && value !== null
  && 'date' in value
  && typeof (value as MonthlyDayEntry).date === 'string';

const normalizeLogDate = (date: string) => (date.includes('T') ? date.split('T')[0] : date);

const isCountableDay = (day: MonthlyDayEntry) =>
  day.didUserDo === true || day.didUserDo === false;

export const getMonthlyMindEntries = (mind: MonthlyActivityResponse['mind'] | undefined): MonthlyDayEntry[] => {
  if (!mind) return [];
  if (Array.isArray(mind)) return mind;

  const paused = mind as Record<string, unknown>;
  for (const key of ['days', 'data', 'logs', 'entries']) {
    const value = paused[key];
    if (Array.isArray(value)) return value as MonthlyDayEntry[];
  }

  return Object.values(paused).filter(isDayEntry);
};

export const hasMonthlyMindGreenDots = (entries: MonthlyDayEntry[]): boolean =>
  entries.some((entry) => entry.didUserDo === true);

export const shouldShowMonthlyMind = (mind: MonthlyActivityResponse['mind'] | undefined): boolean => {
  if (!mind) return false;
  if (Array.isArray(mind)) return mind.length > 0;
  return hasMonthlyMindGreenDots(getMonthlyMindEntries(mind));
};

export const getMonthlySectionEntries = (
  monthlyData: MonthlyActivityResponse,
  section: 'power' | 'craft' | 'mind' | 'purity',
): MonthlyDayEntry[] => {
  if (section === 'mind') return getMonthlyMindEntries(monthlyData.mind);
  const sectionData = monthlyData[section];
  return Array.isArray(sectionData) ? sectionData : [];
};

export const buildMindDaysFromLogs = (
  monthDays: MonthlyDayEntry[],
  logs: ActivityLogEntry[],
): MonthlyDayEntry[] => {
  const monthDates = new Set(monthDays.map((day) => day.date));
  const mindLogsByDate = new Map<string, ActivityLogEntry>();

  for (const log of logs) {
    if (log.section !== 'mind') continue;
    const date = normalizeLogDate(log.date);
    if (!monthDates.has(date)) continue;
    const existing = mindLogsByDate.get(date);
    if (!existing || log.didUserDo) mindLogsByDate.set(date, log);
  }

  return monthDays.map((day) => {
    const log = mindLogsByDate.get(day.date);
    if (log) return { date: day.date, didUserDo: log.didUserDo };
    if (!isCountableDay(day)) return { date: day.date, didUserDo: undefined };
    return { date: day.date, didUserDo: false };
  });
};

export const enrichMonthlyMindFromLogs = (
  monthlyData: MonthlyActivityResponse,
  logs: ActivityLogEntry[],
): MonthlyActivityResponse => {
  if (Array.isArray(monthlyData.mind)) return monthlyData;

  const existing = getMonthlyMindEntries(monthlyData.mind);
  if (hasMonthlyMindGreenDots(existing)) {
    return {
      ...monthlyData,
      mind: { isActive: false, days: existing },
    };
  }

  const days = buildMindDaysFromLogs(monthlyData.power, logs);
  if (!hasMonthlyMindGreenDots(days)) return monthlyData;

  return {
    ...monthlyData,
    mind: { isActive: false, days },
  };
};
