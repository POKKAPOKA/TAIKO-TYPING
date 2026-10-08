import React, { useState, useRef } from "react";
import { useGameStore } from "../store/gameStore";

const KANA_GRID = [
  { id: "a", label: "あ", chars: ["a", "i", "u", "e", "o"] },
  { id: "k", label: "か", chars: ["ka", "ki", "ku", "ke", "ko"] },
  { id: "s", label: "さ", chars: ["sa", "si", "su", "se", "so"] },
  { id: "t", label: "た", chars: ["ta", "ti", "tu", "te", "to"] },
  { id: "n", label: "な", chars: ["na", "ni", "nu", "ne", "no"] },
  { id: "h", label: "は", chars: ["ha", "hi", "fu", "he", "ho"] },
  { id: "m", label: "ま", chars: ["ma", "mi", "mu", "me", "mo"] },
  { id: "y", label: "や", chars: ["ya", "ya", "yu", "yu", "yo"] },
  { id: "r", label: "ら", chars: ["ra", "ri", "ru", "re", "ro"] },
  { id: "mod", label: "゛゜小", isModifier: true },
  { id: "w", label: "わ", chars: ["wa", "wo", "nn", "-", "-"] },
  { id: "sym", label: "、。？！", chars: [",", ".", "?", "!", "-"] }
];

const DAKUON_MAP = {
  ka: "ga", ki: "gi", ku: "gu", ke: "ge", ko: "go",
  sa: "za", si: "zi", su: "zu", se: "ze", so: "zo",
  ta: "da", ti: "di", tu: "du", te: "de", to: "do",
  ha: "ba", hi: "bi", fu: "bu", he: "be", ho: "bo",
};

const HANDAKUON_MAP = {
  ha: "pa", hi: "pi", fu: "pu", he: "pe", ho: "po",
};

const SMALL_MAP = {
  a: "xa", i: "xi", u: "xu", e: "xe", o: "xo",
  ya: "xya", yu: "xyu", yo: "xyo",
  tu: "xtu", wa: "xwa"
};

const sendKeystrokes = (romajiStr) => {
  for (let i = 0; i < romajiStr.length; i++) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: romajiStr[i] }));
  }
};

export default function FlickKeyboard() {
  const [modifier, setModifier] = useState("none"); // none, dakuon, handakuon, small
  const [activeKey, setActiveKey] = useState(null);
  const [flickDir, setFlickDir] = useState(0); // 0:center, 1:left, 2:up, 3:right, 4:down
  const touchStartPos = useRef(null);

  const handleModifierClick = () => {
    setModifier(prev => {
      if (prev === "none") return "dakuon";
      if (prev === "dakuon") return "handakuon";
      if (prev === "handakuon") return "small";
      return "none";
    });
  };

  const handleTouchStart = (e, keyData) => {
    if (e.cancelable) e.preventDefault(); // スクロールやダブルタップズームを防ぐ
    if (keyData.isModifier) {
      handleModifierClick();
      return;
    }
    setActiveKey(keyData.id);
    setFlickDir(0);
    const touch = e.touches ? e.touches[0] : e;
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
  };

  // 指を動かしている間の方向判定
  const handleGlobalMove = useRef((e) => {
    if (!activeKey || !touchStartPos.current) return;
    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;
    const threshold = 30;

    let dir = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < -threshold) dir = 1; // left
      else if (dx > threshold) dir = 3; // right
    } else {
      if (dy < -threshold) dir = 2; // up
      else if (dy > threshold) dir = 4; // down
    }
    setFlickDir(dir);
  });
  handleGlobalMove.current = (e) => {
    if (!activeKey || !touchStartPos.current) return;
    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;
    const threshold = 30;

    let dir = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < -threshold) dir = 1;
      else if (dx > threshold) dir = 3;
    } else {
      if (dy < -threshold) dir = 2;
      else if (dy > threshold) dir = 4;
    }
    setFlickDir(dir);
  };

  // 指を離した瞬間に発火（キー外で離しても確実に発火させるためグローバルで受ける）
  const handleGlobalEnd = useRef(() => {});
  handleGlobalEnd.current = () => {
    if (!activeKey) return;
    const keyData = KANA_GRID.find(k => k.id === activeKey);
    if (keyData && !keyData.isModifier) {
      let romaji = keyData.chars[flickDir];

      if (modifier === "dakuon" && DAKUON_MAP[romaji]) romaji = DAKUON_MAP[romaji];
      else if (modifier === "handakuon" && HANDAKUON_MAP[romaji]) romaji = HANDAKUON_MAP[romaji];
      else if (modifier === "small" && SMALL_MAP[romaji]) romaji = SMALL_MAP[romaji];

      if (modifier !== "none") setModifier("none");

      sendKeystrokes(romaji);
    }
    setActiveKey(null);
    setFlickDir(0);
    touchStartPos.current = null;
    detachGlobalListeners(); // 入力が確定したらリスナーを解除する
  };

  // グローバルリスナーの登録/解除は、キーが押されている間だけ行う（useEffectは使わずイベント駆動）
  // 二重登録防止のためフラグで管理する
  const listenersAttached = useRef(false);
  const attachGlobalListeners = () => {
    if (listenersAttached.current) return;
    listenersAttached.current = true;
    window.addEventListener('mousemove', handleGlobalMove.current);
    window.addEventListener('mouseup', handleGlobalEnd.current);
    window.addEventListener('touchmove', handleGlobalMove.current, { passive: false });
    window.addEventListener('touchend', handleGlobalEnd.current);
    window.addEventListener('touchcancel', handleGlobalEnd.current);
  };
  const detachGlobalListeners = () => {
    if (!listenersAttached.current) return;
    listenersAttached.current = false;
    window.removeEventListener('mousemove', handleGlobalMove.current);
    window.removeEventListener('mouseup', handleGlobalEnd.current);
    window.removeEventListener('touchmove', handleGlobalMove.current);
    window.removeEventListener('touchend', handleGlobalEnd.current);
    window.removeEventListener('touchcancel', handleGlobalEnd.current);
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[320px] bg-neutral-900/90 p-2 rounded-2xl border-2 border-neutral-700 select-none z-[60] backdrop-blur-md">
      {/* Modifier Status Bar */}
      <div className="flex justify-between items-center mb-2 px-2">
        <span className="text-neutral-400 font-bold text-sm">フリック入力</span>
        <span className="text-cyan-400 font-black text-sm">
          {modifier === "dakuon" ? "濁音 (゛)" : modifier === "handakuon" ? "半濁音 (゜)" : modifier === "small" ? "小文字 (ょ)" : "通常"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KANA_GRID.map((keyData) => (
          <div
            key={keyData.id}
            className={`relative flex items-center justify-center h-16 rounded-xl font-black text-2xl transition-colors cursor-pointer
              ${keyData.isModifier ? "bg-neutral-800 text-purple-400 border-b-4 border-neutral-950" : "bg-neutral-200 text-neutral-900 border-b-4 border-neutral-400"}
              ${activeKey === keyData.id ? "bg-cyan-200 border-cyan-400 text-cyan-900 scale-95" : ""}
            `}
            onMouseDown={(e) => { handleTouchStart(e, keyData); if (!keyData.isModifier) attachGlobalListeners(); }}
            onTouchStart={(e) => { handleTouchStart(e, keyData); if (!keyData.isModifier) attachGlobalListeners(); }}
          >
            {/* Guide Petals */}
            {activeKey === keyData.id && !keyData.isModifier && (
              <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-1/2 -left-10 -translate-y-1/2 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold ${flickDir === 1 ? 'scale-125' : ''}`}>
                  {keyData.chars[1].slice(0, 1).toUpperCase()}
                </div>
                <div className={`absolute -top-10 left-1/2 -translate-x-1/2 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold ${flickDir === 2 ? 'scale-125' : ''}`}>
                  {keyData.chars[2].slice(0, 1).toUpperCase()}
                </div>
                <div className={`absolute top-1/2 -right-10 -translate-y-1/2 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold ${flickDir === 3 ? 'scale-125' : ''}`}>
                  {keyData.chars[3].slice(0, 1).toUpperCase()}
                </div>
                <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold ${flickDir === 4 ? 'scale-125' : ''}`}>
                  {keyData.chars[4].slice(0, 1).toUpperCase()}
                </div>
              </div>
            )}
            <span className="relative z-10 pointer-events-none">{keyData.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
