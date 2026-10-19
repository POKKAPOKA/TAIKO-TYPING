import { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { gameEngine } from './engine/GameEngine';
import NotesArea from './components/NotesArea';
import EditorView from './components/editor/EditorView';
import ActiveWordDisplay from './components/ActiveWordDisplay';
import Toast from './components/Toast';
import { useSystemSE } from './hooks/useSystemSE';
import { CHARACTERS, getCharacterById } from './config/characters';

import SongSelect from './components/SongSelect';
import Leaderboard from './components/Leaderboard';
import SettingsModal from './components/SettingsModal';
import FlickKeyboard from './components/FlickKeyboard';
import ResultScreen from './components/ResultScreen';
import { fetchRankingsResult, submitScore } from './api/rankings';
import { loadSongs } from './api/songList';
import { Maximize, Minimize, Smartphone, Monitor, User, Settings, Pause, Play, RotateCcw, Home, HelpCircle, X } from 'lucide-react';

// 操作ガイドの自動消去・ボーカリスト歌唱ループをストア購読で行うモジュール（importするだけで有効になる）
import './engine/gameUiSync';

// PCモード限定：背景ステージに舞い散る15個の軽量桜パーティクル設定
const SAKURA_PETALS = [
  { id: 0, left: '6%', delay: '0s', duration: '9s', size: 13 },
  { id: 1, left: '13%', delay: '1.8s', duration: '11s', size: 15 },
  { id: 2, left: '20%', delay: '3.2s', duration: '8.5s', size: 11 },
  { id: 3, left: '27%', delay: '0.7s', duration: '10.2s', size: 14 },
  { id: 4, left: '34%', delay: '4.5s', duration: '9.6s', size: 12 },
  { id: 5, left: '41%', delay: '2.1s', duration: '11.4s', size: 15 },
  { id: 6, left: '48%', delay: '5.3s', duration: '8.8s', size: 12 },
  { id: 7, left: '55%', delay: '1.1s', duration: '10.5s', size: 14 },
  { id: 8, left: '62%', delay: '3.9s', duration: '9.2s', size: 11 },
  { id: 9, left: '69%', delay: '0.4s', duration: '11.8s', size: 15 },
  { id: 10, left: '75%', delay: '2.7s', duration: '9.4s', size: 13 },
  { id: 11, left: '81%', delay: '4.9s', duration: '10.1s', size: 12 },
  { id: 12, left: '87%', delay: '1.5s', duration: '8.9s', size: 14 },
  { id: 13, left: '92%', delay: '3.5s', duration: '10.8s', size: 12 },
  { id: 14, left: '96%', delay: '5.8s', duration: '9.7s', size: 13 },
];

// 初回描画完了後に裏で軽量アセットをキャッシュさせる（初期画面表示を邪魔しないアイドル時プリロード・useEffect不使用）
if (typeof window !== 'undefined') {
  const setupIdlePreload = () => {
    const preloadAssets = [
      './assets/button_6_exit_fullscreen.png',
      './assets/btn_play_v4_perfect.png',
      './assets/btn_ranking.png',
      './assets/btn_random.png',
      './assets/btn_back_menu.png',
      './assets/song_card_frame.png',
      './assets/characters/char_test/sing_1.svg',
      './assets/characters/char_test/sing_2.svg',
      './assets/characters/char_test/miss.svg'
    ];
    const runPreload = () => {
      preloadAssets.forEach((src) => {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
      });
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(runPreload);
    } else {
      setTimeout(runPreload, 500);
    }
  };

  window.addEventListener('load', setupIdlePreload, { once: true });
  if (document.readyState === 'complete') {
    setupIdlePreload();
  }
}

function App() {
  const { playDecide } = useSystemSE();

  const [appMode, setAppMode] = useState('menu'); // 'menu' | 'setup' | 'game' | 'editor' | 'songSelect'
  const [leaderboardData, setLeaderboardData] = useState(null); // { songTitle, promise } | null
  const [songsPromise, setSongsPromise] = useState(null);

  const score = useGameStore(state => state.score);
  const combo = useGameStore(state => state.combo);
  const maxCombo = useGameStore(state => state.maxCombo);
  const perfectCount = useGameStore(state => state.perfectCount);
  const goodCount = useGameStore(state => state.goodCount);
  const missCount = useGameStore(state => state.missCount);
  const status = useGameStore(state => state.status);
  const loadedScore = useGameStore(state => state.loadedScore);
  const audioUrl = useGameStore(state => state.audioUrl);
  const maxKps = useGameStore(state => state.maxKps);
  const scoreFileName = useGameStore(state => state.scoreFileName);
  const audioFileName = useGameStore(state => state.audioFileName);
  const isLocalPlay = useGameStore(state => state.isLocalPlay);
  const vocalState = useGameStore(state => state.vocalState);
  const selectedCharacterId = useGameStore(state => state.selectedCharacterId);
  const setSelectedCharacterId = useGameStore(state => state.setSelectedCharacterId);

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

  const activeCharacter = getCharacterById(selectedCharacterId);
  const isMissState = vocalState === 'miss';
  const currentSongTitle = loadedScore?.title || (scoreFileName ? scoreFileName.replace(/\.json$/i, '') : 'さくら');
  const currentDifficulty = Math.min(10, Math.max(1, Number(loadedScore?.difficulty) || 2));
  const clearGaugePercent = Math.min(100, Math.max(0, (score / 1010000) * 100));
  const clearThresholdPercent = (700000 / 1010000) * 100;
  const isClearReached = score >= 700000;

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
          appMode === 'game' && status !== 'result'
            ? isMobileMode
              ? 'h-[100dvh] p-1.5 sm:p-2'
              : 'h-screen p-2 sm:p-4 md:p-6'
            : appMode === 'menu'
            ? 'h-screen p-0 bg-cover bg-center bg-no-repeat'
            : 'h-screen p-4 sm:p-8'
        }`}
        style={appMode === 'menu' ? { backgroundImage: 'url(./assets/bg_main.jpg)' } : undefined}
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
                  src="./assets/button_5_settings.png"
                  alt="設定"
                  width="56"
                  height="54"
                  decoding="async"
                  fetchPriority="high"
                />
              </button>

              {/* 全画面表示 / 縮小表示ボタン (和風サイバーネオンバッジ) */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="icon-button w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16"
                title={isFullscreen ? "縮小表示（全画面解除）" : "全画面表示"}
                aria-label={isFullscreen ? "縮小表示（全画面解除）" : "全画面表示"}
                style={{ color: '#22d3ee' }}
              >
                <img
                  key={isFullscreen ? 'minimize' : 'fullscreen'}
                  src={isFullscreen ? "./assets/button_6_exit_fullscreen.png" : "./assets/button_6_fullscreen.png"}
                  alt={isFullscreen ? "縮小表示" : "全画面表示"}
                  width="56"
                  height="54"
                  decoding="async"
                  fetchPriority="high"
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
        <div className="z-10 flex flex-col items-center justify-center w-full max-w-3xl h-full gap-6 my-auto">
          <h2
            className="text-3xl sm:text-4xl font-black text-cyan-300 tracking-widest"
            style={{ textShadow: '0 0 12px rgba(0, 245, 255, 0.6)' }}
          >
            キャラクター選択
          </h2>
          <div className="grid grid-cols-1 gap-4 w-full">
            {CHARACTERS.map((char) => {
              const isSelected = char.id === selectedCharacterId;
              return (
                <div
                  key={char.id}
                  onClick={() => {
                    setSelectedCharacterId(char.id);
                    showToast(`ボーカリスト「${char.name}」を選択しました`);
                  }}
                  className={`cyber-glass-panel p-5 flex flex-col sm:flex-row items-center gap-6 cursor-pointer transition-all ${
                    isSelected ? 'border-cyan-300 ring-2 ring-cyan-400/60' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center bg-slate-950/70 p-2 rounded-xl border border-cyan-500/40">
                      <img src={char.sprites.sing_1} alt="sing_1" className="w-20 h-24 object-contain" decoding="async" />
                      <span className="text-[10px] font-bold text-cyan-300 mt-1">通常 (sing_1)</span>
                    </div>
                    <div className="flex flex-col items-center bg-slate-950/70 p-2 rounded-xl border border-pink-500/40">
                      <img src={char.sprites.sing_2} alt="sing_2" className="w-20 h-24 object-contain" decoding="async" />
                      <span className="text-[10px] font-bold text-pink-300 mt-1">熱唱 (sing_2)</span>
                    </div>
                    <div className="flex flex-col items-center bg-slate-950/70 p-2 rounded-xl border border-rose-500/40">
                      <img src={char.sprites.miss} alt="miss" className="w-20 h-24 object-contain" decoding="async" />
                      <span className="text-[10px] font-bold text-rose-300 mt-1">ミス (miss)</span>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-white">{char.name}</span>
                      {isSelected && (
                        <span className="px-2.5 py-0.5 bg-cyan-400 text-slate-950 text-xs font-black rounded-full">
                          選択中
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-purple-200/80 font-bold">{char.description}</p>
                    <p className="text-[11px] text-cyan-300/75 font-bold mt-1">
                      ※本番イラスト完成後は `public/assets/characters/` の画像を差し替えるだけで反映されます。
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setAppMode("menu")}
            className="px-8 py-3 bg-neutral-800 hover:bg-neutral-700 border border-cyan-400/60 text-white rounded-full font-black transition-colors flex items-center gap-2 mt-2 cursor-pointer"
          >
            <Home size={20} />
            戻る
          </button>
        </div>
      )}

      <div className={`flex flex-col items-center w-full h-full ${appMode === 'menu' || (appMode === 'game' && !isMobileMode) ? 'justify-center z-10' : 'z-10'} ${isMobileMode && appMode === 'game' ? 'min-h-0' : ''}`}>
        <h1 className={`text-4xl font-black mb-8 text-orange-400 tracking-wider flex-shrink-0 ${appMode === 'menu' || appMode === 'game' ? 'hidden' : ''}`}>太鼓タイピング</h1>

      {appMode === 'menu' && (
        <div className="w-full max-w-[340px] flex flex-col items-center justify-center gap-4 sm:gap-[18px] md:gap-5 my-auto px-4">
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
              src="./assets/button_1_official.png"
              alt="公式譜面で遊ぶ"
              width="340"
              height="90"
              decoding="async"
              fetchPriority="high"
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
              src="./assets/button_2_howtoplay.png"
              alt="遊び方"
              width="340"
              height="90"
              decoding="async"
              fetchPriority="high"
            />
          </button>

          {/* ボタン3: 「PCモード」 / 「スマホモード」画像ボタン横並び切替（非選択側を暗く表示） */}
          <div
            role="group"
            aria-label="入力モード切替"
            className="w-[calc(100vw-24px)] max-w-[420px] sm:max-w-[480px] grid grid-cols-2 gap-2 sm:gap-3 items-center justify-items-center"
          >
            <button
              type="button"
              aria-pressed={!isMobileMode}
              onClick={() => {
                if (isMobileMode) {
                  playDecide();
                  setIsMobileMode(false);
                  showToast("PCモードに切り替えました");
                }
              }}
              className={`menu-button w-full ${isMobileMode ? 'is-inactive' : ''}`}
              style={{ color: '#c084fc' }}
              title="PCモード（キーボード入力）"
            >
              <img
                src="./assets/button_3_pcmode.png"
                alt="PCモード"
                width="340"
                height="90"
                decoding="async"
                fetchPriority="high"
              />
            </button>

            <button
              type="button"
              aria-pressed={isMobileMode}
              onClick={() => {
                if (!isMobileMode) {
                  playDecide();
                  setIsMobileMode(true);
                  showToast("スマホモードに切り替えました");
                }
              }}
              className={`menu-button w-full ${!isMobileMode ? 'is-inactive' : ''}`}
              style={{ color: '#c084fc' }}
              title="スマホモード（フリック入力）"
            >
              <img
                src="./assets/button_smartphone_mode.png"
                alt="スマホモード"
                width="340"
                height="90"
                decoding="async"
                fetchPriority="high"
              />
            </button>
          </div>

          {/* ボタン4: 「キャラクター選択」 */}
          <button
            type="button"
            onClick={() => setAppMode('characterSelect')}
            className="menu-button w-full"
            style={{ color: '#d946ef' }}
          >
            <img
              src="./assets/button_4_character.png"
              alt="キャラクター選択"
              width="340"
              height="90"
              decoding="async"
              fetchPriority="high"
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
              <div className="text-emerald-300 text-xs font-black border-t border-neutral-700 pt-2">
                🏆 クリア条件：スコア 700,000点（70万点）以上でクリア！（最大1,010,000点）
              </div>
            </div>
          ) : (
            <div className="text-neutral-400 font-bold tracking-widest text-sm text-center bg-neutral-900 p-4 rounded-xl border-2 border-neutral-700 w-full shadow-none flex flex-col gap-1">
              <div>遊び方：ノーツが判定枠に重なったら、表示されている最初の文字をタイピングしてください</div>
              <div className="text-emerald-400 text-xs font-black">🏆 スコア 700,000点（70万点）以上でクリア！（最大1,010,000点）</div>
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
          /* =========================================================
             スマホモード：和風サイバーライブステージ＆下部レーン＋テンキードッキング
             ========================================================= */
          <div className="w-full h-full flex flex-col justify-between items-center min-h-0 max-w-lg relative overflow-hidden rounded-2xl border border-cyan-500/40 bg-[#08051a]">
            {/* 背景ライブステージ層（ミス発生時は .is-miss で暗転） */}
            <div
              className={`game-stage-bg absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0 ${isMissState ? 'is-miss' : ''}`}
              style={{ backgroundImage: 'url(./assets/bg_main.jpg)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-[#090418]/75 via-[#12072b]/35 to-[#060312]/90" />
            </div>

            {/* 1. 【上部】コンパクトヘッダー（曲名・★・クリアゲージ・SCORE・ポーズを省スペース集約、MAX KPS＆判定内訳は非表示） */}
            <div className="cyber-glass-panel w-full px-3 py-2 flex flex-col gap-1.5 flex-shrink-0 relative z-20">
              <div className="w-full flex justify-between items-center gap-2">
                <div className="flex flex-col min-w-0">
                  <div
                    className="text-sm sm:text-base font-black text-white truncate"
                    style={{ textShadow: '0 0 8px rgba(0, 245, 255, 0.5)' }}
                  >
                    {currentSongTitle}
                  </div>
                  <div className="text-[11px] leading-none tracking-tight">
                    {Array.from({ length: 10 }, (_, idx) => (
                      <span key={idx} className={idx < currentDifficulty ? 'star-lit' : 'star-unlit'}>
                        {idx < currentDifficulty ? '★' : '☆'}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-baseline gap-1.5 flex-shrink-0">
                  <span className="text-cyan-300 text-xs font-black tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                    SCORE
                  </span>
                  <span className="orbitron-digital text-2xl sm:text-3xl font-black tracking-wider">
                    {Math.round(score).toString().padStart(6, '0')}
                  </span>
                </div>
              </div>

              <div className="w-full flex items-center justify-between gap-2.5">
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="flex justify-between items-center text-[9px] font-black tracking-widest text-cyan-200/80">
                    <span>CLEAR GAUGE</span>
                    <span className={isClearReached ? 'text-yellow-300' : 'text-purple-200/70'}>
                      {isClearReached ? 'CLEAR!!' : 'CLEAR 700,000'}
                    </span>
                  </div>
                  <div className="clear-gauge-track w-full h-2.5">
                    <div
                      className="clear-gauge-fill"
                      style={{ width: `${clearGaugePercent}%` }}
                    />
                    {/* 700,000点 クリア境界ライン */}
                    <div
                      className="absolute -top-1 -bottom-1 w-[3px] bg-yellow-300 rounded-full z-10"
                      style={{
                        left: `${clearThresholdPercent}%`,
                        boxShadow: '0 0 8px #fde047, 0 0 14px #facc15'
                      }}
                      title="クリアライン (700,000点)"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => gameEngine.togglePause()}
                  className="px-3 py-1 bg-slate-900/90 hover:bg-slate-800 border border-cyan-400/70 text-cyan-100 rounded-full font-black text-xs flex items-center gap-1 transition-colors flex-shrink-0 cursor-pointer"
                  title="一時停止"
                >
                  <Pause size={13} />
                  <span>ポーズ</span>
                </button>
              </div>
            </div>

            {/* 2. 【中央〜下部】ボーカリストステージ ＆ 下部サイバーノーツレーン ＋ ローマ字表示 */}
            <div className="flex-1 w-full flex flex-col justify-between items-center min-h-0 relative z-10 px-1 pt-1">
              {/* 中央ボーカリストキャラクター立ち絵（3表情をプリマウント切替で0ms即応） */}
              <div className="flex-1 w-full flex items-center justify-center min-h-0 relative overflow-hidden">
                <div className={`relative h-full max-h-[220px] aspect-[420/520] flex items-center justify-center ${isMissState ? 'vocalist-miss' : 'vocalist-sing'}`}>
                  <img
                    src={activeCharacter.sprites.sing_1}
                    alt={`${activeCharacter.name} sing_1`}
                    decoding="async"
                    className={`absolute inset-0 w-full h-full object-contain transition-none ${vocalState === 'sing_1' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  />
                  <img
                    src={activeCharacter.sprites.sing_2}
                    alt={`${activeCharacter.name} sing_2`}
                    decoding="async"
                    className={`absolute inset-0 w-full h-full object-contain transition-none ${vocalState === 'sing_2' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  />
                  <img
                    src={activeCharacter.sprites.miss}
                    alt={`${activeCharacter.name} miss`}
                    decoding="async"
                    className={`absolute inset-0 w-full h-full object-contain transition-none ${vocalState === 'miss' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  />
                </div>
              </div>

              {/* 下部ノーツレーン（縦棒判定ライン＆上外側リアルタイム判定） */}
              <div className="w-full flex-shrink-0">
                <NotesArea />
              </div>

              {/* タイピング文字表示（大きな白文字＋シアンネオンアンダーライン） */}
              <div className="w-full py-1.5 flex items-center justify-center flex-shrink-0 min-h-[48px]">
                <ActiveWordDisplay />
              </div>
            </div>

            {/* 3. 【最下部】ドッキングされたフリックキーボード */}
            <div className="w-full relative z-20 flex-shrink-0">
              <FlickKeyboard />
            </div>
          </div>
        ) : (
          /* =========================================================
             PCモード：和風サイバーネオン・ライブステージ＆下部レーン型（候補A）
             ========================================================= */
          <div className="w-full max-w-6xl h-full max-h-[820px] relative flex flex-col justify-between p-4 sm:p-6 md:p-7 rounded-3xl border-2 border-cyan-400/70 overflow-hidden my-auto bg-[#070417]"
            style={{
              boxShadow: '0 0 28px rgba(0, 245, 255, 0.25), inset 0 0 32px rgba(217, 70, 239, 0.18)'
            }}
          >
            {/* 背景ライブステージ層（ミス発生時は .is-miss で暗転＆エフェクト停止） */}
            <div
              className={`game-stage-bg absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0 ${isMissState ? 'is-miss' : ''}`}
              style={{ backgroundImage: 'url(./assets/bg_main.jpg)' }}
            >
              {/* ステージ照明グラデーションオーバーレイ */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#09041a]/65 via-[#13072e]/25 to-[#060312]/90" />

              {/* PCモード限定：ゆっくり揺れるネオンレーザー光 */}
              <div className="stage-laser-beam laser-left-1" />
              <div className="stage-laser-beam laser-left-2" />
              <div className="stage-laser-beam laser-right-1" />
              <div className="stage-laser-beam laser-right-2" />

              {/* PCモード限定：舞い散る15枚の桜の花びらパーティクル */}
              {SAKURA_PETALS.map((petal) => (
                <div
                  key={petal.id}
                  className="sakura-petal"
                  style={{
                    left: petal.left,
                    width: `${petal.size}px`,
                    height: `${Math.round(petal.size * 0.72)}px`,
                    animationDelay: petal.delay,
                    animationDuration: petal.duration
                  }}
                />
              ))}
            </div>

            {/* 1. 【上部】左上パネル（楽曲情報＆クリアゲージ） ＆ 右上パネル（SCORE / MAX KPS / ポーズ） */}
            <div className="w-full flex flex-wrap justify-between items-start gap-3 relative z-20">
              {/* 左上パネル：曲名・難易度（★）・横型クリアゲージ */}
              <div className="cyber-glass-panel px-5 py-3.5 min-w-[260px] sm:min-w-[320px] flex flex-col gap-1.5">
                <div
                  className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-wider truncate"
                  style={{ textShadow: '0 0 12px rgba(0, 245, 255, 0.65)' }}
                >
                  {currentSongTitle}
                </div>
                <div className="text-sm sm:text-base tracking-wider leading-none">
                  {Array.from({ length: 10 }, (_, idx) => (
                    <span key={idx} className={idx < currentDifficulty ? 'star-lit' : 'star-unlit'}>
                      {idx < currentDifficulty ? '★' : '☆'}
                    </span>
                  ))}
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  <div className="clear-gauge-track w-full h-3.5">
                    <div
                      className="clear-gauge-fill"
                      style={{ width: `${clearGaugePercent}%` }}
                    />
                    {/* 700,000点 クリアライン */}
                    <div
                      className="absolute -top-1 -bottom-1 w-[3px] bg-yellow-300 rounded-full z-10"
                      style={{
                        left: `${clearThresholdPercent}%`,
                        boxShadow: '0 0 8px #fde047, 0 0 14px #facc15'
                      }}
                      title="クリアライン (700,000点)"
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-black tracking-widest">
                    <span className="text-amber-200/90" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                      CLEAR GAUGE
                    </span>
                    <span className={isClearReached ? 'text-emerald-300' : 'text-cyan-200/75'}>
                      {isClearReached ? 'CLEAR REACHED!!' : 'CLEAR LINE: 700,000'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 右上パネル：OrbitronデジタルSCORE ＆ MAX KPS ＆ ポーズボタン */}
              <div className="flex flex-col items-end gap-2">
                <div className="cyber-glass-panel px-5 py-3 flex flex-col items-end gap-1">
                  <div className="flex items-baseline gap-3">
                    <span
                      className="text-cyan-300 text-sm sm:text-base font-black tracking-widest"
                      style={{ fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 8px rgba(0, 245, 255, 0.5)' }}
                    >
                      SCORE
                    </span>
                    <span className="orbitron-digital text-3xl sm:text-4xl md:text-5xl font-black tracking-wider leading-none">
                      {Math.round(score).toString().padStart(6, '0')}
                    </span>
                  </div>
                  {/* MAX KPS（スマホ幅 768px 以下では .pc-only-hud により自動非表示） */}
                  <div className="pc-only-hud flex items-baseline gap-3 border-t border-cyan-500/30 pt-1 w-full justify-end">
                    <span
                      className="text-amber-300 text-xs sm:text-sm font-black tracking-widest"
                      style={{ fontFamily: "'Orbitron', sans-serif" }}
                    >
                      MAX KPS
                    </span>
                    <span className="orbitron-digital text-xl sm:text-2xl font-black tracking-wider leading-none">
                      {maxKps.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => gameEngine.togglePause()}
                  className="px-5 py-2 bg-slate-950/85 hover:bg-slate-900 border-2 border-cyan-400/75 text-cyan-100 rounded-full font-black text-sm flex items-center gap-2 transition-colors cursor-pointer"
                  style={{ boxShadow: '0 0 12px rgba(0, 245, 255, 0.35)' }}
                  title="一時停止 (Esc)"
                  aria-label="一時停止"
                >
                  <Pause size={16} />
                  <span>ポーズ</span>
                </button>
              </div>
            </div>

            {/* 2. 【中央ステージ】ボーカリストキャラクター立ち絵（中央配置） ＆ 左下判定内訳カウンター */}
            <div className="flex-1 w-full relative flex items-center justify-center min-h-0 z-10 my-1">
              {/* 左下パネル：リアルタイム判定内訳記録（PC版 769px 以上のみ表示） */}
              <div
                className="pc-only-hud cyber-glass-panel absolute left-0 bottom-2 px-4 py-3 flex flex-col gap-1 min-w-[165px] z-20"
                style={{ fontFamily: "'Orbitron', monospace", fontVariantNumeric: 'tabular-nums' }}
              >
                <div className="flex justify-between items-center text-xs font-black">
                  <span className="text-yellow-300 tracking-wider">PERFECT:</span>
                  <span className="text-white text-sm">{perfectCount}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-black">
                  <span className="text-cyan-300 tracking-wider">GOOD:</span>
                  <span className="text-white text-sm">{goodCount}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-black">
                  <span className="text-rose-400 tracking-wider">MISS:</span>
                  <span className="text-white text-sm">{missCount}</span>
                </div>
              </div>

              {/* 中央ボーカリストキャラクター（sing_1 / sing_2 / miss 即時切替） */}
              <div className={`relative h-full max-h-[340px] aspect-[420/520] flex items-center justify-center ${isMissState ? 'vocalist-miss' : 'vocalist-sing'}`}>
                <img
                  src={activeCharacter.sprites.sing_1}
                  alt={`${activeCharacter.name} sing_1`}
                  decoding="async"
                  className={`absolute inset-0 w-full h-full object-contain transition-none ${vocalState === 'sing_1' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                />
                <img
                  src={activeCharacter.sprites.sing_2}
                  alt={`${activeCharacter.name} sing_2`}
                  decoding="async"
                  className={`absolute inset-0 w-full h-full object-contain transition-none ${vocalState === 'sing_2' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                />
                <img
                  src={activeCharacter.sprites.miss}
                  alt={`${activeCharacter.name} miss`}
                  decoding="async"
                  className={`absolute inset-0 w-full h-full object-contain transition-none ${vocalState === 'miss' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                />
              </div>
            </div>

            {/* 3. 【下部】半透明サイバーガラスレーン（シアン縦棒判定ライン）＆ ローマ字表示 */}
            <div className="w-full flex flex-col items-center gap-2 relative z-20 flex-shrink-0">
              <NotesArea />
              <div className="w-full py-1.5 flex items-center justify-center min-h-[68px]">
                <ActiveWordDisplay />
              </div>
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

                    {/* ③ クリア条件（目標スコア） */}
                    <div className="bg-neutral-900 p-5 rounded-2xl border-2 border-emerald-400/60 flex flex-col gap-2 shadow-none">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-400 text-neutral-950 text-xs font-black px-2 py-0.5 rounded-md">
                          クリア条件
                        </span>
                        <span className="text-emerald-300 font-black text-base">
                          ③ 目標スコア
                        </span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
                        <span className="inline-block bg-emerald-500/25 text-emerald-200 border border-emerald-400/70 px-2 py-0.5 rounded-md font-black mr-1">
                          スコア 700,000点（70万点）以上でクリア！
                        </span>
                        <span className="text-neutral-300 text-xs sm:text-sm font-black">
                          （最大1,010,000点）
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
                    <p>3. 正確なタイミングで入力すると「PERFECT」！連続コンボを繋げてハイスコアを目指そう！</p>
                  </div>
                  {/* クリア条件（目標スコア） */}
                  <div className="bg-neutral-900 p-5 rounded-2xl border-2 border-emerald-400/60 flex flex-col gap-2 shadow-none">
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-400 text-neutral-950 text-xs font-black px-2 py-0.5 rounded-md">
                        クリア条件
                      </span>
                      <span className="text-emerald-300 font-black text-base">
                        目標スコア
                      </span>
                    </div>
                    <p className="text-base font-bold text-white leading-relaxed">
                      <span className="inline-block bg-emerald-500/25 text-emerald-200 border border-emerald-400/70 px-2 py-0.5 rounded-md font-black mr-1">
                        スコア 700,000点（70万点）以上でクリア！
                      </span>
                      <span className="text-neutral-300 text-sm font-black">
                        （最大1,010,000点）
                      </span>
                    </p>
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
