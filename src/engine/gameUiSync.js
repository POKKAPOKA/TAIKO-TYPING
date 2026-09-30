// ゲーム画面のUI同期（操作ガイドの自動消去・リザルトのスコア送信）を担うモジュール。
// ReactのuseEffectではなく、Zustandストアの購読（subscribe）で状態遷移に反応する。
import { useGameStore } from '../store/gameStore';
import { submitScore } from '../api/rankings';

let guideTimer = null;
let resultSubmitted = false;

useGameStore.subscribe((state, prev) => {
  // --- 操作ガイド: 再生開始から5秒間だけ表示 ---
  if (state.status === 'playing' && prev.status !== 'playing') {
    state.setShowGuide(true);
    resultSubmitted = false;
    if (guideTimer) clearTimeout(guideTimer);
    guideTimer = setTimeout(() => {
      useGameStore.getState().setShowGuide(false);
    }, 5000);
  }
  if (state.status !== 'playing' && prev.status === 'playing') {
    if (guideTimer) {
      clearTimeout(guideTimer);
      guideTimer = null;
    }
    if (state.showGuide) {
      state.setShowGuide(false);
    }
  }

  // --- スコア送信: 結果画面へ遷移したタイミングで1回だけ送信（公式譜面のみ） ---
  if (state.status === 'result' && prev.status !== 'result' && !resultSubmitted) {
    if (!state.isLocalPlay && state.scoreFileName) {
      resultSubmitted = true;
      submitScore({
        songId: state.scoreFileName.replace(/\.json$/i, ''),
        playerName: 'Guest',
        score: state.score,
        maxCombo: state.maxCombo,
        maxKps: state.maxKps
      }).catch(err => {
        console.error("Score submission failed", err);
        useGameStore.getState().showToast(`送信失敗: ${err.message || '不明なエラー'}`);
      });
    }
  }
});
