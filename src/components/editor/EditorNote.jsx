import { useState, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';

export default function EditorNote({ note, beatWidth, msPerBeat }) {
  const updateEditorNote = useEditorStore(state => state.updateEditorNote);
  const scrollTimeOffset = useEditorStore(state => state.scrollTimeOffset);
  const selectedNoteId = useEditorStore(state => state.selectedNoteId);
  const setSelectedNoteId = useEditorStore(state => state.setSelectedNoteId);

  const [isEditing, setIsEditing] = useState(false);
  const [inputText, setInputText] = useState(note.word || '');
  
  const noteRef = useRef(null);
  
  const isSelected = selectedNoteId === note.id;

  // 初期位置計算
  const noteTotalBeats = (note.measure * 4) + note.beat;
  const scrollBeats = scrollTimeOffset / msPerBeat;
  
  const initialX = (noteTotalBeats - scrollBeats) * beatWidth;
  const initialWidth = note.durationBeats * beatWidth;

  // KPS計算
  const durationMs = note.durationBeats * msPerBeat;
  const kps = (note.word && durationMs > 0) ? note.word.length / (durationMs / 1000) : 0;
  const isKpsWarning = kps > 10;

  // インライン編集完了時
  const handleInputBlur = () => {
    setIsEditing(false);
    if (inputText !== note.word) {
      updateEditorNote(note.id, { word: inputText });
    }
  };
  const handleInputKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  // ドラッグ＆ドロップ（移動とリサイズ）ロジック
  const dragState = useRef({
    mode: null, 
    startX: 0,
    originalTotalBeats: 0,
    originalDurationBeats: 0,
  });

  const handleMouseDown = (e, mode) => {
    e.stopPropagation(); // 伝播防止
    if (isEditing) return;
    
    setSelectedNoteId(note.id); // 選択状態にする
    window._isEditorDragging = true; // グローバルドラッグフラグON

    dragState.current = {
      mode,
      startX: e.clientX,
      originalTotalBeats: noteTotalBeats,
      originalDurationBeats: note.durationBeats,
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    const state = dragState.current;
    if (!state.mode || !noteRef.current) return;
    
    const deltaX = e.clientX - state.startX;
    const deltaBeats = deltaX / beatWidth;

    if (state.mode === 'move') {
      const newTotalBeatsUnsnapped = state.originalTotalBeats + deltaBeats;
      const snappedBeats = Math.max(0, Math.round(newTotalBeatsUnsnapped / 0.25) * 0.25);
      
      const newX = (snappedBeats - useEditorStore.getState().scrollTimeOffset / msPerBeat) * beatWidth;
      
      noteRef.current.style.left = `${newX}px`;
      noteRef.current.dataset.newTotalBeats = snappedBeats;

    } else if (state.mode === 'resize') {
      const newDurationUnsnapped = state.originalDurationBeats + deltaBeats;
      const clampedDuration = Math.max(0.25, newDurationUnsnapped);
      const snappedDuration = Math.round(clampedDuration / 0.25) * 0.25;
      
      const newWidth = snappedDuration * beatWidth;
      
      noteRef.current.style.width = `${newWidth}px`;
      noteRef.current.dataset.newDurationBeats = snappedDuration;
    }
  };

  const handleMouseUp = (e) => {
    if (e) e.stopPropagation();
    
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    
    // 次のイベントループでフラグをリセットし、誤爆クリックを防ぐ
    setTimeout(() => {
      window._isEditorDragging = false;
    }, 0);

    const state = dragState.current;
    if (!state.mode || !noteRef.current) return;

    let updates = {};

    if (state.mode === 'move' && noteRef.current.dataset.newTotalBeats) {
      const newTotalBeats = parseFloat(noteRef.current.dataset.newTotalBeats);
      if (newTotalBeats !== noteTotalBeats) {
        updates.measure = Math.floor(newTotalBeats / 4);
        updates.beat = newTotalBeats % 4;
      }
    } else if (state.mode === 'resize' && noteRef.current.dataset.newDurationBeats) {
      const newDuration = parseFloat(noteRef.current.dataset.newDurationBeats);
      if (newDuration !== note.durationBeats) {
        updates.durationBeats = newDuration;
      }
    }

    delete noteRef.current.dataset.newTotalBeats;
    delete noteRef.current.dataset.newDurationBeats;
    dragState.current.mode = null;

    if (Object.keys(updates).length > 0) {
      updateEditorNote(note.id, updates);
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  // 画面外のものを弾く判定（少しでも被っていれば描画）
  if (initialX + initialWidth < 0 || initialX > 3000) return null;

  // ボーダースタイル決定
  let borderColor = '#06b6d4'; // cyan-500
  let borderWidth = '4px';
  if (isSelected) {
    borderColor = '#fbbf24'; // amber-400
    borderWidth = '6px';
  } else if (isKpsWarning) {
    borderColor = '#ef4444'; // red-500
  }

  // テキストの擬似Sticky制御（左にはみ出た分だけテキストコンテナを右にズラす）
  const textOffset = initialX < 0 ? -initialX : 0;

  return (
    <div 
      ref={noteRef}
      className={`absolute top-1/2 -translate-y-1/2 h-16 rounded-xl flex items-center select-none
        ${isKpsWarning && !isSelected ? 'bg-red-500' : isSelected ? 'bg-amber-100/90' : 'bg-cyan-500'}
      `}
      style={{ 
        left: `${initialX}px`, 
        width: `${initialWidth}px`,
        border: `${borderWidth} solid ${borderColor}`,
        zIndex: isSelected ? 30 : 10,
        boxSizing: 'border-box'
      }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedNoteId(note.id);
      }}
    >
      <div 
        className="flex-1 px-3 overflow-hidden text-neutral-900 font-black truncate h-full flex items-center"
        style={{ paddingLeft: `${textOffset}px` }}
      >
        {isEditing ? (
          <input
            autoFocus
            type="text"
            className="w-full bg-transparent border-b-2 border-neutral-900 text-neutral-900 outline-none font-black"
            value={inputText}
            onChange={(e) => setInputText(e.target.value.toUpperCase())}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={(isKpsWarning && !isSelected) ? 'text-white' : 'text-neutral-900'}>
            {note.word}
          </span>
        )}
      </div>

      {!isEditing && (
        <div 
          className={`absolute -top-6 text-xs font-bold ${isKpsWarning ? 'text-red-400' : 'text-neutral-500'}`}
          style={{ left: `${Math.max(4, textOffset + 4)}px` }}
        >
          {kps.toFixed(1)} KPS
        </div>
      )}

      <div 
        className="absolute right-0 w-4 h-full bg-black/20 hover:bg-black/40 cursor-ew-resize rounded-r-lg"
        onMouseDown={(e) => handleMouseDown(e, 'resize')}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
