// 中坚术师(corecaster)通用批引擎验证:无技能常态/攻速通用/连发hitMul/永续/间隔改写/火山
// 口径:E2满级 trust100 pot0 L7(levels[7]=专一档),敌人 def600 res50
// 法伤 A(atk)=max(atk*0.5, atk*0.05) → res50 下 = atk*0.5
import { calculateOperator, calcPanelStats } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DIR = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/CASTER/corecaster/';
const load = n => JSON.parse(fs.readFileSync(DIR + n + '.json', 'utf8'));
const mkFor = (o, si, sl = 7) => {
  const ph = o.phases[o.phases.length - 1];
  return { elite: 2, level: ph.maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: sl };
};
const A = atk => Math.max(atk * 0.5, atk * 0.05);
const P2 = (atk, def) => Math.max(atk - def, atk * 0.05);
const A2 = (atk, r) => Math.max(atk * (100 - r) / 100, atk * 0.05);

let pass = 0, fail = 0;
const check = (name, actual, expect, eps = 0.01) => {
  const ok = typeof actual === 'string' || typeof expect === 'string'
    ? actual === expect
    : Math.abs(actual - expect) <= eps;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} actual=${actual} expect=${expect}`);
};

// ===== 史都华德(char_210_stward):天赋铠甲突破(精2 Lv55 档 +6%)+ 强力击攻回 cycle =====
const st = load('char_210_stward');
const stPs = calcPanelStats(st, mkFor(st, -1));
const stAtk = 520 * 1.06; // raw 520(含信赖) × 天赋1.06
check('史都华德 面板atk含天赋×1.06', stPs.panelAtk, stAtk, 0.5);
check('史都华德 无技能常态DPS=A(atk)/1.6', calculateOperator(st, mkFor(st, -1)).normalDps, A(stAtk) / 1.6, 0.01);
const stS1 = calculateOperator(st, mkFor(st, 0));
const stHit = A(stAtk * 1.9);
check('史都华德 S1触发单发=1.9×atk法伤', stS1.skillTotalDamage, stHit, 0.01);
// 攻回 sp4:4 次普攻充能+1 触发=5 击/8s
check('史都华德 S1 cycleDPS', stS1.cycleDps, (4 * A(stAtk) + stHit) / 8, 0.01);

// ===== 杜林(char_501_durin)/GALLUS²(char_4227_gallus):无技能常态法伤 =====
const du = load('char_501_durin');
check('杜林 常态DPS=A(370)/1.6', calculateOperator(du, mkFor(du, -1)).normalDps, A(370) / 1.6, 0.01);
const ga = load('char_4227_gallus');
check('GALLUS² 常态DPS=A(296)/1.6', calculateOperator(ga, mkFor(ga, -1)).normalDps, A(296) / 1.6, 0.01);

// ===== 夜烟(char_141_nights):S1攻击强化(通用atk)/S2赤色之瞳(atk+攻速) =====
const ni = load('char_141_nights');
const niS2 = calculateOperator(ni, mkFor(ni, 1));
// L7档 atk+60%? 实测 11091.75/25s dur=16击floor(25/1.6);间隔1.0667=1.6×100/150→攻速+50
check('夜烟 S2 间隔=1.6×100/150', niS2.realInterval, 1.6 * 100 / 150, 0.001);
// 命中减抗天赋(黑色迷雾 E2 -20%,先效果再命中):法抗 50→40
check('夜烟 S2 技能期总伤(攻速+攻强+减抗)', niS2.skillTotalDamage, 13310.1, 0.01);
const niS1 = calculateOperator(ni, mkFor(ni, 0));
check('夜烟 S1 总伤(减抗res40)', niS1.skillTotalDamage, 9259.2, 0.01);

// ===== 雪绒S1寒风/特米米S1部族技艺/阿米娅S1战术咏唱:攻速通用(间隔0.941) =====
const qa = load('char_466_qanik');
check('雪绒 S1 间隔 0.941', calculateOperator(qa, mkFor(qa, 0)).realInterval, 0.941176, 0.001);
  const qaPs = calcPanelStats(qa, mkFor(qa, 0));
  check('雪绒 S1 常态DPS=A(面板atk)/1.6(间隔不随技能)', calculateOperator(qa, mkFor(qa, 0)).normalDps, A(qaPs.panelAtk) / 1.6, 0.01);
const to = load('char_411_tomimi');
check('特米米 S1 间隔 0.941', calculateOperator(to, mkFor(to, 0)).realInterval, 0.941176, 0.001);
// 荒野法术:技能开启期普攻变物理 + atk+100%(E2),31击×P(635×2.0);常态法伤不受影响
const toS1 = calculateOperator(to, mkFor(to, 0));
check('特米米 S1 damageType=physical(技能期切物理)', toS1.damageType, 'physical');
check('特米米 S1 总伤=31击×P(635×2.0)', toS1.skillTotalDamage, 31 * P2(635 * 2.0, 600), 0.01);
check('特米米 S1 技能期ATK=×2.0', toS1.panelAtk, 635 * 2.0, 0.01);
// 常态不改:非技能期仍是职业法术普攻(荒野法术仅技能开启时生效);间隔用基础(面板)间隔,不含技能期攻速
check('特米米 S1 常态DPS=A(635)/1.6(法术,不含技能期攻速)', toS1.normalDps, A(635) / 1.6, 0.01);
check('特米米 S1 常态类型=arts', toS1.normalDamageType, 'arts');
const toS2 = calculateOperator(to, mkFor(to, 1));
check('特米米 S2 damageType=physical(技能期切物理)', toS2.damageType, 'physical');
check('特米米 S2 常态DPS=A(635)/1.6(法术)', toS2.normalDps, A(635) / 1.6, 0.01);
check('特米米 S2 常态类型=arts', toS2.normalDamageType, 'arts');
const am = load('char_002_amiya');
check('阿米娅 S1 间隔 0.941', calculateOperator(am, mkFor(am, 0)).realInterval, 0.941176, 0.001);

// ===== 阿米娅 S2 精神爆发:25s AUTO 每击 8连发×0.5=4×atk =====
const amS2 = calculateOperator(am, mkFor(am, 1));
const amHits = Math.floor(25 / 1.6); // 15
check('阿米娅 S2 总伤=15击×4×A(atk)', amS2.skillTotalDamage, amHits * 4 * A(682), 0.01);
check('阿米娅 S2 damageType=arts', amS2.damageType, 'arts');

// ===== 苦艾(char_405_absin):S1执法模式 isPermanent atk+70% / S2终结连射 4连发×0.8 =====
const ab = load('char_405_absin');
const abS1 = calculateOperator(ab, mkFor(ab, 0));
check('苦艾 S1 永续DPS=A(atk×1.7)/1.6', abS1.skillDps, A(703 * 1.7) / 1.6, 0.01);
const abS2 = calculateOperator(ab, mkFor(ab, 1));
const abHits = Math.floor(28 / 1.6); // 17
check('苦艾 S2 总伤=17击×3.2×A(atk)', abS2.skillTotalDamage, abHits * 3.2 * A(703), 0.01);

// ===== 刻俄柏(char_2013_cerber):剥壳每击按敌方防御附加法伤(E2 40%×def 过法抗,600防 res50=120/击) =====
const ce = load('char_2013_cerber');
const ceNone = calculateOperator(ce, mkFor(ce, -1));
check('刻俄柏 常态nDps=A(757)/1.6+剥壳120/1.6', ceNone.normalDps, (A(757) + 120) / 1.6, 0.01);
const ceS1 = calculateOperator(ce, mkFor(ce, 0));
check('刻俄柏 S1 触发单发=A(1.9×atk)+剥壳', ceS1.skillTotalDamage, A(757 * 1.9) + 120, 0.01);
const ceS2 = calculateOperator(ce, mkFor(ce, 1));
check('刻俄柏 S2 间隔=1.6×0.36', ceS2.realInterval, 0.576, 0.001);
check('刻俄柏 S2 总伤=64击×(A(757)+剥壳120)', ceS2.skillTotalDamage, 64 * (A(757) + 120), 0.01);
check('刻俄柏 S2 DPS=总伤/37', ceS2.skillDps, 64 * (A(757) + 120) / 37, 0.01);
const ceS3 = calculateOperator(ce, mkFor(ce, 2));
check('刻俄柏 S3 damageType=physical(切物理)', ceS3.damageType, 'physical');
check('刻俄柏 S3 物理档=36击×P(2.75×atk)', ceS3.dmgTypes.physical.skillTotalDamage, 36 * P2(757 * 2.75, 600), 0.01);
check('刻俄柏 S3 剥壳档=36击×120独立arts', ceS3.dmgTypes.arts.skillTotalDamage, 36 * 120, 0.01);
check('刻俄柏 S3 总伤=物理+剥壳', ceS3.skillTotalDamage, 36 * P2(757 * 2.75, 600) + 36 * 120, 0.01);
// X 模组「很干的面包」(uniequip_002)L2/L3:剥壳基础档提升+连续攻击逐击递增至 max(单目标模型逐击,技能期);常态/无界取稳态上限
const ceX2 = (si) => calculateOperator(ce, { ...mkFor(ce, si), module: { moduleId: 'uniequip_002_cerber', moduleLevel: 2 } });
const ceX3 = (si) => calculateOperator(ce, { ...mkFor(ce, si), module: { moduleId: 'uniequip_002_cerber', moduleLevel: 3 } });
// X2 模组白值 atk+55 → panelAtk 812;S2 普攻 64×A(812) + 剥壳逐击 Σmin(0.45+0.05i,0.7)×300 (600防×法伤0.5)
const ceX2Ps = calcPanelStats(ce, { ...mkFor(ce, 1), module: { moduleId: 'uniequip_002_cerber', moduleLevel: 2 } });
check('刻俄柏 X2 模组白值 atk=812', ceX2Ps.panelAtk, 812, 0.01);
let x2Shell = 0; for (let i = 0; i < 64; i++) x2Shell += 300 * Math.min(0.45 + 0.05 * i, 0.7);
const ceX2S2 = ceX2(1);
check('刻俄柏 X2 S2 总伤=64×A(812)+剥壳逐击', ceX2S2.skillTotalDamage, 64 * A(812) + x2Shell, 0.01);
const ceX2S3 = ceX2(2);
check('刻俄柏 X2 S3 物理档=36×P(812×2.75)', ceX2S3.dmgTypes.physical.skillTotalDamage, 36 * P2(812 * 2.75, 600), 0.01);
let x2ShellS3 = 0; for (let i = 0; i < 36; i++) x2ShellS3 += 300 * Math.min(0.45 + 0.05 * i, 0.7);
check('刻俄柏 X2 S3 剥壳档=36击逐击', ceX2S3.dmgTypes.arts.skillTotalDamage, x2ShellS3, 0.01);
const ceX2None = ceX2(-1);
check('刻俄柏 X2 常态nDps=(A(812)+剥壳上限210)/1.6', ceX2None.normalDps, (A(812) + 210) / 1.6, 0.01);
// X3 白值 atk+65 → 822;上限 225(0.75)
const ceX3Ps = calcPanelStats(ce, { ...mkFor(ce, 1), module: { moduleId: 'uniequip_002_cerber', moduleLevel: 3 } });
check('刻俄柏 X3 模组白值 atk=822', ceX3Ps.panelAtk, 822, 0.01);
const ceX3S3 = ceX3(2);
let x3ShellS3 = 0; for (let i = 0; i < 36; i++) x3ShellS3 += 300 * Math.min(0.5 + 0.05 * i, 0.75);
check('刻俄柏 X3 S3 剥壳档=逐击至75%', ceX3S3.dmgTypes.arts.skillTotalDamage, x3ShellS3, 0.01);
const ceX3None = ceX3(-1);
check('刻俄柏 X3 常态nDps=(A(822)+225)/1.6', ceX3None.normalDps, (A(822) + 225) / 1.6, 0.01);

// ===== 艾雅法拉 S3 火山:atk+100% 间隔-1.1→0.5s(通用引擎通道,技能期随天赋炎息×2.14) =====
const ey = load('char_180_amgoat');
const eyS3 = calculateOperator(ey, mkFor(ey, 2));
check('艾雅法拉 S3 间隔 0.5s', eyS3.realInterval, 0.5, 0.001);
check('艾雅法拉 S3 总伤=30击×A(735×2.14)', eyS3.skillTotalDamage, 30 * A(735 * 2.14), 0.01);

// ===== 艾雅法拉 S1 二重咏唱(默认第二次口径:攻速+50 且 atk+50%)/S2 点燃(fk 3.3+减抗等效常驻) =====
const eyS1 = calculateOperator(ey, mkFor(ey, 0));
check('艾雅法拉 S1 间隔=1.6×100/150', eyS1.realInterval, 1.066667, 0.001);
// 技能期 atk=735×(1+0.14炎息+0.5技能)=1205.4,23 击
check('艾雅法拉 S1 总伤=23击×A(1205.4)', eyS1.skillTotalDamage, 23 * A(1205.4), 0.01);
const eyS2 = calculateOperator(ey, mkFor(ey, 1));
// 点燃:单发=3.3×raw735×(1+0.14炎息) 按 res×0.8;cycle=自然回 6s(3 普攻+1 点燃均 res×0.8)
check('艾雅法拉 S2 点燃单发=fk3.3×atk(res40)', eyS2.skillTotalDamage, A2(735 * 1.14 * 3.3, 40), 0.01);
check('艾雅法拉 S2 cycleDPS', eyS2.cycleDps, (3 * A2(735 * 1.14, 40) + A2(735 * 1.14 * 3.3, 40)) / 6, 0.01);

// ===== 阿米娅 S3 奇美拉(技能期强制真伤,atk+180% 真伤普攻 18 击) =====
const amS3 = calculateOperator(am, mkFor(am, 2));
check('阿米娅 S3 damageType=true', amS3.damageType, 'true');
check('阿米娅 S3 总伤=18击×2.8×atk真伤', amS3.skillTotalDamage, 18 * 682 * 2.8, 0.01);

// ===== GALLUS² 天赋落地被动(虚拟 PASSIVE dur30:部署后20s内攻击使目标法抗-15%,buff持续10s覆盖到第30s,窗口30s→res42.5) =====
const gaS = calculateOperator(ga, mkFor(ga, 0));
check('GALLUS² 天赋技能位 总伤=18击×A(296,42.5)', gaS.skillTotalDamage, 18 * A2(296, 42.5), 0.01);
check('GALLUS² 天赋技能期DPS=总伤/30s', gaS.skillDps, 18 * A2(296, 42.5) / 30, 0.01);

// ===== 逻各斯 S2 提喻(char_4133_logos):锁定单体每0.5s一跳,线性递增 base0.6+0.12/跳至10层1.8封顶 =====
const lg2 = load('char_4133_logos');
const lg2R = calculateOperator(lg2, mkFor(lg2, 1));
let lg2Tot = 0;
for (let j = 0; j < 40; j++) lg2Tot += A(761 * (0.6 + 0.12 * Math.min(j, 10)));
check('逻各斯 S2 跳间隔0.5s', lg2R.realInterval, 0.5, 0.001);
check('逻各斯 S2 总伤=40跳线性递增', lg2R.skillTotalDamage, lg2Tot, 0.01);
check('逻各斯 S2 DPS=总伤/20', lg2R.skillDps, lg2Tot / 20, 0.01);

// ===== 霍尔海雅 S2 群星逶迤(char_4027_heyak):普攻变9连发,浮空概率不计 =====
const hyS2op = load('char_4027_heyak');
const hyS2 = calculateOperator(hyS2op, mkFor(hyS2op, 1));
check('霍尔海雅 S2 总伤=10动作×9发×A(0.38×atk)', hyS2.skillTotalDamage, 90 * A(723 * 0.38), 0.01);
check('霍尔海雅 S2 DPS=总伤/16', hyS2.skillDps, 90 * A(723 * 0.38) / 16, 0.01);

// ===== 霍尔海雅 S3 博览者的狂语(char_4027_heyak):旋风取行进距离最低档 min_atk_scale(M1 2.67),天赋空中增伤不常驻不计,间隔+1.4→3.0s =====
const hy = load('char_4027_heyak');
const hyPs = calcPanelStats(hy, mkFor(hy, -1));
check('霍尔海雅 E2 面板atk', hyPs.panelAtk, 723, 0.01);
const hyNone = calculateOperator(hy, mkFor(hy, -1));
check('霍尔海雅 常态普攻(空中增伤不计)', hyNone.normalDps, A(723) / 1.6, 0.01);
const hyS3 = calculateOperator(hy, mkFor(hy, 2));
check('霍尔海雅 S3 间隔=1.6+1.4=3.0', hyS3.realInterval, 3.0, 0.001);
check('霍尔海雅 S3 总伤=15击×A(2.67×atk)', hyS3.skillTotalDamage, 15 * A(723 * 2.67), 0.01);
check('霍尔海雅 S3 DPS=总伤/45', hyS3.skillDps, 15 * A(723 * 2.67) / 45, 0.01);


// ===== 雪绒 Y3 冰原生存法脆 1.2→1.28(pot0档,技能期攻击含白值+50=745) =====
const qY3 = calculateOperator(qa, { ...mkFor(qa, 1), module: { moduleId: qa.modules.find(x => x.typeName2 === 'Y').id, moduleLevel: 3 } });
check('雪绒S2 Y3 技能期攻击=745(白值+50)', qY3.panelAtk, 745, 0.01);
// 14跳×A(0.65×745)×1.28 + 落地A(2.5×745)不吃法脆
check('雪绒S2 Y3 总伤=14跳法脆1.28+落地', qY3.skillTotalDamage, 14 * A(0.65 * 745) * 1.28 + A(2.5 * 745), 0.5);
const toY3 = calculateOperator(to, { ...mkFor(to, 0), module: { moduleId: to.modules.find(x => x.typeName2 === 'Y').id, moduleLevel: 3 } });
// 荒野法术 atk+100%(pot0 精2)→Y3 te +110%(1.1),面板685(白值+50):skillAtk=685×2.1=1438.5
check('特米米S1 Y3 技能期攻击=685×2.1', toY3.panelAtk, 685 * 2.1, 0.5);
check('特米米S1 Y3 总伤=31击×P(1438.5)', toY3.skillTotalDamage, 31 * Math.max(1438.5 - 600, 1438.5 * 0.05), 1);

// ===== 雪绒 S2 坠雪(char_466_qanik):停攻,每0.5s 0.65×atk(M1)法伤×14跳(浮空吃冰原生存法脆×1.2)+浮空结束坠落一次2.5×atk(不吃) =====
const qkS2 = calculateOperator(qa, mkFor(qa, 1));
const qkPer = A(695 * 0.65) * 1.2;   // E2 法脆 1.2
const qkEnd = A(695 * 2.5);
check('雪绒 S2 每跳=A(0.65×atk)×1.2法脆', qkPer, 271.05, 0.01);
check('雪绒 S2 总伤=14跳+坠落1次', qkS2.skillTotalDamage, qkPer * 14 + qkEnd, 0.01);
check('雪绒 S2 DPS=总伤/7', qkS2.skillDps, (qkPer * 14 + qkEnd) / 7, 0.01);
check('雪绒 S2 停攻无常态行', qkS2.normalDps, null);
check('雪绒 S2 跳间隔0.5s', qkS2.realInterval, 0.5, 0.001);

// ===== 夜魔(char_164_nightm):S1 灵魂汲取(法伤+每击 0.8×atk 治疗,治疗基值=攻击力非伤害)/S2 梦魇归常态/天赋按装备技能 =====
const nt = load('char_164_nightm');
const ntS1 = calculateOperator(nt, mkFor(nt, 0));
// 60s/1.6=37击;每击 A(692);治疗 0.8×692/击
check('夜魔 S1 总伤=37击×A(692)', ntS1.skillTotalDamage, 37 * A(692), 0.01);
check('夜魔 S1 技能期HPS=0.8×atk/1.6', ntS1.skillHps, 0.8 * 692 / 1.6, 0.01);
check('夜魔 S1 总治疗=0.8×atk×37击', ntS1.totalHeal, 0.8 * 692 * 37, 0.01);
const ntS2 = calculateOperator(nt, mkFor(nt, 1));
// S2 归常态(移动真伤不计);装 S2 时天赋表里人格 atk+15%(精2)→面板 692×1.15
check('夜魔 S2 面板atk含天赋×1.15(装备S2)', ntS2.panelAtk, 692 * 1.15, 0.01);
check('夜魔 S2 归常态 nDps=A(atk×1.15)/1.6', ntS2.normalDps, A(692 * 1.15) / 1.6, 0.01);
const ntS1a = calculateOperator(nt, mkFor(nt, 0));
check('夜魔 S1 面板无天赋加成(装S1为闪避向)', ntS1a.panelAtk, 692, 0.01);

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
