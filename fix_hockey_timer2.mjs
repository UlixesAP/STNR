import fs from 'fs';
const file = 'js/scoreboard.js';
let content = fs.readFileSync(file, 'utf8');

// Split preserving all line endings
const lines = content.split(/(\r?\n)/);

// Find the line with ${summary}`; in the hockey section
let found = false;
for (let i = 0; i < lines.length; i++) {
  if (!found && lines[i].includes('${summary}`') && i > 900) {
    // Insert ScoreTimer.html() after this line
    const indentedLine = '      ${ScoreTimer.html()}`;\n';
    lines.splice(i + 1, 0, indentedLine);
    found = true;
    console.log('Fixed hockey at approx line', i + 1);
    break;
  }
}

if (!found) {
  console.log('Still not found!');
  process.exit(1);
}

fs.writeFileSync(file, lines.join(''), 'utf8');
console.log('Done');
