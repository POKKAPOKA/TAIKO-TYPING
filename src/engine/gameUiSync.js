// ゲーム画面のUI同期（操作ガイドの自動消去・ボーカリストの0.4秒周期歌唱アニメーション・曲終了時のランキング自動登録）を担うモジュール。
// ReactのuseEffectではなく、Zustandストアの購読（subscribe）で状態遷移に反応する。
import { useGameStore } from '../store/gameStore';
import { submitScore } from '../api/rankings';

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

  // --- 曲終了（リザルト画面遷移）時：公式譜面ならランキングへ自動登録 ---
  if (state.status === 'result' && prev.status !== 'result') {
    if (!state.isLocalPlay && state.scoreFileName) {
      let savedPlayerName = 'Guest';
      try {
        savedPlayerName = (localStorage.getItem('taiko_player_name') || '').trim() || 'Guest';
      } catch {
        savedPlayerName = 'Guest';
      }

      state.setIsSubmittingScore(true);
      state.setSubmitSuccessMessage(null);

      submitScore({
        songId: state.scoreFileName.replace(/\.json$/i, ''),
        playerName: savedPlayerName,
        score: state.score,
        maxCombo: state.maxCombo,
        maxKps: state.maxKps,
        perfectCount: state.perfectCount,
        goodCount: state.goodCount,
        missCount: state.missCount,
        isAuto: true
      })
        .then((res) => {
          const current = useGameStore.getState();
          if (current.status !== 'result') return;
          if (res.updated) {
            current.setSubmitSuccessMessage('ベストスコアを更新してランキングに登録しました');
          } else {
            current.setSubmitSuccessMessage('自己ベスト未更新（過去ベスト登録済み）');
          }
        })
        .catch((err) => {
          console.error('Auto score submit failed:', err);
          const current = useGameStore.getState();
          if (current.status === 'result') {
            current.setSubmitSuccessMessage('自動登録に失敗しました。「登録する」から再試行できます');
          }
        })
        .finally(() => {
          useGameStore.getState().setIsSubmittingScore(false);
        });
    }
  }
});

