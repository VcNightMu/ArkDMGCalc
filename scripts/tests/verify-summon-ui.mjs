// 验证医疗探机 UI 展示：治疗 HPS 标签 + 总治疗量
import * as ui from '../../src/frontend/js/ui.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
globalThis.fetch = async (url) => {
  const fp = BASE + '/' + url.replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(fp, 'utf8')) };
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
state.slots[0] = { operatorId: 'token_10000_silent_healrb', elite: 2, level: 80, trustPercent: 0, potentialRank: 0, skillIndex: 0, skillLevel: 0 };

const container = document.getElementById('result-comparison');
container.innerHTML = '';
await ui.updateResults();
const html = container.innerHTML;

const get = (label) => html.match(new RegExp(label + '</span><span class="value[^"]*">([^<]+)</span>'))?.[1];

const healHps = get('治疗 HPS');
const totalHeal = get('总治疗量');
const hasNormalLabel = html.includes('常态 HPS');

console.log('治疗 HPS:', healHps, '(期望 250)');
console.log('总治疗量:', totalHeal, '(期望 2500)');
console.log('不应出现「常态 HPS」:', hasNormalLabel ? '出现(FAIL)' : '未出现(OK)');

const ok = healHps === '250' && totalHeal === '2500' && !hasNormalLabel;
console.log('\n最终:', ok ? '通过' : '失败');
process.exit(ok ? 0 : 1);
