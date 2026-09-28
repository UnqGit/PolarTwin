const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

// Find the start of the duplicate block
const searchStr = "setGlobalTolerance: async (runId: string, value: number)";
const lastIdx = code.lastIndexOf(searchStr);

if (lastIdx > 0) {
    // find the comma before it
    const commaIdx = code.lastIndexOf(',', lastIdx);
    if (commaIdx > 0) {
        const newCode = code.substring(0, commaIdx) + "\n};\n";
        fs.writeFileSync('src/lib/api.ts', newCode);
        console.log("Truncated successfully");
    }
}
