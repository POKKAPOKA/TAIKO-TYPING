// プレイ開始時に確定したモードおよびホバー開始検証で、自動・手動送信のどちらも判定する。
export function canSubmitRanking(state) {
  return Boolean(state && !state.isLocalPlay && !state.playRhythmMode && state.scoreFileName && state.playStartVerified !== false);
}
