// 模组系统验证：模组面板加成进入基础属性与计算结果；证章/无模组不影响；攻速模组改变攻击间隔
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
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

const shining = JSON.parse(fs.readFileSync(BASE + '/MEDIC/physician/char_147_shining.json', 'utf8'));
// 闪灵模组：001 证章(INITIAL) / 002 Y(解锁60, L1 atk35 aspd5) / 003 X(解锁60, L1 atk45 def13)
const modY = shining.modules.find(m => m.typeName2 === 'Y');
const modX = shining.modules.find(m => m.typeName2 === 'X');
const modInit = shining.modules.find(m => m.type === 'INITIAL');
check('闪灵有3模组(证章+X+Y)', shining.modules.length === 3 && modInit && modX && modY);
check('X模组代号与等级数据(L3)', modX.levels.length === 3 && modX.unlockLevel === 60);

const base = { elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9, module: null };
const ps0 = calcPanelStats(shining, base);
console.log(`\n闪灵 E2 Lv90 无模组: HP=${ps0.panelHp} ATK=${ps0.panelAtk} DEF=${ps0.panelDef} 间隔=${ps0.attackInterval.toFixed(3)}s`);

// 证章：无任何变化
const psInit = calcPanelStats(shining, { ...base, module: { moduleId: modInit.id, moduleLevel: 0 } });
check('证章无面板变化', psInit.panelAtk === ps0.panelAtk && psInit.attackInterval === ps0.attackInterval && psInit.panelDef === ps0.panelDef);

// X 模组各级：L1 atk+45 def+13；L2 atk+55 def+17；L3 atk+63 def+20
for (const [lv, expAtk, expDef] of [[1, 45, 13], [2, 55, 17], [3, 63, 20]]) {
  const ps = calcPanelStats(shining, { ...base, module: { moduleId: modX.id, moduleLevel: lv } });
  check(`X模组${lv}级 ATK+${expAtk}`, ps.panelAtk === ps0.panelAtk + expAtk);
  check(`X模组${lv}级 DEF+${expDef}`, ps.panelDef === ps0.panelDef + expDef);
}

// Y 模组（攻速型）：间隔 = base × 100/(100+aspd)；L1 aspd5
const psY = calcPanelStats(shining, { ...base, module: { moduleId: modY.id, moduleLevel: 1 } });
const expInterval = ps0.attackInterval * 100 / 105;
check(`Y模组L1 ATK+35`, psY.panelAtk === ps0.panelAtk + 35);
check(`Y模组L1 攻击间隔缩短(${expInterval.toFixed(3)})`, Math.abs(psY.attackInterval - expInterval) < 0.001);

// 计算结果随之变化（技能期ATK=技能前按模组面板）
const r0 = calculateOperator(shining, base);
const rx = calculateOperator(shining, { ...base, module: { moduleId: modX.id, moduleLevel: 3 } });
console.log(`\n技能1技能期ATK: 无模组=${r0.panelAtk} X模组3级=${rx.panelAtk}（差63）`);
check('计算结果面板ATK含模组加成', Math.round(rx.panelAtk - r0.panelAtk) === 63);
const ry = calculateOperator(shining, { ...base, module: { moduleId: modY.id, moduleLevel: 1 } });
check('攻速模组改变技能期攻击间隔', ry.realInterval !== r0.realInterval && ry.realInterval < r0.realInterval);

// 苏苏洛（四星 X 模组解锁40）：elite2 level50 可选；module L1 max_hp+50
const susuro = JSON.parse(fs.readFileSync(BASE + '/MEDIC/physician/char_298_susuro.json', 'utf8'));
const modS = susuro.modules.find(m => m.type === 'ADVANCED');
check('苏苏洛解锁等级40', modS.unlockLevel === 40);
const sBase = { elite: 2, level: 50, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7, module: null };
const ss0 = calcPanelStats(susuro, sBase);
const ss1 = calcPanelStats(susuro, { ...sBase, module: { moduleId: modS.id, moduleLevel: 1 } });
check('苏苏洛X模组L1 HP+50', ss1.panelHp === ss0.panelHp + 50);

// 三星干员（芙蓉）无 modules
const hibisc = JSON.parse(fs.readFileSync(BASE + '/MEDIC/physician/char_120_hibisc.json', 'utf8'));
check('三星芙蓉无模组数据', !hibisc.modules || hibisc.modules.length === 0);
const h0 = calcPanelStats(hibisc, { elite: 2, level: 60, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7, module: { moduleId: 'ghost', moduleLevel: 1 } });
const h1 = calcPanelStats(hibisc, { elite: 2, level: 60, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7, module: null });
check('无效模组引用不影响面板(芙蓉)', h0.panelAtk === h1.panelAtk && h0.panelHp === h1.panelHp);

console.log(ok ? '\n✅ 全部通过' : '\n❌ 存在失败');
process.exit(ok ? 0 : 1);
