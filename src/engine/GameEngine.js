import { useGameStore } from '../store/gameStore';
import { RomajiParser } from './RomajiParser';

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
    this.isFallbackMode = false;
    this.mockStartTime = 0;
    this.romajiParser = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.update = this.update.bind(this);
  }

  updateCurrentTarget(store, newTarget) {
    this.currentTarget = newTarget;
    if (this.currentTarget) {
      const reading = this.currentTarget.reading || this.currentTarget.word;
      this.romajiParser = new RomajiParser(reading);
      
      const displayState = this.romajiParser.getDisplayState();
      store.setActiveWord(displayState.typed + displayState.next + displayState.remaining);
      store.setTypedIndex(displayState.typed.length);
    } else {
      this.romajiParser = null;
      store.setActiveWord(null);
      store.setTypedIndex(0);
    }
    store.setCurrentTarget(this.currentTarget);
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
    
    this.queue = [...loadedScore.notes].sort((a, b) => a.time - b.time).map(note => ({ ...note }));
    
    store.setMaxScore(this.queue.length * 100);

    this.updateCurrentTarget(store, this.queue.shift() || null);
    store.setWordQueue([...this.queue]);
    
    this.isFallbackMode = false;
    this.mockStartTime = performance.now();

    if (this.audio) {
      this.audio.pause();
    }
    this.audio = new Audio(audioUrl);
    this.audio.volume = 0.5;
    this.audio.currentTime = 0;
    
    this.audio.play().catch(e => {
      console.warn("Audio play failed, switching to fallback mode:", e);
      this.isFallbackMode = true;
      this.mockStartTime = performance.now();
    });
    
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

    // 打ち残し判定
    if (this.currentTarget && this.romajiParser && !this.romajiParser.isComplete()) {
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
    if (this.isFallbackMode) {
      this.currentTime = performance.now() - this.mockStartTime;
    } else if (this.audio) {
      this.currentTime = this.audio.currentTime * 1000;
    } else {
      return;
    }

    this.checkForceTransition();

    const isAudioEnded = this.audio && this.audio.ended;
    if (isAudioEnded || (!this.currentTarget && this.queue.length === 0)) {
      this.stop();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.update);
  }

  checkForceTransition() {
    if (!this.currentTarget) return;
    const nextWordTime = this.queue.length > 0 ? this.queue[0].time : Infinity;
    
    const timeLimit = Math.min(this.currentTarget.endTime + 150, nextWordTime - 150);
    
    if (this.currentTime >= timeLimit) {
      this.forceMissAndTransition();
    }
  }

  forceMissAndTransition() {
    const store = useGameStore.getState();
    
    store.setLastJudgment('MISS');
    store.setCombo(0);
    store.addDroppedCount(); 
    
    this.updateCurrentTarget(store, this.queue.shift() || null);
    store.setWordQueue([...this.queue]);
  }

  handleKeyDown(e) {
    if (!/^[a-zA-Z]$/.test(e.key)) return;
    if (!this.currentTarget || !this.romajiParser) return;

    const currentTimeMs = this.isFallbackMode ? performance.now() - this.mockStartTime : (this.audio ? this.audio.currentTime * 1000 : this.currentTime);
    const nextWordTime = this.queue.length > 0 ? this.queue[0].time : Infinity;
    const timeLimit = Math.min(this.currentTarget.endTime + 150, nextWordTime - 150);

    if (currentTimeMs >= timeLimit) {
      return;
    }

    const isFirstHit = this.romajiParser.typedString.length === 0;

    if (isFirstHit) {
      const targetTime = this.currentTarget.time;
      const diff = Math.abs(targetTime - currentTimeMs);

      if (diff > 150) {
        return; 
      }

      const isCorrect = this.romajiParser.input(e.key);
      if (!isCorrect) {
        useGameStore.getState().addTypoCount();
        return;
      }

      if (diff <= 50) {
        this.applyJudgment('JUSTICE');
      } else if (diff <= 100) {
        this.applyJudgment('ATTACK');
      } else if (diff <= 150) {
        this.applyJudgment('MISS');
      }
    } else {
      const isCorrect = this.romajiParser.input(e.key);
      if (!isCorrect) {
        useGameStore.getState().addTypoCount();
        return;
      }
    }

    // UIを動的更新
    const displayState = this.romajiParser.getDisplayState();
    useGameStore.getState().setActiveWord(displayState.typed + displayState.next + displayState.remaining);
    useGameStore.getState().setTypedIndex(displayState.typed.length);
    
    if (this.romajiParser.isComplete()) {
      this.completeCurrentTarget();
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
      store.setCombo(0); 
      store.addMissCount();
    }
  }

  completeCurrentTarget() {
    const store = useGameStore.getState();
    
    store.addCompletedCount();
    store.setCombo(store.combo + 1);

    const durationSec = (this.currentTarget.endTime - this.currentTarget.time) / 1000;
    if (durationSec > 0) {
      const charCount = this.currentTarget.reading ? this.currentTarget.reading.length : this.currentTarget.word.length;
      const kps = charCount / durationSec;
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
