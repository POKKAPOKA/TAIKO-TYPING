// エディタの音声再生・シーク・キーボードショートカット・保存/読み込みなどの副作用を一元管理するコントローラ。
// ReactのuseEffectに依存せず、Zustandストアの購読（subscribe）とイベント駆動で動作する。
import { useEditorStore } from '../store/editorStore';

let audioEl = null;
let viewportEl = null;
let rafId = null;
let mockStartTime = 0;
let mockStartCurrentTime = 0;

// --- DOM要素の登録（コンポーネントのコールバックrefから呼ばれる） ---
export function registerEditorAudio(el) {
  audioEl = el;
}

export function registerEditorViewport(el) {
  viewportEl = el;
}

function hasAudioFile() {
  return !!(audioEl && audioEl.src && !audioEl.src.endsWith('null'));
}

function isAudioActuallyPlaying() {
  return !!(hasAudioFile() && !audioEl.paused && !audioEl.error);
}

// --- 再生時間の同期ループ（再生中のみrequestAnimationFrameで回す） ---
function syncLoop() {
  const state = useEditorStore.getState();

  if (!state.isPlaying) {
    rafId = null;
    return;
  }

  if (isAudioActuallyPlaying()) {
    state.setCurrentTime((audioEl.currentTime * 1000) - state.offset);
    if (audioEl.ended) {
      state.setIsPlaying(false);
    }
  } else {
    // 無音プレビュー
    const elapsed = performance.now() - mockStartTime;
    const newTime = mockStartCurrentTime + elapsed;
    state.setCurrentTime(newTime);

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

  rafId = requestAnimationFrame(syncLoop);
}

function startSyncLoop() {
  if (rafId === null) {
    rafId = requestAnimationFrame(syncLoop);
  }
}

function stopSyncLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// --- ストア変化への反応（useEffectの代わりとなる購読処理） ---
useEditorStore.subscribe((state, prev) => {
  // 再生状態の変化 → 音声の再生/停止と同期ループの制御
  if (state.isPlaying !== prev.isPlaying) {
    if (state.isPlaying) {
      if (hasAudioFile()) {
        audioEl.play().catch(e => {
          console.warn("Audio playback failed, falling back to silent mode:", e);
          // 音声再生に失敗しても無音プレビューとして進める
        });
      }
      mockStartTime = performance.now();
      mockStartCurrentTime = state.currentTime;
      startSyncLoop();
    } else {
      if (hasAudioFile()) {
        audioEl.pause();
      }
      stopSyncLoop();
    }
  }

  // ルーラーからのシーク要求
  if (state.seekRequest !== prev.seekRequest && state.seekRequest !== null) {
    if (hasAudioFile()) {
      audioEl.currentTime = (state.seekRequest + state.offset) / 1000;
    }
    state.setCurrentTime(state.seekRequest);

    if (state.isPlaying) {
      mockStartTime = performance.now();
      mockStartCurrentTime = state.seekRequest;
    }

    state.setSeekRequest(null);
  }
});

// --- 再生操作 ---
export function toggleEditorPlayback() {
  const state = useEditorStore.getState();
  state.setIsPlaying(!state.isPlaying);
}

export function resetEditorPlayback() {
  const state = useEditorStore.getState();
  state.setIsPlaying(false);
  state.setCurrentTime(0 - state.offset);
  state.setScrollTimeOffset(0);
  if (viewportEl) {
    viewportEl.scrollLeft = 0;
  }
  if (audioEl) {
    audioEl.currentTime = 0;
  }
}

// --- 音源の読み込みと波形解析 ---
export async function loadEditorAudio(file) {
  if (!file) return;

  const state = useEditorStore.getState();
  const url = URL.createObjectURL(file);
  state.setAudioUrl(url);
  if (state.isPlaying) {
    state.setIsPlaying(false);
  }
  state.setCurrentTime(0);
  state.setScrollTimeOffset(0);
  if (viewportEl) {
    viewportEl.scrollLeft = 0;
  }

  // 波形解析 (Web Audio API)
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 簡易的なPeak抽出 (チャンネル0のみ、50msごとに最大値を取得)
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.floor(audioBuffer.sampleRate * 0.05);
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

// --- 譜面の保存 / 読み込み ---
function generateSaveData() {
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

  // タイムライン上で追加・編集した結果、時間が前後している可能性があるので必ずtimeでソートする
  compiledNotes.sort((a, b) => a.time - b.time);

  return JSON.stringify({ bpm: currentBpm, offset: currentOffset, notes: compiledNotes }, null, 2);
}

async function writeToFileHandle(fileHandle, data) {
  if (await fileHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
    const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      throw new Error('Permission denied');
    }
  }
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

function fallbackDownload(data) {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'score.json';
  a.click();
  URL.revokeObjectURL(url);
  useEditorStore.getState().showEditorToast("保存完了！トップの『創作譜面を遊ぶ』からファイルを読み込んでテストプレイしてみよう");
}

export async function saveScoreAs() {
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
      useEditorStore.getState().showEditorToast("別名で保存しました");
    } else {
      fallbackDownload(data);
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error("Save As failed:", e);
      useEditorStore.getState().showEditorToast("保存に失敗しました");
    }
  }
}

export async function saveScore() {
  const state = useEditorStore.getState();
  const data = generateSaveData();

  if (window.showSaveFilePicker && state.fileHandle) {
    try {
      await writeToFileHandle(state.fileHandle, data);
      useEditorStore.getState().showEditorToast("上書き保存しました");
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error("Save failed:", e);
        useEditorStore.getState().showEditorToast("保存に失敗しました。SAVE AS を試してください。");
      }
    }
  } else {
    await saveScoreAs();
  }
}

export function importScoreFile(file) {
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
            id: note.id || crypto.randomUUID(),
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
      useEditorStore.getState().showEditorToast("無効なJSONファイルです。");
    }
  };
  reader.readAsText(file);
}

// --- キーボードショートカット ---
// エディタ画面が開いているかどうかはDOM上の data-editor-root 属性で判定する
// （Reactのマウント検知にuseEffectを使わないため）
function isEditorOpen() {
  return !!document.querySelector('[data-editor-root]');
}

function handleEditorKeyDown(e) {
  if (!isEditorOpen()) return;

  // Input 要素入力中やボタンフォーカス中はカスタムショートカットを無効化（ブラウザ標準動作に任せる）
  const tagName = e.target.tagName ? e.target.tagName.toLowerCase() : '';
  const isInput = tagName === 'input' || tagName === 'textarea';
  const isButton = tagName === 'button';

  if (isInput) return; // 入力欄ではすべてのショートカットを無効化

  const state = useEditorStore.getState();

  // 再生トグル (Space)
  if (e.code === 'Space' && !isButton) {
    e.preventDefault();
    toggleEditorPlayback();
  }

  // 削除 (Delete / Backspace)
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedNoteIds && state.selectedNoteIds.length > 0) {
      e.preventDefault();
      state.removeMultipleNotes(state.selectedNoteIds);
      state.setSelectedNoteIds([]);
      state.showEditorToast("削除しました");
    }
  }

  // Undo / Redo / Copy / Paste / Save / Select All / モーダル呼び出し
  const cmdKey = e.ctrlKey || e.metaKey;

  if (cmdKey) {
    if (e.code === 'KeyM') {
      // 連続ノーツ一括追加 (Ctrl + M)
      e.preventDefault();
      state.openModal('bulkAdd');
    } else if (e.code === 'KeyH') {
      // 一括置換 (Ctrl + H)
      if (state.selectedNoteIds && state.selectedNoteIds.length > 0) {
        e.preventDefault();
        state.openModal('replace');
      }
    } else if (e.code === 'KeyL') {
      // 歌詞の流し込み (Ctrl + L)
      if (state.selectedNoteIds && state.selectedNoteIds.length > 0) {
        e.preventDefault();
        state.openModal('lyrics');
      }
    } else if (e.code === 'KeyA') {
      // 全選択 (Ctrl + A)
      e.preventDefault();
      const allNoteIds = state.editorNotes.map(n => n.id);
      state.setSelectedNoteIds(allNoteIds);
    } else if (e.code === 'KeyS') {
      // 上書き保存 (クイックセーブ)
      e.preventDefault();
      saveScore();
    } else if (e.code === 'KeyZ') {
      e.preventDefault();
      if (e.shiftKey) {
        state.redo();
        state.showEditorToast("やり直しました");
      } else {
        state.undo();
        state.showEditorToast("元に戻しました");
      }
    } else if (e.code === 'KeyY') {
      e.preventDefault();
      state.redo();
      state.showEditorToast("やり直しました");
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

        // 現在のシークバー位置を基準（ビート）に変換し、16分グリッド(0.25拍単位)にスナップさせる
        let currentBeats = (state.currentTime / (60000 / state.bpm));
        currentBeats = Math.round(currentBeats * 4) / 4;

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
}

// リスナーはアプリ起動時に1度だけ登録する
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', handleEditorKeyDown);
}
