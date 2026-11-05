import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from, select } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), select: vi.fn() }));
vi.mock('../lib/deviceId', () => ({ getDeviceId: () => 'fixed-device' }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc, from, functions: {
  invoke: async (_name, options) => {
    const result = await rpc('finish_ranked_play', options.body.payload);
    return result.error ? { data: null, error: result.error } : { data: { ok: true, result: result.data }, error: null };
  },
} } }));
import { fetchRankings, submitScore } from './rankings';
import { getRankedSession, startRankedSession } from './rankedSession';

const playSessionId = 'client-play-id';
const payload = (extra = {}) => ({ songId: 'song', playSessionId, totalNotes: 32, fastCount: 31, lateCount: 0, verificationToken: 'token', ...extra });
async function startSession(songId = 'song') {
  startRankedSession(playSessionId, songId);
  await getRankedSession(playSessionId, songId).promise;
  rpc.mockClear();
}

beforeEach(async () => {
  vi.clearAllMocks();
  rpc.mockImplementation(async (name) => name === 'start_ranked_play'
    ? { data: { session_id: 'server-session' }, error: null }
    : { data: { id: 'record', score: 900, updated: true, is_new_best: true }, error: null });
  await startSession();
});

describe('ranking RPC', () => {
  it('開始待ちの送信を完了まで保留し、同じプレイの名前変更に同じセッションとIDを使う', async () => {
    let finishStart;
    rpc.mockImplementationOnce(() => new Promise(resolve => { finishStart = resolve; }));
    startRankedSession(playSessionId, 'song');
    await Promise.resolve();
    const first = submitScore(payload({ deviceId: 'booth-id', playerName: 'Guest' }));
    await Promise.resolve();
    expect(rpc).toHaveBeenCalledTimes(1);
    finishStart({ data: { session_id: 'one-session' }, error: null });
    await first;
    await submitScore(payload({ deviceId: 'changed-name-id', playerName: 'Alice' }));
    expect(rpc.mock.calls.slice(1).map(([, args]) => [args.p_session_id, args.p_device_id, args.p_player_name])).toEqual([
      ['one-session', 'booth-id', 'Guest'], ['one-session', 'booth-id', 'Alice'],
    ]);
  });

  it('開始できなかったプレイや異なるプレイはランキングに送信しない', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    startRankedSession(playSessionId, 'song');
    await expect(submitScore(payload())).rejects.toMatchObject({ code: 'RANKING_SESSION_ERROR' });
    await expect(submitScore(payload({ playSessionId: 'other-play' }))).rejects.toMatchObject({ code: 'RANKING_SESSION_ERROR' });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['start_ranked_play']);
  });

  it('受付時間前の場合は登録ボタンで再試行できるよう案内する', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RANKING_SESSION_TOO_EARLY' } });
    await expect(submitScore(payload())).rejects.toMatchObject({ code: 'RANKING_SESSION_ERROR', message: expect.stringContaining('しばらく') });
    await expect(submitScore(payload())).resolves.toMatchObject({ success: true });
  });

  it('sends the play session identifier and normalized score without direct table writes', async () => {
    const result = await submitScore(payload({ deviceId: 'play-1', playerName: ' Alice ', score: 900, maxCombo: 5, maxKps: 2, perfectCount: 3, goodCount: 1, missCount: 1, totalNotes: 5 }));
    expect(rpc).toHaveBeenCalledWith('finish_ranked_play', {
      p_session_id: 'server-session', p_device_id: 'play-1', p_player_name: 'Alice', p_score: 900,
      p_max_combo: 5, p_max_kps: 2, p_perfect_count: 3, p_good_count: 1, p_miss_count: 1, p_fast_count: 31, p_late_count: 0,
    });
    expect(from).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, updated: true, isNewBest: true });
  });

  it('uses the fixed identifier outside booth mode and reports a name-only change', async () => {
    rpc.mockResolvedValue({ data: { updated: true, is_new_best: false }, error: null });
    const result = await submitScore(payload({ playerName: 'Alice', score: 100 }));
    expect(rpc.mock.calls[0][1].p_device_id).toBe('fixed-device');
    expect(result.message).toContain('プレイヤー名');
  });

  it('propagates RPC errors and continues accepting later submissions', async () => {
    const error = new Error('RPC failed');
    rpc.mockResolvedValueOnce({ data: null, error });
    await expect(submitScore(payload({ score: 1 }))).rejects.toBe(error);
    await expect(submitScore(payload({ score: 2 }))).resolves.toMatchObject({ success: true });
  });

  it('譜面のノーツ数を超える最大コンボ・判定数や上限不明の記録は送信しない', async () => {
    await startSession('kimigayo');
    for (const stats of [
      { totalNotes: 32, maxCombo: 61, perfectCount: 32 },
      { totalNotes: 32, maxCombo: 32, perfectCount: 31, goodCount: 1, missCount: 1 },
      { maxCombo: 32 },
    ]) {
      await expect(submitScore({ songId: 'kimigayo', playSessionId, fastCount: 31, lateCount: 0, score: 1010000, ...stats })).rejects.toMatchObject({ code: 'RANKING_INVALID_NOTE_COUNT', message: expect.stringContaining('警告') });
    }
    expect(rpc).not.toHaveBeenCalled();
    await expect(submitScore({ songId: 'kimigayo', playSessionId, fastCount: 31, lateCount: 0, verificationToken: 'token', score: 1010000, totalNotes: 32, maxCombo: 32, perfectCount: 32, maxKps: 2 })).resolves.toMatchObject({ success: true });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it.each(['RANKING_NOTE_LIMIT_EXCEEDED', 'RANKING_SONG_LIMIT_NOT_CONFIGURED'])('DB側の%sを利用者向けの警告に変換する', async (message) => {
    await startSession('kimigayo');
    rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message } });
    await expect(submitScore({ songId: 'kimigayo', playSessionId, fastCount: 31, lateCount: 0, verificationToken: 'token', score: 100, totalNotes: 32 })).rejects.toMatchObject({ code: 'RANKING_INVALID_NOTE_COUNT', message: expect.stringContaining('警告') });
  });

  it('コンボが1以上でKPSが0の記録を登録せず、コンボ0は登録できる', async () => {
    await expect(submitScore(payload({ score: 100, maxCombo: 1, maxKps: 0 }))).rejects.toMatchObject({ code: 'RANKING_INVALID_KPS', message: expect.stringContaining('警告') });
    expect(rpc).not.toHaveBeenCalled();
    await expect(submitScore(payload({ score: 0, maxCombo: 0, maxKps: 0 }))).resolves.toMatchObject({ success: true });
  });

  it('DB側のKPS制限エラーを警告に変換する', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'RANKING_ZERO_KPS_WITH_COMBO' } });
    await expect(submitScore(payload({ maxCombo: 1, maxKps: 1 }))).rejects.toMatchObject({ code: 'RANKING_INVALID_KPS' });
  });

  it('内部精度が0なら送信せず、1以上はすべて本人確認を要求する', async () => {
    await expect(submitScore(payload({ fastCount: 0, lateCount: 0, verificationToken: '' }))).rejects.toMatchObject({ code: 'RANKING_INVALID_TIMING' });
    await expect(submitScore(payload({ fastCount: 30, lateCount: 0, verificationToken: '' }))).rejects.toMatchObject({ code: 'RANKING_VERIFICATION_REQUIRED' });
    await expect(submitScore(payload({ fastCount: 31, lateCount: 0, verificationToken: '' }))).rejects.toMatchObject({ code: 'RANKING_VERIFICATION_REQUIRED' });
    expect(rpc).not.toHaveBeenCalled();
    await expect(submitScore(payload({ fastCount: 30, lateCount: 0, verificationToken: 'token' }))).resolves.toMatchObject({ success: true });
    await expect(submitScore(payload({ fastCount: 31, lateCount: 0, verificationToken: 'token' }))).resolves.toMatchObject({ success: true });
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
