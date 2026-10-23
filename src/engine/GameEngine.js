import { useGameStore } from '../store/gameStore';
import { RomajiParser, calculateMinKeystrokes, toBaseKana } from './RomajiParser';
import { playPerfect, playGood, playMiss } from '../hooks/useSystemSE';

const JUDGE_WINDOW = {
  PERFECT: 50,
  GOOD: 100,
  MISS: 150
};

export class GameEngine {
  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFlickInput = this.handleFlickInput.bind(this);
    this.togglePause = this.togglePause.bind(this);
    this.update = this.update.bind(this);
    this.reset();
  }

  // ノーツごとの基準打鍵数を返す（スマホモード時は清音化された文字数＝1フリック1打鍵、PCモード時は最短ローマ字打鍵数）
  _getNoteKeystrokes(note, isMobileMode) {
    if (!note) return 0;
    const rawReading = note.reading || note.word || '';
    if (isMobileMode) {
      const base = toBaseKana(rawReading);
      return base.length > 0 ? base.length : 1;
    }
    return calculateMinKeystrokes(rawReading);
  }

  // 内部状態をすべて初期値に戻す。
  // useEffect（アンマウント処理）を使わない設計のため、画面を切り替えても
  // このインスタンスの内部変数は生き残り続ける。start() の先頭で必ず呼び、
  // 「1曲目プレイ→リザルト→2曲目プレイ」で前回の状態が残るバグを防ぐ。
  reset() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.currentTime = 0;
    this.queue = [];
    this.currentTarget = null;
    this.romajiParser = null;
    this.mobileTargetKana = "";
    this.mobileTypedIndex = 0;
    this.firstHitMiss = false;
    this.currentTargetJudged = false;
    this.absorbTrailingN = false;
    this.isFallbackMode = false;
    this.audioStarted = false;
    this.leadInTime = 0;
    this.fallbackEndTime = 0;
    this.realStartTime = 0;
    this.mockStartTime = 0;
    // スコア計算・統計もここで初期化する（前回プレイの持ち越し防止）
    this.scorePerChar = 0;
    this.stats = { typosByChar: {}, mistakeLog: [], totalNotes: 0 };
  }

  updateCurrentTarget(store, newTarget) {
    this.currentTarget = newTarget;
    this.firstHitMiss = false;
    this.currentTargetJudged = false;
    this.absorbTrailingN = false;
    if (this.currentTarget) {
      const rawReading = this.currentTarget.reading || this.currentTarget.word || "";
      const reading = store.isMobileMode ? toBaseKana(rawReading) : rawReading;
      let nextReading = "";
      if (this.queue.length > 0) {
        const nextNote = this.queue[0];
        if (Math.abs(this.currentTarget.endTime - nextNote.time) <= 50) {
          const rawNext = nextNote.reading || nextNote.word || "";
          nextReading = store.isMobileMode ? toBaseKana(rawNext) : rawNext;
        }
      }
      this.romajiParser = new RomajiParser(reading, nextReading);

      if (store.isMobileMode) {
        this.mobileTargetKana = reading;
        this.mobileTypedIndex = 0;
        store.setTargetState(
          this.currentTarget,
          this.mobileTargetKana,
          this.mobileTypedIndex
        );
      } else {
        this.mobileTargetKana = "";
        this.mobileTypedIndex = 0;
        const displayState = this.romajiParser.getDisplayState();
        store.setTargetState(
          this.currentTarget,
          displayState.typed + displayState.next + displayState.remaining,
          displayState.typed.length
        );
      }
    } else {
      this.romajiParser = null;
      this.mobileTargetKana = "";
      this.mobileTypedIndex = 0;
      store.setTargetState(null, null, 0);
    }
  }
  togglePause() {
    const store = useGameStore.getState();
    if (store.status !== 'playing') return;

    if (store.isPaused) {
      // Resume
      store.setIsPaused(false);
      const now = performance.now();

      if (!this.audioStarted) {
        // Adjust realStartTime so elapsed time continues correctly
        this.realStartTime = now - (this.currentTime + this.leadInTime);
      } else if (this.isFallbackMode) {
        this.mockStartTime = now - this.currentTime;
      }

      if (this.audioStarted && this.audio) {
        this.audio.play().catch(e => console.warn(e));
      }
      this.animationFrameId = requestAnimationFrame(this.update);
    } else {
      // Pause
      store.setIsPaused(true);
      if (this.audio) {
        this.audio.pause();
      }
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
  }

  start() {
    const store = useGameStore.getState();
    const { loadedScore, audioUrl } = store;

    if (!loadedScore || !audioUrl) {
      console.error("Score or Audio is not loaded");
      return;
    }

    // 前回プレイの内部状態（アニメーションループ・キー監視・音声・タイマー類）を
    // 必ず初期化してから開始する（連続プレイ時の状態持ち越し防止）
    this.reset();

    store.resetPlayState();
    store.setStatus('playing');

    this.queue = [...loadedScore.notes]
      .filter(note => note && String(note.word || note.reading || '').trim().length > 0)
      .sort((a, b) => a.time - b.time)
      .map(note => ({ ...note }));

    // スコア配点: 全ノーツの基準打鍵数の合計で 1,010,000 点を按分し、
    // 全 PERFECT でちょうど理論値 1,010,000 点になるようにする
    // （PCモードは最短ローマ字打鍵数、スマホモードは清音化された文字数＝1フリック1打鍵）
    let totalChars = 0;
    for (const note of this.queue) {
      totalChars += this._getNoteKeystrokes(note, store.isMobileMode);
    }
    this.totalNotesChars = totalChars > 0 ? totalChars : 1;
    this.accumulatedChars = 0;
    this.accumulatedMaxScore = 0;
    store.setMaxScore(1010000);

    // 統計トラッキングを初期化（リザルト画面用）
    this.stats = {
      typosByChar: {},
      mistakeLog: [],
      totalNotes: this.queue.length
    };

    this.updateCurrentTarget(store, this.queue.shift() || null);
    store.setWordQueue([...this.queue]);

    // リードイン（待機時間）の計算
    const firstNoteTime = this.currentTarget ? this.currentTarget.time : Infinity;
    this.leadInTime = firstNoteTime < 3000 ? 3000 : 0;
    this.currentTime = -this.leadInTime;
    this.realStartTime = performance.now();
    this.audioStarted = false;

    this.isFallbackMode = false;

    const lastNote = this.queue[this.queue.length - 1] || this.currentTarget;
    this.fallbackEndTime = (lastNote ? lastNote.endTime : 0) + 2000;

    // 前回の音声は reset() で破棄済みのため、ここでは新規生成だけ行う
    this.audio = new Audio(audioUrl);
    this.audio.currentTime = 0;
    // ※倍速は音声の再生速度(playbackRate)では変えず、ノーツのスクロール速度のみに適用する
    //   （設定値 4.00＝標準 1.0倍 となるよう getEffectiveSpeedMultiplier で speed / 4.0 に補正）

    if (this.leadInTime === 0) {
      this.audio.volume = 0.5;
      this.startAudio();
    } else {
      this.audio.volume = 0;
      // ユーザーアクション中に再生を試みてアンロックする
      this.audio.play().then(() => {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.volume = 0.5;
      }).catch(e => {
        console.warn("Audio unlock failed:", e);
        this.audio.volume = 0.5;
      });
    }

    window.addEventListener('keydown', this.handleKeyDown);
    this.animationFrameId = requestAnimationFrame(this.update);
  }

  startAudio() {
    this.audioStarted = true;
    if (this.audio) {
      this.audio.play().catch(e => {
        console.warn("Audio play failed, switching to fallback mode:", e);
        this.isFallbackMode = true;
        this.mockStartTime = performance.now();
      });
    }
  }

  stop(finishToResult = true) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audio) {
      this.audio.pause();
    }
    window.removeEventListener('keydown', this.handleKeyDown);

    const store = useGameStore.getState();

    if (!finishToResult) {
      this.updateCurrentTarget(store, null);
      return;
    }

    // 打ち残し判定（曲終了時点で未完了ノーツが残っていた場合は統計のみ記録し、余計な最終判定ポップアップは出さない）
    const isCurrentIncomplete = store.isMobileMode
      ? Boolean(this.mobileTargetKana && this.mobileTypedIndex < this.mobileTargetKana.length)
      : Boolean(this.romajiParser && !this.romajiParser.isComplete());

    if (this.currentTarget && isCurrentIncomplete) {
      store.addDroppedCount();
      store.setCombo(0);
      if (!this.currentTargetJudged) {
        store.addMissCount();
      }
      this.stats.mistakeLog.push({ time: this.currentTime / 1000, note: this.currentTarget.word, type: "dropped" });
    }

    // リザルト画面では現在ターゲットを表示しないため、打ち残しの有無にかかわらず
    // 常にクリアする（次回プレイへの状態持ち越しも防げる）
    this.updateCurrentTarget(store, null);

    // 最終結果を集計してストアに保存（リザルト画面は statsData を参照する）
    const sortedWorst = Object.entries(this.stats.typosByChar)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => ({ char: entry[0], count: entry[1] }));

    const clearRate = store.completedCount > 0
      ? (store.completedCount / this.stats.totalNotes) * 100
      : 0;

    store.setStatsData({
      worstKeys: sortedWorst,
      mistakeLog: this.stats.mistakeLog,
      stats: {
        maxKps: store.maxKps,
        clearRate: clearRate.toFixed(2),
        totalNotes: this.stats.totalNotes,
        perfectCount: store.perfectCount,
        goodCount: store.goodCount,
        missCount: store.missCount
      }
    });

    store.setStatus('result');
  }

  update() {
    const now = performance.now();

    if (!this.audioStarted) {
      const elapsed = now - this.realStartTime;
      this.currentTime = -this.leadInTime + elapsed;

      if (this.currentTime >= 0) {
        this.currentTime = 0;
        this.startAudio();
      }
    } else {
      if (this.isFallbackMode) {
        this.currentTime = now - this.mockStartTime;
      } else if (this.audio) {
        this.currentTime = this.audio.currentTime * 1000;
      } else {
        return;
      }
    }

    this.checkForceTransition();

    let shouldEnd = false;
    if (this.isFallbackMode) {
      if (!this.currentTarget && this.queue.length === 0 && this.currentTime > this.fallbackEndTime) {
        shouldEnd = true;
      }
    } else {
      shouldEnd = this.audio && this.audio.ended;
    }

    if (shouldEnd) {
      this.stop();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.update);
  }

  // 現在ターゲットの制限時刻を算出する
  // ・1打目未入力(!this.currentTargetJudged)の場合：
  //   ノーツが判定ラインを通過して MISS 判定幅（+150ms）を過ぎた瞬間に即 MISS 確定とする。
  //   （次のノーツが判定ライン手前に来たタイミングで遅れて MISS が出たり、最後のノーツ通過後に謎の遅れ判定が出るのを防ぐ）
  // ・1打目入力済み(this.currentTargetJudged)の場合：
  //   残りの文字を打ち切る猶予を endTime または次ノーツの判定開始枠まで持たせる。
  _getTimeLimit(store) {
    if (!this.currentTarget) return Infinity;

    if (!this.currentTargetJudged) {
      return this.currentTarget.time + JUDGE_WINDOW.MISS;
    }

    const nextWordTime = this.queue.length > 0 ? this.queue[0].time : Infinity;
    const maxTypingEnd = Math.min(
      this.currentTarget.endTime,
      this.currentTarget.time + Math.max(500, this._getNoteKeystrokes(this.currentTarget, store.isMobileMode) * 300)
    );
    return Math.max(
      this.currentTarget.time + JUDGE_WINDOW.MISS,
      Math.min(maxTypingEnd, nextWordTime - JUDGE_WINDOW.MISS)
    );
  }

  checkForceTransition() {
    if (!this.currentTarget) return;
    const store = useGameStore.getState();
    const timeLimit = this._getTimeLimit(store);

    if (this.currentTime - store.offsetMs >= timeLimit) {
      this.forceMissAndTransition();
    }
  }

  forceMissAndTransition() {
    const store = useGameStore.getState();

    if (!this.currentTargetJudged) {
      // 1打目未入力のまま判定ライン（+150ms）を通過した場合：ここで MISS 判定を1回だけ発生させる
      this.applyJudgment('MISS');
      store.addDroppedCount();
      this.stats.mistakeLog.push({ time: this.currentTime / 1000, note: this.currentTarget.word, type: "dropped" });
    } else {
      // 1打目は判定ライン上で既に判定済みだが、2文字目以降を時間内に打ち切れなかった場合：
      // 判定ラインから離れた場所で2回目の遅れ MISS ポップアップが出ないよう、コンボリセットと打ち残し記録のみ行う
      store.setCombo(0);
      store.addDroppedCount();
      this.stats.mistakeLog.push({ time: this.currentTime / 1000, note: this.currentTarget.word, type: "dropped" });
    }

    this.updateCurrentTarget(store, this.queue.shift() || null);
    store.setWordQueue([...this.queue]);
  }

  // スマホモード専用：フリックテンキーからの1文字（清音）入力判定
  handleFlickInput(inputKana) {
    if (!inputKana || !this.currentTarget) return;
    const store = useGameStore.getState();
    if (store.status !== 'playing' || store.isPaused) return;
    if (!this.mobileTargetKana) return;

    const currentTimeMs = this.currentTime - store.offsetMs;
    const timeLimit = this._getTimeLimit(store);

    if (currentTimeMs >= timeLimit) {
      return;
    }

    const normalizedInput = toBaseKana(inputKana);
    const expectedChar = this.mobileTargetKana[this.mobileTypedIndex] || "?";
    const isFirstHit = this.mobileTypedIndex === 0;

    if (isFirstHit) {
      const targetTime = this.currentTarget.time;
      const diff = Math.abs(targetTime - currentTimeMs);

      if (diff > JUDGE_WINDOW.MISS) {
        return;
      }

      if (normalizedInput !== expectedChar) {
        store.addTypoCount();
        store.triggerVocalMiss();
        this.stats.typosByChar[expectedChar] = (this.stats.typosByChar[expectedChar] || 0) + 1;
        this.stats.mistakeLog.push({ time: currentTimeMs / 1000, note: this.currentTarget.word, type: "typo", char: expectedChar });
        return;
      }

      if (diff <= JUDGE_WINDOW.PERFECT) {
        this.applyJudgment('PERFECT');
      } else if (diff <= JUDGE_WINDOW.GOOD) {
        this.applyJudgment('GOOD');
      } else if (diff <= JUDGE_WINDOW.MISS) {
        this.applyJudgment('MISS');
        this.firstHitMiss = true;
        this.stats.mistakeLog.push({ time: currentTimeMs / 1000, note: this.currentTarget.word, type: "miss" });
      }
    } else {
      if (normalizedInput !== expectedChar) {
        store.addTypoCount();
        store.triggerVocalMiss();
        this.stats.typosByChar[expectedChar] = (this.stats.typosByChar[expectedChar] || 0) + 1;
        this.stats.mistakeLog.push({ time: currentTimeMs / 1000, note: this.currentTarget.word, type: "typo", char: expectedChar });
        return;
      }
    }

    this.mobileTypedIndex += 1;
    const remainingKana = this.mobileTargetKana.substring(this.mobileTypedIndex);
    this.romajiParser = new RomajiParser(remainingKana);

    store.setTargetState(
      this.currentTarget,
      this.mobileTargetKana,
      this.mobileTypedIndex
    );

    if (this.mobileTypedIndex >= this.mobileTargetKana.length) {
      this.completeCurrentTarget();
    }
  }

  handleKeyDown(e) {
    if (e.repeat) return;
    if (e.key === 'Escape') {
      this.togglePause();
      return;
    }
    const store = useGameStore.getState();
    if (store.status !== 'playing' || store.isPaused) return;
    if (!/^[a-zA-Z0-9\-]$/.test(e.key)) return;
    if (!this.currentTarget || !this.romajiParser) return;

    const currentTimeMs = this.currentTime - store.offsetMs;
    const timeLimit = this._getTimeLimit(store);

    if (currentTimeMs >= timeLimit) {
      return;
    }

    const isFirstHit = store.isMobileMode
      ? (this.mobileTypedIndex === 0 && this.romajiParser.typedString.length === 0)
      : (this.romajiParser.typedString.length === 0);

    if (isFirstHit) {
      // 直前のノーツ末尾の「ん」を単独 n で完了した直後に、慣れで2打目の n (nn) が打たれた場合は吸収してミスにしない
      if (this.absorbTrailingN) {
        this.absorbTrailingN = false;
        if (e.key.toLowerCase() === 'n') {
          return;
        }
      }

      const targetTime = this.currentTarget.time;
      const diff = Math.abs(targetTime - currentTimeMs);

      if (diff > JUDGE_WINDOW.MISS) {
        return;
      }

      const isCorrect = this.romajiParser.input(e.key);
      if (!isCorrect) {
        const expectedChar = store.isMobileMode
          ? (this.mobileTargetKana[this.mobileTypedIndex] || "?")
          : (this.romajiParser.getDisplayState().next[0] || "?");
        store.addTypoCount();
        store.triggerVocalMiss();
        this.stats.typosByChar[expectedChar] = (this.stats.typosByChar[expectedChar] || 0) + 1;
        this.stats.mistakeLog.push({ time: currentTimeMs / 1000, note: this.currentTarget.word, type: "typo", char: expectedChar });
        return;
      }

      if (diff <= JUDGE_WINDOW.PERFECT) {
        this.applyJudgment('PERFECT');
      } else if (diff <= JUDGE_WINDOW.GOOD) {
        this.applyJudgment('GOOD');
      } else if (diff <= JUDGE_WINDOW.MISS) {
        this.applyJudgment('MISS');
        this.firstHitMiss = true;
        this.stats.mistakeLog.push({ time: currentTimeMs / 1000, note: this.currentTarget.word, type: "miss" });
      }
    } else {
      this.absorbTrailingN = false;
      const isCorrect = this.romajiParser.input(e.key);
      if (!isCorrect) {
        const expectedChar = store.isMobileMode
          ? (this.mobileTargetKana[this.mobileTypedIndex] || "?")
          : (this.romajiParser.getDisplayState().next[0] || "?");
        store.addTypoCount();
        store.triggerVocalMiss();
        this.stats.typosByChar[expectedChar] = (this.stats.typosByChar[expectedChar] || 0) + 1;
        this.stats.mistakeLog.push({ time: currentTimeMs / 1000, note: this.currentTarget.word, type: "typo", char: expectedChar });
        return;
      }
    }

    if (store.isMobileMode) {
      const minTokenIdx = this.romajiParser.activeNodes.length > 0
        ? Math.min(...this.romajiParser.activeNodes.map(n => n.tokenIndex))
        : this.mobileTargetKana.length;
      const baseOffset = this.mobileTargetKana.length - this.romajiParser.tokens.length;
      this.mobileTypedIndex = Math.min(this.mobileTargetKana.length, baseOffset + minTokenIdx);
      store.setTargetState(
        this.currentTarget,
        this.mobileTargetKana,
        this.mobileTypedIndex
      );
    } else {
      const displayState = this.romajiParser.getDisplayState();
      store.setTargetState(
        this.currentTarget,
        displayState.typed + displayState.next + displayState.remaining,
        displayState.typed.length
      );
    }

    if (this.romajiParser.isComplete()) {
      this.completeCurrentTarget();
    }
  }

  applyJudgment(judgment) {
    const store = useGameStore.getState();
    this.currentTargetJudged = true;
    const noteChars = this._getNoteKeystrokes(this.currentTarget, store.isMobileMode);

    this.accumulatedChars += noteChars;
    const targetScore = Math.floor((1010000 * this.accumulatedChars) / this.totalNotesChars);
    const maxPossibleDiff = targetScore - this.accumulatedMaxScore;
    this.accumulatedMaxScore = targetScore;

    if (judgment === 'PERFECT') {
      store.setLastJudgment('PERFECT');
      store.addScore(maxPossibleDiff);
      store.addPerfectCount();
      store.triggerVocalSing();
      playPerfect();
    } else if (judgment === 'GOOD') {
      store.setLastJudgment('GOOD');
      store.addScore(Math.floor(maxPossibleDiff * 0.5));
      store.addGoodCount();
      store.triggerVocalSing();
      playGood();
    } else if (judgment === 'MISS') {
      store.setLastJudgment('MISS');
      store.setCombo(0);
      store.addMissCount();
      store.triggerVocalMiss();
      playMiss();
    }
  }
  completeCurrentTarget() {
    const store = useGameStore.getState();

    const completedWithSingleN = Boolean(
      !store.isMobileMode &&
      this.romajiParser &&
      this.romajiParser.tokens.length > 0 &&
      this.romajiParser.tokens[this.romajiParser.tokens.length - 1] === 'ん' &&
      this.romajiParser.typedString.endsWith('n') &&
      !this.romajiParser.typedString.endsWith('nn') &&
      !this.romajiParser.typedString.endsWith('xn')
    );

    store.addCompletedCount();
    if (!this.firstHitMiss) {
      store.setCombo(store.combo + 1);
      store.triggerVocalSing();
    }

    const durationSec = (this.currentTarget.endTime - this.currentTarget.time) / 1000;
    if (durationSec > 0) {
      const strokeCount = this._getNoteKeystrokes(this.currentTarget, store.isMobileMode);
      const kps = Math.min(30, strokeCount / durationSec);
      store.updateMaxKps(kps);
    }

    this.updateCurrentTarget(store, this.queue.shift() || null);
    this.absorbTrailingN = completedWithSingleN;
    store.setWordQueue([...this.queue]);
  }

  getCurrentTime() {
    return this.currentTime;
  }

  // 設定画面のレーン速度（1.00〜10.00、標準基準値 4.00）を実効速度乗数（speed / 4.0）に変換する
  // これにより従来の設定値 1.00 のノーツ速度と、新設定値 4.00 のノーツ速度が完全に一致する
  getEffectiveSpeedMultiplier(speed = useGameStore.getState().speedMultiplier) {
    const val = typeof speed === 'number' ? speed : 4.0;
    return val / 4.0;
  }
}

export const gameEngine = new GameEngine();
