// 剑豪(sword/近卫)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 口径:柏喙「摄魂」增幅不生效;刻刀技力不生效;战车「倾泻弹药」打预设目标(单目标);
//       艾丽妮「审判之火」无视防御仅浮空生效(默认不计)、「净化之剑」仅基础版(攻速+18);
//       锏「天生的武者」攻击力提升/「活着的传奇」无视防御仅在 2/3 技能生效;虎狼丸天赋按落地被动处理
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.2) => Math.abs(a - b) <= tol;
const D = '../../src/frontend/data/WARRIOR/sword/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (id, si) => {
  const op = JSON.parse(fs.readFileSync(new URL(D + id + '.json', import.meta.url), 'utf8'));
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 });
};
let r = run('char_010_chen', -1); ok(near(r.normalDps, 71.5), '陈 常态 71.5 实=' + r.normalDps);
r = run('char_010_chen', 0); ok(near(r.skillTotalDamage, 1340.4), '陈 S1 鞘击 1340.4 实=' + r.skillTotalDamage);
r = run('char_010_chen', 1); ok(near(r.skillTotalDamage, 2449.2), '陈 S2 拔刀 2449.2 实=' + r.skillTotalDamage);
r = run('char_010_chen', 2); ok(near(r.skillTotalDamage, 13404.0), '陈 S3 绝影(10 连斩)13404.0 实=' + r.skillTotalDamage);
r = run('char_252_bibeak', -1); ok(near(r.normalDps, 63.1), '柏喙 常态(摄魂不生效)63.1 实=' + r.normalDps);
r = run('char_252_bibeak', 1); ok(near(r.skillTotalDamage, 627.6), '柏喙 异刃斩 627.6 实=' + r.skillTotalDamage);
r = run('char_301_cutter', -1); ok(near(r.normalDps, 31.5), '刻刀 常态 31.5 实=' + r.normalDps);
r = run('char_301_cutter', 0); ok(near(r.skillTotalDamage, 5292.0), '刻刀 红移(4 飞刀)5292.0 实=' + r.skillTotalDamage);
r = run('char_301_cutter', 1); ok(near(r.skillTotalDamage, 1964.0), '刻刀 绯红刺刀 1964.0 实=' + r.skillTotalDamage);
r = run('char_4009_irene', -1); ok(near(r.normalDps, 91.7) && near(r.realInterval, 1.1017), '艾丽妮 常态(净化之剑+18)91.7 实=' + r.normalDps + '/' + r.realInterval);
r = run('char_4009_irene', 1); ok(near(r.skillTotalDamage, 1923.6), '艾丽妮 裂潮 1923.6 实=' + r.skillTotalDamage);
r = run('char_4009_irene', 2); ok(near(r.skillTotalDamage, 13650.6), '艾丽妮 判决(300%+12×230%)13650.6 实=' + r.skillTotalDamage);
r = run('char_4116_blkkgt', -1); ok(near(r.normalDps, 65.4), '锏 常态(天赋不生效)65.4 实=' + r.normalDps);
r = run('char_4116_blkkgt', 0); ok(near(r.skillTotalDamage, 1540.0), '锏 纯粹的战意(两次 200%,天赋不生效)1540.0 实=' + r.skillTotalDamage);
r = run('char_4116_blkkgt', 1); ok(near(r.skillTotalDamage, 5456.8), '锏 无声的嘲弄(2 斩击×1.6,无视 25% 防御)5456.8 实=' + r.skillTotalDamage);
r = run('char_4116_blkkgt', 2); ok(near(r.skillTotalDamage, 21463.6), '锏 归于宁静(10 斩+终结)21463.6 实=' + r.skillTotalDamage);
r = run('char_4220_kormr', -1); ok(near(r.normalDps, 122.1, 0.3), '虎狼丸 天赋落地斩击 122.1 实=' + r.normalDps);
r = run('char_459_tachak', -1); ok(near(r.normalDps, 46.9), '战车 常态 46.9 实=' + r.normalDps);
r = run('char_459_tachak', 0); ok(near(r.skillTotalDamage, 991.5), '战车 燃烧榴弹(6 秒 50% 法术)991.5 实=' + r.skillTotalDamage);
r = run('char_459_tachak', 1); ok(near(r.realInterval, 0.45) && near(r.skillTotalDamage, 4718.4), '战车 倾泻弹药 0.45s/4718.4 实=' + r.realInterval + '/' + r.skillTotalDamage);
console.log('剑豪: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
