import React, { Suspense, use } from 'react';
import { Crown, X, Award, Sparkles } from 'lucide-react';

// 四隅の和風メカニカル・コーナー装飾（L字ブラケット＋菱形あしらい・フラット）
function MiyabiCornerDecorations() {
  return (
    <div className="pointer-events-none absolute inset-1.5 z-30 overflow-hidden rounded-[22px]">
      {/* 左上 */}
      <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-cyan-400 rounded-tl-lg" />
      <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rotate-45 bg-pink-400" />
      {/* 右上 */}
      <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-pink-400 rounded-tr-lg" />
      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rotate-45 bg-cyan-400" />
      {/* 左下 */}
      <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-pink-400 rounded-bl-lg" />
      <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rotate-45 bg-cyan-400" />
      {/* 右下 */}
      <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-cyan-400 rounded-br-lg" />
      <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rotate-45 bg-pink-400" />
    </div>
  );
}

// 順位ごとの「雅な伝統色 × サイバーカラー」テーマ定義（フラットデザイン・ドロップシャドウなし）
function getRankTheme(rank) {
  if (rank === 1) {
    // 1位：黄金 × 朱・琥珀
    return {
      cardClass: 'bg-[#26161e]/95 border-2 border-amber-400',
      leftBarClass: 'bg-amber-400 border-r-2 border-rose-500',
      rankTextClass: 'text-amber-300',
      nameClass: 'text-amber-100',
      separatorClass: 'border-amber-400/45',
      scoreBoxClass: 'bg-[#140a12] border-2 border-amber-400/80',
      scoreLabelClass: 'text-amber-300',
      scoreValueClass: 'text-amber-300',
    };
  }
  if (rank === 2) {
    // 2位：白銀 × シアン
    return {
      cardClass: 'bg-[#111c36]/95 border-2 border-cyan-300/90',
      leftBarClass: 'bg-cyan-300 border-r-2 border-slate-200',
      rankTextClass: 'text-cyan-200',
      nameClass: 'text-cyan-50',
      separatorClass: 'border-cyan-400/45',
      scoreBoxClass: 'bg-[#091022] border-2 border-cyan-400/75',
      scoreLabelClass: 'text-cyan-300',
      scoreValueClass: 'text-cyan-200',
    };
  }
  if (rank === 3) {
    // 3位：唐銅 × 桜・マゼンタ
    return {
      cardClass: 'bg-[#24122b]/95 border-2 border-rose-400/85',
      leftBarClass: 'bg-rose-400 border-r-2 border-amber-500',
      rankTextClass: 'text-rose-200',
      nameClass: 'text-pink-50',
      separatorClass: 'border-rose-400/45',
      scoreBoxClass: 'bg-[#14081a] border-2 border-rose-400/75',
      scoreLabelClass: 'text-rose-300',
      scoreValueClass: 'text-rose-200',
    };
  }
  // 4位以降：紫紺の半透明パネル＋細いシアン/紫系の枠線
  return {
    cardClass: 'bg-[#160d30]/85 hover:bg-[#1c113d]/90 border border-purple-400/50 hover:border-cyan-400/65',
    leftBarClass: 'bg-purple-500/70 border-r border-cyan-400/50',
    rankTextClass: 'text-purple-200',
    nameClass: 'text-white',
    separatorClass: 'border-purple-400/40',
    scoreBoxClass: 'bg-[#0b0618] border border-purple-400/50',
    scoreLabelClass: 'text-cyan-300/90',
    scoreValueClass: 'text-white',
  };
}

// ランキングデータはPromiseから読み取る（React 19のuseフック。useEffectでのフェッチは行わない）
function RankingsList({ rankingsPromise }) {
  const { rankings, error } = use(rankingsPromise);

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-48 rounded-2xl bg-[#160b2e]/80 border-2 border-rose-500/60 p-6 text-center">
        <div className="text-xs font-dotgothic text-rose-300 tracking-[0.25em] mb-1">
          ERROR // 通信異常
        </div>
        <div className="text-lg sm:text-xl font-bold text-rose-400 tracking-widest">{error}</div>
      </div>
    );
  }

  if (rankings.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-52 rounded-2xl bg-[#150b2c]/80 border-2 border-dashed border-purple-400/50 p-6 text-center gap-2">
        <div className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-400/50 text-xs font-dotgothic text-purple-300 tracking-[0.25em]">
          NO RECORDS // 記録なし
        </div>
        <div className="text-lg sm:text-xl font-black text-purple-200/80 tracking-widest">
          まだ記録がありません
        </div>
        <p className="text-xs font-bold text-purple-300/60">
          最初のクリア記録を刻みましょう！
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rankings.map((entry) => {
        const theme = getRankTheme(entry.rank);
        const isTop3 = entry.rank <= 3;

        return (
          <div
            key={entry.id}
            className={`relative rounded-2xl overflow-hidden transition-colors shadow-none flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pl-5 sm:pl-6 pr-3.5 sm:pr-5 py-3.5 sm:py-4 ${theme.cardClass}`}
          >
            {/* 左端の縦アクセントバー */}
            <div className={`absolute top-0 bottom-0 left-0 w-2.5 ${theme.leftBarClass}`} />

            {/* 左側：順位（枠囲みなし） ＆ プレイヤー名（省略せず全文表示） */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-[200px] sm:min-w-[260px] flex-1">
              {/* 順位表記（枠囲み・壱ノ位表記を廃止してすっきり表示） */}
              <div
                className={`flex items-center gap-1.5 shrink-0 font-dotgothic font-black leading-none tracking-wider ${theme.rankTextClass}`}
              >
                {entry.rank === 1 && <Crown size={20} className="text-amber-300 shrink-0" />}
                {entry.rank === 2 && <Sparkles size={18} className="text-cyan-300 shrink-0" />}
                {entry.rank === 3 && <Award size={18} className="text-rose-300 shrink-0" />}
                <span className={isTop3 ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}>
                  {entry.rank}
                </span>
                <span className="text-xs sm:text-sm">位</span>
              </div>

              {/* プレイヤー名（長い名前でも「...」で省略せず折り返して全文表示） */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-dotgothic text-purple-300/80 tracking-widest mb-0.5">
                  <span>◆</span>
                  <span>PLAYER</span>
                </div>
                <div
                  className={`text-lg sm:text-xl font-black break-words leading-snug tracking-wide ${theme.nameClass}`}
                >
                  {entry.playerName}
                </div>
              </div>
            </div>

            {/* 右側：判定内訳 ／ MAX COMBO & MAX KPS ／ SCORE */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3.5 shrink-0 ml-auto max-w-full">
              {/* 判定内訳（PERFECT / GOOD / MISS） */}
              <div
                className={`w-28 sm:w-32 text-left sm:border-l-2 sm:border-dashed ${theme.separatorClass} sm:pl-3.5 flex flex-col gap-0.5 shrink-0`}
              >
                <div className="flex justify-between items-baseline text-xs font-bold text-amber-300">
                  <span className="tracking-wider text-[11px]">PERFECT</span>
                  <span className="font-dotgothic font-black text-sm tabular-nums">
                    {entry.perfectCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-xs font-bold text-emerald-300">
                  <span className="tracking-wider text-[11px]">GOOD</span>
                  <span className="font-dotgothic font-black text-sm tabular-nums">
                    {entry.goodCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-xs font-bold text-rose-300/85">
                  <span className="tracking-wider text-[11px]">MISS</span>
                  <span className="font-dotgothic font-black text-sm tabular-nums">
                    {entry.missCount || 0}
                  </span>
                </div>
              </div>

              {/* MAX COMBO ＆ MAX KPS */}
              <div
                className={`flex items-center gap-2.5 sm:gap-3 border-l-2 border-dashed ${theme.separatorClass} pl-2.5 sm:pl-3.5 shrink-0`}
              >
                <div className="w-18 sm:w-20 text-right">
                  <div className="text-[10px] font-dotgothic font-bold text-purple-200/80 tracking-wider mb-0.5 whitespace-nowrap">
                    MAX COMBO
                  </div>
                  <div className="font-dotgothic font-black text-base sm:text-xl text-amber-300 tabular-nums">
                    {entry.maxCombo ?? 0}
                  </div>
                </div>

                <div className="w-16 sm:w-20 text-right">
                  <div className="text-[10px] font-dotgothic font-bold text-purple-200/80 tracking-wider mb-0.5 whitespace-nowrap">
                    MAX KPS
                  </div>
                  <div className="font-dotgothic font-black text-base sm:text-xl text-cyan-300 tabular-nums">
                    {Number(entry.maxKps || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* SCORE（最右端・最大サイズで強調） */}
              <div
                className={`min-w-[128px] sm:min-w-[148px] rounded-xl px-3 py-2 text-right shrink-0 ${theme.scoreBoxClass}`}
              >
                <div
                  className={`text-[10px] sm:text-[11px] font-dotgothic font-black tracking-[0.2em] leading-none mb-1 flex items-center justify-end gap-1 ${theme.scoreLabelClass}`}
                >
                  <span>◆</span>
                  <span>SCORE</span>
                </div>
                <div
                  className={`font-dotgothic text-2xl sm:text-3xl font-black tracking-wider leading-none tabular-nums ${theme.scoreValueClass}`}
                >
                  {Number(entry.score || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Leaderboard({ songTitle, rankingsPromise, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${songTitle} ランキング`}
      onClick={onClose}
      className="fixed inset-0 bg-[#060312]/80 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 backdrop-blur-md select-none"
    >
      {/* 外枠：深い紫紺・藍色の半透明背景 ＋ シアン＆桜色の二重枠線 ＋ 四隅の和風メカニカルコーナー装飾 */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[90dvh] flex flex-col rounded-3xl bg-[#120a28]/95 backdrop-blur-md border-2 border-cyan-400/85 p-1.5 overflow-hidden shadow-none"
      >
        <MiyabiCornerDecorations />

        {/* 内枠（桜色・マゼンタ系のソリッド二重枠線） */}
        <div className="w-full flex-1 flex flex-col rounded-[20px] border border-pink-400/50 bg-[#0e0720]/90 overflow-hidden min-h-0">
          {/* 上部グラデーション飾り罫 */}
          <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-400 shrink-0" />

          {/* ヘッダー：デジタル雅デザイン */}
          <div className="bg-[#160b32]/95 px-4 sm:px-6 py-4 sm:py-5 flex justify-between items-start sm:items-center gap-4 border-b-2 border-purple-500/50 shrink-0">
            <div className="min-w-0 flex-1">
              {/* タイトル ＆ サイバー和風サブテキスト＋飾り罫 */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <h2 className="text-2xl sm:text-3xl font-black text-cyan-300 tracking-widest leading-none">
                  ランキング
                </h2>
                <span className="px-2.5 py-1 rounded-md bg-pink-500/15 border border-pink-400/60 font-dotgothic text-xs font-black text-pink-300 tracking-[0.2em]">
                  RANKING // 番付
                </span>
                <div className="hidden sm:flex items-center gap-1.5 flex-1 max-w-[180px]">
                  <span className="w-1.5 h-1.5 rotate-45 bg-cyan-400 shrink-0" />
                  <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400/70 via-pink-400/50 to-transparent" />
                </div>
              </div>

              {/* 対象楽曲名：桜色＆金色のアクセントがついた和風タグ風ピル型バッジ */}
              <div className="mt-2.5 flex items-center">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#21103d] border-2 border-amber-400/80 max-w-full">
                  <span className="text-amber-300 text-xs shrink-0">❖</span>
                  <span className="text-[11px] font-dotgothic font-bold text-pink-300 tracking-widest border-r border-purple-400/50 pr-2 shrink-0">
                    対象楽曲
                  </span>
                  <span className="text-sm sm:text-base font-black text-amber-100 tracking-wide truncate">
                    {songTitle}
                  </span>
                </div>
              </div>
            </div>

            {/* 右上の「×（閉じる）」メカニカル・フラットボタン */}
            <button
              type="button"
              onClick={onClose}
              title="閉じる"
              aria-label="ランキングを閉じる"
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#1b0f38] hover:bg-pink-500/25 active:bg-pink-500/35 border-2 border-cyan-400/85 hover:border-pink-400 text-cyan-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-none"
            >
              <X size={24} strokeWidth={2.75} />
            </button>
          </div>

          {/* 順位リスト本体（紫紺×シアン系カスタムスクロールバー適用） */}
          <div className="flex-1 overflow-y-auto ranking-miyabi-scrollbar p-4 sm:p-6 min-h-0">
            <Suspense
              fallback={
                <div className="flex flex-col justify-center items-center h-48 gap-3">
                  <div className="w-3 h-3 rotate-45 bg-cyan-400 animate-ping" />
                  <div className="font-dotgothic text-lg sm:text-xl font-black text-cyan-300 tracking-[0.25em]">
                    LOADING // 番付読込中...
                  </div>
                </div>
              }
            >
              <RankingsList rankingsPromise={rankingsPromise} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

