import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateMinKeystrokes, normalizePlayableReading, toBaseKana } from '../engine/RomajiParser';

describe('公式譜面のMAX KPS候補', () => {
  it('各ノーツのPC・スマホ両方の計算値がDB用SQLと一致する', () => {
    const songs = JSON.parse(readFileSync('public/songs/index.json', 'utf8'));
    const sql = readFileSync('supabase_ranking_kps_values.sql', 'utf8');
    const actual = new Set(Array.from(sql.matchAll(/\('([^']+)', (\d+\.\d{2})\)/g), match => `${match[1]}:${match[2]}`));
    const expected = new Set();
    for (const song of songs) {
      const chart = JSON.parse(readFileSync(`public/${song.scorePath.replace(/^\.\//, '')}`, 'utf8'));
      for (const note of chart.notes) {
        const reading = note.reading || note.word || '';
        if (!normalizePlayableReading(reading)) continue;
        const duration = (note.endTime - note.time) / 1000;
        if (!(duration > 0)) continue;
        for (const count of [calculateMinKeystrokes(reading), toBaseKana(reading).length]) {
          expected.add(`${song.id}:${Math.min(30, count / duration).toFixed(2)}`);
        }
      }
    }
    expect(actual).toEqual(expected);
  });
});
