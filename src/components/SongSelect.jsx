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
      
      onStartGame();
      setTimeout(() => gameEngine.start(), 0);
    } catch (err) {
      console.error(err);
      alert('譜面データの読み込みに失敗しました。');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-8 font-sans select-none w-full">
      <div className="w-full max-w-4xl flex justify-between items-center mb-12">
        <h1 className="text-4xl font-black text-cyan-400 tracking-wider">SELECT SONG</h1>
        <button 
          onClick={onBack}
          className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors"
        >
          BACK TO MENU
        </button>
      </div>

      <div className="w-full max-w-4xl flex flex-col gap-4">
        {loading && <div className="text-xl text-neutral-400">Loading songs...</div>}
        
        {error && <div className="text-xl text-red-400">{error}</div>}
        
        {!loading && !error && songs.length === 0 && (
          <div className="text-xl text-neutral-400">No songs available.</div>
        )}

        {!loading && !error && songs.map(song => (
          <div 
            key={song.id}
            onClick={() => handleSelectSong(song)}
            className="bg-neutral-800 hover:bg-neutral-700 transition-colors p-6 rounded-2xl cursor-pointer flex justify-between items-center border-4 border-transparent hover:border-cyan-500"
          >
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">{song.title}</span>
              <span className="text-sm font-bold text-neutral-400 mt-1">Creator: {song.creator}</span>
            </div>
            <div className="text-cyan-400 font-black tracking-widest bg-cyan-950 px-4 py-2 rounded-full">
              PLAY
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
