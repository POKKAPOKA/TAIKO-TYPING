import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), update: vi.fn() }));
vi.mock('../utils/csvExport', () => ({
  getLocalPlayLogs: () => [], savePlayLogToLocal: vi.fn(),
  fetchMergedPlayLogs: vi.fn(), clearPlayLogs: vi.fn(),
}));
vi.mock('../api/likes', () => ({
  getLocalSongLikesMap: () => ({}), fetchGlobalSongLikes: mocks.fetch,
  updateSongLikeCount: mocks.update, normalizeSongId: value => value.replace(/\.json$/i, ''),
}));
import { useGameStore } from './gameStore';

describe('いいねの更新と一覧取得', () => {
  it('送信中に古い一覧が届いても操作中の数を維持する', async () => {
    let finishFetch;
    let finishUpdate;
    mocks.fetch.mockReturnValue(new Promise(resolve => { finishFetch = resolve; }));
    mocks.update.mockReturnValue(new Promise(resolve => { finishUpdate = resolve; }));
    useGameStore.setState({ scoreFileName: 'song.json', currentPlaySessionId: 'play', songLikesMap: { song: 4 }, hasLikedCurrentResult: false, isLikingSong: false });

    const refresh = useGameStore.getState().refreshSongLikes();
    const toggle = useGameStore.getState().toggleCurrentSongLike();
    finishFetch({ song: 4 });
    await refresh;
    expect(useGameStore.getState().songLikesMap.song).toBe(5);

    finishUpdate({ song: 5 });
    await toggle;
    expect(useGameStore.getState()).toMatchObject({ songLikesMap: { song: 5 }, hasLikedCurrentResult: true, isLikingSong: false });
  });
});
