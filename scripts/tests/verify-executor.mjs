// 处决者(executor,特种)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50
// 口径(2026-09-18 用户拍板 5 条):
//   1) 计入 Y 模组特性「周围四格没有友方干员时攻击力+10%」——数据驱动读 module.traitEnhance 的无名
//      blackboard.atk(与 talentEnhance 天赋增强分属不同字段,不重复计天赋);「单打独斗、周围无友军」默认成立。
//   2) 麒麟R夜刀「术法充盈」叠层(2026-09-18 修正):先结算攻击增幅、再结算伤害 → 第 k 击吃 k 层(首击即 1 层),
//      落地技能窗口逐击叠层 → 按窗口平均取收益(非叠满);常态列仍按稳态叠满。
//      窗口平均等效倍率 = 1 + up × mean_{k=1..N} min(k, cap)(up=0.05)。
//   3) 红:维持原口径(刺骨下限;闪避不计)。
//   4) 缄默德克萨斯 S1「细雨无声」DOT 尾伤(技能结束后仍残留 duration 8s/10s)计入技能期总伤;
//      技能期 DPS = 总伤 /(skillDuration + dotDuration)。
//   5) 傀影召唤物「镜中虚影」token_10007_phatom_twin 入库(自身 phases/skills/talents,owner=char_250_phatom)。
//   其余:9 人技能全为 spType 8「落地/限时被动」;概率/条件类(闪避、槐琥红眉咏春/除害杂役、弑君者威名、
//   傀影 Y 本体+虚影同时在场)不计。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const INDEX = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
function loadOp(id) {
  const e = INDEX.find((x) => x.id === id);
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

// ---- 红(char_144_red):S1 限时被动 +70%/10s;S2 落地 210% 物理;天赋「刺骨」攻击伤害下限 ----
// 口径 3:维持现状(刺骨下限照计;S1 闪避不计)。
{
  const o = loadOp('char_144_red');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'physical', '红 常态伤害类型=物理');
  near(r0.panelAtk, 605, 0.01, '红 面板攻击力');
  near(r0.normalDps, 195.161, 0.05, '红 常态 DPS(刺骨下限 30%×605=181.5)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.panelAtk, 1028.5, 0.01, '红 S1 技能期攻击力(+70%)');
  near(s1.realInterval, 0.93, 0.001, '红 S1 攻击间隔');
  near(s1.skillTotalDamage, 4285, 0.5, '红 S1 总伤(11 击×428.5,下限 30%×1028.5)');
  near(s1.skillDps, 428.5, 0.1, '红 S1 技能期 DPS');
  near(s1.normalDps, 195.161, 0.05, '红 S1 常态普攻保留');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.panelAtk, 1270.5, 0.01, '红 S2 落地攻击力(210%)');
  near(s2.skillTotalDamage, 670.5, 0.5, '红 S2 总伤(单目标 1 次)');
  near(s2.skillDps, 720.968, 0.1, '红 S2 技能期 DPS(时长=1×间隔)');
  near(s2.normalDps, 195.161, 0.05, '红 S2 常态普攻保留');
  // 口径 1:Y 模组特性 +10% 计入 → 面板/常态/技能整体 ×1.1(相对无模组同项)
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_red', 3)));
  near(y3.panelAtk, 746.9, 0.01, '红 Y3 面板攻击力((605+74)×1.1)');
  near(y3.normalDps, 334.097, 0.05, '红 Y3 常态 DPS(刺骨下限 40% + 白值 atk74/攻速4 + 特性 +10%)');
  const y3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_red', 3)));
  near(y3s1.panelAtk, 1269.73, 0.01, '红 Y3 S1 技能期攻击力(746.9×1.7)');
  near(y3s1.skillTotalDamage, 7367.03, 0.5, '红 Y3 S1 总伤(下限 40% + 特性 +10%)');
  const y3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_red', 3)));
  near(y3s2.skillTotalDamage, 968.49, 0.5, '红 Y3 S2 总伤(特性 +10%)');
}

// ---- 缄默德克萨斯(char_1028_texas2):T0 被动技能持续期间 +20%;S1 DOT 尾伤;S2 减抗+二连法伤;S3 剑雨 ----
// 口径 4:S1「细雨无声」DOT(dot_damage 350/s,沉默 duration 8s)技能期 12s 全程 + 尾伤 8s = 20s 计入。
{
  const o = loadOp('char_1028_texas2');
  near(calculateOperator(o, mk(o, -1)).normalDps, 63.441, 0.05, '德克萨斯 常态 DPS(击倒前攻速不计)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.panelAtk, 1186.2, 0.01, '德克萨斯 S1 技能期攻击力(+60% + 天赋 20%)');
  near(s1.skillTotalDamage, 10534.4, 0.5, '德克萨斯 S1 总伤(12 击物理 + DOT 175×20)');
  near(s1.skillDps, 526.72, 0.1, '德克萨斯 S1 技能期 DPS(总伤/20s)');
  near(s1.dmgTypes.physical.skillTotalDamage, 7034.4, 0.5, '德克萨斯 S1 物理段(11 击)');
  near(s1.dmgTypes.arts.skillTotalDamage, 3500, 0.5, '德克萨斯 S1 DOT 段(350/s 法伤 ×20s:技能 12s + 尾伤 8s)');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.damageType, 'arts', '德克萨斯 S2 伤害类型=法术');
  near(s2.panelAtk, 1087.35, 0.01, '德克萨斯 S2 技能期攻击力(+45%+天赋)');
  near(s2.skillTotalDamage, 14951.063, 1, '德克萨斯 S2 总伤(落地 200% 法伤 + 20 击法伤,先减抗 25%)');
  near(s2.skillDps, 1495.106, 0.2, '德克萨斯 S2 技能期 DPS');
  const s3 = calculateOperator(o, mk(o, 2));
  eq(s3.damageType, 'arts', '德克萨斯 S3 伤害类型=法术');
  near(s3.skillTotalDamage, 4112.16, 0.5, '德克萨斯 S3 总伤(落地 2×135% + 7 跳剑雨 110%)');
  near(s3.skillDps, 587.451, 0.1, '德克萨斯 S3 技能期 DPS');
  const y3 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_texas2', 3)));
  near(y3.panelAtk, 1497.232, 0.01, '德克萨斯 Y3 S1 攻击力(天赋升至 28% + 特性 +10%)');
  near(y3.skillTotalDamage, 14266.784, 1, '德克萨斯 Y3 S1 总伤(含 DOT 尾伤)');
  near(y3.dmgTypes.arts.skillTotalDamage, 3500, 0.5, '德克萨斯 Y3 S1 DOT 段(仍 350×20)');
  // X 模组无 atk 特性 → 不受口径 1 影响
  const x3 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_003_texas2', 3)));
  near(x3.skillTotalDamage, 12024.8, 1, '德克萨斯 X3 S1 总伤(无 atk 特性,不变)');
}

// ---- 麒麟R夜刀(char_1029_yato2):T0 每击附加法伤;T1 技能期 +13%;S1 2-2-6 连击;S2/S3 倍率兼第一天赋 ----
// 口径 2:Y 模组「术法充盈」按技能窗口逐击叠层取平均(先结算增幅再出伤 → 第 k 击吃 k 层,首击即 1 层)。
{
  const o = loadOp('char_1029_yato2');
  near(calculateOperator(o, mk(o, -1)).normalDps, 129.57, 0.05, '夜刀 常态 DPS(普攻 + 天赋 20% 法伤)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.realInterval, 0.5167, 0.001, '夜刀 S1 攻击间隔(攻速 +80)');
  near(s1.panelAtk, 740.15, 0.01, '夜刀 S1 技能期攻击力(天赋 13%)');
  near(s1.skillTotalDamage, 20131.51, 2, '夜刀 S1 总伤(20s 共 94 击:4 间隔 10 击)');
  near(s1.skillDps, 1006.575, 0.2, '夜刀 S1 技能期 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 9904.433, 1, '夜刀 S2 总伤(16 斩击物理 + 天赋 ×2.97 法伤)');
  near(s2.skillDps, 665.62, 0.2, '夜刀 S2 技能期 DPS(时长=16×间隔)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillTotalDamage, 25571.928, 2, '夜刀 S3 总伤(突进 5 格/0.3 = 16 段)');
  near(s3.skillDps, 1718.544, 0.3, '夜刀 S3 技能期 DPS');
  const x3 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_yato2', 3)));
  near(x3.panelAtk, 843.6, 0.01, '夜刀 X3 S1 攻击力(技能期额外 +5%)');
  near(x3.skillTotalDamage, 30828.24, 2, '夜刀 X3 S1 总伤(X 模组无术法充盈/无 atk 特性)');
  // 窗口平均等效倍率(口径 2,修正后):第 k 击吃 k 层 → 1 + up×mean_{k=1..N} min(k,cap)
  const windowMul = (up, cap, N) => { let su = 0; for (let k = 1; k <= N; k++) su += Math.min(k, cap); return 1 + up * (su / N); };
  near(windowMul(0.05, 10, 16), 1.359375, 1e-9, '夜刀 Y3 窗口平均等效倍率(S2/S3 16 击,cap10;叠满为 1.5)');
  near(windowMul(0.05, 10, 94), 1.476064, 1e-6, '夜刀 Y3 窗口平均等效倍率(S1 94 击)');
  near(windowMul(0.05, 7, 16), 1.284375, 1e-9, '夜刀 Y2 窗口平均等效倍率(S2/S3,cap7)');
  near(windowMul(0.05, 7, 94), 1.338830, 1e-6, '夜刀 Y2 窗口平均等效倍率(S1)');
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_003_yato2', 3)));
  near(y3.normalDps, 345.06, 0.05, '夜刀 Y3 常态 DPS(天赋 25% + 充盈稳态叠满 ×1.5 + 特性 +10%)');
  const y3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_003_yato2', 3)));
  near(y3s1.skillTotalDamage, 41172.198, 3, '夜刀 Y3 S1 总伤(窗口平均 ×1.476064)');
  const y3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_003_yato2', 3)));
  near(y3s2.skillTotalDamage, 16404.374, 3, '夜刀 Y3 S2 总伤(窗口平均 ×1.359375,非叠满 1.5)');
  const y3s3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_003_yato2', 3)));
  near(y3s3.skillTotalDamage, 34689.508, 3, '夜刀 Y3 S3 总伤(窗口平均 ×1.359375)');
}

// ---- 弑君者(char_1502_crosly):S1 +85%;S2 停攻 8s 结束爆发 400%;S3 每 6s 2 击×210% ----
{
  const o = loadOp('char_1502_crosly');
  near(calculateOperator(o, mk(o, -1)).normalDps, 37.634, 0.05, '弑君者 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.panelAtk, 1174.75, 0.01, '弑君者 S1 技能期攻击力(+85%)');
  near(s1.skillTotalDamage, 5747.5, 0.5, '弑君者 S1 总伤(11 击)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.panelAtk, 2540, 0.01, '弑君者 S2 结束爆发攻击力(400%)');
  near(s2.skillTotalDamage, 1940, 0.5, '弑君者 S2 总伤(结束时 1 次 400% 物理)');
  near(s2.skillDps, 242.5, 0.1, '弑君者 S2 技能期 DPS(时长 8s)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillTotalDamage, 4401, 0.5, '弑君者 S3 总伤(同目标每 6s 触发,16s 共 3 次×2 击)');
  near(s3.skillDps, 275.063, 0.1, '弑君者 S3 技能期 DPS');
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_003_crosly', 3)));
  near(y3.panelAtk, 795.3, 0.01, '弑君者 Y3 面板攻击力(635+88)×1.1');
  near(y3.normalDps, 210, 0.05, '弑君者 Y3 常态 DPS(特性 +10%)');
  const y3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_003_crosly', 3)));
  near(y3s1.skillTotalDamage, 8713.05, 0.5, '弑君者 Y3 S1 总伤(特性 +10%)');
  const y3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_003_crosly', 3)));
  near(y3s2.skillTotalDamage, 2581.2, 0.5, '弑君者 Y3 S2 总伤(威名 35% 不计,仅白值 + 特性 +10%)');
}

// ---- 傀影(char_250_phatom):S1 无输出;S2 9 层攻击力 +17%;S3 落地 260% ----
{
  const o = loadOp('char_250_phatom');
  near(calculateOperator(o, mk(o, -1)).normalDps, 51.613, 0.05, '傀影 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.skillDps, 0, '傀影 S1 技能期 DPS 0(闪避/屏障无输出)');
  eq(s1.skillTotalDamage, 0, '傀影 S1 总伤 0');
  near(s1.normalDps, 51.613, 0.05, '傀影 S1 常态普攻保留');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.panelAtk, 1639.44, 0.01, '傀影 S2 首击攻击力(9 层 +17%)');
  near(s2.skillTotalDamage, 5389.2, 0.5, '傀影 S2 总伤(9 击逐层 9→1)');
  near(s2.skillDps, 643.871, 0.1, '傀影 S2 技能期 DPS(时长=9×间隔)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillTotalDamage, 1084.8, 0.5, '傀影 S3 总伤(落地 260% 物理)');
  const y3 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_003_phatom', 3)));
  eq(y3.skillTotalDamage, 0, '傀影 Y3 S1 总伤仍 0');
  const y3n = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_003_phatom', 3)));
  near(y3n.panelAtk, 795.3, 0.01, '傀影 Y3 面板攻击力((648+75)×1.1)');
  near(y3n.normalDps, 210, 0.05, '傀影 Y3 常态 DPS(特性 +10%)');
  const y3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_003_phatom', 3)));
  near(y3s2.skillTotalDamage, 7841.745, 1, '傀影 Y3 S2 总伤(特性 +10%)');
  const y3s3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_003_phatom', 3)));
  near(y3s3.skillTotalDamage, 1467.78, 0.5, '傀影 Y3 S3 总伤(特性 +10%)');
}

// ---- 卡夫卡(char_214_kafka):T0 被动触发期间 +15%;S1 停攻 5s 结束 380% 法伤;S2 落地 330% + 13s 法伤 ----
{
  const o = loadOp('char_214_kafka');
  near(calculateOperator(o, mk(o, -1)).normalDps, 28.226, 0.05, '卡夫卡 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.damageType, 'arts', '卡夫卡 S1 伤害类型=法术');
  near(s1.panelAtk, 603.75, 0.01, '卡夫卡 S1 攻击力(天赋 +15%)');
  near(s1.skillTotalDamage, 1147.125, 0.5, '卡夫卡 S1 总伤(结束 380% 法伤)');
  near(s1.skillDps, 229.425, 0.1, '卡夫卡 S1 技能期 DPS(时长 5s)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 4920.563, 1, '卡夫卡 S2 总伤(落地 330% + 13 击法伤)');
  near(s2.skillDps, 378.505, 0.1, '卡夫卡 S2 技能期 DPS(时长 13s)');
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_kafka', 3)));
  near(y3.panelAtk, 643.5, 0.01, '卡夫卡 Y3 面板攻击力((525+60)×1.1)');
  near(y3.normalDps, 46.774, 0.05, '卡夫卡 Y3 常态 DPS(特性 +10%)');
  const y3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_kafka', 3)));
  near(y3s2.skillTotalDamage, 6555.656, 1, '卡夫卡 Y3 S2 总伤(天赋 +25% + 特性 +10%)');
}

// ---- 槐琥(char_243_waaifu)/砾(char_237_gravel)/THRM-EX:数据无 Y 模组(仅 X/无) → 特性 +10% 不适用,数值不变 ----
{
  const o = loadOp('char_243_waaifu');
  near(calculateOperator(o, mk(o, -1)).normalDps, 31.505, 0.05, '槐琥 常态 DPS(红眉咏春概率增幅不计)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.panelAtk, 937.6, 0.01, '槐琥 S1 技能期攻击力(+60%)');
  near(s1.skillTotalDamage, 3376, 0.5, '槐琥 S1 总伤(11 击)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 894.3, 0.5, '槐琥 S2 总伤(落地 255% 物理)');
  const x3 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_waaifu', 3)));
  near(x3.skillTotalDamage, 4416, 0.5, '槐琥 X3 S1 总伤(仅白值,除害杂役不计;无 Y 模组)');

  const og = loadOp('char_237_gravel');
  near(calculateOperator(og, mk(og, -1)).normalDps, 24.301, 0.05, '砾 常态 DPS');
  eq(calculateOperator(og, mk(og, 0)).skillTotalDamage, 0, '砾 S1 总伤 0(纯防御)');
  eq(calculateOperator(og, mk(og, 1)).skillDps, 0, '砾 S2 技能期 DPS 0(屏障)');
  near(calculateOperator(og, mk(og, 1)).normalDps, 24.301, 0.05, '砾 S2 常态普攻保留');

  const ot = loadOp('char_376_therex');
  const r = calculateOperator(ot, mk(ot, -1));
  eq(r.deploySkill, true, 'THRM-EX 应标记 deploySkill(落地点火)');
  eq(r.damageType, 'physical', 'THRM-EX 伤害类型=物理');
  near(r.skillTotalDamage, 450, 0.5, 'THRM-EX 落地自爆总伤(300%×350 - def600)');
  near(r.skillDps, 483.871, 0.1, 'THRM-EX 技能期 DPS(时长=1×间隔)');
  near(r.normalDps, 18.817, 0.05, 'THRM-EX 常态普攻 DPS');
}

// ---- 傀影召唤物「镜中虚影」(token_10007_phatom_twin)入库:自身面板/技能,owner=char_250_phatom ----
{
  const at = INDEX.findIndex((x) => x.id === 'char_250_phatom');
  eq(INDEX[at + 1] && INDEX[at + 1].id, 'token_10007_phatom_twin', '镜中虚影 索引紧随 char_250_phatom');
  const o = loadOp('token_10007_phatom_twin');
  eq(o.ownerOperatorId, 'char_250_phatom', '镜中虚影 owner=char_250_phatom');
  eq(o.profession, 'TOKEN', '镜中虚影 职业=TOKEN');
  eq(o.subProfessionId, 'executor', '镜中虚影 子职业=executor');
  eq((o.skills || []).length, 3, '镜中虚影 自身技能 3 个(sktok_phatom_1/2/3)');
  eq(o.skills[1].skillId, 'sktok_phatom_2', '镜中虚影 S2=血色乐章');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 548, 0.01, '镜中虚影 面板攻击力(自身 E2 Lv90=548)');
  near(r0.normalDps, 29.462, 0.05, '镜中虚影 常态普攻 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.skillTotalDamage, 0, '镜中虚影 S1 暗夜魅影 总伤 0(闪避/屏障)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.panelAtk, 1386.44, 0.01, '镜中虚影 S2 首击攻击力(9 层 +17%)');
  near(s2.skillTotalDamage, 3724.2, 0.5, '镜中虚影 S2 总伤(9 击逐层)');
  near(s2.skillDps, 444.946, 0.1, '镜中虚影 S2 技能期 DPS');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.panelAtk, 1424.8, 0.01, '镜中虚影 S3 攻击力(260%)');
  near(s3.skillTotalDamage, 824.8, 0.5, '镜中虚影 S3 总伤(落地 260% 物理)');
  near(s3.skillDps, 886.882, 0.1, '镜中虚影 S3 技能期 DPS');
}

// ---- 不变量:各技能槽常态化列 = 无技能态 ----
{
  const ids = ['char_144_red', 'char_1028_texas2', 'char_1029_yato2', 'char_1502_crosly', 'char_250_phatom', 'char_214_kafka', 'char_243_waaifu', 'char_237_gravel', 'char_376_therex', 'token_10007_phatom_twin'];
  for (const id of ids) {
    const o = loadOp(id);
    const mods = [null];
    for (const m of (o.modules || [])) if (m.type === 'ADVANCED') for (const lv of (m.levels || [])) mods.push(mod(o, m.id, lv.level));
    for (const mm of mods) {
      const n0 = calculateOperator(o, mk(o, -1, mm)).normalDps;
      for (let si = 0; si < (o.skills || []).length; si++) {
        const r = calculateOperator(o, mk(o, si, mm));
        near(r.normalDps, n0, 0.02, `${o.name} S${si + 1} 常态=无技能态`);
      }
    }
  }
}
console.log('处决者: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
