import {describe, it, expect} from 'vitest';
import {
  DIET_TAGS,
  ALLERGENS,
  ADDITIVES,
  filterDietTags,
  filterAllergens,
  filterAdditives,
  buildLegend
} from '@/lib/menu';

describe('vocabularies', () => {
  it('pins the 14 EU allergen code-to-label bindings exactly', () => {
    expect(ALLERGENS).toEqual({
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
    });
  });

  it('pins the 12 German additive code-to-label bindings exactly', () => {
    expect(ADDITIVES).toEqual({
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
    });
  });

  it('offers four diet tags', () => {
    expect(DIET_TAGS).toEqual(['vegetarisch', 'vegan', 'scharf', 'glutenfrei']);
  });
});

describe('filters', () => {
  it('keeps known diet tags and drops the rest', () => {
    expect(filterDietTags(['vegan', 'erfunden', 'scharf'])).toEqual(['vegan', 'scharf']);
  });

  it('deduplicates', () => {
    expect(filterAllergens(['a', 'a', 'g'])).toEqual(['a', 'g']);
  });

  it('drops unknown allergen codes', () => {
    expect(filterAllergens(['a', 'z', '3'])).toEqual(['a']);
  });

  it('keeps additive codes as strings', () => {
    expect(filterAdditives(['1', '11', '99'])).toEqual(['1', '11']);
  });

  it('returns an empty array for non-array input', () => {
    expect(filterDietTags('vegan')).toEqual([]);
    expect(filterAllergens(undefined)).toEqual([]);
  });
});

describe('buildLegend', () => {
  it('lists only codes actually used, allergens alphabetical and additives numeric', () => {
    const legend = buildLegend([
      {allergens: ['g', 'a'], additives: ['11']},
      {allergens: ['a'], additives: ['2']},
      {allergens: [], additives: []}
    ]);
    expect(legend.allergens.map(([code]) => code)).toEqual(['a', 'g']);
    expect(legend.additives.map(([code]) => code)).toEqual(['2', '11']);
    expect(legend.allergens[0][1]).toBe(ALLERGENS.a);
  });

  it('returns empty groups when nothing is tagged', () => {
    expect(buildLegend([{allergens: [], additives: []}])).toEqual({allergens: [], additives: []});
  });

  it('ignores codes that are not in the vocabulary', () => {
    const legend = buildLegend([{allergens: ['zz'], additives: ['77']}]);
    expect(legend).toEqual({allergens: [], additives: []});
  });
});
