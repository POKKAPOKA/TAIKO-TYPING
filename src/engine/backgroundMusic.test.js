import { describe, expect, it, vi } from 'vitest';
import { BackgroundMusicController } from './backgroundMusic';

function createHarness({ webAudio = true } = {}) {
  let state = { status: 'idle', musicVolume: 1 };
  const subscribers = new Set();
  const store = {
    getState: () => state,
    subscribe: fn => { subscribers.add(fn); return () => subscribers.delete(fn); },
    update: changes => {
      const previous = state;
      state = { ...state, ...changes };
      subscribers.forEach(fn => fn(state, previous));
    },
  };
  const listeners = new Map();
  const events = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  const audios = [];
  const createAudio = src => {
    const audio = { src, paused: true, currentTime: 0, volume: 1 };
    audio.play = vi.fn(() => { audio.paused = false; return Promise.resolve(); });
    audio.pause = vi.fn(() => { audio.paused = true; });
    audios.push(audio);
    return audio;
  };
  const gains = [];
  const context = {
    state: 'running', destination: {},
    createGain: () => { const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }; gains.push(gain); return gain; },
    createMediaElementSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
  };
  const controller = new BackgroundMusicController({ store, events, createAudio, getContext: () => webAudio ? context : null });
  return { controller, store, audios, gains, listeners, subscribers };
}

describe('待機・リザルトBGM', () => {
  it('待機画面間では継続し、プレイ・演出中は停止、リザルトで別曲に切り替える', () => {
    const { controller, store, audios } = createHarness();
    controller.start();
    expect(audios).toHaveLength(1);
    expect(audios[0].loop).toBe(true);
    audios[0].currentTime = 7;
    controller.setScreen('songSelect');
    expect(audios[0].currentTime).toBe(7);
    expect(audios[0].play).toHaveBeenCalledTimes(1);

    controller.setScreen('game');
    expect(audios[0].paused).toBe(true);
    expect(audios[0].currentTime).toBe(0);
    store.update({ status: 'playing' });
    store.update({ status: 'clearTransition' });
    expect(audios).toHaveLength(1);
    store.update({ status: 'result' });
    expect(audios).toHaveLength(2);
    expect(audios[1].loop).toBe(true);
    expect(audios[1].paused).toBe(false);
    store.update({ status: 'idle' });
    expect(audios[1].paused).toBe(true);
    controller.setScreen('menu');
    expect(audios[0].paused).toBe(false);
    controller.reset();
  });

  it('エディターでは待機BGMを停止し、操作中や音量変更時にも再開しない', () => {
    const { controller, store, audios, listeners } = createHarness();
    controller.start();
    controller.setScreen('editor');
    expect(audios[0].paused).toBe(true);
    expect(audios[0].currentTime).toBe(0);
    store.update({ musicVolume: 0.2 });
    listeners.get('pointerdown')();
    listeners.get('keydown')();
    expect(audios[0].play).toHaveBeenCalledTimes(1);
    controller.setScreen('menu');
    expect(audios[0].play).toHaveBeenCalledTimes(2);
    expect(audios[0].paused).toBe(false);
    controller.reset();
  });

  it('楽曲の音量設定を両方のBGMに適用し、フォールバックでも反映する', () => {
    const { controller, store, gains } = createHarness();
    controller.start();
    store.update({ musicVolume: 0.4 });
    expect(gains[0].gain.value).toBe(0.2);
    controller.setScreen('game');
    store.update({ status: 'result' });
    expect(gains[1].gain.value).toBe(0.2);
    store.update({ musicVolume: 0 });
    expect(gains[1].gain.value).toBe(0);
    controller.reset();

    const fallback = createHarness({ webAudio: false });
    fallback.controller.start();
    fallback.store.update({ musicVolume: 0.4 });
    expect(fallback.audios[0].volume).toBe(0.2);
    fallback.controller.reset();
  });

  it('自動再生がブロックされた場合は次の操作で再試行し、終了時に購読を解除する', () => {
    const { controller, audios, listeners, subscribers } = createHarness();
    controller.start();
    audios[0].paused = true;
    listeners.get('pointerdown')();
    expect(audios[0].play).toHaveBeenCalledTimes(2);
    controller.reset();
    expect(listeners.size).toBe(0);
    expect(subscribers.size).toBe(0);
    expect(audios[0].paused).toBe(true);
  });
});
