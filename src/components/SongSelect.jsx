import { useState, useMemo, useRef, useCallback, Suspense, use } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameEngine } from '../engine/GameEngine';
import Leaderboard from './Leaderboard';
import { fetchRankingsResult } from '../api/rankings';
import { ChevronDown, Check } from 'lucide-react';

const DIFFICULTY_TABS = [
  { value: 'all', label: 'すべて' },
  { value: '1-3', label: '☆1〜3' },
  { value: '4-6', label: '☆4〜6' },
  { value: '7-10', label: '☆7〜10' },
];

const SORT_OPTIONS = [
  { value: 'difficulty', label: '難易度' },
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
        className="min-h-screen bg-neutral-900 bg-cover bg-center bg-no-repeat bg-fixed text-white flex items-center justify-center font-sans select-none w-full relative"
        style={{ backgroundImage: 'url(./assets/bg_main.jpg)' }}
      >
        <div className="absolute inset-0 bg-[#0c0520]/45 pointer-events-none" />
        <div className="text-xl text-purple-200 font-bold relative z-10">曲を読み込み中...</div>
      </div>
    }>
      <SongListContent songsPromise={songsPromise} onBack={onBack} onStartGame={onStartGame} />
    </Suspense>
  );
}

function SongListContent({ songsPromise, onBack, onStartGame }) {
  // 曲リストはPromiseから読み取る（React 19のuseフック。useEffectでのフェッチは行わない）
  const { songs, error } = use(songsPromise);
  const showSettings = useGameStore(state => state.showSettings);
  const setShowSettings = useGameStore(state => state.setShowSettings);
  const isMobileMode = useGameStore(state => state.isMobileMode);
  const isFullscreen = useGameStore(state => state.isFullscreen);
  const showToast = useGameStore(state => state.showToast);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        showToast('全画面表示に失敗しました');
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const handleRandomPlay = async () => {
    if (!songs || songs.length === 0) return;
    const randomSong = songs[Math.floor(Math.random() * songs.length)];
    // 通常の選曲と同じ経路で読み込んでから開始する
    await handleSelectSong(randomSong);
  };

  const [selectedLeaderboard, setSelectedLeaderboard] = useState(null); // { songTitle, promise } | null

  // ソートとフィルターのステート
  const [sortType, setSortType] = useState('difficulty'); // 'difficulty', 'duration', 'notesCount'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [filterCreator, setFilterCreator] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [openDropdown, setOpenDropdown] = useState(null); // 'creator' | 'sort' | null

  // ドロップダウン領域外のクリック・タップおよびEscapeキーでメニューを閉じる（useEffect不使用・コールバックrefで登録）
  const docListenerRef = useRef(null);
  const handleFilterPanelRef = useCallback((node) => {
    if (node && !docListenerRef.current) {
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

  const handleSelectSong = async (song) => {
    try {
      const response = await fetch(song.scorePath);
      if (!response.ok) {
        throw new Error(`Failed to load score: ${response.statusText}`);
      }
      const data = await response.json();

      const scoreFileName = song.scorePath.split('/').pop();
      const audioFileName = song.audioPath.split('/').pop();

      setLoadedScore({
        ...data,
        title: song.title || data.title || '楽曲',
        difficulty: song.difficulty ?? data.difficulty ?? 1
      }, scoreFileName);
      setAudioUrl(song.audioPath, audioFileName);

      const store = useGameStore.getState();
      if (store.setIsLocalPlay) store.setIsLocalPlay(false);

      onStartGame();
      setTimeout(() => gameEngine.start(), 0);
    } catch (err) {
      console.error(err);
      useGameStore.getState().showToast('譜面データの読み込みに失敗しました。');
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
  }, [songs, sortType, sortOrder, filterCreator, filterDifficulty]);

  const formatTime = (ms) => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="min-h-screen bg-neutral-900 bg-cover bg-center bg-no-repeat bg-fixed text-white flex flex-col items-center p-4 md:p-8 font-sans select-none w-full relative"
      style={{ backgroundImage: 'url(./assets/bg_main.jpg)' }}
    >
      {/* 背後の桜や雷紋を活かしつつ視認性を保つ薄めのオーバーレイ */}
      <div className="fixed inset-0 bg-[#0c0520]/40 pointer-events-none z-0" />

      <div className="w-full max-w-4xl relative z-10 flex flex-col items-center">
        {/* ヘッダー：タイトル ＆ 右上透過PNGボタングループ */}
        <div className="w-full flex flex-wrap justify-between items-center gap-3 mb-6">
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-black text-cyan-300 tracking-wider"
            style={{ textShadow: '0 0 12px rgba(0, 245, 255, 0.6)' }}
          >
            曲を選ぶ
          </h1>
          <div className={`flex items-center gap-1.5 sm:gap-3 ${showSettings ? 'pointer-events-none opacity-0 invisible' : ''}`}>
            {/* ランダムボタン */}
            <button
              type="button"
              onClick={handleRandomPlay}
              className="image-btn h-9 sm:h-12 md:h-14 w-auto"
              title="ランダム選曲"
              aria-label="ランダム選曲"
            >
              <img
                src="./assets/btn_random.png"
                alt="ランダム"
                width="145"
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
              onClick={onBack}
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
        ) : (
          <div className="info-banner w-full max-w-4xl font-bold tracking-widest text-xs md:text-sm text-center p-4 mb-6">
            遊び方：ノーツが判定枠に重なったら、表示されている最初の文字をタイピングしてください（<span className="text-emerald-300 font-black">スコア 700,000点以上でクリア！</span>）
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

          {!error && filteredAndSortedSongs.map(song => {
            const diff = Math.max(1, Math.min(10, song.difficulty || 1));
            return (
              <div
                key={song.id}
                onClick={() => handleSelectSong(song)}
                className="song-card w-full cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4"
              >
                <div className="flex flex-col w-full md:w-auto min-w-0 flex-1">
                  <span
                    className="text-xl sm:text-2xl font-black text-white tracking-wide break-words leading-snug"
                    style={{ textShadow: '0 0 10px rgba(192, 132, 252, 0.5)' }}
                  >
                    {song.title}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
                    <span className="text-xs sm:text-sm font-bold text-purple-200/90">譜面制作: {song.creator}</span>
                    {song.credit && <span className="text-xs sm:text-sm font-bold text-purple-200/80">クレジット: {song.credit}</span>}
                    <span className="font-bold whitespace-nowrap text-xs sm:text-sm tracking-[0.12em]">
                      <span
                        className="star-lit"
                        style={{ color: '#fbbf24', textShadow: '0 0 8px rgba(251, 191, 36, 0.8)' }}
                      >
                        {'★'.repeat(diff)}
                      </span>
                      <span className="star-unlit">
                        {'☆'.repeat(10 - diff)}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2.5">
                    <span
                      className="song-badge text-xs font-bold px-3 py-1 flex items-center gap-1"
                      style={{
                        background: 'rgba(30, 15, 65, 0.7)',
                        border: '1px solid rgba(192, 132, 252, 0.45)',
                        borderRadius: '9999px'
                      }}
                    >
                      ⏱ {formatTime(song.durationMs)}
                    </span>
                    <span
                      className="song-badge text-xs font-bold px-3 py-1 flex items-center gap-1"
                      style={{
                        background: 'rgba(30, 15, 65, 0.7)',
                        border: '1px solid rgba(192, 132, 252, 0.45)',
                        borderRadius: '9999px'
                      }}
                    >
                      🎵 {song.notesCount || 0} ノーツ
                    </span>
                  </div>
                </div>

                {/* カード内アクションボタン（ランキング・あそぶ） */}
                <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto mt-1 md:mt-0 justify-end flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSong(song);
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
          })}
        </div>

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
