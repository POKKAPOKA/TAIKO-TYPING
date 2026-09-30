import { useRef, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';

const BEATS_PER_MEASURE = 4;

export default function EditorSeekBar() {
  const requestRef = useRef(null);

  // ZustandのgetStateを利用してDOMを直接更新する（Reactのレンダリング回避）
  // ループの開始/停止はコールバックrefで行い、useEffectは使わない
  const barRef = useCallback((node) => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (!node) return;

    const updatePosition = () => {
      const { bpm, measureWidth, zoomLevel, currentTime, isPlaying } = useEditorStore.getState();

      const zoomedMeasureWidth = measureWidth * zoomLevel;
      const msPerBeat = 60000 / bpm;
      const beatWidth = zoomedMeasureWidth / BEATS_PER_MEASURE;

      // 現在の総拍数
      const currentBeats = currentTime / msPerBeat;

      // シークバーの絶対X座標
      const xPos = currentBeats * beatWidth;

      // DOM更新
      node.style.transform = `translateX(${xPos}px)`;
      node.style.opacity = '1';

      // プレイ中に画面右端を超えたら、自動でビューポートをスクロール
      if (isPlaying) {
        const viewport = node.parentElement.parentElement;
        if (viewport && viewport.scrollLeft !== undefined) {
          const scrollLeft = viewport.scrollLeft;
          const width = viewport.clientWidth;
          if (xPos < scrollLeft || xPos > scrollLeft + width * 0.9) {
            viewport.scrollLeft = xPos - width * 0.1;
          }
        }
      }

      requestRef.current = requestAnimationFrame(updatePosition);
    };

    requestRef.current = requestAnimationFrame(updatePosition);
  }, []);

  return (
    <div
      ref={barRef}
      className="absolute top-0 bottom-0 w-1 bg-red-500 z-30 pointer-events-none"
      style={{ transform: `translateX(-1000px)` }} // 初期位置は画面外
    >
      <div className="w-4 h-4 bg-red-500 rounded-full absolute -top-2 -translate-x-1/2" />
    </div>
  );
}
