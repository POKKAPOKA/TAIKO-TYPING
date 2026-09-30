// ひらがな1文字（または複数文字の組み合わせ）からローマ字の候補を返す辞書
const ROMAJI_DICT = {
  "あ": ["a"], "い": ["i"], "う": ["u", "wu", "whu"], "え": ["e"], "お": ["o"],
  "か": ["ka", "ca"], "き": ["ki"], "く": ["ku", "cu", "qu"], "け": ["ke"], "こ": ["ko", "co"],
  "さ": ["sa"], "し": ["shi", "si", "ci"], "す": ["su"], "せ": ["se", "ce"], "そ": ["so"],
  "た": ["ta"], "ち": ["chi", "ti"], "つ": ["tsu", "tu"], "て": ["te"], "と": ["to"],
  "な": ["na"], "に": ["ni"], "ぬ": ["nu"], "ね": ["ne"], "の": ["no"],
  "は": ["ha"], "ひ": ["hi"], "ふ": ["fu", "hu"], "へ": ["he"], "ほ": ["ho"],
  "ま": ["ma"], "み": ["mi"], "む": ["mu"], "め": ["me"], "も": ["mo"],
  "や": ["ya"], "ゆ": ["yu"], "よ": ["yo"],
  "ら": ["ra"], "り": ["ri"], "る": ["ru"], "れ": ["re"], "ろ": ["ro"],
  "わ": ["wa"], "を": ["wo"],

  "が": ["ga"], "ぎ": ["gi"], "ぐ": ["gu"], "げ": ["ge"], "ご": ["go"],
  "ざ": ["za"], "じ": ["ji", "zi"], "ず": ["zu"], "ぜ": ["ze"], "ぞ": ["zo"],
  "だ": ["da"], "ぢ": ["di"], "づ": ["du"], "で": ["de"], "ど": ["do"],
  "ば": ["ba"], "び": ["bi"], "ぶ": ["bu"], "べ": ["be"], "ぼ": ["bo"],
  "ぱ": ["pa"], "ぴ": ["pi"], "ぷ": ["pu"], "ぺ": ["pe"], "ぽ": ["po"],

  "きゃ": ["kya"], "きゅ": ["kyu"], "きょ": ["kyo"],
  "しゃ": ["sha", "sya"], "しゅ": ["shu", "syu"], "しょ": ["sho", "syo"],
  "ちゃ": ["cha", "tya", "cya"], "ちゅ": ["chu", "tyu", "cyu"], "ちょ": ["cho", "tyo", "cyo"],
  "にゃ": ["nya"], "にゅ": ["nyu"], "にょ": ["nyo"],
  "ひゃ": ["hya"], "ひゅ": ["hyu"], "ひょ": ["hyo"],
  "みゃ": ["mya"], "みゅ": ["myu"], "みょ": ["myo"],
  "りゃ": ["rya"], "りゅ": ["ryu"], "りょ": ["ryo"],
  "ぎゃ": ["gya"], "ぎゅ": ["gyu"], "ぎょ": ["gyo"],
  "じゃ": ["ja", "zya", "jya"], "じゅ": ["ju", "zyu", "jyu"], "じょ": ["jo", "zyo", "jyo"],
  "びゃ": ["bya"], "びゅ": ["byu"], "びょ": ["byo"],
  "ぴゃ": ["pya"], "ぴゅ": ["pyu"], "ぴょ": ["pyo"],

  "ぁ": ["xa", "la"], "ぃ": ["xi", "li"], "ぅ": ["xu", "lu"], "ぇ": ["xe", "le"], "ぉ": ["xo", "lo"],
  "ゃ": ["xya", "lya"], "ゅ": ["xyu", "lyu"], "ょ": ["xyo", "lyo"],
  "ゎ": ["xwa", "lwa"],

  "うぃ": ["wi", "whi"], "うぇ": ["we", "whe"], "うぉ": ["who"],
  "ふぁ": ["fa"], "ふぃ": ["fi"], "ふぇ": ["fe"], "ふぉ": ["fo"],
  "てぃ": ["thi"], "でぃ": ["dhi"], "とぅ": ["twu"], "どぅ": ["dwu"],
  "ゔぁ": ["va"], "ゔぃ": ["vi"], "ゔ": ["vu"], "ゔぇ": ["ve"], "ゔぉ": ["vo"],
  "ヴぁ": ["va"], "ヴぃ": ["vi"], "ヴ": ["vu"], "ヴぇ": ["ve"], "ヴぉ": ["vo"],

  "ん": ["nn", "xn"],
  "っ": ["xtsu", "ltsu", "xtu", "ltu"],
  "ー": ["-"]
};

// 全角カタカナをひらがなに変換
export function toHiragana(str) {
  return str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
}

// 単独nが許容されるかどうかの判定
export function canUseSingleN(nextHiraganaChar) {
  if (!nextHiraganaChar) return false; // 最後が「ん」の場合は "nn" が必要
  // 母音、な行、や行 が次に来る場合は単独nは不可
  const invalidNextChars = "あいうえおなにぬねのやゆよぁぃぅぇぉゃゅょ";
  return !invalidNextChars.includes(nextHiraganaChar);
}

// 読みをひらがなトークン（辞書のキー単位）に分割する
export function tokenizeReading(reading) {
  const tokens = [];
  let i = 0;
  while (i < reading.length) {
    if (i + 1 < reading.length && ROMAJI_DICT[reading.substring(i, i + 2)]) {
      tokens.push(reading.substring(i, i + 2));
      i += 2;
    } else {
      tokens.push(reading[i]);
      i++;
    }
  }
  return tokens;
}

// 読みの中に「タイピング不可能な文字」（辞書にも英数字にもない文字）が
// 含まれるか検査し、該当文字の配列を返す（空なら問題なし）。
// そのままだとゲーム中に絶対に打てないノーツになるため、エディタの入力チェックに使う。
export function findUntypableChars(reading) {
  if (!reading) return [];
  return tokenizeReading(toHiragana(reading)).filter(
    token => !ROMAJI_DICT[token] && !/^[a-z0-9\-]+$/i.test(token)
  );
}

export class RomajiParser {
  constructor(reading, nextReading = "") {
    this.nextReading = nextReading;
    this.reading = reading || "";
    // カタカナをひらがなに変換（入力されるreadingのみ）
    this.normalizedReading = toHiragana(this.reading);
    this.tokens = tokenizeReading(this.normalizedReading);
    this.tokenOptions = this._buildTokenOptions(this.tokens);

    // 状態: { tokenIndex: 0, optionIndex: X, charIndex: 0 }
    this.activeNodes = [];
    if (this.tokenOptions.length > 0) {
      for (let i = 0; i < this.tokenOptions[0].length; i++) {
        this.activeNodes.push({ tokenIndex: 0, optionIndex: i, charIndex: 0 });
      }
    }

    this.typedString = "";
  }

  _buildTokenOptions(tokens, lookaheadToken = null) {
    const tokenOptions = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let options = ROMAJI_DICT[token] ? [...ROMAJI_DICT[token]] : [token.toLowerCase()];

      if (token === "ん") {
        const nextChar = tokens[i+1] ? tokens[i+1][0] : (lookaheadToken ? lookaheadToken[0] : null);
        if (nextChar && canUseSingleN(nextChar)) {
          options.push("n");
        }
      }

      if (token === "っ") {
        const nextToken = tokens[i+1] || lookaheadToken;
        if (nextToken && ROMAJI_DICT[nextToken]) {
          const nextOptions = ROMAJI_DICT[nextToken];
          nextOptions.forEach(opt => {
            const firstChar = opt[0];
            if (!"aiueo".includes(firstChar)) {
              options.push(firstChar);
            }
          });
        }
      }

      options = [...new Set(options)];
      tokenOptions.push(options);
    }
    return tokenOptions;
  }

  input(key) {
    if (this.tokenOptions.length === 0) return true;
    key = key.toLowerCase();
    const nextNodes = [];

    for (const node of this.activeNodes) {
      const opt = this.tokenOptions[node.tokenIndex][node.optionIndex];
      if (opt[node.charIndex] === key) {
        if (node.charIndex + 1 === opt.length) {
          if (node.tokenIndex + 1 < this.tokenOptions.length) {
            for (let nextOptIdx = 0; nextOptIdx < this.tokenOptions[node.tokenIndex + 1].length; nextOptIdx++) {
              nextNodes.push({ tokenIndex: node.tokenIndex + 1, optionIndex: nextOptIdx, charIndex: 0 });
            }
          } else {
            nextNodes.push({ tokenIndex: node.tokenIndex + 1, optionIndex: 0, charIndex: 0 });
          }
        } else {
          nextNodes.push({ tokenIndex: node.tokenIndex, optionIndex: node.optionIndex, charIndex: node.charIndex + 1 });
        }
      }
    }

    if (nextNodes.length > 0) {
      this.typedString += key;
      this.activeNodes = nextNodes;
      return true;
    }
    return false;
  }

  isComplete() {
    if (this.tokenOptions.length === 0) return true;
    return this.activeNodes.some(node => node.tokenIndex >= this.tokenOptions.length);
  }

  getDisplayState() {
    if (this.isComplete() || this.activeNodes.length === 0) {
      return { typed: this.typedString.toUpperCase(), next: "", remaining: "" };
    }

    const node = this.activeNodes[0];
    const currentOpt = this.tokenOptions[node.tokenIndex][node.optionIndex];
    const nextChar = currentOpt[node.charIndex] || "";
    let remaining = currentOpt.substring(node.charIndex + 1);

    for (let i = node.tokenIndex + 1; i < this.tokenOptions.length; i++) {
      remaining += this.tokenOptions[i][0];
    }

    return {
      typed: this.typedString.toUpperCase(),
      next: nextChar.toUpperCase(),
      remaining: remaining.toUpperCase()
    };
  }
}

// 直前のトークンが「ん」かつ単独 "n" が使える場合、次のトークンは先頭が母音・n・y 以外の
// オプションだけを辿れる（n + a のような誤結合を起こす候補は除外する必要があるため）。
// 引き抜ける最小長を返す。該当オプションがなければ Infinity。
function minLenAfterSingleN(options) {
  let min = Infinity;
  for (const opt of options) {
    const head = opt[0];
    if ("aiueony".includes(head)) continue;
    if (opt.length < min) min = opt.length;
  }
  return min;
}

/**
 * ひらがな文字列を受け取り、取り得るすべてのローマ字入力パターンの中で
 * 「最短の打鍵数（整数）」を返す。
 *
 * タイピングゲーム特有の最短経路を考慮する:
 * - 「し」→ shi(3) ではなく si(2)
 * - 「っちゃ」→ xtu+cha(6) ではなく ccha(4)（促音の子音重ね）
 * - 「んか」→ nnka(4) ではなく nka(3)（文脈で許される単独 n）
 * - 「んあ」→ nna(3)（後続が母音のため単独 n は不可）
 *
 * 動的計画法で後ろから計算する。
 * dp[i] = トークン i 以降を打つのに必要な最短打鍵数
 *
 * @param {string} text ひらがな（またはカタカナ）の読み
 * @returns {number} 最短打鍵数
 */
export function calculateMinKeystrokes(text) {
  if (!text) return 0;

  const tokens = tokenizeReading(toHiragana(text));
  const n = tokens.length;
  if (n === 0) return 0;

  // 各トークンの素のローマ字候補（文脈加工前）
  const baseOptions = tokens.map(token =>
    ROMAJI_DICT[token] ? [...ROMAJI_DICT[token]] : [token.toLowerCase()]
  );

  // nextMin[i][k] = トークン i のみを「先頭が母音・n・y 以外」の候補に限って
  // 打つ場合の最小長を後ろから求めておく（ん の単独 n 直後に使う）
  const dp = new Array(n + 1).fill(0); // dp[n] = 0（末尾以降は 0 打鍵）

  for (let i = n - 1; i >= 0; i--) {
    const token = tokens[i];
    const options = baseOptions[i];

    // 基本: このトークンの最短候補 + 後続の最短
    let best = Infinity;
    for (const opt of options) {
      const total = opt.length + dp[i + 1];
      if (total < best) best = total;
    }

    if (token === 'ん') {
      // 文脈で許されれば単独 "n" を使う経路。
      // ただし直後のトークンは先頭が母音・n・y 以外の候補に限られるため、
      // 後続側も「制約付き最短」を再計算する必要がある。
      const next = tokens[i + 1];
      const nextHead = next ? next[0] : null;
      if (nextHead && canUseSingleN(nextHead)) {
        const constrained = minLenAfterSingleN(baseOptions[i + 1]);
        const total = 1 + (constrained === Infinity ? Infinity : constrained + dp[i + 2]);
        if (total < best) best = total;
      }
    }

    if (token === 'っ' && i + 1 < n) {
      // 促音の子音重ね: 次のトークンを「先頭子音1文字 + 残り」として打つ経路。
      // っ自体は独立して打たない（"xtu" などより短いことが多い）。
      const nextOptions = baseOptions[i + 1];
      for (const opt of nextOptions) {
        const head = opt[0];
        if ("aiueo".includes(head)) continue; // 母音始まりは重ねられない
        const total = 1 + opt.length + dp[i + 2]; // 子音1回目 + 子音2回目以降を含む完全形
        // 正確には "c + cha" = 4 打鍵 → 子音(1) + 残り全体(opt.length) ではなく
        // 子音(1) + (子音を除いた残り) だが、残りの先頭が同じ子音なので
        // opt.length に含まれる先頭1文字がそのまま2回目の打鍵になる。
        // よって 1 + opt.length が正しい打鍵数。
        if (total < best) best = total;
      }
    }

    dp[i] = best;
  }

  return dp[0] === Infinity ? text.length : dp[0];
}

/**
 * @deprecated calculateMinKeystrokes を使用してください。
 * 互換性維持のため残しているラッパーです。
 */
export function getKeystrokeCount(text) {
  return calculateMinKeystrokes(text);
}
