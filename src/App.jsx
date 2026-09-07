import { useState, useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { gameEngine } from './engine/GameEngine';
import NotesArea from './components/NotesArea';
import EditorView from './components/editor/EditorView';

import SongSelect from './components/SongSelect';

function App() {
  const [appMode, setAppMode] = useState('menu'); // 'menu' | 'setup' | 'game' | 'editor' | 'songSelect'
  const [showGuide, setShowGuide] = useState(false);

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
  const isLocalPlay = useGameStore(state => state.isLocalPlay);
  
  const setLoadedScore = useGameStore(state => state.setLoadedScore);
  const setAudioUrl = useGameStore(state => state.setAudioUrl);
  const resetPlayState = useGameStore(state => state.resetPlayState);
  const clearSetup = useGameStore(state => state.clearSetup);
  const setIsLocalPlay = useGameStore(state => state.setIsLocalPlay);

  useEffect(() => {
    if (appMode === 'game' && status === 'playing') {
      setShowGuide(true);
      const timer = setTimeout(() => {
        setShowGuide(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowGuide(false);
    }
  }, [appMode, status]);

  const handleStartGame = () => {
    setIsLocalPlay(true);
    setAppMode('game');
    gameEngine.start();
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
      if (score >= maxScore * 0.7) return { rank: "クリア成功", color: "text-cyan-400" };
      return { rank: "クリア失敗", color: "text-red-500" };
    }
    
    if (score === maxScore && maxScore > 0) {
      return { rank: "全良", color: "text-yellow-400" };
    }
    
    return { rank: "フルコンボ", color: "text-green-400" };
  };

  if (appMode === 'editor') {
    return <EditorView onExit={() => setAppMode('menu')} />;
  }
  
  if (appMode === 'songSelect') {
    return <SongSelect onBack={() => setAppMode('menu')} onStartGame={() => setAppMode('game')} />;
  }

  return (
    <div className="h-screen w-screen bg-neutral-900 text-white flex flex-col items-center p-8 font-sans select-none overflow-hidden box-border">
      <h1 className="text-4xl font-black mb-8 text-orange-400 tracking-wider flex-shrink-0">太鼓タイピング</h1>
      
      {appMode === 'menu' && (
        <div className="flex flex-col gap-6 mt-20">
          <button 
            onClick={() => setAppMode('songSelect')}
            className="px-12 py-4 bg-orange-500 hover:bg-orange-400 text-neutral-900 rounded-full font-black text-2xl transition-colors"
          >
            公式譜面で遊ぶ
          </button>
          <button 
            onClick={() => setAppMode('setup')}
            className="px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-black text-2xl transition-colors"
          >
            創作譜面を遊ぶ
          </button>
          <button 
            onClick={() => setAppMode('editor')}
            className="px-12 py-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black text-2xl transition-colors"
          >
            創作譜面を作る
          </button>
        </div>
      )}

      {appMode === 'setup' && (
        <div className="bg-neutral-800 rounded-3xl p-8 flex flex-col items-center gap-8 w-full max-w-xl overflow-y-auto max-h-full">
          <h2 className="text-2xl font-black text-white">セットアップ</h2>
          
          <div className="text-neutral-400 font-bold tracking-widest text-sm text-center bg-neutral-900 p-4 rounded-xl border-2 border-neutral-700 w-full">
            遊び方：ノーツが判定枠に重なったら、表示されている最初の文字をタイピングしてください
          </div>
          
          {loadedScore && audioUrl ? (
            <div className="w-full flex flex-col gap-6">
              <div className="bg-cyan-900/30 border-2 border-cyan-800 p-6 rounded-2xl flex flex-col gap-2 text-center">
                <div className="text-cyan-400 font-bold mb-2">セットアップ済みデータ</div>
                <div className="text-white font-mono">{scoreFileName}</div>
                <div className="text-white font-mono">{audioFileName}</div>
              </div>
              
              <button 
                onClick={handleStartGame}
                className="w-full py-6 bg-orange-500 hover:bg-orange-400 text-neutral-900 rounded-full font-black text-3xl transition-colors"
              >
                スタート
              </button>
              
              <div className="flex flex-col gap-3 mt-4 pt-6 border-t-2 border-neutral-700">
                <div className="text-neutral-500 font-bold text-center text-sm">別のファイルに変更する</div>
                <label className="cursor-pointer w-full text-center py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors">
                  譜面(json)を読み込む
                  <input type="file" accept=".json" className="hidden" onChange={handleScoreLoad} />
                </label>
                <label className="cursor-pointer w-full text-center py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors">
                  音源(mp3/wav)を読み込む
                  <input type="file" accept="audio/*" className="hidden" onChange={handleAudioLoad} />
                </label>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-4">
              <label className={`cursor-pointer w-full text-center py-4 rounded-full font-bold transition-colors ${loadedScore ? 'bg-green-500 text-neutral-900' : 'bg-neutral-700 hover:bg-neutral-600 text-white'}`}>
                {loadedScore ? `読み込み済み (${scoreFileName})` : '譜面(json)を読み込む'}
                <input type="file" accept=".json" className="hidden" onChange={handleScoreLoad} />
              </label>
  
              <label className={`cursor-pointer w-full text-center py-4 rounded-full font-bold transition-colors ${audioUrl ? 'bg-green-500 text-neutral-900' : 'bg-neutral-700 hover:bg-neutral-600 text-white'}`}>
                {audioUrl ? `読み込み済み (${audioFileName})` : '音源(mp3/wav)を読み込む'}
                <input type="file" accept="audio/*" className="hidden" onChange={handleAudioLoad} />
              </label>
            </div>
          )}

          <div className="flex gap-4 w-full mt-4 flex-shrink-0">
            <button 
              onClick={() => setAppMode('menu')}
              className="flex-1 py-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black transition-colors"
            >
              もどる
            </button>
            {!(loadedScore && audioUrl) && (
              <button 
                onClick={handleStartGame}
                disabled={!loadedScore || !audioUrl}
                className="flex-1 py-4 bg-orange-500 hover:bg-orange-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-neutral-900 rounded-full font-black transition-colors"
              >
                スタート
              </button>
            )}
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
            {showGuide && (
              <div className="absolute top-4 text-neutral-500 font-bold tracking-widest text-sm transition-opacity duration-1000 opacity-50">
                遊び方：ノーツが判定枠に重なったら、表示されている最初の文字をタイピングしてください
              </div>
            )}
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
        <div className="bg-neutral-800 p-8 rounded-3xl w-full max-w-4xl flex flex-col gap-6 my-auto">
          <div className="flex flex-row w-full gap-8 items-stretch">
            {/* 左カラム：結果サマリー */}
            <div className="flex-[4] flex flex-col items-center justify-center gap-6 bg-neutral-900 rounded-2xl p-6">
              <div className="text-center">
                <h2 className={`text-6xl font-black tracking-widest ${getClearRank().color}`}>
                  {getClearRank().rank}
                </h2>
              </div>
              <div className="text-center mt-4">
                <div className="text-neutral-500 font-bold tracking-widest mb-1 text-sm">最終スコア</div>
                <div className="font-mono text-7xl text-white">{score}</div>
              </div>
            </div>

            {/* 右カラム：詳細判定 */}
            <div className="flex-[5] flex flex-col gap-4">
              <div className="flex flex-row gap-4 flex-1">
                {/* リズム判定 */}
                <div className="bg-neutral-900 rounded-2xl p-5 flex flex-col gap-3 flex-1 justify-center">
                  <h3 className="text-center font-black text-sm text-neutral-500 tracking-widest mb-1">リズム判定</h3>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold text-lg">良</span>
                    <span className="font-mono text-3xl text-yellow-400">{justiceCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold text-lg">可</span>
                    <span className="font-mono text-3xl text-green-400">{attackCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold text-lg">不可</span>
                    <span className="font-mono text-3xl text-red-500">{missCount}</span>
                  </div>
                </div>

                {/* タイピング判定 */}
                <div className="bg-neutral-900 rounded-2xl p-5 flex flex-col gap-3 flex-1 justify-center">
                  <h3 className="text-center font-black text-sm text-neutral-500 tracking-widest mb-1">タイピング判定</h3>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold text-lg">入力完了</span>
                    <span className="font-mono text-3xl text-white">{completedCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold text-lg">入力抜け</span>
                    <span className="font-mono text-3xl text-red-500">{droppedCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold text-lg">ミスタイプ</span>
                    <span className="font-mono text-3xl text-neutral-500">{typoCount}</span>
                  </div>
                </div>
              </div>

              {/* 下部スタッツ */}
              <div className="bg-neutral-900 rounded-2xl p-4 flex justify-around items-center">
                <div className="text-center flex-1">
                  <div className="text-neutral-500 font-bold tracking-widest mb-1 text-xs">最大コンボ</div>
                  <div className="font-mono text-3xl text-yellow-400">{maxCombo}</div>
                </div>
                <div className="w-1 h-12 bg-neutral-800 rounded-full"></div>
                <div className="text-center flex-1">
                  <div className="text-neutral-500 font-bold tracking-widest mb-1 text-xs">最高KPS（打鍵速度）</div>
                  <div className="font-mono text-3xl text-cyan-400">{maxKps.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
          
          {isLocalPlay && (
            <div className="w-full bg-cyan-900/30 border-2 border-cyan-800 text-cyan-400 p-3 rounded-xl text-center font-bold">
              開発者に作成データを共有して公式譜面にしてみよう！
            </div>
          )}

          <div className="flex gap-4 w-full">
            <button 
              onClick={handleBackToMenu}
              className="flex-1 py-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black text-xl transition-colors"
            >
              メニューに戻る
            </button>
            <button 
              onClick={handleRetry}
              className="flex-1 py-4 bg-orange-500 hover:bg-orange-400 text-neutral-900 rounded-full font-black text-xl transition-colors"
            >
              もう一度遊ぶ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
