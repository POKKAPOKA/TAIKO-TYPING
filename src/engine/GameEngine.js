import { useGameStore } from '../store/gameStore';

const JUDGE_WINDOW = {
  PERFECT: 50,
  GOOD: 100,
  MISS: 150
};

export class GameEngine {
  constructor() {
    this.animationFrameId = null;
    this.currentTime = 0;
    this.queue = [];
    this.currentTarget = null;
    this.audio = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.update = this.update.bind(this);
  }

  updateCurrentTarget(store, newTarget) {
    this.currentTarget = newTarget;
    store.setCurrentTarget(this.currentTarget);
    store.setActiveWord(this.currentTarget ? this.currentTarget.word : null);
    store.setTypedIndex(0);
  }

  start() {
    const store = useGameStore.getState();
    const { loadedScore, audioUrl } = store;
    
    if (!loadedScore || !audioUrl) {
      console.error("Score or Audio is not loaded");
      return;
    }

    store.resetPlayState();
    store.setStatus('playing');
    
    this.queue = [...loadedScore.notes].sort((a, b) => a.time - b.time).map(note => ({ ...note, typed: "" }));
    
    store.setMaxScore(this.queue.length * 100);

    this.updateCurrentTarget(store, this.queue.shift() || null);
    store.setWordQueue([...this.queue]);
    
    if (this.audio) {
      this.audio.pause();
    }
    this.audio = new Audio(audioUrl);
    this.audio.volume = 0.5;
    this.audio.currentTime = 0;
    
    this.audio.play().catch(e => console.error("Audio play failed:", e));
    
    window.addEventListener('keydown', this.handleKeyDown);
    this.animationFrameId = requestAnimationFrame(this.update);
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.audio) {
      this.audio.pause();
    }
    window.removeEventListener('keydown', this.handleKeyDown);

    const store = useGameStore.getState();

    // 打ち残し（現在のターゲットが存在し、最後まで打たれていない場合）
    if (this.currentTarget && this.currentTarget.typed.length < this.currentTarget.word.length) {
      store.addDroppedCount();
      store.setCombo(0);
      store.setLastJudgment('MISS');
      this.updateCurrentTarget(store, null);
    } else {
      store.setActiveWord(null);
      store.setTypedIndex(0);
    }

    store.setStatus('result');
  }

  update() {
    if (!this.audio) return;
    this.currentTime = this.audio.currentTime * 1000;
    this.checkForceTransition();

    // オーディオが終了しているか、全ノーツ完了で終了
    if (this.audio.ended || (!this.currentTarget && this.queue.length === 0)) {
      this.stop();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.update);
  }

  checkForceTransition() {
    if (!this.currentTarget) return;
    const nextWordTime = this.queue.length > 0 ? this.queue[0].time : Infinity;
    
    // タイムリミット: 現在の単語の終了時刻+150ms、または次の単語の受付開始時刻（150ms前）の早い方
    const timeLimit = Math.min(this.currentTarget.endTime + 150, nextWordTime - 150);
    
    if (this.currentTime >= timeLimit) {
      this.forceMissAndTransition();
    }
  }

  forceMissAndTransition() {
    const store = useGameStore.getState();
    
    store.setLastJudgment('MISS');
    store.setCombo(0);
    store.addDroppedCount(); // 時間切れによる打ちこぼし
    
    this.updateCurrentTarget(store, this.queue.shift() || null);
    store.setWordQueue([...this.queue]);
  }

  handleKeyDown(e) {
    if (!/^[a-zA-Z]$/.test(e.key)) return;
    if (!this.currentTarget) return;

    // 現在の正確な時刻を取得し、タイムリミット超過時の遅延入力を完全にガードする
    const currentTimeMs = this.audio ? this.audio.currentTime * 1000 : this.currentTime;
    const nextWordTime = this.queue.length > 0 ? this.queue[0].time : Infinity;
    const timeLimit = Math.min(this.currentTarget.endTime + 150, nextWordTime - 150);

    if (currentTimeMs >= timeLimit) {
      return; // タイムリミットを過ぎた入力は無視
    }

    const key = e.key.toUpperCase();

    const targetWord = this.currentTarget.word;
    const typedLen = this.currentTarget.typed.length;
    const nextChar = targetWord[typedLen];

    if (key !== nextChar) {
      // 誤タイプ時は typoCount をインクリメント (コンボは継続)
      useGameStore.getState().addTypoCount();
      return;
    }

    const isFirstHit = typedLen === 0;
    
    if (isFirstHit) {
      const targetTime = this.currentTarget.time;
      const diff = Math.abs(targetTime - currentTimeMs);

      // 単一フローで前後対称に確実な評価を行う
      if (diff <= 50) {
        this.applyJudgment('JUSTICE');
      } else if (diff <= 100) {
        this.applyJudgment('ATTACK');
      } else if (diff <= 150) {
        this.applyJudgment('MISS');
      } else {
        // 150ms より外側の入力は完全に無視（空振り扱い）
        return;
      }
    }

    this.currentTarget.typed += key;
    useGameStore.getState().setTypedIndex(this.currentTarget.typed.length);
    
    if (this.currentTarget.typed.length === targetWord.length) {
      this.completeCurrentTarget();
    } else {
      useGameStore.getState().setCurrentTarget({ ...this.currentTarget });
    }
  }

  applyJudgment(judgment) {
    const store = useGameStore.getState();

    if (judgment === 'JUSTICE') {
      store.setLastJudgment('JUSTICE');
      store.addScore(100);
      store.addJusticeCount();
    } else if (judgment === 'ATTACK') {
      store.setLastJudgment('ATTACK');
      store.addScore(50);
      store.addAttackCount();
    } else if (judgment === 'MISS') {
      store.setLastJudgment('MISS');
      store.setCombo(0); // 1打目MISSでコンボリセット
      store.addMissCount();
    }
  }

  completeCurrentTarget() {
    const store = useGameStore.getState();
    
    // 単語を最後まで打ち切った場合
    store.addCompletedCount();
    store.setCombo(store.combo + 1);

    // 譜面の理論上の要求KPSを計算して更新
    const durationSec = (this.currentTarget.endTime - this.currentTarget.time) / 1000;
    if (durationSec > 0) {
      const kps = this.currentTarget.word.length / durationSec;
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
