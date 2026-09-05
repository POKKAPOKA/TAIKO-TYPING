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

  start() {
    const store = useGameStore.getState();
    const { loadedScore, audioUrl } = store;
    
    if (!loadedScore || !audioUrl) {
      console.error("Score or Audio is not loaded");
      return;
    }

    store.reset();
    store.setStatus('playing');
    
    this.queue = [...loadedScore.notes].sort((a, b) => a.time - b.time).map(note => ({ ...note, typed: "" }));
    
    store.setMaxScore(this.queue.length * 100);

    this.currentTarget = this.queue.shift() || null;
    
    store.setWordQueue([...this.queue]);
    store.setCurrentTarget(this.currentTarget);
    
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
    useGameStore.getState().setStatus('result');
  }

  update() {
    if (!this.audio) return;
    this.currentTime = this.audio.currentTime * 1000;
    this.checkForceTransition();

    if (!this.currentTarget && this.queue.length === 0) {
      this.stop();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.update);
  }

  checkForceTransition() {
    if (!this.currentTarget) return;
    const nextWordTime = this.queue.length > 0 ? this.queue[0].time : Infinity;
    
    if (this.currentTime >= nextWordTime) {
      this.forceMissAndTransition();
    }
  }

  forceMissAndTransition() {
    const store = useGameStore.getState();
    
    store.setLastJudgment('MISS');
    store.setCombo(0);
    store.addMissCount();
    
    this.currentTarget = this.queue.shift() || null;
    
    store.setWordQueue([...this.queue]);
    store.setCurrentTarget(this.currentTarget);
  }

  handleKeyDown(e) {
    if (!/^[a-zA-Z]$/.test(e.key)) return;
    
    const key = e.key.toUpperCase();
    if (!this.currentTarget) return;

    const targetWord = this.currentTarget.word;
    const typedLen = this.currentTarget.typed.length;
    const nextChar = targetWord[typedLen];

    if (key !== nextChar) {
      return;
    }

    const isFirstHit = typedLen === 0;
    
    if (isFirstHit) {
      const timeDiff = Math.abs(this.currentTime - this.currentTarget.time);
      if (timeDiff > JUDGE_WINDOW.MISS) {
        // 150ms より外側の入力は完全に無視（空振り扱い）
        return;
      }
      this.judgeRhythm(timeDiff);
    }

    this.currentTarget.typed += key;
    
    if (this.currentTarget.typed.length === targetWord.length) {
      this.completeCurrentTarget();
    } else {
      useGameStore.getState().setCurrentTarget({ ...this.currentTarget });
    }
  }

  judgeRhythm(timeDiff) {
    const store = useGameStore.getState();

    if (timeDiff <= JUDGE_WINDOW.PERFECT) {
      store.setLastJudgment('JUSTICE');
      store.addScore(100);
    } else if (timeDiff <= JUDGE_WINDOW.GOOD) {
      store.setLastJudgment('ATTACK');
      store.addScore(50);
    } else if (timeDiff <= JUDGE_WINDOW.MISS) {
      store.setLastJudgment('MISS');
      store.setCombo(0);
      store.addMissCount();
    }
  }

  completeCurrentTarget() {
    const store = useGameStore.getState();
    
    // 単語を最後まで打ち切った瞬間のみコンボを加算
    store.setCombo(store.combo + 1);
    
    this.currentTarget = this.queue.shift() || null;
    
    store.setWordQueue([...this.queue]);
    store.setCurrentTarget(this.currentTarget);
  }
  
  getCurrentTime() {
    return this.currentTime;
  }
}

export const gameEngine = new GameEngine();
