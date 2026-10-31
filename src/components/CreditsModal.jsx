import { useCallback } from 'react';
import { X } from 'lucide-react';

const creators = [
  ['発想・考案', 'ぽっかぽか'],
  ['キャラクター', 'ナオキ 様'],
  ['待機・リザルトBGM', 'ナオキ 様'],
  ['タイトルロゴ', 'ナオキ 様'],
  ['タイトル背景', 'ナオキ 様'],
  ['リザルト背景', 'はーばー 様'],
  ['譜面制作', 'SRBメンバー'],
  ['特別？？？', '222 様'],
];

const agents = ['Gemini 4 Argon', 'GPT-6.1 Terra'];
const tools = ['Antigravity', 'ChatGPT', 'VS Code', 'GitHub', 'Vercel', 'Supabase', 'React', 'Vite', 'JavaScript', 'Tailwind CSS'];

export default function CreditsModal({ onClose }) {
  const focusCloseButton = useCallback((node) => {
    if (!node) return;
    const previousFocus = document.activeElement;
    node.focus();
    return () => previousFocus?.focus?.();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
    if (event.key === 'Tab') {
      const focusable = Array.from(event.currentTarget.querySelectorAll('button, [tabindex="0"]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="modal-overlay bg-[#080515]/90 flex items-center justify-center p-3" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="credits-title" onKeyDown={handleKeyDown} className="relative w-full max-w-2xl max-h-[85dvh] flex flex-col rounded-2xl border-2 border-pink-400 bg-[#120a28] p-1.5 text-white shadow-none">
        <div aria-hidden="true" className="pointer-events-none absolute inset-2 z-10">
          <span className="absolute top-0 left-0 h-4 w-4 rounded-tl border-t-2 border-l-2 border-cyan-300" />
          <span className="absolute top-0 right-0 h-4 w-4 rounded-tr border-t-2 border-r-2 border-cyan-300" />
          <span className="absolute bottom-0 left-0 h-4 w-4 rounded-bl border-b-2 border-l-2 border-cyan-300" />
          <span className="absolute bottom-0 right-0 h-4 w-4 rounded-br border-b-2 border-r-2 border-cyan-300" />
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border-2 border-cyan-400/70">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-pink-400/60 bg-[#1a1032] px-4 py-3 sm:px-6">
            <h2 id="credits-title" className="font-dotgothic text-base font-bold tracking-wide text-pink-100 sm:text-xl">CREDITS</h2>
            <button ref={focusCloseButton} type="button" onClick={onClose} aria-label="クレジットを閉じる" className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-pink-400 bg-[#261838] text-pink-100 transition-colors hover:border-cyan-300 hover:bg-[#38204a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"><X size={22} /></button>
          </header>
          <div tabIndex={0} aria-label="クレジット一覧" className="mech-scrollbar min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <section aria-labelledby="credits-creators">
              <h3 id="credits-creators" className="font-dotgothic text-sm font-bold text-pink-200 sm:text-base">【 制作・クリエイター陣 】</h3>
              <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {creators.map(([role, name]) => (
                  <div key={role} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${role === '特別？？？' ? 'border-amber-300 bg-[#332414] text-amber-100' : 'border-purple-400/60 bg-[#211630]'}`}>
                    <dt className={`text-xs font-bold ${role === '特別？？？' ? 'text-amber-300' : 'text-pink-200'}`}>{role}</dt><dd className="text-right text-sm font-bold">{name}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="mt-5" aria-labelledby="credits-agents">
              <h3 id="credits-agents" className="font-dotgothic text-sm font-bold text-cyan-200 sm:text-base">【 AIエージェント 】</h3>
              <ul className="mt-3 flex flex-wrap gap-2">{agents.map((agent) => <li key={agent} className="rounded-full border border-cyan-400 bg-[#102b39] px-3 py-1.5 text-sm font-bold text-cyan-100">{agent}</li>)}</ul>
            </section>
            <section className="mt-5" aria-labelledby="credits-tools">
              <h3 id="credits-tools" className="font-dotgothic text-sm font-bold text-pink-200 sm:text-base">【 使用ツール・言語 】</h3>
              <ul className="mt-3 flex flex-wrap gap-2">{tools.map((tool) => <li key={tool} className="rounded-full border border-purple-400/80 bg-[#2b1838] px-3 py-1 text-xs font-bold text-pink-100">{tool}</li>)}</ul>
            </section>
            <footer className="mt-6 border-t border-purple-400/40 pt-4 text-center font-dotgothic text-xs tracking-widest text-purple-200">Produced by SRB</footer>
          </div>
        </div>
      </section>
    </div>
  );
}
