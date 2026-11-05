import { create } from 'zustand';
import { DEFAULT_CHARACTER_ID, getCharacterById } from '../config/characters';
import { getLocalPlayLogs, savePlayLogToLocal, fetchMergedPlayLogs, clearPlayLogs } from '../utils/csvExport';
import { getLocalSongLikesMap, fetchGlobalSongLikes, updateSongLikeCount, normalizeSongId } from '../api/likes';

// トースト自動消去用タイマー（UI側のuseEffectを使わずストア側で管理する）
let toastTimer = null;
// ボーカリストのミス表情維持用タイマー（1.2秒間維持）
let vocalMissTimer = null;

// 設定値をlocalStorageに永続化するためのキー
const SETTINGS_STORAGE_KEY = 'taiko_settings';
const CHARACTER_STORAGE_KEY = 'taiko_selected_character';
const INPUT_MODE_STORAGE_KEY = 'taiko_input_mode';

const normalizeVolume = (value) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
const normalizeNoteTextScale = (value) => Number.isFinite(value) ? Math.min(3, Math.max(0.5, Number(value.toFixed(2)))) : 1;
const defaultVolumes = { musicVolume: 1, gameplaySeVolume: 1, systemSeVolume: 1 };

function loadSelectedCharacter() {
  try {
    return getCharacterById(localStorage.getItem(CHARACTER_STORAGE_KEY) || DEFAULT_CHARACTER_ID).id;
  } catch {
    return DEFAULT_CHARACTER_ID;
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

// 保存された設定を読み込む（なければデフォルト値：レーン速度 4.00＝標準）
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { speedMultiplier: 4.0, noteTextScale: 1, wallAmount: 0, offsetMs: 0, showCustomModes: false, isBoothMode: true, boothRecordByName: true, isRhythmMode: false, ...defaultVolumes };
    const parsed = JSON.parse(raw);
    // 旧スケール（speedScaleVersion !== 2）で初期値 1.0 のまま保存されていた場合は新基準値 4.0 に移行
    const rawSpeed = parsed.speedScaleVersion === 2
      ? parsed.speedMultiplier
      : (typeof parsed.speedMultiplier === 'number' && parsed.speedMultiplier !== 1.0
          ? parsed.speedMultiplier
          : 4.0);
    return {
      speedMultiplier: typeof rawSpeed === 'number'
        ? Math.min(10.0, Math.max(1.0, parseFloat(rawSpeed.toFixed(2))))
        : 4.0,
      noteTextScale: normalizeNoteTextScale(parsed.noteTextScale),
      wallAmount: typeof parsed.wallAmount === 'number' ? parsed.wallAmount : 0,
      offsetMs: typeof parsed.offsetMs === 'number' ? parsed.offsetMs : 0,
      showCustomModes: typeof parsed.showCustomModes === 'boolean' ? parsed.showCustomModes : false,
      isBoothMode: typeof parsed.isBoothMode === 'boolean' ? parsed.isBoothMode : true,
      boothRecordByName: typeof parsed.boothRecordByName === 'boolean' ? parsed.boothRecordByName : true,
      isRhythmMode: typeof parsed.isRhythmMode === 'boolean' ? parsed.isRhythmMode : false,
      musicVolume: normalizeVolume(parsed.musicVolume),
      gameplaySeVolume: normalizeVolume(parsed.gameplaySeVolume),
      systemSeVolume: normalizeVolume(parsed.systemSeVolume)
    };
  } catch {
    return { speedMultiplier: 4.0, noteTextScale: 1, wallAmount: 0, offsetMs: 0, showCustomModes: false, isBoothMode: true, boothRecordByName: true, isRhythmMode: false, ...defaultVolumes };
  }
}

function saveSettings(settings) {
  try {
    let previous = {};
    try { previous = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}') || {}; } catch { /* 壊れた設定を上書きする */ }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...previous, ...settings, speedScaleVersion: 2 }));
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
  fastCount: 0,
  lateCount: 0,
  untypedCount: 0,
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
  lastRecordedPlayId: null,
  currentPlaySessionId: null,
  playBoothMode: false,
  playBoothRecordByName: false,
  playRhythmMode: false,
  playStartVerified: true,
  vocalState: 'sing_1',
  isSubmittingScore: false,
  submitSuccessMessage: null,
  hasLikedCurrentResult: false,
  isLikingSong: false
};

// PWAスタンドアロン起動（「ホーム画面に追加」から起動）かどうかを判定する
export function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  const isDisplayStandalone =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches);
  const isIosStandalone = window.navigator?.standalone === true;
  return Boolean(isDisplayStandalone || isIosStandalone);
}

const initialMobileMode = loadInitialMobileMode();
const initialSettings = loadSettings();

export const useGameStore = create((set, get) => ({
  score: 0,
  combo: 0,
  maxCombo: 0,
  missCount: 0,
  perfectCount: 0,
  greatCount: 0,
  goodCount: 0,
  fastCount: 0,
  lateCount: 0,
  untypedCount: 0,
  completedCount: 0,
  droppedCount: 0,
  typoCount: 0,
  maxKps: 0,
  maxScore: 0,
  status: 'idle', // 'idle' | 'playing' | 'clearTransition' | 'result'
  isPaused: false,
  isFullscreen: false,
  isMobileMode: initialMobileMode,
  showSettings: false,
  showPwaGuideModal: false,
  showSurveyModal: false,
  showGuide: false, // プレイ開始直後に数秒間だけ表示する操作ガイド

  // ボーカリスト演出用ステート ('sing_1' | 'sing_2' | 'miss')
  selectedCharacterId: loadSelectedCharacter(),
  vocalState: 'sing_1',

  // 設定（設定画面で変更。プレイ中に変えた場合はリトライで反映）
  // localStorage に永続化され、リロード後も維持される
  ...initialSettings,
  isRhythmMode: initialSettings.isRhythmMode && initialSettings.isBoothMode && !initialMobileMode,

  // リザルト画面用の集計データ（プレイ終了時にGameEngineがセットする）
  statsData: null,
  lastRecordedPlayId: null,
  currentPlaySessionId: null,
  playBoothMode: false,
  playBoothRecordByName: false,
  playRhythmMode: false,
  playStartVerified: true,
  playLogsCount: getLocalPlayLogs().length,
  isExportingCsv: false,

  // ランキング送信状態（曲終了時の自動登録とリザルト画面の手動登録で共用）
  isSubmittingScore: false,
  submitSuccessMessage: null,

  // 楽曲ごとのいいね数マップ＆今のリザルト画面でいいね済みかの状態
  songLikesMap: getLocalSongLikesMap(),
  hasLikedCurrentResult: false,
  isLikingSong: false,

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
  addFastCount: () => set((state) => ({ fastCount: state.fastCount + 1 })),
  addLateCount: () => set((state) => ({ lateCount: state.lateCount + 1 })),
  addUntypedCount: () => set((state) => ({ untypedCount: state.untypedCount + 1 })),

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
    // 正しい入力でミス表示から復帰し、通常時の表情は曲の拍に任せる。
    set((state) => state.vocalState === 'miss' ? { vocalState: 'sing_1' } : state);
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
    saveSettings({ isRhythmMode: isMobileMode ? false : get().isRhythmMode });
    set(isMobileMode ? { isMobileMode, isRhythmMode: false } : { isMobileMode });
  },
  setShowSettings: (showSettings) => set({ showSettings }),
  setShowPwaGuideModal: (showPwaGuideModal) => set({ showPwaGuideModal }),
  setShowSurveyModal: (showSurveyModal) => set({ showSurveyModal }),
  setShowGuide: (showGuide) => set({ showGuide }),
  toggleFullscreen: () => {
    if (typeof document === 'undefined') return;
    const docEl = document.documentElement;
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
    const requestFs = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
    const exitFs = document.exitFullscreen || document.webkitExitFullscreen;

    // Fullscreen API の表示中も display-mode: fullscreen に一致するため、
    // ホーム画面アプリの判定より先に終了処理を行う。
    if (fsElement) {
      const handleExitError = () => get().showToast('縮小表示に失敗しました');
      if (typeof exitFs !== 'function') {
        handleExitError();
        return;
      }
      try {
        const result = exitFs.call(document);
        if (result && typeof result.catch === 'function') result.catch(handleExitError);
      } catch {
        handleExitError();
      }
      return;
    }

    if (isStandaloneMode()) {
      get().showToast('ホーム画面アプリとして表示中です');
      return;
    }

    // iOS Safari 等で Fullscreen API が未対応の場合。
    if (typeof requestFs !== 'function') {
      set({ showPwaGuideModal: true });
      get().showToast('スマホで全画面プレイするには、ブラウザの共有メニューから「ホーム画面に追加」して起動してください');
      return;
    }

    try {
      const res = requestFs.call(docEl);
      if (res && typeof res.catch === 'function') {
        res.catch(() => {
          if (get().isMobileMode || /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            set({ showPwaGuideModal: true });
            get().showToast('スマホで全画面プレイするには、ブラウザの共有メニューから「ホーム画面に追加」して起動してください');
          } else {
            get().showToast('全画面表示に失敗しました');
          }
        });
      }
    } catch {
      set({ showPwaGuideModal: true });
      get().showToast('スマホで全画面プレイするには、ブラウザの共有メニューから「ホーム画面に追加」して起動してください');
    }
  },
  // 設定変更時はlocalStorageにも保存する
  setSpeedMultiplier: (speedMultiplier) => set((state) => {
    const val = typeof speedMultiplier === 'number'
      ? Math.min(10.0, Math.max(1.0, parseFloat(speedMultiplier.toFixed(2))))
      : 4.0;
    const next = { speedMultiplier: val, wallAmount: state.wallAmount, offsetMs: state.offsetMs, showCustomModes: state.showCustomModes, isBoothMode: state.isBoothMode };
    saveSettings(next);
    return { speedMultiplier: val };
  }),
  setNoteTextScale: (value) => set(() => {
    const noteTextScale = normalizeNoteTextScale(value);
    saveSettings({ noteTextScale });
    return { noteTextScale };
  }),
  setWallAmount: (wallAmount) => set((state) => {
    const next = { speedMultiplier: state.speedMultiplier, wallAmount, offsetMs: state.offsetMs, showCustomModes: state.showCustomModes, isBoothMode: state.isBoothMode };
    saveSettings(next);
    return { wallAmount };
  }),
  setOffsetMs: (offsetMs) => set((state) => {
    const next = { speedMultiplier: state.speedMultiplier, wallAmount: state.wallAmount, offsetMs, showCustomModes: state.showCustomModes, isBoothMode: state.isBoothMode };
    saveSettings(next);
    return { offsetMs };
  }),
  setShowCustomModes: (showCustomModes) => set((state) => {
    const next = { speedMultiplier: state.speedMultiplier, wallAmount: state.wallAmount, offsetMs: state.offsetMs, showCustomModes, isBoothMode: state.isBoothMode };
    saveSettings(next);
    return { showCustomModes };
  }),
  toggleShowCustomModes: () => {
    const showCustomModes = !get().showCustomModes;
    const state = get();
    const next = { speedMultiplier: state.speedMultiplier, wallAmount: state.wallAmount, offsetMs: state.offsetMs, showCustomModes, isBoothMode: state.isBoothMode };
    saveSettings(next);
    set({ showCustomModes });
    if (showCustomModes) {
      get().refreshPlayLogsCount();
    }
  },
  setBoothMode: (isBoothMode) => set((state) => {
    const isRhythmMode = isBoothMode ? state.isRhythmMode : false;
    saveSettings({ speedMultiplier: state.speedMultiplier, wallAmount: state.wallAmount, offsetMs: state.offsetMs, showCustomModes: state.showCustomModes, isBoothMode, isRhythmMode });
    return { isBoothMode, isRhythmMode };
  }),
  setRhythmMode: (enabled) => set((state) => {
    if (!state.isBoothMode || state.isMobileMode) return state;
    const isRhythmMode = Boolean(enabled);
    saveSettings({ isRhythmMode });
    return { isRhythmMode };
  }),
  setBoothRecordByName: (boothRecordByName) => set(() => {
    saveSettings({ boothRecordByName });
    return { boothRecordByName };
  }),
  setMusicVolume: (value) => set(() => {
    const musicVolume = normalizeVolume(value);
    saveSettings({ musicVolume });
    return { musicVolume };
  }),
  setGameplaySeVolume: (value) => set(() => {
    const gameplaySeVolume = normalizeVolume(value);
    saveSettings({ gameplaySeVolume });
    return { gameplaySeVolume };
  }),
  setSystemSeVolume: (value) => set(() => {
    const systemSeVolume = normalizeVolume(value);
    saveSettings({ systemSeVolume });
    return { systemSeVolume };
  }),
  setStatsData: (statsData) => set({ statsData }),
  setIsExportingCsv: (isExportingCsv) => set({ isExportingCsv }),
  refreshPlayLogsCount: async () => {
    try {
      const { logs } = await fetchMergedPlayLogs();
      set({ playLogsCount: logs.length });
    } catch {
      set({ playLogsCount: getLocalPlayLogs().length });
    }
  },
  clearAllPlayLogs: () => {
    clearPlayLogs();
    set({ playLogsCount: 0 });
  },
  recordCurrentPlayLog: () => {
    const state = get();
    if (state.lastRecordedPlayId) {
      return null;
    }
    const songId = state.scoreFileName
      ? state.scoreFileName.replace(/\.json$/i, '')
      : state.loadedScore?.id || 'custom_song';
    const songTitle = state.loadedScore?.title || songId;
    const creator =
      state.loadedScore?.creator ||
      (state.isLocalPlay ? 'カスタム譜面' : '公式譜面');
    const definedLevel = Number(state.loadedScore?.difficulty) || 1;
    const totalNotes =
      Number(state.statsData?.stats?.totalNotes) ||
      Number(state.loadedScore?.notesCount) ||
      Number(state.loadedScore?.notes?.length) ||
      state.perfectCount + state.goodCount + state.missCount ||
      1;

    const entry = savePlayLogToLocal({
      songId,
      songTitle,
      creator,
      definedLevel,
      totalNotes,
      isMobileMode: state.isMobileMode,
      isRhythmMode: state.playRhythmMode,
      score: state.score,
      perfectCount: state.perfectCount,
      goodCount: state.goodCount,
      missCount: state.missCount,
      maxCombo: state.maxCombo,
      peakKps: state.maxKps,
      worstKeys: state.statsData?.worstKeys || [],
      mistakeLog: state.statsData?.mistakeLog || [],
    });

    set((prev) => ({
      lastRecordedPlayId: entry.id,
      playLogsCount: Math.max(prev.playLogsCount + 1, getLocalPlayLogs().length),
    }));
    // Supabase側の件数も含めて最新件数を非同期で同期
    get().refreshPlayLogsCount();
    return entry;
  },
  setIsSubmittingScore: (isSubmittingScore) => set({ isSubmittingScore }),
  setSubmitSuccessMessage: (submitSuccessMessage) => set({ submitSuccessMessage }),

  refreshSongLikes: async () => {
    try {
      const updatedMap = await fetchGlobalSongLikes();
      // 送信中は楽観表示を優先し、古い一覧で操作中の数を戻さない。
      if (!get().isLikingSong) set({ songLikesMap: { ...updatedMap } });
    } catch {
      if (!get().isLikingSong) set({ songLikesMap: getLocalSongLikesMap() });
    }
  },
  toggleCurrentSongLike: async () => {
    const state = get();
    if (state.isLikingSong) return;
    const rawSongId = state.scoreFileName
      ? state.scoreFileName
      : state.loadedScore?.id || '';
    const songId = normalizeSongId(rawSongId);
    if (!songId) return;

    const nextLiked = !state.hasLikedCurrentResult;
    const delta = nextLiked ? 1 : -1;
    const prevCount = Math.max(0, Number(state.songLikesMap?.[songId]) || 0);
    const optimisticCount = Math.max(0, prevCount + delta);

    set({
      hasLikedCurrentResult: nextLiked,
      isLikingSong: true,
      songLikesMap: {
        ...state.songLikesMap,
        [songId]: optimisticCount,
      },
    });

    try {
      const syncedMap = await updateSongLikeCount(songId, nextLiked);
      set({ songLikesMap: { ...syncedMap } });
    } catch {
      if (get().currentPlaySessionId === state.currentPlaySessionId) {
        set((current) => ({
          hasLikedCurrentResult: state.hasLikedCurrentResult,
          songLikesMap: { ...current.songLikesMap, [songId]: prevCount },
        }));
        get().showToast('いいねの送信に失敗しました');
      }
    } finally {
      if (get().currentPlaySessionId === state.currentPlaySessionId) set({ isLikingSong: false });
    }
  },

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
    toastTimer = setTimeout(() => set({ toastMessage: null }), 3500);
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
  const updateFullscreenState = () => {
    useGameStore.getState().setIsFullscreen(
      Boolean(document.fullscreenElement || document.webkitFullscreenElement)
    );
  };
  document.addEventListener('fullscreenchange', updateFullscreenState);
  document.addEventListener('webkitfullscreenchange', updateFullscreenState);
}
