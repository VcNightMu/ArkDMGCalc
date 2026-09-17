// 领主(lord/近卫)验证:精二满/满信赖/潜0/专一档(levels[7])/敌 def600 res50
// 口径(用户 2026-09-17):领主攻击默认按远程 80% 攻击力;下列技能"远程攻击不再降低攻击力"按 100%:
// 霜叶S1、断崖S1、拉普兰德S2、断崖S2、银灰S1、银灰S3、棘刺S3、芳汀S2、罗小黑S1、罗小黑S2、
// 仇白S1、仇白S2(仅起手与结束伤害)、仇白S3、烈夏S2
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.2) => Math.abs(a - b) <= tol;
const load = (id) => JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/WARRIOR/lord/' + id + '.json', import.meta.url), 'utf8'));
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (op, si, module) => {
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module: module || null });
};
const R = (id) => { const op = load(id); return (si, m) => run(op, si, m); };

// 所有领主:常态按 80% 攻击力
let r = R('char_283_midn')(-1); ok(near(r.normalDps, 16.8), '月见夜 常态(80%)16.8 实=' + r.normalDps);
r = R('char_283_midn')(0); ok(near(r.skillTotalDamage, 886.1), '月见夜 S1 武器附魔α(80%)886.1 实=' + r.skillTotalDamage);
// 霜叶:天赋「掩护打击」间隔 +0.15(常态与技能期);S1 不降攻击力
r = R('char_193_frostl')(-1); ok(near(r.realInterval, 1.45) && near(r.normalDps, 18.2), '霜叶 常态 1.45s/18.2 实=' + r.realInterval + '/' + r.normalDps);
r = R('char_193_frostl')(0); ok(near(r.skillTotalDamage, 324.0), '霜叶 S1 寒霜枪刃(全额)324 实=' + r.skillTotalDamage);
r = R('char_193_frostl')(1); ok(near(r.skillTotalDamage, 633.6), '霜叶 S2(80%)633.6 实=' + r.skillTotalDamage);
// 芳汀:S1 二连击 135%(80%);S2 法术 145%(全额)
r = R('char_271_spikes')(0); ok(near(r.skillTotalDamage, 301.2), '芳汀 S1 二连击 135%(80%)301.2 实=' + r.skillTotalDamage);
r = R('char_271_spikes')(1); ok(near(r.skillTotalDamage, 7558.1), '芳汀 S2 法术 145%(全额)7558.1 实=' + r.skillTotalDamage);
// 罗小黑:S1/S2 均不降攻击力
r = R('char_4067_lolxh')(0); ok(near(r.skillDps, 128.0), '罗小黑 S1 切换(全额)128 实=' + r.skillDps);
r = R('char_4067_lolxh')(1); ok(near(r.skillTotalDamage, 7380.0), '罗小黑 S2(全额)7380 实=' + r.skillTotalDamage);
// 拉普兰德:S1 降(80%);S2 狼魂 法术且全额
r = R('char_140_whitew')(0); ok(near(r.skillDps, 286.8), '拉普兰德 S1 日晷(80%)286.8 实=' + r.skillDps);
r = R('char_140_whitew')(1); ok(near(r.skillTotalDamage, 9880.0), '拉普兰德 S2 狼魂 法术(全额)9880 实=' + r.skillTotalDamage);
// 断崖:天赋攻速+8 常驻;S1/S2 法术且全额
r = R('char_294_ayer')(-1); ok(near(r.realInterval, 1.2037) && near(r.normalDps, 24.8), '断崖 常态 1.2037s/24.8 实=' + r.realInterval + '/' + r.normalDps);
r = R('char_294_ayer')(0); ok(near(r.skillTotalDamage, 540.1), '断崖 S1 法术 145%(全额)540.1 实=' + r.skillTotalDamage);
r = R('char_294_ayer')(1); ok(near(r.skillTotalDamage, 6705.0), '断崖 S2 法术 100%(全额)6705 实=' + r.skillTotalDamage);
// 烈夏:S1 降(80%);S2 全额,且技能期攻速 +21
r = R('char_194_leto')(0); ok(near(r.skillTotalDamage, 7943.0), '烈夏 S1(80%)7943 实=' + r.skillTotalDamage);
r = R('char_194_leto')(1); ok(near(r.skillTotalDamage, 17664.0), '烈夏 S2(全额+技能期攻速)17664 实=' + r.skillTotalDamage);
// 银灰:S1/S3 全额,S2 切换按 80%
r = R('char_172_svrash')(-1); ok(near(r.normalDps, 55.0), '银灰 常态 55.0 实=' + r.normalDps);
r = R('char_172_svrash')(0); ok(near(r.skillTotalDamage, 1456.3) && near(r.cycleDps, 418.1), '银灰 S1 强力击γ(全额)1456.3 实=' + r.skillTotalDamage);
r = R('char_172_svrash')(2); ok(near(r.skillTotalDamage, 29202.0), '银灰 S3 真银斩(全额)29202 实=' + r.skillTotalDamage);
// 棘刺:毒伤 125/s 法术(默认近战目标);S1 降(80%)含毒;S2 停止攻击;S3 二次使用档全额
r = R('char_293_thorns')(-1); ok(near(r.normalDps, 85.3), '棘刺 常态(80%+毒1层)85.3 实=' + r.normalDps);
r = R('char_293_thorns')(0); ok(near(r.skillTotalDamage, 11935.2), '棘刺 S1(80%)含毒1层 11935.2 实=' + r.skillTotalDamage);
r = R('char_293_thorns')(1); ok(near(r.skillTotalDamage, 0), '棘刺 S2 停止攻击 → 0 实=' + r.skillTotalDamage);
r = R('char_293_thorns')(2); ok(near(r.skillDps, 920.1), '棘刺 S3 二次使用档(攻速+38档)含毒1层 920.1 实=' + r.skillDps);
// 仇白:S1/S3 全额;S2 仅起手与结束全额、技能期 3 击按 80%
r = R('char_4082_qiubai')(0); ok(near(r.skillTotalDamage, 998.4) && near(r.cycleDps, 147.7), '仇白 S1 留羽(全额)998.4 实=' + r.skillTotalDamage);
r = R('char_4082_qiubai')(1); ok(near(r.skillTotalDamage, 7276.8), '仇白 S2 承影(起手/结束全额+3击80%)7276.8 实=' + r.skillTotalDamage);
r = R('char_4082_qiubai')(2); ok(near(r.skillTotalDamage, 22828.8), '仇白 S3 问雪(全额)22828.8 实=' + r.skillTotalDamage);
// 丰川祥子:S1 八音符递减、S3 钢琴+风琴各 2 音符(均按 80%)
r = R('char_4182_oblvns')(0); ok(near(r.skillTotalDamage, 1130.4) && near(r.cycleDps, 235.5), '丰川祥子 S1 八音符(Rank I 数据档)1130.4 实=' + r.skillTotalDamage);
r = R('char_4182_oblvns')(2); ok(near(r.skillTotalDamage, 45212.4), '丰川祥子 S3 45212.4 实=' + r.skillTotalDamage);
// 模组档:断崖 X 模组 L2 攻速 +8(不阻挡自身不吃额外 +5)、L3 +11;棘刺 X 模组毒伤叠满(3/4 层)
{
  const op = load('char_294_ayer');
  const e = op.phases.length - 1;
  const slot = { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: -1, skillLevel: 7 };
  let m = calculateOperator(op, { ...slot, module: { moduleId: 'uniequip_002_ayer', moduleLevel: 2 } });
  ok(near(m.realInterval, 1.2037), '断崖 X模L2 攻速仍 +8 → 1.2037 实=' + m.realInterval);
  m = calculateOperator(op, { ...slot, module: { moduleId: 'uniequip_002_ayer', moduleLevel: 3 } });
  ok(near(m.realInterval, 1.1712), '断崖 X模L3 攻速 +11 → 1.1712 实=' + m.realInterval);
  const th = load('char_293_thorns');
  const e2 = th.phases.length - 1;
  const slot2 = { elite: e2, level: th.phases[e2].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: -1, skillLevel: 7 };
  let t2 = calculateOperator(th, { ...slot2, module: { moduleId: 'uniequip_002_thorns', moduleLevel: 2 } });
  ok(near(t2.normalDps, 213.2), '棘刺 X模L2 毒伤叠满3层 → 213.2 实=' + t2.normalDps);
  t2 = calculateOperator(th, { ...slot2, module: { moduleId: 'uniequip_002_thorns', moduleLevel: 3 } });
  ok(near(t2.normalDps, 300.3), '棘刺 X模L3 毒伤叠满4层 → 300.3 实=' + t2.normalDps);
}
console.log('领主: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
