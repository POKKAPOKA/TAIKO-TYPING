import React, { useState, useEffect, useRef, useCallback } from 'react';

// キーと指の対応マップ
const FINGER_MAP = {
  ' ': '親指',
  'f': '人差し指', 'j': '人差し指',
  'd': '中指',   'k': '中指',
  's': '薬指',   'l': '薬指',
  'a': '小指',   ';': '小指',
};

const LEFT_HAND_KEYS = ['a', 's', 'd', 'f', ' '];
const RIGHT_HAND_KEYS = [';', 'l', 'k', 'j', ' '];

const getHandSide = (key) => {
  if (key === ' ') return 'both';
  if (LEFT_HAND_KEYS.includes(key)) return 'left';
  if (RIGHT_HAND_KEYS.includes(key)) return 'right';
  return null;
};

export default function App() {
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'finished'
  const [timeLeft, setTimeLeft] = useState(10);
  const [count, setCount] = useState(0);
  const [targetKeys, setTargetKeys] = useState([]);
  const [lastPressedKey, setLastPressedKey] = useState(null);
  const [activeHand, setActiveHand] = useState(null);
  const [history, setHistory] = useState([]);
  const [inputMode, setInputMode] = useState('keyboard'); // 'keyboard' | 'touch'

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // タイマー処理
  useEffect(() => {
    if (status === 'running') {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const remaining = Math.max(0, 10 - elapsed);
        setTimeLeft(remaining.toFixed(1));

        if (remaining <= 0) {
          clearInterval(timerRef.current);
          setStatus('finished');
        }
      }, 100);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  // 計測完了時に履歴へ追加
  useEffect(() => {
    if (status === 'finished' && targetKeys.length === 2) {
      const cpsNum = count / 10;
      const bpmNum = cpsNum * 15;

      const isTouch = targetKeys[0] === 'LEFT' || targetKeys[0] === 'RIGHT';
      const newRecord = {
        id: Date.now(),
        keys: targetKeys,
        fingers: isTouch ? ['左パッド', '右パッド'] : targetKeys.map((k) => FINGER_MAP[k] || '不明'),
        hand: isTouch ? 'タッチ' : (activeHand === 'left' ? '左手' : '右手'),
        count,
        cps: cpsNum.toFixed(2),
        bpm: Math.round(bpmNum),
      };
      setHistory((prev) => [newRecord, ...prev]);
    }
  }, [status]);

  // 共通の打鍵（またはタップ）判定関数
  const processInput = useCallback((key, mode, sideSide = null) => {
    if (status === 'idle') {
      setStatus('running');
      setInputMode(mode);
      setTargetKeys([key]);
      setLastPressedKey(key);
      setCount(1);
      setTimeLeft(10);

      if (mode === 'keyboard') {
        const side = sideSide || getHandSide(key);
        setActiveHand(side !== 'both' ? side : null);
      } else {
        setActiveHand('touch');
      }
    } else if (status === 'running') {
      if (inputMode !== mode) return;
      if (key === lastPressedKey) return;

      if (targetKeys.length === 1) {
        if (mode === 'keyboard') {
          const side = getHandSide(key);
          if (activeHand === 'left' && !LEFT_HAND_KEYS.includes(key)) return;
          if (activeHand === 'right' && !RIGHT_HAND_KEYS.includes(key)) return;

          const finalHand = activeHand || (side !== 'both' ? side : 'left');
          setActiveHand(finalHand);
        }
        setTargetKeys((prev) => [...prev, key]);
        setLastPressedKey(key);
        setCount((prev) => prev + 1);
      } else if (targetKeys.length === 2) {
        if (targetKeys.includes(key)) {
          setLastPressedKey(key);
          setCount((prev) => prev + 1);
        }
      }
    }
  }, [status, inputMode, targetKeys, lastPressedKey, activeHand]);

  // キーボード入力ダウン
  const handleKeyDown = useCallback(
    (e) => {
      if (e.repeat || e.isComposing) return;
      const key = e.key.toLowerCase();
      if (!(key in FINGER_MAP)) return;
      processInput(key, 'keyboard');
    },
    [processInput]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // スマホのタッチ（PointerDown）イベント
  const handlePadDown = (padName, e) => {
    if (e && e.preventDefault) e.preventDefault();
    processInput(padName, 'touch');
  };

  const handleReset = () => {
    setStatus('idle');
    setTimeLeft(10);
    setCount(0);
    setTargetKeys([]);
    setLastPressedKey(null);
    setActiveHand(null);
  };

  const currentCPSNum = count / (10 - timeLeft || 0.01);
  const currentCPS = status === 'idle' ? '0.00' : currentCPSNum.toFixed(2);
  const currentBPM = status === 'idle' ? 0 : Math.round(currentCPSNum * 15);

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto p-4 md:p-6 bg-gray-50 font-sans select-none">
      <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-1">
        片手トリル速度チェッカー
      </h1>
      <p className="text-xs md:text-sm text-gray-600 mb-4">
        <span className="hidden md:inline">※ 有効キー（片手）から2種類を連打して自動10秒計測（IMEオフ）</span>
        <span className="md:hidden">※ 下の左右パッドを交互に連続タップして自動10秒計測</span>
      </p>

      {/* PC専用エリア (md:blockで幅768px以上のみ表示)：キーボードの有効キー対応表 */}
      <div className="hidden md:block bg-white p-4 rounded-xl border border-gray-200 mb-6 shadow-sm">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          PCキーボード 有効キー対応表（※ 左手と右手を混ぜた入力はできません）
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <span className="font-bold text-blue-700 block mb-2">左手キー (A, S, D, F, Space)</span>
            <div className="text-gray-700 text-xs flex flex-wrap gap-1.5">
              <span className="bg-white px-2 py-1 rounded border border-blue-200 font-medium"><strong>f</strong> : 人差し指</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200 font-medium"><strong>d</strong> : 中指</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200 font-medium"><strong>s</strong> : 薬指</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200 font-medium"><strong>a</strong> : 小指</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200 font-medium"><strong>Space</strong> : 親指</span>
            </div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
            <span className="font-bold text-purple-700 block mb-2">右手キー (J, K, L, ;, Space)</span>
            <div className="text-gray-700 text-xs flex flex-wrap gap-1.5">
              <span className="bg-white px-2 py-1 rounded border border-purple-200 font-medium"><strong>j</strong> : 人差し指</span>
              <span className="bg-white px-2 py-1 rounded border border-purple-200 font-medium"><strong>k</strong> : 中指</span>
              <span className="bg-white px-2 py-1 rounded border border-purple-200 font-medium"><strong>l</strong> : 薬指</span>
              <span className="bg-white px-2 py-1 rounded border border-purple-200 font-medium"><strong>;</strong> : 小指</span>
              <span className="bg-white px-2 py-1 rounded border border-purple-200 font-medium"><strong>Space</strong> : 親指</span>
            </div>
          </div>
        </div>
      </div>

      {/* 計測パネル */}
      <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 text-center mb-4 md:mb-6 shadow-sm">
        <div className="text-xs md:text-sm font-medium text-gray-400 uppercase mb-1">
          {status === 'idle'
            ? 'キーを押すか、下のパッドを叩いてスタート'
            : status === 'running'
            ? '計測中...'
            : '計測完了'}
        </div>

        <div className="text-3xl md:text-4xl font-extrabold text-blue-600 mb-3 md:mb-4">
          残り時間: {timeLeft} 秒
        </div>

        <div className="grid grid-cols-4 gap-2 md:gap-4 border-t border-gray-100 pt-3 md:pt-4 text-left md:text-center">
          <div>
            <div className="text-[10px] md:text-xs text-gray-500">対象 (手/指)</div>
            <div className="text-xs md:text-sm font-bold text-gray-800 mt-1">
              {targetKeys.length === 0 && '-'}
              {activeHand && (
                <span className={`text-[10px] md:text-xs px-1.5 py-0.5 rounded mr-1 ${activeHand === 'left' ? 'bg-blue-100 text-blue-800' : activeHand === 'right' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                  {activeHand === 'left' ? '左手' : activeHand === 'right' ? '右手' : 'タッチ'}
                </span>
              )}
              <div className="text-xs md:text-base mt-1 font-mono font-bold">
                {targetKeys.map((k, i) => (
                  <span key={i} className="inline-block mr-1">
                    [{k === ' ' ? 'Space' : k.toUpperCase()}]
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="text-[10px] md:text-xs text-gray-500">有効入力数</div>
            <div className="text-xl md:text-2xl font-bold text-gray-800 mt-1 md:mt-2">{count} 打</div>
          </div>
          <div>
            <div className="text-[10px] md:text-xs text-gray-500">打 / 秒 (CPS)</div>
            <div className="text-xl md:text-2xl font-bold text-green-600 mt-1 md:mt-2">
              {currentCPS}
            </div>
          </div>
          <div className="bg-amber-50 p-1 md:p-1.5 rounded-lg border border-amber-200">
            <div className="text-[10px] md:text-xs font-bold text-amber-700">16連符 BPM</div>
            <div className="text-xl md:text-2xl font-extrabold text-amber-600 mt-0.5 md:mt-1">
              {currentBPM}
            </div>
          </div>
        </div>

        {status === 'finished' && (
          <button
            onClick={handleReset}
            className="mt-4 md:mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-medium rounded-lg transition shadow"
          >
            もう一度試す
          </button>
        )}
      </div>

      {/* スマホ専用エリア (md:hiddenで幅768px未満のみ表示)：フレキシブル2パッド領域 */}
      <div className="grid md:hidden grid-cols-2 gap-3 flex-1 min-h-[220px] mb-6">
        <div
          onPointerDown={(e) => handlePadDown('LEFT', e)}
          className="bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 border-2 border-blue-400 rounded-2xl flex flex-col items-center justify-center cursor-pointer touch-none transition-transform active:scale-[0.98] shadow-sm"
        >
          <span className="text-3xl font-extrabold text-blue-600 tracking-wider">LEFT</span>
          <span className="text-xs text-blue-500 font-medium mt-1">（左パッド）</span>
        </div>
        <div
          onPointerDown={(e) => handlePadDown('RIGHT', e)}
          className="bg-purple-500/10 hover:bg-purple-500/20 active:bg-purple-500/30 border-2 border-purple-400 rounded-2xl flex flex-col items-center justify-center cursor-pointer touch-none transition-transform active:scale-[0.98] shadow-sm"
        >
          <span className="text-3xl font-extrabold text-purple-600 tracking-wider">RIGHT</span>
          <span className="text-xs text-purple-500 font-medium mt-1">（右パッド）</span>
        </div>
      </div>

      {/* 履歴テーブル */}
      <div>
        <h2 className="text-base md:text-lg font-bold text-gray-700 mb-2">測定履歴</h2>
        {history.length === 0 ? (
          <p className="text-gray-400 text-xs md:text-sm">まだ測定結果がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse bg-white rounded-lg overflow-hidden shadow-sm text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="p-2 md:p-3 border-b">試行</th>
                  <th className="p-2 md:p-3 border-b">手</th>
                  <th className="p-2 md:p-3 border-b">組み合わせ</th>
                  <th className="p-2 md:p-3 border-b">合計打数</th>
                  <th className="p-2 md:p-3 border-b">打/秒 (CPS)</th>
                  <th className="p-2 md:p-3 border-b bg-amber-50 font-bold text-amber-800">16連符 BPM</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-2 md:p-3 text-gray-500 font-mono">#{history.length - index}</td>
                    <td className="p-2 md:p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] md:text-xs font-bold ${item.hand === '左手' ? 'bg-blue-100 text-blue-700' : item.hand === '右手' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                        {item.hand}
                      </span>
                    </td>
                    <td className="p-2 md:p-3 font-bold uppercase">
                      {item.keys.join(' / ')}
                    </td>
                    <td className="p-2 md:p-3 font-medium">{item.count} 打</td>
                    <td className="p-2 md:p-3 font-bold text-green-600">{item.cps}</td>
                    <td className="p-2 md:p-3 font-extrabold text-amber-600 bg-amber-50/50">{item.bpm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
