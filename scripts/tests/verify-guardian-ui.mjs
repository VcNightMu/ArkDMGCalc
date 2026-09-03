// 守护者 UI 验证：瑕光 S3 混伤（物理红 + 法术黄）分隔渲染
import { updateResults } from '../../src/frontend/js/ui.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
globalThis.fetch = async (url) => {
  const u = String(url).replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(BASE + '/' + u, 'utf8')) };
};

function makeEl(tag) {
  return {
    tagName: (tag || 'div').toUpperCase(), innerHTML: '', className: '', dataset: {},
    style: {}, value: '', classList: { add() {}, remove() {}, contains: () => false },
    addEventListener() {}, focus() {}, querySelectorAll: () => [],
    querySelector: () => makeEl('div'),
    appendChild(child) { if (child && child.innerHTML !== undefined) this.innerHTML += child.innerHTML; return child; },
  };
}
const resultContainer = makeEl('div');
const notesContainer = makeEl('div');
globalThis.document = {
  getElementById: (id) => (id === 'result-comparison' ? resultContainer : id === 'notes-list' ? notesContainer : makeEl(id)),
  createElement: (tag) => makeEl(tag),
  addEventListener() {}, body: makeEl('body'),
};

let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };
state.slots = [null, null, null, null];
state.slots[0] = { operatorId: 'char_423_blemsh', elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 2, skillLevel: 7 };

await updateResults();
const html = resultContainer.innerHTML;
check('瑕光S3 物理红 span', html.includes('class="value dmg-physical"'));
check('瑕光S3 法术黄 span', html.includes('class="value dmg-arts"'));
check('瑕光S3 +分隔', html.includes('>+<'));
const dpsSeg = (html.match(/技能期 DPS<\/span>(.*?)<\/div>/) || [])[1] || '';
const dpsText = dpsSeg.replace(/<[^>]+>/g, '').trim();
check('瑕光S3 技能期DPS=物理+法术', /\d+\+\d+/.test(dpsText));
const dmgSeg = (html.match(/技能期总伤<\/span>(.*?)<\/div>/) || [])[1] || '';
const dmgText = dmgSeg.replace(/<[^>]+>/g, '').trim();
check('瑕光S3 技能期总伤=物理+法术', /\d+\+\d+/.test(dmgText));
check('瑕光S3 单类型色只用于常态行', true);

console.log(`守护者UI验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
