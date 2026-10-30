import React from 'react';
import { useGameStore } from '../store/gameStore';
import { Share, PlusSquare, Smartphone, X } from 'lucide-react';

// 表示・自動消去の管理はgameStore側で行うため、ここでは描画だけを担当する
const Toast = () => {
  const toastMessage = useGameStore((state) => state.toastMessage);
  const showPwaGuideModal = useGameStore((state) => state.showPwaGuideModal);
  const setShowPwaGuideModal = useGameStore((state) => state.setShowPwaGuideModal);

  return (
    <>
      {toastMessage && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bg-[#120d24] text-white px-5 py-3 rounded-2xl border-2 border-cyan-400 z-[100000] font-bold tracking-wider text-xs sm:text-sm text-center max-w-[92vw] shadow-none pointer-events-none"
          style={{ bottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {toastMessage}
        </div>
      )}

      {showPwaGuideModal && (
        <div
          className="modal-overlay bg-black/80 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPwaGuideModal(false);
            }
          }}
        >
          {/* フラット・角丸・影なしのデジタル雅ミニモーダル */}
          <div
            className="mech-grid-bg w-full max-w-md rounded-2xl border-2 border-cyan-400 p-1.5 relative shadow-none text-white select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 四隅L字ブラケット装飾 */}
            <div className="pointer-events-none absolute inset-1.5 z-20">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 rounded-tl-md border-amber-400" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 rounded-tr-md border-amber-400" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 rounded-bl-md border-amber-400" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 rounded-br-md border-amber-400" />
            </div>

            <div className="rounded-xl border-2 border-purple-500/45 bg-[#0b0914] p-4 sm:p-5 flex flex-col gap-4">
              {/* ヘッダー */}
              <div className="flex items-center justify-between gap-2 border-b-2 border-[#261f3d] pb-3">
                <div className="flex items-center gap-2">
                  <span className="bg-cyan-400 text-[#09080f] px-2 py-0.5 rounded-md font-dotgothic font-black text-[11px] tracking-wider flex items-center gap-1">
                    <Smartphone size={13} />
                    <span>PWA FULLSCREEN</span>
                  </span>
                  <h3 className="font-dotgothic font-black text-base sm:text-lg text-cyan-200 tracking-wide">
                    全画面プレイのご案内
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPwaGuideModal(false)}
                  className="w-8 h-8 rounded-lg bg-[#1a142c] hover:bg-rose-600 text-amber-300 hover:text-white border-2 border-amber-400/60 hover:border-rose-300 flex items-center justify-center transition-colors cursor-pointer shadow-none"
                  aria-label="閉じる"
                >
                  <X size={18} />
                </button>
              </div>

              {/* メイン案内メッセージ */}
              <p className="text-xs sm:text-sm font-bold text-white leading-relaxed bg-[#140f26] border-2 border-cyan-500/50 rounded-xl p-3.5">
                スマホで全画面プレイするには、ブラウザの共有メニューから
                <span className="text-amber-300 font-black">『ホーム画面に追加』</span>
                して起動してください。
              </p>

              {/* 手順ステップ */}
              <div className="flex flex-col gap-2 text-xs font-bold text-purple-100">
                <div className="flex items-center gap-2.5 bg-[#0f0b1c] border border-[#2a2244] rounded-xl px-3 py-2.5">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-dotgothic font-black flex items-center justify-center shrink-0">
                    1
                  </span>
                  <Share size={15} className="text-cyan-300 shrink-0" />
                  <span>ブラウザの「共有」ボタン（またはメニュー）をタップ</span>
                </div>

                <div className="flex items-center gap-2.5 bg-[#0f0b1c] border border-[#2a2244] rounded-xl px-3 py-2.5">
                  <span className="w-6 h-6 rounded-lg bg-pink-500/20 border border-pink-400 text-pink-300 font-dotgothic font-black flex items-center justify-center shrink-0">
                    2
                  </span>
                  <PlusSquare size={15} className="text-pink-300 shrink-0" />
                  <span>メニュー内の「ホーム画面に追加」を選択して追加</span>
                </div>

                <div className="flex items-center gap-2.5 bg-[#0f0b1c] border border-[#2a2244] rounded-xl px-3 py-2.5">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 font-dotgothic font-black flex items-center justify-center shrink-0">
                    3
                  </span>
                  <Smartphone size={15} className="text-amber-300 shrink-0" />
                  <span>ホーム画面の「太鼓タイピング」から起動するとバー無し全画面に！</span>
                </div>
              </div>

              {/* 閉じるボタン */}
              <button
                type="button"
                onClick={() => setShowPwaGuideModal(false)}
                className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#09080f] border-2 border-cyan-200 font-dotgothic font-black text-sm tracking-widest transition-colors cursor-pointer shadow-none"
              >
                閉じる [OK]
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Toast;
