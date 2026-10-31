import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomajiParser } from './RomajiParser';

const test = vi.hoisted(() => ({ state: null }));
vi.mock('../store/gameStore', () => ({ useGameStore: { getState: () => test.state, subscribe: vi.fn() } }));
vi.mock('../hooks/useSystemSE', () => ({ playPerfect: vi.fn(), playGood: vi.fn(), playMiss: vi.fn() }));

describe('リザルト用の入力集計', () => {
  let engine;
  beforeEach(async () => {
    vi.stubGlobal('window', { removeEventListener: vi.fn() });
    vi.resetModules();
    const { GameEngine } = await import('./GameEngine');
    engine = new GameEngine();
    engine.totalNotesChars = 4;
    engine.accumulatedChars = 0;
    engine.accumulatedMaxScore = 0;
    test.state = {
      status: 'playing', isPaused: false, isMobileMode: false, offsetMs: 0,
      score: 0, perfectCount: 0, goodCount: 0, missCount: 0, typoCount: 0,
      fastCount: 0, lateCount: 0, untypedCount: 0, droppedCount: 0, completedCount: 0,
      setTargetState: vi.fn(), setWordQueue: vi.fn(), setCombo: vi.fn(), setLastJudgment: vi.fn(),
      triggerVocalMiss: vi.fn(), triggerVocalSing: vi.fn(), recordCurrentPlayLog: vi.fn(),
      addScore: value => { test.state.score += value; },
      addPerfectCount: () => { test.state.perfectCount++; },
      addGoodCount: () => { test.state.goodCount++; },
      addMissCount: () => { test.state.missCount++; },
      addTypoCount: () => { test.state.typoCount++; },
      addFastCount: () => { test.state.fastCount++; },
      addLateCount: () => { test.state.lateCount++; },
      addUntypedCount: () => { test.state.untypedCount++; },
      addDroppedCount: () => { test.state.droppedCount++; },
      setStatsData: data => { test.state.statsData = data; },
      setStatus: status => { test.state.status = status; },
    };
    engine.stats.totalNotes = 1;
    engine.currentTarget = { word: 'かき', reading: 'かき', time: 1000, endTime: 2000 };
    engine.romajiParser = new RomajiParser('かき');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('PCで誤入力したキーと対象キーを記録し、正しい初打鍵の早ズレを集計する', () => {
    engine.currentTime = 950;
    engine.handleKeyDown({ key: 'x' });
    engine.handleKeyDown({ key: 'k' });
    expect(test.state).toMatchObject({ typoCount: 1, fastCount: 1, lateCount: 0, perfectCount: 1 });
    expect(engine.stats.missHistory[0]).toMatchObject({ type: 'mistype', note: 'かき', targetChar: 'K', typedChar: 'x', time: 0.95 });
  });

  it('スマホの初打鍵ではオフセット補正後の遅ズレと実入力を記録する', () => {
    test.state.isMobileMode = true;
    test.state.offsetMs = 20;
    engine.mobileTargetKana = 'かき';
    engine.currentTime = 1085;
    engine.handleFlickInput('た');
    engine.handleFlickInput('か');
    expect(test.state).toMatchObject({ typoCount: 1, fastCount: 0, lateCount: 1, goodCount: 1 });
    expect(engine.stats.missHistory[0]).toMatchObject({ targetChar: 'か', typedChar: 'た', type: 'mistype' });
  });

  it('中心ちょうどのPERFECTと、判定幅外のMISSはFAST/LATEに加算しない', () => {
    engine.applyJudgment('PERFECT', 0);
    engine.applyJudgment('MISS', -120);
    expect(test.state).toMatchObject({ fastCount: 0, lateCount: 0, perfectCount: 1, missCount: 1 });
  });

  it('タイミングMISSにも対象キーと実際の入力を残す', () => {
    engine.currentTime = 1120;
    engine.handleKeyDown({ key: 'k' });
    expect(test.state).toMatchObject({ fastCount: 0, lateCount: 0, missCount: 1 });
    expect(engine.stats.missHistory[0]).toMatchObject({ type: 'timing', targetChar: 'K', typedChar: 'k' });
  });

  it('未入力と途中で打ち残したノーツを区別する', () => {
    engine.currentTime = 1150;
    engine.forceMissAndTransition();
    expect(test.state).toMatchObject({ untypedCount: 1, droppedCount: 1, missCount: 1 });
    expect(engine.stats.missHistory[0]).toMatchObject({ type: 'untyped', partial: false });
    engine.currentTarget = { word: 'かき', reading: 'かき', time: 1000, endTime: 2000 };
    engine.currentTargetJudged = true;
    engine.forceMissAndTransition();
    expect(test.state).toMatchObject({ untypedCount: 1, droppedCount: 2, missCount: 1 });
    expect(engine.stats.missHistory[1]).toMatchObject({ type: 'untyped', partial: true });
  });

  it('音源終了時に未出題の残りノーツも入力抜けに含める', () => {
    engine.currentTarget = null;
    engine.queue = [{ word: 'ひとつ', time: 2000 }, { word: 'ふたつ', time: 3000 }];
    engine.stop();
    expect(test.state).toMatchObject({ untypedCount: 2, droppedCount: 2, missCount: 2 });
    expect(test.state.statsData.missHistory).toHaveLength(2);
  });

  it('曲終了時に最終的な判定・入力集計をストアへまとめる', () => {
    Object.assign(test.state, { fastCount: 2, lateCount: 3, untypedCount: 1, droppedCount: 2, typoCount: 4, completedCount: 6 });
    engine.currentTarget = null;
    engine.stop();
    expect(test.state.statsData.stats).toMatchObject({ fastCount: 2, lateCount: 3, untypedCount: 1, droppedCount: 2, mistypeCount: 4, completedCount: 6 });
  });
});
