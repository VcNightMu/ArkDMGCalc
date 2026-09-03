// 说明区顺序验证（独立进程）：notes.json 模块级缓存，先写两条说明再渲染断言顺序，退出前还原
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const NOTES = BASE + '/notes.json';
const orig = fs.readFileSync(NOTES, 'utf8');

// 预写：华法琳 + 闪灵两条说明
const two = JSON.parse(orig);
two['char_171_bldsk'] = '华法琳说明（测试）';
two['char_147_shining'] = '闪灵说明（测试）';
fs.writeFileSync(NOTES, JSON.stringify(two, null, 2));

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
  createElement: (tag) => makeEl(tag), addEventListener() {}, body: makeEl('body'),
};
globalThis.fetch = async (url) => {
  const p = BASE + '/' + String(url).replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};

const ui = await import('../../src/frontend/js/ui.js');
state.slots = [
  { operatorId: 'char_171_bldsk', elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9 },
  { operatorId: 'char_147_shining', elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9 },
];
await ui.updateResults();
const html = els['notes-list'].innerHTML;
const first = html.indexOf('华法琳说明');
const second = html.indexOf('闪灵说明');
const ok = (html.match(/note-text/g) || []).length === 2 && first !== -1 && second !== -1 && first < second;
console.log('两条说明按选择顺序（华法琳在闪灵前）: ' + (ok ? 'OK' : 'FAIL'));

// 还原 notes.json
fs.writeFileSync(NOTES, orig);
process.exit(ok ? 0 : 1);
