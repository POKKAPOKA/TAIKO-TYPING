import React, { useState, useRef } from "react";
import { gameEngine } from "../engine/GameEngine";

const KANA_GRID = [
  { id: "a", label: "あ", kana: ["あ", "い", "う", "え", "お"] },
  { id: "k", label: "か", kana: ["か", "き", "く", "け", "こ"] },
  { id: "s", label: "さ", kana: ["さ", "し", "す", "せ", "そ"] },
  { id: "t", label: "た", kana: ["た", "ち", "つ", "て", "と"] },
  { id: "n", label: "な", kana: ["な", "に", "ぬ", "ね", "の"] },
  { id: "h", label: "は", kana: ["は", "ひ", "ふ", "へ", "ほ"] },
  { id: "m", label: "ま", kana: ["ま", "み", "む", "め", "も"] },
  { id: "y", label: "や", kana: ["や", "や", "ゆ", "ゆ", "よ"] },
  { id: "r", label: "ら", kana: ["ら", "り", "る", "れ", "ろ"] },
  { id: "empty", label: "", isDisabled: true },
  { id: "w", label: "わ", kana: ["わ", "を", "ん", "ー", "ー"] },
  { id: "sym", label: "、。？！", kana: ["、", "。", "？", "！", "ー"] }
];

export default function FlickKeyboard() {
  const [activeKey, setActiveKey] = useState(null);
  const [flickDir, setFlickDir] = useState(0); // 0:center, 1:left, 2:up, 3:right, 4:down
  const touchStartPos = useRef(null);

  const handlePointerDown = (e, keyData) => {
    if (keyData.isDisabled) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveKey(keyData.id);
    setFlickDir(0);
    touchStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e, keyData) => {
    if (keyData.isDisabled || activeKey !== keyData.id || !touchStartPos.current) return;

    const dx = e.clientX - touchStartPos.current.x;
    const dy = e.clientY - touchStartPos.current.y;
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
  };

  const handlePointerUp = (e, keyData) => {
    if (keyData.isDisabled || activeKey !== keyData.id) return;

    const selectedKana = keyData.kana[flickDir];
    if (selectedKana) {
      gameEngine.handleFlickInput(selectedKana);
    }

    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
    setActiveKey(null);
    setFlickDir(0);
    touchStartPos.current = null;
  };

  const handlePointerCancel = (e, keyData) => {
    if (keyData.isDisabled || activeKey !== keyData.id) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
    setActiveKey(null);
    setFlickDir(0);
    touchStartPos.current = null;
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-neutral-900/95 p-3 pb-4 rounded-t-3xl border-t-2 border-x-2 border-neutral-700 select-none z-10 backdrop-blur-md touch-none flex-shrink-0 shadow-none">
      {/* Status Bar */}
      <div className="flex justify-between items-center mb-1.5 px-2">
        <span className="text-neutral-400 font-bold text-xs">フリック入力</span>
        <span className="text-cyan-400 font-black text-xs">濁点・小文字は清音でOK</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KANA_GRID.map((keyData) => (
          <div
            key={keyData.id}
            aria-disabled={keyData.isDisabled ? "true" : undefined}
            className={`relative flex items-center justify-center h-14 sm:h-16 rounded-xl font-black text-2xl transition-colors shadow-none
              ${
                keyData.isDisabled
                  ? "bg-neutral-800/60 text-transparent border-b-4 border-neutral-900 pointer-events-none cursor-default"
                  : "bg-neutral-200 text-neutral-900 border-b-4 border-neutral-400 cursor-pointer"
              }
              ${!keyData.isDisabled && activeKey === keyData.id ? "bg-cyan-200 border-cyan-400 text-cyan-900 scale-95" : ""}
            `}
            onPointerDown={(e) => handlePointerDown(e, keyData)}
            onPointerMove={(e) => handlePointerMove(e, keyData)}
            onPointerUp={(e) => handlePointerUp(e, keyData)}
            onPointerCancel={(e) => handlePointerCancel(e, keyData)}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Guide Petals */}
            {activeKey === keyData.id && !keyData.isDisabled && (
              <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-1/2 -left-10 -translate-y-1/2 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-none ${flickDir === 1 ? "scale-125" : ""}`}>
                  {keyData.kana[1]}
                </div>
                <div className={`absolute -top-10 left-1/2 -translate-x-1/2 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-none ${flickDir === 2 ? "scale-125" : ""}`}>
                  {keyData.kana[2]}
                </div>
                <div className={`absolute top-1/2 -right-10 -translate-y-1/2 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-none ${flickDir === 3 ? "scale-125" : ""}`}>
                  {keyData.kana[3]}
                </div>
                <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-none ${flickDir === 4 ? "scale-125" : ""}`}>
                  {keyData.kana[4]}
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
