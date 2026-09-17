// 无畏者(fearless/近卫)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 口径(用户 2026-09-17 给定 + 问答确认):
//   - 芙兰卡「铝热剑」无视防御(概率触发)不计算;断罪者「断罪」概率暴击不计算、「创世纪」50% 概率失败不计算(按成功档);
//     摩根「沸血先锋」坚忍不计算;止颂「苦痛专注」无视防御、「痛楚砺刃」攻击力增幅不计算;
//     莱欧斯「胆小剑助」精力充沛不计算
//   - 近战单目标场景不视为「目标被自身阻挡」→「攻击被阻挡的敌人」类效果不计算(无畏者 X 模组 115%、止颂 S3 的 190%)
//   - 耀骑士临光 S3 召唤的「耀阳」那一击为无条件效果,按单目标 1 次计入
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const D = '../../src/frontend/data/WARRIOR/fearless/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (id, si, module = null) => {
  const op = JSON.parse(fs.readFileSync(new URL(D + id + '.json', import.meta.url), 'utf8'));
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module });
};

// ---- 芙兰卡(铝热剑概率无视防御不计算;S2 概率提高到 2.5 倍同样不计算) ----
let r = run('char_106_franka', -1);
ok(near(r.panelAtk, 1011) && near(r.normalDps, 274), '芙兰卡 常态 1011/274 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_106_franka', 0);
ok(near(r.panelAtk, 1385.07) && near(r.skillTotalDamage, 24337.17) && near(r.skillDps, 695.348),
  '芙兰卡 S1 迅捷打击·γ型(+37%/攻速+35)24337.17/695.348 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_106_franka', 1);
ok(near(r.panelAtk, 1819.8) && near(r.skillTotalDamage, 21956.4) && near(r.skillDps, 813.2),
  '芙兰卡 S2 极致锋度(+80%,概率 2.5 倍不计)21956.4/813.2 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_106_franka', -1, { moduleId: 'uniequip_002_franka', moduleLevel: 3 });
ok(near(r.panelAtk, 1106) && near(r.normalDps, 337.333),
  '芙兰卡 X3 常态(仅模组白值;「攻击被阻挡敌人 115%」按口径不计)1106/337.333 实=' + r.panelAtk + '/' + r.normalDps);

// ---- 炎客(无特例技能) ----
r = run('char_131_flameb', -1);
ok(near(r.normalDps, 242), '炎客 常态 963/242 实=' + r.normalDps);
r = run('char_131_flameb', 0);
ok(near(r.skillTotalDamage, 1326) && near(r.cycleDps, 370.4), '炎客 S1(触发型 200%)1326/370.4 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_131_flameb', 1);
ok(near(r.realInterval, 1.5 / 1.35) && near(r.skillDps, 803.385), '炎客 S2(+55%/攻速+35,持续无限)803.385 实=' + r.skillDps);

// ---- 摩根(沸血先锋坚忍不计算;S1/S2 每击 170% 攻击倍率改写) ----
r = run('char_154_morgan', -1);
ok(near(r.panelAtk, 980) && near(r.normalDps, 253.333), '摩根 常态 980/253.333 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_154_morgan', 0);
ok(near(r.panelAtk, 1666) && near(r.skillTotalDamage, 8528) && near(r.skillDps, 656),
  '摩根 S1 街头好手(每击 170%,8 击)8528/656 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_154_morgan', 1);
ok(near(r.panelAtk, 1666) && near(r.skillTotalDamage, 12792) && near(r.skillDps, 710.667) && near(r.normalDps, 253.333),
  '摩根 S2 无畏招架(限时被动,每击 170%,12 击)12792/710.667 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_154_morgan', 0, { moduleId: 'uniequip_002_morgan', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 9643.2), '摩根 X3 S1(沸血先锋 min_atk 0.58 不计)9643.2 实=' + r.skillTotalDamage);

// ---- 断罪者(概率暴击/概率失败不计算;S2 为法术伤害按成功档 290%) ----
r = run('char_159_peacok', -1);
ok(near(r.panelAtk, 951) && near(r.normalDps, 234), '断罪者 常态 951/234 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_159_peacok', 0);
ok(near(r.panelAtk, 1711.8) && near(r.skillTotalDamage, 1111.8) && near(r.cycleDps, 432.96),
  '断罪者 S1 断罪(180%,5% 概率 720% 不计)1111.8/432.96 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_159_peacok', 1);
ok(r.damageType === 'arts' && near(r.panelAtk, 2757.9) && near(r.skillTotalDamage, 1378.95) && near(r.cycleDps, 305.559),
  '断罪者 S2 创世纪(法术 290%,50% 失败不计)1378.95/305.559 实=' + r.damageType + '/' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_159_peacok', 1, { moduleId: 'uniequip_002_peacok', moduleLevel: 3 });
ok(r.damageType === 'arts' && near(r.skillTotalDamage, 1494.95), '断罪者 X3 S2 1494.95 实=' + r.skillTotalDamage);

// ---- 玫兰莎 / Castle-3 / 缠丸(无特例) ----
r = run('char_208_melan', 0);
ok(near(r.panelAtk, 1204.5) && near(r.skillTotalDamage, 7858.5) && near(r.skillDps, 392.925), '玫兰莎 S1(+10%)7858.5/392.925 实=' + r.skillTotalDamage);
r = run('char_286_cast3', -1);
ok(near(r.panelAtk, 413) && near(r.normalDps, 13.767), 'Castle-3 常态(★1,无技能)413/13.767 实=' + r.panelAtk);
r = run('char_289_gyuki', 0);
ok(r.type === 'heal' && near(r.totalHeal, 1758.7), '缠丸 S1 生命回复·β型(43% 最大生命)1758.7 实=' + r.totalHeal);
r = run('char_289_gyuki', 1);
ok(near(r.panelAtk, 2015.2) && near(r.skillTotalDamage, 11321.6) && near(r.skillDps, 870.892), '缠丸 S2 恶鬼之力(+120%)11321.6/870.892 实=' + r.skillTotalDamage);

// ---- 斯卡蒂(S2 跃浪击:限时被动,scans 之前的通用修复) ----
r = run('char_263_skadi', -1);
ok(near(r.normalDps, 330), '斯卡蒂 常态 1095/330 实=' + r.normalDps);
r = run('char_263_skadi', 1);
ok(near(r.panelAtk, 2573.25) && near(r.skillTotalDamage, 35518.5) && near(r.skillDps, 1315.5) && near(r.normalDps, 330),
  '斯卡蒂 S2 跃浪击(限时被动 +135%?专一 1.35,27s)35518.5/1315.5 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_263_skadi', 2);
ok(near(r.panelAtk, 2299.5) && near(r.skillTotalDamage, 49285.5) && near(r.skillDps, 1120.125), '斯卡蒂 S3 涌潮悲歌(+110%)49285.5/1120.125 实=' + r.skillTotalDamage);

// ---- 止颂(苦痛专注/痛楚砺刃不计算;S2 二连击;S3 的被阻挡加成按口径不计) ----
r = run('char_4011_lessng', -1);
ok(near(r.panelAtk, 1129) && near(r.normalDps, 352.667), '止颂 常态 1129/352.667 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4011_lessng', 0);
ok(near(r.skillTotalDamage, 2166.05) && near(r.cycleDps, 625.508), '止颂 S1 强力击·γ型(245%)2166.05/625.508 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_4011_lessng', 1);
ok(near(r.panelAtk, 1580.6) && near(r.skillTotalDamage, 27456.8) && near(r.skillDps, 1248.036),
  '止颂 S2 虔修对决(限时被动 +40%、2 连击、22s)27456.8/1248.036 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4011_lessng', 2);
ok(near(r.skillTotalDamage, 6877) && near(r.skillDps, 343.85),
  '止颂 S3 苦修破誓(190% 属「攻击被阻挡」加成 → 按口径只算本体普攻)6877/343.85 实=' + r.skillTotalDamage);
r = run('char_4011_lessng', 1, { moduleId: 'uniequip_002_lessng', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 28632.8), '止颂 X3 S2(痛楚砺刃 +20% 不计)28632.8 实=' + r.skillTotalDamage);

// ---- 莱欧斯(精力充沛不计算;S2 停止攻击 + 结束 1 击 400%) ----
r = run('char_4142_laios', -1);
ok(near(r.panelAtk, 975) && near(r.normalDps, 250), '莱欧斯 常态 975/250 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4142_laios', 0);
ok(near(r.skillTotalDamage, 3750) && near(r.normalDps, 250), '莱欧斯 S1 胆小剑助(精力充沛 +55% 不计)3750 实=' + r.skillTotalDamage);
r = run('char_4142_laios', 1);
ok(near(r.panelAtk, 3900) && near(r.skillTotalDamage, 3300) && near(r.skillDps, 330),
  '莱欧斯 S2 威吓战法(停止攻击,结束 1 击 400%)3300/330 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4142_laios', 1, { moduleId: 'uniequip_002_laios', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 3520), '莱欧斯 Y3 S2 3520 实=' + r.skillTotalDamage);

// ---- 耀骑士临光(S3 本体物理 + 耀阳 1 击真实伤害;天赋不畏苦暗为 ★1/★2 之外的落地天赋不处理) ----
r = run('char_1014_nearl2', -1);
ok(near(r.panelAtk, 1149) && near(r.normalDps, 366), '耀骑士临光 常态 1149/366 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_1014_nearl2', 0);
ok(near(r.panelAtk, 1838.4) && near(r.skillDps, 1172.352) && r.skillTotalDamage === 0,
  '耀骑士临光 S1 灿焰长刃(持续无限,+60%/攻速+42)1172.352 实=' + r.skillDps);
r = run('char_1014_nearl2', 1);
ok(near(r.panelAtk, 2642.7) && near(r.skillTotalDamage, 32683.2) && near(r.skillDps, 1307.328),
  '耀骑士临光 S2 逐夜烁光(限时被动 +130%,25s)32683.2/1307.328 实=' + r.skillTotalDamage);
r = run('char_1014_nearl2', 2);
ok(near(r.panelAtk, 2412.9) && near(r.skillTotalDamage, 31660.59) && near(r.skillDps, 1266.424) && near(r.dmgTypes.true.skillTotalDamage, 2654.19),
  '耀骑士临光 S3 耀阳颔首(+110% 物理 16 击 + 耀阳 110% 真实伤害 1 次)31660.59/1266.424 实=' + r.skillTotalDamage);
r = run('char_1014_nearl2', 2, { moduleId: 'uniequip_002_nearl2', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 35431.14), '耀骑士临光 X3 S3 35431.14 实=' + r.skillTotalDamage);

console.log('无畏者: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
