import { useGameStore } from '../store/gameStore';

// アプリケーション全体でAudioインスタンスおよびWeb Audioバッファを共有し、プレロードを確実にする
const audioCache = {};

let audioCtx = null;
let perfectBuffer = null;
let isBufferLoading = false;
let goodBuffer = null;
let isGoodBufferLoading = false;
let missBuffer = null;
let isMissBufferLoading = false;
const hoverSound = { buffer: null, loading: false };
const clickSound = { buffer: null, loading: false };

export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      try {
        audioCtx = new AudioCtx();
      } catch (e) {
        console.warn('AudioContext creation failed:', e);
      }
    }
  }
  return audioCtx;
}

const unlockAudioContext = () => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
};

export function preloadPerfectSE() {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  if (perfectBuffer || isBufferLoading) return;
  isBufferLoading = true;

  fetch('/assets/se_perfect.mp3')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return res.arrayBuffer();
    })
    .then(arrayBuffer => {
      const ctx = getAudioContext();
      if (!ctx) return;
      return ctx.decodeAudioData(arrayBuffer);
    })
    .then(decoded => {
      if (decoded) {
        perfectBuffer = decoded;
      }
      isBufferLoading = false;
    })
    .catch(err => {
      console.warn('Failed to load se_perfect.mp3:', err);
      isBufferLoading = false;
    });
}

export function preloadGoodSE() {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  if (goodBuffer || isGoodBufferLoading) return;
  isGoodBufferLoading = true;

  fetch('/assets/se_good.mp3')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return res.arrayBuffer();
    })
    .then(arrayBuffer => {
      const ctx = getAudioContext();
      if (!ctx) return;
      return ctx.decodeAudioData(arrayBuffer);
    })
    .then(decoded => {
      if (decoded) {
        goodBuffer = decoded;
      }
      isGoodBufferLoading = false;
    })
    .catch(err => {
      console.warn('Failed to load se_good.mp3:', err);
      isGoodBufferLoading = false;
    });
}

export function preloadMissSE() {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  if (missBuffer || isMissBufferLoading) return;
  isMissBufferLoading = true;

  fetch('/assets/se_miss.mp3')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return res.arrayBuffer();
    })
    .then(arrayBuffer => {
      const ctx = getAudioContext();
      if (!ctx) return;
      return ctx.decodeAudioData(arrayBuffer);
    })
    .then(decoded => {
      if (decoded) {
        missBuffer = decoded;
      }
      isMissBufferLoading = false;
    })
    .catch(err => {
      console.warn('Failed to load se_miss.mp3:', err);
      isMissBufferLoading = false;
    });
}

const preloadAudio = (path) => {
  if (typeof window === 'undefined') return null;
  if (!audioCache[path]) {
    const audio = new Audio(path);
    audio.load();
    audioCache[path] = audio;
  }
  return audioCache[path];
};

// HTMLAudioElement.volume を無視する端末でも音量設定を反映する。
function preloadSystemBuffer(path, sound) {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  sound.loading = true;
  fetch(path)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return res.arrayBuffer();
    })
    .then(data => {
      const ctx = getAudioContext();
      return ctx ? ctx.decodeAudioData(data) : null;
    })
    .then(buffer => { sound.buffer = buffer; })
    .catch(err => console.warn(`Failed to load ${path}:`, err))
    .finally(() => { sound.loading = false; });
}

function playSystemSound(path, sound, baseVolume) {
  const volume = baseVolume * useGameStore.getState().systemSeVolume;
  if (volume === 0) return;
  const ctx = getAudioContext();
  if (ctx && sound.buffer) {
    try {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      source.buffer = sound.buffer;
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return;
    } catch (err) {
      console.warn('Web Audio system sound failed:', err);
    }
  }
  // 読み込み中は音量を制御できない HTML Audio に切り替えない。
  if (ctx && sound.loading) return;
  const audio = preloadAudio(path);
  if (!audio) return;
  const clone = audio.cloneNode();
  clone.volume = volume;
  clone.play().catch(() => {});
}

const playHover = () => {
  playSystemSound('/assets/se_hover.mp3', hoverSound, 0.5);
};

const playDecide = () => {
  playSystemSound('/assets/se_click.mp3', clickSound, 0.6);
};

export const playPerfect = () => {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (ctx && perfectBuffer) {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    try {
      const source = ctx.createBufferSource();
      source.buffer = perfectBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.7 * useGameStore.getState().gameplaySeVolume, ctx.currentTime);
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return;
    } catch (e) {
      console.warn('Web Audio playPerfect failed:', e);
    }
  }

  // フォールバック: HTML5 Audio
  const audio = preloadAudio('/assets/se_perfect.mp3');
  if (audio) {
    try {
      const clone = audio.cloneNode();
      clone.volume = 0.7 * useGameStore.getState().gameplaySeVolume;
      clone.play().catch(() => {});
    } catch (_) {}
  }
};

export const playGood = () => {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (ctx && goodBuffer) {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    try {
      const source = ctx.createBufferSource();
      source.buffer = goodBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.7 * useGameStore.getState().gameplaySeVolume, ctx.currentTime);
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return;
    } catch (e) {
      console.warn('Web Audio playGood failed:', e);
    }
  }

  // フォールバック: HTML5 Audio
  const audio = preloadAudio('/assets/se_good.mp3');
  if (audio) {
    try {
      const clone = audio.cloneNode();
      clone.volume = 0.7 * useGameStore.getState().gameplaySeVolume;
      clone.play().catch(() => {});
    } catch (_) {}
  }
};

export const playMiss = () => {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (ctx && missBuffer) {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    try {
      const source = ctx.createBufferSource();
      source.buffer = missBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.7 * useGameStore.getState().gameplaySeVolume, ctx.currentTime);
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return;
    } catch (e) {
      console.warn('Web Audio playMiss failed:', e);
    }
  }

  // フォールバック: HTML5 Audio
  const audio = preloadAudio('/assets/se_miss.mp3');
  if (audio) {
    try {
      const clone = audio.cloneNode();
      clone.volume = 0.7 * useGameStore.getState().gameplaySeVolume;
      clone.play().catch(() => {});
    } catch (_) {}
  }
};

const INTERACTIVE_SELECTOR = 'button, a, label.cursor-pointer, [role="button"], tr.cursor-pointer, li.cursor-pointer';

let lastHoverTarget = null;

const handleMouseOver = (e) => {
  const target = e.target.closest(INTERACTIVE_SELECTOR);
  if (target && !target.disabled && !target.classList.contains('disabled')) {
    if (target !== lastHoverTarget) {
      playHover();
      lastHoverTarget = target;
    }
  } else {
    lastHoverTarget = null;
  }
};

const handleMouseDown = (e) => {
  const target = e.target.closest(INTERACTIVE_SELECTOR);
  if (target && !target.disabled && !target.classList.contains('disabled')) {
    playDecide();
  }
};

// リスナーとプレロードはアプリ起動時に1度だけ行う
// （useEffectではなくモジュールスコープで管理する。画面遷移に関係なく常時有効な処理のため）
if (typeof document !== 'undefined') {
  preloadAudio('/assets/se_hover.mp3');
  preloadAudio('/assets/se_click.mp3');
  preloadSystemBuffer('/assets/se_hover.mp3', hoverSound);
  preloadSystemBuffer('/assets/se_click.mp3', clickSound);
  preloadAudio('/assets/se_perfect.mp3');
  preloadAudio('/assets/se_good.mp3');
  preloadAudio('/assets/se_miss.mp3');
  preloadPerfectSE();
  preloadGoodSE();
  preloadMissSE();
  document.addEventListener('pointerdown', unlockAudioContext);
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mousedown', (e) => {
    unlockAudioContext();
    handleMouseDown(e);
  });
  document.addEventListener('keydown', unlockAudioContext);
}

export function useSystemSE() {
  // 呼び出し側との互換性のためフック形式は維持する（内部に副作用は持たない）
  return { playHover, playDecide, playPerfect, playGood, playMiss };
}
