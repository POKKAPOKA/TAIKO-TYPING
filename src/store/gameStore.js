import { create } from 'zustand';

// トースト自動消去用タイマー（UI側のuseEffectを使わずストア側で管理する）
let toastTimer = null;
// ボーカリストのミス表情維持用タイマー（1.2秒間維持）
let vocalMissTimer = null;

// 設定値をlocalStorageに永続化するためのキー
const SETTINGS_STORAGE_KEY = 'taiko_settings';
const CHARACTER_STORAGE_KEY = 'taiko_selected_character';
const INPUT_MODE_STORAGE_KEY = 'taiko_input_mode';

function loadSelectedCharacter() {
  try {
    return localStorage.getItem(CHARACTER_STORAGE_KEY) || 'char_test';
  } catch {
    return 'char_test';
  }
}

// 入力モード（PC / スマホ）の初期値を決定する
// ユーザーがまだ手動でモードを選択していない場合は、端末（画面幅768px以下 または タッチ端末 pointer: coarse）を検知して自動設定する
function loadInitialMobileMode() {
  try {
    const savedMode = localStorage.getItem(INPUT_MODE_STORAGE_KEY);
    if (savedMode === 'mobile') return true;
    if (savedMode === 'pc') return false;
  } catch {
    // localStorage アクセス不可時は端末判定へフォールバック
  }

  if (typeof window !== 'undefined') {
    const isSmallScreen = window.innerWidth <= 768 ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches);
    const isCoarsePointer = typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    return Boolean(isSmallScreen || isCoarsePointer);
  }
  return false;
}

// 保存された設定を読み込む（なければデフォルト値）
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { speedMultiplier: 1.0, wallAmount: 0, offsetMs: 0, showCustomModes: false };
    const parsed = JSON.parse(raw);
    return {
      speedMultiplier: typeof parsed.speedMultiplier === 'number'
        ? Math.min(10.0, Math.max(1.0, parseFloat(parsed.speedMultiplier.toFixed(2))))
        : 1.0,
      wallAmount: typeof parsed.wallAmount === 'number' ? parsed.wallAmount : 0,
      offsetMs: typeof parsed.offsetMs === 'number' ? parsed.offsetMs : 0,
      showCustomModes: typeof parsed.showCustomModes === 'boolean' ? parsed.showCustomModes : false
    };
  } catch {
    return { speedMultiplier: 1.0, wallAmount: 0, offsetMs: 0, showCustomModes: false };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 保存失敗時は無視（プライベートモード等）
  }
}

// プレイ関連状態の初期値（resetPlayState / resetGameState で共用）
const initialPlayState = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  missCount: 0,
  perfectCount: 0,
  greatCount: 0,
  goodCount: 0,
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
  wordQueue: [],
  statsData: null,
  vocalState: 'sing_1'
};

export const useGameStore = create((set) => ({
  score: 0,
  combo: 0,
  maxCombo: 0,
  missCount: 0,
  perfectCount: 0,
  greatCount: 0,
  goodCount: 0,
  completedCount: 0,
  droppedCount: 0,
  typoCount: 0,
  maxKps: 0,
  maxScore: 0,
  status: 'idle', // 'idle' | 'playing' | 'result'
  isPaused: false,
  isFullscreen: false,
  isMobileMode: loadInitialMobileMode(),
  showSettings: false,
  showGuide: false, // プレイ開始直後に数秒間だけ表示する操作ガイド

  // ボーカリスト演出用ステート ('sing_1' | 'sing_2' | 'miss')
  selectedCharacterId: loadSelectedCharacter(),
  vocalState: 'sing_1',

  // 設定（設定画面で変更。プレイ中に変えた場合はリトライで反映）
  // localStorage に永続化され、リロード後も維持される
  ...loadSettings(),

  // リザルト画面用の集計データ（プレイ終了時にGameEngineがセットする）
  statsData: null,

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
  addPerfectCount: () => set((state) => ({ perfectCount: state.perfectCount + 1 })),
  addGreatCount: () => set((state) => ({ greatCount: state.greatCount + 1 })),
  addGoodCount: () => set((state) => ({ goodCount: state.goodCount + 1 })),

  setSelectedCharacterId: (selectedCharacterId) => {
    try {
      localStorage.setItem(CHARACTER_STORAGE_KEY, selectedCharacterId);
    } catch {
      // ignore
    }
    set({ selectedCharacterId });
  },
  setVocalState: (vocalState) => set({ vocalState }),
  triggerVocalSing: () => {
    if (vocalMissTimer) {
      clearTimeout(vocalMissTimer);
      vocalMissTimer = null;
    }
    set((state) => ({
      vocalState: state.vocalState === 'sing_1' ? 'sing_2' : 'sing_1'
    }));
  },
  triggerVocalMiss: () => {
    if (vocalMissTimer) {
      clearTimeout(vocalMissTimer);
    }
    set({ vocalState: 'miss' });
    vocalMissTimer = setTimeout(() => {
      vocalMissTimer = null;
      set((state) => (state.vocalState === 'miss' ? { vocalState: 'sing_1' } : {}));
    }, 1200);
  },

  addCompletedCount: () => set((state) => ({ completedCount: state.completedCount + 1 })),
  addDroppedCount: () => set((state) => ({ droppedCount: state.droppedCount + 1 })),
  addTypoCount: () => set((state) => ({ typoCount: state.typoCount + 1 })),
  updateMaxKps: (kps) => set((state) => ({ maxKps: Math.max(state.maxKps, kps) })),

  setMaxScore: (maxScore) => set({ maxScore }),

  setStatus: (status) => set({ status }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  setIsMobileMode: (isMobileMode) => {
    try {
      localStorage.setItem(INPUT_MODE_STORAGE_KEY, isMobileMode ? 'mobile' : 'pc');
    } catch {
      // 保存失敗時は無視
    }
    set({ isMobileMode });
  },
  setShowSettings: (showSettings) => set({ showSettings }),
  setShowGuide: (showGuide) => set({ showGuide }),
  // 設定変更時はlocalStorageにも保存する
  setSpeedMultiplier: (speedMultiplier) => set((state) => {
    const val = typeof speedMultiplier === 'number'
      ? Math.min(10.0, Math.max(1.0, parseFloat(speedMultiplier.toFixed(2))))
      : 1.0;
    const next = { speedMultiplier: val, wallAmount: state.wallAmount, offsetMs: state.offsetMs, showCustomModes: state.showCustomModes };
    saveSettings(next);
    return { speedMultiplier: val };
  }),
  setWallAmount: (wallAmount) => set((state) => {
    const next = { speedMultiplier: state.speedMultiplier, wallAmount, offsetMs: state.offsetMs, showCustomModes: state.showCustomModes };
    saveSettings(next);
    return { wallAmount };
  }),
  setOffsetMs: (offsetMs) => set((state) => {
    const next = { speedMultiplier: state.speedMultiplier, wallAmount: state.wallAmount, offsetMs, showCustomModes: state.showCustomModes };
    saveSettings(next);
    return { offsetMs };
  }),
  setShowCustomModes: (showCustomModes) => set((state) => {
    const next = { speedMultiplier: state.speedMultiplier, wallAmount: state.wallAmount, offsetMs: state.offsetMs, showCustomModes };
    saveSettings(next);
    return { showCustomModes };
  }),
  toggleShowCustomModes: () => set((state) => {
    const showCustomModes = !state.showCustomModes;
    const next = { speedMultiplier: state.speedMultiplier, wallAmount: state.wallAmount, offsetMs: state.offsetMs, showCustomModes };
    saveSettings(next);
    return { showCustomModes };
  }),
  setStatsData: (statsData) => set({ statsData }),

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

  // プレイ結果系の状態だけを初期化する（譜面・音源・maxScoreは保持。リトライ時に使用）
  // ポーズ・設定表示もここで解除しないと、リトライ直後にポーズ画面が残ってしまう
  resetPlayState: () => {
    if (vocalMissTimer) {
      clearTimeout(vocalMissTimer);
      vocalMissTimer = null;
    }
    set({ ...initialPlayState, isPaused: false, showSettings: false });
  },

  // プレイ結果系に加えてmaxScoreも初期化する（メニューへ戻る際に使用）
  // ※譜面・音源はあえて保持する。メニューから再びセットアップ画面へ進んだとき、
  //   再読み込みなしで同じデータを使えるようにするため
  resetGameState: () => {
    if (vocalMissTimer) {
      clearTimeout(vocalMissTimer);
      vocalMissTimer = null;
    }
    set({ ...initialPlayState, maxScore: 0, isPaused: false, showSettings: false });
  }
}));


// Fullscreen listener
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    useGameStore.getState().setIsFullscreen(!!document.fullscreenElement);
  });
}
