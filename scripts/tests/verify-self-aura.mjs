// 闪灵/夜莺范围光环自加成的验证断言（追加进 e2e-modules.mjs 风格的独立验证）
import { calcPanelStats } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';
const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/';
const mk = (op, module) => ({ elite: 2, level: op.phases[2].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 9, module });
let pass = 0, fail = 0;
const check = (n, ok) => { if (ok) pass++; else { fail++; console.log('FAIL: ' + n); } };
const sh = JSON.parse(fs.readFileSync(B + 'MEDIC/physician/char_147_shining.json', 'utf8'));
const nk = JSON.parse(fs.readFileSync(B + 'MEDIC/ringhealer/char_179_cgbird.json', 'utf8'));

// 闪灵：黑恶魔庇护（自身必在范围）E2 def +60
const s0 = calcPanelStats(sh, mk(sh, null));
check('闪灵 E2 无模 DEF=218（138+20信赖+60光环）', s0.panelDef === 218);
// Y 模 L2/L3 覆盖黑恶魔 def 80/100
const sY2 = calcPanelStats(sh, mk(sh, { moduleId: 'uniequip_002_shining', moduleLevel: 2 }));
check('闪灵 Y模L2 DEF=238（模组强化覆盖+80）', sY2.panelDef === 238);
const sY3 = calcPanelStats(sh, mk(sh, { moduleId: 'uniequip_002_shining', moduleLevel: 3 }));
check('闪灵 Y模L3 DEF=258（+100）', sY3.panelDef === 258);
// X 模（使徒/法典攻速）只走模组白值 def+17，黑恶魔不受强化 → 218+17=235
const sX2 = calcPanelStats(sh, mk(sh, { moduleId: 'uniequip_003_shining', moduleLevel: 2 }));
check('闪灵 X模L2 DEF=235（白值+17，光环仍60）', sX2.panelDef === 235);
// 潜能5 时黑恶魔 65 + 潜4 防御白值+25
const sPot5 = calcPanelStats(sh, Object.assign(mk(sh, null), { potentialRank: 5 }));
check('闪灵 E2 潜5 无模 DEF=248（138+20信+25潜def+65光环）', sPot5.panelDef === 248);
const sY2p5 = calcPanelStats(sh, Object.assign(mk(sh, { moduleId: 'uniequip_002_shining', moduleLevel: 2 }), { potentialRank: 5 }));
check('闪灵 Y模L2 潜5 DEF=268（+25潜def+85光环）', sY2p5.panelDef === 268);

// 夜莺：白恶魔庇护 E2 法抗 +15（基础 5）
const n0 = calcPanelStats(nk, mk(nk, null));
check('夜莺 E2 无模 法抗=20（5基础+15光环）', n0.magicResistance === 20);
// 002 模（白恶魔强化）：白值法抗+5 + 天赋15（L2/L3 天赋值同基准，heal_scale 走治疗）
const nX2 = calcPanelStats(nk, mk(nk, { moduleId: 'uniequip_002_cgbird', moduleLevel: 2 }));
check('夜莺 002模L2 法抗=25（5+5白值+15）', nX2.magicResistance === 25);
const nX3 = calcPanelStats(nk, mk(nk, { moduleId: 'uniequip_002_cgbird', moduleLevel: 3 }));
check('夜莺 002模L3 法抗=25', nX3.magicResistance === 25);
// 003 模（幻影）不动白恶魔 → 20
const nY2 = calcPanelStats(nk, mk(nk, { moduleId: 'uniequip_003_cgbird', moduleLevel: 2 }));
check('夜莺 003模L2 法抗=20（幻影模组不强化白恶魔）', nY2.magicResistance === 20);
// 精一档：+10
const nE1 = calcPanelStats(nk, Object.assign(mk(nk, null), { elite: 1, level: nk.phases[1].maxLevel }));
check('夜莺 E1 法抗=15（5基础+10光环）', nE1.magicResistance === 15);

console.log(pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
