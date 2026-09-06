import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import EditorNote from './EditorNote';
import EditorSeekBar from './EditorSeekBar';

const BEATS_PER_MEASURE = 4;

export default function EditorTimeline() {
  const containerRef = useRef(null);
  const rulerRef = useRef(null);
  const rulerDragState = useRef({ isDragging: false, wasPlaying: false });

  const bpm = useEditorStore(state => state.bpm);
  const scrollTimeOffset = useEditorStore(state => state.scrollTimeOffset);
  const setScrollTimeOffset = useEditorStore(state => state.setScrollTimeOffset);
  const editorNotes = useEditorStore(state => state.editorNotes);
  const addEditorNote = useEditorStore(state => state.addEditorNote);
  
  const timelineWidth = useEditorStore(state => state.timelineWidth);
  const setTimelineWidth = useEditorStore(state => state.setTimelineWidth);
  const measureWidth = useEditorStore(state => state.measureWidth);
  const setCurrentTime = useEditorStore(state => state.setCurrentTime);
  const setSeekRequest = useEditorStore(state => state.setSeekRequest);
  const setIsPlaying = useEditorStore(state => state.setIsPlaying);

  const msPerBeat = 60000 / bpm;
  const msPerMeasure = msPerBeat * BEATS_PER_MEASURE;
  const pxPerMs = measureWidth / msPerMeasure;
  
  const beatWidth = measureWidth / BEATS_PER_MEASURE;
  const note16Width = beatWidth / 4;

  const fixedTimelineWidth = measureWidth * 4;

  useEffect(() => {
    setTimelineWidth(fixedTimelineWidth);
  }, [setTimelineWidth, fixedTimelineWidth]);

  const handleWheel = (e) => {
    // deltaY を利用して細かくスクロールさせる。係数 0.5 などを掛ける。
    // deltaY はピクセル単位。これを時間に変換してオフセットに足す。
    if (!pxPerMs || Number.isNaN(pxPerMs)) return;
    const deltaMs = (e.deltaY * 0.5) / pxPerMs;
    if (Number.isNaN(deltaMs)) return;
    
    let newOffset = scrollTimeOffset + deltaMs;
    if (Number.isNaN(newOffset)) newOffset = 0;
    
    // スクロールが極端なマイナスにいかないようにガード
    if (newOffset < -10000) newOffset = -10000;
    
    setScrollTimeOffset(newOffset);
  };

  // --- ルーラーでのシーク処理 ---
  const calculateTimeFromEvent = (e) => {
    const rect = rulerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const absoluteBeats = (offsetX / beatWidth) + (scrollTimeOffset / msPerBeat);
    return absoluteBeats * msPerBeat;
  };

  const handleRulerPointerDown = (e) => {
    e.stopPropagation();
    const state = useEditorStore.getState();
    rulerDragState.current = { isDragging: true, wasPlaying: state.isPlaying };
    if (state.isPlaying) {
      setIsPlaying(false);
    }
    const targetTime = calculateTimeFromEvent(e);
    setCurrentTime(targetTime);
    
    window.addEventListener('pointermove', handleRulerPointerMove);
    window.addEventListener('pointerup', handleRulerPointerUp);
  };

  const handleRulerPointerMove = (e) => {
    if (!rulerDragState.current.isDragging) return;

    // スロットリング用の時刻管理 (シークバー用)
    window._lastAutoScrollTimeRuler = window._lastAutoScrollTimeRuler || 0;
    const now = performance.now();
    const canScroll = now - window._lastAutoScrollTimeRuler > 500;

    if (canScroll) {
      if (e.clientX > window.innerWidth * 0.9) {
        setScrollTimeOffset(useEditorStore.getState().scrollTimeOffset + (msPerBeat * 4));
        window._lastAutoScrollTimeRuler = now;
      } else if (e.clientX < window.innerWidth * 0.1) {
        const store = useEditorStore.getState();
        if (store.scrollTimeOffset >= (msPerBeat * 4)) {
          setScrollTimeOffset(store.scrollTimeOffset - (msPerBeat * 4));
          window._lastAutoScrollTimeRuler = now;
        }
      }
    }

    const targetTime = calculateTimeFromEvent(e);
    setCurrentTime(targetTime);
  };

  const handleRulerPointerUp = (e) => {
    window.removeEventListener('pointermove', handleRulerPointerMove);
    window.removeEventListener('pointerup', handleRulerPointerUp);
    
    if (!rulerDragState.current.isDragging) return;
    rulerDragState.current.isDragging = false;
    
    const targetTime = calculateTimeFromEvent(e);
    setSeekRequest(targetTime);

    if (rulerDragState.current.wasPlaying) {
      setIsPlaying(true);
    }
  };
  // -----------------------------

  // タイムライン背景のクリック
  const handleTimelineClick = (e) => {
    // ドラッグ直後等のためにフラグを見る
    if (window._isEditorDragging) return;
    
    // Noteやハンドルなどをクリックした場合は配置しない
    if (e.target !== containerRef.current && !e.target.dataset.isTimelineBg) return;

    // 背景クリックで選択解除
    useEditorStore.getState().setSelectedNoteId(null);

    // コンテナ内の相対X座標
    const rect = containerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    
    // オフセットXを拍(beat)に変換
    const absoluteBeats = (offsetX / beatWidth) + (scrollTimeOffset / msPerBeat);
    
    // 0.25(16分音符)単位にスナップ
    const snappedBeats = Math.max(0, Math.round(absoluteBeats / 0.25) * 0.25);
    
    const measure = Math.floor(snappedBeats / 4);
    const beat = snappedBeats % 4;

    addEditorNote({
      id: Date.now(),
      measure,
      beat,
      durationBeats: 0.25, 
      word: "WORD"
    });
  };

  const gridBackground = {
    backgroundImage: `
      linear-gradient(to right, rgba(255,255,255,0.3) 2px, transparent 2px),
      linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
      linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px)
    `,
    backgroundSize: `${measureWidth}px 100%, ${beatWidth}px 100%, ${note16Width}px 100%`,
    backgroundPosition: `-${(scrollTimeOffset / msPerBeat) * beatWidth}px 0, -${(scrollTimeOffset / msPerBeat) * beatWidth}px 0, -${(scrollTimeOffset / msPerBeat) * beatWidth}px 0`
  };

  const [marquee, setMarquee] = useState(null);

  const handleTimelinePointerDown = (e) => {
    // 右クリックでMarquee選択開始
    if (e.button === 2) {
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMarquee({ startX: x, startY: y, currentX: x, currentY: y });
      
      const onMove = (moveEvent) => {
        const moveX = moveEvent.clientX - rect.left;
        const moveY = moveEvent.clientY - rect.top;
        setMarquee(prev => prev ? { ...prev, currentX: moveX, currentY: moveY } : null);
      };
      
      const onUp = (upEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        
        setMarquee(currentMarquee => {
          if (currentMarquee) {
            // 選択判定
            const left = Math.min(currentMarquee.startX, currentMarquee.currentX);
            const right = Math.max(currentMarquee.startX, currentMarquee.currentX);
            const top = Math.min(currentMarquee.startY, currentMarquee.currentY);
            const bottom = Math.max(currentMarquee.startY, currentMarquee.currentY);
            
            const store = useEditorStore.getState();
            const containerHeight = rect.height;
            const noteYTop = (containerHeight / 2) - 32;
            const noteYBottom = (containerHeight / 2) + 32;
            
            const selectedIds = [];
            store.editorNotes.forEach(note => {
              const noteTotalBeats = (note.measure * 4) + note.beat;
              const scrollBeats = store.scrollTimeOffset / msPerBeat;
              const noteXLeft = (noteTotalBeats - scrollBeats) * beatWidth;
              const noteXRight = noteXLeft + (note.durationBeats * beatWidth);
              
              const intersectX = left < noteXRight && right > noteXLeft;
              const intersectY = top < noteYBottom && bottom > noteYTop;
              
              if (intersectX && intersectY) {
                selectedIds.push(note.id);
              }
            });
            
            if (upEvent.ctrlKey || upEvent.metaKey) {
              const newSet = new Set([...store.selectedNoteIds, ...selectedIds]);
              store.setSelectedNoteIds(Array.from(newSet));
            } else {
              store.setSelectedNoteIds(selectedIds);
            }
          }
          return null;
        });
      };
      
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    }
  };

  return (
    <div 
      className="bg-neutral-900 rounded-3xl overflow-hidden border-4 border-neutral-700 relative mx-auto flex-shrink-0 flex flex-col"
      style={{
        width: `${fixedTimelineWidth}px`,
        minWidth: `${fixedTimelineWidth}px`,
        boxSizing: 'content-box',
        height: '100%',
        minHeight: '280px'
      }}
    >
      {/* ルーラー領域 */}
      <div 
        ref={rulerRef}
        className="w-full h-8 bg-neutral-800 border-b-2 border-neutral-700 cursor-text flex-shrink-0 relative"
        onPointerDown={handleRulerPointerDown}
      >
        {/* スクロールに応じた目盛りを描画してもよいが、今回はシンプルな帯として扱う */}
      </div>

      {/* タイムライン領域 */}
      <div
        ref={containerRef}
        data-is-timeline-bg="true"
        className="w-full flex-grow relative cursor-crosshair overflow-hidden"
        onWheel={handleWheel}
        onClick={handleTimelineClick}
        onPointerDown={handleTimelinePointerDown}
        onContextMenu={e => e.preventDefault()}
        style={{ ...gridBackground }}
      >
        {/* 波形表示 */}
        {useEditorStore.getState().audioPeaks?.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="#06b6d4" // cyan-500
              strokeWidth="2"
              points={useEditorStore.getState().audioPeaks.map((peak, index) => {
                // 1 peak は 50ms。絶対時間は index * 50 ms。
                const absoluteMs = index * 50;
                // px位置は (絶対時間 - スクロールオフセット) * pxPerMs
                const x = (absoluteMs - scrollTimeOffset) * pxPerMs;
                // y はコンテナの中央から peak に応じて上下に振る（0 ~ 1の値をピクセルに）
                const y = 100 - (peak * 100); 
                return `${x},${y}`;
              }).join(' ')}
              style={{ transform: 'translateY(50%)', transformOrigin: 'center' }}
            />
          </svg>
        )}

        {/* Marquee UI */}
        {marquee && (
          <div 
            className="absolute bg-blue-500/20 border border-blue-500 rounded-sm pointer-events-none z-50"
            style={{
              left: Math.min(marquee.startX, marquee.currentX),
              top: Math.min(marquee.startY, marquee.currentY),
              width: Math.abs(marquee.currentX - marquee.startX),
              height: Math.abs(marquee.currentY - marquee.startY)
            }}
          />
        )}

        <div className="absolute bottom-4 left-4 text-neutral-500 font-mono text-sm bg-neutral-950 px-3 py-1 rounded-full z-20 pointer-events-none">
          TIME: {Math.round(scrollTimeOffset)} ms
        </div>
        
        <EditorSeekBar />

        {/* 配置されたノーツの描画 */}
        {editorNotes.map(note => (
          <EditorNote 
            key={note.id}
            note={note}
            beatWidth={beatWidth}
            msPerBeat={msPerBeat}
          />
        ))}
      </div>
    </div>
  );
}
