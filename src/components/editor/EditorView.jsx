import { useEffect, useRef, useState } from 'react';
import EditorTimeline from './EditorTimeline';
import { useEditorStore } from '../../store/editorStore';

export default function EditorView({ onExit }) {
  const isPlaying = useEditorStore(state => state.isPlaying);
  const setIsPlaying = useEditorStore(state => state.setIsPlaying);
  const currentTime = useEditorStore(state => state.currentTime);
  const setCurrentTime = useEditorStore(state => state.setCurrentTime);
  const offset = useEditorStore(state => state.offset);
  const setOffset = useEditorStore(state => state.setOffset);
  const bpm = useEditorStore(state => state.bpm);
  const setBpm = useEditorStore(state => state.setBpm);
  const audioUrl = useEditorStore(state => state.audioUrl);
  const setAudioUrl = useEditorStore(state => state.setAudioUrl);
  const zoomLevel = useEditorStore(state => state.zoomLevel);
  const setZoomLevel = useEditorStore(state => state.setZoomLevel);

  const [toastMessage, setToastMessage] = useState(null);

  const requestRef = useRef();
  const audioRef = useRef(null);
  const handleExportRef = useRef(null);
  
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // スペースキーでの再生トグルと Audio 初期化、キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Input 要素入力中やボタンフォーカス中はカスタムショートカットを無効化（ブラウザ標準動作に任せる）
      const tagName = e.target.tagName.toLowerCase();
      const isInput = tagName === 'input' || tagName === 'textarea';
      const isButton = tagName === 'button';
      
      if (isInput) return; // 入力欄ではすべてのショートカットを無効化

      const state = useEditorStore.getState();
      
      // 再生トグル (Space)
      if (e.code === 'Space' && !isButton) {
        e.preventDefault();
        togglePlay();
      }

      // 削除 (Delete / Backspace)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedNoteIds && state.selectedNoteIds.length > 0) {
          e.preventDefault();
          state.removeMultipleNotes(state.selectedNoteIds);
          state.setSelectedNoteIds([]);
          showToast("削除しました");
        }
      }

      // Undo / Redo / Copy / Paste / Save / Select All
      const cmdKey = e.ctrlKey || e.metaKey;
      
      if (cmdKey) {
        if (e.code === 'KeyA') {
          // 全選択 (Ctrl + A)
          e.preventDefault();
          const allNoteIds = state.editorNotes.map(n => n.id);
          state.setSelectedNoteIds(allNoteIds);
        } else if (e.code === 'KeyS') {
          // 上書き保存 (クイックセーブ)
          e.preventDefault();
          if (handleExportRef.current) handleExportRef.current();
        } else if (e.code === 'KeyZ') {
          e.preventDefault();
          if (e.shiftKey) {
            state.redo();
            showToast("やり直しました");
          } else {
            state.undo();
            showToast("元に戻しました");
          }
        } else if (e.code === 'KeyY') {
          e.preventDefault();
          state.redo();
          showToast("やり直しました");
        } else if (e.code === 'KeyC') {
          // コピー
          if (state.selectedNoteIds.length > 0) {
            e.preventDefault();
            const notesToCopy = state.editorNotes.filter(n => state.selectedNoteIds.includes(n.id));
            state.setClipboardNotes(notesToCopy);
          }
        } else if (e.code === 'KeyV') {
          // ペースト
          if (state.clipboardNotes && state.clipboardNotes.length > 0) {
            e.preventDefault();
            
            // クリップボード内で一番早い時間を特定
            let minBeats = Infinity;
            state.clipboardNotes.forEach(n => {
              const b = n.measure * 4 + n.beat;
              if (b < minBeats) minBeats = b;
            });
            
            // 現在のシークバー位置を基準（ビート）
            const currentBeats = (state.currentTime / (60000 / state.bpm));
            
            const newNotes = [];
            state.clipboardNotes.forEach((note, index) => {
              const originalBeats = note.measure * 4 + note.beat;
              const diffBeats = originalBeats - minBeats;
              const newTotalBeats = currentBeats + diffBeats;
              
              const newMeasure = Math.floor(newTotalBeats / 4);
              const newBeat = newTotalBeats % 4;
              const newId = Date.now() + index; // ユニークなID
              
              newNotes.push({
                ...note,
                id: newId,
                measure: newMeasure,
                beat: newBeat,
              });
            });
            state.addMultipleNotes(newNotes);
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // isPlaying に応じて Audio または タイマーを操作
  const mockStartTimeRef = useRef(0);
  const mockStartCurrentTimeRef = useRef(0);

  useEffect(() => {
    const audioEl = audioRef.current;
    const hasAudio = audioEl && audioEl.src && !audioEl.src.endsWith('null');

    if (isPlaying) {
      if (hasAudio) {
        audioEl.play().catch(e => {
          console.warn("Audio playback failed, falling back to silent mode:", e);
          // 音声再生に失敗してもそのまま進める
        });
      }
      mockStartTimeRef.current = performance.now();
      mockStartCurrentTimeRef.current = useEditorStore.getState().currentTime;
    } else {
      if (hasAudio) {
        audioEl.pause();
      }
    }
  }, [isPlaying]);

  // currentTimeの同期ループ
  useEffect(() => {
    const syncLoop = () => {
      const state = useEditorStore.getState();
      const audioEl = audioRef.current;
      const hasAudio = audioEl && audioEl.src && !audioEl.src.endsWith('null') && !audioEl.paused && !audioEl.error;

      if (state.isPlaying) {
        if (hasAudio) {
          setCurrentTime((audioEl.currentTime * 1000) - state.offset);
          if (audioEl.ended) {
            state.setIsPlaying(false);
          }
        } else {
          // 無音プレビュー
          const elapsed = performance.now() - mockStartTimeRef.current;
          const newTime = mockStartCurrentTimeRef.current + elapsed;
          setCurrentTime(newTime);
          
          // 終了判定（最後のノーツ+5000ms）
          let maxBeats = 0;
          state.editorNotes.forEach(n => {
            const beats = n.measure * 4 + n.beat + (n.durationBeats || 0);
            if (beats > maxBeats) maxBeats = beats;
          });
          const fallbackDuration = maxBeats > 0 ? maxBeats * (60000 / state.bpm) + 5000 : 5000;
          
          if (newTime > fallbackDuration) {
            state.setIsPlaying(false);
          }
        }
      }
      requestRef.current = requestAnimationFrame(syncLoop);
    };
    
    requestRef.current = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [setCurrentTime]);

  // seekRequest の監視（ルーラーからのシーク指示）
  const seekRequest = useEditorStore(state => state.seekRequest);
  useEffect(() => {
    if (seekRequest !== null) {
      const audioEl = audioRef.current;
      const hasAudio = audioEl && audioEl.src && !audioEl.src.endsWith('null');
      
      if (hasAudio) {
        audioEl.currentTime = (seekRequest + useEditorStore.getState().offset) / 1000;
      }
      setCurrentTime(seekRequest);
      
      if (useEditorStore.getState().isPlaying) {
        mockStartTimeRef.current = performance.now();
        mockStartCurrentTimeRef.current = seekRequest;
      }
      
      useEditorStore.getState().setSeekRequest(null);
    }
  }, [seekRequest, setCurrentTime]);

  const togglePlay = () => {
    const state = useEditorStore.getState();
    state.setIsPlaying(!state.isPlaying);
  };

  const handleAudioChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      if (useEditorStore.getState().isPlaying) togglePlay();
      setCurrentTime(0);
      useEditorStore.getState().setScrollTimeOffset(0);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
      }
      
      // 波形解析 (Web Audio API)
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // 簡易的なPeak抽出 (チャンネル0のみ、一定間隔で最大値を取得)
        const channelData = audioBuffer.getChannelData(0);
        const samplesPerPixel = Math.floor(audioBuffer.sampleRate * 0.05); // 50msごとに1サンプル
        const peaks = [];
        for (let i = 0; i < channelData.length; i += samplesPerPixel) {
          let max = 0;
          for (let j = 0; j < samplesPerPixel && i + j < channelData.length; j++) {
            const abs = Math.abs(channelData[i + j]);
            if (abs > max) max = abs;
          }
          peaks.push(max);
        }
        useEditorStore.getState().setAudioPeaks(peaks);
      } catch (err) {
        console.error("Waveform generation failed:", err);
      }
    }
  };

  const handleStopReset = () => {
    setIsPlaying(false);
    setCurrentTime(0 - useEditorStore.getState().offset);
    useEditorStore.getState().setScrollTimeOffset(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const generateSaveData = () => {
    const state = useEditorStore.getState();
    const currentBpm = state.bpm;
    const currentOffset = state.offset;
    const msPerBeat = 60000 / currentBpm;

    const compiledNotes = state.editorNotes.map(note => {
      const totalBeats = (note.measure * 4) + note.beat;
      const timeMs = (totalBeats * msPerBeat) + currentOffset;
      const durationMs = note.durationBeats * msPerBeat;
      return {
        id: note.id,
        word: note.word,
        reading: note.reading || "",
        time: timeMs,
        endTime: timeMs + durationMs,
        type: 'normal'
      };
    });

    return JSON.stringify({ bpm: currentBpm, offset: currentOffset, notes: compiledNotes }, null, 2);
  };

  const writeToFileHandle = async (fileHandle, data) => {
    if (await fileHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        throw new Error('Permission denied');
      }
    }
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  };

  const fallbackDownload = (data) => {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'score.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast("保存完了！トップの『創作譜面を遊ぶ』からファイルを読み込んでテストプレイしてみよう");
  };

  const handleSaveAs = async () => {
    const data = generateSaveData();
    try {
      if (window.showSaveFilePicker) {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: 'score.json',
          types: [{
            description: 'JSON File',
            accept: { 'application/json': ['.json'] },
          }],
        });
        useEditorStore.getState().setFileHandle(fileHandle);
        await writeToFileHandle(fileHandle, data);
        showToast("別名で保存しました");
      } else {
        fallbackDownload(data);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error("Save As failed:", e);
        showToast("保存に失敗しました");
      }
    }
  };

  const handleSave = async () => {
    const state = useEditorStore.getState();
    const data = generateSaveData();
    
    if (window.showSaveFilePicker && state.fileHandle) {
      try {
        await writeToFileHandle(state.fileHandle, data);
        showToast("上書き保存しました");
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error("Save failed:", e);
          showToast("保存に失敗しました。SAVE AS を試してください。");
        }
      }
    } else {
      handleSaveAs();
    }
  };
  
  handleExportRef.current = handleSave;

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.notes && Array.isArray(json.notes)) {
          const store = useEditorStore.getState();
          store.clearEditorNotes();
          
          const importedBpm = json.bpm || 120;
          const importedOffset = json.offset || 0;
          const msPerBeat = 60000 / importedBpm;

          store.setBpm(importedBpm);
          store.setOffset(importedOffset);

          // 絶対時間からグリッド位置(measure, beat)に逆算してストアへ
          json.notes.forEach(note => {
            const timeWithoutOffset = note.time - importedOffset;
            const totalBeats = timeWithoutOffset / msPerBeat;
            const measure = Math.floor(totalBeats / 4);
            const beat = totalBeats % 4;
            
            // endTimeがあればdurationBeatsを計算。なければデフォルト0.25(16分音符)
            let durationBeats = 0.25;
            if (note.endTime) {
              durationBeats = (note.endTime - note.time) / msPerBeat;
            }

            store.addEditorNote({
              id: note.id || Date.now() + Math.random(),
              measure,
              beat,
              durationBeats,
              word: note.word || "WORD",
              reading: note.reading || ""
            });
          });
        }
      } catch (err) {
        console.error("Invalid JSON file:", err);
        alert("無効なJSONファイルです。");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900 text-white flex flex-col font-sans select-none overflow-hidden p-2">
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-cyan-600 text-white px-6 py-3 rounded-xl font-bold z-[1000] pointer-events-none transition-opacity duration-300">
          {toastMessage}
        </div>
      )}
      
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        onLoadedMetadata={(e) => {
          if (e.target.duration && !Number.isNaN(e.target.duration) && e.target.duration !== Infinity) {
            useEditorStore.getState().setAudioDuration(e.target.duration * 1000);
          }
        }}
      />
      
      <div className="w-full bg-neutral-800 p-2 flex-grow flex flex-col rounded-xl h-full border-b-4 border-neutral-900">
        {/* コントロールバー */}
        <div className="flex flex-wrap justify-between items-center mb-2 px-2 gap-4">
          <div className="flex flex-wrap gap-2 items-center">
             <button 
               onClick={onExit}
               className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors mr-2 flex-shrink-0"
             >
               もどる
             </button>
             <button
               onClick={togglePlay}
               className={`px-8 py-2 rounded-full font-black transition-colors flex-shrink-0 ${isPlaying ? 'bg-red-500 text-white' : 'bg-green-500 text-neutral-900'}`}
             >
               {isPlaying ? '一時停止' : '再生'}
             </button>
             <button
               onClick={handleStopReset}
               className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors flex-shrink-0"
             >
               停止＆リセット
             </button>
             
             {/* オーディオ読み込み */}
             <label className="cursor-pointer bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-full font-bold transition-colors flex items-center gap-2 flex-shrink-0">
               <span>音源読み込み</span>
               <input type="file" accept="audio/*" className="hidden" onChange={handleAudioChange} />
             </label>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
             {/* BPM / Offset 調整 (フラットデザイン) */}
             <div className="flex items-center gap-2 bg-neutral-900 px-4 py-2 rounded-full border-2 border-neutral-700 flex-shrink-0">
               <span className="text-neutral-400 font-bold text-sm">BPM</span>
               <input 
                 type="number" 
                 value={bpm} 
                 onChange={(e) => setBpm(Number(e.target.value) || 120)}
                 className="bg-transparent text-cyan-400 font-mono font-bold w-16 outline-none text-right"
               />
             </div>
             
             <div className="flex items-center gap-2 bg-neutral-900 px-4 py-2 rounded-full border-2 border-neutral-700 flex-shrink-0">
               <span className="text-neutral-400 font-bold text-sm">オフセット</span>
               <input 
                 type="number" 
                 step="10"
                 value={offset} 
                 onChange={(e) => setOffset(Number(e.target.value) || 0)}
                 className="bg-transparent text-cyan-400 font-mono font-bold w-20 outline-none text-right"
               />
               <span className="text-neutral-500 text-sm font-mono">ms</span>
             </div>
             
             {/* Save / Load */}
             <button
               onClick={handleSave}
               className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-neutral-900 rounded-full font-bold transition-colors ml-2 flex-shrink-0"
             >
               SAVE
             </button>
             <button
               onClick={handleSaveAs}
               className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors flex-shrink-0"
             >
               SAVE AS
             </button>
             <label className="cursor-pointer bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-full font-bold transition-colors flex items-center flex-shrink-0">
               <span>IMPORT</span>
               <input type="file" accept=".json" className="hidden" onChange={handleImport} />
             </label>
          </div>
        </div>

        {/* タイムライン領域 */}
        <div className="flex-grow w-full overflow-hidden p-0 flex flex-col relative h-full">
          <EditorTimeline />
        </div>
      </div>
    </div>
  );
}
