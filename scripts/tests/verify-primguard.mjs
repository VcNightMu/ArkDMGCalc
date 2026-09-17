// 本源近卫(primguard)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 口径(用户 2026-09-17):「与本源术师类似的处理」
//   - 聆音「趁势怜悯」仅计算基础加成(+10%,击倒神经损伤爆发敌人后的升级档不计);
//   - 元素=神经损伤(爆条 6000/次、cd 10s、EP 1000);损伤基数 = 该次实际造成的物理伤害×10%;
//   - S2「破膛弥撒」三段按元素伤害结算(问答确认:视为目标处于爆发期间);可充能 2 次按单次。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const op = JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/WARRIOR/primguard/char_4187_graceb.json', import.meta.url), 'utf8'));
const e = op.phases.length - 1;
const run = (si) => calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 });

let r = run(-1);
ok(near(r.panelAtk, 990) && near(r.normalDps, 325), '聆音 常态 (820+80)×1.10=990 / 325 实=' + r.panelAtk + '/' + r.normalDps);
r = run(0);
ok(near(r.panelAtk, 990) && near(r.skillTotalDamage, 48825) && near(r.skillDps, 1627.5),
  '聆音 S1 开颅挽歌(二连击 135%,50 击 + 神经爆条)48825/1627.5 实=' + r.skillTotalDamage + '/' + r.skillDps);
ok(r.dmgTypes && r.dmgTypes.physical && near(r.dmgTypes.physical.skillTotalDamage, 36825) && r.dmgTypes.element && near(r.dmgTypes.element.skillTotalDamage, 12000),
  '聆音 S1 分档 物理 36825 + 元素 12000 实=' + JSON.stringify(r.dmgTypes));
ok(near(r.normalDps, 325), '聆音 S1 槽内常态=普攻 325 实=' + r.normalDps);
r = run(1);
ok(near(r.panelAtk, 2277) && near(r.skillTotalDamage, 6831) && near(r.skillDps, 0) && near(r.cycleDps, 723),
  '聆音 S2 破膛弥撒(三段 230% 元素)6831/循环 723 实=' + r.skillTotalDamage + '/' + r.cycleDps);
ok(r.dmgTypes && r.dmgTypes.element && near(r.dmgTypes.element.skillTotalDamage, 6831), '聆音 S2 元素档 6831 实=' + JSON.stringify(r.dmgTypes));
console.log('本源近卫: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
