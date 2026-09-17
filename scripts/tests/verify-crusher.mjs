// 重剑手(crusher/近卫)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 口径(用户 2026-09-17 给定 + 问答确认):
//   - 铎铃「走山路」的精力充沛不计算;赫德雷「及锋而试」仅计算基础加成(110%/120%/130%);
//     乌尔比安「血脉的哺养」的击倒叠攻击力不计算
//   - 特性「同时攻击阻挡的所有敌人」按单目标;各模组特性追加「受到的治疗效果提升20%」非输出不计;
//     赫德雷 Y 模组「笔迹」特性追加「对被阻挡的敌人伤害提升至110%」为条件类不计
//   - 赫德雷 S2 切换型:被动 +32% 攻击力计入常态(问答确认);S3「每秒 200 点真实伤害」计入技能期(问答确认)
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const D = '../../src/frontend/data/WARRIOR/crusher/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (id, si, module = null) => {
  const op = JSON.parse(fs.readFileSync(new URL(D + id + '.json', import.meta.url), 'utf8'));
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module });
};

// ---- 石英(天赋「行于荒野」攻击力 +8% 入面板;X 模组 te 提到 14%) ----
let r = run('char_4063_quartz', -1);
ok(near(r.panelAtk, 1551.96) && near(r.normalDps, 380.784), '石英 常态 (1387+50)×1.08=1551.96/380.784 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4063_quartz', 0);
ok(near(r.panelAtk, 2414.16) && near(r.skillTotalDamage, 18141.6) && near(r.skillDps, 725.664),
  '石英 S1 攻击力强化·β型(+60%)18141.6/725.664 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4063_quartz', 1);
ok(near(r.realInterval, 2.5 / 1.7) && near(r.skillTotalDamage, 12375.48) && near(r.skillDps, 618.774) && near(r.normalDps, 380.784),
  '石英 S2 全力相搏(攻速+70,每击 100%)12375.48/618.774 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4063_quartz', -1, { moduleId: 'uniequip_002_quartz', moduleLevel: 3 });
ok(near(r.panelAtk, 1740.78) && near(r.normalDps, 456.312), '石英 X3 常态((1387+50+90)×1.14)1740.78/456.312 实=' + r.panelAtk + '/' + r.normalDps);

// ---- 铎铃(精力充沛不计算;S2 停止攻击 → 结束时 1 击) ----
r = run('char_4083_chimes', -1);
ok(near(r.panelAtk, 1508) && near(r.normalDps, 363.2), '铎铃 常态(精力充沛 +20% 不计)1508/363.2 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4083_chimes', 0);
ok(near(r.panelAtk, 2639) && near(r.skillTotalDamage, 24468) && near(r.skillDps, 815.6), '铎铃 S1 攻击力强化·γ型(+75%)24468/815.6 实=' + r.skillTotalDamage);
r = run('char_4083_chimes', 1);
ok(near(r.panelAtk, 2262) && near(r.skillTotalDamage, 4150.2) && near(r.skillDps, 830.04) && near(r.normalDps, 363.2),
  '铎铃 S2 乡心无改(停止攻击,结束 1 击 210%×1.5)4150.2/830.04 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4083_chimes', -1, { moduleId: 'uniequip_002_chimes', moduleLevel: 3 });
ok(near(r.panelAtk, 1608) && near(r.normalDps, 403.2), '铎铃 X3 常态(模组白值 + 精力充沛 33% 不计)1608/403.2 实=' + r.panelAtk + '/' + r.normalDps);

// ---- 赫德雷(天赋基础档 110% 入面板;S2 切换型被动 +32% 计入常态;S3 真伤 DOT) ----
r = run('char_4088_hodrer', -1);
ok(near(r.panelAtk, 1821.6) && near(r.normalDps, 488.64), '赫德雷 常态 (1576+80)×1.1=1821.6/488.64 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4088_hodrer', 0);
ok(near(r.panelAtk, 4007.52) && near(r.skillTotalDamage, 3407.52) && near(r.cycleDps, 707.232),
  '赫德雷 S1 重锋不熄(触发型 220%)3407.52/707.232 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_4088_hodrer', 1);
ok(r.isToggle === true && near(r.panelAtk, 2404.51) && near(r.realInterval, 3.0) && near(r.skillDps, 601.504) && near(r.normalDps, 721.8048),
  '赫德雷 S2 余烬重荷(切换型:被动 +32% 计入常态、间隔 2.5+0.5)601.504 / 常态 721.8048 实=' + r.skillDps + '/' + r.normalDps);
r = run('char_4088_hodrer', 2);
ok(near(r.panelAtk, 3643.2) && near(r.skillTotalDamage, 99209.6) && near(r.skillDps, 1417.28) && near(r.dmgTypes.true.skillTotalDamage, 14000),
  '赫德雷 S3 死境硝烟(28 击 + 200/s 真实伤害 ×70s)99209.6/1417.28 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4088_hodrer', -1, { moduleId: 'uniequip_002_hodrer', moduleLevel: 3 });
ok(near(r.panelAtk, 1964.6) && near(r.normalDps, 600.424), '赫德雷 X3 常态(新的生活:物理伤害 +10%、天赋档不变)1964.6/600.424 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4088_hodrer', 2, { moduleId: 'uniequip_002_hodrer', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 116539.36), '赫德雷 X3 S3(物理档 ×1.1、真伤 DOT 不乘)116539.36 实=' + r.skillTotalDamage);
r = run('char_4088_hodrer', -1, { moduleId: 'uniequip_003_hodrer', moduleLevel: 3 });
ok(near(r.panelAtk, 2360.8) && near(r.normalDps, 704.32), '赫德雷 Y3 常态(笔迹:基础档 130%;(1576+80+160)×1.3)2360.8/704.32 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4088_hodrer', 2, { moduleId: 'uniequip_003_hodrer', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 129404.8), '赫德雷 Y3 S3(特性追加 110% 属被阻挡条件类不计)129404.8 实=' + r.skillTotalDamage);

// ---- 乌尔比安(血脉的哺养不计算;S3 船锚 1 击 + 本体普攻) ----
r = run('char_4145_ulpia', -1);
ok(near(r.panelAtk, 1649) && near(r.normalDps, 419.6), '乌尔比安 常态 1649/419.6 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4145_ulpia', 0);
ok(near(r.panelAtk, 3792.7) && near(r.skillTotalDamage, 3192.7) && near(r.cycleDps, 1058.14),
  '乌尔比安 S1 必须促成的接触(触发型 230%)3192.7/1058.14 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_4145_ulpia', 1);
ok(near(r.panelAtk, 3957.6) && near(r.skillDps, 1343.04) && r.skillTotalDamage === 0,
  '乌尔比安 S2 必须维系的界限(持续无限 +140%)1343.04 实=' + r.skillDps);
r = run('char_4145_ulpia', 2);
ok(near(r.panelAtk, 5606.6) && near(r.skillTotalDamage, 57595.57) && near(r.skillDps, 2303.823),
  '乌尔比安 S3 必须开辟的通路(船锚 145% + 10 击本体)57595.57/2303.823 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4145_ulpia', 2, { moduleId: 'uniequip_002_ulpia', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 62267.17), '乌尔比安 X3 S3 62267.17 实=' + r.skillTotalDamage);

console.log('重剑手: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
