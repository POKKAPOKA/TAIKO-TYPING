import { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { gameEngine } from './engine/GameEngine';
import NotesArea from './components/NotesArea';
import EditorView from './components/editor/EditorView';

function App() {
  const [appMode, setAppMode] = useState('menu'); // 'menu' | 'setup' | 'game' | 'editor'

  const score = useGameStore(state => state.score);
  const maxCombo = useGameStore(state => state.maxCombo);
  const status = useGameStore(state => state.status);
  const currentTarget = useGameStore(state => state.currentTarget);
  const loadedScore = useGameStore(state => state.loadedScore);
  const audioUrl = useGameStore(state => state.audioUrl);
  const maxScore = useGameStore(state => state.maxScore);
  const missCount = useGameStore(state => state.missCount);
  
  const setLoadedScore = useGameStore(state => state.setLoadedScore);
  const setAudioUrl = useGameStore(state => state.setAudioUrl);

  const handleStartGame = () => {
    setAppMode('game');
    gameEngine.start();
  };

  const handleStop = () => {
    gameEngine.stop();
  };

  const handleScoreLoad = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.notes && Array.isArray(json.notes)) {
          setLoadedScore(json);
        }
      } catch (err) {
        alert("無効な譜面ファイルです");
      }
    };
    reader.readAsText(file);
  };

  const handleAudioLoad = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  const getClearRank = () => {
    // ミスがある場合は絶対に FULL COMBO / ALL JUSTICE にしない
    if (missCount > 0) {
      if (score >= maxScore * 0.7) return { rank: "CLEAR", color: "text-cyan-400" };
      return { rank: "FAILED", color: "text-red-500" };
    }
    
    // ミス0回の場合
    if (score === maxScore && maxScore > 0) {
      return { rank: "ALL JUSTICE", color: "text-yellow-400" };
    }
    
    // ミス0回だが、スコアが理論値未満（ATTACKがある）
    return { rank: "FULL COMBO", color: "text-green-400" };
  };

  if (appMode === 'editor') {
    return <EditorView onExit={() => setAppMode('menu')} />;
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-8 font-sans select-none">
      <h1 className="text-4xl font-black mb-8 text-orange-400 tracking-wider">TAIKO TYPING</h1>
      
      {appMode === 'menu' && (
        <div className="flex flex-col gap-6 mt-20">
          <button 
            onClick={() => setAppMode('setup')}
            className="px-12 py-4 bg-orange-500 hover:bg-orange-400 text-neutral-900 rounded-full font-black text-2xl transition-colors"
          >
            PLAY GAME
          </button>
          <button 
            onClick={() => setAppMode('editor')}
            className="px-12 py-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black text-2xl transition-colors"
          >
            OPEN EDITOR
          </button>
        </div>
      )}

      {appMode === 'setup' && (
        <div className="bg-neutral-800 rounded-3xl p-8 flex flex-col items-center gap-8 w-full max-w-xl">
          <h2 className="text-2xl font-black text-white">GAME SETUP</h2>
          
          <div className="w-full flex flex-col gap-4">
            <label className={`cursor-pointer w-full text-center py-4 rounded-full font-bold transition-colors ${loadedScore ? 'bg-green-500 text-neutral-900' : 'bg-neutral-700 hover:bg-neutral-600 text-white'}`}>
              {loadedScore ? '譜面ロード完了' : 'LOAD SCORE (score.json)'}
              <input type="file" accept=".json" className="hidden" onChange={handleScoreLoad} />
            </label>

            <label className={`cursor-pointer w-full text-center py-4 rounded-full font-bold transition-colors ${audioUrl ? 'bg-green-500 text-neutral-900' : 'bg-neutral-700 hover:bg-neutral-600 text-white'}`}>
              {audioUrl ? '音楽ロード完了' : 'LOAD AUDIO (.mp3, .wav)'}
              <input type="file" accept="audio/*" className="hidden" onChange={handleAudioLoad} />
            </label>
          </div>

          <div className="flex gap-4 w-full mt-4">
            <button 
              onClick={() => setAppMode('menu')}
              className="flex-1 py-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black transition-colors"
            >
              BACK
            </button>
            <button 
              onClick={handleStartGame}
              disabled={!loadedScore || !audioUrl}
              className="flex-1 py-4 bg-orange-500 hover:bg-orange-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-neutral-900 rounded-full font-black transition-colors"
            >
              START
            </button>
          </div>
        </div>
      )}

      {appMode === 'game' && status !== 'result' && (
        <>
          <div className="w-full max-w-4xl bg-neutral-800 rounded-t-3xl p-6 flex justify-between items-center border-b-4 border-neutral-900">
            <div className="flex gap-8">
              <div className="text-xl">
                <span className="text-neutral-400 text-sm font-bold block">SCORE</span>
                <span className="font-mono text-4xl">{score.toString().padStart(6, '0')}</span>
              </div>
            </div>
            
            <button 
              onClick={handleStop}
              className="px-8 py-3 bg-red-500 hover:bg-red-400 text-neutral-900 rounded-full font-black transition-colors"
            >
              STOP
            </button>
          </div>

          <div className="w-full max-w-4xl bg-neutral-800 border-b-4 border-neutral-900 overflow-hidden">
            <NotesArea />
          </div>

          <div className="w-full max-w-4xl bg-neutral-800 rounded-b-3xl p-8 flex flex-col items-center justify-center min-h-[160px] relative">
            {currentTarget ? (
              <div className="text-6xl font-mono tracking-widest mt-2">
                <span className="text-neutral-500">{currentTarget.typed}</span>
                <span className="text-white">{currentTarget.word.slice(currentTarget.typed.length)}</span>
              </div>
            ) : (
              <div className="text-2xl text-neutral-500 mt-2 font-bold tracking-widest">
                {status === 'playing' ? 'READY...' : 'PRESS START'}
              </div>
            )}
          </div>
        </>
      )}

      {appMode === 'game' && status === 'result' && (
        <div className="bg-neutral-800 p-12 rounded-3xl w-full max-w-2xl flex flex-col items-center gap-8 mt-10">
          <h2 className={`text-6xl font-black tracking-widest ${getClearRank().color}`}>
            {getClearRank().rank}
          </h2>
          
          <div className="w-full bg-neutral-900 rounded-2xl p-8 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-bold text-xl">SCORE</span>
              <span className="font-mono text-4xl text-white">{score}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-bold text-xl">MAX SCORE</span>
              <span className="font-mono text-2xl text-neutral-500">{maxScore}</span>
            </div>
            <div className="h-1 bg-neutral-800 my-2 rounded-full"></div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-bold text-xl">MAX COMBO</span>
              <span className="font-mono text-3xl text-yellow-400">{maxCombo}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-bold text-xl">MISS</span>
              <span className="font-mono text-3xl text-red-500">{missCount}</span>
            </div>
          </div>

          <button 
            onClick={() => setAppMode('menu')}
            className="px-12 py-4 mt-4 bg-orange-500 hover:bg-orange-400 text-neutral-900 rounded-full font-black text-xl transition-colors w-full"
          >
            BACK TO MENU
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
