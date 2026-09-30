// アプリケーション全体でAudioインスタンスを共有し、プレロードを確実にする
const audioCache = {};

const preloadAudio = (path) => {
  if (typeof window === 'undefined') return null;
  if (!audioCache[path]) {
    const audio = new Audio(path);
    audio.load();
    audioCache[path] = audio;
  }
  return audioCache[path];
};

const playHover = () => {
  const audio = preloadAudio('/assets/se_hover.mp3');
  if (!audio) return;
  const clone = audio.cloneNode();
  clone.volume = 0.5;
  clone.play().catch(() => {}); // インタラクション前のエラーを無視
};

const playDecide = () => {
  const audio = preloadAudio('/assets/se_click.mp3');
  if (!audio) return;
  const clone = audio.cloneNode();
  clone.volume = 0.6;
  clone.play().catch(() => {});
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
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mousedown', handleMouseDown);
}

export function useSystemSE() {
  // 呼び出し側との互換性のためフック形式は維持する（内部に副作用は持たない）
  return { playHover, playDecide };
}
