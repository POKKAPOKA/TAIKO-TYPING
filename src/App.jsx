import { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { gameEngine } from './engine/GameEngine';
import NotesArea from './components/NotesArea';
import EditorView from './components/editor/EditorView';

const DUMMY_KIMIGAYO = {
  musicTitle: "KIMIGAYO",
  notes: [
    { id: 1, time: 1000, endTime: 1500, word: "KIMI" },
    { id: 2, time: 2000, endTime: 2500, word: "GAYO" },
    { id: 3, time: 3000, endTime: 3500, word: "WA" },
    { id: 4, time: 4500, endTime: 5000, word: "CHIYO" },
    { id: 5, time: 5500, endTime: 6000, word: "NI" },
    { id: 6, time: 7000, endTime: 7500, word: "YACHIYO" },
    { id: 7, time: 8500, endTime: 9000, word: "NI" }
  ]
};

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
  const justiceCount = useGameStore(state => state.justiceCount);
  const attackCount = useGameStore(state => state.attackCount);
  const completedCount = useGameStore(state => state.completedCount);
  const droppedCount = useGameStore(state => state.droppedCount);
  const typoCount = useGameStore(state => state.typoCount);
  const maxKps = useGameStore(state => state.maxKps);
  const activeWord = useGameStore(state => state.activeWord);
  const typedIndex = useGameStore(state => state.typedIndex);
  const scoreFileName = useGameStore(state => state.scoreFileName);
  const audioFileName = useGameStore(state => state.audioFileName);
  
  const setLoadedScore = useGameStore(state => state.setLoadedScore);
  const setAudioUrl = useGameStore(state => state.setAudioUrl);
  const resetPlayState = useGameStore(state => state.resetPlayState);
  const clearSetup = useGameStore(state => state.clearSetup);

  const handleStartGame = () => {
    setAppMode('game');
    gameEngine.start();
  };

  const handleDemoStart = () => {
    setLoadedScore(DUMMY_KIMIGAYO, "kimigayo.json");
    setAudioUrl('./kimigayo.mp3', "kimigayo.mp3");
    setAppMode('game');
    setTimeout(() => gameEngine.start(), 0);
  };

  const handleStop = () => {
    gameEngine.stop();
  };

  const handleRetry = () => {
    resetPlayState();
    setAppMode('game');
    gameEngine.start();
  };

  const handleBackToMenu = () => {
    gameEngine.stop();
    clearSetup();
    setAppMode('menu');
  };

  const handleScoreLoad = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.notes && Array.isArray(json.notes)) {
          setLoadedScore(json, file.name);
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
      setAudioUrl(URL.createObjectURL(file), file.name);
    }
  };

  const getClearRank = () => {
    if (missCount > 0 || droppedCount > 0) {
      if (score >= maxScore * 0.7) return { rank: "CLEAR", color: "text-cyan-400" };
      return { rank: "FAILED", color: "text-red-500" };
    }
    
    if (score === maxScore && maxScore > 0) {
      return { rank: "ALL JUSTICE", color: "text-yellow-400" };
    }
    
    return { rank: "FULL COMBO", color: "text-green-400" };
  };

  if (appMode === 'editor') {
    return <EditorView onExit={() => setAppMode('menu')} />;
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-8 font-sans select-none overflow-y-auto">
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
              {loadedScore ? `Load Score (${scoreFileName})` : 'LOAD SCORE (score.json)'}
              <input type="file" accept=".json" className="hidden" onChange={handleScoreLoad} />
            </label>

            <label className={`cursor-pointer w-full text-center py-4 rounded-full font-bold transition-colors ${audioUrl ? 'bg-green-500 text-neutral-900' : 'bg-neutral-700 hover:bg-neutral-600 text-white'}`}>
              {audioUrl ? `Load Audio (${audioFileName})` : 'LOAD AUDIO (.mp3, .wav)'}
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

          <div className="w-full border-t border-neutral-700 my-2"></div>
          
          <button 
            onClick={handleDemoStart}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-black text-xl transition-colors"
          >
            Play Demo (君が代)
          </button>
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
            {activeWord ? (
              <div className="text-6xl font-mono tracking-widest mt-2">
                <span className="text-neutral-600">{activeWord.substring(0, typedIndex)}</span>
                <span className="text-white font-black underline decoration-4 underline-offset-8">{activeWord.charAt(typedIndex)}</span>
                <span className="text-neutral-400">{activeWord.substring(typedIndex + 1)}</span>
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
        <div className="bg-neutral-800 p-12 rounded-3xl w-full max-w-3xl flex flex-col items-center gap-10 my-4">
          <div className="text-center">
            <div className="text-neutral-400 font-bold tracking-widest mb-2">CLEAR RANK</div>
            <h2 className={`text-6xl font-black tracking-widest ${getClearRank().color}`}>
              {getClearRank().rank}
            </h2>
          </div>
          
          <div className="w-full grid grid-cols-2 gap-6">
            
            {/* RHYTHM Section */}
            <div className="bg-neutral-900 rounded-2xl p-6 flex flex-col gap-4">
              <h3 className="text-center font-black text-xl text-neutral-500 tracking-widest mb-2">RHYTHM</h3>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 font-bold text-lg">JUSTICE</span>
                <span className="font-mono text-3xl text-yellow-400">{justiceCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 font-bold text-lg">ATTACK</span>
                <span className="font-mono text-3xl text-green-400">{attackCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 font-bold text-lg">MISS</span>
                <span className="font-mono text-3xl text-red-500">{missCount}</span>
              </div>
            </div>

            {/* TYPING Section */}
            <div className="bg-neutral-900 rounded-2xl p-6 flex flex-col gap-4">
              <h3 className="text-center font-black text-xl text-neutral-500 tracking-widest mb-2">TYPING</h3>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 font-bold text-lg">COMPLETED</span>
                <span className="font-mono text-3xl text-white">{completedCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 font-bold text-lg">DROPPED</span>
                <span className="font-mono text-3xl text-red-500">{droppedCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 font-bold text-lg">TYPO</span>
                <span className="font-mono text-3xl text-neutral-500">{typoCount}</span>
              </div>
            </div>

          </div>

          <div className="w-full bg-neutral-900 rounded-2xl p-8 flex justify-around items-center">
            <div className="text-center">
              <div className="text-neutral-500 font-bold tracking-widest mb-1 text-sm">FINAL SCORE</div>
              <div className="font-mono text-5xl text-white">{score}</div>
            </div>
            <div className="w-1 h-16 bg-neutral-800 rounded-full"></div>
            <div className="text-center">
              <div className="text-neutral-500 font-bold tracking-widest mb-1 text-sm">MAX COMBO</div>
              <div className="font-mono text-5xl text-yellow-400">{maxCombo}</div>
            </div>
            <div className="w-1 h-16 bg-neutral-800 rounded-full"></div>
            <div className="text-center">
              <div className="text-neutral-500 font-bold tracking-widest mb-1 text-sm">TOP KPS</div>
              <div className="font-mono text-5xl text-cyan-400">{maxKps.toFixed(2)}</div>
            </div>
          </div>

          <div className="flex gap-4 w-full mt-4">
            <button 
              onClick={handleBackToMenu}
              className="flex-1 py-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black text-xl transition-colors"
            >
              BACK TO MENU
            </button>
            <button 
              onClick={handleRetry}
              className="flex-1 py-4 bg-orange-500 hover:bg-orange-400 text-neutral-900 rounded-full font-black text-xl transition-colors"
            >
              RETRY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
