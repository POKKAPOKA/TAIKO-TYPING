const fs = require("fs");
let code = fs.readFileSync("src/engine/RomajiParser.js", "utf8");

code = code.replace(
  "constructor(reading) {",
  "constructor(reading, nextReading = \"\") {\n    this.nextReading = nextReading;"
);

code = code.replace(
  "this.tokens = tokenizeReading(this.normalizedReading);\n    this.tokenOptions = this._buildTokenOptions(this.tokens);",
  "this.tokens = tokenizeReading(this.normalizedReading);\n    const nextTokens = tokenizeReading(toHiragana(this.nextReading || \"\"));\n    const lookaheadToken = nextTokens.length > 0 ? nextTokens[0] : null;\n    this.tokenOptions = this._buildTokenOptions(this.tokens, lookaheadToken);"
);

code = code.replace(
  "_buildTokenOptions(tokens) {",
  "_buildTokenOptions(tokens, lookaheadToken = null) {"
);

code = code.replace(
  "const nextChar = tokens[i+1] ? tokens[i+1][0] : null;",
  "const nextChar = tokens[i+1] ? tokens[i+1][0] : (lookaheadToken ? lookaheadToken[0] : null);"
);

code = code.replace(
  "const nextToken = tokens[i+1];",
  "const nextToken = tokens[i+1] || lookaheadToken;"
);

fs.writeFileSync("src/engine/RomajiParser.js", code);
