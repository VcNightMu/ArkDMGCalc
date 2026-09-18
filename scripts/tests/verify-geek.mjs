// 怪杰(geek,特种)验证:精二满级/满信赖/潜0/技能等级 7(=专一档),敌 hp50000 atk800 def600 res50
// 口径(2026-09-18 用户):
//   阿:天赋「混合药物射击」的攻击力增幅不计算(四选一随机效果,概率类)
//   空构:天赋「装弹对比实验」的连击和无视防御力效果不计算;技能「临场铳械改装」的自身概率晕眩不计算
//   新约能天使:天赋「火力电台」的轰炸不计算;技能「开火成瘾症」默认不偷取攻击速度(也不增加 5 发弹药)
// 引擎:
//   · 特性(自身生命每秒流失 1%,可对空)非输出不建模
//   · 新约能天使「铳弹协约」:携带弹药类技能的干员攻击力 +9%、对【拉特兰】翻倍 → 本人 +18%(阵营光环含自身)
//   · 新约能天使三技能为弹药型:技能窗口 = 弹药数×攻击间隔、期间逐发出击,常态化列仍按自身普攻
//   · 阿 S2 爆发剂·γ型:对友方 15 次 500 攻击(友伤)并使自身/目标防御生命上限+X%,自身对敌输出不变 → 归常态
//   · 空构 S1 见机行事为限时被动(PASSIVE 且 duration>0)→ 走技能期攻速强化
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
function loadOp(id) { return JSON.parse(fs.readFileSync(path.join(DATA, 'SPECIAL', 'geek', id + '.json'), 'utf8')); }
function mk(op, si, module) {
  const elite = op.phases.length - 1;
  return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module };
}
function mod(id, level) { return { moduleId: id, moduleLevel: level }; }
let pass = 0, fail = 0;
const near = (a, e, tol, label) => {
  if (typeof a !== 'number' || Math.abs(a - e) > tol) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); }
  else pass++;
};
const eq = (a, e, label) => { if (a !== e) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };

// ---- 新约能天使(char_1041_angel2) ----
{
  const o = loadOp('char_1041_angel2');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 778 * 1.18, 0.01, '新约能天使 面板攻击力(778×1.18,含铳弹协约 +18%)');
  near(r0.realInterval, 1.3, 0.001, '新约能天使 攻击间隔');
  near(r0.normalDps, 244.646, 0.02, '新约能天使 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 11357.504, 0.6, 'S1 天空大扫除 总伤(8 发 × 220%)');
  near(s1.skillDps, 1092.068, 0.05, 'S1 技能期 DPS(窗口 8×1.3)');
  near(s1.normalDps, 244.646, 0.02, 'S1 常态化列=自身普攻');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.realInterval, 0.6, 0.001, 'S2 攻击间隔(1.3-0.7)');
  near(s2.skillTotalDamage, 68967.92, 1, 'S2 开火成瘾症 总伤(35 发 × 280%,不偷攻速/不加 5 发)');
  near(s2.skillDps, 3284.187, 0.2, 'S2 技能期 DPS(窗口 35×0.6)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillTotalDamage, 51690, 1, 'S3 使命必达！ 总伤(50 发 ÷ 5 发/次 = 10 次 × 5 连击 × 150%)');
  near(s3.skillDps, 3976.154, 0.2, 'S3 技能期 DPS(窗口 10×1.3)');
  const x3 = calculateOperator(o, mk(o, -1, mod('uniequip_002_angel2', 3)));
  near(x3.panelAtk, (708 + 70 + 65) * 1.18, 0.01, 'X3 面板攻击力(843×1.18)');
  near(x3.normalDps, ((708 + 70 + 65) * 1.18 - 600) / 1.3, 0.02, 'X3 常态 DPS');
  near(calculateOperator(o, mk(o, 2, mod('uniequip_002_angel2', 3))).skillTotalDamage, 58515, 1, 'X3 S3 总伤');
}

// ---- 阿(char_225_haak) ----
{
  const o = loadOp('char_225_haak');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 753, 0.01, '阿 面板攻击力(混合药物射击攻击增幅不计)');
  near(r0.normalDps, 117.692, 0.02, '阿 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.realInterval, 1.3 * 100 / 180, 0.002, '阿 S1 快速射击 攻击间隔(攻速+80)');
  near(s1.skillTotalDamage, 5661, 0.6, '阿 S1 总伤(37 次 × 153)');
  near(s1.skillDps, 209.667, 0.05, '阿 S1 技能期 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.skillDps, 0, '阿 S2 爆发剂·γ型 技能期无对敌输出(友伤/自身仅防御生命)');
  eq(s2.skillTotalDamage, 0, '阿 S2 总伤 0');
  near(s2.normalDps, 117.692, 0.02, '阿 S2 常态化列=自身普攻');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.realInterval, 1.3 * 100 / 140, 0.002, '阿 S3 攻击间隔(攻速+40)');
  near(s3.panelAtk, 753 * 1.4, 0.01, '阿 S3 技能期攻击力(+40%)');
  near(s3.skillTotalDamage, 9538.2, 0.6, '阿 S3 榴莲味 总伤(21 次 × 454.2)');
  const x3 = calculateOperator(o, mk(o, -1, mod('uniequip_002_haak', 3)));
  near(x3.panelAtk, 810, 0.01, '阿 X3 面板攻击力(753+57)');
  const y3 = calculateOperator(o, mk(o, -1, mod('uniequip_003_haak', 3)));
  near(y3.panelAtk, 828, 0.01, '阿 Y3 面板攻击力(753+75)');
}

// ---- 空构(char_4015_spuria) ----
{
  const o = loadOp('char_4015_spuria');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 707, 0.01, '空构 面板攻击力(装弹对比实验不计)');
  near(r0.normalDps, 82.308, 0.02, '空构 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.realInterval, 1.3 * 100 / 180, 0.002, '空构 S1 见机行事 攻击间隔(限时被动攻速+80)');
  near(s1.skillTotalDamage, 2889, 0.6, '空构 S1 总伤(27 次 × 107)');
  near(s1.skillDps, 144.45, 0.05, '空构 S1 技能期 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.realInterval, 1.3 * 100 / 135, 0.002, '空构 S2 攻击间隔(攻速+35,自身概率晕眩不计)');
  near(s2.panelAtk, 707 * 1.2, 0.01, '空构 S2 技能期攻击力(+20%)');
  near(s2.skillTotalDamage, 4968, 0.6, '空构 S2 临场铳械改装 总伤(20 次 × 248.4)');
  near(calculateOperator(o, mk(o, -1, mod('uniequip_002_spuria', 3))).panelAtk, 747, 0.01, '空构 X3 面板攻击力(707+40)');
  near(calculateOperator(o, mk(o, 1, mod('uniequip_002_spuria', 3))).skillTotalDamage, 5928, 0.6, '空构 X3 S2 总伤');
}

// ---- 不变量:常态化列 = 无技能态 ----
{
  for (const id of ['char_1041_angel2', 'char_225_haak', 'char_4015_spuria']) {
    const o = loadOp(id);
    const mods = [null];
    for (const m of (o.modules || [])) if (m.type === 'ADVANCED') for (const lv of (m.levels || [])) mods.push(mod(m.id, lv.level));
    for (const mm of mods) {
      const n0 = calculateOperator(o, mk(o, -1, mm)).normalDps;
      for (let si = 0; si < (o.skills || []).length; si++) {
        const r = calculateOperator(o, mk(o, si, mm));
        if (r.normalDps === null || r.isPermanent) continue;
        near(r.normalDps, n0, 0.02, `${o.name} S${si + 1} 常态化列=无技能态`);
      }
    }
  }
}
console.log('怪杰: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
