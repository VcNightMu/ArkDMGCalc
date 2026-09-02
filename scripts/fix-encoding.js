const fs = require('fs');
const f = 'F:/ArkCodes/ArkDMGCalc/src/frontend/js/app.js';
let content = fs.readFileSync(f, 'utf8');
const NL = '\r\n';

// 1. Filter skill options by elite level
const oldSkillSelect =
  "  html += '<select data-index=\"' + index + '\" data-field=\"skillIndex\">';" + NL +
  "  for (let i = 0; i < op.skills.length; i++) {" + NL +
  "    const sel = i === (data.skillIndex || 0) ? ' selected' : '';" + NL +
  "    html += '<option value=\"' + i + '\"' + sel + '>' + op.skills[i].name + '</option>';" + NL +
  "  }" + NL +
  "  html += '</select></div>';";

const newSkillSelect =
  "  // skill index - restricted by elite: E0=skill1, E1=skill1-2, E2=skill1-3" + NL +
  "  const maxSiForElite = data.elite === 0 ? 0 : data.elite === 1 ? 1 : 2;" + NL +
  "  const skillCount = Math.min(op.skills.length, maxSiForElite + 1);" + NL +
  "  html += '<select data-index=\"' + index + '\" data-field=\"skillIndex\">';" + NL +
  "  for (let i = 0; i < skillCount; i++) {" + NL +
  "    const sel = i === (data.skillIndex || 0) ? ' selected' : '';" + NL +
  "    html += '<option value=\"' + i + '\"' + sel + '>' + op.skills[i].name + '</option>';" + NL +
  "  }" + NL +
  "  html += '</select></div>';";

if (content.includes(oldSkillSelect)) {
  content = content.replace(oldSkillSelect, newSkillSelect);
  console.log('OK: skill select filtered by elite');
} else {
  console.log('WARN: skill select pattern not found');
}

// 2. Clamp skill index when elite changes
const oldEliteClamp =
  "        const maxSl = value === 0 ? 3 : value === 1 ? 6 : 9;" + NL +
  "        if (state.slots[index].skillLevel > maxSl) state.slots[index].skillLevel = maxSl;";

const newEliteClamp =
  "        const maxSl = value === 0 ? 3 : value === 1 ? 6 : 9;" + NL +
  "        if (state.slots[index].skillLevel > maxSl) state.slots[index].skillLevel = maxSl;" + NL +
  "        const maxSi = value === 0 ? 0 : value === 1 ? 1 : 2;" + NL +
  "        if (state.slots[index].skillIndex > maxSi) state.slots[index].skillIndex = maxSi;";

if (content.includes(oldEliteClamp)) {
  content = content.replace(oldEliteClamp, newEliteClamp);
  console.log('OK: skill index clamped on elite change');
} else {
  console.log('WARN: elite clamp pattern not found');
}

fs.writeFileSync(f, content, 'utf8');

const check = fs.readFileSync(f, 'utf8');
console.log('has maxSiForElite:', check.includes('maxSiForElite'));
console.log('has maxSi:', check.includes('const maxSi'));
console.log('garbled:', /\uFFFD/.test(check));
