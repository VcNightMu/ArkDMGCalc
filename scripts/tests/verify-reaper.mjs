// 收割者(reaper/近卫)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 口径(用户 2026-09-17):
//   - 羽毛笔「水蓝色黎明」(X 模组)攻速/攻击力增幅默认不触发
//   - 休谟斯「高效处理」精力充沛(peak_performance)默认不触发
//   - 圣约送葬人「受选之人」额外攻击默认不触发、「铳弹共感」弹药上限默认仅一层(→ +1 发)、
//     「近身铳斗」闪避补弹默认不触发
//   - 问答确认:圣约决裁第 k 次攻击含 k 层(首击即 +5%);绯红壁合单目标只按 1 个血镰;
//     血镰期间「萃血」DOT 整段计入;S3 打心烛按原敌当前生命 60% 封顶
//   - 特性(每攻击到一个敌人回复自身生命/元素损伤)是自回血非输出,不建模型;攻击造成群体伤害按单目标口径
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.2) => Math.abs(a - b) <= tol;
const D = '../../src/frontend/data/WARRIOR/reaper/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (id, si, module = null) => {
  const op = JSON.parse(fs.readFileSync(new URL(D + id + '.json', import.meta.url), 'utf8'));
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module });
};

// ---- 圣约送葬人(弹药型三技能;受选之人/闪避不触发,铳弹共感默认 1 层 → +1 发) ----
let r = run('char_1032_excu2', -1);
ok(near(r.panelAtk, 777) && near(r.normalDps, 136.154), '圣约送葬人 常态 777/136.154 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_1032_excu2', 0);
ok(near(r.skillTotalDamage, 7270.2) && near(r.skillDps, 621.385) && near(r.panelAtk, 1087.8) && near(r.normalDps, 136.154),
  '圣约送葬人 S1 遗嘱执行(9 发=8+1,攻击力+40%,无视 320 防御)7270.2/621.385 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_1032_excu2', 1);
ok(near(r.skillTotalDamage, 9371.7) && near(r.skillDps, 554.538) && near(r.panelAtk, 1320.9),
  '圣约送葬人 S2 近身铳斗(13 发,攻击力+70%,闪避补弹不触发)9371.7/554.538 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_1032_excu2', 2);
ok(near(r.realInterval, 1.8) && near(r.skillTotalDamage, 34848.75) && near(r.skillDps, 1138.848),
  '圣约送葬人 S3 圣约决裁(17 发,间隔+0.5→1.8s,每弹+5% 首击即计,末击 200%)34848.75/1138.848 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_1032_excu2', -1, { moduleId: 'uniequip_002_excu2', moduleLevel: 3 });
ok(near(r.panelAtk, 837) && near(r.realInterval, 1.2149532710280375), '圣约送葬人 X3 受选之人不触发(仅模组白值 +60/攻速 +7)837 实=' + r.panelAtk);
r = run('char_1032_excu2', 2, { moduleId: 'uniequip_003_excu2', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 45590.6), '圣约送葬人 Y3 铳弹共感(弹药类技能期攻击力 +12% 必然生效)45590.6 实=' + r.skillTotalDamage);

// ---- 隐德来希(萃血固定 DOT;S1 二连击;S2 血镰;S3 心烛封顶) ----
r = run('char_4010_etlchi', -1);
ok(near(r.realInterval, 1.3) && near(r.normalDps, 215.385), '隐德来希 常态 115.385 普攻 + 100 DOT = 215.385 实=' + r.normalDps);
r = run('char_4010_etlchi', 0);
ok(near(r.skillTotalDamage, 1125) && near(r.cycleDps, 302.885), '隐德来希 S1 玫影觅迹(连续攻击两次)1125 实=' + r.skillTotalDamage);
r = run('char_4010_etlchi', 1);
ok(near(r.realInterval, 0.5) && near(r.skillTotalDamage, 18300) && near(r.skillDps, 1525) && near(r.normalDps, 215.385),
  '隐德来希 S2 绯红壁合(1 个血镰 24 跳×175% + DOT 整段)18300/1525 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4010_etlchi', 2);
ok(near(r.realInterval, 0.65) && near(r.skillTotalDamage, 32000) && near(r.skillDps, 1600),
  '隐德来希 S3 灵与欲的惜别(30 击,心烛按原敌当前生命 60% 封顶 30000 + DOT 2000)32000 实=' + r.skillTotalDamage);
r = run('char_4010_etlchi', -1, { moduleId: 'uniequip_003_etlchi', moduleLevel: 3 });
ok(near(r.realInterval, 1.2149532710280375) && near(r.normalDps, 410.192), '隐德来希 Y3 萃血 DOT 450/秒→225(+特质攻速条件项不触发)410.192 实=' + r.normalDps);

// ---- 海沫(收割给养/罹患浸染非输出;S1 二连击;S2 闪避与回血不建模) ----
r = run('char_4066_highmo', -1);
ok(near(r.normalDps, 84.615), '海沫 常态 84.615 实=' + r.normalDps);
r = run('char_4066_highmo', 0);
ok(near(r.skillTotalDamage, 859), '海沫 S1 回首，断舍(连续攻击两次)859 实=' + r.skillTotalDamage);
r = run('char_4066_highmo', 1);
ok(near(r.skillTotalDamage, 7294.5) && near(r.skillDps, 364.725), '海沫 S2 泡影，殆尽(53% 闪避与回血不计)7294.5 实=' + r.skillTotalDamage);

// ---- 羽毛笔(水蓝色黎明攻速增幅不触发;S1 二连击;S2 间隔 -40%、低血增伤不触发) ----
r = run('char_421_crow', -1);
ok(near(r.normalDps, 96.154), '羽毛笔 常态 96.154 实=' + r.normalDps);
r = run('char_421_crow', 0);
ok(near(r.skillTotalDamage, 902.5), '羽毛笔 S1 高速切割(连续攻击两次)902.5 实=' + r.skillTotalDamage);
r = run('char_421_crow', 1);
ok(near(r.realInterval, 0.78) && near(r.skillTotalDamage, 17920) && near(r.skillDps, 716.8),
  '羽毛笔 S2 收割(间隔 -40%→0.78s,攻击力+60%;低血额外+40% 不触发)17920/716.8 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_421_crow', -1, { moduleId: 'uniequip_002_crow', moduleLevel: 3 });
ok(near(r.panelAtk, 755) && near(r.realInterval, 1.3), '羽毛笔 X3 水蓝色黎明(渐入佳境攻速/攻击力增幅不触发)755/1.3 实=' + r.panelAtk + '/' + r.realInterval);

// ---- 休谟斯(再回收屏障与精力充沛非输出;S1 常规;S2 无攻击力增益) ----
r = run('char_491_humus', -1);
ok(near(r.normalDps, 35.385), '休谟斯 常态 35.385 实=' + r.normalDps);
r = run('char_491_humus', 0);
ok(near(r.skillTotalDamage, 885.8), '休谟斯 S1 固废切割 885.8 实=' + r.skillTotalDamage);
r = run('char_491_humus', 1);
ok(near(r.panelAtk, 646) && near(r.skillTotalDamage, 874), '休谟斯 S2 高效处理(精力充沛不触发,面板攻击不变)874 实=' + r.skillTotalDamage);
r = run('char_491_humus', -1, { moduleId: 'uniequip_002_humus', moduleLevel: 3 });
ok(near(r.panelAtk, 666) && near(r.realInterval, 1.3), '休谟斯 X3 再回收(仅模组白值)666 实=' + r.panelAtk);

console.log('收割者: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
