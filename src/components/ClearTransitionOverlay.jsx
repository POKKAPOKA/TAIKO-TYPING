import { useCallback, useRef } from 'react';
import { playAllPerfectJingle, playClearJingle, playFullComboJingle } from '../utils/soundEffects';
import './ClearTransitionOverlay.css';

const VARIANTS = {
  CLEAR: { title: 'CLEAR', subtitle: 'STAGE CLEARED', duration: 1800, particles: 16, play: playClearJingle },
  FULL_COMBO: { title: 'FULL COMBO', subtitle: 'STAGE CLEARED / FULL COMBO', duration: 2000, particles: 24, play: playFullComboJingle },
  ALL_PERFECT: { title: 'ALL PERFECT', subtitle: 'STAGE CLEARED / ALL PERFECT', duration: 2300, particles: 34, play: playAllPerfectJingle },
};

export default function ClearTransitionOverlay({ rank, character, onComplete }) {
  const variant = VARIANTS[rank];
  const cleanupRef = useRef(null);
  const completedRef = useRef(false);

  // マウント中だけタイマー、入力リスナー、音声を維持する。
  const setOverlayRef = useCallback((node) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (!node || !variant) return;

    const finish = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    };
    const handleKey = (event) => {
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      finish();
    };
    const stopSound = variant.play();
    const timer = window.setTimeout(finish, variant.duration);
    window.addEventListener('keydown', handleKey, true);
    cleanupRef.current = () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKey, true);
      stopSound();
    };
  }, [variant, onComplete]);

  if (!variant) return null;

  return (
    <div ref={setOverlayRef} className={`clear-transition clear-transition--${rank.toLowerCase()}`} onClick={() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    }} role="status" aria-label={`${variant.title}、タップまたはキーでスキップ`}>
      <div className="clear-transition__flash" aria-hidden="true" />
      <div className="clear-transition__stage" aria-hidden="true">
        {rank === 'FULL_COMBO' && <div className="clear-transition__columns" />}
        {rank === 'ALL_PERFECT' && <div className="clear-transition__rings"><i /><i /><i /></div>}
        <div className="clear-transition__banner">
          <div className="clear-transition__banner-inner" />
          <img className="clear-transition__character" src={character.sprites.sing_2 || character.sprites.sing_1} alt="" />
          <div className="clear-transition__copy">
            <span className="clear-transition__eyebrow">TAiKO TYPiNG / LIVE RESULT</span>
            <strong className="clear-transition__title" aria-label={variant.title}>
              {rank === 'ALL_PERFECT'
                ? variant.title.split('').map((letter, index) => (
                  <span key={index} className="clear-transition__letter" style={{ '--letter-index': index }}>{letter === ' ' ? '\u00a0' : letter}</span>
                ))
                : variant.title}
            </strong>
            <span className="clear-transition__subtitle">{variant.subtitle}</span>
          </div>
        </div>
        <div className="clear-transition__particles">
          {Array.from({ length: variant.particles }, (_, i) => (
            <span
              key={i}
              className={`clear-transition__particle ${i % 3 === 0 ? 'is-diamond' : 'is-petal'}`}
              style={{
                '--particle-x': `${(i * 37 + 11) % 101}%`,
                '--particle-y': `${(i * 47 + 9) % 115 - 15}%`,
                '--particle-delay': `${(i % 8) * -0.21}s`,
                '--particle-duration': `${1.5 + (i % 5) * 0.25}s`,
                '--particle-size': `${8 + (i % 4) * 4}px`,
              }}
            />
          ))}
        </div>
      </div>
      <button type="button" className="clear-transition__skip">タップ / キーでスキップ</button>
    </div>
  );
}
