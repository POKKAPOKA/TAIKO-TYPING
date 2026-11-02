-- rankings の公開列のみを読み取り可能にし、書き込みを RPC に限定する。
-- supabase_setup.sql と supabase_update.sql の後に、管理者として実行する。
-- この方式は識別子の秘匿に依存し、呼び出し元の本人認証やスコアの正当性を保証しない。
BEGIN;

ALTER TABLE public.rankings ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE public.rankings ADD COLUMN IF NOT EXISTS perfect_count numeric NOT NULL DEFAULT 0;
ALTER TABLE public.rankings ADD COLUMN IF NOT EXISTS good_count numeric NOT NULL DEFAULT 0;
ALTER TABLE public.rankings ADD COLUMN IF NOT EXISTS miss_count numeric NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS rankings_song_device_rpc_key ON public.rankings (song_id, device_id);
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;

-- 名前が異なる既存の書き込みポリシーや ALL ポリシーも除去する。
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'rankings' AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.rankings', p.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Allow public read access" ON public.rankings;
CREATE POLICY "Allow public read access" ON public.rankings FOR SELECT TO anon, authenticated USING (true);

-- テーブル権限だけでなく既存のカラム別権限、PUBLIC からの継承も除去する。
REVOKE ALL ON public.rankings FROM PUBLIC, anon, authenticated;
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rankings'
  LOOP
    EXECUTE format('REVOKE ALL (%I) ON public.rankings FROM PUBLIC, anon, authenticated', c.column_name);
  END LOOP;
END $$;
GRANT SELECT (id, song_id, player_name, score, perfect_count, good_count, miss_count, max_combo, peak_kps, created_at)
  ON public.rankings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_ranking_score(
  p_song_id text, p_device_id text, p_player_name text, p_score numeric,
  p_perfect_count integer, p_good_count integer, p_miss_count integer,
  p_max_combo numeric, p_max_kps numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  existing public.rankings%ROWTYPE;
  result public.rankings%ROWTYPE;
  final_name text := left(coalesce(nullif(btrim(p_player_name), ''), 'Guest'), 20);
  new_best boolean;
  changed boolean;
BEGIN
  IF p_song_id IS NULL OR btrim(p_song_id) = '' OR char_length(p_song_id) > 100
     OR left(p_song_id, 9) = '__like__:'
     OR p_device_id IS NULL OR btrim(p_device_id) = '' OR char_length(p_device_id) > 200
     OR p_score IS NULL OR p_score < 0 OR p_score > 1010000
     OR p_perfect_count IS NULL OR p_perfect_count < 0
     OR p_good_count IS NULL OR p_good_count < 0
     OR p_miss_count IS NULL OR p_miss_count < 0
     OR p_max_combo IS NULL OR p_max_combo < 0 OR p_max_combo > 100000
     OR p_max_kps IS NULL OR p_max_kps < 0 OR p_max_kps > 30 THEN
    RAISE EXCEPTION 'Invalid ranking submission' USING ERRCODE = '22023';
  END IF;

  -- 行ロックと衝突時の再試行で、並行送信でも最高スコアを維持する。
  LOOP
    SELECT * INTO existing FROM public.rankings
      WHERE song_id = p_song_id AND device_id = p_device_id FOR UPDATE;
    IF FOUND THEN
      new_best := p_score > existing.score;
      changed := new_best OR existing.player_name IS DISTINCT FROM final_name;
      UPDATE public.rankings SET
        player_name = final_name,
        score = CASE WHEN new_best THEN p_score ELSE existing.score END,
        perfect_count = CASE WHEN new_best THEN p_perfect_count ELSE existing.perfect_count END,
        good_count = CASE WHEN new_best THEN p_good_count ELSE existing.good_count END,
        miss_count = CASE WHEN new_best THEN p_miss_count ELSE existing.miss_count END,
        max_combo = CASE WHEN new_best THEN p_max_combo ELSE existing.max_combo END,
        peak_kps = CASE WHEN new_best THEN p_max_kps ELSE existing.peak_kps END
      WHERE id = existing.id RETURNING * INTO result;
      EXIT;
    END IF;
    INSERT INTO public.rankings (song_id, device_id, player_name, score, perfect_count, good_count, miss_count, max_combo, peak_kps)
      VALUES (p_song_id, p_device_id, final_name, p_score, p_perfect_count, p_good_count, p_miss_count, p_max_combo, p_max_kps)
      ON CONFLICT (song_id, device_id) DO NOTHING RETURNING * INTO result;
    IF FOUND THEN
      new_best := true;
      changed := true;
      EXIT;
    END IF;
  END LOOP;
  RETURN jsonb_build_object(
    'id', result.id, 'song_id', result.song_id, 'player_name', result.player_name,
    'score', result.score, 'perfect_count', result.perfect_count, 'good_count', result.good_count,
    'miss_count', result.miss_count, 'max_combo', result.max_combo, 'peak_kps', result.peak_kps,
    'created_at', result.created_at, 'updated', changed, 'is_new_best', new_best
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_song_like_status(p_song_id text, p_device_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE device_count numeric; total_count numeric;
BEGIN
  IF p_song_id IS NULL OR btrim(p_song_id) = '' OR char_length(p_song_id) > 91 OR left(p_song_id, 9) = '__like__:'
     OR p_device_id IS NULL OR btrim(p_device_id) = '' OR char_length(p_device_id) > 200 THEN
    RAISE EXCEPTION 'Invalid like request' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(sum(score), 0), coalesce(sum(score) FILTER (WHERE device_id = p_device_id), 0)
    INTO total_count, device_count FROM public.rankings WHERE song_id = '__like__:' || p_song_id;
  RETURN jsonb_build_object('total_count', total_count, 'device_count', device_count, 'liked', device_count > 0);
END $$;

CREATE OR REPLACE FUNCTION public.update_song_like(p_song_id text, p_device_id text, p_delta integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_song_id IS NULL OR btrim(p_song_id) = '' OR char_length(p_song_id) > 91 OR left(p_song_id, 9) = '__like__:'
     OR p_device_id IS NULL OR btrim(p_device_id) = '' OR char_length(p_device_id) > 200
     OR p_delta IS NULL OR p_delta NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'Invalid like request' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.rankings (song_id, device_id, player_name, score, max_combo, peak_kps, perfect_count, good_count, miss_count)
    VALUES ('__like__:' || p_song_id, p_device_id, 'LIKE', greatest(0, p_delta), 0, 0, 0, 0, 0)
  ON CONFLICT (song_id, device_id) DO UPDATE
    SET score = least(10000000, greatest(0, public.rankings.score + p_delta));
  RETURN public.get_song_like_status(p_song_id, p_device_id);
END $$;

CREATE OR REPLACE FUNCTION public.get_song_like_totals()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT coalesce(jsonb_object_agg(song_id, total), '{}'::jsonb)
  FROM (
    SELECT substring(song_id FROM 10) AS song_id, sum(score) AS total
    FROM public.rankings WHERE left(song_id, 9) = '__like__:' GROUP BY song_id
  ) totals;
$$;

REVOKE ALL ON FUNCTION public.submit_ranking_score(text, text, text, numeric, integer, integer, integer, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_song_like(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_song_like_status(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_song_like_totals() FROM PUBLIC, anon, authenticated;
-- セッション方式導入後にこの旧 SQL を再実行しても、旧登録口を再公開しない。
DO $$
BEGIN
  IF to_regprocedure('public.finish_ranked_play(uuid,text,text,numeric,integer,integer,integer,numeric,numeric)') IS NULL THEN
    GRANT EXECUTE ON FUNCTION public.submit_ranking_score(text, text, text, numeric, integer, integer, integer, numeric, numeric) TO anon, authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.update_song_like(text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_song_like_status(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_song_like_totals() TO anon, authenticated;
COMMIT;
