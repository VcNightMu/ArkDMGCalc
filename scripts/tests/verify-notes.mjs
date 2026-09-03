// 说明区（notes-panel）渲染验证：
// 只展示有说明的已选干员、无说明跳过、空槽/全空显示占位
// （双说明顺序验证见 verify-notes-order.mjs：notes.json 有模块级缓存，需独立进程）
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

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
const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
globalThis.fetch = async (url) => {
  const p = BASE + '/' + String(url).replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};

const ui = await import('../../src/frontend/js/ui.js');
let ok = true;
const check = (label, cond) => { if (!cond) ok = false; console.log(label + ': ' + (cond ? 'OK' : 'FAIL')); };

// 1) 空槽位：占位
state.slots = [null, null, null, null];
await ui.updateResults();
check('空槽位显示占位', els['notes-list'].innerHTML.includes('placeholder-text'));

// 2) 顺序 + 跳过：槽0=华法琳(无说明) 槽1=闪灵(有) 槽2=塞雷娅(无说明)
state.slots = [
  { operatorId: 'char_171_bldsk', elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9 },
  { operatorId: 'char_147_shining', elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9 },
  { operatorId: 'char_202_demkni', elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7 },
];
await ui.updateResults();
const html = els['notes-list'].innerHTML;
check('说明区渲染了说明条目', html.includes('note-text'));
check('只含闪灵一条说明（跳过无说明干员）', (html.match(/note-text/g) || []).length === 1);
check('说明内容为 notes.json 文本', html.includes('示例'));
check('头部含干员名闪灵', html.includes('闪灵'));
check('头部含稀有度星标', html.includes('rarity-6'));
check('不含无说明干员名', !html.includes('华法琳') && !html.includes('塞雷娅'));

console.log(ok ? '✅ 全部通过' : '❌ 存在失败');
process.exit(ok ? 0 : 1);
