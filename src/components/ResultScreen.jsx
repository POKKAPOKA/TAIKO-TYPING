import React from "react";
import { useGameStore } from "../store/gameStore";
import { fetchRankingsResult } from "../api/rankings";

export default function ResultScreen({
  onRetry,
  onBack,
  isLocalPlay,
  scoreFileName,
  playerName,
  handleNameChange,
  handleScoreSubmit,
  isSubmitting,
  submitSuccessMessage,
  setLeaderboardData
}) {
  const score = useGameStore(state => state.score);
  const maxCombo = useGameStore(state => state.maxCombo);
  const perfectCount = useGameStore(state => state.perfectCount);
  const goodCount = useGameStore(state => state.goodCount);
  const missCount = useGameStore(state => state.missCount);
  const maxKps = useGameStore(state => state.maxKps);
  // エンジン内部に直接触れず、ストアに集計された statsData を参照する
  const statsData = useGameStore(state => state.statsData);
  const stats = statsData || { worstKeys: [], mistakeLog: [] };
  const typosByChar = statsData ? Object.fromEntries(statsData.worstKeys.map(w => [w.char, w.count])) : {};

  const worstTypos = Object.entries(typosByChar)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const getClearRank = () => {
    if (missCount === 0 && goodCount === 0 && perfectCount > 0) return { rank: "ALL PERFECT!!", color: "text-yellow-400" };
    if (missCount === 0 && perfectCount > 0) return { rank: "FULL COMBO!", color: "text-cyan-400" };
    if (score >= 900000) return { rank: "RANK S", color: "text-yellow-400" };
    if (score >= 800000) return { rank: "RANK A", color: "text-green-400" };
    if (score >= 700000) return { rank: "RANK B", color: "text-blue-400" };
    return { rank: "CLEAR", color: "text-white" };
  };

  // 1280x720 に収まるように縮小率を算出する。
  // リサイズに追従させるため、useState + resizeイベントで再計算する（useEffectは使わない）
  const [scale, setScale] = React.useState(() =>
    typeof window !== 'undefined'
      ? Math.min(1, (window.innerWidth - 32) / 1280, (window.innerHeight - 32) / 720)
      : 1
  );

  // resizeイベントの登録はコールバックrefで行う（初回レンダリング時に1度だけ）
  const resizeHandlerRef = React.useRef(null);
  const setResizeListenerRef = React.useCallback((node) => {
    if (node && !resizeHandlerRef.current) {
      const handler = () => {
        setScale(Math.min(1, (window.innerWidth - 32) / 1280, (window.innerHeight - 32) / 720));
      };
      window.addEventListener('resize', handler);
      resizeHandlerRef.current = handler;
    } else if (!node && resizeHandlerRef.current) {
      window.removeEventListener('resize', resizeHandlerRef.current);
      resizeHandlerRef.current = null;
    }
  }, []);

  return (
    // 1280x720 の固定解像度で設計し、画面が小さい場合は scale で縮小して収める
    <div ref={setResizeListenerRef} className="relative w-full flex justify-center overflow-hidden py-4" style={{ maxHeight: '100%' }}>
      <div
        className="bg-neutral-900 relative overflow-hidden shadow-none border-4 border-neutral-700 rounded-3xl flex-shrink-0"
        style={{
          width: 1280,
          height: 720,
          transform: `scale(${scale})`,
          transformOrigin: 'top center'
        }}
      >
      {/* 背景画像が将来入る想定のプレースホルダー */}
      <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)] pointer-events-none" />

      {/* クリアランク */}
      <div className="absolute w-full text-center" style={{ top: "40px", left: "0px", transform: "none" }}>
        <h2 className={`text-6xl font-black tracking-widest ${getClearRank().color}`}>
          {getClearRank().rank}
        </h2>
      </div>

      {/* スコア */}
      <div className="absolute" style={{ top: "140px", left: "80px", transform: "none" }}>
        <div className="text-neutral-500 font-bold tracking-widest text-lg mb-1">SCORE</div>
        <div className="font-mono text-[100px] leading-none text-white font-black">{Math.round(score)}</div>
      </div>

      {/* 判定回数 */}
      <div className="absolute flex flex-col gap-2" style={{ top: "300px", left: "80px", transform: "none", width: "250px" }}>
        <div className="flex justify-between items-center border-b-2 border-neutral-800 pb-1">
          <span className="text-yellow-400 font-bold text-2xl tracking-widest">PERFECT</span>
          <span className="font-mono text-4xl text-white font-black">{perfectCount}</span>
        </div>
        <div className="flex justify-between items-center border-b-2 border-neutral-800 pb-1">
          <span className="text-green-400 font-bold text-2xl tracking-widest">GOOD</span>
          <span className="font-mono text-4xl text-white font-black">{goodCount}</span>
        </div>
        <div className="flex justify-between items-center border-b-2 border-neutral-800 pb-1">
          <span className="text-red-500 font-bold text-2xl tracking-widest">MISS</span>
          <span className="font-mono text-4xl text-white font-black">{missCount}</span>
        </div>
      </div>

      {/* 最大コンボ */}
      <div className="absolute text-left" style={{ top: "500px", left: "80px", transform: "none" }}>
        <div className="text-neutral-500 font-bold tracking-widest text-sm mb-1">MAX COMBO</div>
        <div className="font-mono text-5xl text-yellow-400 font-black">{maxCombo}</div>
      </div>

      {/* 最高KPS */}
      <div className="absolute text-left" style={{ top: "500px", left: "260px", transform: "none" }}>
        <div className="text-neutral-500 font-bold tracking-widest text-sm mb-1">PEAK KPS</div>
        <div className="font-mono text-5xl text-cyan-400 font-black">{maxKps.toFixed(2)}</div>
      </div>

      {/* ワースト3 ミスノーツ */}
      <div className="absolute bg-neutral-800/80 p-6 rounded-2xl border-2 border-neutral-700" style={{ top: "140px", left: "550px", width: "350px", height: "150px" }}>
        <div className="text-orange-400 font-bold tracking-widest text-sm mb-3 text-center">よくミスるノーツ ワースト3</div>
        <div className="flex justify-around items-end h-[60px]">
          {worstTypos.map((typo, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1">
              <div className="text-neutral-400 font-bold text-xs">{typo[1]}回</div>
              <div className="w-12 h-12 bg-neutral-700 text-white font-black text-2xl flex items-center justify-center rounded-xl border-b-4 border-neutral-900">
                {typo[0]}
              </div>
            </div>
          ))}
          {worstTypos.length === 0 && (
            <div className="text-neutral-500 font-bold w-full text-center py-4">ミスはありません！</div>
          )}
        </div>
      </div>

      {/* ミスログ一覧表 */}
      <div className="absolute bg-neutral-800/80 p-6 rounded-2xl border-2 border-neutral-700 flex flex-col" style={{ top: "310px", left: "550px", width: "350px", height: "360px" }}>
        <div className="text-cyan-400 font-bold tracking-widest text-sm mb-3 text-center">ミス発生ログ一覧表</div>
        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2">
          {stats.mistakeLog.length > 0 ? stats.mistakeLog.map((log, idx) => (
            <div key={idx} className="flex justify-between items-center bg-neutral-900 p-3 rounded-xl border-l-4 border-orange-500">
              <div className="text-neutral-400 font-mono text-sm">{log.time.toFixed(2)}s</div>
              <div className="text-white font-bold max-w-[120px] truncate">{log.note}</div>
              <div className="text-xs font-black bg-neutral-700 px-2 py-1 rounded text-orange-400">
                {log.type === "typo" ? `Typo: ${log.char}` : log.type === "miss" ? "見逃し" : "打ち残し"}
              </div>
            </div>
          )) : (
            <div className="text-neutral-500 font-bold w-full text-center py-8">完璧です！</div>
          )}
        </div>
      </div>

      {/* ランキング登録 & アクションボタン */}
      <div className="absolute flex flex-col gap-4" style={{ top: "140px", left: "930px", width: "300px", transform: "none" }}>
        {!isLocalPlay && scoreFileName ? (
          <div className="flex flex-col gap-3 w-full bg-neutral-800/80 p-5 rounded-2xl border-2 border-neutral-700">
            <h3 className="text-center font-black text-sm text-neutral-500 tracking-widest">ランキング登録</h3>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Guest"
                value={playerName}
                onChange={handleNameChange}
                className="w-full bg-neutral-900 border-2 border-neutral-700 text-white px-4 py-3 rounded-xl font-bold outline-none focus:border-cyan-500 transition-colors text-center"
              />
              <button
                onClick={handleScoreSubmit}
                disabled={isSubmitting}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-700 text-white font-black rounded-xl transition-colors"
              >
                {isSubmitting ? "送信中..." : "登録する"}
              </button>
            </div>
            {submitSuccessMessage && (
              <div className="text-center text-sm font-bold text-cyan-400 mt-1">
                {submitSuccessMessage}
              </div>
            )}
          </div>
        ) : isLocalPlay ? (
          <div className="w-full bg-cyan-900/30 border-2 border-cyan-800 text-cyan-400 p-4 rounded-xl text-center font-bold text-sm">
            開発者に作成データを共有して<br />公式譜面にしてみよう！
          </div>
        ) : null}

        <button
          onClick={onRetry}
          className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-neutral-900 rounded-full font-black text-xl transition-colors"
        >
          リトライ
        </button>
        <button
          onClick={() => {
            const songId = scoreFileName ? scoreFileName.replace(/\.json$/i, "") : "Unknown";
            setLeaderboardData({
              songTitle: "LEADERBOARD",
              promise: fetchRankingsResult(songId)
            });
          }}
          className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-full font-black text-xl transition-colors"
        >
          ランキング
        </button>
        <button
          onClick={onBack}
          className="w-full py-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black text-xl transition-colors"
        >
          戻る
        </button>
      </div>
      </div>
    </div>
  );
}
