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
  const baseMeasureWidth = useEditorStore(state => state.measureWidth);
  const zoomLevel = useEditorStore(state => state.zoomLevel);
  const setCurrentTime = useEditorStore(state => state.setCurrentTime);
  const setSeekRequest = useEditorStore(state => state.setSeekRequest);
  const setIsPlaying = useEditorStore(state => state.setIsPlaying);

  const audioDuration = useEditorStore(state => state.audioDuration);

  const measureWidth = baseMeasureWidth * zoomLevel;

  const msPerBeat = 60000 / bpm;
  const msPerMeasure = msPerBeat * BEATS_PER_MEASURE;
  const pxPerMs = measureWidth / msPerMeasure;
  
  const beatWidth = measureWidth / BEATS_PER_MEASURE;
  const note16Width = beatWidth / 4;

  let maxNoteBeats = 0;
  editorNotes.forEach(n => {
    const beats = n.measure * 4 + n.beat + (n.durationBeats || 0);
    if (beats > maxNoteBeats) maxNoteBeats = beats;
  });
  const fallbackDuration = Math.max(30000, maxNoteBeats * msPerBeat + 5000);
  const effectiveDuration = audioDuration || fallbackDuration;

  const continuousTimelineWidth = Math.max(effectiveDuration * pxPerMs, window.innerWidth * 2);

  useEffect(() => {
    setTimelineWidth(continuousTimelineWidth);
  }, [setTimelineWidth, continuousTimelineWidth]);

  const viewportRef = useRef(null);

  // 外部から（Stop & Resetなど）scrollTimeOffset が 0 にリセットされた場合の同期
  useEffect(() => {
    if (scrollTimeOffset === 0 && viewportRef.current && viewportRef.current.scrollLeft > 0) {
      viewportRef.current.scrollLeft = 0;
    }
  }, [scrollTimeOffset]);

  useEffect(() => {
    const handleNativeWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const store = useEditorStore.getState();
        
        // 現在の画面中央の時間 (ms)
        const centerTimeMs = (viewportRef.current.scrollLeft + viewportRef.current.clientWidth / 2) / (store.measureWidth * store.zoomLevel / (60000 / store.bpm * 4));

        let newLevel = store.zoomLevel - (e.deltaY * 0.005);
        newLevel = Math.max(0.1, Math.min(3.0, newLevel));
        store.setZoomLevel(newLevel);
        
        // ズーム後の pxPerMs を再計算
        const newZoomedMeasureWidth = store.measureWidth * newLevel;
        const newPxPerMs = newZoomedMeasureWidth / (60000 / store.bpm * 4);
        
        // 中央時間が同じになるように scrollLeft を補正
        requestAnimationFrame(() => {
          if (viewportRef.current) {
            viewportRef.current.scrollLeft = centerTimeMs * newPxPerMs - viewportRef.current.clientWidth / 2;
          }
        });
      } else {
        // 横スクロールに変換
        if (viewportRef.current) {
          viewportRef.current.scrollLeft += e.deltaY;
        }
      }
    };
    
    const vp = viewportRef.current;
    if (vp) {
      vp.addEventListener('wheel', handleNativeWheel, { passive: false });
    }
    return () => {
      if (vp) vp.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // --- ルーラーでのシーク処理 ---
  const calculateTimeFromEvent = (e) => {
    const rect = rulerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const absoluteBeats = offsetX / beatWidth;
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
    const canScroll = now - window._lastAutoScrollTimeRuler > 100; // 100msに1回

    if (canScroll) {
      if (e.clientX > window.innerWidth * 0.9) {
        if (viewportRef.current) viewportRef.current.scrollBy({ left: beatWidth * 4, behavior: 'smooth' });
        window._lastAutoScrollTimeRuler = now;
      } else if (e.clientX < window.innerWidth * 0.1) {
        if (viewportRef.current) viewportRef.current.scrollBy({ left: -(beatWidth * 4), behavior: 'smooth' });
        window._lastAutoScrollTimeRuler = now;
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
    useEditorStore.getState().setSelectedNoteIds([]);

    // コンテナ内の相対X座標（＝絶対X座標）
    const rect = containerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    
    // オフセットXを拍(beat)に変換
    const absoluteBeats = offsetX / beatWidth;
    
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
    backgroundPosition: `0 0, 0 0, 0 0`
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
              const noteXLeft = noteTotalBeats * beatWidth;
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
      ref={viewportRef}
      className="w-full h-full overflow-x-auto overflow-y-hidden bg-neutral-900 rounded-3xl border-4 border-neutral-700 relative"
      onScroll={(e) => {
        if (!pxPerMs || Number.isNaN(pxPerMs)) return;
        setScrollTimeOffset(e.target.scrollLeft / pxPerMs);
      }}
    >
      <div 
        className="relative mx-auto flex-shrink-0 flex flex-col"
        style={{
          width: `${continuousTimelineWidth}px`,
          minWidth: `${continuousTimelineWidth}px`,
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
          {/* シンプルな帯 */}
        </div>

      <div
        ref={containerRef}
        data-is-timeline-bg="true"
        className="w-full flex-grow relative cursor-crosshair overflow-hidden"
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
                const absoluteMs = index * 50;
                const x = absoluteMs * pxPerMs;
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
    </div>
  );
}
