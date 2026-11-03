// 現行譜面からPCとスマホ両方で取り得るMAX KPSを生成する。
// 譜面または判定ロジック変更時はSQLを再生成し、DBへ適用する。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateMinKeystrokes, normalizePlayableReading, toBaseKana } from './src/engine/RomajiParser.js';

const root = resolve(process.argv[2] || '.');
const songs = JSON.parse(readFileSync(resolve(root, 'public/songs/index.json'), 'utf8'));
const rows = [];
for (const song of songs) {
  if (!/^[a-z0-9_-]+$/i.test(song.id) || !song.scorePath?.startsWith('./songs/')) throw new Error(`Invalid song: ${song.id}`);
  const chart = JSON.parse(readFileSync(resolve(root, 'public', song.scorePath), 'utf8'));
  const allowed = new Set();
  for (const note of chart.notes || []) {
    const reading = note?.reading || note?.word || '';
    if (!normalizePlayableReading(reading).length) continue;
    const duration = (note.endTime - note.time) / 1000;
    if (!(duration > 0)) continue;
    for (const strokes of [calculateMinKeystrokes(reading), toBaseKana(reading).length]) {
      // クライアントのtoFixed(2)と同じ丸めを使う。
      allowed.add(Math.min(30, strokes / duration).toFixed(2));
    }
  }
  if (!allowed.size) throw new Error(`No valid KPS values: ${song.id}`);
  for (const kps of allowed) rows.push(`  ('${song.id}', ${kps})`);
}
const sql = `-- generate_ranking_kps.mjs で現行の公式譜面から生成。既存記録は削除しない。
BEGIN;
CREATE TABLE IF NOT EXISTS public.ranking_allowed_kps (song_id text NOT NULL, peak_kps numeric NOT NULL, PRIMARY KEY (song_id, peak_kps));
ALTER TABLE public.ranking_allowed_kps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ranking_allowed_kps FROM PUBLIC, anon, authenticated;
DELETE FROM public.ranking_allowed_kps;
INSERT INTO public.ranking_allowed_kps (song_id, peak_kps) VALUES\n${rows.join(',\n')};
COMMIT;\n`;
writeFileSync(resolve(root, 'supabase_ranking_kps_values.sql'), sql, 'utf8');
console.log(`${songs.length}曲・${rows.length}候補を生成`);
