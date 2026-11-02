import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from, select } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), select: vi.fn() }));
vi.mock('../lib/deviceId', () => ({ getDeviceId: () => 'fixed-device' }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc, from } }));
import { fetchRankings, submitScore } from './rankings';

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { id: 'record', score: 900, updated: true, is_new_best: true }, error: null });
});

describe('ranking RPC', () => {
  it('sends the play session identifier and normalized score without direct table writes', async () => {
    const result = await submitScore({ songId: 'song', deviceId: 'play-1', playerName: ' Alice ', score: 900, maxCombo: 5, maxKps: 2, perfectCount: 3, goodCount: 1, missCount: 1, totalNotes: 5 });
    expect(rpc).toHaveBeenCalledWith('submit_ranking_score', {
      p_song_id: 'song', p_device_id: 'play-1', p_player_name: 'Alice', p_score: 900,
      p_max_combo: 5, p_max_kps: 2, p_perfect_count: 3, p_good_count: 1, p_miss_count: 1,
    });
    expect(from).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, updated: true, isNewBest: true });
  });

  it('uses the fixed identifier outside booth mode and reports a name-only change', async () => {
    rpc.mockResolvedValue({ data: { updated: true, is_new_best: false }, error: null });
    const result = await submitScore({ songId: 'song', playerName: 'Alice', score: 100, totalNotes: 32 });
    expect(rpc.mock.calls[0][1].p_device_id).toBe('fixed-device');
    expect(result.message).toContain('プレイヤー名');
  });

  it('propagates RPC errors and continues accepting later submissions', async () => {
    const error = new Error('RPC failed');
    rpc.mockResolvedValueOnce({ data: null, error });
    await expect(submitScore({ songId: 'song', score: 1, totalNotes: 32 })).rejects.toBe(error);
    await expect(submitScore({ songId: 'song', score: 2, totalNotes: 32 })).resolves.toMatchObject({ success: true });
  });

  it('譜面のノーツ数を超える最大コンボ・判定数や上限不明の記録は送信しない', async () => {
    for (const stats of [
      { totalNotes: 32, maxCombo: 61, perfectCount: 32 },
      { totalNotes: 32, maxCombo: 32, perfectCount: 31, goodCount: 1, missCount: 1 },
      { maxCombo: 32 },
    ]) {
      await expect(submitScore({ songId: 'kimigayo', score: 1010000, ...stats })).rejects.toMatchObject({ code: 'RANKING_INVALID_NOTE_COUNT', message: expect.stringContaining('警告') });
    }
    expect(rpc).not.toHaveBeenCalled();
    await expect(submitScore({ songId: 'kimigayo', score: 1010000, totalNotes: 32, maxCombo: 32, perfectCount: 32, maxKps: 2 })).resolves.toMatchObject({ success: true });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it.each(['RANKING_NOTE_LIMIT_EXCEEDED', 'RANKING_SONG_LIMIT_NOT_CONFIGURED'])('DB側の%sを利用者向けの警告に変換する', async (message) => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message } });
    await expect(submitScore({ songId: 'kimigayo', score: 100, totalNotes: 32 })).rejects.toMatchObject({ code: 'RANKING_INVALID_NOTE_COUNT', message: expect.stringContaining('警告') });
  });

  it('コンボが1以上でKPSが0の記録を登録せず、コンボ0は登録できる', async () => {
    await expect(submitScore({ songId: 'song', score: 100, totalNotes: 32, maxCombo: 1, maxKps: 0 })).rejects.toMatchObject({ code: 'RANKING_INVALID_KPS', message: expect.stringContaining('警告') });
    expect(rpc).not.toHaveBeenCalled();
    await expect(submitScore({ songId: 'song', score: 0, totalNotes: 32, maxCombo: 0, maxKps: 0 })).resolves.toMatchObject({ success: true });
  });

  it('DB側のKPS制限エラーを警告に変換する', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'RANKING_ZERO_KPS_WITH_COMBO' } });
    await expect(submitScore({ songId: 'song', totalNotes: 32, maxCombo: 1, maxKps: 1 })).rejects.toMatchObject({ code: 'RANKING_INVALID_KPS' });
  });

  it('KPSが0でコンボが1以上の順位を除外して順位を振り直す', async () => {
    const query = { select, eq: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn() };
    select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.or.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [
      { player_name: '除外', max_combo: 1, peak_kps: 0, score: 100 },
      { player_name: '通常', max_combo: 1, peak_kps: 2, score: 90 },
      { player_name: 'コンボなし', max_combo: 0, peak_kps: 0, score: 0 },
    ], error: null });
    from.mockReturnValue(query);
    const result = await fetchRankings('song');
    expect(query.or).toHaveBeenCalledWith('max_combo.lt.1,peak_kps.neq.0');
    expect(result.map(({ playerName, rank }) => [playerName, rank])).toEqual([['通常', 1], ['コンボなし', 2]]);
  });

  it('requests only public columns for ranking lists', async () => {
    const query = { select, eq: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn() };
    select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.or.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [], error: null });
    from.mockReturnValue(query);
    await fetchRankings('song');
    expect(select.mock.calls[0][0]).not.toContain('device_id');
    expect(select.mock.calls[0][0]).not.toBe('*');
    expect(query.or).toHaveBeenCalledWith('max_combo.lt.1,peak_kps.neq.0');
  });
});
