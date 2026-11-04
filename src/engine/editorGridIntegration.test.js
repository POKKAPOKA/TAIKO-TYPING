import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../store/editorStore';
import { generateSaveData, importScoreFile } from './EditorController';

afterEach(() => vi.unstubAllGlobals());

describe('区間グリッドの保存と履歴', () => {
  it('譜面へ保存して再読み込みし、古い譜面には範囲を残さない', () => {
    useEditorStore.setState({ bpm: 120, offset: 0, editorNotes: [{ id: 'note', measure: 0, beat: 1 / 3, durationBeats: 1 / 3, word: 'a' }], gridRegions: [{ start: 0, end: 2, division: 12 }], pastNotes: [], futureNotes: [] });
    const saved = generateSaveData();
    expect(JSON.parse(saved).editorGridRegions).toEqual([{ start: 0, end: 2, division: 12 }]);
    class Reader { readAsText(file) { this.onload({ target: { result: file.contents } }); } }
    vi.stubGlobal('FileReader', Reader);
    importScoreFile({ contents: saved });
    expect(useEditorStore.getState().gridRegions).toEqual([{ start: 0, end: 2, division: 12 }]);
    expect(useEditorStore.getState().editorNotes[0].beat).toBeCloseTo(1 / 3);
    importScoreFile({ contents: JSON.stringify({ bpm: 120, notes: [] }) });
    expect(useEditorStore.getState().gridRegions).toEqual([]);
  });

  it('グリッド変更とノーツ変更をそれぞれ元に戻してやり直せる', () => {
    useEditorStore.setState({ editorNotes: [], gridRegions: [], pastNotes: [], futureNotes: [], selectedNoteIds: [] });
    useEditorStore.getState().updateGridRegion(0, 2, 24);
    useEditorStore.getState().addEditorNote({ id: 'n', measure: 0, beat: 0, durationBeats: 1 / 6, word: 'x' });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState()).toMatchObject({ editorNotes: [], gridRegions: [{ start: 0, end: 2, division: 24 }] });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().gridRegions).toEqual([]);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().gridRegions).toEqual([{ start: 0, end: 2, division: 24 }]);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().editorNotes).toHaveLength(1);
  });
});
