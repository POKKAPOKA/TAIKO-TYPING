import { describe, expect, it } from 'vitest';
import { normalizeGridRegions, setGridRegion, snapEditorBeat, nextEditorGridBeat } from './editorGrid';

describe('エディターの区間別グリッド', () => {
  it('16分を標準とし、指定区間だけ12分・24分・32分に吸着する', () => {
    let regions = setGridRegion([], 1, 2, 12);
    regions = setGridRegion(regions, 3, 4, 24);
    regions = setGridRegion(regions, 5, 6, 32);
    expect(snapEditorBeat(0.18, regions)).toBe(0.25);
    expect(snapEditorBeat(1.32, regions)).toBeCloseTo(4 / 3);
    expect(snapEditorBeat(3.16, regions)).toBeCloseTo(19 / 6);
    expect(snapEditorBeat(5.12, regions)).toBeCloseTo(5.125);
    expect(nextEditorGridBeat(5, regions)).toBeCloseTo(5.125);
  });
  it('逆方向の指定、重なりの置換、16分への復元、隣接範囲の結合', () => {
    let regions = setGridRegion([], 4, 1, 12);
    regions = setGridRegion(regions, 2, 3, 24);
    expect(regions).toEqual([{ start: 1, end: 2, division: 12 }, { start: 2, end: 3, division: 24 }, { start: 3, end: 4, division: 12 }]);
    regions = setGridRegion(regions, 2, 3, 12);
    expect(regions).toEqual([{ start: 1, end: 4, division: 12 }]);
    expect(setGridRegion(regions, 2, 3, 16)).toEqual([{ start: 1, end: 2, division: 12 }, { start: 3, end: 4, division: 12 }]);
  });
  it('範囲境界へ吸着し、次のグリッドへ移動できる', () => {
    const regions = setGridRegion([], 1.25, 2.25, 12);
    expect(snapEditorBeat(1.24, regions)).toBe(1.25);
    expect(snapEditorBeat(1.26, regions)).toBe(1.25);
    expect(nextEditorGridBeat(1.25, regions)).toBeCloseTo(4 / 3);
  });
  it('不正な保存データと空範囲を無視する', () => {
    expect(normalizeGridRegions([null, { start: -1, end: 2, division: 12 }, { start: 1, end: 1, division: 12 }, { start: 0, end: 1, division: 7 }])).toEqual([]);
    expect(setGridRegion([], 2, 2, 12)).toEqual([]);
  });
});
