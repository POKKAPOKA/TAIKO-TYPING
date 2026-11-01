// 譜面の拍を、ゲームエンジンが使う音源の再生時刻から求める。
// 一時停止・音源の待機中は時刻が進まないため、演出もずれずに止まる。
export class StageRhythmController {
  constructor() {
    this.character = null;
    this.lights = [];
    this.reset();
  }

  attach(node) {
    this.clearVisuals();
    this.character = node?.querySelector('[data-beat-character]') || null;
    this.lights = node ? Array.from(node.querySelectorAll('[data-beat-light]')) : [];
  }

  clearVisuals() {
    this.character?.style.removeProperty('transform');
    for (const light of this.lights) {
      light.style.removeProperty('transform');
      light.style.removeProperty('opacity');
    }
  }

  reset() {
    this.clearVisuals();
    this.active = false;
    this.beatMs = 500;
    this.offset = 0;
    this.motionPreference = null;
  }

  start(score = {}) {
    this.reset();
    const bpm = Number(score?.bpm);
    const offset = Number(score?.offset);
    // 不正なBPMで激しく点滅しないようにする。未設定時は120 BPM。
    this.beatMs = 60000 / (Number.isFinite(bpm) && bpm >= 30 && bpm <= 400 ? bpm : 120);
    this.offset = Number.isFinite(offset) ? offset : 0;
    this.motionPreference = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    this.active = true;
  }

  update(timeMs) {
    if (!this.active || !Number.isFinite(timeMs) || timeMs < 0) return null;
    if (this.motionPreference?.matches) {
      this.clearVisuals();
      return null;
    }

    const position = (timeMs - this.offset) / this.beatMs;
    const beat = Math.floor(position);
    const phase = position - beat;
    const bounce = Math.sin(Math.PI * phase);
    const sway = Math.sin(Math.PI * position);
    const sweep = Math.sin(Math.PI * position / 2);
    const pulse = 0.72 + 0.18 * (1 - phase) ** 2;

    if (this.character) {
      this.character.style.transform = `translate3d(${(sway * 2).toFixed(2)}px, ${(-bounce * 6).toFixed(2)}px, 0) scale(${(1 + bounce * 0.008).toFixed(4)})`;
    }
    this.lights.forEach((light, index) => {
      const direction = index % 2 === 0 ? -1 : 1;
      const angle = direction * (17 + 8 * sweep);
      light.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      light.style.opacity = pulse.toFixed(3);
    });

    return beat;
  }
}

export const stageRhythm = new StageRhythmController();
