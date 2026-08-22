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
  it('covers the 14 EU allergens as letters a-n', () => {
    expect(Object.keys(ALLERGENS)).toHaveLength(14);
    expect(Object.keys(ALLERGENS)[0]).toBe('a');
    expect(Object.keys(ALLERGENS)[13]).toBe('n');
  });

  it('covers the German additive numbers 1-12', () => {
    expect(Object.keys(ADDITIVES)).toHaveLength(12);
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
