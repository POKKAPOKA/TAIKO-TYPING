import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => ({ state: null }));
vi.mock('../store/editorStore', () => ({
  useEditorStore: { getState: () => editor.state, subscribe: vi.fn() },
}));
vi.mock('../store/gameStore', () => ({
  useGameStore: { getState: () => ({ musicVolume: 1 }), subscribe: vi.fn() },
}));

import { loadEditorAudio } from './EditorController';

describe('エディタの音源読み込み', () => {
  let contexts;
  let revoke;

  beforeEach(() => {
    contexts = [];
    revoke = vi.fn();
    editor.state = {
      audioUrl: './audio/track.mp3', audioPeaks: [], isPlaying: false,
      setAudioUrl: url => { editor.state.audioUrl = url; },
      setAudioPeaks: peaks => { editor.state.audioPeaks = peaks; },
      setIsPlaying: value => { editor.state.isPlaying = value; },
      setCurrentTime: vi.fn(), setScrollTimeOffset: vi.fn(),
    };
    class AudioContextMock {
      constructor() { contexts.push(this); }
      decodeAudioData() { return new Promise(resolve => { this.resolve = resolve; }); }
      close = vi.fn().mockResolvedValue();
    }
    vi.stubGlobal('window', { AudioContext: AudioContextMock });
    vi.stubGlobal('URL', { createObjectURL: file => `blob:${file.name}`, revokeObjectURL: revoke });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('後から選択した音源の波形を維持し、解析と古いURLを解放する', async () => {
    const file = name => ({ name, arrayBuffer: async () => new ArrayBuffer(1) });
    const first = loadEditorAudio(file('first'));
    await vi.waitFor(() => expect(contexts).toHaveLength(1));
    const second = loadEditorAudio(file('second'));
    await vi.waitFor(() => expect(contexts).toHaveLength(2));
    const buffer = sample => ({ sampleRate: 20, getChannelData: () => [sample] });
    contexts[1].resolve(buffer(0.8));
    await second;
    contexts[0].resolve(buffer(0.2));
    await first;

    expect(editor.state.audioUrl).toBe('blob:second');
    expect(editor.state.audioPeaks).toEqual([0.8]);
    expect(revoke).toHaveBeenCalledWith('blob:first');
    expect(contexts.every(context => context.close.mock.calls.length === 1)).toBe(true);
  });
});
