// ゲーム画面のUI同期（操作ガイドの自動消去・ボーカリストの0.4秒周期歌唱アニメーション）を担うモジュール。
// ReactのuseEffectではなく、Zustandストアの購読（subscribe）で状態遷移に反応する。
// ※スコア送信はリザルト画面の「ランキング登録」から手動で行う方式のため、ここでは扱わない
import { useGameStore } from '../store/gameStore';

let guideTimer = null;
let vocalSingInterval = null;

function startVocalSingLoop() {
  if (vocalSingInterval) clearInterval(vocalSingInterval);
  vocalSingInterval = setInterval(() => {
    const s = useGameStore.getState();
    if (s.status === 'playing' && !s.isPaused && s.vocalState !== 'miss') {
      s.setVocalState(s.vocalState === 'sing_1' ? 'sing_2' : 'sing_1');
    }
  }, 400);
}

function stopVocalSingLoop() {
  if (vocalSingInterval) {
    clearInterval(vocalSingInterval);
    vocalSingInterval = null;
  }
}

useGameStore.subscribe((state, prev) => {
  // --- 操作ガイド: 再生開始から5秒間だけ表示 ---
  if (state.status === 'playing' && prev.status !== 'playing') {
    state.setShowGuide(true);
    if (guideTimer) clearTimeout(guideTimer);
    guideTimer = setTimeout(() => {
      useGameStore.getState().setShowGuide(false);
    }, 5000);
    startVocalSingLoop();
  }
  if (state.status !== 'playing' && prev.status === 'playing') {
    if (guideTimer) {
      clearTimeout(guideTimer);
      guideTimer = null;
    }
    if (state.showGuide) {
      state.setShowGuide(false);
    }
    stopVocalSingLoop();
  }
});
