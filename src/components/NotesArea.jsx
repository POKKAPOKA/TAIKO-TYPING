import React, { useRef, useMemo, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameEngine } from '../engine/GameEngine';

const NOTE_SPEED = 0.5; // px per ms（基準速度。設定の倍速がこれに乗算される）
const JUDGE_LINE_X = 180; // 判定縦棒のX座標(px)
const BASE_WIDTH = 896; // 基準コンテナ幅
const BASE_HEIGHT = 136; // 基準レーン高（下部サイバーガラスレーン）
const JUDGE_LINE_PERCENT = (JUDGE_LINE_X / BASE_WIDTH) * 100;

// リアルタイム判定＆コンボ表示（ノーツレーンの内側ではなく、判定縦棒のすぐ上＝レーン枠の上外側に配置して被りを完全防止）
const JudgmentPopup = React.memo(() => {
  const combo = useGameStore(state => state.combo);
  const lastJudgment = useGameStore(state => state.lastJudgment);
  const judgmentCount = useGameStore(state => state.judgmentCount);

  if (!lastJudgment && combo <= 0) return null;

  return (
    <div
      className="
        absolute bottom-full mb-1.5 sm:mb-2 -translate-x-1/2
        flex flex-col items-center justify-end z-30 pointer-events-none select-none
      "
      style={{ left: `${JUDGE_LINE_PERCENT}%` }}
    >
      {combo > 0 && (
        <div
          className="flex items-baseline gap-1 leading-none mb-0.5"
          style={{ fontFamily: "'Orbitron', sans-serif", fontVariantNumeric: 'tabular-nums' }}
        >
          <span
            className="text-xl sm:text-2xl md:text-3xl font-black text-white"
            style={{ textShadow: '0 0 10px #00f5ff, 0 0 20px rgba(0, 245, 255, 0.7)' }}
          >
            {combo}
          </span>
          <span
            className="text-[10px] sm:text-xs font-black tracking-widest text-cyan-300"
            style={{ textShadow: '0 0 6px #00f5ff' }}
          >
            COMBO
          </span>
        </div>
      )}

      {lastJudgment && (
        <div
          key={judgmentCount}
          className="judgment-pop font-black text-2xl sm:text-3xl md:text-4xl tracking-wider leading-none whitespace-nowrap"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          {(lastJudgment === 'PERFECT' || lastJudgment === 'JUSTICE') && (
            <span
              className="text-yellow-200"
              style={{
                textShadow: '0 0 10px #fde047, 0 0 20px #00f5ff, 0 0 32px rgba(0, 245, 255, 0.85)'
              }}
            >
              PERFECT!
            </span>
          )}
          {(lastJudgment === 'GOOD' || lastJudgment === 'ATTACK') && (
            <span
              className="text-cyan-300"
              style={{
                textShadow: '0 0 10px #00f5ff, 0 0 20px rgba(0, 245, 255, 0.75)'
              }}
            >
              GOOD
            </span>
          )}
          {lastJudgment === 'MISS' && (
            <span
              className="text-rose-400"
              style={{
                textShadow: '0 0 10px #f43f5e, 0 0 20px rgba(244, 63, 94, 0.75)'
              }}
            >
              MISS
            </span>
          )}
        </div>
      )}
    </div>
  );
});

const NotesArea = React.memo(() => {
  const containerNodeRef = useRef(null);
  const requestRef = useRef(null);
  const resizeObserverRef = useRef(null);

  const currentTarget = useGameStore(state => state.currentTarget);
  const wordQueue = useGameStore(state => state.wordQueue);
  const status = useGameStore(state => state.status);
  const loadedScore = useGameStore(state => state.loadedScore);
  const wallAmount = useGameStore(state => state.wallAmount);

  const [visibleRange, setVisibleRange] = React.useState({ start: -2000, end: 8000 });
  const [scale, setScale] = React.useState(1);

  // コンテナサイズに応じたスケール計算
  const handleWrapperRef = useCallback((node) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (!node) return;

    const updateScale = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0) {
        const s = rect.width / BASE_WIDTH;
        setScale(s > 0 ? s : 1);
      }
    };

    updateScale();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateScale);
      ro.observe(node);
      resizeObserverRef.current = ro;
    }
  }, []);

  // ノーツ描画ループの制御はコールバックrefで行う（useEffectは使わない）
  const handleContainerRef = useCallback((node) => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    containerNodeRef.current = node;
    if (!node) return;

    setVisibleRange({ start: -2000, end: 8000 });

    const updateNotes = () => {
      const storeState = useGameStore.getState();
      const currentTime = gameEngine.getCurrentTime() - storeState.offsetMs;

      const pastMargin = 1500;
      const futureWindow = Math.max(BASE_WIDTH, window.innerWidth || 1920) / NOTE_SPEED + 1500;
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
        const currentTargetData = storeState.currentTarget;
        const wordQueueData = storeState.wordQueue;

        const allNotesMap = new Map();
        if (currentTargetData) allNotesMap.set(String(currentTargetData.id), currentTargetData);
        for (let i = 0; i < wordQueueData.length; i++) {
          allNotesMap.set(String(wordQueueData[i].id), wordQueueData[i]);
        }

        const noteElements = container.children;
        const noteSpeed = NOTE_SPEED * storeState.speedMultiplier;

        for (let i = 0; i < noteElements.length; i++) {
          const el = noteElements[i];

          if (el.dataset.isBarline) {
            const barTime = parseFloat(el.dataset.time);
            const xPos = JUDGE_LINE_X + (barTime - currentTime) * noteSpeed;

            if (xPos < -100 || xPos > BASE_WIDTH + 200) {
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

              if (xPos < -200 || xPos > BASE_WIDTH + 200) {
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

      const maxNoteEnd = loadedScore.notes && loadedScore.notes.length > 0
        ? Math.max(...loadedScore.notes.map(n => n.endTime || n.time || 0))
        : 10000;
      const totalMs = Math.max(loadedScore.durationMs || 0, maxNoteEnd);
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
    return (
      <div className="relative w-full max-w-[896px] select-none">
        <div
          ref={handleWrapperRef}
          className="cyber-notes-lane relative w-full h-[88px] sm:h-[116px] md:h-[136px] overflow-hidden flex items-center justify-center"
        >
          <div className="text-cyan-300/70 font-bold text-lg tracking-widest">READY TO PLAY</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[896px] select-none">
      {/* レーン枠の上外側に配置するリアルタイム判定＆コンボ表示（ノーツとの被り完全防止） */}
      <JudgmentPopup />

      {/* 半透明サイバーガラスレーン */}
      <div
        ref={handleWrapperRef}
        className="cyber-notes-lane relative w-full h-[88px] sm:h-[116px] md:h-[136px] overflow-hidden flex items-center"
      >
        {/* レーン中央のサイバーガイドライン */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-pink-500/45 via-cyan-400/35 to-cyan-400/20 pointer-events-none z-0" />

        {/* 判定位置：鮮やかに光るシアンのネオン縦棒（幅6px、高さ100%、強いシアングロー付き） */}
        <div
          className="absolute inset-y-0 -translate-x-1/2 flex items-center justify-center z-20 pointer-events-none"
          style={{ left: `${JUDGE_LINE_PERCENT}%` }}
        >
          {/* 中心のターゲットリング装飾（サブ効果） */}
          <div
            className="absolute w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-2 border-cyan-300/60"
            style={{
              boxShadow: '0 0 16px rgba(0, 245, 255, 0.55), inset 0 0 12px rgba(244, 114, 182, 0.45)'
            }}
          />
          {/* メインの縦棒判定ライン（幅6px・高さ100%・白芯＋強いシアングロー） */}
          <div
            className="cyber-judge-bar w-[6px] h-full rounded-full"
            style={{
              background: '#ffffff',
              boxShadow: '0 0 10px #00f5ff, 0 0 20px #00f5ff, 0 0 36px rgba(0, 245, 255, 0.95), 0 0 56px rgba(217, 70, 239, 0.7)'
            }}
          />
        </div>

        <div
          style={{
            width: `${BASE_WIDTH}px`,
            height: `${BASE_HEIGHT}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'left center',
          }}
          className="relative flex-shrink-0"
        >

          <div ref={handleContainerRef} className="absolute inset-0 z-10">
            {barlines.map((time) => (
              <div
                key={`bar-${time}`}
                data-is-barline="true"
                data-time={time}
                className="absolute top-0 w-0.5 h-full bg-cyan-300/25 z-0 transform -translate-x-1/2"
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
                  className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center min-w-[78px] h-[78px] px-4 rounded-full font-black text-xl transition-colors z-10 transform -translate-x-1/2 whitespace-nowrap ${
                    isCurrent
                      ? 'bg-gradient-to-br from-pink-500 via-fuchsia-500 to-cyan-400 text-white border-[3px] border-white'
                      : 'bg-slate-900/90 text-cyan-200 border-[3px] border-cyan-400'
                  }`}
                  style={{
                    left: `2000px`,
                    boxShadow: isCurrent
                      ? '0 0 16px #f472b6, 0 0 28px rgba(0, 245, 255, 0.8)'
                      : '0 0 12px rgba(0, 245, 255, 0.5)'
                  }}
                >
                  {displayWord}
                </div>
              );
            })}
          </div>

          {wallAmount > 0 && (
            <div
              className="absolute inset-y-0 right-0 bg-slate-950/95 z-[60] border-l-4 border-cyan-500/60"
              style={{ width: `calc((100% - ${JUDGE_LINE_X}px) * ${wallAmount / 1000})` }}
            />
          )}
        </div>
      </div>
    </div>
  );
});

export default NotesArea;

