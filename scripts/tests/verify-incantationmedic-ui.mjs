// 咒愈师 UI 端到端：焰影苇草结果卡需同时展示 常态DPS+常态HPS（普攻双轨）与 技能期DPS+技能期HPS+总治疗；
// 效果模组切换把 trait scale 0.5→0.6，常态 HPS 应同步放大（DPS 不变）。
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

const op = JSON.parse(fs.readFileSync(BASE + '/MEDIC/incantationmedic/char_1020_reed2.json', 'utf8'));
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

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

// 焰影苇草 E2L90 S1 L7（迅捷打击·γ），无模组
const slot = { operatorId: 'char_1020_reed2', elite: 2, level: op.phases[2].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7, module: null };
const exp = calculateOperator(op, slot);
const { html, grab } = await renderSlot(slot);

check('UI 显示常态 DPS（普攻伤害）', grab('常态 DPS') !== null);
check('UI 显示常态 HPS（普攻治疗）', grab('常态 HPS') !== null);
check('UI 显示技能期 DPS', grab('技能期 DPS') !== null);
check('UI 显示技能期 HPS', grab('技能期 HPS') !== null);
check('UI 显示总治疗量', grab('总治疗量') !== null);
check('常态 DPS 数值一致', grab('常态 DPS') !== null && Math.abs(grab('常态 DPS') - exp.normalDps) <= 1);
check('常态 HPS 数值一致', Math.abs(grab('常态 HPS') - exp.normalHps) <= 1);
check('技能期 HPS 数值一致', Math.abs(grab('技能期 HPS') - exp.skillHps) <= 1);
check('技能期 DPS 数值一致', Math.abs(grab('技能期 DPS') - exp.skillDps) <= 1);
check('技能期总伤数值一致', Math.abs(grab('技能期总伤') - exp.skillTotalDamage) <= 1);
check('伤害标签为法术色 class(dmg-arts)', /技能期 DPS<\/span><span class="value dmg-arts"/.test(html) && /常态 DPS<\/span><span class="value dmg-arts"/.test(html));

// 模组「赠予红龙的花冠」L1：trait scale 0.5→0.6 → 常态 HPS 放大，常态 DPS 不变
const slotM = { ...slot, module: { moduleId: 'uniequip_002_reed2', moduleLevel: 1 } };
const expM = calculateOperator(op, slotM);
const m = await renderSlot(slotM);
check('带模组 常态HPS>无模组（scale 0.6）', m.grab('常态 HPS') > exp.normalHps);
check('带模组 常态DPS不受scale影响', Math.abs(m.grab('常态 DPS') - expM.normalDps) <= 1);
check('带模组 技能期HPS=scale0.6口径', Math.abs(m.grab('技能期 HPS') - expM.skillHps) <= 1);

console.log(`\n咒愈师 UI 验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
