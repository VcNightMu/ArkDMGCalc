const fs = require('fs');
const c = fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/js/app.js', 'utf8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('modifiers') || lines[i].includes('atk') || lines[i].includes('def') || lines[i].includes('attackTargets') || lines[i].includes('skillAtk') || lines[i].includes('skillDef')) {
    if (i > 310 && i < 345) console.log('L' + (i+1) + ':', lines[i]);
  }
}
