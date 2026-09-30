import { describe, it, expect } from 'vitest';
import { calculateMinKeystrokes } from './RomajiParser';

describe('calculateMinKeystrokes', () => {
  describe('基本: 清音（あ行〜わ行）', () => {
    it.each([
      ['あ', 1], // a
      ['い', 1], // i
      ['う', 1], // u
      ['え', 1], // e
      ['お', 1], // o
      ['か', 2], // ka
      ['き', 2], // ki
      ['く', 2], // ku
      ['け', 2], // ke
      ['こ', 2], // ko
      ['さ', 2], // sa
      ['し', 2], // si (shi=3 ではなく)
      ['す', 2], // su
      ['せ', 2], // se
      ['そ', 2], // so
      ['た', 2], // ta
      ['ち', 2], // ti (chi=3 ではなく)
      ['つ', 2], // tu (tsu=3 ではなく)
      ['て', 2], // te
      ['と', 2], // to
      ['な', 2], // na
      ['に', 2], // ni
      ['ぬ', 2], // nu
      ['ね', 2], // ne
      ['の', 2], // no
      ['は', 2], // ha
      ['ひ', 2], // hi
      ['ふ', 2], // fu (hu=2 でも同じ)
      ['へ', 2], // he
      ['ほ', 2], // ho
      ['ま', 2], // ma
      ['み', 2], // mi
      ['む', 2], // mu
      ['め', 2], // me
      ['も', 2], // mo
      ['や', 2], // ya
      ['ゆ', 2], // yu
      ['よ', 2], // yo
      ['ら', 2], // ra
      ['り', 2], // ri
      ['る', 2], // ru
      ['れ', 2], // re
      ['ろ', 2], // ro
      ['わ', 2], // wa
      ['を', 2], // wo
    ])('%s → %d', (input, expected) => {
      expect(calculateMinKeystrokes(input)).toBe(expected);
    });
  });

  describe('基本: 濁音・半濁音', () => {
    it.each([
      ['が', 2], // ga
      ['ざ', 2], // za
      ['じ', 2], // ji / zi
      ['だ', 2], // da
      ['ぢ', 2], // di
      ['づ', 2], // du
      ['ば', 2], // ba
      ['ぱ', 2], // pa
    ])('%s → %d', (input, expected) => {
      expect(calculateMinKeystrokes(input)).toBe(expected);
    });
  });

  describe('拗音（きゃ・しゃ・ちゃ など）', () => {
    it.each([
      ['きゃ', 3], // kya
      ['しゃ', 3], // sya (sha=3 と同じ)
      ['しゅ', 3], // syu
      ['しょ', 3], // syo
      ['ちゃ', 3], // tya / cya (cha=3 と同じ)
      ['にゃ', 3], // nya
      ['ひゃ', 3], // hya
      ['みゃ', 3], // mya
      ['りゃ', 3], // rya
      ['ぎゃ', 3], // gya
      ['じゃ', 2], // ja (zya=3, jya=3 より短い)
      ['じゅ', 2], // ju
      ['じょ', 2], // jo
      ['びゃ', 3], // bya
      ['ぴゃ', 3], // pya
    ])('%s → %d', (input, expected) => {
      expect(calculateMinKeystrokes(input)).toBe(expected);
    });
  });

  describe('促音（っ）: 子音重ねが最短', () => {
    it.each([
      ['っか', 3], // kka
      ['っさ', 3], // ssa
      ['った', 3], // tta
      ['っぱ', 3], // ppa
      ['っちゃ', 4], // ccha / ttya（xtu+cha=6 ではない）
      ['っしゃ', 4], // ssha
      ['っきゃ', 4], // kkya
      ['がっこう', 6], // ga(2) + k(1) + ko(2) + u(1) = 6（っk → kk）
      ['ずっと', 5], // zu(2) + t(1) + to(2) = 5
    ])('%s → %d', (input, expected) => {
      expect(calculateMinKeystrokes(input)).toBe(expected);
    });

    it('「ずっと」は zutto(5)', () => {
      // z(1) u(1) t(1) t(1) o(1) = 5
      expect(calculateMinKeystrokes('ずっと')).toBe(5);
    });

    it('「まっか」は makka(5)', () => {
      // m(1) a(1) k(1) k(1) a(1) = 5
      expect(calculateMinKeystrokes('まっか')).toBe(5);
    });
  });

  describe('撥音（ん）: 文脈で単独 n が変わる', () => {
    it.each([
      ['ん', 2], // nn（文末は単独 n 不可）
      ['んか', 3], // nka（次が子音 → 単独 n 可）
      ['んさ', 3], // nsa
      ['んた', 3], // nta
      ['んは', 3], // nha
      ['んま', 3], // nma
      ['んら', 3], // nra
      ['んが', 3], // nga
      ['んざ', 3], // nza
      ['んだ', 3], // nda
      ['んば', 3], // nba
      ['んぱ', 3], // npa
      ['んあ', 3], // nna（次が母音 → 単独 n 不可）
      ['んい', 3], // nni
      ['んう', 3], // nnu
      ['んえ', 3], // nne
      ['んお', 3], // nno
      ['んな', 4], // nnna? → nn(2) + na(2) = 4（次がな行 → 単独 n 不可）
      ['んや', 4], // nnya? → nn(2) + ya(2) = 4（次がや行 → 単独 n 不可）
    ])('%s → %d', (input, expected) => {
      expect(calculateMinKeystrokes(input)).toBe(expected);
    });

    it('「んな」は nn + na = 4', () => {
      expect(calculateMinKeystrokes('んな')).toBe(4);
    });

    it('「んや」は nn + ya = 4', () => {
      expect(calculateMinKeystrokes('んや')).toBe(4);
    });

    it('「きんかん」は kinkann(7)', () => {
      // ki(2) + n(1) + ka(2) + nn(2) = 7（末尾の「ん」は単独 n 不可）
      expect(calculateMinKeystrokes('きんかん')).toBe(7);
    });
  });

  describe('小文字（ぁ・ゃ など）', () => {
    it.each([
      ['ぁ', 2], // xa / la
      ['ぃ', 2], // xi / li
      ['ぅ', 2], // xu / lu
      ['ぇ', 2], // xe / le
      ['ぉ', 2], // xo / lo
      ['ゃ', 3], // xya / lya
      ['ゅ', 3], // xyu / lyu
      ['ょ', 3], // xyo / lyo
    ])('%s → %d', (input, expected) => {
      expect(calculateMinKeystrokes(input)).toBe(expected);
    });
  });

  describe('特殊音（うぃ・ふぁ・ヴ など）', () => {
    it.each([
      ['うぃ', 2], // wi
      ['うぇ', 2], // we
      ['ふぁ', 2], // fa
      ['ふぃ', 2], // fi
      ['ふぇ', 2], // fe
      ['ふぉ', 2], // fo
      ['てぃ', 3], // thi
      ['でぃ', 3], // dhi
      ['ゔぁ', 2], // va
      ['ヴぁ', 2], // va
    ])('%s → %d', (input, expected) => {
      expect(calculateMinKeystrokes(input)).toBe(expected);
    });
  });

  describe('長音・記号', () => {
    it.each([
      ['ー', 1], // -
      ['おー', 2], // o-
    ])('%s → %d', (input, expected) => {
      expect(calculateMinKeystrokes(input)).toBe(expected);
    });
  });

  describe('カタカナ入力はひらがなに正規化される', () => {
    it.each([
      ['シ', 2], // si
      ['ッチャ', 4], // ccha
    ])('%s → %d', (input, expected) => {
      expect(calculateMinKeystrokes(input)).toBe(expected);
    });

    it('「カタカナ」は katakana(8)', () => {
      expect(calculateMinKeystrokes('カタカナ')).toBe(8);
    });
  });

  describe('複合語: タイピングゲームで頻出の語句', () => {
    it.each([
      ['さくら', 6], // sa(2) ku(2) ra(2) = 6
      ['ありがとう', 8], // a(1) ri(2) ga(2) to(2) u(1) = 8
    ])('%s → %d', (input, expected) => {
      expect(calculateMinKeystrokes(input)).toBe(expected);
    });

    it('「さくら」は sakura(6)', () => {
      expect(calculateMinKeystrokes('さくら')).toBe(6);
    });

    it('「こんにちは」は konnitiha(10)', () => {
      // ko(2) + nn(2) + ni(2) + ti(2) + ha(2) = 10
      // 「ん」の次が「に」（な行）のため単独 n は使えない
      expect(calculateMinKeystrokes('こんにちは')).toBe(10);
    });

    it('「ありがとう」は arigatou(8)', () => {
      expect(calculateMinKeystrokes('ありがとう')).toBe(8);
    });

    it('「しんぶん」は sinbunn(7)', () => {
      // si(2) + n(1) + bu(2) + nn(2) = 7
      // 1つ目の「ん」の次は「ぶ」（子音）で単独 n 可、末尾の「ん」は不可
      expect(calculateMinKeystrokes('しんぶん')).toBe(7);
    });

    it('「けんか」は kenka(5)', () => {
      // ke(2) + n(1) + ka(2) = 5
      expect(calculateMinKeystrokes('けんか')).toBe(5);
    });
  });

  describe('エッジケース', () => {
    it('空文字は 0', () => {
      expect(calculateMinKeystrokes('')).toBe(0);
    });

    it('null / undefined 相当（空文字扱い）は 0', () => {
      expect(calculateMinKeystrokes(null)).toBe(0);
      expect(calculateMinKeystrokes(undefined)).toBe(0);
    });

    it('1文字だけ', () => {
      expect(calculateMinKeystrokes('き')).toBe(2);
    });

    it('長い文字列でも破綻しない', () => {
      // 「きゃりーぱみゅぱみゅ」
      const result = calculateMinKeystrokes('きゃりーぱみゅぱみゅ');
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it('辞書にない文字（漢字など）はフォールバックで文字数分', () => {
      // 漢字1文字 → token.toLowerCase() になるが、日本語なので実質1文字扱い
      const result = calculateMinKeystrokes('桜');
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('促音の複雑な組み合わせ', () => {
    it('「いっしょ」は issyo(5)', () => {
      // i(1) + s(1) + syo(3) = 5（っしょ → ssyo）
      expect(calculateMinKeystrokes('いっしょ')).toBe(5);
    });

    it('「きっぷ」は kippu(5)', () => {
      // ki(2) + p(1) + pu(2) = 5
      expect(calculateMinKeystrokes('きっぷ')).toBe(5);
    });

    it('「ちょっと」は tyotto(6)', () => {
      // tyo(3) + t(1) + to(2) = 6
      expect(calculateMinKeystrokes('ちょっと')).toBe(6);
    });

    it('「ざっし」は zassi(5)', () => {
      // za(2) + s(1) + si(2) = 5
      expect(calculateMinKeystrokes('ざっし')).toBe(5);
    });
  });
});
