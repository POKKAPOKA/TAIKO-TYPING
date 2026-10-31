import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({ current: null }));
vi.mock('../store/gameStore', () => ({
  useGameStore: { getState: () => testState.current, subscribe: vi.fn() },
}));
vi.mock('../hooks/useSystemSE', () => ({ playPerfect: vi.fn(), playGood: vi.fn(), playMiss: vi.fn() }));

describe('楽曲完走からリザルトへの遷移', () => {
  let engine;

  beforeEach(async () => {
    vi.stubGlobal('window', { removeEventListener: vi.fn() });
    vi.resetModules();
    const { GameEngine } = await import('./GameEngine');
    engine = new GameEngine();
    engine.stats.totalNotes = 2;
    const state = {
      status: 'playing', score: 900000, perfectCount: 2, goodCount: 0, missCount: 0,
      completedCount: 2, droppedCount: 0, maxKps: 0, isMobileMode: false,
      setTargetState: vi.fn(), setCombo: vi.fn(), recordCurrentPlayLog: vi.fn(),
      setStatsData: data => { state.statsData = data; },
      setStatus: status => { state.status = status; },
      addDroppedCount: () => { state.droppedCount++; },
      addMissCount: () => { state.missCount++; },
    };
    testState.current = state;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('クリア時は演出に進み、プレイ記録を残す', () => {
    engine.stop();
    expect(testState.current.status).toBe('clearTransition');
    expect(testState.current.recordCurrentPlayLog).toHaveBeenCalledOnce();
  });

  it('FAILEDは演出を挟まずリザルトに進む', () => {
    testState.current.score = 699999;
    engine.stop();
    expect(testState.current.status).toBe('result');
  });

  it('曲終了時の打ち残しを集計してから達成ランクを判定する', () => {
    engine.currentTarget = { word: 'ことば' };
    engine.romajiParser = { isComplete: () => false };
    engine.currentTargetJudged = true;
    engine.stop();
    expect(testState.current.droppedCount).toBe(1);
    expect(testState.current.statsData.mistakeLog).toEqual([{ time: 0, note: 'ことば', type: 'dropped' }]);
    expect(testState.current.status).toBe('clearTransition');
    const rank = getRank(testState.current);
    expect(rank).toBe('CLEAR');
  });

  it('曲終了時に追加したMISSを最終統計にも反映する', () => {
    // Zustandの更新では、それまでに取得したスナップショットは更新されない。
    testState.current.addDroppedCount = () => {
      testState.current = { ...testState.current, droppedCount: testState.current.droppedCount + 1 };
    };
    testState.current.addMissCount = () => {
      testState.current = { ...testState.current, missCount: testState.current.missCount + 1 };
    };
    testState.current.setStatsData = data => { testState.current = { ...testState.current, statsData: data }; };
    engine.currentTarget = { word: 'ことば' };
    engine.romajiParser = { isComplete: () => false };
    engine.currentTargetJudged = false;

    engine.stop();

    expect(testState.current.missCount).toBe(1);
    expect(testState.current.statsData.stats.missCount).toBe(1);
  });

  it('前のプレイの音源エラーが次のプレイを無音モードにしない', async () => {
    let rejectOldPlay;
    engine.audio = { play: () => new Promise((_, reject) => { rejectOldPlay = reject; }), pause: vi.fn() };
    engine.startAudio();
    engine.stop(false);
    engine.audio = { play: () => Promise.resolve(), pause: vi.fn() };
    engine.startAudio();

    rejectOldPlay(new Error('old play interrupted'));
    await Promise.resolve();

    expect(engine.isFallbackMode).toBe(false);
  });
});

import { getAchievementRank as getRank } from '../utils/achievementRank';
