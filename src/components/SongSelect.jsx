import { useState, useMemo, useRef, useCallback, Suspense, use } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameEngine } from '../engine/GameEngine';
import Leaderboard from './Leaderboard';
import HeaderLogo from './HeaderLogo';
import { fetchRankingsResult } from '../api/rankings';
import { exportPlayLogsCsv, exportLevelValidationSummaryCsv } from '../utils/csvExport';
import { setPlayStartGuardEnforced, recordPlayStartHover, authorizePlayStart, clearPlayStartAuthorization } from '../lib/playStartGuard';
import { ChevronDown, Check } from 'lucide-react';

const DIFFICULTY_TABS = [
  { value: 'all', label: 'すべて' },
  { value: '1-3', label: '☆1〜3' },
  { value: '4-6', label: '☆4〜6' },
  { value: '7-10', label: '☆7〜10' },
];

const SORT_OPTIONS = [
  { value: 'difficulty', label: '難易度' },
  { value: 'likes', label: 'いいね数' },
  { value: 'duration', label: '長さ' },
  { value: 'notesCount', label: 'ノーツ数' },
];

// 和風サイバー・デジタル雅 カスタムドロップダウンコンポーネント（フラット・角丸・影なし）
function CustomFilterDropdown({
  id,
  label,
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
}) {
  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className="flex flex-col gap-1.5 relative" data-dropdown-root={id}>
      <span className="text-xs font-bold text-purple-200/90 tracking-wider px-0.5">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => onToggle(id)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={`h-10 min-w-[132px] sm:min-w-[148px] px-3.5 py-2 rounded-xl bg-[#120a2a]/85 backdrop-blur-md border-2 font-bold text-xs sm:text-sm flex items-center justify-between gap-2.5 transition-colors cursor-pointer select-none shadow-none ${
            isOpen
              ? 'border-cyan-400 text-cyan-200 bg-[#1a0f3a]/95'
              : 'border-purple-400/55 hover:border-cyan-400/80 text-white'
          }`}
        >
          <span className="truncate">{selectedOption?.label}</span>
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-cyan-300' : 'text-purple-300'
            }`}
          />
        </button>

        {isOpen && (
          <div
            role="listbox"
            aria-label={label}
            className="absolute left-0 top-full mt-1.5 min-w-full w-max max-w-[240px] max-h-60 overflow-y-auto mech-scrollbar rounded-xl bg-[#120a2a]/95 backdrop-blur-md border-2 border-cyan-400 p-1.5 z-50 flex flex-col gap-1 shadow-none"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onSelect(opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer select-none border-l-4 ${
                    isSelected
                      ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400 font-black'
                      : 'text-purple-100 hover:bg-pink-500/25 hover:text-pink-100 border-transparent hover:border-pink-400 font-bold'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="text-cyan-300 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SongSelect({ songsPromise, onBack, onStartGame }) {
  return (
    <Suspense fallback={
      <div
        className="h-[100dvh] bg-neutral-900 bg-cover bg-center bg-no-repeat bg-fixed text-white flex items-center justify-center font-sans select-none w-full relative"
        style={{ backgroundImage: 'url(./assets/bg_main.jpg)' }}
      >
        <div className="absolute inset-0 bg-[#0c0520]/45 pointer-events-none" />
        <div className="absolute top-4 left-4 z-10"><HeaderLogo onHome={onBack} /></div>
        <div className="text-xl text-purple-200 font-bold relative z-10">曲を読み込み中...</div>
      </div>
    }>
      <SongListContent songsPromise={songsPromise} onBack={onBack} onStartGame={onStartGame} />
    </Suspense>
  );
}

// ☆10 封印カードのヒビ割れ（氷結結晶）SVGオーバーレイ
function IceCrackSealOverlay({ isShattering }) {
  return (
    <div className={`ice-seal-overlay ${isShattering ? 'is-shattering' : ''}`}>
      {/* 氷結ファセット（結晶面の濃淡）＆ヒビ割れ模様 SVG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 800 160"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* 氷の結晶ファセット（多角形の反射面） */}
        <polygon points="0,0 185,0 225,74 110,98 0,65" fill="rgba(224, 242, 254, 0.09)" />
        <polygon points="185,0 410,0 455,82 225,74" fill="rgba(165, 243, 252, 0.05)" />
        <polygon points="410,0 620,0 645,64 455,82" fill="rgba(254, 205, 211, 0.08)" />
        <polygon points="620,0 800,0 800,88 645,64" fill="rgba(224, 242, 254, 0.1)" />
        <polygon points="0,65 110,98 75,160 0,160" fill="rgba(186, 230, 253, 0.07)" />
        <polygon points="110,98 225,74 335,126 260,160 75,160" fill="rgba(255, 255, 255, 0.08)" />
        <polygon points="225,74 455,82 490,160 335,126" fill="rgba(244, 63, 94, 0.07)" />
        <polygon points="455,82 645,64 710,130 595,160 490,160" fill="rgba(165, 243, 252, 0.09)" />
        <polygon points="645,64 800,88 800,160 595,160 710,130" fill="rgba(224, 242, 254, 0.06)" />

        {/* サブ亀裂（細い蜘蛛の巣状のヒビ割れ） */}
        <g
          stroke="rgba(165, 243, 252, 0.55)"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M225,74 L165,38 L120,44 L82,18" />
          <path d="M165,38 L192,12" />
          <path d="M225,74 L288,42 L348,52 L392,24" />
          <path d="M288,42 L268,14" />
          <path d="M225,74 L178,118 L128,136" />
          <path d="M455,82 L385,112 L335,126 L295,152" />
          <path d="M455,82 L518,44 L568,36 L595,8" />
          <path d="M518,44 L488,16" />
          <path d="M455,82 L542,118 L588,108" />
          <path d="M645,64 L592,88 L542,118 L522,154" />
          <path d="M645,64 L708,32 L758,40 L792,18" />
          <path d="M645,64 L710,130 L768,142" />
          <path d="M110,98 L48,88 L12,112" />
          <path d="M335,126 L365,156" />
        </g>

        {/* メイン亀裂（太く鋭い氷のヒビ割れライン） */}
        <g
          className="ice-crack-main"
          stroke="rgba(240, 249, 255, 0.92)"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 衝撃点1 (225, 74) からの主亀裂 */}
          <path d="M0,65 L64,78 L110,98 L172,82 L225,74 L204,34 L185,0" />
          <path d="M75,160 L110,98" />
          <path d="M225,74 L276,96 L335,126 L260,160" />

          {/* 衝撃点1 → 衝撃点2 (455, 82) を結ぶ大亀裂 */}
          <path d="M225,74 L305,68 L368,88 L455,82 L428,38 L410,0" />
          <path d="M455,82 L472,124 L490,160" />

          {/* 衝撃点2 → 衝撃点3 (645, 64) を結ぶ大亀裂 */}
          <path d="M455,82 L534,68 L586,76 L645,64 L630,28 L620,0" />
          <path d="M645,64 L682,102 L710,130 L595,160" />
          <path d="M645,64 L728,74 L800,88" />
          <path d="M710,130 L762,116 L800,128" />
        </g>

        {/* 紅色の妖気ヒビ割れハイライト */}
        <g
          stroke="rgba(251, 113, 133, 0.65)"
          strokeWidth="1.3"
          fill="none"
          strokeDasharray="18 10"
        >
          <path d="M110,98 L225,74 L455,82 L645,64 L710,130" />
          <path d="M225,74 L335,126 M455,82 L518,44" />
        </g>
      </svg>

      {/* 中央の封印札バッジ */}
      <div className="ice-seal-badge relative z-10 px-4 py-2 rounded-xl bg-[#0d061c]/90 border-2 border-rose-400/80 flex items-center gap-2.5">
        <span className="text-rose-400 font-dotgothic font-black text-xs sm:text-sm tracking-widest">
          【 氷 結 封 印 // 極限難易度 ☆10 】
        </span>
      </div>
    </div>
  );
}

function SongListContent({ songsPromise, onBack, onStartGame }) {
  // 曲リストはPromiseから読み取る（React 19のuseフック。useEffectでのフェッチは行わない）
  const { songs, error } = use(songsPromise);
  const showSettings = useGameStore(state => state.showSettings);
  const setShowSettings = useGameStore(state => state.setShowSettings);
  const isMobileMode = useGameStore(state => state.isMobileMode);
  const isRhythmMode = useGameStore(state => state.isBoothMode && !state.isMobileMode && state.isRhythmMode);
  const isFullscreen = useGameStore(state => state.isFullscreen);
  const toggleFullscreen = useGameStore(state => state.toggleFullscreen);
  const showCustomModes = useGameStore(state => state.showCustomModes);
  const playLogsCount = useGameStore(state => state.playLogsCount);
  const isExportingCsv = useGameStore(state => state.isExportingCsv);
  const setIsExportingCsv = useGameStore(state => state.setIsExportingCsv);
  const refreshPlayLogsCount = useGameStore(state => state.refreshPlayLogsCount);
  const clearAllPlayLogs = useGameStore(state => state.clearAllPlayLogs);
  const songLikesMap = useGameStore(state => state.songLikesMap);
  const showToast = useGameStore(state => state.showToast);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);

  // ☆10 特別封印演出ステート: 'sealed' | 'warning' | 'shattering' | 'unlocked'
  const [sealPhase, setSealPhase] = useState('sealed');
  const scrollContainerRef = useRef(null);
  const songRequestRef = useRef(null);
  const handleScrollContainerRef = useCallback((node) => {
    scrollContainerRef.current = node;
    if (node) {
      setPlayStartGuardEnforced(true);
    } else {
      songRequestRef.current?.abort();
      songRequestRef.current = null;
    }
  }, []);
  const handleGoHome = () => {
    songRequestRef.current?.abort();
    songRequestRef.current = null;
    clearPlayStartAuthorization();
    onBack();
  };
  const maxDiffSectionRef = useRef(null);
  const maxDiffCardRef = useRef(null);
  const retreatIgnoreScrollRef = useRef(false);
  const shatterTimerRef = useRef(null);

  const creatorBarSyncedRef = useRef(false);
  const handleCreatorBarRef = useCallback((node) => {
    if (node && !creatorBarSyncedRef.current) {
      creatorBarSyncedRef.current = true;
      useGameStore.getState().refreshPlayLogsCount();
    } else if (!node) {
      creatorBarSyncedRef.current = false;
    }
  }, []);

  const handleExportRawCsv = async () => {
    if (isExportingCsv) return;
    setIsExportingCsv(true);
    try {
      const { count, filename } = await exportPlayLogsCsv();
      await refreshPlayLogsCount();
      showToast(`全プレイ履歴CSV（${count}件）を出力しました: ${filename}`);
    } catch (err) {
      console.error(err);
      showToast('CSV出力に失敗しました');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportSummaryCsv = async () => {
    if (isExportingCsv) return;
    setIsExportingCsv(true);
    try {
      const { count, excludedCount, filename } = await exportLevelValidationSummaryCsv();
      await refreshPlayLogsCount();
      const excludeNote = excludedCount > 0 ? `・外れ値${excludedCount}件除外` : '';
      showToast(`レベル検証サマリーCSV（有効${count}件集計${excludeNote}）を出力しました: ${filename}`);
    } catch (err) {
      console.error(err);
      showToast('CSV出力に失敗しました');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleClearLogs = () => {
    clearAllPlayLogs();
    setConfirmClearLogs(false);
    showToast('これまでのプレイ記録ログをすべてクリアしました');
  };

  const handleRandomPlay = async (e) => {
    if (!songs || songs.length === 0) return;
    const randomSong = songs[Math.floor(Math.random() * songs.length)];
    // 通常の選曲と同じ経路で読み込んでから開始する
    await handleSelectSong(randomSong, 'random', e);
  };

  const [selectedLeaderboard, setSelectedLeaderboard] = useState(null); // { songTitle, promise } | null

  // ソートとフィルターのステート
  const [sortType, setSortType] = useState('difficulty'); // 'difficulty', 'likes', 'duration', 'notesCount'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [filterCreator, setFilterCreator] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [openDropdown, setOpenDropdown] = useState(null); // 'creator' | 'sort' | null

  // ドロップダウン領域外のクリック・タップおよびEscapeキーでメニューを閉じる（useEffect不使用・コールバックrefで登録）
  const docListenerRef = useRef(null);
  const handleFilterPanelRef = useCallback((node) => {
    if (node && !docListenerRef.current) {
      useGameStore.getState().refreshSongLikes();
      const onPointerDown = (e) => {
        if (!e.target.closest('[data-dropdown-root]')) {
          setOpenDropdown(null);
        }
      };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          setOpenDropdown(null);
        }
      };
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
      docListenerRef.current = { onPointerDown, onKeyDown };
    } else if (!node && docListenerRef.current) {
      document.removeEventListener('pointerdown', docListenerRef.current.onPointerDown);
      document.removeEventListener('keydown', docListenerRef.current.onKeyDown);
      docListenerRef.current = null;
    }
  }, []);

  const handleToggleDropdown = (id) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  };

  const setLoadedScore = useGameStore(state => state.setLoadedScore);
  const setAudioUrl = useGameStore(state => state.setAudioUrl);

  const handleSelectSong = async (song, startType = 'play', clickEvent = null) => {
    const scoreFileName = song.scorePath.split('/').pop();
    const songId = song.id || scoreFileName.replace(/\.json$/i, '');
    if (!authorizePlayStart(startType, songId, clickEvent)) {
      useGameStore.getState().showToast('「あそぶ」または「ランダム選曲」ボタンにカーソルを合わせてから開始してください');
      return;
    }

    songRequestRef.current?.abort();
    const controller = new AbortController();
    songRequestRef.current = controller;
    try {
      const response = await fetch(song.scorePath, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to load score: ${response.statusText}`);
      }
      const data = await response.json();
      if (controller.signal.aborted || songRequestRef.current !== controller) return;

      const audioFileName = song.audioPath.split('/').pop();

      setLoadedScore({
        ...data,
        id: songId,
        title: song.title || data.title || '楽曲',
        creator: song.creator || data.creator || '不明',
        difficulty: song.difficulty ?? data.difficulty ?? 1,
        notesCount: song.notesCount ?? data.notes?.length ?? 0
      }, scoreFileName);
      setAudioUrl(song.audioPath, audioFileName);

      const store = useGameStore.getState();
      if (store.setIsLocalPlay) store.setIsLocalPlay(false);

      onStartGame();
      setTimeout(() => gameEngine.start(), 0);
    } catch (err) {
      if (controller.signal.aborted || songRequestRef.current !== controller) return;
      clearPlayStartAuthorization();
      console.error(err);
      useGameStore.getState().showToast('譜面データの読み込みに失敗しました。');
    } finally {
      if (songRequestRef.current === controller) songRequestRef.current = null;
    }
  };

  // ランキングを開く（データ取得のPromiseはここで作成し、useEffectは使わない）
  const handleOpenLeaderboard = (song) => {
    const songId = song.scorePath.split('/').pop().replace(/\.json$/i, '');
    setSelectedLeaderboard({
      songTitle: song.title,
      promise: fetchRankingsResult(songId)
    });
  };

  const creators = useMemo(() => {
    return Array.from(new Set(songs.map(s => s.creator).filter(Boolean)));
  }, [songs]);

  const creatorOptions = useMemo(() => {
    return [
      { value: 'all', label: 'すべて' },
      ...creators.map((c) => ({ value: c, label: c })),
    ];
  }, [creators]);

  const filteredAndSortedSongs = useMemo(() => {
    let result = songs.filter(s => {
      if (filterCreator !== 'all' && s.creator !== filterCreator) return false;
      if (filterDifficulty !== 'all') {
        const diff = s.difficulty || 1;
        if (filterDifficulty === '1-3' && (diff < 1 || diff > 3)) return false;
        if (filterDifficulty === '4-6' && (diff < 4 || diff > 6)) return false;
        if (filterDifficulty === '7-10' && (diff < 7 || diff > 10)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let valA, valB;
      if (sortType === 'difficulty') {
        valA = a.difficulty || 1;
        valB = b.difficulty || 1;
      } else if (sortType === 'likes') {
        valA = Number(songLikesMap?.[a.id]) || 0;
        valB = Number(songLikesMap?.[b.id]) || 0;
      } else if (sortType === 'duration') {
        valA = a.durationMs || 0;
        valB = b.durationMs || 0;
      } else if (sortType === 'notesCount') {
        valA = a.notesCount || 0;
        valB = b.notesCount || 0;
      }

      if (valA === valB) return 0;
      const isAsc = sortOrder === 'asc';
      return valA < valB ? (isAsc ? -1 : 1) : (isAsc ? 1 : -1);
    });

    return result;
  }, [songs, sortType, sortOrder, filterCreator, filterDifficulty, songLikesMap]);

  // 通常譜面（☆1〜9）と深淵封印譜面（☆10）を分離し、下にたくさんスクロールした最深部に☆10を配置する
  const normalSongs = useMemo(
    () => filteredAndSortedSongs.filter((s) => (s.difficulty || 1) < 10),
    [filteredAndSortedSongs]
  );
  const maxDiffSongs = useMemo(
    () => filteredAndSortedSongs.filter((s) => (s.difficulty || 1) >= 10),
    [filteredAndSortedSongs]
  );

  // スクロール検知：下にたくさんスクロールして☆10封印領域の最深部に到達したら警告ポップアップを表示
  const handleContainerScroll = () => {
    if (sealPhase !== 'sealed' || maxDiffSongs.length === 0) return;

    const cardEl = maxDiffCardRef.current;
    const containerEl = scrollContainerRef.current;
    if (!cardEl || !containerEl) return;

    const rect = cardEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight || containerEl.clientHeight;

    // 引き返し直後の自動スクロール中は、一度領域外に戻るまで再発火を抑止
    if (retreatIgnoreScrollRef.current) {
      if (rect.top > viewportHeight * 1.05) {
        retreatIgnoreScrollRef.current = false;
      }
      return;
    }

    const isNearBottom =
      containerEl.scrollTop + containerEl.clientHeight >= containerEl.scrollHeight - 48;
    const isCardEnteredView = rect.top <= viewportHeight * 0.82;

    if (isCardEnteredView || isNearBottom) {
      setSealPhase('warning');
    }
  };

  // 警告ポップアップで「引き返す」を選んだ場合：安全な通常曲リスト側へスクロールして戻る
  const handleRetreatFromWarning = () => {
    retreatIgnoreScrollRef.current = true;
    setSealPhase('sealed');
    const containerEl = scrollContainerRef.current;
    const sectionEl = maxDiffSectionRef.current;
    if (containerEl && sectionEl) {
      const targetTop = Math.max(0, sectionEl.offsetTop - containerEl.clientHeight * 0.65);
      containerEl.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  };

  // 警告ポップアップで「それでも進む」を選んだ場合：氷が砕ける効果音＋ヒビ割れ＆ぼかしフェードアウト
  const handleProceedDangerZone = () => {
    setSealPhase('shattering');

    // ☆10カードが画面中央付近にしっかり見えるよう調整
    if (maxDiffCardRef.current) {
      maxDiffCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 氷が砕ける効果音を再生
    try {
      const iceAudio = new Audio('./assets/se_ice_break.mp3');
      iceAudio.volume = 0.9 * useGameStore.getState().systemSeVolume;
      iceAudio.play().catch(() => {});
    } catch {
      // オーディオ再生エラー時は演出のみ継続
    }

    if (shatterTimerRef.current) {
      clearTimeout(shatterTimerRef.current);
    }
    shatterTimerRef.current = setTimeout(() => {
      shatterTimerRef.current = null;
      setSealPhase('unlocked');
    }, 2600);
  };

  const formatTime = (ms) => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderSongCard = (song, isSealedMaxDiff = false, attachMaxDiffRef = false) => {
    const diff = Math.max(1, Math.min(10, song.difficulty || 1));
    const isMaxDiff = diff >= 10;
    const isLocked = isSealedMaxDiff && (sealPhase === 'sealed' || sealPhase === 'warning');
    const isShattering = isSealedMaxDiff && sealPhase === 'shattering';

    const handleCardClick = () => {
      if (isLocked) {
        retreatIgnoreScrollRef.current = false;
        setSealPhase('warning');
      }
    };

    return (
      <div
        key={song.id}
        ref={attachMaxDiffRef ? maxDiffCardRef : undefined}
        onClick={handleCardClick}
        className={`song-card ${isMaxDiff ? 'song-card-max-diff' : ''} ${
          isShattering ? 'song-card-shattering-shake' : ''
        } w-full ${isLocked ? 'cursor-pointer' : ''} flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4`}
      >
        {/* 氷結封印・ヒビ割れ＆ぼかしオーバーレイ（封印中〜破砕フェードアウト中のみ表示） */}
        {(isLocked || isShattering) && <IceCrackSealOverlay isShattering={isShattering} />}

        <div
          className={`flex flex-col w-full md:w-auto min-w-0 flex-1 ${
            isLocked
              ? 'song-card-sealed-content'
              : isShattering
              ? 'song-card-shattering-content'
              : ''
          }`}
        >
          <span
            className="text-xl sm:text-2xl font-black text-white tracking-wide break-words leading-snug"
            style={{
              textShadow: isMaxDiff
                ? '0 0 12px rgba(251, 113, 133, 0.75)'
                : '0 0 10px rgba(192, 132, 252, 0.5)'
            }}
          >
            {song.title}
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
            <span className="text-xs sm:text-sm font-bold text-purple-200/90">譜面制作: {song.creator}</span>
            {song.provider && <span className="text-xs sm:text-sm font-bold text-purple-200/80">楽曲提供: {song.provider}</span>}
            {song.credit && <span className="text-xs sm:text-sm font-bold text-purple-200/80">クレジット: {song.credit}</span>}
            <span className="font-bold whitespace-nowrap text-xs sm:text-sm tracking-[0.12em]">
              <span
                className={isMaxDiff ? 'star-lit-max' : 'star-lit'}
                style={
                  isMaxDiff
                    ? { color: '#c084fc', textShadow: '0 0 8px rgba(192, 132, 252, 0.95), 0 0 14px rgba(168, 85, 247, 0.75)' }
                    : { color: '#fbbf24', textShadow: '0 0 8px rgba(251, 191, 36, 0.8)' }
                }
              >
                {'★'.repeat(diff)}
              </span>
              <span className="star-unlit">
                {'☆'.repeat(10 - diff)}
              </span>
            </span>
          </div>
          {song.note && (
            <p className="text-xs sm:text-sm font-bold text-amber-300 mt-1.5 leading-snug">
              注意: {song.note}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2.5">
            <span
              className="song-badge text-xs font-bold px-3 py-1 flex items-center gap-1"
              style={{
                background: isMaxDiff ? 'rgba(88, 18, 48, 0.72)' : 'rgba(30, 15, 65, 0.7)',
                border: isMaxDiff ? '1px solid rgba(251, 113, 133, 0.55)' : '1px solid rgba(192, 132, 252, 0.45)',
                borderRadius: '9999px'
              }}
            >
              ⏱ {formatTime(song.durationMs)}
            </span>
            <span
              className="song-badge text-xs font-bold px-3 py-1 flex items-center gap-1"
              style={{
                background: isMaxDiff ? 'rgba(88, 18, 48, 0.72)' : 'rgba(30, 15, 65, 0.7)',
                border: isMaxDiff ? '1px solid rgba(251, 113, 133, 0.55)' : '1px solid rgba(192, 132, 252, 0.45)',
                borderRadius: '9999px'
              }}
            >
              🎵 {song.notesCount || 0} ノーツ
            </span>
            <span
              className="song-badge text-xs font-bold px-3 py-1 flex items-center gap-1 text-pink-200"
              style={{
                background: isMaxDiff ? 'rgba(88, 18, 48, 0.72)' : 'rgba(65, 15, 50, 0.7)',
                border: isMaxDiff ? '1px solid rgba(251, 113, 133, 0.65)' : '1px solid rgba(244, 114, 182, 0.55)',
                borderRadius: '9999px'
              }}
            >
              <span className="text-rose-400">♥</span>
              <span className="font-dotgothic font-black tabular-nums">
                {songLikesMap?.[song.id] || 0}
              </span>
              <span>いいね</span>
            </span>
          </div>
        </div>

        {/* カード内アクションボタン（ランキング・あそぶ） */}
        <div
          className={`flex items-center gap-2 sm:gap-3 w-full md:w-auto mt-1 md:mt-0 justify-end flex-shrink-0 ${
            isLocked
              ? 'song-card-sealed-content'
              : isShattering
              ? 'song-card-shattering-content'
              : ''
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isLocked || isShattering) return;
              handleOpenLeaderboard(song);
            }}
            className="image-btn h-10 sm:h-12 md:h-14 w-auto max-w-[48%] md:max-w-none"
            title="ランキング"
            aria-label={`${song.title}のランキングを見る`}
          >
            <img
              src="./assets/btn_ranking.png"
              alt="ランキング"
              width="145"
              height="56"
              loading="lazy"
              decoding="async"
              className="h-full w-auto object-contain"
            />
          </button>
          <button
            type="button"
            onMouseEnter={(e) => {
              if (isLocked || isShattering) return;
              recordPlayStartHover('play', song.id, e);
            }}
            onPointerEnter={(e) => {
              if (isLocked || isShattering) return;
              recordPlayStartHover('play', song.id, e);
            }}
            onTouchStart={(e) => {
              if (isLocked || isShattering) return;
              recordPlayStartHover('play', song.id, e);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isLocked) {
                retreatIgnoreScrollRef.current = false;
                setSealPhase('warning');
                return;
              }
              if (isShattering) return;
              handleSelectSong(song, 'play', e);
            }}
            className="play-btn-container play-btn max-w-[48%] md:max-w-none"
            title="あそぶ"
            aria-label={`${song.title}であそぶ`}
          >
            <img
              src="./assets/btn_play_v4_perfect.png"
              alt="あそぶ"
              width="145"
              height="56"
              loading="lazy"
              decoding="async"
            />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={handleScrollContainerRef}
      onScroll={handleContainerScroll}
      className="h-[100dvh] overflow-y-auto overscroll-none mech-scrollbar bg-neutral-900 bg-cover bg-center bg-no-repeat bg-fixed text-white flex flex-col items-center p-4 md:p-8 pb-[calc(3rem+env(safe-area-inset-bottom,0px))] font-sans select-none w-full relative"
      style={{ backgroundImage: 'url(./assets/bg_main.jpg)' }}
    >
      {/* 背後の桜や雷紋を活かしつつ視認性を保つ薄めのオーバーレイ */}
      <div className="fixed inset-0 bg-[#0c0520]/40 pointer-events-none z-0" />

      <div className="w-full max-w-4xl relative z-10 flex flex-col items-center">
        {/* ヘッダー：タイトル ＆ 右上透過PNGボタングループ */}
        <div className="w-full flex flex-wrap justify-between items-center gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <HeaderLogo onHome={handleGoHome} />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-cyan-300 tracking-wider">
              曲を選ぶ
            </h1>
          </div>
          <div className={`flex items-center gap-1.5 sm:gap-3 ${showSettings ? 'pointer-events-none opacity-0 invisible' : ''}`}>
            {/* ランダム選曲ボタン */}
            <button
              type="button"
              onMouseEnter={(e) => recordPlayStartHover('random', null, e)}
              onPointerEnter={(e) => recordPlayStartHover('random', null, e)}
              onTouchStart={(e) => recordPlayStartHover('random', null, e)}
              onClick={(e) => handleRandomPlay(e)}
              className="image-btn h-9 sm:h-12 md:h-14 w-auto"
              title="ランダム選曲"
              aria-label="ランダム選曲"
            >
              <img
                src="./assets/btn_random.png?v=2"
                alt="ランダム選曲"
                width="127"
                height="56"
                decoding="async"
                className="h-full w-auto"
              />
            </button>

            {/* 設定アイコンボタン（ホーム画面と共通） */}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="image-btn h-9 w-9 sm:h-12 sm:w-12 md:h-14 md:w-14"
              title="設定"
              aria-label="設定"
            >
              <img
                src="./assets/button_5_settings.png"
                alt="設定"
                width="56"
                height="54"
                decoding="async"
                className="h-full w-full"
              />
            </button>

            {/* 全画面表示 / 縮小表示アイコンボタン（ホーム画面と共通） */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="image-btn h-9 w-9 sm:h-12 sm:w-12 md:h-14 md:w-14"
              title={isFullscreen ? "縮小表示（全画面解除）" : "全画面表示"}
              aria-label={isFullscreen ? "縮小表示（全画面解除）" : "全画面表示"}
            >
              <img
                key={isFullscreen ? 'minimize' : 'fullscreen'}
                src={isFullscreen ? "./assets/button_6_exit_fullscreen.png" : "./assets/button_6_fullscreen.png"}
                alt={isFullscreen ? "縮小表示" : "全画面表示"}
                width="56"
                height="54"
                decoding="async"
                className="h-full w-full"
              />
            </button>

            {/* メニューに戻るボタン */}
            <button
              type="button"
              onClick={handleGoHome}
              className="image-btn h-9 sm:h-12 md:h-14 w-auto"
              title="メニューに戻る"
              aria-label="メニューに戻る"
            >
              <img
                src="./assets/btn_back_menu.png"
                alt="メニューに戻る"
                width="145"
                height="56"
                decoding="async"
                className="h-full w-auto"
              />
            </button>
          </div>
        </div>

        {/* 遊び方説明バー（PCモード / スマホモード連動・コンパクト表示） */}
        {isMobileMode ? (
          <div className="info-banner w-full max-w-4xl font-bold tracking-wide text-xs md:text-sm text-center px-4 py-3 mb-6 leading-relaxed">
            遊び方：ノーツが判定枠に重なる<span className="text-amber-300 font-black">【指を離した瞬間】</span>にタイミング判定されます！
            <br className="hidden sm:inline" />
            濁点・小文字の<span className="text-pink-300 font-black">変換は不要</span>で、すべて<span className="text-cyan-300 font-black">元の清音</span>で入力できます（<span className="text-emerald-300 font-black">700,000点以上でクリア！</span>）。
          </div>
        ) : isRhythmMode ? (
          <div className="info-banner w-full max-w-4xl font-bold tracking-wide text-xs md:text-sm text-center p-4 mb-6">
            リズムモード：ノーツが判定枠に重なったら好きなキーを1回押してください（Escキーはポーズ）。<span className="text-amber-300">ランキングには登録されません。</span>
          </div>
        ) : (
          <div className="info-banner w-full max-w-4xl font-bold tracking-widest text-xs md:text-sm text-center p-4 mb-6">
            遊び方：ノーツが判定枠に重なったら、表示されている最初の文字をタイピングしてください（<span className="text-emerald-300 font-black">スコア 700,000点以上でクリア！</span>）
          </div>
        )}

        {/* クリエイター・エディター表示ON時のみ：プレイ記録＆レベル検証CSV出力パネル */}
        {showCustomModes && (
          <div
            ref={handleCreatorBarRef}
            className="w-full max-w-4xl mb-4 p-3.5 rounded-2xl bg-[#120a2a]/90 backdrop-blur-md border-2 border-amber-400/75 flex flex-wrap items-center justify-between gap-3 shadow-none"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-200 font-dotgothic font-black text-xs">
                CREATOR ANALYTICS
              </span>
              <span className="px-3 py-1 rounded-lg bg-[#0a0618] border border-purple-400/50 text-cyan-200 font-dotgothic font-black text-xs sm:text-sm">
                記録データ: {playLogsCount}件
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isExportingCsv}
                onClick={handleExportRawCsv}
                className="px-3.5 py-2 rounded-xl bg-[#171030] hover:bg-cyan-500/25 disabled:opacity-50 border-2 border-cyan-400 text-cyan-200 hover:text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer shadow-none"
              >
                📊 プレイ記録CSV出力（ローデータ）
              </button>
              <button
                type="button"
                disabled={isExportingCsv}
                onClick={handleExportSummaryCsv}
                className="px-3.5 py-2 rounded-xl bg-[#171030] hover:bg-emerald-500/25 disabled:opacity-50 border-2 border-emerald-400 text-emerald-200 hover:text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer shadow-none"
              >
                📈 レベル検証サマリーCSV出力
              </button>
              {!confirmClearLogs ? (
                <button
                  type="button"
                  disabled={isExportingCsv || playLogsCount === 0}
                  onClick={() => setConfirmClearLogs(true)}
                  className="px-3 py-2 rounded-xl bg-[#1c1028] hover:bg-rose-500/25 disabled:opacity-40 disabled:cursor-not-allowed border-2 border-rose-400/80 text-rose-200 hover:text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer shadow-none"
                >
                  🗑️ ログをクリア
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="px-3 py-2 rounded-xl bg-rose-600/40 hover:bg-rose-500/55 border-2 border-rose-400 text-white font-black text-xs sm:text-sm transition-colors cursor-pointer shadow-none"
                  >
                    ⚠️ 本当にクリアする
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearLogs(false)}
                    className="px-2.5 py-2 rounded-xl bg-[#171030] hover:bg-purple-500/25 border-2 border-purple-400/60 text-purple-200 font-bold text-xs sm:text-sm transition-colors cursor-pointer shadow-none"
                  >
                    キャンセル
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* フィルター＆ソート コントロールパネル（和風サイバー・デジタル雅 ハイブリッドUI / フラット・角丸・影なし） */}
        {!error && songs.length > 0 && (
          <div
            ref={handleFilterPanelRef}
            className="filter-panel relative z-30 w-full max-w-4xl p-4 mb-6 flex flex-wrap gap-y-4 gap-x-6 justify-between items-start md:items-end"
          >
            {/* 左側：難易度フィルター（1クリック切り替え・横並びピル型タブ） */}
            <div className="flex flex-col gap-1.5 w-full md:w-auto">
              <span className="text-xs font-bold text-purple-200/90 tracking-wider px-0.5">
                難易度
              </span>
              <div
                role="tablist"
                aria-label="難易度フィルター"
                className="flex flex-wrap items-center gap-1.5 sm:gap-2"
              >
                {DIFFICULTY_TABS.map((tab) => {
                  const isActive = filterDifficulty === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setFilterDifficulty(tab.value)}
                      className={`h-10 px-3 sm:px-4 rounded-xl border-2 font-black text-xs sm:text-sm tracking-wide transition-colors cursor-pointer select-none shadow-none flex items-center justify-center ${
                        isActive
                          ? 'bg-cyan-500/25 backdrop-blur-md border-cyan-400 text-cyan-200'
                          : 'bg-[#120a2a]/85 backdrop-blur-md border-purple-400/55 text-purple-100/90 hover:border-pink-400/80 hover:bg-pink-500/15 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 右側：譜面制作 ＆ 並び替え（カスタムドロップダウン ＋ 昇順/降順ボタン） */}
            <div className="flex flex-wrap items-end gap-3 sm:gap-4 w-full md:w-auto pt-3 md:pt-0 border-t border-purple-400/30 md:border-t-0">
              {/* 譜面制作カスタムドロップダウン */}
              <CustomFilterDropdown
                id="creator"
                label="譜面制作"
                value={filterCreator}
                options={creatorOptions}
                isOpen={openDropdown === 'creator'}
                onToggle={handleToggleDropdown}
                onSelect={(val) => {
                  setFilterCreator(val);
                  setOpenDropdown(null);
                }}
              />

              {/* 並び替えカスタムドロップダウン ＋ 昇順/降順トグルボタン */}
              <div className="flex items-end gap-2">
                <CustomFilterDropdown
                  id="sort"
                  label="並び替え"
                  value={sortType}
                  options={SORT_OPTIONS}
                  isOpen={openDropdown === 'sort'}
                  onToggle={handleToggleDropdown}
                  onSelect={(val) => {
                    if (val === 'likes' && sortType !== 'likes') {
                      setSortOrder('desc');
                    }
                    setSortType(val);
                    setOpenDropdown(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="sort-order-btn h-10 font-bold text-xs sm:text-sm px-3.5 py-2 transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0 select-none"
                >
                  {sortOrder === 'asc' ? '▲ 昇順' : '▼ 降順'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 楽曲カード一覧 */}
        <div className="w-full max-w-4xl flex flex-col gap-4 relative z-10">
          {error && <div className="text-xl text-red-400 text-center py-8">{error}</div>}

          {!error && filteredAndSortedSongs.length === 0 && (
            <div className="info-banner p-8 text-center">
              <span className="text-xl font-bold text-purple-200">該当する譜面がありません</span>
            </div>
          )}

          {/* 通常楽曲（☆1〜9） */}
          {!error && normalSongs.map((song) => renderSongCard(song, false))}

          {/* 最高難易度（☆10）深淵スクロール領域 ＆ 氷結封印カード */}
          {!error && maxDiffSongs.length > 0 && (
            <div
              ref={maxDiffSectionRef}
              className="w-full flex flex-col items-center mt-8 pt-6"
            >
              {/* 下にたくさんスクロールさせるためのデジタル雅・結界回廊エリア */}
              <div className="w-full min-h-[72vh] sm:min-h-[78vh] flex flex-col items-center justify-between py-10 px-4">
                {/* 第1境界：結界境界線 */}
                <div className="w-full flex items-center gap-3 sm:gap-4 opacity-80">
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-purple-400/60 to-rose-400/70" />
                  <span className="px-4 py-1.5 rounded-full bg-[#120826]/90 border border-rose-400/60 text-rose-200 font-dotgothic font-black text-xs sm:text-sm tracking-[0.25em]">
                    ▼ 結界境界線 // BOUNDARY OF ABYSS ▼
                  </span>
                  <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-purple-400/60 to-rose-400/70" />
                </div>

                {/* 中間回廊：縦ラインとデジタル雅の警告碑文 */}
                <div className="flex flex-col items-center gap-6 my-auto">
                  <div className="w-[2px] h-16 sm:h-24 bg-gradient-to-b from-purple-400/50 via-rose-500/70 to-cyan-400/60" />
                  <div className="px-6 py-4 rounded-2xl bg-[#110724]/85 backdrop-blur-md border-2 border-rose-500/60 text-center max-w-md">
                    <div className="text-[11px] sm:text-xs font-dotgothic font-bold text-cyan-300 tracking-[0.3em] mb-1">
                      WARNING // LEVEL 10 DETECTED
                    </div>
                    <div className="text-sm sm:text-base font-black text-rose-200 tracking-widest">
                      これより先、極限領域【☆10】
                    </div>
                    <div className="text-xs text-purple-200/80 mt-1 font-bold">
                      さらに下へスクロールすると封印譜面へ到達します
                    </div>
                  </div>
                  <div className="w-[2px] h-16 sm:h-24 bg-gradient-to-b from-cyan-400/60 via-rose-500/80 to-rose-500" />
                </div>

                {/* 最深部直前マーカー */}
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-dotgothic font-black text-rose-400 tracking-[0.35em]">
                    【 禁 足 地 ・ 最 深 部 】
                  </span>
                </div>
              </div>

              {/* ☆10 楽曲カード本体（封印中：ヒビ割れ＋ぼかし → 解除時：氷砕けSEと共にフェードアウト） */}
              <div className="w-full flex flex-col gap-4 pb-8">
                {maxDiffSongs.map((song, idx) => renderSongCard(song, true, idx === 0))}
              </div>
            </div>
          )}
        </div>

        {/* デジタル雅「この先は危険です」警告ポップアップモーダル（フラット・角丸・影なし） */}
        {sealPhase === 'warning' && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="danger-zone-title"
            className="fixed inset-0 z-50 bg-[#060312]/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg rounded-2xl bg-[#110722]/95 border-2 border-rose-500 p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden shadow-none">
              {/* 上部・下部の和風サイバー装飾ライン */}
              <div className="w-full flex items-center justify-between gap-2 mb-4">
                <div className="h-1 flex-1 rounded-full bg-rose-500/80" />
                <span className="px-3 py-1 rounded-lg bg-rose-500/20 border border-rose-400 text-rose-200 font-dotgothic font-black text-xs tracking-[0.25em]">
                  【 禁 足 地 警 告 // EXTREME DANGER 】
                </span>
                <div className="h-1 flex-1 rounded-full bg-rose-500/80" />
              </div>

              <h2
                id="danger-zone-title"
                className="text-2xl sm:text-3xl font-black text-white tracking-widest mt-1 mb-2"
              >
                この先は危険です
              </h2>
              <p className="text-xs sm:text-sm font-dotgothic font-bold text-purple-300 tracking-[0.2em] mb-5">
                ― 最高難易度【☆10】氷結封印領域 ―
              </p>

              <div className="w-full rounded-xl bg-[#0a0416] border border-purple-400/50 p-4 sm:p-5 mb-6 text-left sm:text-center space-y-2">
                <p className="text-xs sm:text-sm font-bold text-purple-100 leading-relaxed">
                  これより先は、常軌を逸した速度と手数が襲いかかる
                  <span className="text-rose-300 font-black">最高難易度【☆10】</span>
                  の封印譜面が眠る領域です。
                </p>
                <p className="text-xs sm:text-sm font-bold text-purple-200/90 leading-relaxed">
                  生半可な覚悟では指が追いつきません。
                  <br className="hidden sm:inline" />
                  本当に氷の結界を砕き、この先へ進みますか？
                </p>
              </div>

              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleRetreatFromWarning}
                  className="w-full sm:w-auto flex-1 h-12 px-5 rounded-xl bg-[#181032] hover:bg-[#231746] border-2 border-purple-400/70 text-purple-100 font-black text-sm tracking-wider transition-colors cursor-pointer shadow-none"
                >
                  引き返す
                </button>
                <button
                  type="button"
                  onClick={handleProceedDangerZone}
                  className="w-full sm:w-auto flex-1 h-12 px-5 rounded-xl bg-rose-600/30 hover:bg-rose-500/45 border-2 border-rose-400 text-white font-black text-sm tracking-wider transition-colors cursor-pointer shadow-none"
                >
                  それでも進む（封印解除）
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedLeaderboard && (
          <Leaderboard
            songTitle={selectedLeaderboard.songTitle}
            rankingsPromise={selectedLeaderboard.promise}
            onClose={() => setSelectedLeaderboard(null)}
          />
        )}
      </div>
    </div>
  );
}
