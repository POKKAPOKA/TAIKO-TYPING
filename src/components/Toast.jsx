import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

const Toast = () => {
  const toastMessage = useGameStore(state => state.toastMessage);
  const toastId = useGameStore(state => state.toastId);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, toastId]);

  if (!visible || !toastMessage) return null;

  return (
    <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-neutral-800 text-white px-6 py-3 rounded-full shadow-lg border-2 border-neutral-600 z-50 font-bold tracking-widest text-sm animate-fade-in-up transition-opacity">
      {toastMessage}
    </div>
  );
};

export default Toast;
