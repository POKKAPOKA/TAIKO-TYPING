import { useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';

const BEATS_PER_MEASURE = 4;

export default function EditorSeekBar() {
  const barRef = useRef(null);
  const requestRef = useRef();
  
  // Zustandのsubscribeを利用してDOMを直接更新（Reactのレンダリング回避）
  useEffect(() => {
    const updatePosition = () => {
      const state = useEditorStore.getState();
      const { bpm, measureWidth, zoomLevel, scrollTimeOffset, currentTime, timelineWidth, isPlaying, setScrollTimeOffset } = state;
      
      const zoomedMeasureWidth = measureWidth * zoomLevel;
      const msPerBeat = 60000 / bpm;
      const beatWidth = zoomedMeasureWidth / BEATS_PER_MEASURE;
      
      // 現在の総拍数
      const currentBeats = currentTime / msPerBeat;

      // シークバーの絶対X座標
      const xPos = currentBeats * beatWidth;

      // DOM更新
      if (barRef.current) {
        barRef.current.style.transform = `translateX(${xPos}px)`;
        barRef.current.style.opacity = '1';

        // プレイ中に画面右端を超えたら、自動でビューポートをスクロール
        if (isPlaying) {
          const viewport = barRef.current.parentElement.parentElement;
          if (viewport && viewport.scrollLeft !== undefined) {
            const scrollLeft = viewport.scrollLeft;
            const width = viewport.clientWidth;
            if (xPos < scrollLeft || xPos > scrollLeft + width * 0.9) {
              viewport.scrollLeft = xPos - width * 0.1;
            }
          }
        }
      }
      
      requestRef.current = requestAnimationFrame(updatePosition);
    };

    requestRef.current = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(requestRef.current);
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
