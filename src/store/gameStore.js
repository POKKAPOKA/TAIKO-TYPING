import { create } from 'zustand';

// トースト自動消去用タイマー（UI側のuseEffectを使わずストア側で管理する）
let toastTimer = null;

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
  showGuide: false, // プレイ開始直後に数秒間だけ表示する操作ガイド

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
  judgmentCount: 0,

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
  setShowGuide: (showGuide) => set({ showGuide }),

  setLoadedScore: (score, fileName) => set({ loadedScore: score, scoreFileName: fileName || null }),
  setAudioUrl: (url, fileName) => set((state) => {
    if (state.audioUrl && state.audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(state.audioUrl);
    }
    return { audioUrl: url, audioFileName: fileName || null };
  }),
  setIsLocalPlay: (isLocal) => set({ isLocalPlay: isLocal }),

  setCurrentTarget: (target) => set({ currentTarget: target }),
  setActiveWord: (word) => set({ activeWord: word }),
  setTypedIndex: (index) => set({ typedIndex: index }),
  setTargetState: (target, activeWord, typedIndex) => set({
    currentTarget: target,
    activeWord,
    typedIndex
  }),

  setLastJudgment: (judgment) => set((state) => ({
    lastJudgment: judgment,
    judgmentCount: state.judgmentCount + 1
  })),

  toastMessage: null,
  toastId: 0,
  showToast: (msg) => {
    // 3秒後に自動で消す
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toastMessage: null }), 3000);
    set((state) => ({ toastMessage: msg, toastId: state.toastId + 1 }));
  },

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
    showGuide: false,
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
    showGuide: false,
    currentTarget: null,
    activeWord: null,
    typedIndex: 0,
    lastJudgment: null,
    wordQueue: []
  })
}));
