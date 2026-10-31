import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('../lib/deviceId', () => ({ getDeviceId: () => 'my-device' }));
import { fetchGlobalSongLikes, getLocalSongLikesMap, getSongLikeStatus, updateSongLikeCount } from './likes';

beforeEach(() => {
  const storage = new Map();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  });
  rpc.mockReset();
});

describe('いいね RPC', () => {
  it('取得は集計RPCを使い、キャッシュには曲ごとの集計だけを保存する', async () => {
    rpc.mockResolvedValue({ data: { song: 4 }, error: null });
    expect(await fetchGlobalSongLikes()).toEqual({ song: 4 });
    expect(rpc).toHaveBeenCalledWith('get_song_like_totals');
    expect(getLocalSongLikesMap()).toEqual({ song: 4 });
  });

  it('追加と取消は曲と自端末だけを指定し、返却された集計を使う', async () => {
    rpc.mockResolvedValueOnce({ data: { total_count: 5, device_count: 2, liked: true }, error: null })
      .mockResolvedValueOnce({ data: { total_count: 4, device_count: 1, liked: true }, error: null });
    expect(await updateSongLikeCount('song.json', true)).toEqual({ song: 5 });
    expect(rpc).toHaveBeenNthCalledWith(1, 'update_song_like', { p_song_id: 'song', p_device_id: 'my-device', p_delta: 1 });
    expect(await updateSongLikeCount('song.json', false)).toEqual({ song: 4 });
    expect(rpc).toHaveBeenNthCalledWith(2, 'update_song_like', { p_song_id: 'song', p_device_id: 'my-device', p_delta: -1 });
  });

  it('失敗を呼び出し元に返し、未送信のいいねを成功として保存しない', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('offline') });
    await expect(updateSongLikeCount('song', true)).rejects.toThrow('offline');
    expect(getLocalSongLikesMap()).toEqual({});
  });

  it('自端末の状態は専用RPCで取得する', async () => {
    rpc.mockResolvedValue({ data: { total_count: 2, device_count: 1, liked: true }, error: null });
    expect(await getSongLikeStatus('song')).toMatchObject({ liked: true });
    expect(rpc).toHaveBeenCalledWith('get_song_like_status', { p_song_id: 'song', p_device_id: 'my-device' });
  });

  it('登録より前の一覧応答が遅れても、新しいいいね数を維持する', async () => {
    let resolveOldList;
    rpc.mockReturnValueOnce(new Promise(resolve => { resolveOldList = resolve; }))
      .mockResolvedValueOnce({ data: { total_count: 5, device_count: 1 }, error: null });
    const oldList = fetchGlobalSongLikes();
    await updateSongLikeCount('song', true);
    resolveOldList({ data: { song: 4 }, error: null });
    expect(await oldList).toEqual({ song: 5 });
    expect(getLocalSongLikesMap()).toEqual({ song: 5 });
  });

  it('新しい一覧取得が先に完了したときは古い応答を無視する', async () => {
    let resolveOldList;
    rpc.mockReturnValueOnce(new Promise(resolve => { resolveOldList = resolve; }))
      .mockResolvedValueOnce({ data: { song: 8 }, error: null });
    const oldList = fetchGlobalSongLikes();
    await fetchGlobalSongLikes();
    resolveOldList({ data: { song: 7 }, error: null });
    expect(await oldList).toEqual({ song: 8 });
  });

  it('集計値が欠落した応答を成功として保存しない', async () => {
    rpc.mockResolvedValue({ data: { total_count: null, device_count: 1 }, error: null });
    await expect(updateSongLikeCount('song', true)).rejects.toThrow('いいねの応答が不正です');
    expect(getLocalSongLikesMap()).toEqual({});
  });
});
