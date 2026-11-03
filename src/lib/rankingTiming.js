// FAST・LATEは正確に中央で押した入力を含まない。
export function classifyRankingTiming(stats) {
  const fast = stats?.fastCount;
  const late = stats?.lateCount;
  if (!Number.isSafeInteger(fast) || fast < 0 || !Number.isSafeInteger(late) || late < 0) return 'unavailable';
  const total = fast + late;
  if (!Number.isSafeInteger(total)) return 'unavailable';
  if (total === 0) return 'ineligible';
  return total <= 30 ? 'verification' : 'eligible';
}
