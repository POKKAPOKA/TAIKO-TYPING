import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameEngine } from '../engine/GameEngine';

const NOTE_SPEED = 0.5; // px per ms
const JUDGE_LINE_X = 200; // 判定ラインのX座標(px)

export default function NotesArea() {
  const containerRef = useRef(null);
  const requestRef = useRef();

  // Zustand から変更が少ない状態のみ取得（キューの中身などは参照のみ）
  // 頻繁に変わる target などを subscribe しすぎないように注意
  
  useEffect(() => {
    const updateNotes = () => {
      const currentTime = gameEngine.getCurrentTime();
      const status = useGameStore.getState().status;
      
      if (status !== 'playing' || !containerRef.current) {
        requestRef.current = requestAnimationFrame(updateNotes);
        return;
      }

      const storeState = useGameStore.getState();
      const currentTarget = storeState.currentTarget;
      const wordQueue = storeState.wordQueue;

      // 現在のターゲットとキューをマージして描画
      const allNotes = [];
      if (currentTarget) allNotes.push(currentTarget);
      allNotes.push(...wordQueue);

      // DOMを直接操作
      const noteElements = containerRef.current.children;
      
      for (let i = 0; i < noteElements.length; i++) {
        const el = noteElements[i];
        
        // 小節線の場合
        if (el.dataset.isBarline) {
          const barTime = parseFloat(el.dataset.time);
          const xPos = JUDGE_LINE_X + (barTime - currentTime) * NOTE_SPEED;
          el.style.left = `${xPos}px`;
          
          if (xPos < -100 || xPos > 2000) {
             el.style.opacity = '0';
          } else {
             el.style.opacity = '1';
          }
          continue;
        }

        // ノーツの場合
        const noteId = parseInt(el.dataset.id, 10);
        const noteData = allNotes.find(n => n.id === noteId);
        
        if (noteData) {
          // X座標計算: 判定ライン + (目標時間 - 現在時間) * 速度
          const xPos = JUDGE_LINE_X + (noteData.time - currentTime) * NOTE_SPEED;
          el.style.left = `${xPos}px`;
          
          // 通り過ぎて見えなくなったら非表示などの処理
          if (xPos < -100 || xPos > 2000) {
             el.style.opacity = '0';
          } else {
             el.style.opacity = '1';
          }
        }
      }

      requestRef.current = requestAnimationFrame(updateNotes);
    };

    requestRef.current = requestAnimationFrame(updateNotes);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const currentTarget = useGameStore(state => state.currentTarget);
  const wordQueue = useGameStore(state => state.wordQueue);
  const status = useGameStore(state => state.status);
  
  // ポップアップエフェクト用
  const combo = useGameStore(state => state.combo);
  const lastJudgment = useGameStore(state => state.lastJudgment);
  
  const loadedScore = useGameStore(state => state.loadedScore);
  
  const allNotes = [];
  if (currentTarget) allNotes.push(currentTarget);
  allNotes.push(...wordQueue);

  // 小節線の計算
  const barlines = [];
  if (loadedScore) {
    const bpm = loadedScore.bpm || 120;
    const offset = loadedScore.offset || 0;
    const msPerMeasure = (60000 / bpm) * 4;
    // 余裕を持って100小節分くらい生成しておく
    for (let i = 0; i < 100; i++) {
      barlines.push(offset + i * msPerMeasure);
    }
  }

  if (status !== 'playing') {
    return <div className="h-64 bg-neutral-800 w-full relative flex items-center justify-center text-neutral-400 font-bold text-xl rounded-2xl">Press Start to Play</div>;
  }

  return (
    <div className="h-64 bg-neutral-800 w-full relative overflow-hidden rounded-2xl">
      
      {/* 判定ライン (フラットデザイン) */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 w-32 h-32 border-4 border-neutral-600 rounded-full z-0 transform -translate-x-1/2 flex items-center justify-center"
        style={{ left: `${JUDGE_LINE_X}px` }}
      >
        <div className="w-4 h-32 bg-neutral-600 rounded-full opacity-50" />
      </div>

      {/* ノーツコンテナ */}
      <div ref={containerRef} className="absolute inset-0">
        {/* 小節線 */}
        {barlines.map((time, index) => (
          <div
            key={`bar-${index}`}
            data-is-barline="true"
            data-time={time}
            className="absolute top-0 w-0.5 h-full bg-white opacity-20 z-0 transform -translate-x-1/2"
            style={{ left: `2000px` }}
          />
        ))}

        {/* ノーツ */}
        {allNotes.map((note) => {
          const isCurrent = currentTarget?.id === note.id;
          const displayWord = note.word.length > 4 ? note.word.substring(0, 4) : note.word;
          return (
            <div
              key={note.id}
              data-id={note.id}
              className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-28 h-28 rounded-full font-black text-2xl transition-colors z-10 transform -translate-x-1/2 whitespace-nowrap
                ${isCurrent ? 'bg-orange-500 text-neutral-900 border-4 border-orange-400' : 'bg-cyan-500 text-neutral-900 border-4 border-cyan-400'}
              `}
              // 初期位置はCSSでは設定せず、requestAnimationFrameで上書きする
              style={{ left: `2000px` }}
            >
              {displayWord}
            </div>
          );
        })}
      </div>

      {/* 判定・コンボポップアップ */}
      <div 
        className="absolute top-1/4 -translate-y-1/2 transform -translate-x-1/2 flex flex-col items-center justify-center z-20 pointer-events-none"
        style={{ left: `${JUDGE_LINE_X}px` }}
      >
        {lastJudgment && (
          <div key={Date.now()} className="animate-bounce font-black text-3xl tracking-widest mb-1">
            {lastJudgment === 'JUSTICE' && <span className="text-yellow-400">JUSTICE</span>}
            {lastJudgment === 'ATTACK' && <span className="text-green-400">ATTACK</span>}
            {lastJudgment === 'MISS' && <span className="text-neutral-500">MISS</span>}
          </div>
        )}
        
        {combo > 0 && (
          <div className="text-xl font-bold text-white flex items-end gap-1">
            <span className="text-4xl text-yellow-400 font-mono">{combo}</span>
            <span className="text-neutral-400 pb-1">COMBO</span>
          </div>
        )}
      </div>

    </div>
  );
}
