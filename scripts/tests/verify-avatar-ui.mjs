// 验证 renderSlot 生成的头像 img
import { renderSlot } from '../../src/frontend/js/ui.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
globalThis.fetch = async (url) => {
  const p = BASE + '/' + url.replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};

const slots = [];
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), innerHTML: '', className: '', dataset: {},
    style: {}, value: '', classList: { add() {}, remove() {}, contains: () => false },
    addEventListener() {}, appendChild() {}, focus() {},
    querySelectorAll: () => [],
  };
  el.querySelector = () => makeEl('div');
  return el;
}
const container = makeEl('div');
container.querySelectorAll = () => slots;
for (let i = 0; i < 4; i++) slots.push(makeEl('div'));

globalThis.document = {
  getElementById: (id) => (id === 'operator-slots' ? container : makeEl(id)),
  createElement: (tag) => makeEl(tag),
  addEventListener() {}, body: makeEl('body'),
};

state.slots = [null, null, null, null];
state.slots[0] = { operatorId: 'char_172_svrash', elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 9 };

await renderSlot(0);
const html = slots[0].innerHTML;
console.log('包含头像 img 标签:', html.includes('<img class="slot-avatar"') ? 'OK' : 'FAIL');
console.log('头像路径正确:', html.includes('assets/avatars/WARRIOR/lord/char_172_svrash.png') ? 'OK' : 'FAIL');
console.log('alt 属性为干员名:', html.includes('alt="银灰"') ? 'OK' : 'FAIL');
console.log('\nHTML 片段:', html.slice(0, 260));
