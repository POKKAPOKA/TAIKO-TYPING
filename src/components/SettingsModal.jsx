import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { gameEngine } from '../engine/GameEngine';
import { playPerfect, playGood, playMiss } from '../hooks/useSystemSE';
import { X, Plus, Minus, RotateCcw, Keyboard } from 'lucide-react';

const JUDGE_WINDOW = {
  PERFECT: 50,
  GOOD: 100
};

// 四隅のL字型コーナーブラケット装飾（フラットデザイン・角丸対応）
function MechCornerBrackets({ color = 'amber' }) {
  const colorMap = {
    amber: 'border-amber-500',
    crimson: 'border-rose-500',
    cyan: 'border-cyan-400',
    purple: 'border-purple-400',
    emerald: 'border-emerald-400'
  };
  const borderClass = colorMap[color] || colorMap.amber;

  return (
    <div className="pointer-events-none absolute inset-1.5 z-20">
      <div className={`absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 rounded-tl-md ${borderClass}`} />
      <div className={`absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 rounded-tr-md ${borderClass}`} />
      <div className={`absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 rounded-bl-md ${borderClass}`} />
      <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 rounded-br-md ${borderClass}`} />
    </div>
  );
}

// セグメントゲージ＋目盛り（ティックマーク）コンポーネント
// スライダーのツマミ中心移動範囲（左端 13px 〜 右端 100%-13px）と完全一致させるため px-[11px] を適用
function MechSegmentedBar({ ratio, segments = 28, activeColor = 'cyan', standardIndex = -1 }) {
  const maxIdx = segments - 1;
  const currentIdx = Math.round(Math.max(0, Math.min(1, ratio)) * maxIdx);
  const colorClasses = {
    cyan: 'bg-cyan-400 border-cyan-300',
    purple: 'bg-purple-400 border-purple-300',
    amber: 'bg-amber-400 border-amber-300'
  };
  const litClass = colorClasses[activeColor] || colorClasses.cyan;

  return (
    <div className="flex items-end justify-between gap-1 w-full h-5 px-[11px] select-none" aria-hidden="true">
      {Array.from({ length: segments }).map((_, idx) => {
        const isLit = ratio > 0 && idx <= currentIdx;
        const isStandard = idx === standardIndex;
        const isMajorTick = idx === 0 || idx === standardIndex || idx === maxIdx || idx % 3 === 0;
        const heightClass = isStandard ? 'h-5' : isMajorTick ? 'h-4' : 'h-2.5';

        return (
          <div
            key={idx}
            className={`flex-1 rounded-[2px] border transition-colors ${heightClass} ${
              isStandard && isLit
                ? 'bg-amber-400 border-amber-200'
                : isStandard
                  ? 'bg-amber-500/35 border-amber-400/80'
                  : isLit
                    ? litClass
                    : 'bg-[#171326] border-[#2c2442]'
            }`}
          />
        );
      })}
    </div>
  );
}

export default function SettingsModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('general');
  const [calibrationSound, setCalibrationSound] = useState('perfect'); // 'perfect' | 'good' | 'miss'
  const [demoJudgment, setDemoJudgment] = useState(null); // { judgment, diffMs, timingType, count }

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

  const handleSpeedStep = (delta) => {
    const current = useGameStore.getState().speedMultiplier;
    const next = Math.min(10.0, Math.max(1.0, parseFloat((current + delta).toFixed(2))));
    setSpeedMultiplier(next);
  };

  const handleWallChange = (e) => {
    setWallAmount(parseInt(e.target.value, 10));
  };

  const handleOffsetChange = (delta) => {
    setOffsetMs(offsetMs + delta);
  };

  // デモプレビューの制御（useEffectは使わずコールバックrefで開始/停止）
  const demoRef = useRef(null);
  const requestRef = useRef(null);
  // デモループおよびキー入力ハンドラ内で最新の設定値を参照するためのref
  const demoStateRef = useRef({
    offsetMs,
    speedMultiplier,
    startTime: 0,
    lastTick: -1,
    lastHitBeat: -999,
    lastHitTime: -9999,
    calibrationSound: 'perfect',
    activeTab: 'general',
    onHit: null
  });
  demoStateRef.current.offsetMs = offsetMs;
  demoStateRef.current.speedMultiplier = speedMultiplier;
  demoStateRef.current.calibrationSound = calibrationSound;
  demoStateRef.current.activeTab = activeTab;

  const playTick = useCallback(() => {
    if (calibrationSound === 'good') {
      playGood();
    } else if (calibrationSound === 'miss') {
      playMiss();
    } else {
      playPerfect();
    }
  }, [calibrationSound]);

  // デモ画面での打鍵・タップ判定処理（オフセット値とリズム周期からズレを算出し、判定表示＆SE再生）
  const handleDemoHit = useCallback(() => {
    const now = performance.now();
    const { startTime, offsetMs: currentOffset } = demoStateRef.current;
    if (!startTime) return;

    const bpm = 120;
    const intervalMs = 60000 / bpm; // 500ms周期
    const elapsed = now - startTime;
    const adjustedTime = elapsed - currentOffset;

    const nearestBeat = Math.round(adjustedTime / intervalMs);
    const targetTime = nearestBeat * intervalMs;
    const diffMs = Math.round(adjustedTime - targetTime); // 負＝FAST（早ズレ）、正＝LATE（遅ズレ）
    const absDiff = Math.abs(diffMs);

    let judgment = 'MISS';
    if (absDiff <= JUDGE_WINDOW.PERFECT) {
      judgment = 'PERFECT';
      playPerfect();
    } else if (absDiff <= JUDGE_WINDOW.GOOD) {
      judgment = 'GOOD';
      playGood();
    } else {
      judgment = 'MISS';
      playMiss();
    }

    const timingType = diffMs < 0 ? 'FAST' : diffMs > 0 ? 'LATE' : 'JUST';

    demoStateRef.current.lastHitBeat = nearestBeat;
    demoStateRef.current.lastHitTime = now;

    setDemoJudgment((prev) => ({
      judgment,
      diffMs,
      timingType,
      count: (prev?.count || 0) + 1
    }));
  }, []);

  demoStateRef.current.onHit = handleDemoHit;

  // コールバックref: デモ領域のDOMがマウントされたら描画ループを開始し、
  // アンマウントされたら停止する。useEffectは使用しない。
  const handleDemoRef = useCallback((node) => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    demoRef.current = node;
    if (!node) return;

    demoStateRef.current.startTime = performance.now();
    demoStateRef.current.lastTick = -1;
    demoStateRef.current.lastHitBeat = -999;
    const bpm = 120;
    const intervalMs = 60000 / bpm;

    const loop = (time) => {
      const container = demoRef.current;
      if (!container) return;

      const {
        offsetMs: offset,
        speedMultiplier: speed,
        startTime,
        lastHitBeat,
        lastHitTime
      } = demoStateRef.current;

      const elapsed = time - startTime;
      const visualTime = elapsed - offset; // offsetが+ならノーツは遅れて中央に届く
      const currentBeat = Math.floor(elapsed / intervalMs);

      if (currentBeat > demoStateRef.current.lastTick && currentBeat >= 0) {
        demoStateRef.current.lastTick = currentBeat;
        // ユーザーが直前にその拍を叩いたばかりでないときだけメトロノームガイド音を鳴らす
        if (lastHitBeat !== currentBeat && time - lastHitTime > 90) {
          if (demoStateRef.current.calibrationSound === 'good') {
            playGood();
          } else if (demoStateRef.current.calibrationSound === 'miss') {
            playMiss();
          } else {
            playPerfect();
          }
        }
      }

      container.innerHTML = '';

      const width = container.clientWidth;
      const judgeX = width / 2;

      // 中央の基準ラインと±50ms/±100msの目盛りガイドを描画
      const effectiveSpeed = gameEngine.getEffectiveSpeedMultiplier(speed);
      const noteSpeed = 0.5 * effectiveSpeed;

      [-100, -50, 50, 100].forEach((msOffset) => {
        const markerX = judgeX + msOffset * noteSpeed;
        if (markerX > 16 && markerX < width - 16) {
          const tick = document.createElement('div');
          tick.className = Math.abs(msOffset) === 50
            ? 'absolute top-3 bottom-3 w-[1px] bg-amber-400/35 z-0 pointer-events-none'
            : 'absolute top-5 bottom-5 w-[1px] bg-cyan-400/25 z-0 pointer-events-none';
          tick.style.left = `${markerX}px`;
          container.appendChild(tick);
        }
      });

      const isHitFlash = time - lastHitTime < 140;
      const judgeLine = document.createElement('div');
      judgeLine.className = isHitFlash
        ? 'absolute top-0 bottom-0 w-1.5 bg-amber-300 z-10 pointer-events-none'
        : 'absolute top-0 bottom-0 w-1 bg-cyan-400 z-10 pointer-events-none';
      judgeLine.style.left = `${judgeX}px`;
      judgeLine.style.transform = 'translateX(-50%)';
      container.appendChild(judgeLine);

      // ターゲットリング（中央）
      const targetRing = document.createElement('div');
      targetRing.className = isHitFlash
        ? 'absolute top-1/2 w-12 h-12 rounded-xl border-2 border-amber-300 bg-amber-400/15 z-10 pointer-events-none'
        : 'absolute top-1/2 w-11 h-11 rounded-xl border-2 border-cyan-400/70 bg-[#0d0a18]/60 z-10 pointer-events-none';
      targetRing.style.left = `${judgeX}px`;
      targetRing.style.transform = 'translate(-50%, -50%) rotate(45deg)';
      container.appendChild(targetRing);

      for (let i = currentBeat - 2; i <= currentBeat + 6; i++) {
        const targetTime = i * intervalMs;
        const x = judgeX + (targetTime - visualTime) * noteSpeed;

        if (x > -50 && x < width + 50) {
          const isAlreadyHit = i === lastHitBeat;
          const note = document.createElement('div');
          note.className = isAlreadyHit
            ? 'absolute top-1/2 w-10 h-10 bg-amber-400/30 rounded-full border-2 border-amber-300 z-20 flex items-center justify-center font-dotgothic text-xs font-black text-amber-200 pointer-events-none'
            : 'absolute top-1/2 w-11 h-11 bg-rose-600 rounded-full border-2 border-amber-300 z-20 flex items-center justify-center font-dotgothic text-xs font-black text-white pointer-events-none';
          note.style.left = `${x}px`;
          note.style.transform = 'translate(-50%, -50%)';
          note.textContent = 'ドン';
          container.appendChild(note);
        }
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
  }, []);

  // キー入力処理（Escapeで閉じる、サウンド＆判定タブ表示中はスペースや文字キーでデモ判定を実行）
  // useEffectは使用せずコールバックrefで登録・解除、captureフェーズで確実に捕捉
  const keyHandlerRef = useRef(null);
  const modalRootRef = useCallback((node) => {
    if (node && !keyHandlerRef.current) {
      const handler = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }

        if (demoStateRef.current.activeTab === 'sound') {
          if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
          const isHitKey =
            e.key === ' ' ||
            e.code === 'Space' ||
            e.key === 'Enter' ||
            /^[a-zA-Z0-9\-]$/.test(e.key);

          if (isHitKey) {
            e.preventDefault();
            e.stopPropagation();
            if (demoStateRef.current.onHit) {
              demoStateRef.current.onHit();
            }
          }
        }
      };
      window.addEventListener('keydown', handler, true);
      keyHandlerRef.current = handler;
    } else if (!node && keyHandlerRef.current) {
      window.removeEventListener('keydown', keyHandlerRef.current, true);
      keyHandlerRef.current = null;
    }
  }, [onClose]);

  const speedRatio = (speedMultiplier - 1.0) / 9.0;
  const wallRatio = wallAmount / 1000;

  const getSpeedCategoryLabel = (spd) => {
    if (spd < 2.5) return '低速 // SLOW MODE（初心者向け）';
    if (spd < 3.8) return 'やや低速 // MILD SLOW';
    if (spd <= 4.2) return '標準速度 // STANDARD（基準 4.00）';
    if (spd < 7.0) return '高速 // HIGH SPEED';
    return '超高速 // OVERDRIVE（上級者向け）';
  };

  const modalContent = (
    <div
      ref={modalRootRef}
      className="modal-overlay bg-black/85 flex items-center justify-center p-2.5 sm:p-5 md:p-8 overflow-y-auto mech-scrollbar"
      style={{ zIndex: 99999, pointerEvents: 'auto' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* 外枠：二重枠線（琥珀金×朱色）＋四隅ブラケット＋漆黒メカニカルグリッド */}
      <div
        className="mech-grid-bg w-full max-w-3xl max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2.5rem)] md:max-h-[calc(100vh-4rem)] flex flex-col rounded-2xl sm:rounded-3xl border-2 border-amber-500/80 p-1 sm:p-1.5 overflow-hidden shadow-none my-auto relative z-10"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <MechCornerBrackets color="amber" />

        {/* 内側フレーム（二重枠線の内枠） */}
        <div className="flex flex-col flex-1 min-h-0 rounded-xl sm:rounded-2xl border-2 border-rose-600/45 bg-[#0b0912]/95 overflow-hidden">

          {/* ヘッダーパネル：計器盤タイトル＆ステータス装飾 */}
          <div className="bg-[#120e1f] px-4 py-3.5 sm:px-6 sm:py-4 flex justify-between items-center border-b-2 border-amber-500/50 shrink-0 relative z-20">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-dotgothic font-bold tracking-widest text-amber-400 bg-amber-500/15 border border-amber-500/50 px-2 py-0.5 rounded">
                  SYS-CFG // 弐式計器盤
                </span>
                <span className="hidden sm:inline-block text-[10px] font-dotgothic text-cyan-400/80 tracking-widest">
                  MIYABI-MECH v1.0
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-widest font-dotgothic mt-0.5">
                環境設定・メンテナンス
              </h2>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="w-10 h-10 sm:w-11 sm:h-11 bg-[#1c162e] hover:bg-rose-600 active:bg-rose-700 text-amber-300 hover:text-white rounded-xl border-2 border-amber-500/60 hover:border-rose-300 font-black text-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 relative z-30 select-none"
              title="設定を閉じる (Esc)"
              aria-label="設定を閉じる"
              style={{ pointerEvents: 'auto' }}
            >
              <X size={22} className="pointer-events-none" />
            </button>
          </div>

          {/* タブ切替バー（メカニカルスイッチ型） */}
          <div className="grid grid-cols-2 bg-[#0e0b18] border-b-2 border-[#2a223e] p-1.5 gap-1.5 shrink-0">
            <button
              type="button"
              className={`py-2.5 sm:py-3 px-3 rounded-xl font-black tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2 border-2 font-dotgothic text-sm sm:text-base ${
                activeTab === 'general'
                  ? 'bg-[#19142b] text-cyan-300 border-cyan-400'
                  : 'bg-[#110e1c] text-neutral-400 border-transparent hover:text-neutral-200 hover:border-[#2e2644]'
              }`}
              onClick={() => setActiveTab('general')}
            >
              <span className={`w-2.5 h-2.5 rounded-xs ${activeTab === 'general' ? 'bg-cyan-400' : 'bg-neutral-600'}`} />
              <span>基本設定</span>
              <span className="hidden sm:inline text-[10px] text-amber-400/80 font-normal">[UNIT-01]</span>
            </button>
            <button
              type="button"
              className={`py-2.5 sm:py-3 px-3 rounded-xl font-black tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2 border-2 font-dotgothic text-sm sm:text-base ${
                activeTab === 'sound'
                  ? 'bg-[#1f1324] text-amber-300 border-rose-500'
                  : 'bg-[#110e1c] text-neutral-400 border-transparent hover:text-neutral-200 hover:border-[#2e2644]'
              }`}
              onClick={() => {
                setActiveTab('sound');
                playTick();
              }}
            >
              <span className={`w-2.5 h-2.5 rounded-xs ${activeTab === 'sound' ? 'bg-rose-500' : 'bg-neutral-600'}`} />
              <span>サウンド＆判定</span>
              <span className="hidden sm:inline text-[10px] text-cyan-400/80 font-normal">[SYNC-02]</span>
            </button>
          </div>

          {/* メインコンテンツ領域（機械風カスタムスクロールバー適用） */}
          <div className="mech-scrollbar flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 min-h-0">

            {activeTab === 'general' && (
              <>
                {/* 1. レーン速度計器パネル */}
                <div className="relative rounded-2xl border-2 border-cyan-500/60 bg-[#100d1c] p-1">
                  <MechCornerBrackets color="cyan" />
                  <div className="rounded-xl border border-amber-500/30 bg-[#0c0a16] p-4 sm:p-5 flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#28203d] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-dotgothic px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/50 text-cyan-300 font-bold">
                            GAUGE-01 // SPEED
                          </span>
                          <span className="text-lg sm:text-xl font-black text-cyan-300 tracking-widest font-dotgothic">
                            レーン速度（ノーツスピード）
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-300 font-bold mt-1">
                          ノーツが流れる速さを調整します（基準 <span className="text-amber-300 font-dotgothic">4.00</span> ＝ 標準速度）。音楽のテンポや判定幅は変わりません。
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSpeedMultiplier(4.0)}
                        className="px-3 py-1.5 rounded-lg bg-[#1b162e] hover:bg-[#272042] text-amber-300 border border-amber-500/60 font-dotgothic text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="標準速度 (4.00) に戻す"
                      >
                        <RotateCcw size={13} />
                        <span>標準 (4.00) に戻す</span>
                      </button>
                    </div>

                    {/* デジタル計器表示部 ＆ 0.01 / 0.10 微調整ステッパー */}
                    <div className="bg-[#08060e] rounded-xl border-2 border-[#251e38] p-3.5 sm:p-4 flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-dotgothic text-amber-400/90 tracking-widest">
                            CURRENT VELOCITY
                          </span>
                          <span className="text-xs font-dotgothic font-bold text-cyan-200 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/40">
                            {getSpeedCategoryLabel(speedMultiplier)}
                          </span>
                        </div>
                        <span className="text-xs font-dotgothic text-neutral-400">
                          実効倍率: <strong className="text-amber-300">{(speedMultiplier / 4.0).toFixed(2)}x</strong>
                        </span>
                      </div>

                      {/* 0.01 / 0.10 微調整ボタン＋デジタル速度表示 */}
                      <div className="flex items-center justify-center gap-1.5 sm:gap-3">
                        <button
                          type="button"
                          onClick={() => handleSpeedStep(-0.1)}
                          className="px-2.5 sm:px-3.5 py-2.5 bg-[#161224] hover:bg-[#231d38] active:bg-[#2d2547] text-neutral-200 rounded-xl border border-[#382e54] font-dotgothic font-bold text-xs sm:text-sm transition-colors cursor-pointer select-none"
                          title="0.10 遅くする"
                        >
                          -0.10
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSpeedStep(-0.01)}
                          className="px-3 sm:px-4 py-2.5 bg-[#1a152a] hover:bg-[#272040] active:bg-[#322952] text-cyan-300 rounded-xl border-2 border-cyan-500/60 font-dotgothic font-black text-xs sm:text-sm flex items-center gap-1 transition-colors cursor-pointer select-none"
                          title="0.01 遅くする（微調整）"
                        >
                          <Minus size={15} />
                          <span>0.01</span>
                        </button>

                        <div className="min-w-[130px] sm:min-w-[165px] text-center bg-[#120e20] px-3 sm:px-4 py-1.5 rounded-xl border-2 border-cyan-400/60 flex items-baseline justify-center gap-1.5">
                          <span className="text-3xl sm:text-4xl font-black font-dotgothic text-cyan-300 tracking-wider">
                            {speedMultiplier.toFixed(2)}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-amber-400/80 font-dotgothic">
                            / 10.00
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSpeedStep(0.01)}
                          className="px-3 sm:px-4 py-2.5 bg-[#1a152a] hover:bg-[#272040] active:bg-[#322952] text-amber-300 rounded-xl border-2 border-amber-500/60 font-dotgothic font-black text-xs sm:text-sm flex items-center gap-1 transition-colors cursor-pointer select-none"
                          title="0.01 速くする（微調整）"
                        >
                          <Plus size={15} />
                          <span>0.01</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSpeedStep(0.1)}
                          className="px-2.5 sm:px-3.5 py-2.5 bg-[#161224] hover:bg-[#231d38] active:bg-[#2d2547] text-neutral-200 rounded-xl border border-[#382e54] font-dotgothic font-bold text-xs sm:text-sm transition-colors cursor-pointer select-none"
                          title="0.10 速くする"
                        >
                          +0.10
                        </button>
                      </div>
                    </div>

                    {/* メカニカル・セグメントゲージ＋スライダー */}
                    <div className="flex flex-col gap-1.5 pt-1">
                      {/* セグメントメーター（28分割：0..27 のうち index 9 が 9/27 = 1/3 ＝ 4.00 のツマミ中心位置と完全一致） */}
                      <MechSegmentedBar
                        ratio={speedRatio}
                        segments={28}
                        activeColor="cyan"
                        standardIndex={9}
                      />

                      <input
                        type="range"
                        min="1.00"
                        max="10.00"
                        step="0.01"
                        value={speedMultiplier}
                        onChange={handleSpeedSliderChange}
                        aria-label="レーン速度"
                        className="mech-gauge-slider"
                        style={{
                          background: `linear-gradient(to right, #06b6d4 0%, #f59e0b calc(13px + (100% - 26px) * ${speedRatio}), #161224 calc(13px + (100% - 26px) * ${speedRatio}), #161224 100%)`
                        }}
                      />

                      {/* 目盛りラベル：スライダー上の 4.00 のツマミ中心座標 calc(13px + (100% - 26px) / 3) の真下に「▲」を正確に配置 */}
                      <div className="relative w-full h-11 font-dotgothic font-bold select-none mt-0.5">
                        <button
                          type="button"
                          onClick={() => setSpeedMultiplier(1.0)}
                          className="absolute top-0 left-0 flex flex-col items-start text-neutral-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        >
                          <span className="pl-[8px] text-[10px] leading-none">▲</span>
                          <span className="mt-1 text-[11px] sm:text-xs">1.00 (低速)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSpeedMultiplier(4.0)}
                          style={{ left: 'calc(13px + (100% - 26px) / 3)' }}
                          className="absolute top-0 -translate-x-1/2 flex flex-col items-center text-amber-300 hover:text-amber-200 font-black transition-colors cursor-pointer"
                        >
                          <span className="text-amber-400 text-xs leading-none">▲</span>
                          <span className="mt-0.5 bg-amber-500/15 border border-amber-500/50 rounded-md px-2 py-0.5 text-[11px] sm:text-xs whitespace-nowrap">
                            4.00 (標準・基準)
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSpeedMultiplier(7.0)}
                          style={{ left: 'calc(13px + (100% - 26px) * 2 / 3)' }}
                          className="hidden sm:flex absolute top-0 -translate-x-1/2 flex-col items-center text-neutral-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        >
                          <span className="text-[10px] leading-none">▲</span>
                          <span className="mt-1 text-[11px] sm:text-xs whitespace-nowrap">7.00 (高速)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSpeedMultiplier(10.0)}
                          className="absolute top-0 right-0 flex flex-col items-end text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <span className="pr-[8px] text-[10px] leading-none">▲</span>
                          <span className="mt-1 text-[11px] sm:text-xs">10.00 (最高速)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. ウォール（レーン隠し）計器パネル */}
                <div className="relative rounded-2xl border-2 border-purple-500/60 bg-[#100d1c] p-1">
                  <MechCornerBrackets color="purple" />
                  <div className="rounded-xl border border-rose-500/30 bg-[#0c0a16] p-4 sm:p-5 flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#28203d] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-dotgothic px-2 py-0.5 rounded bg-purple-500/15 border border-purple-400/50 text-purple-300 font-bold">
                            GAUGE-02 // SHUTTER WALL
                          </span>
                          <span className="text-lg sm:text-xl font-black text-purple-300 tracking-widest font-dotgothic">
                            ウォール（レーン隠し装甲）
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-300 font-bold mt-1">
                          画面右側のノーツ出現位置から指定した割合をシャッターで隠します。(0＝開放, 1000＝完全遮蔽)
                        </p>
                      </div>

                      <div className="flex items-baseline gap-1.5 bg-[#120e20] px-4 py-1.5 rounded-xl border border-purple-500/40 font-dotgothic">
                        <span className="text-xs text-neutral-400">遮蔽率:</span>
                        <span className="text-3xl font-black text-purple-300">{wallAmount}</span>
                        <span className="text-xs text-amber-400/80">/ 1000</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <MechSegmentedBar
                        ratio={wallRatio}
                        segments={25}
                        activeColor="purple"
                      />

                      <input
                        type="range"
                        min="0"
                        max="1000"
                        value={wallAmount}
                        onChange={handleWallChange}
                        aria-label="ウォール (レーン隠し)"
                        className="mech-gauge-slider mech-gauge-slider-purple"
                        style={{
                          background: `linear-gradient(to right, #a855f7 0%, #f43f5e ${wallRatio * 100}%, #161224 ${wallRatio * 100}%, #161224 100%)`
                        }}
                      />

                      <div className="flex justify-between items-center text-xs font-bold text-neutral-400 px-1 font-dotgothic">
                        <span>0 (なし)</span>
                        <span>500 (50%遮蔽)</span>
                        <span>1000 (完全遮蔽)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. 創作・エディター機能トグルパネル */}
                <div className="relative rounded-2xl border-2 border-amber-500/60 bg-[#100d1c] p-1">
                  <MechCornerBrackets color="amber" />
                  <div className="rounded-xl border border-cyan-500/30 bg-[#0c0a16] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-dotgothic px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/50 text-amber-300 font-bold">
                          SWITCH-03 // CREATOR MODULE
                        </span>
                        <span className="text-lg sm:text-xl font-black text-amber-300 tracking-widest font-dotgothic">
                          創作・エディター機能の表示
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-neutral-300 font-bold mt-1">
                        ホーム画面下部に「創作譜面を遊ぶ」「創作譜面を作る」モジュールを表示します。
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={toggleShowCustomModes}
                      className={`px-5 py-3 rounded-xl font-dotgothic font-black text-sm sm:text-base transition-colors border-2 cursor-pointer shrink-0 flex items-center gap-2.5 ${
                        showCustomModes
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-[#09080f] border-amber-300'
                          : 'bg-[#1a152b] hover:bg-[#261f3d] text-neutral-300 border-[#3a3058]'
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-xs border ${
                          showCustomModes ? 'bg-[#09080f] border-[#09080f]' : 'bg-neutral-700 border-neutral-500'
                        }`}
                      />
                      <span>{showCustomModes ? 'ON // 表示中' : 'OFF // 非表示'}</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'sound' && (
              <>
                <div className="relative rounded-2xl border-2 border-rose-500/65 bg-[#100d1c] p-1">
                  <MechCornerBrackets color="crimson" />
                  <div className="rounded-xl border border-amber-500/35 bg-[#0c0a16] p-4 sm:p-5 flex flex-col gap-5">

                    {/* パネルヘッダー */}
                    <div className="border-b border-[#28203d] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-dotgothic px-2 py-0.5 rounded bg-rose-500/15 border border-rose-400/50 text-rose-300 font-bold">
                          SYNC-MONITOR // TIMING OFFSET
                        </span>
                        <span className="text-lg sm:text-xl font-black text-amber-300 tracking-widest font-dotgothic">
                          判定オフセット・打鍵校正モニター
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-neutral-300 font-bold mt-1">
                        リズム音に合わせて<span className="text-cyan-300">スペースキー・任意の文字キー</span>を押すか、<span className="text-amber-300">デモ画面をタップ</span>して判定のズレ（FAST / LATE）を確認・調整できます。
                      </p>
                    </div>

                    {/* 判定音テスト（メトロノーム音切替） */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#090710] p-3.5 rounded-xl border-2 border-[#261e3a]">
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white font-dotgothic">
                          基準リズム音（メトロノーム音）切替
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          周期ごとに鳴るガイド音を選択できます（打鍵時は判定結果に応じたSEが鳴ります）
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setCalibrationSound('perfect');
                            playPerfect();
                          }}
                          className={`px-3.5 py-2 rounded-lg font-dotgothic font-black text-xs transition-colors border cursor-pointer ${
                            calibrationSound === 'perfect'
                              ? 'bg-amber-400 text-[#09080f] border-amber-200'
                              : 'bg-[#1a152a] hover:bg-[#251e3b] text-neutral-300 border-[#362c52]'
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
                          className={`px-3.5 py-2 rounded-lg font-dotgothic font-black text-xs transition-colors border cursor-pointer ${
                            calibrationSound === 'good'
                              ? 'bg-emerald-400 text-[#09080f] border-emerald-200'
                              : 'bg-[#1a152a] hover:bg-[#251e3b] text-neutral-300 border-[#362c52]'
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
                          className={`px-3.5 py-2 rounded-lg font-dotgothic font-black text-xs transition-colors border cursor-pointer ${
                            calibrationSound === 'miss'
                              ? 'bg-rose-500 text-white border-rose-300'
                              : 'bg-[#1a152a] hover:bg-[#251e3b] text-neutral-300 border-[#362c52]'
                          }`}
                        >
                          MISS音
                        </button>
                      </div>
                    </div>

                    {/* インタラクティブ・オシロスコープ判定デモ画面 */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[11px] font-dotgothic text-neutral-400 px-1">
                        <span className="text-cyan-300 flex items-center gap-1">
                          <Keyboard size={13} />
                          キー入力（Space / 文字キー）または画面タップでリアルタイム判定
                        </span>
                        <span>BPM 120 // 周期 500ms</span>
                      </div>

                      <div
                        role="region"
                        aria-label="オフセット調整デモ画面（タップまたはキー入力で判定テスト）"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          handleDemoHit();
                        }}
                        className="mech-monitor-grid h-40 rounded-xl relative overflow-hidden border-2 border-cyan-500/60 cursor-pointer select-none"
                      >
                        <MechCornerBrackets color="cyan" />

                        {/* 上部目盛りラベル（FAST / CENTER / LATE） */}
                        <div className="absolute top-2 inset-x-4 flex justify-between items-center text-[10px] font-dotgothic pointer-events-none z-20">
                          <span className="text-cyan-400/80 bg-[#09080f]/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
                            ◀ LATE (+ms)
                          </span>
                          <span className="text-amber-300 bg-[#09080f]/90 px-2 py-0.5 rounded border border-amber-500/50">
                            JUDGE LINE (0ms)
                          </span>
                          <span className="text-orange-300/80 bg-[#09080f]/80 px-1.5 py-0.5 rounded border border-orange-500/30">
                            FAST (-ms) ▶
                          </span>
                        </div>

                        {/* ノーツ描画キャンバスコンテナ */}
                        <div ref={handleDemoRef} className="absolute inset-0" />

                        {/* リアルタイム判定結果＆ズレ（FAST/LATE ±ms）オーバーレイ表示 */}
                        {demoJudgment ? (
                          <div
                            key={demoJudgment.count}
                            className="demo-judgment-pop absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-2.5 pointer-events-none z-30"
                          >
                            <div
                              className={`px-3.5 py-1 rounded-lg border-2 font-dotgothic font-black text-xl sm:text-2xl tracking-widest ${
                                demoJudgment.judgment === 'PERFECT'
                                  ? 'bg-[#09080f]/95 text-amber-300 border-amber-400'
                                  : demoJudgment.judgment === 'GOOD'
                                    ? 'bg-[#09080f]/95 text-emerald-300 border-emerald-400'
                                    : 'bg-[#09080f]/95 text-rose-400 border-rose-500'
                              }`}
                            >
                              {demoJudgment.judgment}
                            </div>

                            <div
                              className={`px-2.5 py-1 rounded-lg border font-dotgothic font-bold text-xs sm:text-sm ${
                                demoJudgment.timingType === 'FAST'
                                  ? 'bg-[#09080f]/95 text-cyan-300 border-cyan-400/70'
                                  : demoJudgment.timingType === 'LATE'
                                    ? 'bg-[#09080f]/95 text-orange-300 border-orange-400/70'
                                    : 'bg-[#09080f]/95 text-amber-200 border-amber-400/70'
                              }`}
                            >
                              {demoJudgment.timingType}{' '}
                              {demoJudgment.diffMs > 0
                                ? `+${demoJudgment.diffMs}ms`
                                : demoJudgment.diffMs < 0
                                  ? `${demoJudgment.diffMs}ms`
                                  : '±0ms'}
                            </div>
                          </div>
                        ) : (
                          <div className="absolute bottom-2.5 inset-x-0 flex justify-center pointer-events-none z-30">
                            <span className="px-3 py-1 rounded-lg bg-[#09080f]/90 border border-[#2e2644] font-dotgothic text-xs text-neutral-300">
                              リズムに合わせてキーを押すか、ここをタップしてください
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* オフセット数値コントロールパネル */}
                    <div className="bg-[#090710] rounded-xl border-2 border-[#261e3a] p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-center gap-3 sm:gap-5">
                        <button
                          type="button"
                          onClick={() => handleOffsetChange(-5)}
                          className="px-3.5 py-3 bg-[#1a152a] hover:bg-[#272040] text-cyan-300 rounded-xl border-2 border-cyan-500/50 font-dotgothic font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="-5ms"
                        >
                          <Minus size={18} />
                          <span className="text-xs">5ms</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOffsetChange(-1)}
                          className="px-3 py-2.5 bg-[#161224] hover:bg-[#221c38] text-neutral-200 rounded-xl border border-[#382e54] font-dotgothic font-bold text-xs transition-colors cursor-pointer"
                        >
                          -1ms
                        </button>

                        <div className="min-w-[140px] sm:min-w-[170px] text-center bg-[#120e20] py-2 px-4 rounded-xl border-2 border-amber-500/60 flex items-baseline justify-center gap-1">
                          <span className="text-3xl sm:text-4xl font-black font-dotgothic text-amber-300">
                            {offsetMs > 0 ? `+${offsetMs}` : offsetMs}
                          </span>
                          <span className="text-sm sm:text-base font-bold text-neutral-400 font-dotgothic">
                            ms
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOffsetChange(1)}
                          className="px-3 py-2.5 bg-[#161224] hover:bg-[#221c38] text-neutral-200 rounded-xl border border-[#382e54] font-dotgothic font-bold text-xs transition-colors cursor-pointer"
                        >
                          +1ms
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOffsetChange(5)}
                          className="px-3.5 py-3 bg-[#1a152a] hover:bg-[#272040] text-rose-300 rounded-xl border-2 border-rose-500/50 font-dotgothic font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="+5ms"
                        >
                          <Plus size={18} />
                          <span className="text-xs">5ms</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-dotgothic text-neutral-400 border-t border-[#221b34] pt-2.5">
                        <span>
                          目安：<span className="text-orange-300">LATE (+ms)</span> が出る場合は <span className="text-rose-300">+方向</span>、<span className="text-cyan-300">FAST (-ms)</span> が出る場合は <span className="text-cyan-300">-方向</span> へ調整
                        </span>
                        <button
                          type="button"
                          onClick={() => setOffsetMs(0)}
                          className="px-2.5 py-1 rounded bg-[#181326] hover:bg-[#241d38] text-amber-300 border border-amber-500/40 cursor-pointer transition-colors"
                        >
                          0ms にリセット
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </>
            )}

          </div>
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
