-- ==============================================================================
-- テーブル定義: rankings
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  score NUMERIC NOT NULL,
  max_combo NUMERIC NOT NULL,
  peak_kps NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- RLS (Row Level Security) の設定
-- ==============================================================================
-- まずRLSを有効化
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;

-- 誰でもランキングを閲覧（SELECT）できるポリシー
CREATE POLICY "Allow public read access"
  ON public.rankings
  FOR SELECT
  USING (true);

-- 誰でもスコアを送信（INSERT）できるポリシー
CREATE POLICY "Allow public insert access"
  ON public.rankings
  FOR INSERT
  WITH CHECK (true);

-- ※ 注意: 更新(UPDATE)や削除(DELETE)は許可しないことで、
-- 送信されたスコアが第三者に改ざんされるのを防ぎます。

-- ==============================================================================
-- パフォーマンス向上のためのインデックス
-- ==============================================================================
-- song_idごとのスコアランキングを高速に取得するためのインデックス
CREATE INDEX IF NOT EXISTS idx_rankings_song_score
  ON public.rankings (song_id, score DESC);
