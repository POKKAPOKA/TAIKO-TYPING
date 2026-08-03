import React, { useState, useEffect, useRef, useCallback } from 'react';

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
  const [activeHand, setActiveHand] = useState(null); // 'left' | 'right' | null
  const [history, setHistory] = useState([]);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

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

  useEffect(() => {
    if (status === 'finished' && targetKeys.length === 2) {
      const cpsNum = count / 10;
      const bpmNum = cpsNum * 15;

      const newRecord = {
        id: Date.now(),
        keys: targetKeys,
        fingers: targetKeys.map((k) => FINGER_MAP[k] || '不明'),
        hand: activeHand === 'left' ? '左手' : '右手',
        count,
        cps: cpsNum.toFixed(2),
        bpm: Math.round(bpmNum),
      };
      setHistory((prev) => [newRecord, ...prev]);
    }
  }, [status]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.repeat || e.isComposing) return;

      const key = e.key.toLowerCase();
      if (!(key in FINGER_MAP)) return;

      if (status === 'idle') {
        // 1打目の処理: 左手か右手かを特定する
        const side = getHandSide(key);
        if (!side) return;

        setStatus('running');
        setTargetKeys([key]);
        setLastPressedKey(key);
        setCount(1);
        setTimeLeft(10);

        // スペース以外から開始した場合はその手で即確定
        if (side !== 'both') {
          setActiveHand(side);
        } else {
          setActiveHand(null); // スペース開始の場合は2打目で決定
        }
      } else if (status === 'running') {
        // 同じキーの連続入力はカウントしない
        if (key === lastPressedKey) return;

        if (targetKeys.length === 1) {
          // 2打目で片手縛りのチェック＆組み合わせ確定
          const side = getHandSide(key);

          // すでに手が確定している場合、逆の手のキーなら無視
          if (activeHand === 'left' && !LEFT_HAND_KEYS.includes(key)) return;
          if (activeHand === 'right' && !RIGHT_HAND_KEYS.includes(key)) return;

          // 手を確定させる
          const finalHand = activeHand || (side !== 'both' ? side : 'left');
          setActiveHand(finalHand);

          setTargetKeys((prev) => [...prev, key]);
          setLastPressedKey(key);
          setCount((prev) => prev + 1);
        } else if (targetKeys.length === 2) {
          // 確定した2キーのうち、交互入力のみカウント
          if (targetKeys.includes(key)) {
            setLastPressedKey(key);
            setCount((prev) => prev + 1);
          }
        }
      }
    },
    [status, targetKeys, lastPressedKey, activeHand]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
    <div className="max-w-3xl mx-auto p-6 bg-gray-50 rounded-xl shadow-md font-sans">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        新体力測定：片手トリル
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        ※ 同じ手の有効キーから2種類を連打すると10秒間測定します。
      </p>

      {/* 有効キーの案内表 */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6 shadow-sm">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          有効キー対応表（※ 左手と右手のキーは混ぜて入力できません）
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-2.5 bg-blue-50 rounded border border-blue-100">
            <span className="font-bold text-blue-700 block mb-1">左手キー (A, S, D, F, Space)</span>
            <div className="text-gray-700 text-xs flex flex-wrap gap-2">
              <span className="bg-white px-2 py-0.5 rounded border border-blue-200"><strong>f</strong> : 人差し指</span>
              <span className="bg-white px-2 py-0.5 rounded border border-blue-200"><strong>d</strong> : 中指</span>
              <span className="bg-white px-2 py-0.5 rounded border border-blue-200"><strong>s</strong> : 薬指</span>
              <span className="bg-white px-2 py-0.5 rounded border border-blue-200"><strong>a</strong> : 小指</span>
              <span className="bg-white px-2 py-0.5 rounded border border-blue-200"><strong>Space</strong> : 親指</span>
            </div>
          </div>
          <div className="p-2.5 bg-purple-50 rounded border border-purple-100">
            <span className="font-bold text-purple-700 block mb-1">右手キー (J, K, L, ;, Space)</span>
            <div className="text-gray-700 text-xs flex flex-wrap gap-2">
              <span className="bg-white px-2 py-0.5 rounded border border-purple-200"><strong>j</strong> : 人差し指</span>
              <span className="bg-white px-2 py-0.5 rounded border border-purple-200"><strong>k</strong> : 中指</span>
              <span className="bg-white px-2 py-0.5 rounded border border-purple-200"><strong>l</strong> : 薬指</span>
              <span className="bg-white px-2 py-0.5 rounded border border-purple-200"><strong>;</strong> : 小指</span>
              <span className="bg-white px-2 py-0.5 rounded border border-purple-200"><strong>Space</strong> : 親指</span>
            </div>
          </div>
        </div>
      </div>

      {/* 計測パネル */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 text-center mb-6 shadow-sm">
        <div className="text-sm font-medium text-gray-400 uppercase mb-1">
          {status === 'idle'
            ? '片手のキーを2種類押してスタート'
            : status === 'running'
            ? '計測中...'
            : '計測完了'}
        </div>

        <div className="text-4xl font-extrabold text-blue-600 mb-4">
          残り時間: {timeLeft} 秒
        </div>

        <div className="grid grid-cols-4 gap-3 border-t border-gray-100 pt-4">
          <div>
            <div className="text-xs text-gray-500">対象キー (手/指)</div>
            <div className="text-sm font-bold text-gray-800 mt-1">
              {targetKeys.length === 0 && '-'}
              {activeHand && (
                <span className={`text-xs px-1.5 py-0.5 rounded mr-1 ${activeHand === 'left' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                  {activeHand === 'left' ? '左手' : '右手'}
                </span>
              )}
              <div className="text-base mt-1">
                {targetKeys.map((k, i) => (
                  <span key={i} className="inline-block mr-1">
                    [{k === ' ' ? 'Space' : k.toUpperCase()}]
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">有効入力数</div>
            <div className="text-2xl font-bold text-gray-800 mt-2">{count} 打</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">打 / 秒 (CPS)</div>
            <div className="text-2xl font-bold text-green-600 mt-2">
              {currentCPS}
            </div>
          </div>
          {/* 追加：BPM表示 */}
          <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-200">
            <div className="text-xs font-bold text-amber-700">16連符換算 BPM</div>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">
              {currentBPM}
            </div>
          </div>
        </div>

        {status === 'finished' && (
          <button
            onClick={handleReset}
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition shadow"
          >
            もう一度試す
          </button>
        )}
      </div>

      {/* 履歴テーブル */}
      <div>
        <h2 className="text-lg font-bold text-gray-700 mb-3">測定履歴</h2>
        {history.length === 0 ? (
          <p className="text-gray-400 text-sm">まだ測定結果がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse bg-white rounded-lg overflow-hidden shadow-sm text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="p-3 border-b">試行</th>
                  <th className="p-3 border-b">手</th>
                  <th className="p-3 border-b">キーの組み合わせ</th>
                  <th className="p-3 border-b">指の組み合わせ</th>
                  <th className="p-3 border-b">合計打数</th>
                  <th className="p-3 border-b">打/秒 (CPS)</th>
                  <th className="p-3 border-b bg-amber-50 font-bold text-amber-800">16連符 BPM</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 text-gray-500 font-mono">#{history.length - index}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.hand === '左手' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {item.hand}
                      </span>
                    </td>
                    <td className="p-3 font-bold uppercase">
                      {item.keys.map(k => (k === ' ' ? 'Space' : k)).join(' / ')}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.fingers.join(' × ')}
                    </td>
                    <td className="p-3 font-medium">{item.count} 打</td>
                    <td className="p-3 font-bold text-green-600">{item.cps}</td>
                    <td className="p-3 font-extrabold text-amber-600 bg-amber-50/50">{item.bpm}</td>
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
