import {describe, it, expect} from 'vitest';
import {reorderIds} from '@/lib/reorder';

describe('reorderIds', () => {
  it('moves an item up', () => {
    expect(reorderIds(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c']);
  });

  it('moves an item down', () => {
    expect(reorderIds(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b']);
  });

  it('refuses to move the first item up', () => {
    expect(reorderIds(['a', 'b'], 'a', 'up')).toBeNull();
  });

  it('refuses to move the last item down', () => {
    expect(reorderIds(['a', 'b'], 'b', 'down')).toBeNull();
  });

  it('returns null for an unknown id', () => {
    expect(reorderIds(['a', 'b'], 'z', 'up')).toBeNull();
  });

  it('does not mutate the input', () => {
    const input = ['a', 'b'];
    reorderIds(input, 'b', 'up');
    expect(input).toEqual(['a', 'b']);
  });
});
