import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const audioState = vi.hoisted(() => ({ volume: 1 }));
vi.mock('../store/gameStore', () => ({ useGameStore: { getState: () => ({ systemSeVolume: audioState.volume }) } }));

describe('操作音の音量', () => {
  let gains;
  let decode;

  beforeEach(() => {
    vi.resetModules();
    audioState.volume = 1;
    gains = [];
    decode = vi.fn().mockResolvedValue({});
    class MockContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      decodeAudioData = decode;
      createBufferSource() { return { connect: vi.fn(), start: vi.fn() }; }
      createGain() {
        return { gain: { setValueAtTime: value => gains.push(value) }, connect: vi.fn() };
      }
    }
    class MockAudio {
      load() {}
      cloneNode() { return { play: () => Promise.resolve() }; }
    }
    vi.stubGlobal('Audio', MockAudio);
    vi.stubGlobal('window', { AudioContext: MockContext });
    vi.stubGlobal('document', { addEventListener: vi.fn() });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('ホバー音とクリック音に設定音量を反映し、0では再生しない', async () => {
    const { useSystemSE } = await import('./useSystemSE');
    await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(5));
    const { playHover, playDecide } = useSystemSE();
    audioState.volume = 0.5;
    playHover();
    playDecide();
    expect(gains).toEqual([0.25, 0.3]);
    audioState.volume = 0;
    playHover();
    playDecide();
    expect(gains).toHaveLength(2);
  });
});
