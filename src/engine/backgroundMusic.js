import waitingUrl from '../assets/bgm_waiting.wav';
import resultUrl from '../assets/bgm_result.wav';
import { getAudioContext } from '../hooks/useSystemSE';
import { useGameStore } from '../store/gameStore';

// 画面切替とストア購読に応じてBGMを管理する。楽曲・効果音とは音源を共有しない。
export class BackgroundMusicController {
  constructor({ store = useGameStore, createAudio = src => new Audio(src), getContext = getAudioContext, events = typeof document !== 'undefined' ? document : null } = {}) {
    this.store = store;
    this.createAudio = createAudio;
    this.getContext = getContext;
    this.events = events;
    this.handleInteraction = this.handleInteraction.bind(this);
    this.reset();
  }

  reset() {
    this.unsubscribe?.();
    this.events?.removeEventListener('pointerdown', this.handleInteraction);
    this.events?.removeEventListener('keydown', this.handleInteraction);
    for (const track of Object.values(this.tracks || {})) {
      track.audio.pause();
      track.source?.disconnect();
      track.gain?.disconnect();
    }
    this.tracks = {};
    this.unsubscribe = null;
    this.active = null;
    this.screen = 'menu';
    this.running = false;
  }

  start() {
    this.reset();
    this.running = true;
    this.unsubscribe = this.store.subscribe((state, previous) => {
      if (state.status !== previous.status || state.musicVolume !== previous.musicVolume) this.sync();
    });
    this.events?.addEventListener('pointerdown', this.handleInteraction);
    this.events?.addEventListener('keydown', this.handleInteraction);
    this.sync();
  }

  setScreen(screen) {
    this.screen = screen;
    if (this.running) this.sync();
  }

  makeTrack(name) {
    if (this.tracks[name]) return this.tracks[name];
    const audio = this.createAudio(name === 'result' ? resultUrl : waitingUrl);
    audio.loop = true;
    audio.preload = 'auto';
    const track = { audio, source: null, gain: null, context: null };
    try {
      const context = this.getContext();
      if (context && typeof context.createMediaElementSource === 'function') {
        const gain = context.createGain();
        const source = context.createMediaElementSource(audio);
        source.connect(gain);
        gain.connect(context.destination);
        track.source = source;
        track.gain = gain;
        track.context = context;
      }
    } catch (error) {
      console.warn('BGMの音量制御を初期化できませんでした:', error);
    }
    this.tracks[name] = track;
    return track;
  }

  setVolume(track) {
    const setting = this.store.getState().musicVolume;
    const volume = Math.max(0, Math.min(1, Number.isFinite(setting) ? setting : 1)) * 0.5;
    if (track.gain) {
      track.audio.volume = 1;
      track.gain.gain.value = volume;
    } else {
      track.audio.volume = volume;
    }
  }

  tryPlay(track) {
    try {
      const pending = track.audio.play();
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch {
      // 自動再生が拒否された場合は次のユーザー操作で再試行する。
    }
  }

  handleInteraction() {
    if (!this.running || !this.active) return;
    const track = this.tracks[this.active];
    if (track.context?.state === 'suspended') track.context.resume().catch(() => {});
    if (track.audio.paused) this.tryPlay(track);
  }

  sync() {
    const state = this.store.getState();
    const next = this.screen === 'editor' ? null : this.screen === 'game' ? (state.status === 'result' ? 'result' : null) : 'waiting';
    if (next !== this.active) {
      if (this.active) {
        const previous = this.tracks[this.active].audio;
        previous.pause();
        previous.currentTime = 0;
      }
      this.active = next;
      if (next) {
        const track = this.makeTrack(next);
        this.setVolume(track);
        this.tryPlay(track);
      }
    } else if (next) {
      this.setVolume(this.tracks[next]);
    }
  }
}

export const backgroundMusic = new BackgroundMusicController();
