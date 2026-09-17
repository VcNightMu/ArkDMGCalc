// 吟游者(bard,辅助)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50
// 口径(用户 2026-09-18):「鼓舞」作用于友方 → 不进自身输出(纯鼓舞技能无自身输出变化);
// 只算技能期治疗量(技能把特性效果提高至 X% → 技能期 HPS = 面板攻击力 × X);技能改为造成伤害的按伤害算。
// 特性:不攻击,持续恢复范围内所有友军生命(每秒相当于自身攻击力 10%),自身不受鼓舞影响。
// 三角初华与 U-Official 的 trait 键少了 attack@ 前缀(atk_to_hp_recovery_ratio),引擎两个键名都认。
// 另:魔王「过往尘埃」的微尘对友方产生的效果不计算;魔王 S2 微尘伤害按每秒一次计算;
// 浊心斯卡蒂「捕食习性」取基础增幅、S3 仅计自身;其海嗣(token_10017_skadi2_dedant)独立成条且继承同等级数据。
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

// ---- 浊心斯卡蒂 ----
{
  const o = loadOp('char_1012_skadi2');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.type, 'heal', '浊心斯卡蒂 常态为 heal 型(不攻击)');
  eq(r0.normalDps, null, '浊心斯卡蒂 常态 DPS null');
  near(r0.normalHps, 44.308, 0.01, '浊心斯卡蒂 常态 HPS=418×1.06×0.1(捕食习性+6%)');
  near(r0.panelAtk, 443.08, 0.01, '浊心斯卡蒂 面板攻击力 443.08');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillHps, 310.156, 0.01, '浊心斯卡蒂 S1 技能期 HPS(特性提高至 70%)');
  near(s1.totalHeal, 9304.68, 0.5, '浊心斯卡蒂 S1 总治疗量(30s)');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.isPermanent, true, '浊心斯卡蒂 S2 持续时间无限');
  near(s2.skillHps, 79.7544, 0.01, '浊心斯卡蒂 S2 技能期 HPS(特性提高至 18%)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillDps, 265.848, 0.01, '浊心斯卡蒂 S3 每秒真伤(60% 攻击力)');
  near(s3.skillTotalDamage, 5316.96, 0.5, '浊心斯卡蒂 S3 总伤(20s,仅计自身)');
  eq(s3.damageType, 'true', '浊心斯卡蒂 S3 真伤类型');
  eq(s3.skillHps, 0, '浊心斯卡蒂 S3 特性变为真伤 → 无治疗');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_skadi2', 3)));
  near(x3.normalHps, 48.018, 0.01, '浊心斯卡蒂 X3 常态 HPS(模组攻击 +35)');
  const x3s3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_002_skadi2', 3)));
  near(x3s3.skillDps, 288.108, 0.01, '浊心斯卡蒂 X3 S3 每秒真伤');
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_003_skadi2', 3)));
  near(y3.normalHps, 48.832, 0.01, '浊心斯卡蒂 Y3 常态 HPS(攻击 +30 且捕食习性 +9%)');
  const y3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_003_skadi2', 3)));
  near(y3s1.skillHps, 341.824, 0.01, '浊心斯卡蒂 Y3 S1 技能期 HPS');
}
// ---- 魔王 ----
{
  const o = loadOp('char_4134_cetsyr');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.type, 'heal', '魔王 常态为 heal 型');
  near(r0.normalHps, 39.9, 0.01, '魔王 常态 HPS=399×10%(过往尘埃的微尘对友方效果不计算)');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.isPermanent, true, '魔王 S1 持续时间无限');
  near(s1.skillHps, 119.7, 0.01, '魔王 S1 技能期 HPS(特性 30%)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillDps, 1057.35, 0.01, '魔王 S2 微尘真伤 DPS(每秒一次:265%×399)');
  near(s2.skillTotalDamage, 37007.25, 0.5, '魔王 S2 总伤(35s)');
  eq(s2.damageType, 'true', '魔王 S2 真伤类型');
  near(s2.skillHps, 39.9, 0.01, '魔王 S2 技能期 HPS(特性照常 10%)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillHps, 319.2, 0.01, '魔王 S3 技能期 HPS(特性 80%)');
  near(s3.totalHeal, 9576, 0.5, '魔王 S3 总治疗量(30s)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_cetsyr', 3)));
  near(x3.normalHps, 42.6, 0.01, '魔王 X3 常态 HPS(模组 攻击+27)');
  const x3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_cetsyr', 3)));
  near(x3s1.skillHps, 127.8, 0.01, '魔王 X3 S1 技能期 HPS');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_cetsyr', 3)));
  near(x3s2.skillDps, 1128.9, 0.01, '魔王 X3 S2 微尘真伤 DPS');
  const x3s3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_002_cetsyr', 3)));
  near(x3s3.skillHps, 340.8, 0.01, '魔王 X3 S3 技能期 HPS');
}
// ---- 空 ----
{
  const o = loadOp('char_101_sora');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.normalHps, 38.5, 0.01, '空 常态 HPS(385×10%)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillHps, 308, 0.01, '空 S1 技能期 HPS(特性提高至 80%)');
  near(s1.totalHeal, 2156, 0.5, '空 S1 总治疗量(7s)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillHps, 38.5, 0.01, '空 S2 仅鼓舞 → 自身输出不变化(特性照常 10%)');
  near(s2.skillDps, 0, 0.001, '空 S2 技能期 DPS 0');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_sora', 3)));
  near(x3.normalHps, 40.7, 0.01, '空 X3 常态 HPS(模组攻击 +22;安可概率类不计)');
  const x3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_sora', 3)));
  near(x3s1.skillHps, 325.6, 0.01, '空 X3 S1 技能期 HPS');
}
// ---- 海蒂 ----
{
  const o = loadOp('char_4045_heidi');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.normalHps, 36, 0.01, '海蒂 常态 HPS(360×10%)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillHps, 36, 0.01, '海蒂 S1 仅鼓舞+阻挡-3 → 特性不变(10%)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillHps, 90, 0.01, '海蒂 S2 技能期 HPS(特性提高至 25%)');
  near(s2.totalHeal, 1800, 0.5, '海蒂 S2 总治疗量(20s)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_heidi', 3)));
  near(x3.normalHps, 38.1, 0.01, '海蒂 X3 常态 HPS(模组攻击 +21)');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_heidi', 3)));
  near(x3s2.skillHps, 95.25, 0.01, '海蒂 X3 S2 技能期 HPS');
}
// ---- 三角初华 ----
{
  const o = loadOp('char_4184_dolris');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.type, 'heal', '三角初华 常态为 heal 型');
  near(r0.normalHps, 66.325, 0.01, '三角初华 常态 HPS=379×0.1 + 379×0.3/4(天赋每 4s 补一口)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillHps, 66.325, 0.01, '三角初华 S1 技能期 HPS(鼓舞不计;受击补量无受击模型不计)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillDps, 1073.8333, 0.01, '三角初华 S2 每 0.3s 法伤(85% 攻击力)');
  near(s2.skillHps, 281.0917, 0.01, '三角初华 S2 技能期 HPS(每 0.3s 治疗 20% + 天赋治疗)');
  near(s2.skillTotalDamage, 12886, 0.5, '三角初华 S2 总伤(12s)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_dolris', 3)));
  near(x3.normalHps, 80.2, 0.01, '三角初华 X3 常态 HPS(模组 攻击+22、天赋 3s/30%)');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_dolris', 3)));
  near(x3s2.skillHps, 307.4333, 0.01, '三角初华 X3 S2 技能期 HPS');
  near(x3s2.skillDps, 1136.1667, 0.01, '三角初华 X3 S2 技能期 DPS');
}
// ---- U-Official ----
{
  const o = loadOp('char_4091_ulika');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.type, 'heal', 'U-Official 常态为 heal 型');
  near(r0.normalHps, 12.2, 0.01, 'U-Official 常态 HPS(122×10%)');
  eq((o.skills || []).length, 0, 'U-Official 无技能');
}
// ---- 斯卡蒂的海嗣(浊心斯卡蒂召唤物,TOKEN:独立成条、数值继承同等级持有者)----
{
  const o = loadOp('token_10017_skadi2_dedant');
  eq(o.ownerOperatorId, 'char_1012_skadi2', '海嗣 ownerOperatorId = 浊心斯卡蒂');
  const owner = loadOp('char_1012_skadi2');
  for (const si of [-1, 0, 1, 2]) {
    const a = calculateOperator(o, mk(o, si));
    const b = calculateOperator(owner, mk(owner, si));
    eq(a.normalHps, b.normalHps, '海嗣 S' + (si + 1) + ' 常态 HPS 与浊心斯卡蒂一致(' + b.normalHps + ')');
    eq(a.skillHps, b.skillHps, '海嗣 S' + (si + 1) + ' 技能期 HPS 与浊心斯卡蒂一致');
    eq(a.skillDps, b.skillDps, '海嗣 S' + (si + 1) + ' 技能期 DPS 与浊心斯卡蒂一致(S3 真伤)');
    eq(a.skillTotalDamage, b.skillTotalDamage, '海嗣 S' + (si + 1) + ' 技能期总伤与浊心斯卡蒂一致');
  }
  const sh3 = calculateOperator(o, mk(o, 2));
  near(sh3.skillDps, 265.848, 0.01, '海嗣 S3 每秒真伤与本体一致');
  near(sh3.skillTotalDamage, 5316.96, 0.5, '海嗣 S3 总伤与本体一致');
  near(calculateOperator(o, mk(o, -1)).panelAtk, 443.08, 0.01, '海嗣 面板攻击力继承同等级浊心斯卡蒂');
  eq((o.modules || []).length, 0, '海嗣 不继承持有者模组');
}
console.log('吟游者: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
