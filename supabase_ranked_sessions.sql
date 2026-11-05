-- ランキング用の開始・完了 RPC。既存のランキングやいいねは削除しない。
-- 適用順: supabase_security_fix.sql → supabase_ranking_note_limits.sql → この SQL。
-- フロントエンドも同時に更新すること。適用後は旧 submit_ranking_score の直接実行は拒否される。
-- 以降、上記の旧 SQL を再実行した場合は、この SQL も最後に再実行すること。
--
-- これは既知の旧 RPC への直接送信と、即時の連続投稿を防ぐ対策であり、
-- 公開クライアントからの開始後に待って偽の成績を送る攻撃を防ぐものではない。
-- 強い保証にはサーバー側での入力検証等と、別途ネットワーク側のレート制限が必要。
BEGIN;

CREATE TABLE IF NOT EXISTS public.ranked_play_song_durations (
  song_id text PRIMARY KEY,
  min_seconds integer NOT NULL CHECK (min_seconds > 0)
);
ALTER TABLE public.ranked_play_song_durations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ranked_play_song_durations FROM PUBLIC, anon, authenticated;
REVOKE ALL (song_id, min_seconds) ON public.ranked_play_song_durations FROM PUBLIC, anon, authenticated;

-- 2026-11-02 時点の音源長と public/songs/index.json の時間の短い方の 80% 未満。
-- 完走の誤拒否を避けるため余裕を持たせている。単位は秒。
-- 公式曲の音源を変更した場合は、その曲の値を見直す。
-- 新曲を ranking_note_limits に登録すれば、ここに無くても待機時間 0 秒で利用できる。
-- 待機時間を設けたい新曲だけ、この表に安全な秒数を追加する。
INSERT INTO public.ranked_play_song_durations (song_id, min_seconds) VALUES
  ('kimigayo', 51),
  ('senrohatudukuyodokomademo', 31),
  ('harugakita', 44),
  ('koinobori', 20),
  ('usagitokame', 50),
  ('sakura', 42),
  ('alps', 31),
  ('hotarunohikari', 176),
  ('kirakira', 28),
  ('shiningstar', 69),
  ('donguri', 30),
  ('taipatime', 71),
  ('taipatime_rhythm', 71)
ON CONFLICT (song_id) DO UPDATE SET min_seconds = EXCLUDED.min_seconds;

CREATE TABLE IF NOT EXISTS public.ranked_play_sessions (
  session_id uuid PRIMARY KEY,
  song_id text NOT NULL,
  not_before timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  -- 完了後は、名前を除く元の送信内容を固定する。公開しない。
  submitted_payload jsonb
);
CREATE INDEX IF NOT EXISTS ranked_play_sessions_expires_at_idx
  ON public.ranked_play_sessions (expires_at);
ALTER TABLE public.ranked_play_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ranked_play_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL (session_id, song_id, not_before, expires_at, submitted_payload)
  ON public.ranked_play_sessions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_ranked_play(p_song_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  duration_seconds integer;
  new_session_id uuid := gen_random_uuid();
  started_at timestamptz := clock_timestamp();
  available_at timestamptz;
  valid_until timestamptz;
BEGIN
  SELECT coalesce(durations.min_seconds, 0) INTO duration_seconds
    FROM public.ranking_note_limits AS limits
    LEFT JOIN public.ranked_play_song_durations AS durations ON durations.song_id = limits.song_id
    WHERE limits.song_id = p_song_id;
  IF duration_seconds IS NULL THEN
    RAISE EXCEPTION 'RANKING_SONG_NOT_CONFIGURED' USING ERRCODE = '22023';
  END IF;

  -- 利用期限を過ぎた情報を小分けに削除する。大量作成自体は別途レート制限が必要。
  DELETE FROM public.ranked_play_sessions
    WHERE session_id IN (
      SELECT session_id FROM public.ranked_play_sessions
      WHERE expires_at < started_at ORDER BY expires_at LIMIT 100
    );
  available_at := started_at + make_interval(secs => duration_seconds);
  valid_until := available_at + interval '15 minutes';
  INSERT INTO public.ranked_play_sessions (session_id, song_id, not_before, expires_at)
    VALUES (new_session_id, p_song_id, available_at, valid_until);
  RETURN jsonb_build_object(
    'session_id', new_session_id, 'not_before', available_at, 'expires_at', valid_until
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_ranked_play(
  p_session_id uuid, p_device_id text, p_player_name text, p_score numeric,
  p_perfect_count integer, p_good_count integer, p_miss_count integer,
  p_max_combo numeric, p_max_kps numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  play public.ranked_play_sessions%ROWTYPE;
  payload jsonb;
  result jsonb;
  current_time_value timestamptz;
BEGIN
  -- 同じセッションの並行完了を直列化し、スコア更新とセッション消費を同一取引にする。
  SELECT * INTO play FROM public.ranked_play_sessions
    WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RANKING_SESSION_INVALID' USING ERRCODE = '22023';
  END IF;
  current_time_value := clock_timestamp();
  IF current_time_value < play.not_before THEN
    RAISE EXCEPTION 'RANKING_SESSION_TOO_EARLY' USING ERRCODE = '22023';
  END IF;
  IF current_time_value >= play.expires_at THEN
    RAISE EXCEPTION 'RANKING_SESSION_EXPIRED' USING ERRCODE = '22023';
  END IF;

  payload := jsonb_build_object(
    'device_id', p_device_id, 'score', p_score,
    'perfect_count', p_perfect_count, 'good_count', p_good_count,
    'miss_count', p_miss_count, 'max_combo', p_max_combo, 'max_kps', p_max_kps
  );
  IF play.submitted_payload IS NOT NULL AND play.submitted_payload IS DISTINCT FROM payload THEN
    RAISE EXCEPTION 'RANKING_SESSION_PAYLOAD_CHANGED' USING ERRCODE = '22023';
  END IF;

  -- 同一内容の再送は Guest 自動登録後の名前変更のため許可する。
  -- 検証や書き込みが失敗すると、消費状態も含めてトランザクション全体が戻る。
  result := public.submit_ranking_score(
    play.song_id, p_device_id, p_player_name, p_score,
    p_perfect_count, p_good_count, p_miss_count, p_max_combo, p_max_kps
  );
  IF play.submitted_payload IS NULL THEN
    UPDATE public.ranked_play_sessions SET submitted_payload = payload
      WHERE session_id = p_session_id;
  END IF;
  RETURN result;
END;
$$;

-- SECURITY DEFINER の所有者は旧関数を内部から実行できるが、公開ロールには許可しない。
REVOKE ALL ON FUNCTION public.submit_ranking_score(text, text, text, numeric, integer, integer, integer, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_ranked_play(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_ranked_play(uuid, text, text, numeric, integer, integer, integer, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_ranked_play(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_ranked_play(uuid, text, text, numeric, integer, integer, integer, numeric, numeric)
  TO anon, authenticated;
COMMIT;
