import fs from "fs";
let code = fs.readFileSync("src/engine/GameEngine.js", "utf8");

code = code.replace(
  "this.romajiParser = new RomajiParser(reading);",
  "let nextReading = \"\";\n      if (this.queue.length > 0) {\n        const nextNote = this.queue[0];\n        if (Math.abs(this.currentTarget.endTime - nextNote.time) < 1) {\n          nextReading = nextNote.reading || nextNote.word || \"\";\n        }\n      }\n      this.romajiParser = new RomajiParser(reading, nextReading);"
);

code = code.replace(
  "const strokeCount = getKeystrokeCount(this.currentTarget.reading || this.currentTarget.word);",
  "const strokeCount = this.romajiParser.typedString.length;"
);

fs.writeFileSync("src/engine/GameEngine.js", code);
