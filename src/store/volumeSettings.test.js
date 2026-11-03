import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/csvExport', () => ({
  getLocalPlayLogs: () => [],
  savePlayLogToLocal: vi.fn(),
  fetchMergedPlayLogs: vi.fn(),
  clearPlayLogs: vi.fn(),
}));
vi.mock('../api/likes', () => ({
  getLocalSongLikesMap: () => ({}),
  fetchGlobalSongLikes: vi.fn(),
  updateSongLikeCount: vi.fn(),
  normalizeSongId: vi.fn(),
}));

let storage;

beforeEach(() => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('展示ブースの記録方法', () => {
  it.each([null, '{}', '{invalid'])('未設定や不正な設定では名前ごとの自己ベストを選ぶ: %s', async (saved) => {
    if (saved !== null) storage.set('taiko_settings', saved);
    const { useGameStore } = await import('./gameStore');
    expect(useGameStore.getState().boothRecordByName).toBe(true);
  });

  it.each([true, false])('保存済みの選択を維持する: %s', async (saved) => {
    storage.set('taiko_settings', JSON.stringify({ boothRecordByName: saved }));
    const { useGameStore } = await import('./gameStore');
    expect(useGameStore.getState().boothRecordByName).toBe(saved);
  });
});

describe('volume settings', () => {
  it('defaults to full volume for existing settings without volume values', async () => {
    storage.set('taiko_settings', JSON.stringify({ speedMultiplier: 4, speedScaleVersion: 2 }));
    const { useGameStore } = await import('./gameStore');
    expect(useGameStore.getState()).toMatchObject({ musicVolume: 1, gameplaySeVolume: 1, systemSeVolume: 1 });
  });

  it('persists independent values through other setting changes and restores them', async () => {
    const { useGameStore } = await import('./gameStore');
    const state = useGameStore.getState();
    state.setMusicVolume(0.25);
    state.setGameplaySeVolume(0);
    state.setSystemSeVolume(0.75);
    state.setSpeedMultiplier(6);

    vi.resetModules();
    const reloaded = await import('./gameStore');
    expect(reloaded.useGameStore.getState()).toMatchObject({
      musicVolume: 0.25, gameplaySeVolume: 0, systemSeVolume: 0.75, speedMultiplier: 6,
    });
  });

  it('clamps invalid stored values before they reach audio APIs', async () => {
    storage.set('taiko_settings', JSON.stringify({ musicVolume: -1, gameplaySeVolume: 3, systemSeVolume: 'bad' }));
    const { useGameStore } = await import('./gameStore');
    expect(useGameStore.getState()).toMatchObject({ musicVolume: 0, gameplaySeVolume: 1, systemSeVolume: 1 });
  });
});
