// 削弱者(underminer,辅助)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50
// 口径:削弱者攻击为法术伤害(SUBPROF_ARTS);特性「攻击使敌人攻击力-10% 持续2秒」为敌方减益,不建模。
// 用户口径(2026-09-17):
//   初雪「虚弱化」/巫恋「溃败暗示」的脆弱效果默认不计算(条件类);
//   海霓「阻滞性显色剂」默认不击倒目标(被击倒提升天赋效果不计);
//   灵知「零度爆发」默认蓄力(蓄力额外造成一层寒冷 → 2 层冻结)。
// 灵知专项(用户 2026-09-17):寒冷/冻结都是先结算状态再结算伤害,所有攻击都按此逻辑 →
//   常态普攻与各技能首击落点必已处于寒冷(吃寒冷脆弱 damage_scale_cold;已由 TALENT_DMG_MUL_DRIVERS 的 tmul 带出);
//   叠到 2 层即冻结 → 吃冻结脆弱(damage_scale_freeze):S1 二连击第 2 下、S2 蓄力、S3 第 2 击起与结束爆发。
// 特例:灵知三个技能都在 UNDERMINER_SPECIAL 专用分支结算(S3 顶层 atk_scale 是「技能结束时对冻结目标」的一次性爆发倍率,非普攻倍率)。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
function loadOp(id) {
  const e = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8')).find((x) => x.id === id);
  return JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8'));
}
function mk(op, si, module) {
  const elite = op.phases.length - 1;
  return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module };
}
function mod(op, id, level) { return { moduleId: id, moduleLevel: level }; }
let pass = 0, fail = 0;
const near = (a, e, tol, label) => {
  if (typeof a !== 'number' || Math.abs(a - e) > tol) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); }
  else pass++;
};
const eq = (a, e, label) => { if (a !== e) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };

// ---- 初雪 ----
{
  const o = loadOp('char_174_slbell');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'arts', '初雪 常态伤害类型=法术(削弱者特性)');
  near(r0.normalDps, 154.688, 0.05, '初雪 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.skillDps, 0, '初雪 S1 技能期 DPS 0(敌人攻速- 无自身输出增益)');
  eq(s1.skillTotalDamage, 0, '初雪 S1 总伤 0');
  near(s1.normalDps, 154.688, 0.05, '初雪 S1 常态普攻保留');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.damageType, 'arts', '初雪 S2 法术伤害');
  near(s2.skillDps, 187.11, 0.1, '初雪 S2 技能期 DPS(自身法伤吃敌方 -26% 法抗)');
  near(s2.skillTotalDamage, 3742.2, 0.5, '初雪 S2 总伤(12 击)');
  near(s2.normalDps, 154.688, 0.05, '初雪 S2 常态普攻(技能级减抗不入常态)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_slbell', 3)));
  near(x3.normalDps, 167.063, 0.05, '初雪 X3 常态 DPS(模组攻速 +8)');
  const x3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_slbell', 3)));
  near(x3s1.normalDps, 167.063, 0.05, '初雪 X3 S1 常态普攻(含模组攻速)');
  near(x3s1.skillDps, 0, 0.001, '初雪 X3 S1 技能期 DPS 0');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_slbell', 3)));
  near(x3s2.skillDps, 202.703, 0.1, '初雪 X3 S2 技能期 DPS');
  near(x3s2.skillTotalDamage, 4054.05, 0.5, '初雪 X3 S2 总伤(13 击)');
}
// ---- 巫恋 ----
{
  const o = loadOp('char_254_vodfox');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'arts', '巫恋 常态伤害类型=法术');
  near(r0.normalDps, 147.813, 0.05, '巫恋 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.isPermanent, true, '巫恋 S1 持续时间无限(永久型)');
  near(s1.skillDps, 214.328, 0.1, '巫恋 S1 技能期 DPS(攻击力 +45% 专一)');
  eq(s1.skillTotalDamage, 0, '巫恋 S1 总伤 0(永久型)');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.skillDps, 0, '巫恋 S2 技能期 DPS 0(诅咒娃娃降攻防,自身法伤不受益)');
  eq(s2.skillTotalDamage, 0, '巫恋 S2 总伤 0');
  near(s2.normalDps, 147.813, 0.05, '巫恋 S2 常态普攻保留');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_vodfox', 3)));
  near(x3.normalDps, 157.188, 0.05, '巫恋 X3 常态 DPS(模组攻击 +30)');
  const x3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_vodfox', 3)));
  near(x3s1.skillDps, 227.922, 0.1, '巫恋 X3 S1 技能期 DPS');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_vodfox', 3)));
  near(x3s2.normalDps, 157.188, 0.05, '巫恋 X3 S2 常态普攻保留');
}
// ---- 海霓 ----
{
  const o = loadOp('char_4079_haini');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'arts', '海霓 常态伤害类型=法术');
  near(r0.normalDps, 157.813, 0.05, '海霓 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 404, 0.5, '海霓 S1 单发总伤(下次攻击提升至 160% 专一)');
  near(s1.cycleDps, 181.484, 0.1, '海霓 S1 循环 DPS(攻回 sp3)');
  eq(s1.normalDps, null, '海霓 S1 常态列为 null(触发型)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillDps, 219.224, 0.1, '海霓 S2 技能期 DPS(攻击力 +43% 专一,17 击)');
  near(s2.skillTotalDamage, 6138.275, 0.5, '海霓 S2 总伤(默认不击倒目标,天赋提升不计)');
  near(s2.normalDps, 157.813, 0.05, '海霓 S2 常态普攻保留');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_haini', 3)));
  near(x3.normalDps, 168.125, 0.05, '海霓 X3 常态 DPS(模组攻击 +33)');
  const x3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_haini', 3)));
  near(x3s1.skillTotalDamage, 430.4, 0.5, '海霓 X3 S1 单发总伤');
  near(x3s1.cycleDps, 193.344, 0.1, '海霓 X3 S1 循环 DPS');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_haini', 3)));
  near(x3s2.skillTotalDamage, 6539.39, 0.5, '海霓 X3 S2 总伤');
}
// ---- 灵知 ----
{
  const o = loadOp('char_206_gnosis');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'arts', '灵知 常态伤害类型=法术');
  near(r0.normalDps, 208.984, 0.05, '灵知 常态 DPS(自身攻击先叠寒冷 → 吃 25% 寒冷脆弱:167.188×1.25)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 1140.219, 0.5, '灵知 S1 总伤(二连击:第1下寒冷 414.625×1.25,第2下冻结 414.625×1.5)');
  near(s1.cycleDps, 452.242, 0.1, '灵知 S1 循环 DPS(自动回 sp4)');
  near(s1.normalDps, 208.984, 0.05, '灵知 S1 常态普攻(含寒冷脆弱)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 682.125, 0.5, '灵知 S2 总伤(默认蓄力 → 2 层即时冻结:454.75×1.5)');
  near(s2.cycleDps, 288.518, 0.1, '灵知 S2 循环 DPS(自动回 sp7)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillDps, 705.227, 0.1, '灵知 S3 技能期 DPS(15 击普攻 + 结束爆发 450% 专一)');
  near(s3.skillTotalDamage, 7757.5, 0.5, '灵知 S3 总伤(首击冰冻前 334.375 + 14 击×401.25 + 爆发 1805.625)');
  near(s3.normalDps, 208.984, 0.05, '灵知 S3 常态普攻保留');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_gnosis', 3)));
  near(x3.normalDps, 227.5, 0.05, '灵知 X3 常态 DPS(模组攻击 +25,寒冷脆弱 te 1.3)');
  const x3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_gnosis', 3)));
  near(x3s1.skillTotalDamage, 1258.6, 0.5, '灵知 X3 S1 总伤(冻结脆弱 1.6/寒冷 1.3)');
  near(x3s1.cycleDps, 496.65, 0.1, '灵知 X3 S1 循环 DPS');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_gnosis', 3)));
  near(x3s2.skillTotalDamage, 761.6, 0.5, '灵知 X3 S2 总伤(476×1.6)');
  const x3s3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_002_gnosis', 3)));
  near(x3s3.skillTotalDamage, 8652, 0.5, '灵知 X3 S3 总伤');
  near(x3s3.skillDps, 786.545, 0.1, '灵知 X3 S3 技能期 DPS');
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_003_gnosis', 3)));
  near(y3.normalDps, 265.039, 0.05, '灵知 Y3 常态 DPS(殊途同归 te:谢拉格攻击 +15%,本人吃)');
  const y3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_003_gnosis', 3)));
  near(y3s1.skillTotalDamage, 1446.053, 0.5, '灵知 Y3 S1 总伤');
  near(y3s1.cycleDps, 573.545, 0.1, '灵知 Y3 S1 循环 DPS');
  const y3s3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_003_gnosis', 3)));
  near(y3s3.skillTotalDamage, 9838.25, 0.5, '灵知 Y3 S3 总伤');
  near(y3s3.skillDps, 894.386, 0.1, '灵知 Y3 S3 技能期 DPS');
}
console.log('削弱者: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
