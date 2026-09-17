// 召唤师(summoner,辅助)验证:精二满级/满信赖/潜0/专一(技能等级7),敌 hp50000 atk800 def600 res50 grade=normal
// 用户口径(2026-09-18):召唤师通用「召唤物信息请在特殊-干员附带单位中查询」(召唤物独立成条);
//   令「随付笺咏醉屠苏」攻击力增幅按满层(+15%);衡沙「工匠遗训」伤害增幅不计算(对机械敌人条件类)。
// 模型:召唤物携带持有者技能槽(技能期增益作用于召唤物);仅关联特定技能的召唤物其它槽输出 0。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const IDX = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
function loadOp(id) { const e = IDX.find((x) => x.id === id); if (!e) return null; return JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8')); }
function mk(op, si, module) { const elite = op.phases.length - 1; return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module }; }
let pass = 0, fail = 0;
const near = (a, e, tol, label) => { if (typeof a !== 'number' || Math.abs(a - e) > tol) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };
const eq = (a, e, label) => { if (a !== e) { fail++; console.log('  FAIL ' + label + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(e)); } else pass++; };
const at = (id, si) => calculateOperator(loadOp(id), mk(loadOp(id), si));

// ---- 令:自身 + 三个召唤物(清平/逍遥/弦惊) ----
{
  const r0 = at('char_2023_ling', -1), r1 = at('char_2023_ling', 0), r3 = at('char_2023_ling', 2);
  near(r0.normalDps, 18.2562, 0.01, '令 常态(天赋随付笺咏醉屠苏按满层 +15%)');
  near(r1.skillTotalDamage, 4346.32, 0.5, '令 S1 自身攻击力+42% 攻速+42(25s)');
  near(r3.skillTotalDamage, 178.308, 0.01, '令 S3 自身攻击力+80%');
  const qp0 = at('token_10020_ling_soul1', -1), qp1 = at('token_10020_ling_soul1', 0);
  near(qp0.normalDps, 21.96, 0.01, '清平 常态物理 21.96');
  near(qp1.skillTotalDamage, 10914.12, 0.5, '清平 S1 攻击力×1.42 + 攻速+42,伤害类型变法术');
  eq(qp1.damageType, 'arts', '清平 S1 伤害类型为法术');
  eq(at('token_10020_ling_soul1', 1).skillTotalDamage, 0, '清平 未关联技能(令 S2)输出 0');
  const xy = at('token_10020_ling_soul2', 1);
  near(at('token_10020_ling_soul2', -1).normalDps, 126.875, 0.01, '逍遥 常态法术 126.875');
  near(xy.skillTotalDamage, 791.7, 0.5, '逍遥 S2 触发型 390%×自身攻击力 法术');
  eq(xy.normalDps, 126.875, '逍遥 S2 常态行照常');
  const xj = at('token_10020_ling_soul3', 2);
  near(xj.skillTotalDamage, 21132, 1, '弦惊 S3 总伤(物理 17628 + 每秒 20%×令攻击力 法术 3504)');
  near(xj.dmgTypes.arts.skillTotalDamage, 3504, 1, '弦惊 S3 法术档(令面板攻击力 508 × 0.2 × 60 次)');
  eq(at('token_10020_ling_soul3', 0).skillTotalDamage, 0, '弦惊 未关联技能(令 S1)输出 0');
  const up = at('token_10020_ling_soul3_up', 2);
  near(at('token_10020_ling_soul3_up', -1).normalDps, 617.25, 0.01, '弦惊·升级 常态法术 617.25(高级形态攻击力×1.8/间隔×0.8)');
  near(up.skillTotalDamage, 36835.5, 1, '弦惊·升级 S3 总伤(法术,含每秒 20%×令攻击力)');
  eq(loadOp('token_10020_ling_soul3_up').damageType, 'arts', '弦惊·升级 伤害类型为法术');
  eq(IDX.find((x) => x.id === 'token_10020_ling_soul3_up').ownerName, '令', '弦惊·升级 ownerName=令');
  const notes2 = JSON.parse(fs.readFileSync(DATA + '/notes.json', 'utf8'));
  eq(typeof notes2['__subprof_summoner'], 'string', '召唤师通用说明仍存在');
}
// ---- 麦哲伦:龙腾.F(无攻击)/L(法术)/A(物理) ----
{
  near(at('char_248_mgllan', 2).skillTotalDamage, 4449.15, 1, '麦哲伦 S3 自身攻击力+115%');
  near(at('token_10005_mgllan_drone1', -1).normalDps, 0, 0.001, '龙腾.F 无攻击(停顿机)');
  near(at('token_10005_mgllan_drone2', 1).skillTotalDamage, 8144, 1, '龙腾.L S2 攻速+115(单体法术)');
  eq(at('token_10005_mgllan_drone2', -1).normalDps > 0, true, '龙腾.L 常态有法术输出');
  near(at('token_10005_mgllan_drone3', 2).skillTotalDamage, 6113.7, 1, '龙腾.A S3 攻击力+115%(群体物理)');
  eq(at('token_10005_mgllan_drone2', 0).skillTotalDamage, 0, '龙腾.L 未关联技能(麦哲伦 S1)输出 0');
}
// ---- 电弧:三塔 + 天赋「加油~」召唤物获得电弧 12% 攻击力鼓舞 ----
{
  near(at('char_4195_radian', 1).skillTotalDamage, 2664, 1, '电弧 S2 自身攻击力+60%');
  near(at('char_4195_radian', 2).skillTotalDamage, 8445.6, 1, '电弧 S3 自身攻击力+120%');
  near(at('token_10051_radian_tower1', -1).normalDps, 22.055, 0.01, '戴乌 常态(含天赋鼓舞 0.12×电弧攻击力)');
  near(at('token_10052_radian_tower2', 1).skillTotalDamage, 28474.368, 1, '赛柯 S2 攻击力+60% 且子弹等效 3 连击');
  near(at('token_10053_radian_tower3', 2).skillTotalDamage, 24267.3552, 1, '桑特拉 S3 法术伤害(攻击力+120%,自身 20% 法术脆弱先状态后伤害)');
  eq(at('token_10053_radian_tower3', -1).damageType, 'arts', '桑特拉为法术伤害(S3 召唤物)');
  near(at('token_10053_radian_tower3', -1).normalDps, 307.4308, 0.01, '桑特拉 常态法术 307.43');
  eq(at('token_10051_radian_tower1', 1).skillTotalDamage, 0, '戴乌 未关联技能(电弧 S2)输出 0');
}
// ---- 梅尔:机械水獭(S2 引爆=梅尔攻击力×500% 法术) ----
{
  near(at('char_242_otter', 1).skillDps, 0, 0.001, '梅尔 S2 自身无技能期伤害(引爆在召唤物侧)');
  near(at('token_10004_otter_motter', -1).normalDps, 17.76, 0.01, '机械水獭 常态 17.76');
  eq(at('token_10004_otter_motter', 0).skillTotalDamage, 0, '机械水獭 S1 闪避无伤害');
  near(at('token_10004_otter_motter', 1).skillTotalDamage, 1195, 1, '机械水獭 S2 引爆 500%×梅尔攻击力 法术');
  near(at('token_10004_otter_motter', 1).cycleDps, 53.703, 0.01, '机械水獭 S2 循环 DPS');
}
// ---- 稀音 / 衡沙 / 深海色(召唤物共用两个技能) ----
{
  near(at('token_10010_folivo_car', 0).skillDps, 54.24, 0.01, '移动摄影器 S1 攻击力+40%(无限持续)');
  eq(at('token_10010_folivo_car', 0).skillTotalDamage, 0, '移动摄影器 S1 无限持续 → 总伤 0');
  near(at('token_10010_folivo_car', 1).skillTotalDamage, 4622.1, 1, '移动摄影器 S2 攻击力+95%');
  near(at('char_4140_lasher', 0).skillTotalDamage, 218.25, 0.5, '衡沙 S1 自身攻速+50');
  near(at('token_10036_lasher_mcbird', 0).skillTotalDamage, 153, 0.5, '发条羽兽 S1 攻速+50');
  near(at('token_10036_lasher_mcbird', 1).skillTotalDamage, 254.32, 0.5, '发条羽兽 S2 攻击力+36%');
  eq(at('char_110_deepcl', 0).normalHps, null, '深海色 S1 回血属召唤物 → 不计本体治疗');
  near(at('char_110_deepcl', 0).skillDps, 0, 0.001, '深海色 S1 自身输出按常态');
  near(at('token_10001_deepcl_tentac', 0).skillTotalDamage, 2232, 1, '触手 S1 攻击力+50%');
  near(at('token_10001_deepcl_tentac', 1).skillTotalDamage, 854.7, 1, '触手 S2(深海色 S2 无增益)按常态攻击');
}
// ---- 召唤物数据/说明文本 ----
{
  const ids = ['token_10020_ling_soul1', 'token_10020_ling_soul2', 'token_10020_ling_soul3', 'token_10020_ling_soul3_up', 'token_10005_mgllan_drone1', 'token_10005_mgllan_drone2', 'token_10005_mgllan_drone3', 'token_10051_radian_tower1', 'token_10052_radian_tower2', 'token_10053_radian_tower3', 'token_10004_otter_motter', 'token_10010_folivo_car', 'token_10036_lasher_mcbird', 'token_10001_deepcl_tentac'];
  eq(ids.every((id) => !!IDX.find((x) => x.id === id)), true, '13 个召唤物均已入 index');
  eq(IDX.find((x) => x.id === 'token_10020_ling_soul1').ownerName, '令', '清平 ownerName=令');
  eq(loadOp('token_10020_ling_soul2').damageType, 'arts', '逍遥 数据伤害类型为法术');
  eq(loadOp('token_10005_mgllan_drone2').damageType, 'arts', '龙腾.L 数据伤害类型为法术');
  const notes = JSON.parse(fs.readFileSync(DATA + '/notes.json', 'utf8'));
  eq(typeof notes['__subprof_summoner'], 'string', '召唤师通用说明已登记');
  eq(typeof notes['char_2023_ling'], 'string', '令说明已登记');
  eq(typeof notes['char_4140_lasher'], 'string', '衡沙说明已登记');
}
console.log('召唤师: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
