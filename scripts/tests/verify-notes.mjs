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

// 2) 跳过无说明：槽0=录武官(有说明) 槽1=末药(无说明) 槽2=斑点(无说明)
state.slots = [
  { operatorId: 'char_4196_reckpr', elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7 },
  { operatorId: 'char_117_myrrh', elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7 },
  { operatorId: 'char_284_spot', elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7 },
];
await ui.updateResults();
const html = els['notes-list'].innerHTML;
check('说明区渲染了说明条目', html.includes('note-text'));
check('只含录武官一条说明（跳过无说明干员）', (html.match(/note-text/g) || []).length === 1);
check('说明内容为 notes.json 正式文本（学成于聚）', html.includes('学成于聚'));
check('头部含干员名录武官', html.includes('录武官'));
check('头部含稀有度星标', html.includes('rarity-5'));
check('闪灵说明不含示例占位', !html.includes('示例'));
check('不含无说明干员名', !html.includes('末药') && !html.includes('斑点'));

// 3) 子职业通用说明：选锡兰+流明（两名疗养师）→ 通用说明只渲染一次，个人说明各一条
state.slots = [
  { operatorId: 'char_348_ceylon', elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7 },
  { operatorId: 'char_4042_lumen', elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7 },
  null, null,
];
await ui.updateResults();
const html2 = els['notes-list'].innerHTML;
check('含疗养师通用说明（不考虑距离衰减）', html2.includes('疗养师不考虑治疗较远目标时的衰减'));
check('通用说明带子职业标签', html2.includes('note-sub-tag'));
check('通用说明仅出现一次', (html2.match(/不考虑治疗较远目标时的衰减/g) || []).length === 1);
check('锡兰个人说明（湖畔漫步者）', html2.includes('湖畔漫步者'));
check('流明个人说明（应急处理）', html2.includes('应急处理'));
check('通用说明在个人说明之前', html2.indexOf('不考虑治疗较远目标时的衰减') < html2.indexOf('湖畔漫步者'));

console.log(ok ? '✅ 全部通过' : '❌ 存在失败');
process.exit(ok ? 0 : 1);
