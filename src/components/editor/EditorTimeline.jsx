import { useEffect, useRef } from 'react';
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
    const timePerPage = fixedTimelineWidth / pxPerMs;
    if (e.deltaY > 0) {
      setScrollTimeOffset(scrollTimeOffset + timePerPage);
    } else if (e.deltaY < 0) {
      setScrollTimeOffset(scrollTimeOffset - timePerPage);
    }
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
        className="w-full flex-grow relative cursor-crosshair"
        onWheel={handleWheel}
        onClick={handleTimelineClick}
        style={{ ...gridBackground }}
      >
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
