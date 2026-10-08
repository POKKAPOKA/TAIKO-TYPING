import React, { useRef, useMemo, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameEngine } from '../engine/GameEngine';

const NOTE_SPEED = 0.5; // px per ms（基準速度。設定の倍速がこれに乗算される）
const JUDGE_LINE_X = 200; // 判定ラインのX座標(px)

const JudgmentPopup = React.memo(() => {
  const combo = useGameStore(state => state.combo);
  const lastJudgment = useGameStore(state => state.lastJudgment);
  const judgmentCount = useGameStore(state => state.judgmentCount);

  return (
    <div
      className="absolute top-1/4 -translate-y-1/2 transform -translate-x-1/2 flex flex-col items-center justify-center z-20 pointer-events-none"
      style={{ left: `${JUDGE_LINE_X}px` }}
    >
      {lastJudgment && (
        <div key={judgmentCount} className="animate-bounce font-black text-3xl tracking-widest mb-1">
          {lastJudgment === 'PERFECT' && <span className="text-yellow-400">PERFECT</span>}
          {lastJudgment === 'GOOD' && <span className="text-green-400">GOOD</span>}
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
  );
});

const NotesArea = React.memo(() => {
  const containerNodeRef = useRef(null);
  const requestRef = useRef(null);

  const currentTarget = useGameStore(state => state.currentTarget);
  const wordQueue = useGameStore(state => state.wordQueue);
  const status = useGameStore(state => state.status);
  const loadedScore = useGameStore(state => state.loadedScore);
  const wallAmount = useGameStore(state => state.wallAmount);

  const [visibleRange, setVisibleRange] = React.useState({ start: -2000, end: 8000 });

  // ノーツ描画ループの制御はコールバックrefで行う（useEffectは使わない）。
  // 再生中のみコンテナDOMが存在するため、マウント/アンマウントがそのまま開始/停止の合図になる。
  const handleContainerRef = useCallback((node) => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    containerNodeRef.current = node;
    if (!node) return;

    // 表示範囲を初期化
    setVisibleRange({ start: -2000, end: 8000 });

    const updateNotes = () => {
      const currentTime = gameEngine.getCurrentTime();

      // レンダリング対象の絞り込み範囲を更新（再レンダリング抑制のため、大きくずれた時だけ反映）
      const pastMargin = 1500;
      const futureWindow = (window.innerWidth || 1920) / NOTE_SPEED + 1500;
      const newStart = currentTime - pastMargin;
      const newEnd = currentTime + futureWindow;
      setVisibleRange(prev => {
        if (Math.abs(prev.start - newStart) > 500) {
          return { start: newStart, end: newEnd };
        }
        return prev;
      });

      const container = containerNodeRef.current;
      if (container) {
        const storeState = useGameStore.getState();
        const currentTargetData = storeState.currentTarget;
        const wordQueueData = storeState.wordQueue;

        const allNotesMap = new Map();
        if (currentTargetData) allNotesMap.set(String(currentTargetData.id), currentTargetData);
        for (let i = 0; i < wordQueueData.length; i++) {
          allNotesMap.set(String(wordQueueData[i].id), wordQueueData[i]);
        }

        const noteElements = container.children;
        const screenWidth = window.innerWidth;
        // 設定の倍速をノーツのスクロール速度に反映する（音声のテンポは変えない）
        const noteSpeed = NOTE_SPEED * storeState.speedMultiplier;

        for (let i = 0; i < noteElements.length; i++) {
          const el = noteElements[i];

          if (el.dataset.isBarline) {
            const barTime = parseFloat(el.dataset.time);
            const xPos = JUDGE_LINE_X + (barTime - currentTime) * noteSpeed;

            if (xPos < -100 || xPos > screenWidth + 200) {
               el.style.display = 'none';
            } else {
               el.style.display = 'block';
               el.style.left = `${xPos}px`;
            }
            continue;
          }

          const noteIdStr = el.dataset.id;
          if (noteIdStr) {
            const noteData = allNotesMap.get(noteIdStr);
            if (noteData) {
              const xPos = JUDGE_LINE_X + (noteData.time - currentTime) * noteSpeed;

              if (xPos < -200 || xPos > screenWidth + 200) {
                 el.style.display = 'none';
              } else {
                 el.style.display = 'flex';
                 el.style.left = `${xPos}px`;
              }
            }
          }
        }
      }

      requestRef.current = requestAnimationFrame(updateNotes);
    };

    requestRef.current = requestAnimationFrame(updateNotes);
  }, []);

  const allNotes = useMemo(() => {
    const arr = [];
    if (currentTarget) arr.push(currentTarget);
    arr.push(...wordQueue);
    return arr.filter(n => n.time >= visibleRange.start && n.time <= visibleRange.end);
  }, [currentTarget, wordQueue, visibleRange]);

  const barlines = useMemo(() => {
    const lines = [];
    if (loadedScore) {
      const bpm = loadedScore.bpm || 120;
      const offset = loadedScore.offset || 0;
      const msPerMeasure = (60000 / bpm) * 4;

      const totalMs = loadedScore.durationMs || (loadedScore.notes && loadedScore.notes.length > 0 ? loadedScore.notes[loadedScore.notes.length - 1].endTime : 10000);
      const measureCount = Math.ceil(totalMs / msPerMeasure) + 5;

      for (let i = 0; i < measureCount; i++) {
        const t = offset + i * msPerMeasure;
        if (t >= visibleRange.start && t <= visibleRange.end) {
          lines.push(t);
        }
      }
    }
    return lines;
  }, [loadedScore, visibleRange]);

  if (status !== 'playing') {
    return <div className="h-64 bg-neutral-800 w-full relative flex items-center justify-center text-neutral-400 font-bold text-xl rounded-2xl">Press Start to Play</div>;
  }

  return (
    <div className="h-64 bg-neutral-800 w-full relative overflow-hidden rounded-2xl">
      <div
        className="absolute top-1/2 -translate-y-1/2 w-32 h-32 border-4 border-neutral-600 rounded-full z-0 transform -translate-x-1/2 flex items-center justify-center"
        style={{ left: `${JUDGE_LINE_X}px` }}
      >
        <div className="w-4 h-32 bg-neutral-600 rounded-full opacity-50" />
      </div>

      <div ref={handleContainerRef} className="absolute inset-0">
        {barlines.map((time, index) => (
          <div
            key={`bar-${time}`}
            data-is-barline="true"
            data-time={time}
            className="absolute top-0 w-0.5 h-full bg-white opacity-20 z-0 transform -translate-x-1/2"
            style={{ left: `2000px` }}
          />
        ))}

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
              style={{ left: `2000px` }}
            >
              {displayWord}
            </div>
          );
        })}
      </div>

      <JudgmentPopup />

      {wallAmount > 0 && (
        <div
          className="absolute inset-y-0 right-0 bg-neutral-900 z-[60] border-l-4 border-neutral-700"
          style={{ width: `calc((100% - ${JUDGE_LINE_X}px) * ${wallAmount / 1000})` }}
        />
      )}
    </div>
  );
});

export default NotesArea;
