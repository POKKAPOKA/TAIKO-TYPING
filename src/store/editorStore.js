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
  isPlaying: false,
  currentTime: 0,
  offset: 0, // ms単位

  // テスト用のノーツ配列 (エディタで配置したもの)
  // 構造: { id, measure, beat, durationBeats, word }
  editorNotes: [],

  // 選択状態
  selectedNoteId: null,

  // シーク状態
  seekRequest: null, // ms単位でのシーク要求

  // 履歴管理 (Undo / Redo)
  pastNotes: [],
  futureNotes: [],

  setBpm: (bpm) => set({ bpm }),
  setScrollTimeOffset: (offsetTime) => set({ scrollTimeOffset: Math.max(0, offsetTime) }),
  setTimelineWidth: (width) => set({ timelineWidth: width }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (time) => set({ currentTime: time }), 
  setOffset: (offset) => set({ offset }),
  setSelectedNoteId: (id) => set({ selectedNoteId: id }),
  setSeekRequest: (time) => set({ seekRequest: time }),

  // 履歴保存の内部ヘルパー（最大50件）
  saveHistory: (state) => {
    const newPast = [...state.pastNotes, state.editorNotes].slice(-50);
    return { pastNotes: newPast, futureNotes: [] };
  },

  addEditorNote: (note) => set((state) => ({ 
    ...state.saveHistory(state),
    editorNotes: [...state.editorNotes, note],
    selectedNoteId: note.id // 追加されたノーツを選択状態にする
  })),
  
  updateEditorNote: (id, updates) => set((state) => ({
    ...state.saveHistory(state),
    editorNotes: state.editorNotes.map(n => n.id === id ? { ...n, ...updates } : n)
  })),
  
  removeEditorNote: (id) => set((state) => ({
    ...state.saveHistory(state),
    editorNotes: state.editorNotes.filter(n => n.id !== id),
    selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId
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
