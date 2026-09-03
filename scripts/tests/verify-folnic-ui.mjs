// 验证亚叶 2 技能「复合型药物弹片」UI 展示：同时显示治疗与独立伤害
import * as ui from '../../src/frontend/js/ui.js';
import { state } from '../../src/frontend/js/state.js';
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

state.slots = [null, null, null, null];
state.slots[0] = { operatorId: 'char_345_folnic', elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9 };

const container = document.getElementById('result-comparison');
container.innerHTML = '';
await ui.updateResults();
const html = container.innerHTML;

const get = (label) => html.match(new RegExp(label + '</span><span class="value[^"]*">([^<]+)</span>'))?.[1];

const normalHps = get('常态 HPS');
const skillHps = get('技能期 HPS');
const totalHeal = get('总治疗量');
const skillDps = get('技能期 DPS');
const skillTotalDamage = get('技能期总伤');

console.log('常态 HPS:', normalHps, '(期望 186)');
console.log('技能期 HPS:', skillHps, '(期望 278)');
console.log('总治疗量:', totalHeal, '(期望 7935)');
console.log('技能期 DPS:', skillDps, '(期望 186)');
console.log('技能期总伤:', skillTotalDamage, '(期望 5290)');

const ok = normalHps === '186' && skillHps === '278' && totalHeal === '7935' && skillDps === '186' && skillTotalDamage === '5290';
console.log('\n最终:', ok ? '通过' : '失败');
process.exit(ok ? 0 : 1);
