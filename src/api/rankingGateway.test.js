import { describe, expect, it, vi } from 'vitest';
import { handleRankingRequest } from '../../supabase/functions/ranking-submit/handler.mjs';

const env = { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'server-secret', TURNSTILE_SECRET_KEY: 'turnstile-secret', TURNSTILE_ALLOWED_HOSTNAMES: 'game.test' };
const payload = { p_session_id: 'session', p_device_id: 'id', p_player_name: 'name', p_score: 10, p_perfect_count: 40, p_good_count: 0, p_miss_count: 0, p_max_combo: 1, p_max_kps: 1, p_fast_count: 0, p_late_count: 0 };
const request = (p, token = '') => new Request('https://example.test', { method: 'POST', body: JSON.stringify({ payload: { ...payload, ...p }, token }) });
const answer = result => new Response(JSON.stringify(result), { status: 200 });

describe('ランキング登録サーバー', () => {
  it('0回や不正値は確認も登録もしない', async () => {
    const fetcher = vi.fn();
    expect(await (await handleRankingRequest(request({}), env, fetcher)).json()).toMatchObject({ ok: false, code: 'RANKING_ZERO_TIMING' });
    expect(await (await handleRankingRequest(request({ p_fast_count: 41 }), env, fetcher)).json()).toMatchObject({ ok: false, code: 'RANKING_INVALID_TIMING' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('1回以上はすべてトークンが必要で、サイトと用途を照合する', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(answer({ success: true, hostname: 'wrong.test', action: 'ranking_submit' }));
    expect(await (await handleRankingRequest(request({ p_fast_count: 30 }), env, fetcher)).json()).toMatchObject({ code: 'RANKING_VERIFICATION_REQUIRED' });
    expect(await (await handleRankingRequest(request({ p_fast_count: 31 }), env, fetcher)).json()).toMatchObject({ code: 'RANKING_VERIFICATION_REQUIRED' });
    expect(await (await handleRankingRequest(request({ p_fast_count: 31 }, 'token'), env, fetcher)).json()).toMatchObject({ code: 'RANKING_VERIFICATION_FAILED' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('回数にかかわらず検証成功後のみDBへ送る', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(answer({ success: true, hostname: 'game.test', action: 'ranking_submit' }))
      .mockResolvedValueOnce(answer({ updated: true }))
      .mockResolvedValueOnce(answer({ success: true, hostname: 'game.test', action: 'ranking_submit' }))
      .mockResolvedValueOnce(answer({ updated: true }));
    expect(await (await handleRankingRequest(request({ p_fast_count: 1 }, 'token'), env, fetcher)).json()).toMatchObject({ ok: true });
    expect(fetcher.mock.calls[1][0]).toContain('finish_ranked_play_checked');
    expect(await (await handleRankingRequest(request({ p_fast_count: 31 }, 'token-31'), env, fetcher)).json()).toMatchObject({ ok: true });
    expect(fetcher.mock.calls[3][0]).toContain('finish_ranked_play_checked');
  });
  it('鍵がない場合は安全側で拒否する', async () => {
    const fetcher = vi.fn();
    expect(await (await handleRankingRequest(request({ p_fast_count: 1 }, 'token'), { ...env, TURNSTILE_SECRET_KEY: '' }, fetcher)).json()).toMatchObject({ code: 'RANKING_VERIFICATION_UNAVAILABLE' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
