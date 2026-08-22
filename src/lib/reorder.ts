// Shared by the hub block list, menu categories and menu items. Callers
// renumber `position` to the returned index, which also repairs any duplicate
// or gapped positions left behind by earlier edits.
export function reorderIds(ids: string[], id: string, direction: 'up' | 'down'): string[] | null {
  const from = ids.indexOf(id);
  if (from === -1) return null;
  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
