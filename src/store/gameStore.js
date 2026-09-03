import { create } from 'zustand';

export const useGameStore = create((set) => ({
  score: 0,
  combo: 0,
  maxCombo: 0,
  missCount: 0,
  maxScore: 0,
  status: 'idle', // 'idle' | 'playing' | 'result'
  
  // 読み込んだデータ
  loadedScore: null,
  audioUrl: null,

  // 現在ターゲットになっている単語の情報
  currentTarget: null,
  // 例: { id: 1, word: "KASI", time: 3000, typed: "K" } 
  // typedはすでに入力された文字列

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
  setMaxScore: (maxScore) => set({ maxScore }),
  
  setStatus: (status) => set({ status }),
  
  setLoadedScore: (score) => set({ loadedScore: score }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  
  setCurrentTarget: (target) => set({ currentTarget: target }),
  
  setLastJudgment: (judgment) => set({ lastJudgment: judgment }),

  setWordQueue: (queue) => set({ wordQueue: queue }),

  reset: () => set({
    score: 0,
    combo: 0,
    maxCombo: 0,
    missCount: 0,
    status: 'idle',
    currentTarget: null,
    lastJudgment: null,
    wordQueue: []
  })
}));
