import React from 'react';
import { useGameStore } from '../store/gameStore';

const ActiveWordDisplay = () => {
  const activeWord = useGameStore(state => state.activeWord);
  const typedIndex = useGameStore(state => state.typedIndex);
  const status = useGameStore(state => state.status);

  if (activeWord) {
    return (
      <div className="text-4xl sm:text-5xl md:text-6xl font-mono tracking-widest text-center select-none">
        <span className="text-neutral-600">{activeWord.substring(0, typedIndex)}</span>
        <span className="text-white font-black underline decoration-4 underline-offset-8">{activeWord.charAt(typedIndex)}</span>
        <span className="text-neutral-400">{activeWord.substring(typedIndex + 1)}</span>
      </div>
    );
  } else {
    return (
      <div className="text-xl sm:text-2xl text-neutral-500 font-bold tracking-widest text-center select-none">
        {status === 'playing' ? 'READY...' : 'PRESS START'}
      </div>
    );
  }
};

export default ActiveWordDisplay;
