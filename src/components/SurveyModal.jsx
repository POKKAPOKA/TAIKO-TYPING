import React from 'react';
import { SURVEY_FORM_URL, GAME_PUBLIC_URL, getQrCodeImageUrl } from '../constants/links';
import { ExternalLink, Smartphone, ClipboardCheck, QrCode, X } from 'lucide-react';

export default function SurveyModal({ onClose }) {
  const surveyQrUrl = getQrCodeImageUrl(SURVEY_FORM_URL, 200);
  const gameQrUrl = getQrCodeImageUrl(GAME_PUBLIC_URL, 200);

  return (
    <div
      className="modal-overlay bg-black/85 flex items-center justify-center p-2.5 sm:p-5 md:p-8 overflow-y-auto mech-scrollbar"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* 外枠：二重枠線＋四隅L字ブラケット＋漆黒メカニカルグリッド（フラット・角丸・影なし） */}
      <div
        className="mech-grid-bg w-full max-w-2xl max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col rounded-2xl sm:rounded-3xl border-2 border-pink-400 p-1 sm:p-1.5 overflow-hidden shadow-none my-auto relative z-10 select-none text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 四隅コーナーブラケット装飾 */}
        <div className="pointer-events-none absolute inset-1.5 z-20">
          <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 rounded-tl-md border-cyan-400" />
          <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 rounded-tr-md border-cyan-400" />
          <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 rounded-bl-md border-cyan-400" />
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 rounded-br-md border-cyan-400" />
        </div>

        {/* 内側フレーム */}
        <div className="flex flex-col flex-1 min-h-0 rounded-xl sm:rounded-2xl border-2 border-purple-500/45 bg-[#0b0914] overflow-hidden">
          {/* ヘッダーパネル */}
          <div className="bg-[#130e24] px-4 py-3.5 sm:px-6 sm:py-4 flex justify-between items-center border-b-2 border-pink-500/50 shrink-0 relative z-20">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] sm:text-xs font-dotgothic font-black tracking-widest text-pink-200 bg-pink-500/20 border border-pink-400/70 px-2 py-0.5 rounded-md">
                  アンケート
                </span>
                <span className="text-[10px] sm:text-xs font-dotgothic font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-400/60 px-2 py-0.5 rounded-md">
                  所要時間：約45秒
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white tracking-wider font-dotgothic mt-1">
                アンケートのご案内
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 sm:w-11 sm:h-11 bg-[#1c1530] hover:bg-rose-600 text-pink-200 hover:text-white rounded-xl border-2 border-pink-400/60 hover:border-rose-300 font-black flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-none"
              title="閉じる"
              aria-label="モーダルを閉じる"
            >
              <X size={22} />
            </button>
          </div>

          {/* メインコンテンツ領域 */}
          <div className="mech-scrollbar flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 min-h-0">
            {/* 説明文バナー */}
            <div className="rounded-xl bg-[#16102b] border-2 border-pink-400/60 px-4 py-3 text-center">
              <p className="text-xs sm:text-base font-bold text-white leading-relaxed">
                本日はプレイありがとうございます！
                <span className="text-amber-300 font-black">簡単なアンケート</span>
                へのご協力をお願いします。
              </p>
            </div>

            {/* 直接リンクボタン（スマホ・PC共通：ワンタップで別タブ回答） */}
            <a
              href={SURVEY_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 sm:py-4 px-4 rounded-2xl bg-pink-500 hover:bg-pink-400 active:bg-pink-600 text-white border-2 border-pink-200 font-dotgothic font-black text-sm sm:text-lg tracking-wider flex items-center justify-center gap-2.5 transition-colors cursor-pointer shadow-none no-underline"
            >
              <ClipboardCheck size={20} className="shrink-0" />
              <span>Googleフォームを開いて回答する ↗</span>
              <ExternalLink size={18} className="shrink-0" />
            </a>

            {/* ブース展示用・2カラムQRコードエリア（アンケートQR ＆ お持ち帰りスマホ版URL QR） */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              {/* 左カラム：アンケートQRコード */}
              <div className="rounded-2xl border-2 border-pink-400/75 bg-[#100c1e] p-4 flex flex-col items-center justify-between gap-3 text-center">
                <div className="w-full flex flex-col items-center gap-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-pink-500/20 border border-pink-400 text-pink-200 font-dotgothic font-black text-xs">
                    <QrCode size={13} />
                    <span>📝 アンケート回答用QR</span>
                  </span>
                  <h3 className="font-dotgothic font-black text-sm sm:text-base text-white mt-0.5">
                    スマホのカメラで読み取って回答
                  </h3>
                </div>

                <div className="bg-white p-3 rounded-2xl border-4 border-pink-400 flex items-center justify-center">
                  <img
                    src={surveyQrUrl}
                    alt="アンケート用Googleフォーム QRコード"
                    width="180"
                    height="180"
                    className="w-36 h-36 sm:w-44 sm:h-44 object-contain block"
                  />
                </div>

                <p className="text-xs font-bold text-purple-200/90 leading-relaxed">
                  ご自身のスマホでQRを読み取ると、お席を離れた後でもゆっくり回答いただけます！
                </p>
              </div>

              {/* 右カラム：お家のスマホでも遊べる！ゲーム公開URL QRコード */}
              <div className="rounded-2xl border-2 border-cyan-400/75 bg-[#100c1e] p-4 flex flex-col items-center justify-between gap-3 text-center">
                <div className="w-full flex flex-col items-center gap-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-dotgothic font-black text-xs">
                    <Smartphone size={13} />
                    <span>📱 お持ち帰りプレイ用QR</span>
                  </span>
                  <h3 className="font-dotgothic font-black text-sm sm:text-base text-cyan-200 mt-0.5">
                    お家のスマホでも遊べる！ゲームURL
                  </h3>
                </div>

                <div className="bg-white p-3 rounded-2xl border-4 border-cyan-400 flex items-center justify-center">
                  <img
                    src={gameQrUrl}
                    alt="お家のスマホでも遊べるゲーム公開URL QRコード"
                    width="180"
                    height="180"
                    className="w-36 h-36 sm:w-44 sm:h-44 object-contain block"
                  />
                </div>

                <div className="w-full flex flex-col gap-1">
                  <p className="text-xs font-bold text-cyan-100/90 leading-relaxed">
                    スマホのフリック入力にも完全対応！「ホーム画面に追加」で全画面アプリとして遊べます。
                  </p>
                  <span className="text-[11px] font-mono text-cyan-300/80 bg-[#090712] border border-cyan-500/30 rounded-lg px-2 py-1 truncate">
                    {GAME_PUBLIC_URL}
                  </span>
                </div>
              </div>
            </div>

            {/* フッター：SRBクレジット ＆ 閉じるボタン */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <span className="text-xs font-dotgothic font-bold text-purple-300/80 tracking-widest">
                Presented by サークル SRB
              </span>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3 bg-[#1c1530] hover:bg-[#281e45] text-amber-300 hover:text-amber-200 rounded-xl border-2 border-amber-400/70 font-dotgothic font-black text-sm sm:text-base tracking-widest transition-colors cursor-pointer shadow-none"
              >
                閉じる [CLOSE]
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
