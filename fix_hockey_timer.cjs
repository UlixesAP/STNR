const fs = require('fs');
const file = 'js/scoreboard.js';
let content = fs.readFileSync(file, 'utf8');

// Find the hockey section - it has the pattern: ${summary}`; followed by },
// and then _teamZoneHockey
const hockeyPattern = /(\$\\{summary\}`;\r?\n\s+}\,\r?\n\r?\n\s+)_teamZoneHockey/g;

if (hockeyPattern.test(content)) {
  content = content.replace(
    /(\$\\{summary\}`;\r?\n)(\s+}\,\r?\n\r?\n)(\s+_teamZoneHockey)/g,
    '$1      ${ScoreTimer.html()}`;\r\n$2$3'
  );
  console.log('Replaced!');
} else {
  // Simpler approach - just find the exact line
  const lines = content.split('\r\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '${summary}`;') {
      // Check if this is in hockey section (after line 900)
      if (i > 900) {
        lines[i] = '      ${summary}\n      ${ScoreTimer.html()}`;';
        found = true;
        console.log('Fixed at line', i + 1);
        break;
      }
    }
  }
  if (!found) {
    console.log('NOT FOUND!');
  }
}

fs.writeFileSync(file, content, 'utf8');
