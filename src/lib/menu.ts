export const DIET_TAGS = ['vegetarisch', 'vegan', 'scharf', 'glutenfrei'] as const;
export type DietTag = (typeof DIET_TAGS)[number];

// The 14 allergens of EU regulation 1169/2011, lettered as German menus letter them.
export const ALLERGENS = {
  a: 'Glutenhaltiges Getreide',
  b: 'Krebstiere',
  c: 'Eier',
  d: 'Fische',
  e: 'Erdnüsse',
  f: 'Sojabohnen',
  g: 'Milch/Laktose',
  h: 'Schalenfrüchte',
  i: 'Sellerie',
  j: 'Senf',
  k: 'Sesamsamen',
  l: 'Schwefeldioxid/Sulfite',
  m: 'Lupinen',
  n: 'Weichtiere'
} as const;
export type AllergenCode = keyof typeof ALLERGENS;

// Zusatzstoff-Kennzeichnung per German ZZulV.
export const ADDITIVES = {
  '1': 'mit Farbstoff',
  '2': 'mit Konservierungsstoff',
  '3': 'mit Antioxidationsmittel',
  '4': 'mit Geschmacksverstärker',
  '5': 'geschwefelt',
  '6': 'geschwärzt',
  '7': 'gewachst',
  '8': 'mit Phosphat',
  '9': 'mit Süßungsmittel',
  '10': 'enthält eine Phenylalaninquelle',
  '11': 'koffeinhaltig',
  '12': 'chininhaltig'
} as const;
export type AdditiveCode = keyof typeof ADDITIVES;

function filterCodes<T extends string>(values: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<T>();
  for (const value of values) {
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
      seen.add(value as T);
    }
  }
  return [...seen];
}

export function filterDietTags(values: unknown): DietTag[] {
  return filterCodes(values, DIET_TAGS);
}

export function filterAllergens(values: unknown): AllergenCode[] {
  return filterCodes(values, Object.keys(ALLERGENS) as AllergenCode[]);
}

export function filterAdditives(values: unknown): AdditiveCode[] {
  return filterCodes(values, Object.keys(ADDITIVES) as AdditiveCode[]);
}

// The guest legend shows only the codes the venue actually uses — a full
// 26-entry legend under a six-item menu is noise.
export function buildLegend(items: Array<{allergens: string[]; additives: string[]}>): {
  allergens: Array<[AllergenCode, string]>;
  additives: Array<[AdditiveCode, string]>;
} {
  const allergenCodes = filterAllergens(items.flatMap((i) => i.allergens));
  const additiveCodes = filterAdditives(items.flatMap((i) => i.additives));
  return {
    allergens: allergenCodes
      .sort((a, b) => a.localeCompare(b))
      .map((code) => [code, ALLERGENS[code]]),
    additives: additiveCodes
      .sort((a, b) => Number(a) - Number(b))
      .map((code) => [code, ADDITIVES[code]])
  };
}
