import { useEffect, useCallback } from 'react';

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

// 初期化時にプレロード
if (typeof window !== 'undefined') {
  preloadAudio('/assets/se_hover.mp3');
  preloadAudio('/assets/se_click.mp3');
}

export function useSystemSE() {
  const playHover = useCallback(() => {
    const audio = preloadAudio('/assets/se_hover.mp3');
    if (!audio) return;
    const clone = audio.cloneNode();
    clone.volume = 0.5;
    clone.play().catch(() => {}); // インタラクション前のエラーを無視
  }, []);

  const playDecide = useCallback(() => {
    const audio = preloadAudio('/assets/se_click.mp3');
    if (!audio) return;
    const clone = audio.cloneNode();
    clone.volume = 0.6;
    clone.play().catch(() => {});
  }, []);

  useEffect(() => {
    const handleMouseOver = (e) => {
      const target = e.target.closest('button, a, label.cursor-pointer, [role="button"], tr.cursor-pointer, li.cursor-pointer');
      if (target && !target.disabled && !target.classList.contains('disabled')) {
        if (target !== window.__lastHoverTarget) {
          playHover();
          window.__lastHoverTarget = target;
        }
      } else {
        window.__lastHoverTarget = null;
      }
    };

    const handleMouseDown = (e) => {
      const target = e.target.closest('button, a, label.cursor-pointer, [role="button"], tr.cursor-pointer, li.cursor-pointer');
      if (target && !target.disabled && !target.classList.contains('disabled')) {
        playDecide();
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [playHover, playDecide]);

  return { playHover, playDecide };
}
