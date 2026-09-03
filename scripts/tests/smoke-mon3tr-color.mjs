// 冒烟：Mon3tr 3技能（真伤）结果卡渲染检查——真伤行 dmg-true、面板行 stat、互不串色
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

// mock DOM（同 smoke-ui.mjs 模式）
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), innerHTML: '', className: '', dataset: {}, style: {}, value: '',
    classList: { add() {}, remove() {}, contains: () => false }, addEventListener() {}, appendChild() {},
    querySelector: () => null, querySelectorAll: () => [], focus() {},
  };
  el.appendChild = (child) => { el.innerHTML += (child.innerHTML || ''); };
  return el;
}
const els = {};
globalThis.document = {
  getElementById: (id) => (els[id] || (els[id] = makeEl(id))),
  createElement: (tag) => makeEl(tag),
  addEventListener() {},
  body: makeEl('body'),
};
const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';

globalThis.fetch = async (url) => {
  const p = BASE + '/' + String(url).replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};

const ui = await import('../../src/frontend/js/ui.js');
state.slots = [null, null, null, null];
state.slots[0] = { operatorId: 'token_10002_kalts_mon3tr', elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 2, skillLevel: 9 };
await ui.updateResults();

const html = els['result-comparison'].innerHTML;
let ok = true;
const check = (label, cond) => { if (!cond) ok = false; console.log(label + ': ' + (cond ? 'OK' : 'FAIL')); };

check('含 dmg-true（真伤白）', html.includes('dmg-true'));
check('含 value stat（面板金）', html.includes('value stat'));
const dmgRow = html.match(/技能期总伤<\/span><span class="value ([^"]+)">34069/);
check('总伤 34069 行 class = dmg-true（非物理）', dmgRow && dmgRow[1] === 'dmg-true');
const atkRow = html.match(/技能期 ATK<\/span><span class="value stat">5047/);
check('技能期ATK 5047 行 class = stat', !!atkRow);
const normalRow = html.match(/常态 DPS<\/span><span class="value ([^"]+)">401/);
check('常态DPS 401 行 class = dmg-physical（非真伤）', normalRow && normalRow[1] === 'dmg-physical');
check('常态DPS 行未被标 dmg-true', !html.match(/常态 DPS<\/span><span class="value dmg-true">401/));
const intRow = html.match(/技能期攻击间隔<\/span><span class="value stat">2\.00s/);
check('技能期攻击间隔 行 class = stat', !!intRow);
// 对照：医疗探机治疗召唤物不应出现 stat 面板行外的伤害错标（无 dmg 色）
console.log(ok ? '✅ 冒烟通过' : '❌ 冒烟失败');
process.exit(ok ? 0 : 1);
