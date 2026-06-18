const CRAFT_DISPLAY_NAMES: Record<string, string> = {
  Networking: 'Freelancing',
};

/** User-facing label for a power/craft activity (API name may differ). */
export function getActivityDisplayName(section: 'power' | 'craft', name: string): string {
  if (section === 'craft') return CRAFT_DISPLAY_NAMES[name] ?? name;
  return name;
}

export function normalizeActivityName(section: 'power' | 'craft', name: string): string {
  return getActivityDisplayName(section, name).toLowerCase().trim();
}

export function resolveActivityId(activity: { activityId?: string; id?: string }): string | undefined {
  return activity.activityId ?? activity.id;
}

/** True when two activities refer to the same catalog/setup entry. */
export function isSameActivity(
  section: 'power' | 'craft',
  a: { activityId?: string; id?: string; name: string },
  b: { activityId?: string; id?: string; name: string },
): boolean {
  const aId = resolveActivityId(a);
  const bId = resolveActivityId(b);
  if (aId && bId && aId === bId) return true;
  if (!a.name?.trim() || !b.name?.trim()) return false;
  return normalizeActivityName(section, a.name) === normalizeActivityName(section, b.name);
}

export const CRAFT_COMMON_ORDER = [
  'work',
  'studying',
  'business building',
  'project building',
  'freelancing',
  'language learning',
];

export const POWER_COMMON_ORDER = ['gym', 'calisthenics', 'running', 'yoga', 'badminton'];
