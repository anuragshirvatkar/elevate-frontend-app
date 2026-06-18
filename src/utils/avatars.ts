const AVATAR_SLUG_ORDER_MALE = ['riven', 'drena', 'aelius', 'renji', 'verin', 'kael'] as const;
const AVATAR_SLUG_ORDER_FEMALE = ['drena', 'riven', 'aelius', 'renji', 'verin'] as const;

function getAvatarOrderIndex(slug: string, isFemale: boolean): number {
  const order = isFemale ? AVATAR_SLUG_ORDER_FEMALE : AVATAR_SLUG_ORDER_MALE;
  const idx = order.indexOf(slug.toLowerCase() as (typeof order)[number]);
  return idx === -1 ? order.length : idx;
}

export function sortAvatars<T extends { id: string; slug: string; isSelected?: boolean }>(
  avatars: T[],
  selectedId?: string,
  isFemale = false,
): T[] {
  const selected = selectedId
    ? avatars.find((a) => a.id === selectedId)
    : avatars.find((a) => a.isSelected);

  const rest = avatars
    .filter((a) => a.id !== selected?.id)
    .sort((a, b) => getAvatarOrderIndex(a.slug, isFemale) - getAvatarOrderIndex(b.slug, isFemale));

  return selected ? [selected, ...rest] : rest;
}
