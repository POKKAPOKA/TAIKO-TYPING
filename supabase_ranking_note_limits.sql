-- 公式譜面のノーツ数とMAX KPSを使ってランキングの記録を検証する。
-- supabase_security_fix.sql 適用済みの環境で、SQL Editor から管理者として実行する。
-- 曲を追加・変更した場合は、譜面中の入力対象ノーツ数に合わせて下記の値も更新する。
-- 未登録の曲は送信を拒否する。既存の記録は削除・変更しない。
BEGIN;

CREATE TABLE IF NOT EXISTS public.ranking_note_limits (
  song_id text PRIMARY KEY,
  max_notes integer NOT NULL CHECK (max_notes > 0)
);

ALTER TABLE public.ranking_note_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ranking_note_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL (song_id, max_notes) ON public.ranking_note_limits FROM PUBLIC, anon, authenticated;

-- public/songs 内の譜面 JSON の入力対象ノーツ数（2026-11-02 時点）。
INSERT INTO public.ranking_note_limits (song_id, max_notes) VALUES
  ('kimigayo', 32),
  ('senrohatudukuyodokomademo', 38),
  ('harugakita', 90),
  ('koinobori', 50),
  ('usagitokame', 194),
  ('sakura', 45),
  ('alps', 73),
  ('hotarunohikari', 192),
  ('kirakira', 36),
  ('shiningstar', 182),
  ('donguri', 106),
  ('taipatime', 219),
  ('taipatime_rhythm', 705)
ON CONFLICT (song_id) DO UPDATE SET max_notes = EXCLUDED.max_notes;

CREATE OR REPLACE FUNCTION public.validate_ranking_note_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  allowed_notes integer;
BEGIN
  -- いいねは同じテーブルを使用しているため、ランキング判定の対象外。
  IF left(NEW.song_id, 9) = '__like__:' THEN
    RETURN NEW;
  END IF;

  IF NEW.max_combo >= 1 AND NEW.peak_kps = 0 THEN
    RAISE EXCEPTION 'RANKING_ZERO_KPS_WITH_COMBO'
      USING ERRCODE = '22023',
        DETAIL = '最大コンボが1以上でMAX KPSが0の記録は登録できません。';
  END IF;

  SELECT max_notes INTO allowed_notes
    FROM public.ranking_note_limits WHERE song_id = NEW.song_id;
  IF allowed_notes IS NULL THEN
    RAISE EXCEPTION 'RANKING_SONG_LIMIT_NOT_CONFIGURED'
      USING ERRCODE = '22023', DETAIL = 'この楽曲のノーツ数上限が設定されていません。';
  END IF;

  IF NEW.max_combo > allowed_notes OR
     NEW.max_combo > coalesce(NEW.perfect_count, 0) + coalesce(NEW.good_count, 0) OR
     coalesce(NEW.perfect_count, 0) + coalesce(NEW.good_count, 0) + coalesce(NEW.miss_count, 0) > allowed_notes OR
     (NEW.score >= 1010000 AND (coalesce(NEW.perfect_count, 0) <> allowed_notes OR coalesce(NEW.good_count, 0) <> 0 OR coalesce(NEW.miss_count, 0) <> 0 OR NEW.max_combo <> allowed_notes)) THEN
    RAISE EXCEPTION 'RANKING_NOTE_LIMIT_EXCEEDED'
      USING ERRCODE = '22023',
        DETAIL = format('この楽曲の最大ノーツ数は%sです。既存の記録が上限を超えている場合も更新できません。', allowed_notes);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_ranking_note_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validate_ranking_note_limit ON public.rankings;
CREATE TRIGGER validate_ranking_note_limit
BEFORE INSERT OR UPDATE OF song_id, max_combo, peak_kps, perfect_count, good_count, miss_count
ON public.rankings FOR EACH ROW EXECUTE FUNCTION public.validate_ranking_note_limit();

COMMIT;
