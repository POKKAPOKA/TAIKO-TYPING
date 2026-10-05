ALTER TABLE rankings ADD COLUMN device_id TEXT;

ALTER TABLE rankings
ADD CONSTRAINT rankings_song_id_device_id_key UNIQUE (song_id, device_id);

-- upsert（自己スコアの上書き更新）を動作させるためUPDATEを許可する
-- ※UPDATEを許可しないと upsert が RLS 違反で失敗する。
--   誰でもUPDATE可能になる点は既存のINSERT許可と同じ運用前提
--   （イタズラ防止はアプリ側の device_id 制御に依存する）
CREATE POLICY "Allow public update access" ON public.rankings FOR
UPDATE USING (true)
WITH
    CHECK (true);
