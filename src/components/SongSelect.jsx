import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameEngine } from '../engine/GameEngine';

export default function SongSelect({ onBack, onStartGame }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // ソートとフィルターのステート
  const [sortType, setSortType] = useState('difficulty'); // 'difficulty', 'duration', 'notesCount'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [filterCreator, setFilterCreator] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');

  const setLoadedScore = useGameStore(state => state.setLoadedScore);
  const setAudioUrl = useGameStore(state => state.setAudioUrl);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const response = await fetch('./songs/index.json');
        if (!response.ok) {
          throw new Error('Failed to load song list');
        }
        const data = await response.json();
        setSongs(data);
      } catch (err) {
        console.error(err);
        setError('曲リストの読み込みに失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchSongs();
  }, []);

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
      if(store.setIsLocalPlay) store.setIsLocalPlay(false);
      
      onStartGame();
      setTimeout(() => gameEngine.start(), 0);
    } catch (err) {
      console.error(err);
      alert('譜面データの読み込みに失敗しました。');
    }
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
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-4 md:p-8 font-sans select-none w-full">
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <h1 className="text-3xl md:text-4xl font-black text-cyan-400 tracking-wider">曲を選ぶ</h1>
        <button 
          onClick={onBack}
          className="px-4 md:px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors text-sm md:text-base"
        >
          メニューに戻る
        </button>
      </div>
      
      <div className="w-full max-w-4xl text-neutral-400 font-bold tracking-widest text-xs md:text-sm text-center bg-neutral-800 p-4 rounded-xl border-2 border-neutral-700 mb-6">
        遊び方：ノーツが判定枠に重なったら、表示されている最初の文字をタイピングしてください
      </div>

      {/* フィルター＆ソート コントロールパネル */}
      {!loading && !error && songs.length > 0 && (
        <div className="w-full max-w-4xl bg-neutral-800 p-4 rounded-2xl border-2 border-neutral-700 mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            {/* 難易度フィルター */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-neutral-400">難易度</label>
              <select 
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="bg-neutral-900 text-white font-bold rounded-xl px-4 py-2 border-none outline-none cursor-pointer"
              >
                <option value="all">すべて</option>
                <option value="1-3">☆1〜3 (簡単)</option>
                <option value="4-6">☆4〜6 (普通)</option>
                <option value="7-10">☆7〜10 (難しい)</option>
              </select>
            </div>
            
            {/* 制作者フィルター */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-neutral-400">譜面制作</label>
              <select 
                value={filterCreator}
                onChange={(e) => setFilterCreator(e.target.value)}
                className="bg-neutral-900 text-white font-bold rounded-xl px-4 py-2 border-none outline-none cursor-pointer"
              >
                <option value="all">すべて</option>
                {creators.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t-2 md:border-t-0 border-neutral-700">
            {/* ソート項目 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-neutral-400">並び替え</label>
              <div className="flex gap-2">
                <select 
                  value={sortType}
                  onChange={(e) => setSortType(e.target.value)}
                  className="bg-neutral-900 text-white font-bold rounded-xl px-4 py-2 border-none outline-none cursor-pointer"
                >
                  <option value="difficulty">難易度</option>
                  <option value="duration">長さ</option>
                  <option value="notesCount">ノーツ数</option>
                </select>
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="bg-neutral-700 hover:bg-neutral-600 text-white font-bold rounded-xl px-4 py-2 transition-colors flex items-center gap-1"
                >
                  {sortOrder === 'asc' ? '▲ 昇順' : '▼ 降順'}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      <div className="w-full max-w-4xl flex flex-col gap-4">
        {loading && <div className="text-xl text-neutral-400 text-center py-8">曲を読み込み中...</div>}
        
        {error && <div className="text-xl text-red-400 text-center py-8">{error}</div>}
        
        {!loading && !error && filteredAndSortedSongs.length === 0 && (
          <div className="bg-neutral-800 p-8 rounded-2xl border-4 border-neutral-700 border-dashed text-center">
            <span className="text-xl font-bold text-neutral-400">該当する譜面がありません</span>
          </div>
        )}

        {!loading && !error && filteredAndSortedSongs.map(song => (
          <div 
            key={song.id}
            onClick={() => handleSelectSong(song)}
            className="bg-neutral-800 hover:bg-neutral-700 transition-colors p-4 md:p-6 rounded-2xl cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center border-4 border-transparent hover:border-cyan-500 gap-4 shadow-none"
          >
            <div className="flex flex-col w-full md:w-auto">
              <span className="text-2xl font-black text-white">{song.title}</span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                <span className="text-sm font-bold text-neutral-400">譜面制作: {song.creator}</span>
                <span className="text-yellow-400 font-bold whitespace-nowrap text-sm tracking-[0.1em]">
                  {'★'.repeat(song.difficulty || 1)}{'☆'.repeat(10 - (song.difficulty || 1))}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="bg-neutral-900 text-neutral-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-none">
                  ⏱️ {formatTime(song.durationMs)}
                </span>
                <span className="bg-neutral-900 text-neutral-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-none">
                  🎵 {song.notesCount || 0} ノーツ
                </span>
              </div>
            </div>
            <div className="text-cyan-400 font-black tracking-widest bg-cyan-950 px-6 py-3 md:py-2 rounded-full whitespace-nowrap w-full md:w-auto text-center mt-2 md:mt-0 shadow-none">
              あそぶ
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
