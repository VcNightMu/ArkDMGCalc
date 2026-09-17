// 强攻手(centurion/近卫)验证:精二满/满信赖/潜0/专一档(levels[7])/敌 def600 res50
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.2) => Math.abs(a - b) <= tol;
const D = '../../src/frontend/data/WARRIOR/centurion/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (id, si, module) => {
  const op = JSON.parse(fs.readFileSync(new URL(D + id + '.json', import.meta.url), 'utf8'));
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module: module || null });
};
// 煌:常态 nDps 187.5;S1 强力击γ 1421.3;S2 链锯延伸模块(永续 atk+80%)737.5;S3 沸腾爆裂 = 灼烧 + 360% 爆炸
let r = run('char_017_huang', -1);
ok(near(r.normalDps, 187.5), '煌 常态 187.5 实=' + r.normalDps);
r = run('char_017_huang', 0);
ok(near(r.skillTotalDamage, 1421.3), '煌 S1 强力击γ 1421.3 实=' + r.skillTotalDamage);
r = run('char_017_huang', 1);
ok(near(r.skillDps, 737.5), '煌 S2 链锯延伸模块 737.5 实=' + r.skillDps);
r = run('char_017_huang', 2);
ok(near(r.skillTotalDamage, 10390.5), '煌 S3 沸腾爆裂(灼烧+360%爆炸)10390.5 实=' + r.skillTotalDamage);
// 煌 X 模组 L3:严酷训练 攻击力+6%/攻速+12 → 常态间隔 1.2/1.12
r = run('char_017_huang', -1, { moduleId: 'uniequip_002_huang', moduleLevel: 3 });
ok(near(r.realInterval, 1.0714), '煌 X模L3 严酷训练攻速+12 → 常态间隔 1.0714 实=' + r.realInterval);
// 百炼嘉维尔:战地巨斧 atk +10%(不阻挡档)
r = run('char_1026_gvial2', -1);
ok(near(r.normalDps, 248.0), '百炼嘉维尔 常态(+10%)248.0 实=' + r.normalDps);
r = run('char_1026_gvial2', 0);
ok(near(r.skillTotalDamage, 16560.0), '百炼嘉维尔 S1 精准痛击 16560.0 实=' + r.skillTotalDamage);
r = run('char_1026_gvial2', 1);
ok(near(r.skillTotalDamage, 45648.0), '百炼嘉维尔 S2 链锯强袭 45648.0 实=' + r.skillTotalDamage);
r = run('char_1026_gvial2', 2);
ok(near(r.skillTotalDamage, 44222.4), '百炼嘉维尔 S3 丛林之魂 44222.4 实=' + r.skillTotalDamage);
// 艾丝黛尔
r = run('char_127_estell', -1);
ok(near(r.normalDps, 75.0), '艾丝黛尔 常态 75.0 实=' + r.normalDps);
r = run('char_127_estell', 0);
ok(near(r.skillTotalDamage, 10080.0), '艾丝黛尔 S1 攻击力强化β 10080.0 实=' + r.skillTotalDamage);
r = run('char_127_estell', 1);
ok(near(r.skillTotalDamage, 11430.0), '艾丝黛尔 S2 舍身突击 11430.0 实=' + r.skillTotalDamage);
// 幽灵鲨(天赋不影响伤害;X 模组 damage_scale 暂未并入)
r = run('char_143_ghost', -1);
ok(near(r.normalDps, 170.8), '幽灵鲨 常态 170.8 实=' + r.normalDps);
r = run('char_143_ghost', 1);
ok(near(r.skillTotalDamage, 11710.0), '幽灵鲨 S2 肉斩骨断 11710.0 实=' + r.skillTotalDamage);
// 暴行(山谷攻击力增幅默认不生效)
r = run('char_230_savage', 0);
ok(near(r.skillTotalDamage, 880.5) && near(r.cycleDps, 216.8), '暴行 S1 强力击β 880.5 实=' + r.skillTotalDamage);
r = run('char_230_savage', 1);
ok(near(r.skillTotalDamage, 2008.5), '暴行 S2 微差爆破 2008.5 实=' + r.skillTotalDamage);
// 泡普卡(天赋攻击力 +6% 计入)
r = run('char_281_popka', -1);
ok(near(r.normalDps, 24.1), '泡普卡 常态(+6%)24.1 实=' + r.normalDps);
r = run('char_281_popka', 0);
ok(near(r.skillTotalDamage, 4003.2), '泡普卡 S1 攻击力强化α 4003.2 实=' + r.skillTotalDamage);
// 布洛卡(钻头强化 atk 默认不生效;S2 间隔 +0.65 加算)
r = run('char_356_broca', -1);
ok(near(r.normalDps, 201.7), '布洛卡 常态 201.7 实=' + r.normalDps);
r = run('char_356_broca', 0);
ok(near(r.skillTotalDamage, 17185.6), '布洛卡 S1 通电 17185.6 实=' + r.skillTotalDamage);
r = run('char_356_broca', 1);
ok(near(r.realInterval, 1.85) && near(r.skillTotalDamage, 20659.6), '布洛卡 S2 高压电流 1.85s/20659.6 实=' + r.realInterval + '/' + r.skillTotalDamage);
// 导火索
r = run('char_4126_fuze', -1);
ok(near(r.normalDps, 195.8), '导火索 常态 195.8 实=' + r.normalDps);
r = run('char_4126_fuze', 0);
ok(near(r.skillTotalDamage, 418.7), '导火索 S1 火力侦察 418.7 实=' + r.skillTotalDamage);
r = run('char_4126_fuze', 1);
ok(near(r.skillTotalDamage, 3157.5), '导火索 S2 霰射炸药 3157.5 实=' + r.skillTotalDamage);
// 摆渡人(永志不忘 atk 默认不生效;S2 攻击力提升至 185%)
r = run('char_4166_varkis', -1);
ok(near(r.normalDps, 175.0), '摆渡人 常态 175.0 实=' + r.normalDps);
r = run('char_4166_varkis', 0);
ok(near(r.skillTotalDamage, 412.5), '摆渡人 S1 奔流 412.5 实=' + r.skillTotalDamage);
r = run('char_4166_varkis', 1);
ok(near(r.skillTotalDamage, 22462.5), '摆渡人 S2 同胞的意志(185%)22462.5 实=' + r.skillTotalDamage);
// 幽灵鲨 X 模组「溶于血的经验」:L2 ×1.03、L3 ×1.05(本体缺键按 1 倍)
for (const [lv, mul] of [[2, 1.03], [3, 1.05]]) {
  const g = run('char_143_ghost', -1, { moduleId: 'uniequip_002_ghost', moduleLevel: lv });
  ok(near(g.normalDps, ((g.panelAtk - 600) / 1.2) * mul), '幽灵鲨 X模L' + lv + ' 常态 ×' + mul + ' 实=' + g.normalDps);
}
console.log('强攻手: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
