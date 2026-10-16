import { useState, useMemo, Suspense, use } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameEngine } from '../engine/GameEngine';
import Leaderboard from './Leaderboard';
import { fetchRankingsResult } from '../api/rankings';

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

      setLoadedScore(data, scoreFileName);
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
            濁点・小文字の<span className="text-pink-300 font-black">変換は不要</span>で、すべて<span className="text-cyan-300 font-black">元の清音</span>で入力できます（例：『だ』→『た』、『っ』→『つ』）。
          </div>
        ) : (
          <div className="info-banner w-full max-w-4xl font-bold tracking-widest text-xs md:text-sm text-center p-4 mb-6">
            遊び方：ノーツが判定枠に重なったら、表示されている最初の文字をタイピングしてください
          </div>
        )}

        {/* フィルター＆ソート コントロールパネル（半透明ガラスUI） */}
        {!error && songs.length > 0 && (
          <div className="filter-panel w-full max-w-4xl p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              {/* 難易度フィルター */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-purple-200/80">難易度</label>
                <select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  className="font-bold px-4 py-2 cursor-pointer"
                >
                  <option value="all">すべて</option>
                  <option value="1-3">☆1〜3 (簡単)</option>
                  <option value="4-6">☆4〜6 (普通)</option>
                  <option value="7-10">☆7〜10 (難しい)</option>
                </select>
              </div>

              {/* 制作者フィルター */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-purple-200/80">譜面制作</label>
                <select
                  value={filterCreator}
                  onChange={(e) => setFilterCreator(e.target.value)}
                  className="font-bold px-4 py-2 cursor-pointer"
                >
                  <option value="all">すべて</option>
                  {creators.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t border-purple-400/30 md:border-t-0">
              {/* ソート項目 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-purple-200/80">並び替え</label>
                <div className="flex gap-2">
                  <select
                    value={sortType}
                    onChange={(e) => setSortType(e.target.value)}
                    className="font-bold px-4 py-2 cursor-pointer"
                  >
                    <option value="difficulty">難易度</option>
                    <option value="duration">長さ</option>
                    <option value="notesCount">ノーツ数</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="sort-order-btn font-bold px-4 py-2 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {sortOrder === 'asc' ? '▲ 昇順' : '▼ 降順'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 楽曲カード一覧 */}
        <div className="w-full max-w-4xl flex flex-col gap-4">
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
