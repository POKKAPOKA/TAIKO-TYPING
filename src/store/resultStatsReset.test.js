import { describe, expect, it, vi } from 'vitest';

vi.mock('../utils/csvExport', () => ({ getLocalPlayLogs: () => [], savePlayLogToLocal: vi.fn(), fetchMergedPlayLogs: vi.fn(), clearPlayLogs: vi.fn() }));
vi.mock('../api/likes', () => ({ getLocalSongLikesMap: () => ({}), fetchGlobalSongLikes: vi.fn(), updateSongLikeCount: vi.fn(), normalizeSongId: vi.fn() }));
import { useGameStore } from './gameStore';

describe('リザルト用カウントのリセット', () => {
  it.each(['resetPlayState', 'resetGameState'])('%s で新しいプレイに持ち越さない', action => {
    useGameStore.setState({ fastCount: 3, lateCount: 2, untypedCount: 1 });
    useGameStore.getState()[action]();
    expect(useGameStore.getState()).toMatchObject({ fastCount: 0, lateCount: 0, untypedCount: 0 });
  });
});
