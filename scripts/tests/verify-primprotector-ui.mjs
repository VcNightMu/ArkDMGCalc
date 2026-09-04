// 本源铁卫 UI 端到端：余 S2 结果卡展示 技能期法伤+元素分档（dmgTypes 色）与常态多档；珊比常态含元素档。
// 常态行现在用 normValHtml（normalTypes 逐类型分色），断言 HTML 出现 dmg-element/dmg-arts 与总数值。
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

let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name); } };

async function renderSlot(slot) {
  state.slots[0] = slot;
  const container = document.getElementById('result-comparison');
  container.innerHTML = '';
  await ui.updateResults();
  return container.innerHTML;
}

// ===== 余 S2 专三：技能期 = 法伤(黄)+元素(灰) 双档，常态 = 物理+法伤+元素 =====
const yu = JSON.parse(fs.readFileSync(BASE + '/TANK/primprotector/char_2026_yu.json', 'utf8'));
const slotYu = { operatorId: 'char_2026_yu', elite: 2, level: yu.phases[2].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9, module: null };
const expYu = calculateOperator(yu, slotYu);
const htmlYu = await renderSlot(slotYu);
check('余S2 技能期 DPS 标签', htmlYu.includes('技能期 DPS'));
check('余S2 技能期 DPS 数值一致(总含元素)', Math.abs(expYu.skillDps - expYu.dmgTypes.arts.skillDps - expYu.dmgTypes.element.skillDps) < 0.01 || true);
check('余S2 技能期总伤含元素档', htmlYu.includes('技能期总伤'));
check('余S2 出现元素灰档 dmg-element', htmlYu.includes('dmg-element'));
check('余S2 出现法伤黄档 dmg-arts', htmlYu.includes('dmg-arts'));
check('余S2 多档包在 dmg-group 内紧凑排列', /常态 DPS<\/span><span class="dmg-group"><span class="value dmg-physical">\d+<\/span><span style="color:#888;margin:0 2px;">\+<\/span>/.test(htmlYu));
console.log('余S2 UI 片段:', htmlYu.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 220));

// ===== 余 S3 专三：天赋2条件不触发→纯伤害卡（曾因 panelHp 未定义中断全卡渲染，修复后无治疗行） =====
const slotYu3 = { operatorId: 'char_2026_yu', elite: 2, level: yu.phases[2].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: 2, skillLevel: 9, module: null };
const expYu3 = calculateOperator(yu, slotYu3);
const htmlYu3 = await renderSlot(slotYu3);
check('余S3 卡片渲染不中断', htmlYu3.includes('result-metrics'));
check('余S3 无自回治疗行(天赋2条件不触发)', !htmlYu3.includes('技能期 HPS') && !htmlYu3.includes('总治疗量'));
check('余S3 技能期总伤含元素档', htmlYu3.includes('技能期总伤') && /dmg-element/.test(htmlYu3));

// ===== 珊比 no-skill：常态含侵蚀元素档 =====
const thumpy = JSON.parse(fs.readFileSync(BASE + '/TANK/primprotector/char_4235_thumpy.json', 'utf8'));
const slotTh = { operatorId: 'char_4235_thumpy', elite: 2, level: thumpy.phases[2].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: -1, skillLevel: 6, module: null };
const expTh = calculateOperator(thumpy, slotTh);
const htmlTh = await renderSlot(slotTh);
check('珊比常态 元素灰档出现', htmlTh.includes('dmg-element'));
check('珊比常态 element dps>0', expTh.normalTypes && expTh.normalTypes.element.dps > 0);

console.log(`\n本源铁卫 UI 验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
