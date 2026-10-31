import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ context: null, volume: 1 }));
vi.mock('../hooks/useSystemSE', () => ({ getAudioContext: () => mocks.context }));
vi.mock('../store/gameStore', () => ({ useGameStore: { getState: () => ({ gameplaySeVolume: mocks.volume }) } }));

import { playAllPerfectJingle, playClearJingle, playFullComboJingle } from './soundEffects';

function createContext() {
  const oscillators = [];
  const gains = [];
  const param = () => ({
    setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn(),
  });
  return {
    state: 'running', currentTime: 10, destination: {}, oscillators, gains,
    createGain: () => {
      const gain = { gain: param(), connect: vi.fn() };
      gains.push(gain);
      return gain;
    },
    createOscillator: () => {
      const osc = { frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      oscillators.push(osc);
      return osc;
    },
    createBiquadFilter: () => ({ frequency: param(), connect: vi.fn() }),
  };
}

describe('達成ジングル', () => {
  beforeEach(() => { mocks.context = createContext(); mocks.volume = 1; });

  it('音量設定を反映し、スキップ時には予約済みの音も停止する', () => {
    mocks.volume = 0.5;
    const stop = playClearJingle();
    expect(mocks.context.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.16, 10);
    expect(mocks.context.oscillators.length).toBeGreaterThan(2);
    stop();
    expect(mocks.context.gains[0].gain.setTargetAtTime).toHaveBeenCalledWith(0, 10, 0.008);
    expect(mocks.context.oscillators.every(osc => osc.stop.mock.calls.length === 2)).toBe(true);
  });

  it('音量0では音を生成しない', () => {
    mocks.volume = 0;
    playFullComboJingle();
    expect(mocks.context.oscillators).toHaveLength(0);
  });

  it('オールパーフェクトは冒頭に0.15秒の無音を設ける', () => {
    playAllPerfectJingle();
    const starts = mocks.context.oscillators.map(osc => osc.start.mock.calls[0][0]);
    expect(Math.min(...starts)).toBeCloseTo(10.17);
  });

  it('音声の再開待ち中に終了した場合は後から鳴らさない', async () => {
    let resolveResume;
    mocks.context.state = 'suspended';
    mocks.context.resume = () => new Promise(resolve => { resolveResume = resolve; });
    const stop = playClearJingle();
    stop();
    resolveResume();
    await Promise.resolve();
    expect(mocks.context.oscillators).toHaveLength(0);
  });
});
