import { useState } from 'react';
import EditorTimeline from './EditorTimeline';
import { useEditorStore } from '../../store/editorStore';
import {
  registerEditorAudio,
  loadEditorAudio,
  resetEditorPlayback,
  toggleEditorPlayback,
  saveScore,
  saveScoreAs,
  importScoreFile,
} from '../../engine/EditorController';

// 音声の再生制御・時間同期・シーク・キーボードショートカットは
// engine/EditorController.js がストア購読とイベント駆動で担うため、useEffectは使わない。
export default function EditorView({ onExit }) {
  const isPlaying = useEditorStore(state => state.isPlaying);
  const bpm = useEditorStore(state => state.bpm);
  const setBpm = useEditorStore(state => state.setBpm);
  const offset = useEditorStore(state => state.offset);
  const setOffset = useEditorStore(state => state.setOffset);
  const audioUrl = useEditorStore(state => state.audioUrl);
  const toastMessage = useEditorStore(state => state.toastMessage);
  const activeModal = useEditorStore(state => state.activeModal);
  const closeModal = useEditorStore(state => state.closeModal);

  // 一括置換モーダル用
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [replaceTarget, setReplaceTarget] = useState("both");

  // 連続ノーツ一括追加モーダル用
  const [bulkAddText, setBulkAddText] = useState("");
  const [bulkAddInterval, setBulkAddInterval] = useState(0.25); // 16分音符: 0.25拍, 8分音符: 0.5拍

  // 歌詞流し込み用
  const [lyricsText, setLyricsText] = useState("");

  const handleReplaceSubmit = (e) => {
    e.preventDefault();
    if (!findText) return;

    const state = useEditorStore.getState();
    if (!state.selectedNoteIds || state.selectedNoteIds.length === 0) {
      closeModal();
      return;
    }

    const updates = [];
    let replaceCount = 0;

    state.selectedNoteIds.forEach(id => {
      const note = state.editorNotes.find(n => n.id === id);
      if (note) {
        let hasChanges = false;
        const noteUpdates = {};

        if ((replaceTarget === 'word' || replaceTarget === 'both') && note.word.includes(findText)) {
          noteUpdates.word = note.word.split(findText).join(replaceText);
          hasChanges = true;
        }

        if ((replaceTarget === 'reading' || replaceTarget === 'both') && note.reading && note.reading.includes(findText)) {
          noteUpdates.reading = note.reading.split(findText).join(replaceText);
          hasChanges = true;
        }

        if (hasChanges) {
          updates.push({ id, updates: noteUpdates });
          replaceCount++;
        }
      }
    });

    if (updates.length > 0) {
      state.updateMultipleNotes(updates);
      state.showEditorToast(`${replaceCount}件のノーツを置換しました`);
    } else {
      state.showEditorToast("対象の文字列が見つかりませんでした");
    }

    closeModal();
    setFindText("");
    setReplaceText("");
  };

  const handleBulkAddSubmit = (e) => {
    e.preventDefault();
    if (!bulkAddText) return;

    const state = useEditorStore.getState();
    const chunks = bulkAddText.match(/.[ぁぃぅぇぉゃゅょっゎ]*/g) || [];
    if (chunks.length === 0) return;

    let currentBeats = (state.currentTime / (60000 / state.bpm));
    currentBeats = Math.round(currentBeats * 4) / 4;

    const stepBeats = Number(bulkAddInterval) || 0.25;
    let beatOffset = 0;
    const newNotes = [];

    chunks.forEach((chunk) => {
      if (chunk.trim() === '' || chunk === '　') {
        beatOffset += stepBeats;
        return;
      }

      const beatTime = currentBeats + beatOffset;
      newNotes.push({
        id: crypto.randomUUID(),
        measure: Math.floor(beatTime / 4),
        beat: beatTime % 4,
        durationBeats: 0.25,
        word: chunk,
        reading: chunk,
      });
      beatOffset += stepBeats;
    });

    if (newNotes.length > 0) {
      state.addMultipleNotes(newNotes);
      state.showEditorToast(`${newNotes.length}件の連続ノーツを追加しました`);
    }

    closeModal();
    setBulkAddText("");
  };

  const handleLyricsSubmit = (e) => {
    e.preventDefault();
    if (!lyricsText) return;

    const state = useEditorStore.getState();
    if (!state.selectedNoteIds || state.selectedNoteIds.length === 0) {
      closeModal();
      return;
    }

    const rawChunks = lyricsText.match(/.[ぁぃぅぇぉゃゅょっゎ]*/g) || [];
    const chunks = rawChunks.filter(c => c.trim() !== '' && c !== '　');
    if (chunks.length === 0) return;

    // 選択中のノーツを時間の昇順でソート
    const targetNotes = state.editorNotes
      .filter(n => state.selectedNoteIds.includes(n.id))
      .sort((a, b) => {
        const aBeats = a.measure * 4 + a.beat;
        const bBeats = b.measure * 4 + b.beat;
        return aBeats - bBeats;
      });

    const updates = [];
    let applyCount = 0;

    targetNotes.forEach((note, index) => {
      if (index < chunks.length) {
        updates.push({
          id: note.id,
          updates: {
            word: chunks[index],
            reading: chunks[index]
          }
        });
        applyCount++;
      }
    });

    if (updates.length > 0) {
      state.updateMultipleNotes(updates);

      if (chunks.length > targetNotes.length) {
        state.showEditorToast(`${applyCount}件の文字を割り当てました（${chunks.length - targetNotes.length}文字余っています）`);
      } else if (chunks.length < targetNotes.length) {
        state.showEditorToast(`${applyCount}件の文字を割り当てました（ノーツが${targetNotes.length - chunks.length}個余っています）`);
      } else {
        state.showEditorToast(`${applyCount}件の文字を割り当てました`);
      }
    }

    closeModal();
    setLyricsText("");
  };

  return (
    <div data-editor-root="true" className="fixed inset-0 z-50 bg-neutral-900 text-white flex flex-col font-sans select-none overflow-hidden p-2">
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-cyan-600 text-white px-6 py-3 rounded-xl font-bold z-[1000] pointer-events-none transition-opacity duration-300 shadow-none">
          {toastMessage}
        </div>
      )}

      {activeModal === 'bulkAdd' && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleBulkAddSubmit}
            className="bg-neutral-800 p-6 rounded-2xl w-[28rem] flex flex-col gap-4 shadow-none"
          >
            <h2 className="text-xl font-bold text-white mb-2">連続ノーツ一括追加</h2>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-neutral-400">追加する文字列 (小文字は結合、空白は休符)</label>
              <input
                type="text"
                autoFocus
                value={bulkAddText}
                onChange={(e) => setBulkAddText(e.target.value)}
                className="bg-neutral-900 border-2 border-neutral-700 text-white rounded-xl px-4 py-2 font-bold outline-none focus:border-cyan-500 transition-colors shadow-none"
                placeholder="例: ちゃっと あい"
              />
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <label className="text-sm font-bold text-neutral-400">配置間隔</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bulkAddInterval"
                    value={0.5}
                    checked={bulkAddInterval === 0.5}
                    onChange={() => setBulkAddInterval(0.5)}
                    className="accent-cyan-500"
                  />
                  <span className="font-bold">8分音符</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bulkAddInterval"
                    value={0.25}
                    checked={bulkAddInterval === 0.25}
                    onChange={() => setBulkAddInterval(0.25)}
                    className="accent-cyan-500"
                  />
                  <span className="font-bold">16分音符</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => { closeModal(); setBulkAddText(""); }}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-xl font-bold transition-colors shadow-none"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!bulkAddText}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-colors shadow-none"
              >
                追加する
              </button>
            </div>
          </form>
        </div>
      )}

      {activeModal === 'lyrics' && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleLyricsSubmit}
            className="bg-neutral-800 p-6 rounded-2xl w-[28rem] flex flex-col gap-4 shadow-none"
          >
            <h2 className="text-xl font-bold text-white mb-2">歌詞の一括流し込み</h2>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-neutral-400">割り当てるテキスト (選択中のノーツに左から順番に適用されます)</label>
              <textarea
                autoFocus
                value={lyricsText}
                onChange={(e) => setLyricsText(e.target.value)}
                rows={3}
                className="bg-neutral-900 border-2 border-neutral-700 text-white rounded-xl px-4 py-2 font-bold outline-none focus:border-cyan-500 transition-colors shadow-none resize-none"
                placeholder="例: ちゃっと あい"
              />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => { closeModal(); setLyricsText(""); }}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-xl font-bold transition-colors shadow-none"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!lyricsText}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-colors shadow-none"
              >
                割り当て実行
              </button>
            </div>
          </form>
        </div>
      )}

      {activeModal === 'replace' && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleReplaceSubmit}
            className="bg-neutral-800 p-6 rounded-2xl w-[28rem] flex flex-col gap-4 shadow-none"
          >
            <h2 className="text-xl font-bold text-white mb-2">一括置換</h2>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-neutral-400">検索する文字列 (Find)</label>
              <input
                type="text"
                autoFocus
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className="bg-neutral-900 border-2 border-neutral-700 text-white rounded-xl px-4 py-2 font-bold outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-neutral-400">置換後の文字列 (Replace)</label>
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="bg-neutral-900 border-2 border-neutral-700 text-white rounded-xl px-4 py-2 font-bold outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-neutral-400">置換対象</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="replaceTarget"
                    value="both"
                    checked={replaceTarget === 'both'}
                    onChange={() => setReplaceTarget('both')}
                    className="accent-cyan-500"
                  />
                  <span className="text-sm font-bold">両方</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="replaceTarget"
                    value="word"
                    checked={replaceTarget === 'word'}
                    onChange={() => setReplaceTarget('word')}
                    className="accent-cyan-500"
                  />
                  <span className="text-sm font-bold">表示文字のみ</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="replaceTarget"
                    value="reading"
                    checked={replaceTarget === 'reading'}
                    onChange={() => setReplaceTarget('reading')}
                    className="accent-cyan-500"
                  />
                  <span className="text-sm font-bold">タイピング(ひらがな)のみ</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  closeModal();
                  setFindText("");
                  setReplaceText("");
                }}
                className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-900 rounded-full font-bold transition-colors"
              >
                置換実行
              </button>
            </div>
          </form>
        </div>
      )}

      <audio
        ref={registerEditorAudio}
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
               onClick={toggleEditorPlayback}
               className={`px-8 py-2 rounded-full font-black transition-colors flex-shrink-0 ${isPlaying ? 'bg-red-500 text-white' : 'bg-green-500 text-neutral-900'}`}
             >
               {isPlaying ? '一時停止' : '再生'}
             </button>
             <button
               onClick={resetEditorPlayback}
               className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors flex-shrink-0"
             >
               停止＆リセット
             </button>

             {/* オーディオ読み込み */}
             <label className="cursor-pointer bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-full font-bold transition-colors flex items-center gap-2 flex-shrink-0">
               <span>音源読み込み</span>
               <input type="file" accept="audio/*" className="hidden" onChange={(e) => loadEditorAudio(e.target.files[0])} />
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
               onClick={saveScore}
               className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-neutral-900 rounded-full font-bold transition-colors ml-2 flex-shrink-0"
             >
               SAVE
             </button>
             <button
               onClick={saveScoreAs}
               className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-bold transition-colors flex-shrink-0"
             >
               SAVE AS
             </button>
             <label className="cursor-pointer bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-full font-bold transition-colors flex items-center flex-shrink-0">
               <span>IMPORT</span>
               <input type="file" accept=".json" className="hidden" onChange={(e) => { importScoreFile(e.target.files[0]); e.target.value = null; }} />
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
