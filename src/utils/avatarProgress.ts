import type { WeekEntry, WeeklyAvatarProgress } from '../types';

export function buildWeeklyProgressRows(progress: WeeklyAvatarProgress): WeekEntry[] {
  const { weeks, requiredDaysPerWeek, totalWeeks } = progress;
  const byWeek = new Map(weeks.map((w) => [w.week, w]));

  return Array.from({ length: totalWeeks }, (_, i) => {
    const weekNum = i + 1;
    return (
      byWeek.get(weekNum) ?? {
        week: weekNum,
        days: 0,
        required: requiredDaysPerWeek,
        met: false,
      }
    );
  });
}
