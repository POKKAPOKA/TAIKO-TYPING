ALTER TABLE rankings ADD COLUMN device_id TEXT;

ALTER TABLE rankings
ADD CONSTRAINT rankings_song_id_device_id_key UNIQUE (song_id, device_id);

-- 続けて .sql を適用する。書き込みはRPC経由に限定し、
-- 旧環境に残っている直接書き込みポリシーは同SQLで削除する。
