import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizePlayableReading } from '../engine/RomajiParser';

describe('公式譜面のノーツ数', () => {
  it('曲一覧とDBの上限が、実際に判定するノーツ数と一致する', () => {
    const songs = JSON.parse(readFileSync('public/songs/index.json', 'utf8'));
    const sql = readFileSync('supabase_ranking_note_limits.sql', 'utf8');
    for (const song of songs) {
      const score = JSON.parse(readFileSync(`public/${song.scorePath.replace(/^\.\//, '')}`, 'utf8'));
      const count = score.notes.filter(note => note && normalizePlayableReading(note.reading || note.word || '').length > 0).length;
      expect(song.notesCount, song.id).toBe(count);
      expect(sql, song.id).toContain(`('${song.id}', ${count})`);
    }
  });
});
