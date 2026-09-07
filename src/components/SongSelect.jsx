import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameEngine } from '../engine/GameEngine';

export default function SongSelect({ onBack, onStartGame }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-8 font-sans select-none w-full">
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <h1 className="text-4xl font-black text-cyan-400 tracking-wider">曲を選ぶ</h1>
        <button 
          onClick={onBack}
          className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors"
        >
          メニューに戻る
        </button>
      </div>
      
      <div className="w-full max-w-4xl text-neutral-400 font-bold tracking-widest text-sm text-center bg-neutral-800 p-4 rounded-xl border-2 border-neutral-700 mb-8">
        遊び方：ノーツが判定枠に重なったら、表示されている最初の文字をタイピングしてください
      </div>

      <div className="w-full max-w-4xl flex flex-col gap-4">
        {loading && <div className="text-xl text-neutral-400">曲を読み込み中...</div>}
        
        {error && <div className="text-xl text-red-400">{error}</div>}
        
        {!loading && !error && songs.length === 0 && (
          <div className="text-xl text-neutral-400">曲が見つかりませんでした。</div>
        )}

        {!loading && !error && songs.map(song => (
          <div 
            key={song.id}
            onClick={() => handleSelectSong(song)}
            className="bg-neutral-800 hover:bg-neutral-700 transition-colors p-6 rounded-2xl cursor-pointer flex justify-between items-center border-4 border-transparent hover:border-cyan-500"
          >
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">{song.title}</span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                <span className="text-sm font-bold text-neutral-400">譜面制作: {song.creator}</span>
                <span className="text-yellow-400 font-bold whitespace-nowrap text-sm tracking-[0.1em]">
                  {'★'.repeat(song.difficulty || 1)}{'☆'.repeat(10 - (song.difficulty || 1))}
                </span>
              </div>
            </div>
            <div className="text-cyan-400 font-black tracking-widest bg-cyan-950 px-6 py-2 rounded-full whitespace-nowrap">
              あそぶ
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
