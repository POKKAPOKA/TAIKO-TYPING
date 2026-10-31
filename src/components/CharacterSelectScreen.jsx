import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CHARACTERS, getCharacterById } from '../config/characters';
import { Home, Check } from 'lucide-react';
import HeaderLogo from './HeaderLogo';

const POSE_ORDER = ['sing_1', 'sing_2', 'miss'];

const POSE_META = {
  sing_1: {
    id: 'sing_1',
    icon: '🎵',
    shortLabel: '通常',
    fullLabel: '通常',
    statusBadge: '通常',
    animClass: 'char-preview-sing-1',
    stageBorder: 'border-cyan-400',
    stageInnerBorder: 'border-cyan-500/40',
    stageBg: 'bg-[#0b0d1a]',
    stageAccentRing: 'border-cyan-400/50 bg-cyan-500/10',
    badgeClass: 'bg-cyan-400 text-[#09080f] border-cyan-300',
    subBadgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/70',
    pillActiveClass: 'bg-cyan-400 text-[#09080f] border-cyan-300',
    cornerClass: 'border-cyan-400',
  },
  sing_2: {
    id: 'sing_2',
    icon: '🔥',
    shortLabel: '熱唱',
    fullLabel: '熱唱',
    statusBadge: '熱唱',
    animClass: 'char-preview-sing-2',
    stageBorder: 'border-orange-500',
    stageInnerBorder: 'border-fuchsia-500/50',
    stageBg: 'bg-[#170b18]',
    stageAccentRing: 'border-orange-400/60 bg-orange-500/15',
    badgeClass: 'bg-orange-500 text-[#09080f] border-amber-300',
    subBadgeClass: 'bg-fuchsia-500/20 text-orange-300 border-orange-400/80',
    pillActiveClass: 'bg-orange-500 text-[#09080f] border-amber-300',
    cornerClass: 'border-orange-400',
  },
  miss: {
    id: 'miss',
    icon: '💥',
    shortLabel: 'ミス',
    fullLabel: 'ミス',
    statusBadge: 'ミス',
    animClass: 'char-preview-miss',
    stageBorder: 'border-rose-500',
    stageInnerBorder: 'border-indigo-500/50',
    stageBg: 'bg-[#120914]',
    stageAccentRing: 'border-rose-500/60 bg-rose-500/15',
    badgeClass: 'bg-rose-500 text-white border-rose-300',
    subBadgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/80',
    pillActiveClass: 'bg-rose-500 text-white border-rose-300',
    cornerClass: 'border-rose-500',
  },
};

export default function CharacterSelectScreen({ onBack }) {
  const selectedCharacterId = useGameStore((state) => state.selectedCharacterId);
  const setSelectedCharacterId = useGameStore((state) => state.setSelectedCharacterId);
  const showToast = useGameStore((state) => state.showToast);

  const [previewPose, setPreviewPose] = useState('sing_1');
  const [animTick, setAnimTick] = useState(0);

  const activeCharacter = getCharacterById(selectedCharacterId);
  const currentMeta = POSE_META[previewPose] || POSE_META.sing_1;

  const handleSelectPose = (poseKey) => {
    setPreviewPose(poseKey);
    setAnimTick((t) => t + 1);
  };

  // 立ち絵クリック／タップで「通常 → 熱唱 → ミス → 通常」とサイクル切り替え
  const handleCyclePose = () => {
    const idx = POSE_ORDER.indexOf(previewPose);
    const nextPose = POSE_ORDER[(idx + 1) % POSE_ORDER.length];
    handleSelectPose(nextPose);
  };

  const handleSelectCharacter = (char) => {
    setSelectedCharacterId(char.id);
    setAnimTick((t) => t + 1);
    showToast(`ボーカリスト「${char.name}」を選択しました`);
  };

  const currentSpriteUrl =
    activeCharacter.sprites?.[previewPose] || activeCharacter.sprites?.sing_1;

  return (
    <div className="char-select-root w-full h-[100dvh] bg-[#09080f] text-white flex flex-col md:flex-row select-none relative z-10 shadow-none">
      {/* =========================================================
         左側／上部エリア（PC: 幅56% / スマホ: 上部約43dvhコンパクトステージ）
         選択中キャラクターの全体像（立ち絵）＋ 表情切り替えピルボタン
         ========================================================= */}
      <div
        className={`relative w-full h-[43dvh] sm:h-[45dvh] md:h-full md:w-[56%] lg:w-[58%] shrink-0 flex flex-col items-center justify-between p-2.5 sm:p-4 md:p-7 transition-colors duration-200 mech-grid-bg ${currentMeta.stageBg} md:border-r-4 ${currentMeta.stageBorder}`}
      >
        {/* 四隅のL字型コーナーブラケット（ポーズ状態に応じて色が変化） */}
        <div className="pointer-events-none absolute inset-2 md:inset-4 z-20">
          <div className={`absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 rounded-tl-lg transition-colors duration-200 ${currentMeta.cornerClass}`} />
          <div className={`absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 rounded-tr-lg transition-colors duration-200 ${currentMeta.cornerClass}`} />
          <div className={`hidden md:block absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 rounded-bl-lg transition-colors duration-200 ${currentMeta.cornerClass}`} />
          <div className={`hidden md:block absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 rounded-br-lg transition-colors duration-200 ${currentMeta.cornerClass}`} />
        </div>

        {/* ステージ上部ステータスバー */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2 z-20 px-1 sm:px-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
            <HeaderLogo onHome={onBack} />
            <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border-2 font-dotgothic font-black text-[10px] sm:text-xs tracking-wider shrink-0 transition-colors duration-200 ${currentMeta.badgeClass}`}>
              PREVIEW
            </span>
            <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border font-dotgothic font-bold text-[10px] sm:text-xs truncate transition-colors duration-200 ${currentMeta.subBadgeClass}`}>
              {currentMeta.statusBadge}
            </span>
          </div>

          <span className="text-[10px] sm:text-xs font-dotgothic font-bold text-neutral-300 bg-[#120e20] border border-[#2f2648] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg shrink-0">
            タップで切替
          </span>
        </div>

        {/* 中央：立ち絵全体像表示ステージ（クリック／タップで差分サイクル切替） */}
        <div className="relative flex-1 w-full min-h-0 flex items-center justify-center my-0.5">
          {/* 背面のフラットな幾何学ステージリング装飾（光彩・シャドウなし） */}
          <div
            className={`pointer-events-none absolute w-40 h-40 sm:w-56 sm:h-56 md:w-88 md:h-88 rounded-full border-4 transition-colors duration-200 ${currentMeta.stageAccentRing}`}
          />
          <div
            className={`pointer-events-none absolute w-32 h-32 sm:w-44 sm:h-44 md:w-72 md:h-72 rounded-3xl rotate-45 border-2 transition-colors duration-200 ${currentMeta.stageInnerBorder}`}
          />

          <button
            type="button"
            onClick={handleCyclePose}
            title="クリック／タップで表情を切り替え（通常 → 熱唱 → ミス）"
            aria-label="立ち絵の表情を切り替える"
            className="relative h-full w-full max-w-[340px] md:max-w-[460px] flex items-center justify-center cursor-pointer focus:outline-none z-10 p-1"
          >
            <img
              key={`${activeCharacter.id}-${previewPose}-${animTick}`}
              src={currentSpriteUrl}
              alt={`${activeCharacter.name} - ${currentMeta.fullLabel}`}
              decoding="async"
              className={`h-full w-full max-h-[24dvh] sm:max-h-[28dvh] md:max-h-[68dvh] object-contain select-none ${currentMeta.animClass}`}
            />
          </button>
        </div>

        {/* 立ち絵下部（スマホ時はボトムシートのすぐ上）：表情切り替えセグメントピルボタン */}
        <div className="w-full max-w-md z-30 pb-3.5 md:pb-1 px-1">
          <div
            role="group"
            aria-label="立ち絵の表情切り替え"
            className={`grid grid-cols-3 gap-1.5 p-1 sm:p-1.5 rounded-2xl bg-[#0e0b18] border-2 transition-colors duration-200 ${currentMeta.stageBorder}`}
          >
            {POSE_ORDER.map((poseKey) => {
              const meta = POSE_META[poseKey];
              const isActive = previewPose === poseKey;
              return (
                <button
                  key={poseKey}
                  type="button"
                  onClick={() => handleSelectPose(poseKey)}
                  aria-pressed={isActive}
                  className={`py-1.5 sm:py-2.5 px-2 rounded-xl font-dotgothic font-black text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 border-2 transition-colors cursor-pointer select-none shadow-none ${
                    isActive
                      ? meta.pillActiveClass
                      : 'bg-[#161226] hover:bg-[#211b38] text-neutral-300 border-transparent'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span className="md:hidden">{meta.shortLabel}</span>
                  <span className="hidden md:inline">{meta.fullLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================
         右側／下部エリア（PC: 幅44% / スマホ: 最大高さ約60dvh・縦スワイプ可能なボトムシート）
         ドラッグハンドル ＋ ガイドテキスト ＋ キャラ情報 ＋ 横スライド対応ちびキャラ一覧 ＋ メニューに戻るボタン
         ========================================================= */}
      <div
        className={`char-select-sheet-scroll mech-scrollbar relative z-20 flex-1 min-h-0 max-h-[60dvh] md:max-h-none w-full md:w-[44%] lg:w-[42%] md:h-full -mt-3 md:mt-0 rounded-t-3xl md:rounded-none border-t-4 md:border-t-0 ${currentMeta.stageBorder} bg-[#100d1c] overflow-y-auto shadow-none`}
        style={{
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="min-h-full flex flex-col justify-between gap-3.5 sm:gap-4 p-4 sm:p-5 md:p-7 pb-[calc(3rem+env(safe-area-inset-bottom,0px))] md:pb-7">
          {/* スマホ用ボトムシート上部：引き上げ用つまみ（ドラッグハンドル）＆ スワイプ案内ガイドテキスト */}
          <div className="flex flex-col items-center gap-1 -mt-1 md:hidden shrink-0">
            <div
              className="w-14 h-1.5 rounded-full bg-neutral-400/80 border border-neutral-300/30"
              aria-hidden="true"
            />
          </div>

          {/* 1. 上部：ヘッダー＆選択中キャラクター詳細プロフィール */}
          <div className="flex flex-col gap-2.5 sm:gap-3.5 shrink-0">
            <div className="flex items-center justify-between gap-2 border-b-2 border-[#261f3d] pb-2 sm:pb-3">
              <div>
                <h1 className="text-lg sm:text-2xl font-black text-white tracking-widest font-dotgothic mt-0.5">
                  キャラクター選択
                </h1>
              </div>

              <span className={`px-3 py-1 rounded-full border-2 font-dotgothic font-black text-xs flex items-center gap-1 shrink-0 transition-colors duration-200 ${currentMeta.badgeClass}`}>
                <Check size={14} strokeWidth={3} />
                <span>選択中</span>
              </span>
            </div>

            {/* 選択中キャラクターの名前・プロフィール説明カード */}
            <div
              className={`rounded-2xl bg-[#0b0914] border-2 p-3 sm:p-4 flex flex-col gap-1.5 transition-colors duration-200 ${currentMeta.stageBorder}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg sm:text-2xl font-black text-white font-dotgothic tracking-wide">
                  {activeCharacter.name}
                </h2>
                <span className={`text-[11px] font-dotgothic font-bold px-2 py-0.5 rounded border ${currentMeta.subBadgeClass}`}>
                  {currentMeta.icon} {currentMeta.fullLabel}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-300 font-bold leading-relaxed">
                {activeCharacter.description}
              </p>
            </div>
          </div>

          {/* 2. 中央：ちびキャラ選択エリア（スマホ時は横スライド可能なカルーセルで右端にはみ出し表示、PC時はグリッド） */}
          <div className="flex flex-col gap-2 shrink-0 md:flex-1 md:min-h-0">
            <div className="flex items-center justify-between text-xs font-dotgothic font-bold text-neutral-400 px-1 shrink-0">
              <span>ちびキャラ一覧</span>
              <div className="flex items-center gap-2">
                <span className="md:hidden text-[10px] text-cyan-300/90">◀ 横スライド ▶</span>
                <span className="text-amber-300">{CHARACTERS.length} 名収録</span>
              </div>
            </div>

            <div className="bg-[#0b0914] rounded-2xl border-2 border-[#261f3d] p-3 md:flex-1 md:min-h-0 md:overflow-y-auto mech-scrollbar">
              <div
                className="char-chibi-carousel-scroll mech-scrollbar flex flex-nowrap overflow-x-auto gap-2.5 pb-1.5 pr-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:pb-0 md:pr-0"
                style={{
                  touchAction: 'pan-x pan-y',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {CHARACTERS.map((char) => {
                  const isSelected = char.id === selectedCharacterId;
                  const chibiSrc = char.chibi || char.sprites?.sing_1;

                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => handleSelectCharacter(char)}
                      className={`group relative w-[43%] min-w-[138px] md:w-auto md:min-w-0 shrink-0 snap-start rounded-2xl p-2 sm:p-2.5 flex flex-col items-center gap-1.5 transition-colors cursor-pointer select-none border-4 shadow-none ${
                        isSelected
                          ? 'bg-[#1d1536] border-cyan-400 text-white'
                          : 'bg-[#120e20] hover:bg-[#1a142e] border-[#2b2342] hover:border-amber-400/70 text-neutral-300'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-cyan-400 text-[#09080f] flex items-center justify-center border border-white z-10">
                          <Check size={12} strokeWidth={3.5} />
                        </span>
                      )}

                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#09080f] border-amber-400'
                            : 'bg-[#09080f] border-[#261f3d]'
                        }`}
                      >
                        <img
                          src={chibiSrc}
                          alt={char.name}
                          decoding="async"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <span className="text-[11px] sm:text-xs font-dotgothic font-black text-center truncate w-full px-0.5">
                        {char.name.replace(/\s*\(.*?\)\s*/g, '')}
                      </span>
                    </button>
                  );
                })}

                {/* スマホ時に右端から一部が覗いて「横スライドできる」ことを視覚的に伝える追加枠カード */}
                <div
                  aria-hidden="true"
                  className="md:hidden w-[43%] min-w-[138px] shrink-0 snap-start rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[#352b54] bg-[#0f0c1b] text-neutral-500 select-none"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-dashed border-[#2c2346] bg-[#09080f] flex items-center justify-center font-dotgothic font-black text-base text-purple-400/50">
                    ＋
                  </div>
                  <span className="text-[10px] font-dotgothic font-bold tracking-wider text-neutral-400/80 text-center">
                    COMING SOON
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. 最下部：メニューに戻るボタン（フラットデザイン・下部セーフエリア余白確保済み） */}
          <div className="shrink-0 pt-1">
            <button
              type="button"
              onClick={onBack}
              className="w-full py-3.5 bg-[#1b152e] hover:bg-[#271f42] active:bg-[#322854] text-amber-300 hover:text-amber-200 border-2 border-amber-500/80 rounded-2xl font-dotgothic font-black text-base sm:text-lg tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer select-none shadow-none"
            >
              <Home size={20} />
              <span>メニューに戻る</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
