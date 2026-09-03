import { useEffect, useRef } from 'react';
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

  const requestRef = useRef();
  const audioRef = useRef(null);

  // スペースキーでの再生トグルと Audio 初期化、キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Input 要素入力中はカスタムショートカットを無効化（ブラウザ標準動作に任せる）
      if (e.target.tagName.toLowerCase() === 'input') return;
      
      // 再生トグル (Space)
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }

      // 削除 (Delete / Backspace)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useEditorStore.getState();
        if (state.selectedNoteId) {
          e.preventDefault();
          state.removeEditorNote(state.selectedNoteId);
        }
      }

      // Undo / Redo
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      
      if (cmdKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useEditorStore.getState().redo();
        } else {
          useEditorStore.getState().undo();
        }
      } else if (cmdKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useEditorStore.getState().redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // isPlaying に応じて Audio を操作
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(e => {
        console.error("Audio playback failed:", e);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // AudioのcurrentTimeと同期するループ
  useEffect(() => {
    const syncLoop = () => {
      if (isPlaying && audioRef.current) {
        // audio.currentTime は秒なので ms に変換。オフセットを加味。
        setCurrentTime((audioRef.current.currentTime * 1000) - useEditorStore.getState().offset);
      }
      requestRef.current = requestAnimationFrame(syncLoop);
    };
    
    requestRef.current = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, setCurrentTime]);

  // seekRequest の監視（ルーラーからのシーク指示）
  const seekRequest = useEditorStore(state => state.seekRequest);
  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      // 音楽の絶対時間(ms) = エディタ上の時間 + オフセット
      audioRef.current.currentTime = (seekRequest + useEditorStore.getState().offset) / 1000;
      setCurrentTime(seekRequest);
      useEditorStore.getState().setSeekRequest(null);
    }
  }, [seekRequest, setCurrentTime]);

  const togglePlay = () => {
    const state = useEditorStore.getState();
    state.setIsPlaying(!state.isPlaying);
  };

  const handleAudioChange = (e) => {
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

  const handleExport = () => {
    const state = useEditorStore.getState();
    const currentBpm = state.bpm;
    const currentOffset = state.offset;
    const msPerBeat = 60000 / currentBpm;

    // ゲームエンジン向けの絶対時間へコンパイル
    const compiledNotes = state.editorNotes.map(note => {
      const totalBeats = (note.measure * 4) + note.beat;
      const timeMs = (totalBeats * msPerBeat) + currentOffset;
      const durationMs = note.durationBeats * msPerBeat;
      return {
        id: note.id,
        word: note.word,
        time: timeMs,
        endTime: timeMs + durationMs, // 将来の拡張用
        type: 'normal'
      };
    });

    const data = JSON.stringify({ bpm: currentBpm, offset: currentOffset, notes: compiledNotes }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'score.json';
    a.click();
    URL.revokeObjectURL(url);
  };

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
              word: note.word || "WORD"
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
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-8 font-sans select-none w-full">
      <audio ref={audioRef} src={audioUrl} />
      
      <div className="w-full flex justify-between items-center mb-8">
        <h1 className="text-4xl font-black text-cyan-400 tracking-wider">BEATMAP EDITOR</h1>
        <button 
          onClick={onExit}
          className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors"
        >
          BACK TO GAME
        </button>
      </div>

      <div className="w-full bg-neutral-800 rounded-3xl p-6 border-b-4 border-neutral-900 flex-grow flex flex-col">
        {/* コントロールバー */}
        <div className="flex justify-between items-center mb-6 px-4">
          <div className="flex gap-4 items-center">
             <button
               onClick={togglePlay}
               className={`px-8 py-2 rounded-full font-black transition-colors ${isPlaying ? 'bg-red-500 text-white' : 'bg-green-500 text-neutral-900'}`}
             >
               {isPlaying ? 'PAUSE' : 'PLAY'}
             </button>
             <button
               onClick={handleStopReset}
               className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors"
             >
               STOP & RESET
             </button>
             
             {/* オーディオ読み込み */}
             <label className="cursor-pointer bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-full font-bold transition-colors flex items-center gap-2">
               <span>LOAD AUDIO</span>
               <input type="file" accept="audio/*" className="hidden" onChange={handleAudioChange} />
             </label>
          </div>
          
          <div className="flex gap-4 items-center">
             {/* BPM / Offset 調整 (フラットデザイン) */}
             <div className="flex items-center gap-2 bg-neutral-900 px-4 py-2 rounded-full border-2 border-neutral-700">
               <span className="text-neutral-400 font-bold text-sm">BPM</span>
               <input 
                 type="number" 
                 value={bpm} 
                 onChange={(e) => setBpm(Number(e.target.value) || 120)}
                 className="bg-transparent text-cyan-400 font-mono font-bold w-16 outline-none text-right"
               />
             </div>
             
             <div className="flex items-center gap-2 bg-neutral-900 px-4 py-2 rounded-full border-2 border-neutral-700">
               <span className="text-neutral-400 font-bold text-sm">OFFSET</span>
               <input 
                 type="number" 
                 step="10"
                 value={offset} 
                 onChange={(e) => setOffset(Number(e.target.value) || 0)}
                 className="bg-transparent text-cyan-400 font-mono font-bold w-20 outline-none text-right"
               />
               <span className="text-neutral-500 text-sm font-mono">ms</span>
             </div>
             
             {/* Export / Import */}
             <button
               onClick={handleExport}
               className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors ml-4"
             >
               EXPORT
             </button>
             <label className="cursor-pointer bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-full font-bold transition-colors flex items-center">
               <span>IMPORT</span>
               <input type="file" accept=".json" className="hidden" onChange={handleImport} />
             </label>
          </div>
        </div>

        {/* タイムライン領域 */}
        <div className="flex-grow w-full overflow-x-auto p-4">
          <EditorTimeline />
        </div>
      </div>
    </div>
  );
}
