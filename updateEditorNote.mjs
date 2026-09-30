import fs from "fs";
let code = fs.readFileSync("src/components/editor/EditorNote.jsx", "utf8");

code = code.replace(
  "  const selectedNoteIds = useEditorStore(state => state.selectedNoteIds);",
  "  const selectedNoteIds = useEditorStore(state => state.selectedNoteIds);\n  const allNotes = useEditorStore(state => state.notes);"
);

const kpsCalcOrig = `  // KPSŒvŽZ
  const durationMs = note.durationBeats * msPerBeat;
  const strokeCount = getKeystrokeCount(note.reading || note.word);
  const kps = durationMs > 0 ? strokeCount / (durationMs / 1000) : 0;`;

const kpsCalcNew = `  // KPSŒvŽZi˜A‘±ƒm[ƒcŒQ’PˆÊj
  let kps = 0;
  if (allNotes && allNotes.length > 0) {
    const sortedNotes = [...allNotes].sort((a, b) => ((a.measure * 4) + a.beat) - ((b.measure * 4) + b.beat));
    const currentIndex = sortedNotes.findIndex(n => n.id === note.id);
    if (currentIndex !== -1) {
      let startIndex = currentIndex;
      let endIndex = currentIndex;
      
      // Look backwards
      while (startIndex > 0) {
        const prev = sortedNotes[startIndex - 1];
        const curr = sortedNotes[startIndex];
        const prevEnd = ((prev.measure * 4) + prev.beat) + prev.durationBeats;
        const currStart = (curr.measure * 4) + curr.beat;
        if (Math.abs(prevEnd - currStart) < 0.01) startIndex--;
        else break;
      }
      
      // Look forwards
      while (endIndex < sortedNotes.length - 1) {
        const curr = sortedNotes[endIndex];
        const next = sortedNotes[endIndex + 1];
        const currEnd = ((curr.measure * 4) + curr.beat) + curr.durationBeats;
        const nextStart = (next.measure * 4) + next.beat;
        if (Math.abs(currEnd - nextStart) < 0.01) endIndex++;
        else break;
      }
      
      const groupText = sortedNotes.slice(startIndex, endIndex + 1).map(n => n.reading || n.word).join(\"\");
      const groupTotalBeats = sortedNotes.slice(startIndex, endIndex + 1).reduce((sum, n) => sum + n.durationBeats, 0);
      const groupStrokeCount = getKeystrokeCount(groupText);
      const groupDurationMs = groupTotalBeats * msPerBeat;
      kps = groupDurationMs > 0 ? groupStrokeCount / (groupDurationMs / 1000) : 0;
    }
  }`;

code = code.replace(kpsCalcOrig, kpsCalcNew);

fs.writeFileSync("src/components/editor/EditorNote.jsx", code);
