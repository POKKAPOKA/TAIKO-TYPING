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
function toHiragana(str) {
  return str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
}

// 単独nが許容されるかどうかの判定
function canUseSingleN(nextHiraganaChar) {
  if (!nextHiraganaChar) return false; // 最後が「ん」の場合は "nn" が必要
  // 母音、な行、や行 が次に来る場合は単独nは不可
  const invalidNextChars = "あいうえおなにぬねのやゆよぁぃぅぇぉゃゅょ";
  return !invalidNextChars.includes(nextHiraganaChar);
}

// 読みをひらがなトークン（辞書のキー単位）に分割する
function tokenizeReading(reading) {
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
  constructor(reading) {
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

  _buildTokenOptions(tokens) {
    const tokenOptions = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let options = ROMAJI_DICT[token] ? [...ROMAJI_DICT[token]] : [token.toLowerCase()];

      if (token === "ん") {
        const nextChar = tokens[i+1] ? tokens[i+1][0] : null;
        if (nextChar && canUseSingleN(nextChar)) {
          options.push("n");
        }
      }

      if (token === "っ") {
        const nextToken = tokens[i+1];
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

export function getKeystrokeCount(text) {
  if (!text) return 0;

  const parser = new RomajiParser(text);
  if (!parser.tokenOptions || parser.tokenOptions.length === 0) return text.length;

  let count = 0;
  for (const options of parser.tokenOptions) {
    let minLen = Infinity;
    for (const opt of options) {
      if (opt.length < minLen) minLen = opt.length;
    }
    count += minLen === Infinity ? 1 : minLen;
  }
  return count;
}
