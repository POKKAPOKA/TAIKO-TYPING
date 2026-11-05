const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' },
});

// 秘密鍵とservice_roleはこのサーバー側関数内でのみ使用する。
export async function handleRankingRequest(request, env, fetcher = fetch) {
  if (request.method === 'OPTIONS') return json({}, 200);
  if (request.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, code: 'INVALID_REQUEST' }); }
  const p = body?.payload;
  const fast = p?.p_fast_count, late = p?.p_late_count;
  const hits = (p?.p_perfect_count ?? -1) + (p?.p_good_count ?? -1);
  if (!Number.isSafeInteger(fast) || fast < 0 || !Number.isSafeInteger(late) || late < 0 ||
      !Number.isSafeInteger(fast + late) || !Number.isSafeInteger(p?.p_perfect_count) || !Number.isSafeInteger(p?.p_good_count) ||
      !Number.isSafeInteger(p?.p_miss_count) || !Number.isSafeInteger(p?.p_max_combo) ||
      typeof p?.p_score !== 'number' || !Number.isFinite(p.p_score) || p.p_score < 0 || p.p_score > 1010000 ||
      p.p_perfect_count < 0 || p.p_good_count < 0 || p.p_miss_count < 0 || p.p_max_combo < 0 ||
      p.p_max_combo > hits || fast + late > hits) {
    return json({ ok: false, code: 'RANKING_INVALID_TIMING' });
  }
  if (fast + late === 0) return json({ ok: false, code: 'RANKING_ZERO_TIMING' });
  if (p.p_score === 1010000 && (p.p_good_count !== 0 || p.p_miss_count !== 0 || p.p_max_combo !== p.p_perfect_count || p.p_perfect_count <= 0)) {
    return json({ ok: false, code: 'RANKING_INVALID_TIMING' });
  }
  if (p.p_score >= 950000 && hits >= 20 && (fast === 0 || late === 0 || fast + late < Math.floor(hits * 0.5))) {
    return json({ ok: false, code: 'RANKING_INVALID_TIMING' });
  }
  const hosts = (env.TURNSTILE_ALLOWED_HOSTNAMES || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!env.TURNSTILE_SECRET_KEY || !hosts.length) return json({ ok: false, code: 'RANKING_VERIFICATION_UNAVAILABLE' });
  if (typeof body.token !== 'string' || !body.token || body.token.length > 2048) return json({ ok: false, code: 'RANKING_VERIFICATION_REQUIRED' });
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: body.token }),
    });
    const checked = await response.json();
    if (!response.ok || !checked.success || checked.action !== 'ranking_submit' || !hosts.includes(String(checked.hostname || '').toLowerCase())) {
      return json({ ok: false, code: 'RANKING_VERIFICATION_FAILED' });
    }
  } catch { return json({ ok: false, code: 'RANKING_VERIFICATION_UNAVAILABLE' }); }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, code: 'RANKING_SERVICE_UNAVAILABLE' });
  const fields = ['p_session_id', 'p_device_id', 'p_player_name', 'p_score', 'p_perfect_count', 'p_good_count', 'p_miss_count', 'p_max_combo', 'p_max_kps', 'p_fast_count', 'p_late_count'];
  const payload = Object.fromEntries(fields.map(key => [key, p[key]]));
  try {
    const response = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/finish_ranked_play_checked`, {
      method: 'POST', headers: { 'content-type': 'application/json', apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      const known = ['RANKING_SESSION_TOO_EARLY', 'RANKING_SESSION_EXPIRED', 'RANKING_SESSION_INVALID', 'RANKING_SESSION_PAYLOAD_CHANGED', 'RANKING_ZERO_KPS_WITH_COMBO', 'RANKING_NOTE_LIMIT_EXCEEDED', 'RANKING_SONG_LIMIT_NOT_CONFIGURED', 'RANKING_INVALID_TIMING', 'RANKING_INVALID_CHART_KPS'];
      return json({ ok: false, code: known.find(code => String(result?.message || '').includes(code)) || 'RANKING_SUBMIT_FAILED' });
    }
    return json({ ok: true, result });
  } catch { return json({ ok: false, code: 'RANKING_SERVICE_UNAVAILABLE' }); }
}
