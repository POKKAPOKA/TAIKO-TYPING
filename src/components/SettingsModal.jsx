import React, { useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { Settings, X, Plus, Minus } from 'lucide-react';

export default function SettingsModal({ onClose }) {
  const speedMultiplier = useGameStore(state => state.speedMultiplier);
  const wallAmount = useGameStore(state => state.wallAmount);
  const offsetMs = useGameStore(state => state.offsetMs);

  const setSpeedMultiplier = useGameStore(state => state.setSpeedMultiplier);
  const setWallAmount = useGameStore(state => state.setWallAmount);
  const setOffsetMs = useGameStore(state => state.setOffsetMs);

  const handleSpeedChange = (delta) => {
    let newVal = speedMultiplier + delta;
    if (newVal < 1.0) newVal = 1.0;
    if (newVal > 10.0) newVal = 10.0;
    setSpeedMultiplier(parseFloat(newVal.toFixed(2)));
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
  const audioCtxRef = useRef(null);
  // デモループ内で最新の設定値を参照するためのref（再レンダリングでループを再起動しない）
  const demoStateRef = useRef({ offsetMs, speedMultiplier, startTime: 0, lastTick: -1 });
  demoStateRef.current.offsetMs = offsetMs;
  demoStateRef.current.speedMultiplier = speedMultiplier;

  const playTick = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.warn("Audio play failed in settings demo:", e);
    }
  }, []);

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
        playTick();
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

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-8 backdrop-blur-sm">
      <div className="bg-neutral-800 w-full max-w-3xl max-h-full flex flex-col rounded-3xl border-4 border-neutral-700 overflow-hidden shadow-none">

        <div className="bg-neutral-900 p-6 flex justify-between items-center border-b-4 border-neutral-700">
          <div className="flex items-center gap-3">
            <Settings className="text-neutral-400" size={32} />
            <h2 className="text-3xl font-black text-white tracking-widest">設定</h2>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black text-xl flex items-center justify-center transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-10">

          <div className="flex flex-col gap-4">
            <div className="text-xl font-black text-cyan-400 tracking-widest">ハイスピード (倍速)</div>
            <div className="text-sm text-neutral-400 font-bold mb-2">ノーツのスクロール速度を変更します。音楽のテンポは変わりません。</div>
            <div className="flex items-center justify-center gap-6 bg-neutral-900 p-6 rounded-2xl">
              <button onClick={() => handleSpeedChange(-0.1)} className="p-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-2xl transition-colors">
                <Minus size={24} />
              </button>
              <div className="w-48 text-center flex items-baseline justify-center gap-1">
                <span className="text-6xl font-black font-mono text-white">{speedMultiplier.toFixed(2)}</span>
                <span className="text-xl font-bold text-neutral-500">x</span>
              </div>
              <button onClick={() => handleSpeedChange(0.1)} className="p-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-2xl transition-colors">
                <Plus size={24} />
              </button>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <button onClick={() => handleSpeedChange(-0.01)} className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold text-sm transition-colors">-0.01</button>
              <button onClick={() => handleSpeedChange(0.01)} className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold text-sm transition-colors">+0.01</button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="text-xl font-black text-purple-400 tracking-widest">ウォール (レーン隠し)</div>
            <div className="text-sm text-neutral-400 font-bold">画面右側のノーツ出現位置から指定した割合を隠します。(0=なし, 1000=完全)</div>
            <div className="bg-neutral-900 p-6 rounded-2xl flex flex-col gap-4">
              <div className="flex justify-between items-center text-white font-mono font-black text-2xl">
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
            <div className="text-xl font-black text-orange-400 tracking-widest">判定オフセット</div>
            <div className="text-sm text-neutral-400 font-bold mb-2">リズム音に合わせてノーツが中央の線に重なるように調整してください。</div>

            <div className="h-32 bg-neutral-900 rounded-2xl relative overflow-hidden mb-2 border-2 border-neutral-700 cursor-pointer" onClick={playTick}>
              <div ref={handleDemoRef} className="absolute inset-0" />
            </div>

            <div className="flex items-center justify-center gap-6">
              <button onClick={() => handleOffsetChange(-5)} className="p-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-2xl transition-colors">
                <Minus size={24} />
              </button>
              <div className="w-48 text-center flex items-baseline justify-center gap-1">
                <span className="text-5xl font-black font-mono text-white">{offsetMs > 0 ? '+' : ''}{offsetMs}</span>
                <span className="text-xl font-bold text-neutral-500">ms</span>
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

        </div>
      </div>
    </div>
  );
}
