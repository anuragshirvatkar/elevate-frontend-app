import type { WeekEntry, WeeklyAvatarProgress } from '../types';

/**
 * Exactly `totalWeeks` columns — same rolling window as backend unlock (oldest → current).
 * Never filters out the in-progress week.
 */
export function buildWeeklyProgressRows(progress: WeeklyAvatarProgress): WeekEntry[] {
  const { totalWeeks, requiredDaysPerWeek, weeks } = progress;

  return Array.from({ length: totalWeeks }, (_, index) => {
    const weekNumber = index + 1;
    const row = weeks[index] ?? weeks.find((entry) => entry.week === weekNumber);

    if (!row) {
      return {
        week: weekNumber,
        days: 0,
        required: requiredDaysPerWeek,
        met: false,
      };
    }

    const days = Math.min(row.days, requiredDaysPerWeek);
    return {
      week: weekNumber,
      days,
      required: requiredDaysPerWeek,
      met: days >= requiredDaysPerWeek,
      ...(row.inProgress ? { inProgress: true as const } : {}),
    };
  });
}
