import { describe, expect, it } from 'vitest';
import { classifyRankingTiming } from './rankingTiming';

describe('ランキングの内部精度', () => {
  it.each([[0, 0, 'ineligible'], [1, 0, 'verification'], [0, 30, 'verification'], [1, 30, 'eligible']])(
    'FAST %i・LATE %i は %s', (fastCount, lateCount, expected) => {
      expect(classifyRankingTiming({ fastCount, lateCount })).toBe(expected);
    },
  );
  it.each([undefined, {}, { fastCount: -1, lateCount: 1 }, { fastCount: 0.5, lateCount: 1 }])(
    '不正・未取得の値は保留: %o', stats => expect(classifyRankingTiming(stats)).toBe('unavailable'),
  );
});
