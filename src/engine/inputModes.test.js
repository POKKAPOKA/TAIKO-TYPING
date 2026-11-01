import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const test = vi.hoisted(() => ({ state: null }));
vi.mock('../store/gameStore', () => ({ useGameStore: { getState: () => test.state, subscribe: vi.fn() } }));
vi.mock('../hooks/useSystemSE', () => ({ playPerfect: vi.fn(), playGood: vi.fn(), playMiss: vi.fn() }));

describe('PC・スマホの入力', () => {
  let engine;
  let preparePlayableNotes;

  beforeEach(async () => {
    vi.stubGlobal('window', { removeEventListener: vi.fn() });
    const module = await import('./GameEngine');
    engine = new module.GameEngine();
    preparePlayableNotes = module.preparePlayableNotes;
    test.state = {
      status: 'playing', isPaused: false, isMobileMode: false, offsetMs: 0, combo: 0,
      perfectCount: 0, goodCount: 0, missCount: 0, typoCount: 0, completedCount: 0, score: 0,
      setTargetState: vi.fn(), setWordQueue: vi.fn(), setLastJudgment: vi.fn(),
      setCombo: value => { test.state.combo = value; },
      addScore: value => { test.state.score += value; },
      addPerfectCount: () => { test.state.perfectCount++; },
      addGoodCount: () => { test.state.goodCount++; },
      addMissCount: () => { test.state.missCount++; },
      addTypoCount: () => { test.state.typoCount++; },
      addCompletedCount: () => { test.state.completedCount++; },
      updateMaxKps: vi.fn(), triggerVocalMiss: vi.fn(), triggerVocalSing: vi.fn(),
    };
    engine.totalNotesChars = 1;
    engine.accumulatedChars = 0;
    engine.accumulatedMaxScore = 0;
    engine.currentTime = 1000;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('記号のみのノーツは除外し、残りは元のデータを変えず時刻順にする', () => {
    const notes = [
      { word: 'Hello, world!', time: 2000 },
      { word: '！', time: 1000 },
      { word: 'あー', time: 3000 },
      { word: '歌', reading: '。', time: 1500 },
    ];
    const result = preparePlayableNotes(notes);
    expect(result.map(note => note.word)).toEqual(['Hello, world!', 'あー']);
    expect(notes).toHaveLength(4);
    expect(engine._getNoteKeystrokes(result[0], false)).toBe(10);
    expect(engine._getNoteKeystrokes(result[0], true)).toBe(10);
  });

  it('PCでは記号を無視して次の英字へ進む', () => {
    const note = { word: 'A-b!', time: 1000, endTime: 2000 };
    engine.totalNotesChars = 2;
    engine.updateCurrentTarget(test.state, note);
    engine.handleKeyDown({ key: 'a' });
    engine.handleKeyDown({ key: '-' });
    engine.handleKeyDown({ key: '!' });
    engine.handleKeyDown({ key: 'b' });
    expect(test.state).toMatchObject({ completedCount: 1, perfectCount: 1, typoCount: 0, score: 1010000 });
  });

  it('日本語の長音はPCではハイフンで入力できる', () => {
    engine.totalNotesChars = 2;
    engine.updateCurrentTarget(test.state, { word: 'あー', time: 1000, endTime: 2000 });
    engine.handleKeyDown({ key: 'a' });
    engine.handleKeyDown({ key: '-' });
    expect(test.state).toMatchObject({ completedCount: 1, perfectCount: 1, typoCount: 0 });
  });

  it('スマホでは英字・数字とかなを大文字小文字を区別せず入力できる', () => {
    test.state.isMobileMode = true;
    engine.totalNotesChars = 4;
    engine.updateCurrentTarget(test.state, { word: 'Ａ・ち！B2', time: 1000, endTime: 2000 });
    expect(engine.mobileTargetKana).toBe('aちb2');
    for (const key of ['A', '！', 'ち', 'b', '2']) engine.handleFlickInput(key);
    expect(test.state).toMatchObject({ completedCount: 1, perfectCount: 1, typoCount: 0, score: 1010000 });
  });
});
