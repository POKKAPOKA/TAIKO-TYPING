import { getAudioContext } from '../hooks/useSystemSE';
import { useGameStore } from '../store/gameStore';

// 判定音と同じAudioContextを使い、プレイ開始時のユーザー操作による解除を共有する。
// 戻り値は、スキップ・画面離脱時に予約済みの音も停止する関数。
function playJingle(compose) {
  const volume = useGameStore.getState().gameplaySeVolume;
  if (volume <= 0) return () => {};
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  let cancelled = false;
  let master = null;
  const oscillators = [];

  const start = () => {
    if (cancelled || ctx.state === 'closed') return;
    try {
      master = ctx.createGain();
      master.gain.setValueAtTime(0.32 * volume, ctx.currentTime);
      master.connect(ctx.destination);
      const baseTime = ctx.currentTime + 0.02;

      const oscillator = (type, frequency, when, duration, level, options = {}) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startAt = baseTime + when;
        const endAt = startAt + duration;
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, startAt);
        if (options.endFrequency) osc.frequency.exponentialRampToValueAtTime(options.endFrequency, startAt + Math.min(duration, 0.25));
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(level, startAt + Math.min(0.025, duration / 4));
        gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
        osc.connect(gain);
        if (options.filter) {
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(options.filter, startAt);
          gain.connect(filter);
          filter.connect(master);
        } else {
          gain.connect(master);
        }
        if (options.modulation) {
          const mod = ctx.createOscillator();
          const modGain = ctx.createGain();
          mod.type = 'sine';
          mod.frequency.setValueAtTime(frequency * 2, startAt);
          modGain.gain.setValueAtTime(frequency * 0.65, startAt);
          modGain.gain.exponentialRampToValueAtTime(0.001, endAt);
          mod.connect(modGain);
          modGain.connect(osc.frequency);
          mod.start(startAt);
          mod.stop(endAt + 0.01);
          oscillators.push(mod);
        }
        osc.start(startAt);
        osc.stop(endAt + 0.01);
        oscillators.push(osc);
      };

      const drum = (when, strength = 1) => {
        oscillator('sine', 150, when, 0.37, 0.75 * strength, { endFrequency: 40 });
        oscillator('triangle', 150, when, 0.21, 0.23 * strength, { endFrequency: 40 });
      };
      compose({ oscillator, drum });
    } catch (error) {
      console.warn('ジングルの再生に失敗しました:', error);
    }
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(start).catch(() => {});
  } else {
    start();
  }

  return () => {
    cancelled = true;
    if (!master || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0, now, 0.008);
    oscillators.forEach(osc => {
      try { osc.stop(now + 0.04); } catch { /* 再生終了済み */ }
    });
  };
}

export function playClearJingle() {
  return playJingle(({ oscillator, drum }) => {
    drum(0);
    [523.25, 587.33, 659.25, 783.99, 880, 1046.5].forEach((frequency, i) => {
      oscillator('sine', frequency, 0.15 + i * 0.14, 0.34, 0.38);
      oscillator('triangle', frequency * 2, 0.15 + i * 0.14, 0.18, 0.08);
    });
  });
}

export function playFullComboJingle() {
  return playJingle(({ oscillator, drum }) => {
    drum(0, 1);
    drum(0.24, 0.95);
    [523.25, 659.25, 783.99].forEach(frequency => {
      oscillator('sawtooth', frequency, 0.40, 1.38, 0.18, { filter: 2400 });
    });
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((frequency, i) => {
      oscillator('triangle', frequency, 0.43 + i * 0.12, 0.48, 0.24);
    });
  });
}

export function playAllPerfectJingle() {
  return playJingle(({ oscillator, drum }) => {
    // 最初の0.15秒は無音にして、フィナーレを際立たせる。
    drum(0.15, 1);
    oscillator('sine', 70, 0.15, 0.65, 0.5, { endFrequency: 35 });
    [1046.5, 1318.5, 1567.98, 1760, 2093, 2637].forEach((frequency, i) => {
      oscillator('sine', frequency, 0.28 + i * 0.13, 0.62, 0.22, { modulation: true });
    });
    [523.25, 659.25, 783.99, 1046.5].forEach(frequency => {
      oscillator('triangle', frequency, 1.12, 1.02, 0.15);
    });
  });
}
