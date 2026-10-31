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
    const result = await submitScore({ songId: 'song', deviceId: 'play-1', playerName: ' Alice ', score: 900, maxCombo: 5, maxKps: 2, perfectCount: 3, goodCount: 1, missCount: 1 });
    expect(rpc).toHaveBeenCalledWith('submit_ranking_score', {
      p_song_id: 'song', p_device_id: 'play-1', p_player_name: 'Alice', p_score: 900,
      p_max_combo: 5, p_max_kps: 2, p_perfect_count: 3, p_good_count: 1, p_miss_count: 1,
    });
    expect(from).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, updated: true, isNewBest: true });
  });

  it('uses the fixed identifier outside booth mode and reports a name-only change', async () => {
    rpc.mockResolvedValue({ data: { updated: true, is_new_best: false }, error: null });
    const result = await submitScore({ songId: 'song', playerName: 'Alice', score: 100 });
    expect(rpc.mock.calls[0][1].p_device_id).toBe('fixed-device');
    expect(result.message).toContain('プレイヤー名');
  });

  it('propagates RPC errors and continues accepting later submissions', async () => {
    const error = new Error('RPC failed');
    rpc.mockResolvedValueOnce({ data: null, error });
    await expect(submitScore({ songId: 'song', score: 1 })).rejects.toBe(error);
    await expect(submitScore({ songId: 'song', score: 2 })).resolves.toMatchObject({ success: true });
  });

  it('requests only public columns for ranking lists', async () => {
    const query = { select, eq: vi.fn(), order: vi.fn(), limit: vi.fn() };
    select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [], error: null });
    from.mockReturnValue(query);
    await fetchRankings('song');
    expect(select.mock.calls[0][0]).not.toContain('device_id');
    expect(select.mock.calls[0][0]).not.toBe('*');
  });
});
