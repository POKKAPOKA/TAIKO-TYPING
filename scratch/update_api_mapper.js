import fs from "fs";
let code = fs.readFileSync("src/api/rankings.js", "utf8");

code = code.replace(
  /maxKps: Number\\(entry\\.peak_kps\\) \\|\\| 0\\s*\\}\\)\\);/g,
  `maxKps: Number(entry.peak_kps) || 0,
      perfectCount: Number(entry.perfect_count) || 0,
      goodCount: Number(entry.good_count) || 0,
      missCount: Number(entry.miss_count) || 0
    }));`
);

fs.writeFileSync("src/api/rankings.js", code);

