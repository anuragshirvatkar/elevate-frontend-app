import type { CompanionDto } from '../types';

const COMPANION_ORDER = [
  'Captain Blackvein',
  'Arkan Veylor',
  'Zedra Morvain',
  'Tharok Warborn',
] as const;

const COMPANION_SLUG_ORDER = ['blackvein', 'arkan', 'zedra', 'tharok'] as const;

function getCompanionOrderIndex(companion: Pick<CompanionDto, 'name' | 'slug'>): number {
  const byName = COMPANION_ORDER.indexOf(companion.name as (typeof COMPANION_ORDER)[number]);
  if (byName !== -1) return byName;

  const slug = companion.slug?.toLowerCase() ?? '';
  const bySlug = COMPANION_SLUG_ORDER.findIndex((key) => slug.includes(key));
  if (bySlug !== -1) return bySlug;

  return COMPANION_ORDER.length;
}

export function sortCompanions<T extends Pick<CompanionDto, 'name' | 'slug'>>(companions: T[]): T[] {
  return [...companions].sort((a, b) => getCompanionOrderIndex(a) - getCompanionOrderIndex(b));
}

export const COMPANION_COLORS: Record<string, string> = {
  'Captain Blackvein': '#3DFF86',
  'Arkan Veylor': '#FF5A5A',
  'Zedra Morvain': '#C77DFF',
  'Tharok Warborn': '#FFC857',
  'Seris Astraea': '#54A9FF',
  Monk: '#FFC857',
  Warrior: '#FF5A5A',
  Sage: '#54A9FF',
};

export function getCompanionColor(name: string): string {
  return COMPANION_COLORS[name] || '#3DFF86';
}
