// 演出とリザルトで同じ達成条件を使う。
export function getAchievementRank({ score, perfectCount, goodCount, missCount, droppedCount, completedCount, statsData }) {
  if (score < 700000) return 'FAILED';

  const totalNotes = statsData?.stats?.totalNotes ?? 0;
  const hasIncompleteNotes = droppedCount > 0 ||
    (totalNotes > 0 && completedCount < totalNotes) ||
    (statsData?.mistakeLog || []).some(log => log.type === 'dropped');

  if (!hasIncompleteNotes && missCount === 0) {
    if (goodCount === 0 && perfectCount > 0) return 'ALL_PERFECT';
    if (goodCount > 0) return 'FULL_COMBO';
  }
  return 'CLEAR';
}
