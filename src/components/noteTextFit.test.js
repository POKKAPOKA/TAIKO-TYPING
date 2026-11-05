import { describe, expect, it } from 'vitest';
import { fitNoteText, getNoteText } from './noteTextFit';

describe('ノーツ文字の枠への収まり', () => {
  it('1文字の実測矩形を円の内側いっぱいに拡大し、中心に配置する', () => {
    const fit = fitNoteText({ width: 64, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 64, actualBoundingBoxAscent: 50, actualBoundingBoxDescent: 14 });
    const size = 70 / Math.sqrt(2);
    expect(fit.fontSize).toBeCloseTo(size);
    expect(fit.x).toBeCloseTo(36 - size / 2);
    expect(fit.y).toBeCloseTo(36 + 18 * size / 64);
    expect(Math.hypot(size, size)).toBeCloseTo(70);
  });

  it('長い文字列は実際の幅を使い、枠をはみ出ない基準サイズにする', () => {
    const fit = fitNoteText({ width: 240, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 240, actualBoundingBoxAscent: 50, actualBoundingBoxDescent: 14 });
    expect(fit.fontSize).toBeCloseTo(70 * 64 / Math.hypot(240, 64));
    expect(Math.hypot(240, 64) * fit.fontSize / 64).toBeCloseTo(70);
  });

  it('文字の縦方向が幅より大きければ高さで制限する', () => {
    const fit = fitNoteText({ width: 15, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 15, actualBoundingBoxAscent: 95, actualBoundingBoxDescent: 5 });
    expect(fit.fontSize).toBeCloseTo(70 * 64 / Math.hypot(15, 100));
    expect(Math.hypot(15, 100) * fit.fontSize / 64).toBeCloseTo(70);
  });

  it('グリフ境界が使えない環境でも有限値を返す', () => {
    const fit = fitNoteText({ width: 128 });
    expect(fit.fontSize).toBeCloseTo(70 * 64 / Math.hypot(128, 64));
    expect(Number.isFinite(fit.x)).toBe(true);
    expect(Number.isFinite(fit.y)).toBe(true);
    expect(Number.isFinite(fitNoteText({ width: 0 }).fontSize)).toBe(true);
  });

  it('4文字以上のテキストは先頭3文字に切り詰め（絵文字・結合文字も文字単位で保持）、リズムモードでは音符を使う', () => {
    const text = 'が𠮷🎵abcdef';
    expect(getNoteText({ word: text }, false)).toBe('が𠮷🎵');
    expect(getNoteText({ reading: 'かきくけこ' }, false)).toBe('かきく');
    expect(getNoteText({ word: 'あいう' }, false)).toBe('あいう');
    expect(getNoteText({ word: 'あい' }, false)).toBe('あい');
    expect(getNoteText({ word: text }, true)).toBe('♪');
  });
});
