import { afterEach, describe, expect, it, vi } from 'vitest';
import { StageRhythmController, stageRhythm } from './stageRhythm';

const test = vi.hoisted(() => ({ state: null }));
vi.mock('../store/gameStore', () => ({
  useGameStore: { getState: () => test.state, subscribe: vi.fn() },
}));
vi.mock('../hooks/useSystemSE', () => ({ playPerfect: vi.fn(), playGood: vi.fn(), playMiss: vi.fn() }));

function makeStyle() {
  return { transform: '', opacity: '', removeProperty(name) { this[name] = ''; } };
}

function makeStage() {
  const character = { style: makeStyle() };
  const lights = Array.from({ length: 4 }, () => ({ style: makeStyle() }));
  const node = { querySelector: () => character, querySelectorAll: () => lights };
  return { node, character, lights };
}

afterEach(() => {
  stageRhythm.attach(null);
  stageRhythm.reset();
  vi.unstubAllGlobals();
});

describe('楽曲に同期するステージ演出', () => {
  it('BPM・譜面のオフセットから拍を求め、キャラクターと照明を同時に動かす', () => {
    const rhythm = new StageRhythmController();
    const { node, character, lights } = makeStage();
    rhythm.attach(node);
    rhythm.start({ bpm: 120, offset: 100 });

    expect(rhythm.update(-1)).toBeNull();
    expect(rhythm.update(100)).toBe(0);
    const atBeat = character.style.transform;
    const lightAtBeat = lights[0].style.transform;
    expect(rhythm.update(350)).toBe(0);
    expect(character.style.transform).not.toBe(atBeat);
    expect(lights[0].style.transform).not.toBe(lightAtBeat);
    expect(lights[0].style.opacity).not.toBe('');
    expect(rhythm.update(600)).toBe(1);
    expect(rhythm.update(1100)).toBe(2);
  });

  it('次の曲では拍の設定と見た目をリセットし、欠損・不正なBPMは120にする', () => {
    const rhythm = new StageRhythmController();
    const { node, character, lights } = makeStage();
    rhythm.attach(node);
    rhythm.start({ bpm: 60, offset: -50 });
    expect(rhythm.update(950)).toBe(1);
    rhythm.start({ bpm: 0 });
    expect(character.style.transform).toBe('');
    expect(lights[0].style.opacity).toBe('');
    expect(rhythm.update(500)).toBe(1);
    rhythm.reset();
    expect(rhythm.update(1000)).toBeNull();
  });

  it('動きを減らす設定を尊重し、表示中の動きも解除する', () => {
    const preference = { matches: false };
    vi.stubGlobal('window', { matchMedia: () => preference });
    const rhythm = new StageRhythmController();
    const { node, character } = makeStage();
    rhythm.attach(node);
    rhythm.start({ bpm: 120 });
    rhythm.update(250);
    expect(character.style.transform).not.toBe('');
    preference.matches = true;
    expect(rhythm.update(300)).toBeNull();
    expect(character.style.transform).toBe('');
  });

  it('音源の時刻から表情を切り替え、ミス表示は維持してから拍に復帰する', async () => {
    vi.stubGlobal('window', { removeEventListener: vi.fn(), addEventListener: vi.fn() });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { GameEngine } = await import('./GameEngine');
    const engine = new GameEngine();
    test.state = {
      status: 'playing', isPaused: false, vocalState: 'sing_1',
      setVocalState: value => { test.state.vocalState = value; },
    };
    stageRhythm.start({ bpm: 120, offset: 100 });
    engine.audioStarted = true;
    engine.audio = { currentTime: 0.6, ended: false, pause: vi.fn() };
    engine.checkForceTransition = vi.fn();

    engine.update();
    expect(test.state.vocalState).toBe('sing_2');
    test.state.vocalState = 'miss';
    engine.audio.currentTime = 1.1;
    engine.update();
    expect(test.state.vocalState).toBe('miss');
    test.state.vocalState = 'sing_2';
    engine.update();
    expect(test.state.vocalState).toBe('sing_1');
    engine.reset();
  });

  it('ポーズで描画を止め、再開後も音源の同じ位置から同期する', async () => {
    vi.stubGlobal('window', { removeEventListener: vi.fn(), addEventListener: vi.fn() });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 7));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { GameEngine } = await import('./GameEngine');
    const engine = new GameEngine();
    const { node, character, lights } = makeStage();
    stageRhythm.attach(node);
    stageRhythm.start({ bpm: 120 });
    test.state = {
      status: 'playing', isPaused: false, vocalState: 'sing_1',
      setVocalState: value => { test.state.vocalState = value; },
      setIsPaused: value => { test.state.isPaused = value; },
    };
    engine.audioStarted = true;
    engine.audio = { currentTime: 0.25, ended: false, pause: vi.fn(), play: vi.fn(() => Promise.resolve()) };
    engine.checkForceTransition = vi.fn();
    engine.update();
    const characterAtPause = character.style.transform;
    const lightAtPause = lights[0].style.transform;

    engine.togglePause();
    expect(test.state.isPaused).toBe(true);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(character.style.transform).toBe(characterAtPause);
    expect(lights[0].style.transform).toBe(lightAtPause);
    engine.togglePause();
    expect(test.state.isPaused).toBe(false);
    engine.update();
    expect(character.style.transform).toBe(characterAtPause);
    expect(lights[0].style.transform).toBe(lightAtPause);
    engine.audio.currentTime = 0.5;
    engine.update();
    expect(test.state.vocalState).toBe('sing_2');
    expect(character.style.transform).not.toBe(characterAtPause);
    engine.reset();
  });
});
