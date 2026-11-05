-- セッション方式のSQL適用後に実行。旧アプリは登録できなくなるため、
-- Edge Functionと新アプリの準備を終えてから切り替える。
BEGIN;
ALTER TABLE public.ranked_play_sessions ADD COLUMN IF NOT EXISTS submitted_timing jsonb;
REVOKE ALL (submitted_timing) ON public.ranked_play_sessions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finish_ranked_play_checked(
  p_session_id uuid, p_device_id text, p_player_name text, p_score numeric,
  p_perfect_count integer, p_good_count integer, p_miss_count integer,
  p_max_combo numeric, p_max_kps numeric, p_fast_count integer, p_late_count integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE play public.ranked_play_sessions%ROWTYPE; timing jsonb; result jsonb; hits bigint;
BEGIN
  hits := coalesce(p_perfect_count, -1)::bigint + coalesce(p_good_count, -1)::bigint;
  IF p_fast_count IS NULL OR p_late_count IS NULL OR p_fast_count < 0 OR p_late_count < 0
    OR p_fast_count::bigint + p_late_count::bigint = 0
    OR p_perfect_count IS NULL OR p_good_count IS NULL OR p_miss_count IS NULL OR p_max_combo IS NULL
    OR p_perfect_count < 0 OR p_good_count < 0 OR p_miss_count < 0 OR p_max_combo < 0
    OR p_max_combo::bigint > hits
    OR p_fast_count::bigint + p_late_count::bigint > hits
    OR (p_score >= 1010000 AND (p_good_count <> 0 OR p_miss_count <> 0 OR p_max_combo <> p_perfect_count OR p_perfect_count <= 0))
    OR (p_score >= 950000 AND hits >= 20 AND (p_fast_count = 0 OR p_late_count = 0 OR p_fast_count::bigint + p_late_count::bigint < hits / 2)) THEN
    RAISE EXCEPTION 'RANKING_INVALID_TIMING' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO play FROM public.ranked_play_sessions WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RANKING_SESSION_INVALID' USING ERRCODE = '22023'; END IF;
  IF NOT ((p_max_combo = 0 AND p_max_kps = 0) OR EXISTS (
    SELECT 1 FROM public.ranking_allowed_kps WHERE song_id = play.song_id AND peak_kps = round(p_max_kps, 2)
  )) THEN
    RAISE EXCEPTION 'RANKING_INVALID_CHART_KPS' USING ERRCODE = '22023';
  END IF;
  timing := jsonb_build_object('fast', p_fast_count, 'late', p_late_count);
  IF play.submitted_timing IS NOT NULL AND play.submitted_timing IS DISTINCT FROM timing THEN
    RAISE EXCEPTION 'RANKING_SESSION_PAYLOAD_CHANGED' USING ERRCODE = '22023';
  END IF;
  result := public.finish_ranked_play(p_session_id, p_device_id, p_player_name, p_score,
    p_perfect_count, p_good_count, p_miss_count, p_max_combo, p_max_kps);
  UPDATE public.ranked_play_sessions SET submitted_timing = timing WHERE session_id = p_session_id;
  RETURN result;
END $$;

-- 検証を経由しない旧完了RPCと新RPCは一般公開しない。
REVOKE ALL ON FUNCTION public.finish_ranked_play(uuid, text, text, numeric, integer, integer, integer, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_ranked_play_checked(uuid, text, text, numeric, integer, integer, integer, numeric, numeric, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_ranked_play_checked(uuid, text, text, numeric, integer, integer, integer, numeric, numeric, integer, integer) TO service_role;

-- 旧記録には譜面バージョンや操作モードがないため、現行譜面のPC・スマホ両候補を使用。
-- 絞り込みは上位10件の取得前に行い、不一致の既存行を削除しない。
CREATE OR REPLACE VIEW public.valid_rankings WITH (security_barrier = true) AS
  SELECT r.id, r.song_id, r.player_name, r.score, r.perfect_count, r.good_count,
    r.miss_count, r.max_combo, r.peak_kps, r.created_at
  FROM public.rankings r
  WHERE left(r.song_id, 9) <> '__like__:'
    AND ((r.max_combo = 0 AND r.peak_kps = 0) OR EXISTS (
      SELECT 1 FROM public.ranking_allowed_kps k WHERE k.song_id = r.song_id AND k.peak_kps = round(r.peak_kps, 2)
    ));
REVOKE ALL ON public.valid_rankings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.valid_rankings TO anon, authenticated;
COMMIT;
