// 模组系统验证：面板加成 + 天赋攻速（法典） + 模组天赋强化（闪灵X/Y）+ 装备技能乘算
import { calcPanelStats, calculateOperator, calcTalentAttackSpeed } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
globalThis.fetch = async (url) => {
  const p = BASE + '/' + url.replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};
function makeEl(tag) {
  const el = { tagName: (tag || 'div').toUpperCase(), innerHTML: '', className: '', dataset: {}, style: {}, value: '',
    classList: { add() {}, remove() {}, contains: () => false }, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], focus() {} };
  el.appendChild = (child) => { el.innerHTML += (child.innerHTML || ''); };
  return el;
}
const els = {};
globalThis.document = {
  getElementById: (id) => (els[id] || (els[id] = makeEl(id))),
  createElement: (tag) => makeEl(tag), addEventListener() {}, body: makeEl('body'),
};

let ok = true;
const check = (label, cond) => { if (!cond) ok = false; console.log(label + ': ' + (cond ? 'OK' : 'FAIL')); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

const shining = JSON.parse(fs.readFileSync(BASE + '/MEDIC/physician/char_147_shining.json', 'utf8'));
const modY = shining.modules.find(m => m.typeName2 === 'Y');
const modX = shining.modules.find(m => m.typeName2 === 'X');
const modInit = shining.modules.find(m => m.type === 'INITIAL');
check('闪灵模组结构(证章+X+Y, 各3级)', shining.modules.length === 3 && modInit && modX && modY && modX.levels.length === 3);

// ===== 常驻天赋攻速（法典）=====
check('法典 elite1 不生效', calcTalentAttackSpeed(shining, { elite: 1, level: 70, potentialRank: 0 }) === 0);
check('法典 elite2 pot0 = +10', calcTalentAttackSpeed(shining, { elite: 2, level: 90, potentialRank: 0 }) === 10);
check('法典 elite2 pot3 = +13', calcTalentAttackSpeed(shining, { elite: 2, level: 90, potentialRank: 3 }) === 13);

// ===== 基础面板：无模组（含法典攻速） =====
const base0 = { elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 9, module: null };
const ps0 = calcPanelStats(shining, base0);
console.log(`\n闪灵 E2 Lv90 无模组: ATK=${ps0.panelAtk} DEF=${ps0.panelDef} 间隔=${ps0.attackInterval.toFixed(4)}s (基础2.85s → 期望 ${(2.85 * 100 / 110).toFixed(4)})`);
check('无模组间隔含法典攻速+10', near(ps0.attackInterval, 2.85 * 100 / 110));

// ===== X 模组（强化法典：攻速15/18 + 装备技能2时攻击乘算）=====
const xL1 = calcPanelStats(shining, { ...base0, module: { moduleId: modX.id, moduleLevel: 1 } });
check('X模组L1 白值 atk+45', xL1.panelAtk === ps0.panelAtk + 45);
check('X模组L1 无天赋强化(仍攻速10)', near(xL1.attackInterval, 2.85 * 100 / 110));

const xL3 = calcPanelStats(shining, { ...base0, module: { moduleId: modX.id, moduleLevel: 3 } });
check('X模组L3 白值 atk+63', xL3.panelAtk === ps0.panelAtk + 63);
check('X模组L3 法典覆盖攻速15', near(xL3.attackInterval, 2.85 * 100 / 115));
const xL3p3 = calcPanelStats(shining, { ...base0, potentialRank: 3, module: { moduleId: modX.id, moduleLevel: 3 } });
check('X模组L3 潜能3 法典攻速18', near(xL3p3.attackInterval, 2.85 * 100 / 118));

// X L2/L3 + 装备技能2（自动掩护）：面板攻击直接乘算
const r0 = calculateOperator(shining, { ...base0, skillIndex: 1, module: null });
const rx2 = calculateOperator(shining, { ...base0, skillIndex: 1, module: { moduleId: modX.id, moduleLevel: 2 } });
const rx3 = calculateOperator(shining, { ...base0, skillIndex: 1, module: { moduleId: modX.id, moduleLevel: 3 } });
console.log(`\n装备技能2: 无模组面板ATK=${r0.panelAtk.toFixed(1)} X L2=${rx2.panelAtk.toFixed(1)}(×1.15) X L3=${rx3.panelAtk.toFixed(1)}(×1.25)`);
check('X模组L2+技能2 攻击×1.15', near(rx2.panelAtk, (r0.panelAtk + 55) * 1.15));
check('X模组L3+技能2 攻击×1.25', near(rx3.panelAtk, (r0.panelAtk + 63) * 1.25));
const rx1 = calculateOperator(shining, { ...base0, skillIndex: 1, module: { moduleId: modX.id, moduleLevel: 1 } });
check('X模组L1+技能2 无攻击乘算(仅白值+45)', near(rx1.panelAtk, r0.panelAtk + 45));

// ===== Y 模组（强化天赋1黑恶魔=友方防御光环，不影响自身面板/计算；白值 atk+aspd）=====
const yL1 = calcPanelStats(shining, { ...base0, module: { moduleId: modY.id, moduleLevel: 1 } });
check('Y模组L1 白值 atk+35', yL1.panelAtk === ps0.panelAtk + 35);
check('Y模组L1 攻速=天赋10+白值5=15', near(yL1.attackInterval, 2.85 * 100 / 115));
const yL2 = calcPanelStats(shining, { ...base0, module: { moduleId: modY.id, moduleLevel: 2 } });
check('Y模组L2 攻速=10+6=16', near(yL2.attackInterval, 2.85 * 100 / 116));
const y3 = calcPanelStats(shining, { ...base0, module: { moduleId: modY.id, moduleLevel: 3 } });
check('Y模组L3 攻速=10+7=17', near(y3.attackInterval, 2.85 * 100 / 117));

// ===== 证章：无任何变化 =====
const psInit = calcPanelStats(shining, { ...base0, module: { moduleId: modInit.id, moduleLevel: 0 } });
check('证章无面板变化', psInit.panelAtk === ps0.panelAtk && near(psInit.attackInterval, ps0.attackInterval));

// ===== 其他干员边界 =====
const susuro = JSON.parse(fs.readFileSync(BASE + '/MEDIC/physician/char_298_susuro.json', 'utf8'));
const modS = susuro.modules.find(m => m.type === 'ADVANCED');
const sBase = { elite: 2, level: 50, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7, module: null };
const ss0 = calcPanelStats(susuro, sBase);
const ss1 = calcPanelStats(susuro, { ...sBase, module: { moduleId: modS.id, moduleLevel: 1 } });
check('苏苏洛X模组L1 HP+50', ss1.panelHp === ss0.panelHp + 50);
const susuroSpd = calcTalentAttackSpeed(susuro, sBase);
check('苏苏洛无常驻攻速天赋(驱动表未污染)', susuroSpd === 0);
const hibisc = JSON.parse(fs.readFileSync(BASE + '/MEDIC/physician/char_120_hibisc.json', 'utf8'));
check('三星芙蓉无模组数据', !hibisc.modules || hibisc.modules.length === 0);
const h0 = calcPanelStats(hibisc, { elite: 2, level: 60, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7, module: { moduleId: 'ghost', moduleLevel: 1 } });
const h1 = calcPanelStats(hibisc, { elite: 2, level: 60, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7, module: null });
check('无效模组引用不影响面板(芙蓉)', h0.panelAtk === h1.panelAtk && h0.panelHp === h1.panelHp);

console.log(ok ? '\n✅ 全部通过' : '\n❌ 存在失败');
process.exit(ok ? 0 : 1);
