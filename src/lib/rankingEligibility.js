// プレイ開始時に確定したモードで、自動・手動送信のどちらも判定する。
export function canSubmitRanking(state) {
  return Boolean(state && !state.isLocalPlay && !state.playRhythmMode && state.scoreFileName);
}
