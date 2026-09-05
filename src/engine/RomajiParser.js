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
  
  "ん": ["nn", "xn"], // 単独の "n" は特別な条件でのみ追加される
  "っ": ["xtsu", "ltsu", "xtu", "ltu"], // 次の子音を重ねるパターンは動的に追加される
  "ー": ["-"]
};

// 単独nが許容されるかどうかの判定
function canUseSingleN(nextHiraganaChar) {
  if (!nextHiraganaChar) return false; // 最後が「ん」の場合は "nn" が必要
  // 母音、な行、や行 が次に来る場合は単独nは不可（na とつながって「な」になってしまうため）
  const invalidNextChars = "あいうえおなにぬねのやゆよぁぃぅぇぉゃゅょ";
  return !invalidNextChars.includes(nextHiraganaChar);
}

export class RomajiParser {
  constructor(reading) {
    this.reading = reading || "";
    this.tokens = this._tokenize(this.reading);
    this.paths = this._buildPaths(this.tokens);
    
    // 現在有効なルートの候補（最初は全て）
    this.activePaths = this.paths;
    this.typedString = "";
  }

  _tokenize(reading) {
    let tokens = [];
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

  _buildPaths(tokens) {
    const tokenOptions = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let options = ROMAJI_DICT[token] ? [...ROMAJI_DICT[token]] : [token.toLowerCase()]; 
      
      // 「ん」の特例：次が特定の文字でなければ単独 'n' を追加
      if (token === "ん") {
        const nextChar = tokens[i+1] ? tokens[i+1][0] : null;
        if (nextChar && canUseSingleN(nextChar)) {
          options.push("n");
        }
      }
      
      // 「っ」の特例：次の文字の子音を重ねるパターンを追加
      if (token === "っ") {
        const nextToken = tokens[i+1];
        if (nextToken && ROMAJI_DICT[nextToken]) {
          const nextOptions = ROMAJI_DICT[nextToken];
          nextOptions.forEach(opt => {
            const firstChar = opt[0];
            // a,i,u,e,o 以外の子音なら重ねる
            if (!"aiueo".includes(firstChar)) {
              options.push(firstChar);
            }
          });
        }
      }
      
      // 重複排除
      options = [...new Set(options)];
      tokenOptions.push(options);
    }
    
    // 全組み合わせを展開
    let currentStrings = [""];
    for (let i = 0; i < tokenOptions.length; i++) {
      let nextStrings = [];
      const opts = tokenOptions[i];
      for (const str of currentStrings) {
        for (const opt of opts) {
          nextStrings.push(str + opt);
        }
      }
      currentStrings = nextStrings;
    }
    
    // フォールバック（何も見つからなかった場合）
    if (currentStrings.length === 0) return [""];
    return currentStrings;
  }

  /**
   * キーボードからの1文字の入力を受け付ける。
   * 正解ルートに乗っていれば true を返し、内部状態を進める。
   * 間違っていれば false を返す。
   */
  input(key) {
    key = key.toLowerCase();
    const candidate = this.typedString + key;
    
    const validPaths = this.activePaths.filter(path => path.startsWith(candidate));
    
    if (validPaths.length > 0) {
      this.typedString = candidate;
      this.activePaths = validPaths;
      return true;
    }
    return false;
  }

  isComplete() {
    return this.activePaths.some(path => path === this.typedString);
  }

  /**
   * UI表示用の状態オブジェクトを返す
   * 例: "shinkansen" に対して "shin" まで打った状態
   * { typed: "SHIN", next: "K", remaining: "ANSEN" }
   */
  getDisplayState() {
    const bestPath = this.activePaths[0] || "";
    return {
      typed: this.typedString.toUpperCase(),
      next: bestPath.charAt(this.typedString.length).toUpperCase(),
      remaining: bestPath.substring(this.typedString.length + 1).toUpperCase()
    };
  }
}