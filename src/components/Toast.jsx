import React from 'react';
import { useGameStore } from '../store/gameStore';

// 表示・自動消去の管理はgameStore側で行うため、ここでは描画だけを担当する
const Toast = () => {
  const toastMessage = useGameStore(state => state.toastMessage);

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-neutral-800 text-white px-6 py-3 rounded-full shadow-lg border-2 border-neutral-600 z-50 font-bold tracking-widest text-sm animate-fade-in-up transition-opacity">
      {toastMessage}
    </div>
  );
};

export default Toast;
