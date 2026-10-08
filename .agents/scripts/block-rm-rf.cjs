let inputData = "";
process.stdin.on("data", chunk => {
  inputData += chunk;
});

process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(inputData);
    const commandLine = payload.toolCall?.args?.CommandLine || "";
    
    const isDangerous = /rm\s+-rf\s+\*/.test(commandLine) || 
                        /rm\s+-r\s+-f\s+\*/.test(commandLine) ||
                        /Remove-Item\s+.*-Recurse\s+.*-Force\s+\*/i.test(commandLine);
    
    if (isDangerous) {
      console.log(JSON.stringify({ decision: "deny", reason: "Dangerous command blocked by workspace safety hooks." }));
    } else {
      console.log(JSON.stringify({ decision: "allow" }));
    }
  } catch (e) {
    console.log(JSON.stringify({ decision: "ask", reason: "Error in hook script: " + e.message }));
  }
});