// 凝滞师(slower,辅助)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50
// 口径:凝滞师攻击为法术伤害(SUBPROF_ARTS);特性停顿/减速不建模。
// 用户口径(2026-09-17):格劳克斯「反制装置」对【无人机】攻击力增幅不计、「反制电磁脉冲」加倍不计;
//   溯光星源「数据建模」攻速默认叠满(18 层;Y 模组 25 层)、「能源解析」脆弱默认最高层(14%,潜4 16%)。
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

// ---- 溯光星源 ----
{
  const o = loadOp('char_1047_halo2');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'arts', '溯光星源 常态伤害类型=法术');
  near(r0.normalDps, 215.232, 0.05, '溯光星源 常态 DPS(攻速叠满 18 层 + 脆弱最高层 14%)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 6480.672, 0.5, '溯光星源 S1 总伤(跳跃 3 目标按单目标 1 次)');
  near(s1.skillDps, 360.037, 0.1, '溯光星源 S1 技能期 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 467.856, 0.5, '溯光星源 S2 单发总伤(触发型)');
  near(s2.cycleDps, 230.298, 0.1, '溯光星源 S2 循环 DPS(攻回 sp4)');
  eq(s2.normalDps, null, '溯光星源 S2 常态列为 null(触发型)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillDps, 515.681, 0.1, '溯光星源 S3 技能期 DPS(间隔 -0.7)');
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_halo2', 3)));
  near(y3.normalDps, 276.36, 0.05, '溯光星源 Y3 常态 DPS(攻速 25 层 + 叠满攻击力 +12%)');
  const y3s3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_002_halo2', 3)));
  near(y3s3.skillDps, 651.404, 0.1, '溯光星源 Y3 S3 技能期 DPS');
}
// ---- 地灵 ----
{
  const o = loadOp('char_183_skgoat');
  near(calculateOperator(o, mk(o, -1)).normalDps, 139.474, 0.05, '地灵 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 5512, 0.5, '地灵 S1 总伤(+60% 专一)');
  near(s1.skillDps, 220.48, 0.1, '地灵 S1 技能期 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.skillDps, 0, '地灵 S2 停止攻击 → 技能期 DPS 0');
  eq(s2.skillTotalDamage, 0, '地灵 S2 总伤 0');
  near(s2.normalDps, 139.474, 0.05, '地灵 S2 常态普攻保留');
}
// ---- 真理 ----
{
  const o = loadOp('char_195_glassb');
  near(calculateOperator(o, mk(o, -1)).normalDps, 181.037, 0.05, '真理 常态 DPS(探知者攻速 +18)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillDps, 377.87, 0.1, '真理 S1 技能期 DPS(间隔 -1)');
  near(s1.skillTotalDamage, 10202.5, 0.5, '真理 S1 总伤');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 6340.125, 0.5, '真理 S2 总伤(+45% 专一)');
  const y2 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_glassb', 2)));
  near(y2.normalDps, 191.776, 0.05, '真理 Y2 常态 DPS(攻速 21 + 白值 4)');
  const y2s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_glassb', 2)));
  near(y2s1.skillTotalDamage, 11368.5, 0.5, '真理 Y2 S1 总伤(技能期间额外攻速 +5)');
}
// ---- 波登可 ----
{
  const o = loadOp('char_258_podego');
  near(calculateOperator(o, mk(o, -1)).normalDps, 155.468, 0.05, '波登可 常态 DPS(园丁 +9% 含自身)');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.type, 'heal', '波登可 S1 普攻转治疗');
  near(s1.skillHps, 435.312, 0.2, '波登可 S1 技能期 HPS');
  near(s1.totalHeal, 10012.166, 1, '波登可 S1 总治疗量');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 1152.021, 0.5, '波登可 S2 孢子群总伤(6s × 65%)');
  near(s2.cycleDps, 195.833, 0.1, '波登可 S2 循环 DPS');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_podego', 3)));
  near(x3.normalDps, 166.942, 0.05, '波登可 X3 常态 DPS(园丁 +11%)');
}
// ---- 梓兰 ----
{
  const o = loadOp('char_278_orchid');
  near(calculateOperator(o, mk(o, -1)).normalDps, 119.9, 0.05, '梓兰 常态 DPS(攻速 +9)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 4441.25, 0.5, '梓兰 S1 总伤(+25%/攻速 +25,技能 7 档)');
}
// ---- 安洁莉娜 ----
{
  const o = loadOp('char_291_aglina');
  near(calculateOperator(o, mk(o, -1)).normalDps, 173.734, 0.05, '安洁莉娜 常态 DPS(加速力场 +7 含自身)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillDps, 321.437, 0.1, '安洁莉娜 S1 技能期 DPS(+90%)');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.normalDps, 0, '安洁莉娜 S2 常态 0(技能未开启时无法普通攻击)');
  near(s2.skillTotalDamage, 12463.4, 0.5, '安洁莉娜 S2 总伤(间隔 ×0.15、每击 40%)');
  const s3 = calculateOperator(o, mk(o, 2));
  eq(s3.normalDps, 0, '安洁莉娜 S3 常态 0');
  near(s3.skillDps, 373.285, 0.1, '安洁莉娜 S3 技能期 DPS(+120%)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_003_aglina', 3)));
  near(x3.normalDps, 189.424, 0.05, '安洁莉娜 X3 常态 DPS(te 攻速不计,仅 +7 与模组白值 +6)');
}
// ---- 格劳克斯 ----
{
  const o = loadOp('char_326_glacus');
  near(calculateOperator(o, mk(o, -1)).normalDps, 142.105, 0.05, '格劳克斯 常态 DPS(反制装置无人机增幅不计)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 4633.2, 0.5, '格劳克斯 S1 总伤(+43% 专一)');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.damageType, 'arts', '格劳克斯 S2 法术伤害');
  near(s2.skillTotalDamage, 918, 0.5, '格劳克斯 S2 单发总伤(340% 无人机加倍不计)');
  near(s2.cycleDps, 166.909, 0.1, '格劳克斯 S2 循环 DPS');
}
// ---- 铃兰 ----
{
  const o = loadOp('char_358_lisa');
  near(calculateOperator(o, mk(o, -1)).normalDps, 188.211, 0.05, '铃兰 常态 DPS(画地为牢 20% 脆弱 → ×1.2)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 10030.68, 0.5, '铃兰 S1 总伤(+65%/攻速 +20)');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.isPermanent, true, '铃兰 S2 持续时间无限(永久型)');
  near(s2.skillDps, 244.674, 0.1, '铃兰 S2 技能期 DPS(持续型)');
  eq(s2.skillTotalDamage, 0, '铃兰 S2 总伤 0(永久型)');
  const s3 = calculateOperator(o, mk(o, 2));
  eq(s3.type, 'heal', '铃兰 S3 治疗型');
  eq(s3.skillDps, 0, '铃兰 S3 技能期无伤害(停止攻击)');
  near(s3.skillHps, 83.44, 0.1, '铃兰 S3 技能期 HPS(攻击力 ×14% 专一)');
  near(s3.totalHeal, 2586.64, 0.5, '铃兰 S3 总治疗量');
  near(s3.normalDps, 188.211, 0.05, '铃兰 S3 常态普攻保留');
}
// ---- 但书 ----
{
  const o = loadOp('char_4032_provs');
  near(calculateOperator(o, mk(o, -1)).normalDps, 167.316, 0.05, '但书 常态 DPS(卡西米尔法律专精 +10 攻速)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 809.2, 0.5, '但书 S1 单发总伤(280% 专一,触发型)');
  near(s1.cycleDps, 279.367, 0.1, '但书 S1 循环 DPS(自动回 sp6)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 3468, 0.5, '但书 S2 总伤(300% 瞬发 + 间隔缩短后 9 击)');
  near(s2.skillDps, 433.5, 0.1, '但书 S2 技能期 DPS');
}
// ---- 小满 ----
{
  const o = loadOp('char_4122_grabds');
  near(calculateOperator(o, mk(o, -1)).normalDps, 170.789, 0.05, '小满 常态 DPS(好好听话 +10 攻速)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 531, 0.5, '小满 S1 单发总伤(180% 专一,触发型)');
  near(s1.cycleDps, 236, 0.1, '小满 S1 循环 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 3245, 0.5, '小满 S2 总伤(沉睡 5s 后 10s 攻速 +100,11 击)');
  near(s2.skillDps, 216.333, 0.1, '小满 S2 技能期 DPS(窗口 15s)');
  near(s2.normalDps, 170.789, 0.05, '小满 S2 常态普攻保留');
}
console.log('凝滞师: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
