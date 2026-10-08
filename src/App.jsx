import { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { gameEngine } from './engine/GameEngine';
import NotesArea from './components/NotesArea';
import EditorView from './components/editor/EditorView';
import ActiveWordDisplay from './components/ActiveWordDisplay';
import Toast from './components/Toast';
import { useSystemSE } from './hooks/useSystemSE';

import SongSelect from './components/SongSelect';
import Leaderboard from './components/Leaderboard';
import SettingsModal from './components/SettingsModal';
import FlickKeyboard from './components/FlickKeyboard';
import ResultScreen from './components/ResultScreen';
import { fetchRankingsResult, submitScore } from './api/rankings';
import { loadSongs } from './api/songList';
import { Maximize, Minimize, Smartphone, Monitor, User, Settings, Pause, Play, RotateCcw, Home } from 'lucide-react';

// 操作ガイドの自動消去をストア購読で行うモジュール（importするだけで有効になる）
import './engine/gameUiSync';

function App() {
  useSystemSE();

  const [appMode, setAppMode] = useState('menu'); // 'menu' | 'setup' | 'game' | 'editor' | 'songSelect'
  const [leaderboardData, setLeaderboardData] = useState(null); // { songTitle, promise } | null
  const [songsPromise, setSongsPromise] = useState(null);

  const score = useGameStore(state => state.score);
  const maxCombo = useGameStore(state => state.maxCombo);
  const status = useGameStore(state => state.status);
  const loadedScore = useGameStore(state => state.loadedScore);
  const audioUrl = useGameStore(state => state.audioUrl);
  const maxKps = useGameStore(state => state.maxKps);
  const scoreFileName = useGameStore(state => state.scoreFileName);
  const audioFileName = useGameStore(state => state.audioFileName);
  const isLocalPlay = useGameStore(state => state.isLocalPlay);
  const showGuide = useGameStore(state => state.showGuide);

  const setLoadedScore = useGameStore(state => state.setLoadedScore);
  const setAudioUrl = useGameStore(state => state.setAudioUrl);
  const resetPlayState = useGameStore(state => state.resetPlayState);
  const resetGameState = useGameStore(state => state.resetGameState);
  const setIsLocalPlay = useGameStore(state => state.setIsLocalPlay);
  const showToast = useGameStore(state => state.showToast);
  const isPaused = useGameStore(state => state.isPaused);
  const isFullscreen = useGameStore(state => state.isFullscreen);
  const isMobileMode = useGameStore(state => state.isMobileMode);
  const showSettings = useGameStore(state => state.showSettings);
  const setIsMobileMode = useGameStore(state => state.setIsMobileMode);
  const setShowSettings = useGameStore(state => state.setShowSettings);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        showToast("全画面表示に失敗しました");
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };


  // ランキング登録用のプレイヤー名（localStorageに保存して次回起動時も使う）
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('taiko_player_name') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState(null);

  const handleNameChange = (e) => {
    setPlayerName(e.target.value);
  };

  const handleScoreSubmit = async () => {
    if (isLocalPlay || !scoreFileName) return;
    setIsSubmitting(true);
    setSubmitSuccessMessage(null);
    const finalName = playerName.trim() || 'Guest';
    localStorage.setItem('taiko_player_name', finalName);
    try {
      const res = await submitScore({
        songId: scoreFileName.replace(/\.json$/i, ''),
        playerName: finalName,
        score,
        maxCombo,
        maxKps,
        perfectCount: useGameStore.getState().perfectCount,
        goodCount: useGameStore.getState().goodCount,
        missCount: useGameStore.getState().missCount
      });
      if (res.updated) {
        setSubmitSuccessMessage('ベストスコアを更新してランキングに登録しました');
      } else {
        setSubmitSuccessMessage('ベストスコア未更新のため登録されませんでした');
      }
    } catch (err) {
      showToast('送信失敗: ' + (err.message || '不明なエラー'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 操作ガイドの表示制御は engine/gameUiSync.js が
  // ストア購読（subscribe）で行うため、ここでのuseEffectは不要

  const handleStartGame = () => {
    setIsLocalPlay(true);
    setSubmitSuccessMessage(null);
    setAppMode('game');
    gameEngine.start();
  };

  const handleStop = () => {
    gameEngine.stop();
  };

  const handleRetry = () => {
    resetPlayState();
    setSubmitSuccessMessage(null);
    setAppMode('game');
    gameEngine.start();
  };

  const handleBackToMenu = () => {
    gameEngine.stop();
    resetGameState();
    setSubmitSuccessMessage(null);
    if (isLocalPlay) {
      setAppMode('setup');
    } else {
      if (!songsPromise) {
        setSongsPromise(loadSongs());
      }
      setAppMode('songSelect');
    }
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
        } else {
          showToast("無効な譜面ファイルです");
        }
      } catch (err) {
        showToast("無効な譜面ファイルです");
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

  if (appMode === 'editor') {
    return <EditorView onExit={() => setAppMode('menu')} />;
  }

  if (appMode === 'songSelect') {
    return (
      <>
        <Toast />
        <SongSelect songsPromise={songsPromise} onBack={() => setAppMode('menu')} onStartGame={() => setAppMode('game')} />

        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <Toast />
      <div
        className="h-screen w-screen bg-neutral-900 text-white flex flex-col items-center p-8 font-sans select-none overflow-hidden box-border relative"
      >

      <div className="absolute top-4 right-4 z-[55] flex gap-4">
        {(appMode === "menu" || appMode === "songSelect" || appMode === "characterSelect") && (
          <button
            onClick={toggleFullscreen}
            className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-colors"
            title="全画面表示切替"
          >
            {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
          </button>
        )}
      </div>

      {appMode === "characterSelect" && (
        <div className="z-10 flex flex-col items-center justify-center w-full h-full gap-6">
          <h2 className="text-4xl font-black text-white tracking-widest">キャラクター選択</h2>
          <div className="text-neutral-400">現在準備中です...</div>
          <button
            onClick={() => setAppMode("menu")}
            className="px-8 py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black transition-colors flex items-center gap-2 mt-8"
          >
            <Home size={20} />
            戻る
          </button>
        </div>
      )}

      {appMode === "menu" && (
        <div
          className="absolute inset-0 w-full h-full z-0 pointer-events-none"
          style={{
            backgroundImage: 'url(/assets/home_bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'top center',
            backgroundRepeat: 'no-repeat'
          }}
        />
      )}

      <div className="z-10 flex flex-col items-center w-full h-full">
        <h1 className={`text-4xl font-black mb-8 text-orange-400 tracking-wider flex-shrink-0 ${appMode === 'menu' ? 'invisible' : ''}`}>太鼓タイピング</h1>

      {appMode === 'menu' && (
        <div className="flex flex-col gap-6 mt-40">
          <button
            onClick={() => {
              setSongsPromise(loadSongs());
              setAppMode('songSelect');
            }}
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
          <button
            onClick={() => setIsMobileMode(!isMobileMode)}
            className="px-12 py-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black text-2xl transition-colors flex items-center justify-center gap-2"
          >
            {isMobileMode ? <Smartphone size={28} /> : <Monitor size={28} />}
            {isMobileMode ? "スマホモード" : "PCモード"}
          </button>
          <button
            onClick={() => setAppMode('characterSelect')}
            className="px-12 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-black text-2xl transition-colors flex items-center justify-center gap-2"
          >
            <User size={28} />
            キャラクター選択
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
          <div className="absolute top-4 left-4 z-40">
            <button
              onClick={() => gameEngine.togglePause()}
              className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-colors"
              title="一時停止 (Esc)"
            >
              <Pause size={24} />
            </button>
          </div>
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
            <ActiveWordDisplay />
          </div>
        </>
      )}

      {appMode === 'game' && status === 'result' && (
        <ResultScreen
          onRetry={handleRetry}
          onBack={handleBackToMenu}
          isLocalPlay={isLocalPlay}
          scoreFileName={scoreFileName}
          playerName={playerName}
          handleNameChange={handleNameChange}
          handleScoreSubmit={handleScoreSubmit}
          isSubmitting={isSubmitting}
          submitSuccessMessage={submitSuccessMessage}
          setLeaderboardData={setLeaderboardData}
        />
      )}

      {appMode === "game" && isPaused && (
        <div className="absolute inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
          <h2 className="text-5xl font-black text-white mb-12 tracking-widest">PAUSE</h2>
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <button
              onClick={() => gameEngine.togglePause()}
              className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-black text-xl transition-colors flex items-center justify-center gap-2"
            >
              <Play size={24} />
              プレーに戻る
            </button>
            <button
              onClick={() => {
                gameEngine.togglePause();
                handleRetry();
              }}
              className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-neutral-900 rounded-full font-black text-xl transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={24} />
              リトライ
            </button>
            <button
              onClick={() => {
                gameEngine.togglePause();
                handleBackToMenu();
              }}
              className="w-full py-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black text-xl transition-colors flex items-center justify-center gap-2"
            >
              <Home size={24} />
              曲選択画面に戻る
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-full py-4 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full font-black text-xl transition-colors flex items-center justify-center gap-2"
            >
              <Settings size={24} />
              設定
            </button>
          </div>
        </div>
      )}
      {appMode === "game" && isMobileMode && status !== 'result' && (
        <FlickKeyboard />
      )}

      {showSettings && (
        <SettingsModal onClose={() => {
          setShowSettings(false);
          if (appMode === "game") {
            if (isPaused) {
              gameEngine.togglePause();
            }
            handleRetry();
          }
        }} />
      )}

      {leaderboardData && (
        <Leaderboard
          songTitle={leaderboardData.songTitle}
          rankingsPromise={leaderboardData.promise}
          onClose={() => setLeaderboardData(null)}
        />
      )}
      </div>
      </div>
    </>
  );
}

export default App;
