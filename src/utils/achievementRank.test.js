import { describe, expect, it } from 'vitest';
import { getAchievementRank } from './achievementRank';

const complete = {
  score: 1000000,
  perfectCount: 4,
  goodCount: 0,
  missCount: 0,
  droppedCount: 0,
  completedCount: 4,
  statsData: { stats: { totalNotes: 4 }, mistakeLog: [] },
};

describe('楽曲終了時の達成判定', () => {
  it('70万点未満は判定数にかかわらずFAILED', () => {
    expect(getAchievementRank({ ...complete, score: 699999 })).toBe('FAILED');
  });

  it('全良と、GOODを含むフルコンボを区別する', () => {
    expect(getAchievementRank(complete)).toBe('ALL_PERFECT');
    expect(getAchievementRank({ ...complete, perfectCount: 3, goodCount: 1 })).toBe('FULL_COMBO');
    expect(getAchievementRank({ ...complete, perfectCount: 0, goodCount: 4, score: 700000 })).toBe('FULL_COMBO');
  });

  it('MISS、打ち残し、未完了ノーツがある場合はCLEARにとどめる', () => {
    expect(getAchievementRank({ ...complete, missCount: 1 })).toBe('CLEAR');
    expect(getAchievementRank({ ...complete, droppedCount: 1 })).toBe('CLEAR');
    expect(getAchievementRank({ ...complete, completedCount: 3 })).toBe('CLEAR');
    expect(getAchievementRank({ ...complete, statsData: { stats: { totalNotes: 4 }, mistakeLog: [{ type: 'dropped' }] } })).toBe('CLEAR');
  });
});
