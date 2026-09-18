// 炼金师(alchemist,特种)验证:精二满级/满信赖/潜0/技能等级 7(=专一档),敌 hp50000 atk800 def600 res50
// 用户口径(2026-09-18):
//   引星棘刺:天赋「心相」的炼金单元时间默认不延长;天赋「视界」的攻击速度增幅默认为基础版(取 +5,不翻倍)。
//   炼金师子职业:技能都是「脱手技能」——干员抛出炼金单元后本体继续普攻(常态化列 = 自身普攻)。
// 建模(见 damage-calc.js calcAlchemistSkill):
//   炼金单元窗口 = projectile_delay_time;技能期总伤 = 每秒法伤 × 窗口;
//   技能期 HPS = 每秒治疗,总治疗量 = 每秒治疗 × 窗口;炼金单元不单独成条(data 无对应 TOKEN);
//   敌方减益:法术抗性减抗按用户口径 2026-09-18「先减抗再结算」计入(见 S3);atk/def 减益与友方 def 增益按「状态效果一律不计入伤害」口径不建模(traper 先例)。
//   天赋:引星棘刺「心相」攻击力 +10% 入 TALENT_ATK_DRIVERS;「视界」攻速 +5 入 TALENT_SPD_DRIVERS;
//        锡人「凋敝魂灵」炼金单元持续伤害 +20% 计入(DoT ×skill@damage_scale;X 模组 L2/L3 1.23/1.25)。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
function loadOp(id) { return JSON.parse(fs.readFileSync(path.join(DATA, 'SPECIAL', 'alchemist', id + '.json'), 'utf8')); }
function mk(op, si, module) {
  const elite = op.phases.length - 1;
  return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module };
}
function mod(id, level) { return { moduleId: id, moduleLevel: level }; }
const P = (a) => Math.max(a - 600, a * 0.05);   // 物理:减防,保底 5%
const A = (a) => a * (1 - 50 / 100);             // 法术:敌法抗 50
const A2 = (a, res) => Math.max(a * (1 - res / 100), a * 0.05);  // 法术:指定敌法抗(含 3 技能减抗)
let pass = 0, fail = 0;
const near = (a, e, tol, label) => {
  if (typeof a !== 'number' || Math.abs(a - e) > tol) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); }
  else pass++;
};
const eq = (a, e, label) => { if (a !== e) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };

// ---- 引星棘刺(char_1039_thorn2) 6★ 攻击 501+40=541,心相 +10% → 595.1;视界 攻速+5 ----
{
  const o = loadOp('char_1039_thorn2');
  const ATK = (501 + 40) * 1.10;   // E2 501 + 信赖 40,心相 +10%
  const IV = 1.5 / 1.05;           // 视界 攻速 +5(基础版)
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, ATK, 0.01, '引星棘刺 面板攻击力(心相 +10%)');
  near(r0.realInterval, IV, 1e-6, '引星棘刺 攻击间隔(视界 +5)');
  near(r0.normalDps, P(ATK) / IV, 0.01, '引星棘刺 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.type, 'heal', '引星棘刺 S1 治疗型');
  near(s1.skillHps, ATK * 0.16, 0.01, '引星棘刺 S1 技能期 HPS(单元每秒回复)');
  near(s1.totalHeal, ATK * 0.16 * 7, 0.01, '引星棘刺 S1 总治疗量(窗口 7s)');
  eq(s1.skillDps, 0, '引星棘刺 S1 无伤害(纯治疗)');
  near(s1.normalDps, P(ATK) / IV, 0.01, '引星棘刺 S1 常态化列=自身普攻');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.damageType, 'arts', '引星棘刺 S2 法术(单元 DoT)');
  near(s2.skillDps, A(ATK * 1.5), 0.01, '引星棘刺 S2 技能期 DPS(每秒 ×150%)');
  near(s2.skillTotalDamage, A(ATK * 1.5) * 15, 0.01, '引星棘刺 S2 技能期总伤(窗口 15s)');
  near(s2.skillHps, ATK * 0.16, 0.01, '引星棘刺 S2 技能期 HPS(友方每秒回复)');
  near(s2.totalHeal, ATK * 0.16 * 15, 0.01, '引星棘刺 S2 总治疗量(窗口 15s)');
  near(s2.normalDps, P(ATK) / IV, 0.01, '引星棘刺 S2 常态化列=自身普攻');
  const s3 = calculateOperator(o, mk(o, 2));
  // S3 窗口 21s:每秒倍率从 170% 线性升至 350%(每秒 +12%),max_stack_cnt=15s 封顶;
  // 用户口径 2026-09-18「先减抗、再结算」:每秒先按法抗-34%~-46%(每秒 -0.8%,15s 封顶)削弱敌法抗再结算该秒法伤
  let s3tot = 0;
  for (let t = 0; t < 21; t++) {
    const mul = Math.min(1.7 + 0.12 * t, 3.5);
    const mr = Math.min(0.34 + 0.008 * t, 0.46);
    s3tot += A2(ATK * mul, 50 * (1 - mr));
  }
  eq(s3.damageType, 'arts', '引星棘刺 S3 法术(单元 DoT)');
  near(s3.skillTotalDamage, s3tot, 0.01, '引星棘刺 S3 技能期总伤(递增 DoT 窗口 21s + 先减抗再结算)');
  near(s3.skillTotalDamage, 25028.8348, 0.01, '引星棘刺 S3 技能期总伤(专一对照值)');
  near(s3.skillDps, s3tot / 21, 0.01, '引星棘刺 S3 技能期 DPS');
  near(s3.normalDps, P(ATK) / IV, 0.01, '引星棘刺 S3 常态化列=自身普攻');
  // X 模组 uniequip_002_thorn2:特性追加白值 atk +30/+40/+50,心相同名 te 覆盖 atk 0.10/0.10/0.15
  const x2 = calculateOperator(o, mk(o, 0, mod('uniequip_002_thorn2', 2)));
  near(x2.panelAtk, (501 + 40 + 40) * 1.10, 0.01, '引星棘刺 X2 面板(心相 +10%)');
  near(x2.skillHps, (501 + 40 + 40) * 1.10 * 0.16, 0.01, '引星棘刺 X2 S1 技能期 HPS');
  const x3 = calculateOperator(o, mk(o, 2, mod('uniequip_002_thorn2', 3)));
  near(x3.panelAtk, (501 + 40 + 50) * 1.15, 0.01, '引星棘刺 X3 面板(心相 +15%)');
  let x3tot = 0;
  for (let t = 0; t < 21; t++) {
    const mul = Math.min(1.7 + 0.12 * t, 3.5);
    const mr = Math.min(0.34 + 0.008 * t, 0.46);
    x3tot += A2((501 + 40 + 50) * 1.15 * mul, 50 * (1 - mr));
  }
  near(x3.skillTotalDamage, x3tot, 0.01, '引星棘刺 X3 S3 技能期总伤');
}

// ---- 锡人(char_4151_tinman) 5★ 攻击 469+30=499,凋敝魂灵 持续伤害 +20% ----
{
  const o = loadOp('char_4151_tinman');
  const ATK = 469 + 30;   // E2 469 + 信赖 30
  const MUL = 1.2;        // 凋敝魂灵 炼金单元持续伤害 +20%
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, ATK, 0.01, '锡人 面板攻击力');
  near(r0.normalDps, P(ATK) / 1.5, 0.01, '锡人 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.damageType, 'arts', '锡人 S1 法术(单元 DoT)');
  near(s1.skillDps, A(ATK * 0.65 * MUL), 0.01, '锡人 S1 技能期 DPS(每秒 ×65% ×凋敝魂灵)');
  near(s1.skillTotalDamage, A(ATK * 0.65 * MUL) * 9, 0.01, '锡人 S1 技能期总伤(窗口 9s)');
  near(s1.normalDps, P(ATK) / 1.5, 0.01, '锡人 S1 常态化列=自身普攻');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.type, 'heal', '锡人 S2 治疗型(法伤+治疗)');
  eq(s2.damageType, 'arts', '锡人 S2 法术(单元 DoT)');
  near(s2.skillDps, A(ATK * 0.9 * MUL), 0.01, '锡人 S2 技能期 DPS(每秒 ×90% ×凋敝魂灵)');
  near(s2.skillTotalDamage, A(ATK * 0.9 * MUL) * 13, 0.01, '锡人 S2 技能期总伤(窗口 13s)');
  near(s2.skillHps, ATK * 0.2, 0.01, '锡人 S2 技能期 HPS(友方每秒回复)');
  near(s2.totalHeal, ATK * 0.2 * 13, 0.01, '锡人 S2 总治疗量(窗口 13s)');
  near(s2.normalDps, P(ATK) / 1.5, 0.01, '锡人 S2 常态化列=自身普攻');
  // X 模组 uniequip_002_tinman:白值 atk +30/+35,凋敝魂灵 te skill@damage_scale 1.23/1.25
  const x2 = calculateOperator(o, mk(o, 0, mod('uniequip_002_tinman', 2)));
  near(x2.panelAtk, 469 + 30 + 30, 0.01, '锡人 X2 面板攻击力');
  near(x2.skillTotalDamage, A((469 + 30 + 30) * 0.65 * 1.23) * 9, 0.01, '锡人 X2 S1 总伤(凋敝魂灵 ×1.23)');
  const x3 = calculateOperator(o, mk(o, 1, mod('uniequip_002_tinman', 3)));
  near(x3.panelAtk, 469 + 30 + 35, 0.01, '锡人 X3 面板攻击力');
  near(x3.skillDps, A((469 + 30 + 35) * 0.9 * 1.25), 0.01, '锡人 X3 S2 技能期 DPS(凋敝魂灵 ×1.25)');
}

// ---- 数据健全性:2 人 damageType=physical、trait=null(炼金单元不单独成条)、subProfessionId=alchemist ----
{
  for (const id of ['char_1039_thorn2', 'char_4151_tinman']) {
    const o = loadOp(id);
    eq(o.damageType, 'physical', id + ' damageType=physical');
    eq(o.trait, null, id + ' trait=null');
    eq(o.subProfessionId, 'alchemist', id + ' subProfessionId=alchemist');
  }
}

// ---- 不变量:非永续、非触发型槽(全为窗口型)常态化列 = 无技能态;且技能位均非永续 ----
{
  for (const id of ['char_1039_thorn2', 'char_4151_tinman']) {
    const o = loadOp(id);
    const mods = [null];
    for (const m of (o.modules || [])) if (m.type === 'ADVANCED') for (const lv of (m.levels || [])) mods.push(mod(m.id, lv.level));
    for (const mm of mods) {
      const n0 = calculateOperator(o, mk(o, -1, mm)).normalDps;
      for (let si = 0; si < (o.skills || []).length; si++) {
        const r = calculateOperator(o, mk(o, si, mm));
        eq(r.isPermanent, false, `${o.name} S${si + 1} 非永续`);
        if (r.normalDps === null || r.isPermanent) continue;
        near(r.normalDps, n0, 0.02, `${o.name} S${si + 1} 常态化列=无技能态`);
      }
    }
  }
}
console.log('炼金师: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
