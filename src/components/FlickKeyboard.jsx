import { useRef, useState } from 'react';
import { gameEngine } from '../engine/GameEngine';

// 各配列の順番は中央、左、上、右、下。
const KANA_GRID = [
  { id: 'a', label: 'あ', values: ['あ', 'い', 'う', 'え', 'お'] },
  { id: 'k', label: 'か', values: ['か', 'き', 'く', 'け', 'こ'] },
  { id: 's', label: 'さ', values: ['さ', 'し', 'す', 'せ', 'そ'] },
  { id: 't', label: 'た', values: ['た', 'ち', 'つ', 'て', 'と'] },
  { id: 'n', label: 'な', values: ['な', 'に', 'ぬ', 'ね', 'の'] },
  { id: 'h', label: 'は', values: ['は', 'ひ', 'ふ', 'へ', 'ほ'] },
  { id: 'm', label: 'ま', values: ['ま', 'み', 'む', 'め', 'も'] },
  { id: 'y', label: 'や', values: ['や', 'や', 'ゆ', 'ゆ', 'よ'] },
  { id: 'r', label: 'ら', values: ['ら', 'り', 'る', 'れ', 'ろ'] },
  { id: 'switch', isSwitch: true },
  { id: 'w', label: 'わ', values: ['わ', 'を', 'ん', 'ー', 'ー'] },
  { id: 'long', label: 'ー', values: ['ー', 'ー', 'ー', 'ー', 'ー'] },
];

const ENGLISH_GRID = [
  { id: 'abc', values: ['a', 'b', 'c'] },
  { id: 'def', values: ['d', 'e', 'f'] },
  { id: 'ghi', values: ['g', 'h', 'i'] },
  { id: 'jkl', values: ['j', 'k', 'l'] },
  { id: 'mno', values: ['m', 'n', 'o'] },
  { id: 'pqr', values: ['p', 'q', 'r'] },
  { id: 'stu', values: ['s', 't', 'u'] },
  { id: 'vwx', values: ['v', 'w', 'x'] },
  { id: 'yz', values: ['y', 'z'] },
  { id: 'switch', isSwitch: true },
  { id: 'numbers1', values: ['1', '2', '3', '4', '5'] },
  { id: 'numbers2', values: ['6', '7', '8', '9', '0'] },
];

const DIRECTIONS = ['中央', '左', '上', '右', '下'];
const ARROWS = ['', '←', '↑', '→', '↓'];

export default function FlickKeyboard() {
  const [keyboardMode, setKeyboardMode] = useState('kana');
  const [activeKey, setActiveKey] = useState(null);
  const [flickDir, setFlickDir] = useState(0);
  const pointer = useRef(null);
  const isEnglish = keyboardMode === 'english';
  const keys = isEnglish ? ENGLISH_GRID : KANA_GRID;

  const handlePointerDown = (event, keyData) => {
    if (pointer.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { id: keyData.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, direction: 0 };
    setActiveKey(keyData.id);
    setFlickDir(0);
  };

  const handlePointerMove = (event, keyData) => {
    const current = pointer.current;
    if (!current || current.id !== keyData.id || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    const threshold = 30;
    let direction = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < -threshold) direction = 1;
      else if (dx > threshold) direction = 3;
    } else {
      if (dy < -threshold) direction = 2;
      else if (dy > threshold) direction = 4;
    }
    current.direction = direction;
    setFlickDir(direction);
  };

  const finishPointer = (event, keyData, cancelled = false) => {
    const current = pointer.current;
    if (!current || current.id !== keyData.id || current.pointerId !== event.pointerId) return;
    const selected = keyData.values[current.direction];
    pointer.current = null;
    setActiveKey(null);
    setFlickDir(0);
    if (!cancelled && selected) gameEngine.handleFlickInput(selected);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* 解除済みの場合 */ }
  };

  return (
    <div className="flick-keyboard-safe-bottom w-full max-w-sm mx-auto bg-neutral-900/95 px-3 pt-3 rounded-t-3xl border-t-2 border-x-2 border-neutral-700 select-none z-10 touch-none flex-shrink-0 shadow-none">
      <div className="flex justify-between items-center mb-1.5 px-2 gap-2">
        <span className="text-neutral-400 font-bold text-xs">{isEnglish ? '英字・数字入力' : 'フリック入力'}</span>
        <span className="text-cyan-400 font-black text-xs text-right">{isEnglish ? '中央をタップ・矢印方向にフリック' : '濁点・小文字は清音でOK'}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {keys.map((keyData) => keyData.isSwitch ? (
          <button key="switch" type="button" aria-label={isEnglish ? 'かなキーボードに切り替える' : '英字・数字キーボードに切り替える'} onClick={() => setKeyboardMode(isEnglish ? 'kana' : 'english')} className="h-14 sm:h-16 rounded-xl border-2 border-cyan-400 bg-[#183245] text-cyan-100 font-bold text-sm cursor-pointer hover:bg-[#23475a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
            {isEnglish ? '⇄ かな' : '⇄ 英字・数字'}
          </button>
        ) : (
          <button
            key={keyData.id}
            type="button"
            aria-label={isEnglish ? keyData.values.map((value, index) => `${DIRECTIONS[index]} ${value.toUpperCase()}`).join('、') : keyData.label}
            className={`relative flex flex-col items-center justify-center h-14 sm:h-16 rounded-xl font-black transition-colors shadow-none border-b-4 cursor-pointer ${activeKey === keyData.id ? 'z-20 bg-cyan-200 border-cyan-400 text-cyan-900 scale-95' : 'bg-neutral-200 text-neutral-900 border-neutral-400'}`}
            onPointerDown={(event) => handlePointerDown(event, keyData)}
            onPointerMove={(event) => handlePointerMove(event, keyData)}
            onPointerUp={(event) => finishPointer(event, keyData)}
            onPointerCancel={(event) => finishPointer(event, keyData, true)}
            onLostPointerCapture={(event) => finishPointer(event, keyData, true)}
            onClick={(event) => { if (event.detail === 0) gameEngine.handleFlickInput(keyData.values[0]); }}
            onContextMenu={(event) => event.preventDefault()}
          >
            {activeKey === keyData.id && (
              <span className="absolute inset-0 pointer-events-none" aria-hidden="true">
                {keyData.values.slice(1).map((value, index) => (
                  <span key={index} className={`absolute w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center text-white text-xs font-bold ${['top-1/2 -left-10 -translate-y-1/2', '-top-10 left-1/2 -translate-x-1/2', 'top-1/2 -right-10 -translate-y-1/2', '-bottom-10 left-1/2 -translate-x-1/2'][index]} ${flickDir === index + 1 ? 'scale-125' : ''}`}>
                    {value.toUpperCase()}
                  </span>
                ))}
              </span>
            )}
            <span className="relative z-10 pointer-events-none text-2xl leading-none">{(keyData.label || keyData.values[0]).toUpperCase()}</span>
            {isEnglish && <span aria-hidden="true" className="pointer-events-none mt-0.5 text-[10px] leading-none tracking-tight">{keyData.values.slice(1).map((value, index) => `${ARROWS[index + 1]}${value.toUpperCase()}`).join(' ')}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
