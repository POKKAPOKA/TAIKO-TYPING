-- ==============================================================================
-- テーブル定義: rankings
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id TEXT NOT NULL CHECK (char_length(song_id) BETWEEN 1 AND 100),
  player_name TEXT NOT NULL CHECK (char_length(player_name) BETWEEN 1 AND 50),
  -- スコア・コンボ・KPSに上限を設け、不正な大値の送信（荒らし）を防ぐ
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 10000000),
  max_combo NUMERIC NOT NULL CHECK (max_combo >= 0 AND max_combo <= 100000),
  peak_kps NUMERIC NOT NULL CHECK (peak_kps >= 0 AND peak_kps <= 30),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ※ すでに旧定義でテーブルを作成済みの場合は、以下のALTER文で制約を追加してください
-- ALTER TABLE public.rankings ADD CONSTRAINT rankings_song_id_length CHECK (char_length(song_id) BETWEEN 1 AND 100);
-- ALTER TABLE public.rankings ADD CONSTRAINT rankings_player_name_length CHECK (char_length(player_name) BETWEEN 1 AND 50);
-- ALTER TABLE public.rankings ADD CONSTRAINT rankings_score_range CHECK (score >= 0 AND score <= 10000000);
-- ALTER TABLE public.rankings ADD CONSTRAINT rankings_max_combo_range CHECK (max_combo >= 0 AND max_combo <= 100000);
-- ALTER TABLE public.rankings ADD CONSTRAINT rankings_peak_kps_range CHECK (peak_kps >= 0 AND peak_kps <= 30);

-- ==============================================================================
-- RLS (Row Level Security) の設定
-- ==============================================================================
-- まずRLSを有効化
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;

-- 誰でもランキングを閲覧（SELECT）できるポリシー
CREATE POLICY "Allow public read access" ON public.rankings FOR
SELECT USING (true);

-- 誰でもスコアを送信（INSERT）できるポリシー
CREATE POLICY "Allow public insert access" ON public.rankings FOR
INSERT
WITH
    CHECK (true);

-- ※ 注意: 更新(UPDATE)や削除(DELETE)は許可しないことで、
-- 送信されたスコアが第三者に改ざんされるのを防ぎます。

-- ==============================================================================
-- パフォーマンス向上のためのインデックス
-- ==============================================================================
-- song_idごとのスコアランキングを高速に取得するためのインデックス
CREATE INDEX IF NOT EXISTS idx_rankings_song_score ON public.rankings (song_id, score DESC);
