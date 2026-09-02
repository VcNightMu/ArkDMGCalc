// 验证基础属性面板：calcPanelStats 计算 + renderPanelStats 渲染
import { calcPanelStats } from '../../src/frontend/js/damage-calc.js';
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

// 1. 槽位数量
console.log('slots 长度:', state.slots.length, state.slots.length === 4 ? '(期望4) OK' : '(期望4) FAIL');

// 2. calcPanelStats 计算
const op = JSON.parse(fs.readFileSync(BASE + '/MEDIC/physician/char_147_shining.json', 'utf8'));
const ps = calcPanelStats(op, { elite: 2, level: 90, trustPercent: 100, potentialRank: 0 });
console.log('闪灵 E2 Lv90 信赖100: HP=' + ps.panelHp + ' ATK=' + ps.panelAtk + ' DEF=' + ps.panelDef + ' 法抗=' + ps.magicResistance + ' 间隔=' + ps.baseAttackTime + 's');

// 等级变化 -> ATK 变化
const psLow = calcPanelStats(op, { elite: 2, level: 1, trustPercent: 0, potentialRank: 0 });
console.log('闪灵 E2 Lv1 信赖0:   HP=' + psLow.panelHp + ' ATK=' + psLow.panelAtk + ' DEF=' + psLow.panelDef);
console.log('ATK 随等级/信赖变化:', ps.panelAtk !== psLow.panelAtk ? 'OK' : 'FAIL');

// 3. renderPanelStats 渲染
state.slots = [null, null, null, null];
state.slots[0] = { operatorId: 'char_147_shining', elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 9 };
await ui.renderPanelStats();
const html = document.getElementById('panel-stats').innerHTML;
console.log('\nrenderPanelStats 包含 生命值:', html.includes('生命值') ? 'OK' : 'FAIL');
console.log('renderPanelStats 包含 攻击力:', html.includes('攻击力') ? 'OK' : 'FAIL');
console.log('renderPanelStats 包含 法术抗性:', html.includes('法术抗性') ? 'OK' : 'FAIL');
console.log('renderPanelStats 不含 攻击速度:', !html.includes('攻击速度') ? 'OK' : 'FAIL');
console.log('renderPanelStats 包含 ATK 值 ' + ps.panelAtk + ':', html.includes('>' + ps.panelAtk + '<') ? 'OK' : 'FAIL');
console.log('renderPanelStats 包含 闪灵:', html.includes('闪灵') ? 'OK' : 'FAIL');

// 4. 空状态
state.slots = [null, null, null, null];
await ui.renderPanelStats();
const emptyHtml = document.getElementById('panel-stats').innerHTML;
console.log('\n空状态显示占位:', emptyHtml.includes('选择干员后显示基础属性') ? 'OK' : 'FAIL');

console.log('\n--- 闪灵卡片 HTML 片段 ---');
console.log(html.slice(0, 700));
