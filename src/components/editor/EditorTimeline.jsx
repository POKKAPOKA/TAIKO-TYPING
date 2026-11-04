import { useCallback, useRef, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import EditorNote from './EditorNote';
import EditorSeekBar from './EditorSeekBar';
import { registerEditorViewport } from '../../engine/EditorController';
import { nextEditorGridBeat, snapEditorBeat, gridStep } from '../../engine/editorGrid';

const BEATS_PER_MEASURE = 4;

// Ctrl+ホイールでズーム、通常ホイールで横スクロール。
// passive: false のネイティブリスナーが必要なため、コールバックrefから登録する（useEffectは使わない）
const handleViewportWheel = (e) => {
  const viewport = e.currentTarget;
  if (!viewport) return;

  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const store = useEditorStore.getState();

    // 現在の画面中央の時間 (ms)
    const centerTimeMs = (viewport.scrollLeft + viewport.clientWidth / 2) / (store.measureWidth * store.zoomLevel / (60000 / store.bpm * 4));

    let newLevel = store.zoomLevel - (e.deltaY * 0.005);
    newLevel = Math.max(0.1, Math.min(3.0, newLevel));
    store.setZoomLevel(newLevel);

    // ズーム後の pxPerMs を再計算
    const newZoomedMeasureWidth = store.measureWidth * newLevel;
    const newPxPerMs = newZoomedMeasureWidth / (60000 / store.bpm * 4);

    // 中央時間が同じになるように scrollLeft を補正
    requestAnimationFrame(() => {
      viewport.scrollLeft = centerTimeMs * newPxPerMs - viewport.clientWidth / 2;
    });
  } else {
    // 横スクロールに変換
    viewport.scrollLeft += e.deltaY;
  }
};

export default function EditorTimeline() {
  const containerRef = useRef(null);
  const rulerRef = useRef(null);
  const rulerDragState = useRef({ isDragging: false, wasPlaying: false });
  const rulerSelectionCleanup = useRef(null);
  const [gridSelection, setGridSelection] = useState(null);
  const [gridMenu, setGridMenu] = useState(null);

  const bpm = useEditorStore(state => state.bpm);
  const scrollTimeOffset = useEditorStore(state => state.scrollTimeOffset);
  const setScrollTimeOffset = useEditorStore(state => state.setScrollTimeOffset);
  const editorNotes = useEditorStore(state => state.editorNotes);
  const gridRegions = useEditorStore(state => state.gridRegions);
  const updateGridRegion = useEditorStore(state => state.updateGridRegion);
  const addEditorNote = useEditorStore(state => state.addEditorNote);

  const baseMeasureWidth = useEditorStore(state => state.measureWidth);
  const zoomLevel = useEditorStore(state => state.zoomLevel);
  const setCurrentTime = useEditorStore(state => state.setCurrentTime);
  const setSeekRequest = useEditorStore(state => state.setSeekRequest);
  const setIsPlaying = useEditorStore(state => state.setIsPlaying);

  const audioDuration = useEditorStore(state => state.audioDuration);
  const audioPeaks = useEditorStore(state => state.audioPeaks);

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

  // ビューポートDOMの登録とネイティブホイールリスナーの管理はコールバックrefで行う。
  // 再生リセット時のscrollLeft同期は EditorController 側が直接行う。
  const viewportRef = useRef(null);
  const handleViewportRef = useCallback((node) => {
    if (!node) rulerSelectionCleanup.current?.();
    if (viewportRef.current) {
      viewportRef.current.removeEventListener('wheel', handleViewportWheel);
    }
    viewportRef.current = node;
    registerEditorViewport(node);
    if (node) {
      node.addEventListener('wheel', handleViewportWheel, { passive: false });
    }
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
    if (e.button === 2) {
      e.preventDefault();
      setGridMenu(null);
      rulerSelectionCleanup.current?.();
      const beatAt = event => Math.max(0, Math.min(continuousTimelineWidth / beatWidth,
        (event.clientX - rulerRef.current.getBoundingClientRect().left) / beatWidth));
      // 範囲端は通常の16分線に揃え、範囲外の編集を予期せず変えない。
      const boundary = event => Math.round(beatAt(event) * 4) / 4;
      const start = boundary(e);
      let current = start;
      setGridSelection({ start, end: start });
      const onMove = event => {
        current = boundary(event);
        setGridSelection({ start, end: current });
      };
      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        rulerSelectionCleanup.current = null;
      };
      const onCancel = () => { cleanup(); setGridSelection(null); };
      const onUp = event => {
        current = boundary(event);
        cleanup();
        setGridSelection(null);
        if (Math.abs(current - start) < 0.001) return;
        setGridMenu({ start: Math.min(start, current), end: Math.max(start, current),
          x: Math.max(8, Math.min(window.innerWidth - 210, event.clientX)),
          y: Math.max(8, Math.min(window.innerHeight - 230, event.clientY + 10)) });
      };
      rulerSelectionCleanup.current = cleanup;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      return;
    }
    if (e.button !== 0) return;
    setGridMenu(null);
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

  const pointerDownTarget = useRef(null);

  // タイムライン背景のクリック
  const handleTimelineClick = (e) => {
    // ドラッグ直後等のためにフラグを見る
    if (window._isEditorDragging) return;

    // mousedownの要素とmouseup(click)の要素が異なる場合は配置しない（入力欄のテキスト選択対策）
    if (pointerDownTarget.current !== e.target) return;

    // Noteやハンドルなどをクリックした場合は配置しない
    if (e.target !== containerRef.current && !e.target.dataset.isTimelineBg) return;

    // 背景クリックで選択解除
    useEditorStore.getState().setSelectedNoteIds([]);

    // コンテナ内の相対X座標（＝絶対X座標）
    const rect = containerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;

    // オフセットXを拍(beat)に変換
    const absoluteBeats = offsetX / beatWidth;

    const snappedBeats = snapEditorBeat(absoluteBeats, gridRegions);

    const measure = Math.floor(snappedBeats / 4);
    const beat = snappedBeats % 4;

    addEditorNote({
      id: crypto.randomUUID(),
      measure,
      beat,
      durationBeats: nextEditorGridBeat(snappedBeats, gridRegions) - snappedBeats,
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
    pointerDownTarget.current = e.target;
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
      ref={handleViewportRef}
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
          onContextMenu={e => e.preventDefault()}
          title="左ドラッグで再生位置を移動、右ドラッグでグリッドの範囲を選択"
        >
          {gridRegions.map(region => <div key={`${region.start}-${region.end}`} className="absolute inset-y-0 bg-cyan-600/50 border-x border-cyan-300 text-xs text-white overflow-hidden pointer-events-none" style={{ left: region.start * beatWidth, width: (region.end - region.start) * beatWidth }}>{region.division}分</div>)}
          {gridSelection && <div className="absolute inset-y-0 bg-amber-400/40 border-x border-amber-300 pointer-events-none" style={{ left: Math.min(gridSelection.start, gridSelection.end) * beatWidth, width: Math.abs(gridSelection.end - gridSelection.start) * beatWidth }} />}
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
        {/* 範囲ごとに16分線を覆い、拍0を基準に選んだ間隔の線を描く。 */}
        {gridRegions.map(region => <div key={`${region.start}-${region.end}`} className="absolute inset-y-0 pointer-events-none" style={{
          left: region.start * beatWidth, width: (region.end - region.start) * beatWidth,
          backgroundColor: '#171717',
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.3) 2px, transparent 2px), linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to right, rgba(34,211,238,0.25) 1px, transparent 1px)',
          backgroundSize: `${measureWidth}px 100%, ${beatWidth}px 100%, ${gridStep(region.division) * beatWidth}px 100%`,
          backgroundPosition: `${-region.start * beatWidth}px 0, ${-region.start * beatWidth}px 0, ${-region.start * beatWidth}px 0`,
          borderLeft: '1px solid rgba(34,211,238,0.5)', borderRight: '1px solid rgba(34,211,238,0.5)',
        }} />)}
        {/* 波形表示 */}
        {audioPeaks?.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="#06b6d4" // cyan-500
              strokeWidth="2"
              points={audioPeaks.map((peak, index) => {
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
      {gridMenu && <div role="dialog" aria-label="選択範囲のグリッド" className="fixed z-[100] bg-neutral-800 border-2 border-cyan-500 rounded-xl p-3 flex flex-col gap-2 text-white" style={{ left: gridMenu.x, top: gridMenu.y }} onPointerDown={e => e.stopPropagation()}>
        <p className="font-bold text-sm">選択範囲のグリッド</p>
        <div className="flex gap-2">{[12, 24, 32].map(division => <button key={division} type="button" className="bg-cyan-700 hover:bg-cyan-600 rounded-lg px-3 py-2 font-bold" onClick={() => { updateGridRegion(gridMenu.start, gridMenu.end, division); setGridMenu(null); }}>{division}分</button>)}</div>
        <button type="button" className="bg-neutral-700 hover:bg-neutral-600 rounded-lg px-3 py-2" onClick={() => { updateGridRegion(gridMenu.start, gridMenu.end, 16); setGridMenu(null); }}>16分に戻す</button>
        <button type="button" className="bg-neutral-700 hover:bg-neutral-600 rounded-lg px-3 py-2" onClick={() => setGridMenu(null)}>キャンセル</button>
      </div>}
    </div>
  );
}
