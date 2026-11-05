import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/csvExport', () => ({ getLocalPlayLogs: () => [], savePlayLogToLocal: vi.fn(), fetchMergedPlayLogs: vi.fn(), clearPlayLogs: vi.fn() }));
vi.mock('../api/likes', () => ({ getLocalSongLikesMap: () => ({}), fetchGlobalSongLikes: vi.fn(), updateSongLikeCount: vi.fn(), normalizeSongId: vi.fn() }));

let storage;
beforeEach(() => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal('localStorage', { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) });
});
afterEach(() => vi.unstubAllGlobals());

describe('ノーツ文字サイズ設定', () => {
  it.each([null, '{}', '{bad'])('保存なし・不正な保存では1.00を使う: %s', async (saved) => {
    if (saved !== null) storage.set('taiko_settings', saved);
    const { useGameStore } = await import('./gameStore');
    expect(useGameStore.getState().noteTextScale).toBe(1);
  });

  it('0.50〜3.00に収めて小数第2位に丸め、不正値は標準に戻す', async () => {
    const { useGameStore } = await import('./gameStore');
    const set = value => useGameStore.getState().setNoteTextScale(value);
    for (const [input, expected] of [[0, 0.5], [3.9, 3], [1.234, 1.23], [Infinity, 1], [NaN, 1]]) {
      set(input);
      expect(useGameStore.getState().noteTextScale).toBe(expected);
    }
  });

  it('他の設定を変更した後も保存され、再読み込みして復元できる', async () => {
    const { useGameStore } = await import('./gameStore');
    useGameStore.getState().setNoteTextScale(2.37);
    useGameStore.getState().setSpeedMultiplier(5);
    vi.resetModules();
    const reloaded = await import('./gameStore');
    expect(reloaded.useGameStore.getState()).toMatchObject({ noteTextScale: 2.37, speedMultiplier: 5 });
  });

  it('保存済みの範囲外値も安全な値に収める', async () => {
    storage.set('taiko_settings', JSON.stringify({ noteTextScale: 9 }));
    const { useGameStore } = await import('./gameStore');
    expect(useGameStore.getState().noteTextScale).toBe(3);
  });
});
