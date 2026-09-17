// 斗士(fighter/近卫)验证:精二满/满信赖/潜0/专一档(levels[7])/敌 def600 res50
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.2) => Math.abs(a - b) <= tol;
const D = '../../src/frontend/data/WARRIOR/fighter/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (id, si, module) => {
  const op = JSON.parse(fs.readFileSync(new URL(D + id + '.json', import.meta.url), 'utf8'));
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module: module || null });
};
// 猎蜂「竞技专注」攻击力增幅默认叠满(5 层 = +25%)
let r = run('char_137_brownb', -1);
ok(near(r.normalDps, 149.0), '猎蜂 常态(+25%)149.0 实=' + r.normalDps);
r = run('char_137_brownb', 1);
ok(near(r.realInterval, 0.18) && near(r.skillTotalDamage, 6393.8), '猎蜂 S2 急速拳 0.18s/6393.8 实=' + r.realInterval + '/' + r.skillTotalDamage);
// 因陀罗:虎拳迅击攻击力增幅默认不生效
r = run('char_155_tiger', -1);
ok(near(r.normalDps, 38.8), '因陀罗 常态 38.8 实=' + r.normalDps);
r = run('char_155_tiger', 0);
ok(near(r.skillTotalDamage, 1031.0), '因陀罗 S1 碎甲拳 1031.0 实=' + r.skillTotalDamage);
r = run('char_155_tiger', 1);
ok(near(r.skillTotalDamage, 17584.0), '因陀罗 S2 裂魂 17584.0 实=' + r.skillTotalDamage);
// 达格达:帮派精神默认不生效;反制技巧默认受击一次结算
r = run('char_157_dagda', -1);
ok(near(r.normalDps, 39.4), '达格达 常态 39.4 实=' + r.normalDps);
r = run('char_157_dagda', 0);
ok(near(r.skillTotalDamage, 624.9), '达格达 S1 反制技巧(190%×1.05)624.9 实=' + r.skillTotalDamage);
r = run('char_157_dagda', 1);
ok(near(r.skillTotalDamage, 7531.6), '达格达 S2 精准捕杀(二连击)7531.6 实=' + r.skillTotalDamage);
// 重岳:止戈默认不生效;我无按开满 5 次(常态二连击 + 技能额外一次)
r = run('char_2024_chyue', -1);
ok(near(r.normalDps, 128.2), '重岳 常态(二连击)128.2 实=' + r.normalDps);
r = run('char_2024_chyue', 2);
ok(near(r.skillTotalDamage, 4440.0), '重岳 S3 我无(3×320%)4440.0 实=' + r.skillTotalDamage);
// 山:巨力重拳默认不生效;震地碎岩击 间隔加算 + 2 连击
r = run('char_264_f12yin', -1);
ok(near(r.normalDps, 41.0), '山 常态 41.0 实=' + r.normalDps);
r = run('char_264_f12yin', 2);
ok(near(r.realInterval, 1.48) && near(r.skillTotalDamage, 19353.6), '山 S3 震地碎岩击 1.48s/19353.6 实=' + r.realInterval + '/' + r.skillTotalDamage);
// 杰克:极速闪避默认不生效;全神贯注输出 0
r = run('char_347_jaksel', -1);
ok(near(r.normalDps, 37.8), '杰克 常态 37.8 实=' + r.normalDps);
r = run('char_347_jaksel', 1);
ok(r.skillTotalDamage === 0 && r.skillDps === 0, '杰克 S2 全神贯注输出 0 实=' + r.skillTotalDamage + '/' + r.skillDps);
// 贝洛内:家族手段减防默认叠满(本体 5 层 -35%,2 技能 8 层 -56%)
r = run('char_4037_demetr', -1);
ok(near(r.normalDps, 352.6), '贝洛内 常态(目标防-35%)352.6 实=' + r.normalDps);
r = run('char_4037_demetr', 0);
ok(near(r.skillTotalDamage, 1726.0), '贝洛内 S1 家主的余裕(两次 220%)1726.0 实=' + r.skillTotalDamage);
r = run('char_4037_demetr', 1);
ok(near(r.realInterval, 0.4588) && near(r.skillTotalDamage, 38253.0), '贝洛内 S2 军师的手段 0.4588s/38253.0 实=' + r.realInterval + '/' + r.skillTotalDamage);
r = run('char_4037_demetr', 2);
ok(near(r.realInterval, 0.5571) && near(r.skillTotalDamage, 67442.5), '贝洛内 S3 清算 0.5571s/67442.5 实=' + r.realInterval + '/' + r.skillTotalDamage);
// 燧石:身轻无痕伤害提升仅 2 技能生效
r = run('char_415_flint', -1);
ok(near(r.normalDps, 39.7), '燧石 常态(不带身轻无痕)39.7 实=' + r.normalDps);
r = run('char_415_flint', 0);
ok(near(r.skillTotalDamage, 640.0), '燧石 S1 不息(不带身轻无痕)640.0 实=' + r.skillTotalDamage);
r = run('char_415_flint', 1);
ok(near(r.skillTotalDamage, 15488.2), '燧石 S2 锋芒毕露(×1.4)15488.2 实=' + r.skillTotalDamage);
console.log('斗士: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
