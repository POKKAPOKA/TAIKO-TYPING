// ノーツは78px、両側の枠線が各3px。内側に1pxずつ余白を取る。
export const NOTE_TEXT_BOX = 72;
const REFERENCE_FONT_SIZE = 64;
const DRAWABLE_SIZE = 70;

// Canvasのグリフ境界から、基準倍率1.0で枠内に収まる大きさと中央位置を求める。
// 実測値を使うため、英字・日本語・結合文字・絵文字の文字幅にも対応する。
export function fitNoteText(metrics) {
  const rawWidth = Number(metrics?.width);
  const hasBounds = ['actualBoundingBoxLeft', 'actualBoundingBoxRight', 'actualBoundingBoxAscent', 'actualBoundingBoxDescent']
    .every(key => Number.isFinite(metrics?.[key]));
  const left = hasBounds ? metrics.actualBoundingBoxLeft : 0;
  const right = hasBounds ? metrics.actualBoundingBoxRight : Math.max(0, Number.isFinite(rawWidth) ? rawWidth : 0);
  const ascent = hasBounds ? metrics.actualBoundingBoxAscent : REFERENCE_FONT_SIZE / 2;
  const descent = hasBounds ? metrics.actualBoundingBoxDescent : REFERENCE_FONT_SIZE / 2;
  const width = Math.max(Number.isFinite(rawWidth) ? rawWidth : 0, left + right, 1);
  const height = Math.max(ascent + descent, 1);
  // 中央に置いた矩形の四隅が円内に入るよう、外接円の直径で制限する。
  const fontSize = Math.min(256, DRAWABLE_SIZE * REFERENCE_FONT_SIZE / Math.hypot(width, height));
  const ratio = fontSize / REFERENCE_FONT_SIZE;
  return {
    fontSize,
    x: NOTE_TEXT_BOX / 2 + (left - right) * ratio / 2,
    y: NOTE_TEXT_BOX / 2 + (ascent - descent) * ratio / 2,
  };
}

// キャプチャ元のテキストを切り詰めず、文字単位（UTF-16）で分割しない。
export function getNoteText(note, rhythmMode) {
  return rhythmMode ? '♪' : String(note?.word || note?.reading || '');
}

export const NOTE_MEASURE_FONT_SIZE = REFERENCE_FONT_SIZE;
