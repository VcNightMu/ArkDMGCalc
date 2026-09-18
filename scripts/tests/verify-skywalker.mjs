// 巡空者(skywalker,特种)验证:精二满级/满信赖/潜0/技能等级 7(=专一档),敌 hp50000 atk800 def600 res50
// 用户口径(2026-09-18):予愿安洁莉娜 天赋「飘浮大地之上」的额外法术伤害默认为「基础版」(取 atk_scale_lo,不取对轻敌的 atk_scale_hi)。
// 建模(见 damage-calc.js calcSkywalkerSkill / skywalkerTalentAtkBonus / skywalkerExtraArtsRatio):
//   常态/技能期均为「物理普攻 + 予愿安洁莉娜 每击附加法术伤害」(附加伤害随技能期攻击力缩放,不吃技能的物理伤害倍率);
//   起飞后攻击力增幅(攻击力乘区):予愿安洁莉娜 T1「天穹间的舞步」起飞友方 +13%(含自身)/ 云迹 T0「低空乱流」攻击力提升至 110%;
//   技能期 = duration,击数 = floor(duration/间隔);予愿安洁莉娜 S3 为弹药型(33 发 ×(攻击力×330% 物理 + 攻击力×atk_scale_lo 法术));
//   失重/减重、眩晕/束缚等状态效果、阻挡数、蒂比「片场工作指南」的闪避一律不计入伤害。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
function loadOp(id) { return JSON.parse(fs.readFileSync(path.join(DATA, 'SPECIAL', 'skywalker', id + '.json'), 'utf8')); }
function mk(op, si, module) {
  const elite = op.phases.length - 1;
  return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module };
}
const P = (a) => Math.max(a - 600, a * 0.05);   // 物理:减防,保底 5%
const A = (a) => a * (1 - 50 / 100);             // 法术:敌法抗 50
let pass = 0, fail = 0;
const near = (a, e, tol, label) => {
  if (typeof a !== 'number' || Math.abs(a - e) > tol) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); }
  else pass++;
};
const eq = (a, e, label) => { if (a !== e) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };

// ---- 予愿安洁莉娜(char_1015_aglna2) 6★ 攻击 796+40=836,天穹间的舞步 +13%(含自身),飘浮大地之上 基础版 25% ----
{
  const o = loadOp('char_1015_aglna2');
  const RAW = 796 + 40;            // E2 796 + 信赖 40(白值攻击)
  const ATK = RAW * 1.13;          // T1「天穹间的舞步」起飞友方攻击力 +13%(潜0;与技能 atk 同乘区加算)
  const R = 0.25;                  // T0「飘浮大地之上」基础版额外法术比率(潜0 E2;对轻敌方为 0.35,不取)
  const S = (b) => ATK + RAW * b;  // 技能期攻击力(天赋 atk 与技能 atk 同乘区加算)
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, ATK, 0.01, '予愿安洁莉娜 面板攻击力(天穹间的舞步 +13% 含自身)');
  near(r0.realInterval, 1.5, 1e-6, '予愿安洁莉娜 攻击间隔');
  near(r0.normalDps, (P(ATK) + A(ATK * R)) / 1.5, 0.01, '予愿安洁莉娜 常态 DPS(物理 + 附加法术)');
  near(r0.normalTypes.physical.dps, P(ATK) / 1.5, 0.01, '予愿安洁莉娜 常态物理分量');
  near(r0.normalTypes.arts.dps, A(ATK * R) / 1.5, 0.01, '予愿安洁莉娜 常态附加法术分量');
  // S1 极速送达(PASSIVE/skillType=8,限时被动,持续 58s,攻击力 +110%)
  const s1 = calculateOperator(o, mk(o, 0));
  const a1 = S(1.1);
  const h1 = Math.floor(58 / 1.5);   // 38 击
  near(s1.skillTotalDamage, (P(a1) + A(a1 * R)) * h1, 0.01, '予愿安洁莉娜 S1 技能期总伤(58s,攻击力+110%)');
  near(s1.skillDps, (P(a1) + A(a1 * R)) * h1 / 58, 0.01, '予愿安洁莉娜 S1 技能期 DPS');
  eq(s1.damageType, 'physical', '予愿安洁莉娜 S1 主伤害类型=物理');
  near(s1.dmgTypes.arts.skillTotalDamage, A(a1 * R) * h1, 0.01, '予愿安洁莉娜 S1 附加法术分量');
  // S2 重力自定义(22s,攻击力 +145%,基础攻击间隔 -0.8 → 0.7)
  const s2 = calculateOperator(o, mk(o, 1));
  const a2 = S(1.45);
  const h2 = Math.floor(22 / 0.7);   // 31 击
  near(s2.realInterval, 0.7, 1e-6, '予愿安洁莉娜 S2 技能期攻击间隔(1.5-0.8)');
  near(s2.skillTotalDamage, (P(a2) + A(a2 * R)) * h2, 0.01, '予愿安洁莉娜 S2 技能期总伤(22s,攻击力+145%)');
  near(s2.skillDps, (P(a2) + A(a2 * R)) * h2 / 22, 0.01, '予愿安洁莉娜 S2 技能期 DPS');
  // S3 酸橙的心事(弹药型 33 发,攻击力 +30%,每发攻击力×330%)
  const s3 = calculateOperator(o, mk(o, 2));
  const a3 = S(0.3);
  const h3 = 33;
  const per3 = P(a3 * 3.3) + A(a3 * R);
  near(s3.skillTotalDamage, per3 * h3, 0.01, '予愿安洁莉娜 S3 技能期总伤(33 发弹药)');
  near(s3.skillDps, per3 * h3 / (h3 * 1.5), 0.01, '予愿安洁莉娜 S3 技能期 DPS(弹药窗口 33×1.5s)');
  eq(s3.cycleDps, null, '予愿安洁莉娜 S3 弹药型 cycleDps=null');
  near(s3.dmgTypes.arts.skillTotalDamage, A(a3 * R) * h3, 0.01, '予愿安洁莉娜 S3 附加法术分量');
}

// ---- 云迹(char_4165_ctrail) 4★ 攻击 692+35=727,低空乱流 起飞后攻击力提升至 110% ----
{
  const o = loadOp('char_4165_ctrail');
  const RAW = 692 + 35;            // E2 692 + 信赖 35
  const ATK = RAW * 1.10;          // T0「低空乱流」起飞后攻击力提升至 110%(潜0)
  const S = (b) => ATK + RAW * b;
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, ATK, 0.01, '云迹 面板攻击力(低空乱流 攻击力提升至 110%)');
  near(r0.normalDps, P(ATK) / 1.5, 0.01, '云迹 常态 DPS(纯物理)');
  eq(r0.normalTypes, undefined, '云迹 常态无附加法术(normalTypes 空)');
  const s1 = calculateOperator(o, mk(o, 0));
  const a1 = S(0.65);
  const h1 = Math.floor(36 / 1.5);   // 24 击
  near(s1.skillTotalDamage, P(a1) * h1, 0.01, '云迹 S1 技能期总伤(36s,攻击力+65%)');
  near(s1.skillDps, P(a1) * h1 / 36, 0.01, '云迹 S1 技能期 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  const a2 = S(0.7);
  const h2 = Math.floor(30 / 1.5);   // 20 击
  near(s2.skillTotalDamage, P(a2) * h2, 0.01, '云迹 S2 技能期总伤(30s,攻击力+70%)');
  near(s2.skillDps, P(a2) * h2 / 30, 0.01, '云迹 S2 技能期 DPS');
}

// ---- 蒂比(char_4191_tippi) 5★ 攻击 745+40=785,天赋「片场工作指南」闪避类不建模 ----
{
  const o = loadOp('char_4191_tippi');
  const RAW = 745 + 40;   // E2 745 + 信赖 40(无攻击力天赋)
  const ATK = RAW;
  const S = (b) => ATK + RAW * b;
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, ATK, 0.01, '蒂比 面板攻击力(无攻击力天赋)');
  near(r0.normalDps, P(ATK) / 1.5, 0.01, '蒂比 常态 DPS(纯物理)');
  const s1 = calculateOperator(o, mk(o, 0));
  const a1 = S(0.75);
  const h1 = Math.floor(36 / 1.5);   // 24 击
  near(s1.skillTotalDamage, P(a1) * h1, 0.01, '蒂比 S1 技能期总伤(36s,攻击力+75%)');
  near(s1.skillDps, P(a1) * h1 / 36, 0.01, '蒂比 S1 技能期 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  const a2 = S(0.35);
  const h2 = Math.floor(15 / 1.5);   // 10 击
  near(s2.skillTotalDamage, P(a2) * h2, 0.01, '蒂比 S2 技能期总伤(15s,攻击力+35%)');
  near(s2.skillDps, P(a2) * h2 / 15, 0.01, '蒂比 S2 技能期 DPS');
}

// ---- 数据健全性:3 人 damageType=physical、subProfessionId=skywalker、无效果模组 ----
{
  for (const id of ['char_1015_aglna2', 'char_4165_ctrail', 'char_4191_tippi']) {
    const o = loadOp(id);
    eq(o.damageType, 'physical', id + ' damageType=physical');
    eq(o.subProfessionId, 'skywalker', id + ' subProfessionId=skywalker');
    eq(o.modules, undefined, id + ' 无模组(X/Y 均无)');
  }
  eq(loadOp('char_1015_aglna2').trait !== null, true, '予愿安洁莉娜 trait 非空(起飞后阻挡2个飞行敌人)');
  eq(loadOp('char_4165_ctrail').trait, null, '云迹 trait=null');
  eq(loadOp('char_4191_tippi').trait, null, '蒂比 trait=null');
}

// ---- 不变量:非永续、非触发型槽常态化列 = 无技能态;技能位均非永续 ----
{
  for (const id of ['char_1015_aglna2', 'char_4165_ctrail', 'char_4191_tippi']) {
    const o = loadOp(id);
    const n0 = calculateOperator(o, mk(o, -1)).normalDps;
    for (let si = 0; si < (o.skills || []).length; si++) {
      const r = calculateOperator(o, mk(o, si));
      eq(r.isPermanent, false, `${o.name} S${si + 1} 非永续`);
      if (r.normalDps === null || r.isPermanent) continue;
      near(r.normalDps, n0, 0.02, `${o.name} S${si + 1} 常态化列=无技能态`);
    }
  }
}
console.log('巡空者: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
