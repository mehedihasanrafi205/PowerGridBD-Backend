const fs = require('fs');
const content = fs.readFileSync('src/app/module/analytics/analytics.service.ts', 'utf8');
let inString = false;
let stringChar = '';
let braceInString = 0;
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (!inString) {
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
    }
  } else if (c === stringChar && content[i-1] !== '\\') {
    inString = false;
  }
  if (inString && (c === '{' || c === '}')) {
    braceInString++;
  }
}
console.log('Braces in strings:', braceInString);