const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const logPath = path.join(__dirname, 'session-log.jsonl');
    const entry = {
      timestamp: new Date().toISOString(),
      response: data.response || data.content || data,
    };
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch (e) {
    // fail open
  }
});
