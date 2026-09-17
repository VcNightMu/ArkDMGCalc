// 教官(instructor/近卫)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 口径:所有教官攻击默认为近战攻击(全额攻击力,不按远程 80%);帕拉斯两条精力充沛默认不触发
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.2) => Math.abs(a - b) <= tol;
const D = '../../src/frontend/data/WARRIOR/instructor/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (id, si) => {
  const op = JSON.parse(fs.readFileSync(new URL(D + id + '.json', import.meta.url), 'utf8'));
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 });
};
let r = run('char_130_doberm', -1);
ok(near(r.normalDps, 30.5), '杜宾 常态 30.5 实=' + r.normalDps);
r = run('char_130_doberm', 0); ok(near(r.skillTotalDamage, 727.2), '杜宾 强力击β 727.2 实=' + r.skillTotalDamage);
r = run('char_130_doberm', 1); ok(near(r.skillTotalDamage, 9457.6), '杜宾 鞭策 9457.6 实=' + r.skillTotalDamage);
r = run('char_265_sophia', -1); ok(near(r.normalDps, 71.4), '鞭刃 常态 71.4 实=' + r.normalDps);
r = run('char_265_sophia', 1); ok(near(r.skillTotalDamage, 7245.0), '鞭刃 鞭刃 7245.0 实=' + r.skillTotalDamage);
r = run('char_308_swire', -1); ok(near(r.normalDps, 91.4), '诗怀雅 常态 91.4 实=' + r.normalDps);
r = run('char_308_swire', 1); ok(near(r.skillTotalDamage, 10785.6), '诗怀雅 协同作战 10785.6 实=' + r.skillTotalDamage);
r = run('char_4106_bryota', -1); ok(near(r.normalDps, 81.0), '苍苔 常态 81.0 实=' + r.normalDps);
r = run('char_4106_bryota', 1); ok(near(r.skillTotalDamage, 14847.0), '苍苔 土石的恒心 14847.0 实=' + r.skillTotalDamage);
r = run('char_4125_rdoc', -1); ok(near(r.normalDps, 54.3), '医生 常态 54.3 实=' + r.normalDps);
r = run('char_485_pallas', -1); ok(near(r.normalDps, 130.5), '帕拉斯 常态(精力充沛不触发)130.5 实=' + r.normalDps);
r = run('char_485_pallas', 0); ok(near(r.skillTotalDamage, 542.4), '帕拉斯 胜利的连击 542.4 实=' + r.skillTotalDamage);
r = run('char_485_pallas', 1); ok(near(r.skillTotalDamage, 11584.0), '帕拉斯 信念的长鞭 11584.0 实=' + r.skillTotalDamage);
r = run('char_485_pallas', 2); ok(near(r.skillTotalDamage, 20344.8), '帕拉斯 英勇的祝福(精力充沛不触发)20344.8 实=' + r.skillTotalDamage);
console.log('教官: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
