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
import { Maximize, Minimize, Smartphone, Monitor, User, Settings, Pause, Play, RotateCcw, Home, HelpCircle, X } from 'lucide-react';

// 操作ガイドの自動消去をストア購読で行うモジュール（importするだけで有効になる）
import './engine/gameUiSync';

// モード切替用ボタン画像の事前読み込み（画面切替時のチラつき防止・useEffect不使用）
if (typeof window !== 'undefined') {
  const preloadPc = new Image();
  preloadPc.src = './assets/button_3_pcmode.png';
  const preloadMobile = new Image();
  preloadMobile.src = './assets/button_3_mobilemode.png';
}

function App() {
  const { playDecide } = useSystemSE();

  const [appMode, setAppMode] = useState('menu'); // 'menu' | 'setup' | 'game' | 'editor' | 'songSelect'
  const [leaderboardData, setLeaderboardData] = useState(null); // { songTitle, promise } | null
  const [songsPromise, setSongsPromise] = useState(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const score = useGameStore(state => state.score);
  const combo = useGameStore(state => state.combo);
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
  const showCustomModes = useGameStore(state => state.showCustomModes);

  const [showHowToPlay, setShowHowToPlay] = useState(false);

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
        className={`w-screen bg-neutral-900 text-white flex flex-col items-center font-sans select-none overflow-hidden box-border relative ${
          isMobileMode && appMode === 'game'
            ? 'h-[100dvh] p-2'
            : appMode === 'menu'
            ? 'h-screen p-0 bg-cover bg-center bg-no-repeat'
            : 'h-screen p-8'
        }`}
        style={appMode === 'menu' ? { backgroundImage: 'url(/assets/home_bg.png)' } : undefined}
      >

      {/* 右上ボタングループ（設定・全画面表示） */}
      {(appMode === "menu" || appMode === "songSelect" || appMode === "characterSelect") && (
        <div className={`absolute z-30 flex items-center ${
          appMode === "menu"
            ? "top-7 right-8 sm:top-10 sm:right-12 md:top-12 md:right-16 gap-3 sm:gap-4 top-right-buttons"
            : "top-4 right-4 gap-4"
        } ${showSettings ? "pointer-events-none opacity-0 invisible" : ""}`}>
          {appMode === "menu" ? (
            <>
              {/* 設定ボタン (和風サイバーネオンバッジ) */}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="icon-button w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16"
                title="設定"
                style={{ color: '#e879f9' }}
              >
                <img
                  src="/assets/buttons/btn_settings.png"
                  alt="設定"
                />
              </button>

              {/* 全画面表示ボタン (和風サイバーネオンバッジ) */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="icon-button w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16"
                title="全画面表示切替"
                style={{ color: '#22d3ee' }}
              >
                <img
                  src="/assets/buttons/btn_fullscreen.png"
                  alt="全画面表示"
                />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowSettings(true)}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-colors"
                title="設定"
              >
                <Settings size={24} />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-colors"
                title="全画面表示切替"
              >
                {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
              </button>
            </>
          )}
        </div>
      )}

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

      <div className={`flex flex-col items-center w-full h-full ${appMode === 'menu' ? 'justify-center' : 'z-10'} ${isMobileMode && appMode === 'game' ? 'min-h-0' : ''}`}>
        <h1 className={`text-4xl font-black mb-8 text-orange-400 tracking-wider flex-shrink-0 ${appMode === 'menu' || appMode === 'game' ? 'hidden' : ''}`}>太鼓タイピング</h1>

      {appMode === 'menu' && (
        <div className="w-full max-w-[310px] sm:max-w-[380px] md:max-w-[430px] lg:max-w-[450px] flex flex-col items-center justify-center gap-4 sm:gap-[18px] md:gap-5 my-auto px-4">
          {/* ボタン1: 「公式譜面で遊ぶ」 */}
          <button
            type="button"
            onClick={() => {
              setSongsPromise(loadSongs());
              setAppMode('songSelect');
            }}
            className="menu-button w-full"
            style={{ color: '#f472b6' }}
          >
            <img
              src="/assets/buttons/btn_official.png"
              alt="公式譜面で遊ぶ"
            />
          </button>

          {/* ボタン2: 「遊び方」 */}
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="menu-button w-full"
            style={{ color: '#22d3ee' }}
          >
            <img
              src="/assets/buttons/btn_howtoplay.png"
              alt="遊び方"
            />
          </button>

          {/* ボタン3: 「PCモード」 / 「スマホモード」切替トグル */}
          <button
            type="button"
            onClick={() => {
              playDecide();
              const nextMode = !isMobileMode;
              setIsMobileMode(nextMode);
              setIsSwitchingMode(true);
              showToast(nextMode ? "スマホモードに切り替えました" : "PCモードに切り替えました");
            }}
            onAnimationEnd={() => setIsSwitchingMode(false)}
            className={`menu-button w-full ${isSwitchingMode ? 'mode-switching' : ''}`}
            style={{ color: '#c084fc' }}
            aria-label={isMobileMode ? "スマホモード（タップでPCモードに切替）" : "PCモード（タップでスマホモードに切替）"}
            title={isMobileMode ? "スマホモード（タップでPCモードに切替）" : "PCモード（タップでスマホモードに切替）"}
          >
            <img
              key={isMobileMode ? 'mobile' : 'pc'}
              src={isMobileMode ? "./assets/button_3_mobilemode.png" : "./assets/button_3_pcmode.png"}
              alt={isMobileMode ? "スマホモード" : "PCモード"}
            />
          </button>

          {/* ボタン4: 「キャラクター選択」 */}
          <button
            type="button"
            onClick={() => setAppMode('characterSelect')}
            className="menu-button w-full"
            style={{ color: '#d946ef' }}
          >
            <img
              src="/assets/buttons/btn_character.png"
              alt="キャラクター選択"
            />
          </button>

          {/* 創作譜面モード（設定でONにした場合のみ表示） */}
          {showCustomModes && (
            <div className="flex gap-3 w-full mt-1 justify-center">
              <button
                onClick={() => setAppMode('setup')}
                className="px-5 py-2 bg-neutral-950/70 hover:bg-cyan-950/70 border border-cyan-500/50 text-cyan-300 rounded-full font-bold text-xs backdrop-blur-sm transition-all"
              >
                創作譜面を遊ぶ
              </button>
              <button
                onClick={() => setAppMode('editor')}
                className="px-5 py-2 bg-neutral-950/70 hover:bg-neutral-800/70 border border-neutral-600 text-neutral-300 rounded-full font-bold text-xs backdrop-blur-sm transition-all"
              >
                創作譜面を作る
              </button>
            </div>
          )}
        </div>
      )}

      {appMode === 'setup' && (
        <div className="bg-neutral-800 rounded-3xl p-8 flex flex-col items-center gap-8 w-full max-w-xl overflow-y-auto max-h-full shadow-none">
          <h2 className="text-2xl font-black text-white">セットアップ</h2>

          {isMobileMode ? (
            <div className="text-neutral-200 font-bold text-xs sm:text-sm bg-neutral-900 p-4 rounded-xl border-2 border-neutral-700 w-full flex flex-col gap-2 shadow-none">
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-neutral-950 text-xs font-black px-2 py-0.5 rounded-md">最重要</span>
                <span>キーを押した瞬間ではなく、<span className="text-amber-300 font-black">【指を離した瞬間】</span>にタイミング判定されます！</span>
              </div>
              <div className="text-neutral-300 text-xs leading-relaxed">
                💡 早めにタッチしてフリック方向へ滑らせておき、<span className="text-cyan-300 font-black">判定枠に重なる瞬間に指を離す</span>とPERFECTが狙いやすくなります。
              </div>
              <div className="text-neutral-300 text-xs leading-relaxed border-t border-neutral-700 pt-2">
                濁点・半濁点・小文字の<span className="text-pink-300 font-black">変換は不要</span>です。すべて<span className="text-cyan-300 font-black">元の文字（清音）</span>で入力してください（例：『だ』→『た』、『ぴ』→『ひ』、『っ』→『つ』）。
              </div>
            </div>
          ) : (
            <div className="text-neutral-400 font-bold tracking-widest text-sm text-center bg-neutral-900 p-4 rounded-xl border-2 border-neutral-700 w-full shadow-none">
              遊び方：ノーツが判定枠に重なったら、表示されている最初の文字をタイピングしてください
            </div>
          )}

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
        isMobileMode ? (
          /* スマホモード時の最適化レイアウト（100dvh・ドッキング構造） */
          <div className="w-full h-full flex flex-col justify-between items-center min-h-0 max-w-lg">
            {/* 1. 【上部】ヘッダー: コンパクトなスコア表示 + 一時停止ボタン */}
            <div className="w-full flex justify-between items-center px-4 py-2 bg-neutral-800 rounded-2xl flex-shrink-0 border-2 border-neutral-700">
              <div className="flex items-center gap-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-neutral-400 text-xs font-bold font-mono">SCORE</span>
                  <span className="font-dotgothic text-2xl font-black text-white">{score.toString().padStart(6, '0')}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-neutral-400 text-xs font-bold font-mono">KPS</span>
                  <span className="font-dotgothic text-xl font-black text-cyan-400">{maxKps.toFixed(2)}</span>
                </div>
                {combo > 0 && (
                  <div className="flex items-baseline gap-1 text-yellow-400">
                    <span className="font-dotgothic text-xl font-black">{combo}</span>
                    <span className="text-xs font-bold">COMBO</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => gameEngine.togglePause()}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 text-white rounded-xl font-black text-sm flex items-center gap-1.5 transition-colors"
                title="一時停止"
              >
                <Pause size={18} />
                <span>ポーズ</span>
              </button>
            </div>

            {/* 2. 【中間】ゲーム領域（ノーツレーン + アクティブワード）のアスペクト比固定＆最大化 */}
            <div className="flex-1 w-full flex flex-col justify-center items-center my-1 min-h-0 overflow-hidden relative">
              <div className="w-full flex-1 flex items-center justify-center min-h-0 overflow-hidden">
                <NotesArea />
              </div>
              <div className="w-full py-1.5 flex flex-col items-center justify-center flex-shrink-0 gap-1">
                {showGuide && (
                  <div className="text-[11px] font-bold text-neutral-300 bg-neutral-800/90 border border-neutral-700 px-3 py-1 rounded-full text-center transition-opacity duration-1000 shadow-none">
                    <span className="text-amber-300 font-black">【指を離した瞬間】</span>に判定！濁点・小文字は<span className="text-pink-300 font-black">変換不要</span>（清音で入力）
                  </div>
                )}
                <ActiveWordDisplay />
              </div>
            </div>

            {/* 3. 【下部】ドッキングされたフリックキーボード */}
            <FlickKeyboard />
          </div>
        ) : (
          /* PCモード時のプレイ画面 */
          <div className="w-full max-w-4xl flex flex-col items-center">
            <div className="absolute top-4 left-4 z-40">
              <button
                onClick={() => gameEngine.togglePause()}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-colors"
                title="一時停止 (Esc)"
              >
                <Pause size={24} />
              </button>
            </div>
            <div className="w-full bg-neutral-800 rounded-t-3xl p-6 flex justify-between items-center border-b-4 border-neutral-900">
              <div className="flex gap-8 items-center">
                <div className="text-xl">
                  <span className="text-neutral-400 text-sm font-bold block">SCORE</span>
                  <span className="font-dotgothic text-4xl font-bold text-white">{score.toString().padStart(6, '0')}</span>
                </div>
                <div className="text-xl">
                  <span className="text-neutral-400 text-sm font-bold block">MAX KPS</span>
                  <span className="font-dotgothic text-4xl font-bold text-cyan-400">{maxKps.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleStop}
                className="px-8 py-3 bg-red-500 hover:bg-red-400 text-neutral-900 rounded-full font-black transition-colors"
              >
                STOP
              </button>
            </div>

            <div className="w-full bg-neutral-800 border-b-4 border-neutral-900 overflow-hidden h-64">
              <NotesArea />
            </div>

            <div className="w-full bg-neutral-800 rounded-b-3xl p-8 flex flex-col items-center justify-center min-h-[160px] relative">
              {showGuide && (
                <div className="absolute top-4 text-neutral-500 font-bold tracking-widest text-sm transition-opacity duration-1000 opacity-50">
                  遊び方：ノーツが判定枠に重なったら、表示されている最初の文字をタイピングしてください
                </div>
              )}
              <ActiveWordDisplay />
            </div>
          </div>
        )
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
              onClick={() => {
                gameEngine.togglePause();
                handleStop();
                handleBackToMenu();
              }}
              className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-full font-black text-xl transition-colors flex items-center justify-center gap-2"
            >
              演奏を中断 (STOP)
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
      </div>

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

      {showHowToPlay && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowHowToPlay(false);
            }
          }}
        >
          <div className="bg-neutral-800 w-full max-w-xl flex flex-col rounded-3xl border-4 border-neutral-700 overflow-hidden shadow-none my-auto">
            <div className="bg-neutral-900 p-6 flex justify-between items-center border-b-4 border-neutral-700">
              <div className="flex items-center gap-3">
                <HelpCircle className="text-emerald-400" size={32} />
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-widest">遊び方</h2>
                <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                  isMobileMode
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60'
                    : 'bg-purple-500/20 text-purple-300 border-purple-400/60'
                }`}>
                  {isMobileMode ? 'スマホモード（フリック入力）' : 'PCモード（キーボード入力）'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowHowToPlay(false)}
                className="w-12 h-12 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black text-xl flex items-center justify-center transition-colors cursor-pointer shadow-none"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 sm:p-8 flex flex-col gap-5 text-white">
              {isMobileMode ? (
                <>
                  <div className="text-lg sm:text-xl font-black text-cyan-300">
                    スマホモード（フリック入力）の重要ルール
                  </div>
                  <div className="flex flex-col gap-4">
                    {/* ① 判定のタイミング（最重要） */}
                    <div className="bg-neutral-900 p-5 rounded-2xl border-2 border-amber-400/60 flex flex-col gap-2 shadow-none">
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-400 text-neutral-950 text-xs font-black px-2 py-0.5 rounded-md">
                          最重要
                        </span>
                        <span className="text-amber-300 font-black text-base">
                          ① 判定のタイミング
                        </span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
                        キーを押した瞬間ではなく、
                        <span className="inline-block bg-amber-400/25 text-amber-200 border border-amber-400/70 px-1.5 py-0.5 rounded-md font-black mx-0.5">
                          【指を離した瞬間】
                        </span>
                        にタイミング判定されます！
                      </p>
                      <p className="text-xs sm:text-sm font-bold text-neutral-300 leading-relaxed bg-neutral-800 border border-neutral-700 rounded-xl p-3 mt-1">
                        💡 <span className="text-cyan-300 font-black">コツ：</span>早めにキーをタッチしてフリック方向へ指を滑らせておき、
                        <span className="text-amber-200 font-black">ノーツが判定枠に重なる瞬間に指を離す</span>とPERFECTが狙いやすくなります。
                      </p>
                    </div>

                    {/* ② テンキー（フリック）の入力方法 */}
                    <div className="bg-neutral-900 p-5 rounded-2xl border-2 border-cyan-400/60 flex flex-col gap-2 shadow-none">
                      <div className="flex items-center gap-2">
                        <span className="bg-cyan-400 text-neutral-950 text-xs font-black px-2 py-0.5 rounded-md">
                          入力ルール
                        </span>
                        <span className="text-cyan-300 font-black text-base">
                          ② テンキー（フリック）の入力方法
                        </span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
                        画面下のテンキーをタップ・フリックして文字を入力します。
                      </p>
                      <p className="text-xs sm:text-sm font-bold text-neutral-300 leading-relaxed bg-neutral-800 border border-neutral-700 rounded-xl p-3 mt-1">
                        濁点（゛）・半濁点（゜）・小文字（っ・ゃ・ゅ・ょ等）の
                        <span className="inline-block bg-pink-500/25 text-pink-200 border border-pink-400/70 px-1.5 py-0.5 rounded-md font-black mx-0.5">
                          変換は不要
                        </span>
                        です！すべて
                        <span className="text-cyan-300 font-black">元の文字（清音）</span>
                        で入力してください。
                        <span className="block text-amber-200 font-black mt-1">
                          （例：『だ』→『た』、『ぴ』→『ひ』、『っ』→『つ』）
                        </span>
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xl font-bold text-neutral-200">
                    太鼓タイピングの基本ルール（PCモード）
                  </div>
                  <div className="flex flex-col gap-4 text-neutral-300 leading-relaxed font-bold bg-neutral-900 p-6 rounded-2xl border-2 border-neutral-700 shadow-none">
                    <p>1. 画面右から流れてくるノーツが、左側の白い判定枠に重なるタイミングを見極めよう！</p>
                    <p>2. ノーツが判定枠に重なったら、表示されている最初の文字から正確にローマ字タイピング！</p>
                    <p>3. 正確なタイミングで入力すると「PERFECT」！連続コンボを繋げて1,010,000点（All Perfect）を目指そう！</p>
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => setShowHowToPlay(false)}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-black text-xl transition-colors mt-2 cursor-pointer shadow-none"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default App;
