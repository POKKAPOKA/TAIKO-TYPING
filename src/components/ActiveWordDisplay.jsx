import React from 'react';
import { useGameStore } from '../store/gameStore';

const ActiveWordDisplay = () => {
  const activeWord = useGameStore(state => state.activeWord);
  const typedIndex = useGameStore(state => state.typedIndex);
  const status = useGameStore(state => state.status);
  const isMobileMode = useGameStore(state => state.isMobileMode);
  const currentTarget = useGameStore(state => state.currentTarget);

  if (activeWord) {
    const displayStr = isMobileMode ? activeWord : activeWord.toUpperCase();
    const typedPart = displayStr.substring(0, typedIndex);
    const currentChar = displayStr.charAt(typedIndex);
    const remainingPart = displayStr.substring(typedIndex + 1);

    return (
      <div className="flex flex-col items-center justify-center select-none">
        {currentTarget?.word && (
          <div className="text-xs sm:text-sm font-bold text-cyan-200/85 tracking-widest mb-0.5">
            {currentTarget.word}
          </div>
        )}
        <div
          className="text-3xl sm:text-5xl md:text-6xl font-black tracking-[0.28em] text-center flex items-baseline justify-center"
          style={{ fontFamily: "'Orbitron', 'DotGothic16', monospace" }}
        >
          {typedPart && (
            <span className="text-cyan-400/35">{typedPart}</span>
          )}
          {currentChar && (
            <span
              className="inline-block text-white font-black pb-1 border-b-4 border-cyan-300 mx-0.5"
              style={{
                textShadow: '0 0 12px #00f5ff, 0 0 24px rgba(0, 245, 255, 0.7)',
                boxShadow: '0 6px 14px -2px rgba(0, 245, 255, 0.85)'
              }}
            >
              {currentChar}
            </span>
          )}
          {remainingPart && (
            <span
              className="text-slate-300/80"
              style={{ textShadow: '0 0 8px rgba(148, 163, 184, 0.35)' }}
            >
              {remainingPart}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="text-lg sm:text-2xl text-cyan-300/60 font-black tracking-[0.25em] text-center select-none"
      style={{ fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 10px rgba(0, 245, 255, 0.4)' }}
    >
      {status === 'playing' ? 'READY...' : 'PRESS START'}
    </div>
  );
};

export default ActiveWordDisplay;

