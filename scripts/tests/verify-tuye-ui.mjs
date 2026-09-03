// 验证图耶 1 技能「水流环」UI 展示：不显示技能期 HPS，显示周期 HPS / 总治疗量
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
state.slots[0] = { operatorId: 'char_402_tuye', elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 9 };

const container = document.getElementById('result-comparison');
container.innerHTML = '';
await ui.updateResults();
const html = container.innerHTML;

const cycle = html.match(/周期 HPS<\/span><span class="value heal">(\d+)</)?.[1];
const total = html.match(/总治疗量<\/span><span class="value heal">(\d+)</)?.[1];
const normal = html.match(/常态 HPS<\/span><span class="value heal">(\d+)</)?.[1];
const hasSkillHps = html.includes('技能期 HPS');

console.log('周期 HPS:', cycle, '(期望 247)');
console.log('总治疗量:', total, '(期望 568)');
console.log('常态 HPS:', normal, '(期望 199)');
console.log('不显示技能期 HPS:', !hasSkillHps ? 'OK' : 'FAIL');

const ok = cycle === '247' && total === '568' && normal === '199' && !hasSkillHps;
console.log('\n最终:', ok ? '通过' : '失败');
process.exit(ok ? 0 : 1);
