const fs = require('fs');
const c = fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/js/app.js', 'utf8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('maxLevel') && lines[i].includes('max')) {
    console.log('L' + (i+1) + ':', lines[i].trim());
  }
}
