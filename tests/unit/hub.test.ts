import {describe, it, expect} from 'vitest';
import {visibleHubBlocks, type HubBlock} from '@/lib/hub';

function block(over: Partial<HubBlock> & Pick<HubBlock, 'id' | 'kind'>): HubBlock {
  return {
    label: over.kind,
    icon: null,
    url: over.kind === 'custom' ? 'https://example.de/' : null,
    enabled: true,
    position: 0,
    ...over
  };
}

describe('visibleHubBlocks', () => {
  it('sorts by position', () => {
    const blocks = [
      block({id: 'c', kind: 'custom', position: 2}),
      block({id: 'a', kind: 'review', position: 0}),
      block({id: 'b', kind: 'menu', position: 1})
    ];
    expect(visibleHubBlocks(blocks, {hasMenuItems: true}).map((b) => b.id)).toEqual([
      'a',
      'b',
      'c'
    ]);
  });

  it('breaks position ties by id so the order is stable', () => {
    const blocks = [
      block({id: 'zz', kind: 'custom', position: 0}),
      block({id: 'aa', kind: 'custom', position: 0})
    ];
    expect(visibleHubBlocks(blocks, {hasMenuItems: true}).map((b) => b.id)).toEqual(['aa', 'zz']);
  });

  it('drops disabled blocks', () => {
    const blocks = [
      block({id: 'a', kind: 'review', position: 0}),
      block({id: 'b', kind: 'custom', position: 1, enabled: false})
    ];
    expect(visibleHubBlocks(blocks, {hasMenuItems: true}).map((b) => b.id)).toEqual(['a']);
  });

  it('hides the menu block when the venue has no items, even if enabled', () => {
    const blocks = [
      block({id: 'm', kind: 'menu', position: 0}),
      block({id: 'r', kind: 'review', position: 1})
    ];
    expect(visibleHubBlocks(blocks, {hasMenuItems: false}).map((b) => b.id)).toEqual(['r']);
  });

  it('shows the menu block once the venue has items', () => {
    const blocks = [block({id: 'm', kind: 'menu', position: 0})];
    expect(visibleHubBlocks(blocks, {hasMenuItems: true}).map((b) => b.id)).toEqual(['m']);
  });

  it('returns nothing when every block is hidden — caller falls back to the stars', () => {
    const blocks = [
      block({id: 'm', kind: 'menu', position: 0}),
      block({id: 'r', kind: 'review', position: 1, enabled: false})
    ];
    expect(visibleHubBlocks(blocks, {hasMenuItems: false})).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const blocks = [
      block({id: 'b', kind: 'custom', position: 1}),
      block({id: 'a', kind: 'custom', position: 0})
    ];
    visibleHubBlocks(blocks, {hasMenuItems: true});
    expect(blocks.map((b) => b.id)).toEqual(['b', 'a']);
  });
});
