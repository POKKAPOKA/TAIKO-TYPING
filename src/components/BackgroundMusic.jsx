import { useCallback } from 'react';
import { backgroundMusic } from '../engine/backgroundMusic';

// 画面切替でアンマウントされない場所に配置し、refで購読を開始・解除する。
export default function BackgroundMusic() {
  const register = useCallback(node => {
    if (node) backgroundMusic.start();
    else backgroundMusic.reset();
  }, []);
  return <span ref={register} hidden aria-hidden="true" />;
}
