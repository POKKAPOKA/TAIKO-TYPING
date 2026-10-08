import { useGameStore } from '../store/gameStore';
import { RomajiParser, calculateMinKeystrokes } from './RomajiParser';

const JUDGE_WINDOW = {
  PERFECT: 50,
  GOOD: 100,
  MISS: 150
};

export class GameEngine {
  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.togglePause = this.togglePause.bind(this);
    this.update = this.update.bind(this);
    this.reset();
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
    this.firstHitMiss = false;
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
    if (this.currentTarget) {
      const reading = this.currentTarget.reading || this.currentTarget.word;
      let nextReading = "";
      if (this.queue.length > 0) {
        const nextNote = this.queue[0];
        if (Math.abs(this.currentTarget.endTime - nextNote.time) < 1) {
          nextReading = nextNote.reading || nextNote.word || "";
        }
      }
      this.romajiParser = new RomajiParser(reading, nextReading);

      const displayState = this.romajiParser.getDisplayState();
      store.setTargetState(
        this.currentTarget,
        displayState.typed + displayState.next + displayState.remaining,
        displayState.typed.length
      );
    } else {
      this.romajiParser = null;
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

    this.queue = [...loadedScore.notes].sort((a, b) => a.time - b.time).map(note => ({ ...note }));

    // スコア配点: 全ノーツのローマ字最短打鍵数の合計で 1,010,000 点を按分し、
    // 全 PERFECT でちょうど理論値 1,010,000 点になるようにする
    let totalChars = 0;
    for (const note of this.queue) {
      totalChars += calculateMinKeystrokes(note.reading || note.word || '');
    }
    this.scorePerChar = totalChars > 0 ? 1010000 / totalChars : 0;
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
    //   （NotesArea.jsx側で NOTE_SPEED * speedMultiplier を使用）

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

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audio) {
      this.audio.pause();
    }
    window.removeEventListener('keydown', this.handleKeyDown);

    const store = useGameStore.getState();

    // 打ち残し判定
    if (this.currentTarget && this.romajiParser && !this.romajiParser.isComplete()) {
      store.addDroppedCount();
      store.setCombo(0);
      store.setLastJudgment('MISS');
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

  checkForceTransition() {
    if (!this.currentTarget) return;
    const offsetMs = useGameStore.getState().offsetMs;
    const nextWordTime = this.queue.length > 0 ? this.queue[0].time : Infinity;

    const timeLimit = Math.min(this.currentTarget.endTime + JUDGE_WINDOW.MISS, nextWordTime - JUDGE_WINDOW.MISS);

    if (this.currentTime - offsetMs >= timeLimit) {
      this.forceMissAndTransition();
    }
  }

  forceMissAndTransition() {
    const store = useGameStore.getState();

    store.setLastJudgment('MISS');
    store.setCombo(0);
    store.addDroppedCount();
    this.stats.mistakeLog.push({ time: this.currentTime / 1000, note: this.currentTarget.word, type: "dropped" });

    this.updateCurrentTarget(store, this.queue.shift() || null);
    store.setWordQueue([...this.queue]);
  }

  handleKeyDown(e) {
    if (e.repeat) return;
    if (e.key === 'Escape') {
      this.togglePause();
      return;
    }
    if (!/^[a-zA-Z0-9\-]$/.test(e.key)) return;
    if (!this.currentTarget || !this.romajiParser) return;

    const store = useGameStore.getState();
    const currentTimeMs = this.currentTime - store.offsetMs;
    const nextWordTime = this.queue.length > 0 ? this.queue[0].time : Infinity;
    const timeLimit = Math.min(this.currentTarget.endTime + JUDGE_WINDOW.MISS, nextWordTime - JUDGE_WINDOW.MISS);

    if (currentTimeMs >= timeLimit) {
      return;
    }

    const isFirstHit = this.romajiParser.typedString.length === 0;

    if (isFirstHit) {
      const targetTime = this.currentTarget.time;
      const diff = Math.abs(targetTime - currentTimeMs);

      if (diff > JUDGE_WINDOW.MISS) {
        return;
      }

      const isCorrect = this.romajiParser.input(e.key);
      if (!isCorrect) {
        const expectedChar = this.romajiParser.getDisplayState().next[0] || "?";
        useGameStore.getState().addTypoCount();
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
      const isCorrect = this.romajiParser.input(e.key);
      if (!isCorrect) {
        const expectedChar = this.romajiParser.getDisplayState().next[0] || "?";
        useGameStore.getState().addTypoCount();
        this.stats.typosByChar[expectedChar] = (this.stats.typosByChar[expectedChar] || 0) + 1;
        this.stats.mistakeLog.push({ time: currentTimeMs / 1000, note: this.currentTarget.word, type: "typo", char: expectedChar });
        return;
      }
    }

    const displayState = this.romajiParser.getDisplayState();
    store.setTargetState(
      this.currentTarget,
      displayState.typed + displayState.next + displayState.remaining,
      displayState.typed.length
    );

    if (this.romajiParser.isComplete()) {
      this.completeCurrentTarget();
    }
  }

  applyJudgment(judgment) {
    const store = useGameStore.getState();
    // ノーツの最短打鍵数に応じて配点する（長いノーツほど高得点）
    const noteChars = this.currentTarget
      ? calculateMinKeystrokes(this.currentTarget.reading || this.currentTarget.word || '')
      : 0;
    const baseScore = this.scorePerChar * noteChars;

    if (judgment === 'PERFECT') {
      store.setLastJudgment('PERFECT');
      store.addScore(Math.floor(baseScore));
      store.addPerfectCount();
    } else if (judgment === 'GOOD') {
      store.setLastJudgment('GOOD');
      store.addScore(Math.floor(baseScore * 0.5));
      store.addGoodCount();
    } else if (judgment === 'MISS') {
      store.setLastJudgment('MISS');
      store.setCombo(0);
      store.addMissCount();
    }
  }
  completeCurrentTarget() {
    const store = useGameStore.getState();

    store.addCompletedCount();
    if (!this.firstHitMiss) {
      store.setCombo(store.combo + 1);
    }

    const durationSec = (this.currentTarget.endTime - this.currentTarget.time) / 1000;
    if (durationSec > 0) {
      const strokeCount = calculateMinKeystrokes(this.currentTarget.reading || this.currentTarget.word || '');
      const kps = strokeCount / durationSec;
      store.updateMaxKps(kps);
    }

    this.updateCurrentTarget(store, this.queue.shift() || null);
    store.setWordQueue([...this.queue]);
  }

  getCurrentTime() {
    return this.currentTime;
  }
}

export const gameEngine = new GameEngine();
