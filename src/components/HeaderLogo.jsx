import titleLogo from '../assets/title_logo2.png';

export default function HeaderLogo({ onHome }) {
  return (
    <button type="button" onClick={onHome} title="ホーム画面に戻る" aria-label="ホーム画面に戻る" className="block h-8 w-[4.75rem] sm:h-10 sm:w-[6rem] shrink-0 cursor-pointer transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
      <img src={titleLogo} alt="" className="h-full w-full object-contain" />
    </button>
  );
}
