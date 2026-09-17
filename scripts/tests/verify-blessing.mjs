// 护佑者(blessing,辅助)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50
// 特性(7 人一致):「攻击造成法术伤害,技能开启后改为治疗友方单位(治疗量相当于 heal_scale×攻击力,基础 75%)」
// 用户口径(2026-09-18):天赋的生命回复/技力回复效果不计算(淬羽赫默「丰润羽翼」、遥「扶摇花火」);
// 召唤物(淬羽赫默的夜灯)信息在「特殊-干员附带单位」中查询。
// 结算:常态 = 法术 DPS(单目标);技能期 = 治疗 HPS = 技能期攻击力 × heal_scale ÷ 攻击间隔;
// 瞬发治疗型只记总治疗量;停止攻击型按每秒恢复;X 模组 traitEnhance 把 heal_scale 提到 100%。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const IDX = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
function loadOp(id) {
  const e = IDX.find((x) => x.id === id);
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

// ---- 淬羽赫默 ----
{
  const o = loadOp('char_1031_slent2');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.type, 'damage', '淬羽赫默 常态为法术伤害(技能开启后才改治疗)');
  near(r0.panelAtk, 522, 0.01, '淬羽赫默 面板攻击力 522');
  near(r0.normalDps, 163.125, 0.01, '淬羽赫默 常态法伤 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.type, 'heal', '淬羽赫默 S1 技能期改治疗 → heal 型');
  near(s1.skillHps, 391.5, 0.01, '淬羽赫默 S1 HPS(攻击力+60% × 75% ÷ 1.6)');
  near(s1.totalHeal, 9396, 0.5, '淬羽赫默 S1 总治疗量(25s 15 击)');
  near(s1.normalDps, 163.125, 0.01, '淬羽赫默 S1 常态 DPS 仍显示');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillHps, 342.5625, 0.01, '淬羽赫默 S2 HPS(攻速+40 → 间隔1.1429)');
  near(s2.totalHeal, 3915, 0.5, '淬羽赫默 S2 总治疗量(12s 10 击)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillHps, 318.0938, 0.01, '淬羽赫默 S3 HPS(攻击力+30%)');
  near(s3.totalHeal, 18831.15, 0.5, '淬羽赫默 S3 总治疗量(60s 37 击)');
  const x3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_slent2', 3)));
  near(x3s1.skillHps, 592, 0.01, '淬羽赫默 X3 S1 HPS(模组把特性 heal_scale 提到 100%)');
  near(calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_slent2', 3))).normalDps, 185, 0.01, '淬羽赫默 X3 常态 DPS(模组攻击+70)');
}
// ---- 遥 ----
{
  const o = loadOp('char_4202_haruka');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 535, 0.01, '遥 面板攻击力 535');
  near(r0.normalDps, 167.1875, 0.01, '遥 常态法伤 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillHps, 376.1719, 0.01, '遥 S1 HPS(攻速+50 → 间隔1.0667)');
  near(s1.totalHeal, 7222.5, 0.5, '遥 S1 总治疗量(20s 18 击)');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.isPermanent, true, '遥 S2 按第二次及以后使用计算 → 永续');
  near(s2.skillHps, 326.0156, 0.01, '遥 S2 HPS(攻击力+30% 计入,永续)');
  eq(s2.totalHeal, null, '遥 S2 总治疗量 null(永续)');
  near(s2.skillDps, 652.0313, 0.01, '遥 S2 技能期法伤 DPS(治疗时对 3 敌造成治疗量 200%,治疗目标 2 个)');
  eq(s2.skillTotalDamage, 0, '遥 S2 技能期总伤 0(永续)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillHps, 581.8125, 0.01, '遥 S3 HPS(攻击力+45%;间隔缩短至 1.0;浮空 DOT 条件类不计)');
  near(s3.totalHeal, 23272.5, 0.5, '遥 S3 总治疗量(40s 40 击)');
}
// ---- 撷英调香师 ----
{
  const o = loadOp('char_1022_flwr2');
  near(calculateOperator(o, mk(o, -1)).panelAtk, 470, 0.01, '撷英调香师 面板攻击力 470');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillHps, 0, 0.001, '撷英调香师 S1 为瞬发治疗 → 无技能期 HPS');
  near(s1.totalHeal, 3760, 0.5, '撷英调香师 S1 总治疗量(400%×攻击力,可充能 2 次)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillHps, 312.8438, 0.01, '撷英调香师 S2 HPS(限时被动 26s,攻速+42)');
  near(s2.totalHeal, 8107.5, 0.5, '撷英调香师 S2 总治疗量');}
// ---- 月禾 ----
{
  const o = loadOp('char_343_tknogi');
  near(calculateOperator(o, mk(o, -1)).panelAtk, 485, 0.01, '月禾 面板攻击力 485');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillHps, 227.3438, 0.01, '月禾 S1 HPS(仅闪避/反隐匿 → 治疗量不变)');
  near(s1.totalHeal, 7275, 0.5, '月禾 S1 总治疗量(32s 20 击)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillHps, 48.5, 0.01, '月禾 S2 HPS(停止攻击,每秒 10% 攻击力)');
  near(s2.totalHeal, 873, 0.5, '月禾 S2 总治疗量(18s)');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_tknogi', 3)));
  near(x3s2.skillHps, 53.5, 0.01, '月禾 X3 S2 HPS(模组攻击+50)');
}
// ---- 九色鹿 ----
{
  const o = loadOp('char_4019_ncdeer');
  near(calculateOperator(o, mk(o, -1)).panelAtk, 478, 0.01, '九色鹿 面板攻击力 478');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillHps, 324.8906, 0.01, '九色鹿 S1 HPS(攻击力+45%)');
  near(s1.totalHeal, 7797.375, 0.5, '九色鹿 S1 总治疗量(25s 15 击)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillHps, 313.6875, 0.01, '九色鹿 S2 HPS(攻速+40 → 间隔1.1429)');
  near(s2.totalHeal, 6094.5, 0.5, '九色鹿 S2 总治疗量(20s 17 击)');
}
// ---- 行箸 ----
{
  const o = loadOp('char_4172_xingzh');
  near(calculateOperator(o, mk(o, -1)).panelAtk, 473, 0.01, '行箸 面板攻击力 473');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillHps, 0, 0.001, '行箸 S1 为瞬发群体治疗 → 无技能期 HPS');
  near(s1.totalHeal, 1419, 0.5, '行箸 S1 总治疗量(300%×攻击力,单目标)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillHps, 406.6322, 0.01, '行箸 S2 HPS(每击治疗 + 每秒 18% 攻击力)');
  near(s2.totalHeal, 10979.0691, 0.5, '行箸 S2 总治疗量(27s 24 击)');
}
// ---- 夏栎 ----
{
  const o = loadOp('char_492_quercu');
  near(calculateOperator(o, mk(o, -1)).panelAtk, 463, 0.01, '夏栎 面板攻击力 463');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.isPermanent, true, '夏栎 S1 持续时间无限');
  near(s1.skillHps, 288.6516, 0.01, '夏栎 S1 HPS(攻击力+33%,永久型 → 不记总治疗量)');
  eq(s1.totalHeal, null, '夏栎 S1 总治疗量 null(无限持续)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillHps, 325.5469, 0.01, '夏栎 S2 HPS(攻速+50 → 间隔1.0667)');
  near(s2.totalHeal, 4861.5, 0.5, '夏栎 S2 总治疗量(15s 14 击)');
}
// ---- 夜灯(淬羽赫默的辅助无人机) ----
{
  const t = loadOp('token_10029_slent2_protrb');
  eq(t.ownerOperatorId, 'char_1031_slent2', '夜灯 ownerOperatorId = 淬羽赫默');
  const r = calculateOperator(t, mk(t, -1));
  near(r.normalDps, 0, 0.001, '夜灯 无攻击 → 常态 DPS 0');
  eq(r.normalHps, null, '夜灯 无治疗');
  eq((t.skills || []).length, 0, '夜灯 无自身技能(仅有庇护效果,不建模)');
}
console.log('护佑者: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
