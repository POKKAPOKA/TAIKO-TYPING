import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ submitScore: vi.fn(), startRankedSession: vi.fn(), saveLog: vi.fn(() => ({ id: 'test-log' })) }));
vi.mock('../api/rankings', () => ({ submitScore: mocks.submitScore }));
vi.mock('../api/rankedSession', () => ({ startRankedSession: mocks.startRankedSession }));
vi.mock('../api/likes', () => ({ getLocalSongLikesMap: () => ({}), fetchGlobalSongLikes: vi.fn(async () => ({})), updateSongLikeCount: vi.fn(), normalizeSongId: value => value }));
vi.mock('../utils/csvExport', () => ({ getLocalPlayLogs: () => [], savePlayLogToLocal: mocks.saveLog, fetchMergedPlayLogs: vi.fn(async () => ({ logs: [] })), clearPlayLogs: vi.fn() }));
vi.mock('../hooks/useSystemSE', () => ({ playPerfect: vi.fn(), playGood: vi.fn(), playMiss: vi.fn() }));

const notes = [
  { id: '1', word: 'さくら', reading: 'さくら', time: 1000, endTime: 1400 },
  { id: '2', word: 'hello', reading: 'hello', time: 1500, endTime: 1900 },
  { id: '3', word: 'ち', reading: 'ち', time: 2000, endTime: 2400 },
];
let engine;
let store;
let storage;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  mocks.submitScore.mockReset().mockResolvedValue({ updated: true });
  mocks.startRankedSession.mockReset();
  mocks.saveLog.mockClear();
  storage = new Map();
  vi.stubGlobal('localStorage', { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
  vi.stubGlobal('window', { innerWidth: 1200, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('Audio', class {
    currentTime = 0;
    volume = 1;
    ended = false;
    play() { return Promise.resolve(); }
    pause() {}
  });
  vi.stubGlobal('crypto', { randomUUID: () => 'test-play-session' });
  store = (await import('../store/gameStore')).useGameStore;
  await import('./gameUiSync');
  const { GameEngine } = await import('./GameEngine');
  engine = new GameEngine();
  store.setState({ loadedScore: { notes }, audioUrl: 'test-audio', scoreFileName: 'song.json', isLocalPlay: false, isMobileMode: false, isBoothMode: true, isRhythmMode: true });
});

afterEach(() => {
  engine?.reset();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function hit(key, time, extras = {}) {
  engine.currentTime = time;
  engine.handleKeyDown({ key, preventDefault: vi.fn(), ...extras });
}

describe('展示ブースのリズムモード', () => {
  it('どのキーでも1ノーツずつタイミング判定し、結果を自動送信しない', () => {
    engine.start();
    expect(store.getState().playRhythmMode).toBe(true);
    expect(mocks.startRankedSession).not.toHaveBeenCalled();
    expect(store.getState().activeWord).toBeNull();
    hit(' ', 1000);
    hit('Enter', 1570);
    hit('?', 2110);
    expect(store.getState()).toMatchObject({ perfectCount: 1, goodCount: 1, missCount: 1, completedCount: 3, typoCount: 0, fastCount: 0, lateCount: 1, maxKps: 0 });
    expect(store.getState().score).toBe(504999);
    engine.stop();
    expect(store.getState().statsData.stats.totalNotes).toBe(3);
    expect(mocks.submitScore).not.toHaveBeenCalled();
    expect(mocks.saveLog).toHaveBeenCalledWith(expect.objectContaining({ isRhythmMode: true }));
  });

  it('未入力のノーツと曲終了時の残りをMISSとして集計する', () => {
    engine.start();
    engine.currentTime = 1151;
    engine.checkForceTransition();
    expect(store.getState()).toMatchObject({ missCount: 1, untypedCount: 1, droppedCount: 1 });
    engine.stop();
    expect(store.getState()).toMatchObject({ missCount: 3, untypedCount: 3, droppedCount: 3, completedCount: 0 });
  });

  it('連続押しの自動リピートやブラウザのショートカットは判定しない', () => {
    engine.start();
    hit('a', 1000, { repeat: true });
    hit('r', 1000, { ctrlKey: true });
    hit('a', 1000, { target: { closest: () => ({}) } });
    expect(store.getState()).toMatchObject({ perfectCount: 0, completedCount: 0 });
    hit('ArrowLeft', 1000);
    expect(store.getState()).toMatchObject({ perfectCount: 1, completedCount: 1 });
  });

  it('Escはポーズとして扱い、一時停止中のキーでは判定しない', () => {
    engine.start();
    hit('Escape', 1000);
    expect(store.getState().isPaused).toBe(true);
    hit('a', 1000);
    expect(store.getState().completedCount).toBe(0);
    hit('Escape', 1000);
    expect(store.getState().isPaused).toBe(false);
    hit('a', 1000);
    expect(store.getState().completedCount).toBe(1);
  });

  it('曲中に設定をOFFにしても、そのプレイはランキング対象外のまま', () => {
    engine.start();
    store.getState().setRhythmMode(false);
    expect(store.getState()).toMatchObject({ isRhythmMode: false, playRhythmMode: true });
    hit('a', 1000);
    hit('b', 1500);
    hit('c', 2000);
    engine.stop();
    expect(store.getState().status).toBe('clearTransition');
    store.getState().setStatus('result');
    expect(mocks.submitScore).not.toHaveBeenCalled();
  });

  it('内部精度が0の公式譜面は自動登録されない', () => {
    store.setState({ isRhythmMode: false, boothRecordByName: false });
    engine.start();
    expect(mocks.startRankedSession).toHaveBeenCalledWith('test-play-session', 'song');
    engine.stop();
    expect(store.getState().status).toBe('result');
    expect(mocks.submitScore).not.toHaveBeenCalled();
  });

  it('内部精度が1以上の場合は回数にかかわらず自動送信せず本人確認を案内する', async () => {
    store.setState({ isRhythmMode: false, playRhythmMode: false, playBoothMode: true, playBoothRecordByName: false, statsData: { stats: { fastCount: 20, lateCount: 10, totalNotes: 40 } }, status: 'playing' });
    store.getState().setStatus('result');
    expect(mocks.submitScore).not.toHaveBeenCalled();
    expect(store.getState().submitSuccessMessage).toContain('本人確認');
    store.setState({ statsData: { stats: { fastCount: 21, lateCount: 10, totalNotes: 40 } }, submitSuccessMessage: null, status: 'playing' });
    store.getState().setStatus('result');
    expect(mocks.submitScore).not.toHaveBeenCalled();
    expect(store.getState().submitSuccessMessage).toContain('本人確認');
  });

  it('リズムモードのプレイ中フラグは手動登録の対象にもならない', async () => {
    const { canSubmitRanking } = await import('../lib/rankingEligibility');
    expect(canSubmitRanking({ isLocalPlay: false, scoreFileName: 'song.json', playRhythmMode: true })).toBe(false);
    expect(canSubmitRanking({ isLocalPlay: false, scoreFileName: 'song.json', playRhythmMode: false })).toBe(true);
    expect(canSubmitRanking({ isLocalPlay: true, scoreFileName: 'song.json', playRhythmMode: false })).toBe(false);
  });

  it.each([
    { isBoothMode: false, isMobileMode: false },
    { isBoothMode: true, isMobileMode: true },
  ])('展示OFFまたはスマホでは有効にならない: %o', (mode) => {
    store.setState({ ...mode, isRhythmMode: true });
    engine.start();
    expect(store.getState().playRhythmMode).toBe(false);
  });

  it('PCの展示設定のみ変更でき、スマホや展示OFFに切り替えると解除する', () => {
    store.getState().setRhythmMode(true);
    expect(JSON.parse(storage.get('taiko_settings')).isRhythmMode).toBe(true);
    store.getState().setIsMobileMode(true);
    expect(store.getState().isRhythmMode).toBe(false);
    store.getState().setRhythmMode(true);
    expect(store.getState().isRhythmMode).toBe(false);
    store.getState().setIsMobileMode(false);
    store.getState().setRhythmMode(true);
    store.getState().setBoothMode(false);
    expect(store.getState().isRhythmMode).toBe(false);
    store.getState().setRhythmMode(true);
    expect(store.getState().isRhythmMode).toBe(false);
  });

  it('PCでは設定を復元し、スマホでは保存値がONでも無効にする', async () => {
    store.getState().setRhythmMode(true);
    vi.resetModules();
    const pcStore = (await import('../store/gameStore')).useGameStore;
    expect(pcStore.getState().isRhythmMode).toBe(true);
    storage.set('taiko_input_mode', 'mobile');
    vi.resetModules();
    const mobileStore = (await import('../store/gameStore')).useGameStore;
    expect(mobileStore.getState()).toMatchObject({ isMobileMode: true, isRhythmMode: false });
  });

  it.each(['resetPlayState', 'resetGameState'])('%s はプレイ用フラグをリセットする', (reset) => {
    store.setState({ playRhythmMode: true });
    store.getState()[reset]();
    expect(store.getState().playRhythmMode).toBe(false);
    expect(store.getState().isRhythmMode).toBe(true);
  });
});
