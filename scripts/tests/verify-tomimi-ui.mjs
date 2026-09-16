// 特米米(corecaster)UI 端到端:两个技能的结果卡都必须展示「常态 DPS」(法术色)。
// 回归点:「荒野法术」仅技能开启时把普攻切物理,非技能期仍是职业法术普攻;
// 曾错误地在技能期普攻改写时把 normalDps 整行置空,导致 S1/S2 卡片都没有常态信息。
import * as ui from '../../src/frontend/js/ui.js';
import { state } from '../../src/frontend/js/state.js';
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
globalThis.fetch = async (url) => {
  const p = BASE + '/' + url.replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), innerHTML: '', className: '', dataset: {},
    style: {}, value: '', classList: { add() {}, remove() {}, contains: () => false },
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], focus() {},
  };
  el.appendChild = (child) => { el.innerHTML += (child.innerHTML || ''); };
  return el;
}
const els = {};
globalThis.document = {
  getElementById: (id) => (els[id] || (els[id] = makeEl(id))),
  createElement: (tag) => makeEl(tag),
  addEventListener() {}, body: makeEl('body'),
};
state.slots = [null, null, null, null, null];
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };

const op = JSON.parse(fs.readFileSync(BASE + '/CASTER/corecaster/char_411_tomimi.json', 'utf8'));
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name + (extra ? ' => ' + extra : '')); } };

async function renderSlot(slot) {
  state.slots[0] = slot;
  const container = document.getElementById('result-comparison');
  container.innerHTML = '';
  await ui.updateResults();
  const html = container.innerHTML;
  const grab = (label) => {
    const m = html.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '<\\/span><span class="value [^"]+">(\\d+)'));
    return m ? Number(m[1]) : null;
  };
  return { html, grab };
}

// E2满级 trust100 pot0 L7
const base = { operatorId: 'char_411_tomimi', elite: 2, level: op.phases[op.phases.length - 1].maxLevel, trustPercent: 100, potentialRank: 0, skillLevel: 7, module: null };

for (const si of [0, 1]) {
  const slot = { ...base, skillIndex: si };
  const exp = calculateOperator(op, slot);
  const { html, grab } = await renderSlot(slot);
  const name = op.skills[si].name;
  check(`S${si + 1}(${name}) 技能期DPS=物理色`, new RegExp('技能期 DPS<\\/span><span class="value dmg-physical"').test(html));
  const nd = grab('常态 DPS');
  check(`S${si + 1}(${name}) 展示常态 DPS`, nd !== null, 'html无常态行');
  check(`S${si + 1}(${name}) 常态 DPS 数值一致`, nd !== null && Math.abs(nd - exp.normalDps) <= 1, `${nd} vs ${exp.normalDps}`);
  check(`S${si + 1}(${name}) 常态打法术色(dmg-arts)`, new RegExp('常态 DPS<\\/span><span class="value dmg-arts"').test(html));
}

console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
