import { create } from 'zustand';

export const useGameStore = create((set) => ({
  score: 0,
  combo: 0,
  maxCombo: 0,
  missCount: 0,
  justiceCount: 0,
  attackCount: 0,
  completedCount: 0,
  droppedCount: 0,
  typoCount: 0,
  maxKps: 0,
  maxScore: 0,
  status: 'idle', // 'idle' | 'playing' | 'result'
  
  // 読み込んだデータ
  loadedScore: null,
  audioUrl: null,
  scoreFileName: null,
  audioFileName: null,
  isLocalPlay: false,

  // 現在ターゲットになっている単語の情報
  currentTarget: null,
  activeWord: null,
  typedIndex: 0,

  // 直近の判定結果（良、可、不可）表示用
  lastJudgment: null,
  
  // 今後流れてくる単語のキュー
  // { id, word, time } の配列
  wordQueue: [],

  // アクション群
  setScore: (score) => set({ score }),
  addScore: (points) => set((state) => ({ score: state.score + points })),
  
  setCombo: (combo) => set((state) => ({
    combo,
    maxCombo: Math.max(state.maxCombo, combo)
  })),
  
  addMissCount: () => set((state) => ({ missCount: state.missCount + 1 })),
  addJusticeCount: () => set((state) => ({ justiceCount: state.justiceCount + 1 })),
  addAttackCount: () => set((state) => ({ attackCount: state.attackCount + 1 })),
  
  addCompletedCount: () => set((state) => ({ completedCount: state.completedCount + 1 })),
  addDroppedCount: () => set((state) => ({ droppedCount: state.droppedCount + 1 })),
  addTypoCount: () => set((state) => ({ typoCount: state.typoCount + 1 })),
  updateMaxKps: (kps) => set((state) => ({ maxKps: Math.max(state.maxKps, kps) })),
  
  setMaxScore: (maxScore) => set({ maxScore }),
  
  setStatus: (status) => set({ status }),
  
  setLoadedScore: (score, fileName) => set({ loadedScore: score, scoreFileName: fileName || null }),
  setAudioUrl: (url, fileName) => set({ audioUrl: url, audioFileName: fileName || null }),
  setIsLocalPlay: (isLocal) => set({ isLocalPlay: isLocal }),
  
  setCurrentTarget: (target) => set({ currentTarget: target }),
  setActiveWord: (word) => set({ activeWord: word }),
  setTypedIndex: (index) => set({ typedIndex: index }),
  
  setLastJudgment: (judgment) => set({ lastJudgment: judgment }),

  setWordQueue: (queue) => set({ wordQueue: queue }),

  resetPlayState: () => set({
    score: 0,
    combo: 0,
    maxCombo: 0,
    missCount: 0,
    justiceCount: 0,
    attackCount: 0,
    completedCount: 0,
    droppedCount: 0,
    typoCount: 0,
    maxKps: 0,
    status: 'idle',
    currentTarget: null,
    activeWord: null,
    typedIndex: 0,
    lastJudgment: null,
    wordQueue: []
  }),

  clearSetup: () => set({
    score: 0,
    combo: 0,
    maxCombo: 0,
    missCount: 0,
    justiceCount: 0,
    attackCount: 0,
    completedCount: 0,
    droppedCount: 0,
    typoCount: 0,
    maxKps: 0,
    maxScore: 0,
    status: 'idle',
    currentTarget: null,
    activeWord: null,
    typedIndex: 0,
    lastJudgment: null,
    wordQueue: []
  })
}));
