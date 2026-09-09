import { create } from 'zustand';

export const useEditorStore = create((set) => ({
  bpm: 120,
  // 1小節の幅 (px)
  measureWidth: 320, 
  
  // タイムラインの左端が表す絶対時間 (ms)
  scrollTimeOffset: 0,
  
  // エディタのタイムラインの表示幅 (px) - Timelineコンポーネントがマウントされた時に更新する
  timelineWidth: 1280, 

  // 再生状態と設定
  audioUrl: './audio/track.mp3',
  audioPeaks: [],
  isPlaying: false,
  currentTime: 0,
  offset: 0, // ms単位

  // テスト用のノーツ配列 (エディタで配置したもの)
  // 構造: { id, measure, beat, durationBeats, word }
  editorNotes: [],

  // 選択状態 (複数選択対応)
  selectedNoteIds: [],
  
  // クリップボード状態
  clipboardNotes: [],

  // シーク状態
  seekRequest: null, // ms単位でのシーク要求

  // 履歴管理 (Undo / Redo)
  pastNotes: [],
  futureNotes: [],

  // ズーム状態
  zoomLevel: 1.0,

  // ファイルハンドル (クイックセーブ用)
  fileHandle: null,

  setFileHandle: (handle) => set({ fileHandle: handle }),

  setBpm: (bpm) => set({ bpm: Number.isNaN(bpm) ? 120 : bpm }),
  setScrollTimeOffset: (offsetTime) => {
    if (Number.isNaN(offsetTime)) return;
    set({ scrollTimeOffset: Math.max(0, offsetTime) });
  },
  setTimelineWidth: (width) => set({ timelineWidth: width }),
  setZoomLevel: (level) => {
    let newLevel = Number(level);
    if (Number.isNaN(newLevel)) return;
    newLevel = Math.max(0.1, Math.min(3.0, newLevel));
    set({ zoomLevel: newLevel });
  },
  audioDuration: 60000,
  setAudioDuration: (duration) => set({ audioDuration: duration }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  setAudioPeaks: (peaks) => set({ audioPeaks: peaks }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (time) => {
    if (!Number.isNaN(time)) set({ currentTime: time });
  }, 
  setOffset: (offset) => {
    if (!Number.isNaN(offset)) set({ offset });
  },
  setSelectedNoteIds: (ids) => set({ selectedNoteIds: ids }),
  setClipboardNotes: (notes) => set({ clipboardNotes: notes }),
  setSeekRequest: (time) => {
    if (!Number.isNaN(time)) set({ seekRequest: time });
  },

  // 履歴保存の内部ヘルパー（最大50件）
  saveHistory: (state) => {
    const newPast = [...state.pastNotes, state.editorNotes].slice(-50);
    return { pastNotes: newPast, futureNotes: [] };
  },

  addEditorNote: (note) => set((state) => ({ 
    ...state.saveHistory(state),
    editorNotes: [...state.editorNotes, note],
    selectedNoteIds: [note.id] // 追加されたノーツを選択状態にする
  })),

  addMultipleNotes: (notes) => set((state) => ({
    ...state.saveHistory(state),
    editorNotes: [...state.editorNotes, ...notes],
    selectedNoteIds: notes.map(n => n.id)
  })),
  
  updateEditorNote: (id, updates) => set((state) => ({
    ...state.saveHistory(state),
    editorNotes: state.editorNotes.map(n => n.id === id ? { ...n, ...updates } : n)
  })),

  updateMultipleNotes: (updatesArray) => set((state) => {
    const updateMap = new Map(updatesArray.map(u => [u.id, u.updates]));
    return {
      ...state.saveHistory(state),
      editorNotes: state.editorNotes.map(n => updateMap.has(n.id) ? { ...n, ...updateMap.get(n.id) } : n)
    };
  }),
  
  removeEditorNote: (id) => set((state) => ({
    ...state.saveHistory(state),
    editorNotes: state.editorNotes.filter(n => n.id !== id),
    selectedNoteIds: state.selectedNoteIds.filter(selectedId => selectedId !== id)
  })),

  removeMultipleNotes: (ids) => set((state) => ({
    ...state.saveHistory(state),
    editorNotes: state.editorNotes.filter(n => !ids.includes(n.id)),
    selectedNoteIds: state.selectedNoteIds.filter(selectedId => !ids.includes(selectedId))
  })),
  
  clearEditorNotes: () => set((state) => ({ 
    ...state.saveHistory(state),
    editorNotes: [],
    selectedNoteId: null
  })),

  undo: () => set((state) => {
    if (state.pastNotes.length === 0) return state;
    const previousNotes = state.pastNotes[state.pastNotes.length - 1];
    const newPastNotes = state.pastNotes.slice(0, -1);
    return {
      pastNotes: newPastNotes,
      futureNotes: [state.editorNotes, ...state.futureNotes],
      editorNotes: previousNotes,
      selectedNoteId: null
    };
  }),

  redo: () => set((state) => {
    if (state.futureNotes.length === 0) return state;
    const nextNotes = state.futureNotes[0];
    const newFutureNotes = state.futureNotes.slice(1);
    const newPast = [...state.pastNotes, state.editorNotes].slice(-50);
    return {
      pastNotes: newPast,
      futureNotes: newFutureNotes,
      editorNotes: nextNotes,
      selectedNoteId: null
    };
  }),
}));
