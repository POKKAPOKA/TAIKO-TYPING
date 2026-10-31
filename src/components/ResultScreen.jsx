import React from "react";
import { Heart } from "lucide-react";
import { useGameStore } from "../store/gameStore";
import { fetchRankingsResult } from "../api/rankings";
import { useSystemSE } from "../hooks/useSystemSE";
import HeaderLogo from "./HeaderLogo";
import { getAchievementRank } from "../utils/achievementRank";

export default function ResultScreen({
  onRetry,
  onBack,
  onHome,
  isLocalPlay,
  scoreFileName,
  playerName,
  handleNameChange,
  handleScoreSubmit,
  isSubmitting,
  submitSuccessMessage,
  setLeaderboardData
}) {
  const { playDecide } = useSystemSE();
  const score = useGameStore(state => state.score);
  const maxCombo = useGameStore(state => state.maxCombo);
  const perfectCount = useGameStore(state => state.perfectCount);
  const goodCount = useGameStore(state => state.goodCount);
  const missCount = useGameStore(state => state.missCount);
  const droppedCount = useGameStore(state => state.droppedCount);
  const completedCount = useGameStore(state => state.completedCount);
  const maxKps = useGameStore(state => state.maxKps);
  const loadedScore = useGameStore(state => state.loadedScore);
  const setShowSurveyModal = useGameStore(state => state.setShowSurveyModal);
  const songLikesMap = useGameStore(state => state.songLikesMap);
  const hasLikedCurrentResult = useGameStore(state => state.hasLikedCurrentResult);
  const isLikingSong = useGameStore(state => state.isLikingSong);
  const toggleCurrentSongLike = useGameStore(state => state.toggleCurrentSongLike);
  // エンジン内部に直接触れず、ストアに集計された statsData を参照する
  const statsData = useGameStore(state => state.statsData);
  const stats = statsData || { worstKeys: [], mistakeLog: [] };
  const typosByChar = statsData ? Object.fromEntries(statsData.worstKeys.map(w => [w.char, w.count])) : {};

  const currentSongId = scoreFileName
    ? scoreFileName.replace(/\.json$/i, "")
    : loadedScore?.id || "";
  const currentLikeCount = currentSongId ? (songLikesMap?.[currentSongId] || 0) : 0;

  const handleLikeClick = () => {
    playDecide();
    toggleCurrentSongLike();
  };

  const worstTypos = Object.entries(typosByChar)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const isCleared = score >= 700000;
  const achievement = getAchievementRank({ score, perfectCount, goodCount, missCount, droppedCount, completedCount, statsData });

  const getClearRank = () => {
    if (!isCleared) {
      return {
        statusLabel: "FAILED",
        rank: "FAILED",
        color: "text-rose-500",
        statusBadgeClass: "bg-rose-950 text-rose-300 border-2 border-rose-500/70",
        rankBadge: "未クリア（700,000点以上でCLEAR）",
        rankBadgeClass: "bg-neutral-800 text-rose-300 border-2 border-rose-500/50"
      };
    }
    if (achievement === "ALL_PERFECT") {
      return {
        statusLabel: "CLEAR",
        rank: "ALL PERFECT!!",
        color: "text-yellow-400",
        statusBadgeClass: "bg-emerald-500 text-neutral-950 border-2 border-emerald-300",
        rankBadge: "RANK S+",
        rankBadgeClass: "bg-yellow-400 text-neutral-950 border-2 border-yellow-200"
      };
    }
    if (achievement === "FULL_COMBO") {
      return {
        statusLabel: "CLEAR",
        rank: "FULL COMBO!",
        color: "text-cyan-400",
        statusBadgeClass: "bg-emerald-500 text-neutral-950 border-2 border-emerald-300",
        rankBadge: "FULL COMBO",
        rankBadgeClass: "bg-cyan-400 text-neutral-950 border-2 border-cyan-200"
      };
    }
    if (score >= 900000) {
      return {
        statusLabel: "CLEAR",
        rank: "CLEAR",
        color: "text-emerald-400",
        statusBadgeClass: "bg-emerald-500 text-neutral-950 border-2 border-emerald-300",
        rankBadge: "RANK S",
        rankBadgeClass: "bg-yellow-400 text-neutral-950 border-2 border-yellow-200"
      };
    }
    if (score >= 800000) {
      return {
        statusLabel: "CLEAR",
        rank: "CLEAR",
        color: "text-emerald-400",
        statusBadgeClass: "bg-emerald-500 text-neutral-950 border-2 border-emerald-300",
        rankBadge: "RANK A",
        rankBadgeClass: "bg-green-400 text-neutral-950 border-2 border-green-200"
      };
    }
    return {
      statusLabel: "CLEAR",
      rank: "CLEAR",
      color: "text-emerald-400",
      statusBadgeClass: "bg-emerald-500 text-neutral-950 border-2 border-emerald-300",
      rankBadge: "RANK B",
      rankBadgeClass: "bg-cyan-400 text-neutral-950 border-2 border-cyan-200"
    };
  };

  const clearInfo = getClearRank();

  // 1280x720 に収まるように縮小率を算出する。
  // リサイズに追従させるため、useState + resizeイベントで再計算する（useEffectは使わない）
  const [scale, setScale] = React.useState(() =>
    typeof window !== 'undefined'
      ? Math.min(1, (window.innerWidth - 32) / 1280, (window.innerHeight - 32) / 720)
      : 1
  );

  // resizeイベントの登録＆リザルト画面到達時のプレイログ自動保存はコールバックrefで行う（useEffectは使わない）
  const resizeHandlerRef = React.useRef(null);
  const setResizeListenerRef = React.useCallback((node) => {
    if (node && !resizeHandlerRef.current) {
      // まだ未記録の場合はリザルト画面到達タイミングでプレイ記録を自動保存
      useGameStore.getState().recordCurrentPlayLog();
      useGameStore.getState().refreshSongLikes();
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
    <div ref={setResizeListenerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden py-4" style={{ maxHeight: '100%' }}>
      <div className="absolute top-0 left-0 z-20"><HeaderLogo onHome={onHome} /></div>
      <div
        className={`bg-neutral-900 relative overflow-hidden shadow-none border-4 rounded-3xl flex-shrink-0 ${
          isCleared ? 'border-emerald-500/60' : 'border-rose-500/50'
        }`}
        style={{
          width: 1280,
          height: 720,
          transform: `scale(${scale})`,
          transformOrigin: 'center center'
        }}
      >
      {/* 背景画像が将来入る想定のプレースホルダー */}
      <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)] pointer-events-none" />

      {/* クリア判定（700,000点以上でCLEAR / 未満でFAILED）＆ クリアランク */}
      <div className="absolute w-full flex items-center justify-center gap-4" style={{ top: "36px", left: "0px", transform: "none" }}>
        <h2 className={`font-dotgothic text-6xl font-black tracking-widest ${isCleared ? 'text-emerald-400' : clearInfo.color}`}>
          {clearInfo.statusLabel}
        </h2>
        {achievement === "ALL_PERFECT" && (
          <span className="rounded-2xl border-2 border-cyan-300 p-1 bg-[#0d091a]">
            <span className="block rounded-xl border-2 border-fuchsia-400 px-4 py-1.5 font-dotgothic text-lg font-black tracking-wider text-amber-300 outline outline-2 outline-amber-400">[ ALL PERFECT ]</span>
          </span>
        )}
        {achievement === "FULL_COMBO" && (
          <span className="rounded-2xl border-4 border-amber-400 bg-amber-950 px-4 py-1.5 font-dotgothic text-lg font-black tracking-wider text-amber-200">[ FULL COMBO ]</span>
        )}
        {achievement !== "FULL_COMBO" && (
          <span className={`px-4 py-1.5 rounded-2xl font-black text-lg tracking-wider shadow-none ${clearInfo.rankBadgeClass}`}>
            {clearInfo.rankBadge}
          </span>
        )}
      </div>

      {/* スコア */}
      <div className="absolute" style={{ top: "140px", left: "80px", transform: "none" }}>
        <div className="text-neutral-500 font-bold tracking-widest text-lg mb-1">SCORE</div>
        <div className="font-dotgothic text-[100px] leading-none text-white font-black">{Math.round(score)}</div>
      </div>

      {/* 判定回数 */}
      <div className="absolute flex flex-col gap-2" style={{ top: "300px", left: "80px", transform: "none", width: "250px" }}>
        <div className="flex justify-between items-center border-b-2 border-neutral-800 pb-1">
          <span className="text-yellow-400 font-bold text-2xl tracking-widest">PERFECT</span>
          <span className="font-dotgothic text-4xl text-white font-black">{perfectCount}</span>
        </div>
        <div className="flex justify-between items-center border-b-2 border-neutral-800 pb-1">
          <span className="text-green-400 font-bold text-2xl tracking-widest">GOOD</span>
          <span className="font-dotgothic text-4xl text-white font-black">{goodCount}</span>
        </div>
        <div className="flex justify-between items-center border-b-2 border-neutral-800 pb-1">
          <span className="text-red-500 font-bold text-2xl tracking-widest">MISS</span>
          <span className="font-dotgothic text-4xl text-white font-black">{missCount}</span>
        </div>
      </div>

      {/* 最大コンボ */}
      <div className="absolute text-left" style={{ top: "500px", left: "80px", transform: "none" }}>
        <div className="text-neutral-500 font-bold tracking-widest text-sm mb-1">MAX COMBO</div>
        <div className="font-dotgothic text-5xl text-yellow-400 font-black">{maxCombo}</div>
      </div>

      {/* 最高KPS */}
      <div className="absolute text-left" style={{ top: "500px", left: "260px", transform: "none" }}>
        <div className="text-neutral-500 font-bold tracking-widest text-sm mb-1">PEAK KPS</div>
        <div className="font-dotgothic text-5xl text-cyan-400 font-black">{maxKps.toFixed(2)}</div>
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

      {/* ランキング登録 & いいね & アクションボタン */}
      <div className="absolute flex flex-col gap-2.5" style={{ top: "105px", left: "930px", width: "300px", transform: "none" }}>
        {!isLocalPlay && scoreFileName ? (
          <div className="flex flex-col gap-2 w-full bg-neutral-800/80 p-3.5 rounded-2xl border-2 border-neutral-700">
            <h3 className="text-center font-black text-sm text-neutral-400 tracking-widest">ランキング登録</h3>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Guest"
                value={playerName}
                onChange={handleNameChange}
                className="w-full bg-neutral-900 border-2 border-neutral-700 text-white px-4 py-2 rounded-xl font-bold outline-none focus:border-cyan-500 transition-colors text-center"
              />
              <button
                onClick={handleScoreSubmit}
                disabled={isSubmitting}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-700 text-white font-black rounded-xl transition-colors cursor-pointer"
              >
                {isSubmitting ? "送信中..." : "登録する"}
              </button>
            </div>
            {submitSuccessMessage && (
              <div className="text-center text-xs font-bold text-cyan-400 mt-0.5 leading-snug">
                {submitSuccessMessage}
              </div>
            )}
          </div>
        ) : isLocalPlay ? (
          <div className="w-full bg-cyan-900/30 border-2 border-cyan-800 text-cyan-400 p-4 rounded-xl text-center font-bold text-sm">
            開発者に作成データを共有して<br />公式譜面にしてみよう！
          </div>
        ) : null}

        {/* いいね！ボタン（フラット・角丸・影なし） */}
        {!isLocalPlay && currentSongId && (
          <button
            type="button"
            disabled={isLikingSong}
            onClick={handleLikeClick}
            aria-pressed={hasLikedCurrentResult}
            className={`w-full py-3 px-4 rounded-2xl border-2 font-black text-base tracking-wide transition-colors cursor-pointer shadow-none flex items-center justify-between ${
              hasLikedCurrentResult
                ? "bg-rose-500 hover:bg-rose-400 border-rose-200 text-white"
                : "bg-rose-500/20 hover:bg-rose-500/35 border-rose-400 text-rose-100 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <Heart
                size={20}
                className={hasLikedCurrentResult ? "fill-white text-white shrink-0" : "text-rose-300 shrink-0"}
              />
              <span>{hasLikedCurrentResult ? "いいね！済み" : "この曲にいいね！"}</span>
            </span>
            <span
              className={`px-3 py-0.5 rounded-full font-dotgothic text-sm font-black tabular-nums ${
                hasLikedCurrentResult
                  ? "bg-rose-900/65 text-rose-100 border border-rose-200/70"
                  : "bg-neutral-900/85 text-rose-300 border border-rose-400/60"
              }`}
            >
              ♥ {currentLikeCount}
            </span>
          </button>
        )}

        {/* 学祭展示用：アンケート＆スマホ版プレイ案内ボタン（フラット・角丸・影なし） */}
        <button
          type="button"
          onClick={() => setShowSurveyModal(true)}
          className="w-full py-3 px-4 bg-pink-500/20 hover:bg-pink-500/35 border-2 border-pink-400 text-pink-100 hover:text-white rounded-2xl font-black text-base tracking-wide transition-colors cursor-pointer shadow-none flex items-center justify-center gap-1.5"
        >
          <span>📝 アンケートに答える（30秒）</span>
        </button>

        <button
          onClick={onRetry}
          className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-neutral-900 rounded-full font-black text-xl transition-colors cursor-pointer"
        >
          リトライ
        </button>
        {!isLocalPlay && scoreFileName && (
          <button
            onClick={() => {
              const songId = scoreFileName.replace(/\.json$/i, "");
              setLeaderboardData({
                songTitle: loadedScore?.title || songId,
                promise: fetchRankingsResult(songId)
              });
            }}
            className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-full font-black text-xl transition-colors cursor-pointer"
          >
            ランキング
          </button>
        )}
        <button
          onClick={onBack}
          className="w-full py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black text-xl transition-colors cursor-pointer"
        >
          戻る
        </button>
      </div>
      </div>
    </div>
  );
}
