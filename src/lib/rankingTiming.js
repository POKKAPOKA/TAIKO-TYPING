// FAST・LATEは正確に中央で押した入力を含まない。すべての有効な記録でTurnstile本人確認を必須とする。
export function classifyRankingTiming(stats) {
  const fast = stats?.fastCount;
  const late = stats?.lateCount;
  if (!Number.isSafeInteger(fast) || fast < 0 || !Number.isSafeInteger(late) || late < 0) return 'unavailable';
  const total = fast + late;
  if (!Number.isSafeInteger(total)) return 'unavailable';
  if (total === 0) return 'ineligible';
  return 'verification';
}
