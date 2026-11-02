// ゲーム画面のUI同期（操作ガイドの自動消去・曲終了時のランキング自動登録）を担うモジュール。
// ReactのuseEffectではなく、Zustandストアの購読（subscribe）で状態遷移に反応する。
import { useGameStore } from '../store/gameStore';
import { submitScore } from '../api/rankings';
import { canSubmitRanking } from '../lib/rankingEligibility';

let guideTimer = null;
useGameStore.subscribe((state, prev) => {
  // --- 操作ガイド: 再生開始から5秒間だけ表示 ---
  if (state.status === 'playing' && prev.status !== 'playing') {
    state.setShowGuide(true);
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

  // --- 曲終了（リザルト画面遷移）時：公式譜面ならランキングへ自動登録 ---
  if (state.status === 'result' && prev.status !== 'result') {
    // 名前別の記録では、Guestの重複レコードを作らず手動登録時に名前を確定する。
    if (canSubmitRanking(state) && !(state.playBoothMode && state.playBoothRecordByName)) {
      let savedPlayerName = 'Guest';
      if (!state.playBoothMode) {
        try {
          savedPlayerName = (localStorage.getItem('taiko_player_name') || '').trim() || 'Guest';
        } catch {
          savedPlayerName = 'Guest';
        }
      }

      state.setIsSubmittingScore(true);
      state.setSubmitSuccessMessage(null);

      submitScore({
        songId: state.scoreFileName.replace(/\.json$/i, ''),
        playerName: savedPlayerName,
        deviceId: state.playBoothMode ? state.currentPlaySessionId : undefined,
        score: state.score,
        maxCombo: state.maxCombo,
        maxKps: state.maxKps,
        perfectCount: state.perfectCount,
        goodCount: state.goodCount,
        missCount: state.missCount,
        totalNotes: state.statsData?.stats?.totalNotes,
        isAuto: true
      })
        .then((res) => {
          const current = useGameStore.getState();
          if (current.status !== 'result' || current.currentPlaySessionId !== state.currentPlaySessionId) return;
          if (res.updated) {
            current.setSubmitSuccessMessage('ベストスコアを更新してランキングに登録しました');
          } else {
            current.setSubmitSuccessMessage('自己ベスト未更新（過去ベスト登録済み）');
          }
        })
        .catch((err) => {
          console.error('Auto score submit failed:', err);
          const current = useGameStore.getState();
          if (current.status === 'result' && current.currentPlaySessionId === state.currentPlaySessionId) {
            current.setSubmitSuccessMessage(['RANKING_INVALID_NOTE_COUNT', 'RANKING_INVALID_KPS'].includes(err.code) ? err.message : '自動登録に失敗しました。「登録する」から再試行できます');
          }
        })
        .finally(() => {
          const current = useGameStore.getState();
          if (current.currentPlaySessionId === state.currentPlaySessionId) current.setIsSubmittingScore(false);
        });
    }
  }
});

