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
      const { bpm, measureWidth, scrollTimeOffset, currentTime, timelineWidth, isPlaying, setScrollTimeOffset } = state;
      
      const msPerBeat = 60000 / bpm;
      const beatWidth = measureWidth / BEATS_PER_MEASURE;
      
      // 現在の総拍数とスクロール位置の総拍数
      const currentBeats = currentTime / msPerBeat;
      const scrollBeats = scrollTimeOffset / msPerBeat;

      // シークバーのX座標
      let xPos = (currentBeats - scrollBeats) * beatWidth;

      // 自動ページネーション: 右端を超えたら次のページへ
      if (isPlaying && xPos > timelineWidth) {
        // 次のページへパッと切り替わる
        const timePerPage = (timelineWidth / beatWidth) * msPerBeat;
        const newOffset = scrollTimeOffset + timePerPage;
        
        // 状態を更新 (Zustand)
        setScrollTimeOffset(newOffset);
        
        // xPos を再計算
        xPos = (currentBeats - (newOffset / msPerBeat)) * beatWidth;
      }

      // DOM更新
      if (barRef.current) {
        barRef.current.style.transform = `translateX(${xPos}px)`;
        if (xPos < 0 || xPos > timelineWidth) {
          barRef.current.style.opacity = '0';
        } else {
          barRef.current.style.opacity = '1';
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
