import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { playPerfect, playGood, playMiss } from '../hooks/useSystemSE';
import { Settings, X, Plus, Minus } from 'lucide-react';

export default function SettingsModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('general');
  const [calibrationSound, setCalibrationSound] = useState('perfect'); // 'perfect' | 'good' | 'miss'

  const speedMultiplier = useGameStore(state => state.speedMultiplier);
  const wallAmount = useGameStore(state => state.wallAmount);
  const offsetMs = useGameStore(state => state.offsetMs);
  const showCustomModes = useGameStore(state => state.showCustomModes);

  const setSpeedMultiplier = useGameStore(state => state.setSpeedMultiplier);
  const setWallAmount = useGameStore(state => state.setWallAmount);
  const setOffsetMs = useGameStore(state => state.setOffsetMs);
  const toggleShowCustomModes = useGameStore(state => state.toggleShowCustomModes);

  const handleSpeedSliderChange = (e) => {
    setSpeedMultiplier(parseFloat(parseFloat(e.target.value).toFixed(2)));
  };

  const handleWallChange = (e) => {
    setWallAmount(parseInt(e.target.value));
  };

  const handleOffsetChange = (delta) => {
    setOffsetMs(offsetMs + delta);
  };

  // デモプレビューの制御（useEffectは使わずコールバックrefで開始/停止）
  const demoRef = useRef(null);
  const requestRef = useRef(null);
  // デモループ内で最新の設定値を参照するためのref（再レンダリングでループを再起動しない）
  const demoStateRef = useRef({ offsetMs, speedMultiplier, startTime: 0, lastTick: -1, calibrationSound: 'perfect' });
  demoStateRef.current.offsetMs = offsetMs;
  demoStateRef.current.speedMultiplier = speedMultiplier;
  demoStateRef.current.calibrationSound = calibrationSound;

  const playTick = useCallback(() => {
    if (calibrationSound === 'good') {
      playGood();
    } else if (calibrationSound === 'miss') {
      playMiss();
    } else {
      playPerfect();
    }
  }, [calibrationSound]);

  // コールバックref: デモ領域のDOMがマウントされたら描画ループを開始し、
  // アンマウント（設定画面を閉じた）されたら停止する。useEffectは使用しない。
  const handleDemoRef = useCallback((node) => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    demoRef.current = node;
    if (!node) return;

    demoStateRef.current.startTime = performance.now();
    demoStateRef.current.lastTick = -1;
    const bpm = 120;
    const intervalMs = 60000 / bpm;

    const loop = (time) => {
      const container = demoRef.current;
      if (!container) return;

      const { offsetMs: offset, speedMultiplier: speed, startTime } = demoStateRef.current;
      const elapsed = time - startTime;
      const visualTime = elapsed - offset; // offsetが+ならノーツは遅れて中央に届く
      const currentBeat = Math.floor(elapsed / intervalMs);

      if (currentBeat > demoStateRef.current.lastTick && currentBeat >= 0) {
        demoStateRef.current.lastTick = currentBeat;
        if (demoStateRef.current.calibrationSound === 'good') {
          playGood();
        } else if (demoStateRef.current.calibrationSound === 'miss') {
          playMiss();
        } else {
          playPerfect();
        }
      }

      container.innerHTML = '';

      const width = container.clientWidth;
      const judgeX = width / 2;

      const judgeLine = document.createElement('div');
      judgeLine.className = 'absolute top-0 bottom-0 w-1 bg-white opacity-50 z-0';
      judgeLine.style.left = `${judgeX}px`;
      container.appendChild(judgeLine);

      const noteSpeed = 0.5 * speed;
      for (let i = currentBeat - 1; i <= currentBeat + 3; i++) {
        const targetTime = i * intervalMs;
        const x = judgeX + (targetTime - visualTime) * noteSpeed;

        if (x > -50 && x < width + 50) {
          const note = document.createElement('div');
          note.className = 'absolute top-1/2 -translate-y-1/2 w-12 h-12 bg-orange-500 rounded-full border-2 border-orange-400 z-10';
          note.style.left = `${x}px`;
          note.style.transform = 'translate(-50%, -50%)';
          container.appendChild(note);
        }
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
  }, [playTick]);

  // Escapeキーで閉じる処理（useEffectは使用せずコールバックrefで登録・解除、captureフェーズで確実に捕捉）
  const keyHandlerRef = useRef(null);
  const modalRootRef = useCallback((node) => {
    if (node && !keyHandlerRef.current) {
      const handler = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      };
      window.addEventListener('keydown', handler, true);
      keyHandlerRef.current = handler;
    } else if (!node && keyHandlerRef.current) {
      window.removeEventListener('keydown', keyHandlerRef.current, true);
      keyHandlerRef.current = null;
    }
  }, [onClose]);

  const modalContent = (
    <div
      ref={modalRootRef}
      className="modal-overlay bg-black/80 flex items-center justify-center p-3 sm:p-6 md:p-8 backdrop-blur-sm overflow-y-auto"
      style={{ zIndex: 99999, pointerEvents: 'auto' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-neutral-800 w-full max-w-3xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)] flex flex-col rounded-2xl sm:rounded-3xl border-4 border-neutral-700 overflow-hidden shadow-none my-auto relative z-10"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >

        <div className="bg-neutral-900 p-4 sm:p-6 flex justify-between items-center border-b-4 border-neutral-700 shrink-0 relative z-20">
          <div className="flex items-center gap-3">
            <Settings className="text-neutral-400" size={32} />
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-widest">設定</h2>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="w-11 h-11 sm:w-12 sm:h-12 bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-800 text-white rounded-full font-black text-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 relative z-30 select-none"
            title="設定を閉じる (Esc)"
            aria-label="設定を閉じる"
            style={{ pointerEvents: 'auto' }}
          >
            <X size={24} className="pointer-events-none" />
          </button>
        </div>

        <div className="flex border-b-2 border-neutral-700 shrink-0">
          <button
            type="button"
            className={`flex-1 py-3 sm:py-4 font-black tracking-widest transition-colors cursor-pointer ${activeTab === 'general' ? 'text-cyan-400 border-b-4 border-cyan-400' : 'text-neutral-500 hover:text-neutral-300'}`}
            onClick={() => setActiveTab('general')}
          >
            基本設定
          </button>
          <button
            type="button"
            className={`flex-1 py-3 sm:py-4 font-black tracking-widest transition-colors cursor-pointer ${activeTab === 'sound' ? 'text-orange-400 border-b-4 border-orange-400' : 'text-neutral-500 hover:text-neutral-300'}`}
            onClick={() => {
              setActiveTab('sound');
              playTick();
            }}
          >
            サウンド＆判定
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-8 sm:gap-10 min-h-0">

          {activeTab === 'general' && (
            <>
              <div className="flex flex-col gap-4">
                <div className="text-xl font-black text-cyan-400 tracking-widest">レーン速度</div>
                <div className="text-sm text-neutral-400 font-bold">ノーツが流れる速さを調整します。音楽のテンポや判定時間は変わりません。</div>
                <div className="bg-neutral-900 p-6 rounded-2xl flex flex-col gap-6 border-2 border-neutral-700">
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-black font-dotgothic text-cyan-400 tracking-wider">
                        {speedMultiplier.toFixed(2)}
                      </span>
                      <span className="text-xl font-bold text-neutral-400 font-dotgothic">/ 10.00</span>
                    </div>
                    <div className="text-xs font-bold text-neutral-400 mt-1">
                      {speedMultiplier < 2.5 ? '低速（初心者向け）' : speedMultiplier < 5.0 ? '中速（標準）' : speedMultiplier < 7.5 ? '高速' : '超高速（上級者向け）'}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <input
                      type="range"
                      min="1.00"
                      max="10.00"
                      step="0.01"
                      value={speedMultiplier}
                      onChange={handleSpeedSliderChange}
                      className="w-full h-5 bg-neutral-700 rounded-full appearance-none cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-cyan-400 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-cyan-400 [&::-moz-range-thumb]:cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((speedMultiplier - 1.0) / 9.0) * 100}%, #404040 ${((speedMultiplier - 1.0) / 9.0) * 100}%, #404040 100%)`
                      }}
                    />
                    <div className="flex justify-between items-center text-xs font-bold text-neutral-400 px-1 font-dotgothic">
                      <span>1.00 (非常に遅い)</span>
                      <span>5.50</span>
                      <span>10.00 (非常に速い)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="text-xl font-black text-purple-400 tracking-widest">ウォール (レーン隠し)</div>
                <div className="text-sm text-neutral-400 font-bold">画面右側のノーツ出現位置から指定した割合を隠します。(0=なし, 1000=完全)</div>
                <div className="bg-neutral-900 p-6 rounded-2xl flex flex-col gap-4">
                  <div className="flex justify-between items-center text-white font-dotgothic font-black text-2xl">
                    <span>0</span>
                    <span className="text-4xl text-purple-400">{wallAmount}</span>
                    <span>1000</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    value={wallAmount}
                    onChange={handleWallChange}
                    className="w-full h-4 bg-neutral-700 rounded-full appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="text-xl font-black text-emerald-400 tracking-widest">創作・エディター機能の表示</div>
                <div className="text-sm text-neutral-400 font-bold">ホーム画面に「創作譜面を遊ぶ」「創作譜面を作る」を表示するか設定します。</div>
                <div className="bg-neutral-900 p-6 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold text-lg">エディター・創作モード</div>
                    <div className="text-neutral-500 font-bold text-sm">オフにするとホーム画面がシンプルになります</div>
                  </div>
                  <button
                    onClick={toggleShowCustomModes}
                    className={`px-6 py-3 rounded-full font-black text-lg transition-colors ${
                      showCustomModes
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-900'
                        : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                    }`}
                  >
                    {showCustomModes ? 'ON (表示)' : 'OFF (非表示)'}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'sound' && (
            <>
              <div className="flex flex-col gap-4">
                <div className="text-xl font-black text-orange-400 tracking-widest">判定オフセット</div>
                <div className="text-sm text-neutral-400 font-bold mb-2">リズム音に合わせてノーツが中央の線に重なるように調整してください。</div>

                <div className="flex items-center justify-between bg-neutral-900 p-4 rounded-2xl border-2 border-neutral-700">
                  <div>
                    <div className="text-sm font-bold text-white">判定音テスト (メトロノーム音)</div>
                    <div className="text-xs text-neutral-400">デモで鳴る判定音を切り替えて確認できます</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCalibrationSound('perfect');
                        playPerfect();
                      }}
                      className={`px-4 py-2 rounded-xl font-black text-xs transition-colors ${
                        calibrationSound === 'perfect'
                          ? 'bg-amber-500 text-neutral-900'
                          : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                      }`}
                    >
                      PERFECT音
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCalibrationSound('good');
                        playGood();
                      }}
                      className={`px-4 py-2 rounded-xl font-black text-xs transition-colors ${
                        calibrationSound === 'good'
                          ? 'bg-emerald-500 text-neutral-900'
                          : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                      }`}
                    >
                      GOOD音
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCalibrationSound('miss');
                        playMiss();
                      }}
                      className={`px-4 py-2 rounded-xl font-black text-xs transition-colors ${
                        calibrationSound === 'miss'
                          ? 'bg-rose-500 text-white'
                          : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                      }`}
                    >
                      MISS音
                    </button>
                  </div>
                </div>

                <div className="h-32 bg-neutral-900 rounded-2xl relative overflow-hidden mb-2 border-2 border-neutral-700 cursor-pointer" onClick={playTick}>
                  <div ref={handleDemoRef} className="absolute inset-0" />
                </div>

                <div className="flex items-center justify-center gap-6">
                  <button onClick={() => handleOffsetChange(-5)} className="p-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-2xl transition-colors">
                    <Minus size={24} />
                  </button>
                  <div className="w-48 text-center flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-black font-dotgothic text-white">{offsetMs > 0 ? '+' : ''}{offsetMs}</span>
                    <span className="text-xl font-bold text-neutral-500 font-dotgothic">ms</span>
                  </div>
                  <button onClick={() => handleOffsetChange(5)} className="p-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-2xl transition-colors">
                    <Plus size={24} />
                  </button>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  <button onClick={() => handleOffsetChange(-1)} className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold text-sm transition-colors">-1ms</button>
                  <button onClick={() => handleOffsetChange(1)} className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold text-sm transition-colors">+1ms</button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );

  const portalTarget = typeof document !== 'undefined'
    ? (document.fullscreenElement && document.fullscreenElement !== document.documentElement
        ? document.fullscreenElement
        : document.body)
    : null;

  return portalTarget ? createPortal(modalContent, portalTarget) : modalContent;
}
