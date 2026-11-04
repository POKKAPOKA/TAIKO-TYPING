// 全音符に対する分割数。範囲外は16分、拍は四分音符を1とする。
export const GRID_DIVISIONS = [12, 16, 24, 32];
const EPSILON = 1e-8;
const roundBeat = value => Math.round(value * 1e9) / 1e9;
export const gridStep = division => 4 / division;

// 重なりは新しい範囲で置換し、前後の同じ範囲を結合する。
export function setGridRegion(regions, start, end, division) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !GRID_DIVISIONS.includes(division)) return regions;
  const left = Math.max(0, Math.min(start, end));
  const right = Math.max(0, Math.max(start, end));
  if (right - left < EPSILON) return regions;
  const next = [];
  for (const region of regions) {
    if (region.end <= left || region.start >= right) next.push(region);
    else {
      if (region.start < left) next.push({ ...region, end: left });
      if (region.end > right) next.push({ ...region, start: right });
    }
  }
  if (division !== 16) next.push({ start: left, end: right, division });
  next.sort((a, b) => a.start - b.start);
  return next.reduce((out, r) => {
    const previous = out[out.length - 1];
    if (previous && previous.division === r.division && Math.abs(previous.end - r.start) < EPSILON) previous.end = r.end;
    else out.push({ ...r });
    return out;
  }, []);
}

export function normalizeGridRegions(input) {
  if (!Array.isArray(input)) return [];
  return input.reduce((regions, region) => {
    if (!region || !Number.isFinite(region.start) || !Number.isFinite(region.end) ||
        region.start < 0 || region.end <= region.start || !GRID_DIVISIONS.includes(region.division)) return regions;
    return setGridRegion(regions, region.start, region.end, region.division);
  }, []);
}

// 切り替え境界も操作可能なグリッド点とする。拍0を基準に各音符間隔を揃える。
function segmentAt(beat, regions) {
  let start = 0;
  for (const region of regions) {
    if (beat < region.start - EPSILON) return { start, end: region.start, division: 16 };
    if (beat < region.end - EPSILON) return region;
    start = region.end;
  }
  return { start, end: Infinity, division: 16 };
}

export function snapEditorBeat(value, regions = []) {
  const beat = Math.max(0, Number.isFinite(value) ? value : 0);
  const segment = segmentAt(beat, regions);
  const step = gridStep(segment.division);
  const first = Math.ceil((segment.start - EPSILON) / step) * step;
  const last = Number.isFinite(segment.end) ? Math.floor((segment.end + EPSILON) / step) * step : Infinity;
  const candidates = [segment.start];
  if (Number.isFinite(segment.end)) candidates.push(segment.end);
  if (first <= last + EPSILON) candidates.push(Math.max(first, Math.min(last, Math.round(beat / step) * step)));
  return roundBeat(candidates.reduce((best, candidate) => Math.abs(candidate - beat) < Math.abs(best - beat) ? candidate : best));
}

export function nextEditorGridBeat(value, regions = []) {
  const start = Math.max(0, value);
  const segment = segmentAt(start + EPSILON * 2, regions);
  const step = gridStep(segment.division);
  const next = (Math.floor((start + EPSILON) / step) + 1) * step;
  return roundBeat(Math.min(next, segment.end));
}
