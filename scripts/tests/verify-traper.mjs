// 陷阱师(traper,特种)验证:精二满级/满信赖/潜0/技能等级 7(=专一档),敌 hp50000 atk800 def600 res50
// 用户口径(2026-09-18,陷阱建模口径;与行商琳琅诗怀雅 S2 一致,后续子职业沿用):
//   技能主动 = 放置陷阱的技能 → 技能期 DPS 记 0、技能期总伤 = 一个陷阱触发造成的伤害 = 攻击力×陷阱倍率;
//   常态化列 = 自身普攻;陷阱不单独成条(data/TOKEN/index.json 无陷阱 token)。
//   天赋:多萝西「梦想家」攻击力增幅默认叠满(+20%;Y 模组 L2/L3 0.03/0.04 → +30%/+40%);
//        艾拉「正中靶心」30% 概率部分不计,只按 S2 一次、S3 两次的 ×atk_scale;
//        望「料敌机先」伤害增幅与法抗穿透默认 2 层;钼铅「探险家的从容」(Y 模组 damage_scale)默认不计。
//   数据核查:望 S1/S2/S3 与多萝西 S3 的陷阱为法术伤害(见 tools/traper-report.md 待用户验收)。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
function loadOp(id) { return JSON.parse(fs.readFileSync(path.join(DATA, 'SPECIAL', 'traper', id + '.json'), 'utf8')); }
function mk(op, si, module) {
  const elite = op.phases.length - 1;
  return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module };
}
function mod(id, level) { return { moduleId: id, moduleLevel: level }; }
const P = (a) => Math.max(a - 600, a * 0.05);       // 物理:减防,保底 5%
const A = (a) => a * (1 - 50 / 100);                  // 法术:敌法抗 50
const Ares = (a, res) => a * (1 - res / 100);
let pass = 0, fail = 0;
const near = (a, e, tol, label) => {
  if (typeof a !== 'number' || Math.abs(a - e) > tol) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); }
  else pass++;
};
const eq = (a, e, label) => { if (a !== e) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };

// ---- 多萝西(char_4048_doroth) 6★ 攻击 581+80=661,天赋「梦想家」+20% → 793.2 ----
{
  const o = loadOp('char_4048_doroth');
  const ATK = (581 + 80) * 1.2;
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, ATK, 0.01, '多萝西 面板攻击力(梦想家满层 +20%)');
  near(r0.normalDps, P(ATK) / 0.85, 0.01, '多萝西 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.skillDps, 0, '多萝西 S1 技能期 DPS 0(陷阱)');
  near(s1.skillTotalDamage, P(ATK * 3.9), 0.01, '多萝西 S1 陷阱总伤(攻击力×390% 物理)');
  eq(s1.damageType, 'physical', '多萝西 S1 物理');
  near(s1.normalDps, P(ATK) / 0.85, 0.01, '多萝西 S1 常态化列=自身普攻');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, P(ATK * 2.7), 0.01, '多萝西 S2 陷阱总伤(攻击力×270% 物理)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillTotalDamage, A(ATK * 3.0), 0.01, '多萝西 S3 陷阱总伤(攻击力×300% 法术)');
  eq(s3.damageType, 'arts', '多萝西 S3 法术(数据核查)');
  // Y 模组「童话书」:L2/L3 梦想家 te 0.03/0.04(×10 → +30%/+40%)
  const y2 = calculateOperator(o, mk(o, 0, mod('uniequip_002_doroth', 2)));
  near(y2.panelAtk, (581 + 50 + 80) * 1.3, 0.01, '多萝西 Y2 面板(梦想家 +30%)');
  near(y2.skillTotalDamage, P((581 + 50 + 80) * 1.3 * 3.9), 0.01, '多萝西 Y2 S1 陷阱总伤');
  const y3 = calculateOperator(o, mk(o, 0, mod('uniequip_002_doroth', 3)));
  near(y3.panelAtk, (581 + 57 + 80) * 1.4, 0.01, '多萝西 Y3 面板(梦想家 +40%)');
  // X 模组「梦中人」:仅共振装置(天赋1)增强,梦想家不变 → 仍 ×1.2
  const x3 = calculateOperator(o, mk(o, 0, mod('uniequip_003_doroth', 3)));
  near(x3.panelAtk, (581 + 60 + 80) * 1.2, 0.01, '多萝西 X3 面板(梦想家不变)');
}

// ---- 艾拉(char_4123_ela) 6★ 攻击 588+80=668,天赋「正中靶心」×1.5(S2 一次 / S3 两次) ----
{
  const o = loadOp('char_4123_ela');
  const ATK = 588 + 80;
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, ATK, 0.01, '艾拉 面板攻击力');
  near(r0.normalDps, P(ATK) / 0.85, 0.01, '艾拉 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.skillTotalDamage, 0, '艾拉 S1 陷阱无伤害倍率 → 0');
  eq(s1.skillDps, 0, '艾拉 S1 技能期 DPS 0');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, P(ATK * 1.5) * 1, 0.01, '艾拉 S2 正中靶心(按 1 个陷阱 ×150%)');
  near(s2.normalDps, P(ATK) / 0.85, 0.01, '艾拉 S2 常态化列=自身普攻');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillTotalDamage, P(ATK * 1.5) * 2, 0.01, '艾拉 S3 正中靶心(按 2 个陷阱 ×150%)');
  // D 模组:正中靶心 te atk_scale 1.6/1.7
  const d2 = calculateOperator(o, mk(o, 1, mod('uniequip_002_ela', 2)));
  near(d2.skillTotalDamage, P((588 + 50 + 80) * 1.6), 0.01, '艾拉 D2 S2 陷阱总伤(靶心 ×1.6)');
  const d3 = calculateOperator(o, mk(o, 2, mod('uniequip_002_ela', 3)));
  near(d3.skillTotalDamage, P((588 + 60 + 80) * 1.7) * 2, 0.01, '艾拉 D3 S3 陷阱总伤(靶心 ×1.7 ×2)');
}

// ---- 望(char_2027_wang) 6★ 攻击 589+80=669,天赋「料敌机先」2 层(+20%,法穿 18) ----
{
  const o = loadOp('char_2027_wang');
  const ATK = 589 + 80;
  const res = Math.max(0, 50 - 18);
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, ATK, 0.01, '望 面板攻击力');
  near(r0.normalDps, P(ATK) / 0.85, 0.01, '望 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, Ares(ATK * 1.25 * 1.2, res), 0.01, '望 S1 陷阱总伤(每秒 ×125% ×2 层,法术)');
  eq(s1.damageType, 'arts', '望 S1 法术(数据核查)');
  near(s1.normalDps, P(ATK) / 0.85, 0.01, '望 S1 常态化列=自身普攻');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, Ares(ATK * 5.1 * 1.2, res), 0.01, '望 S2 陷阱总伤(×510% ×2 层,法术)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillTotalDamage, Ares(ATK * 3.4 * 1.2, res), 0.01, '望 S3 陷阱总伤(×340% ×2 层,法术)');
  // X 模组:料敌机先 te per_atk_scale 0.12/0.13、法穿 11/12
  const x2 = calculateOperator(o, mk(o, 2, mod('uniequip_002_wang', 2)));
  near(x2.skillTotalDamage, Ares((589 + 50 + 80) * 3.4 * (1 + 0.12 * 2), Math.max(0, 50 - 22)), 0.01, '望 X2 S3 陷阱总伤(2 层 ×1.24,法穿 22)');
  const x3 = calculateOperator(o, mk(o, 2, mod('uniequip_002_wang', 3)));
  near(x3.skillTotalDamage, Ares((589 + 60 + 80) * 3.4 * (1 + 0.13 * 2), Math.max(0, 50 - 24)), 0.01, '望 X3 S3 陷阱总伤(2 层 ×1.26,法穿 24)');
}

// ---- 钼铅(char_4171_wulfen) 5★ 攻击 520+40=560 ----
{
  const o = loadOp('char_4171_wulfen');
  const ATK = 520 + 40;
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, ATK, 0.01, '钼铅 面板攻击力(探险家的从容不计)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, P(ATK * 2.2), 0.01, '钼铅 S1 陷阱总伤(×220% 物理)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, P(ATK * 2.3) * 2, 0.01, '钼铅 S2 陷阱总伤(「两次」×230% 物理)');
  near(s2.normalDps, P(ATK) / 0.85, 0.01, '钼铅 S2 常态化列=自身普攻');
  const y3 = calculateOperator(o, mk(o, 0, mod('uniequip_002_wulfen', 3)));
  near(y3.panelAtk, 520 + 50 + 40, 0.01, '钼铅 Y3 面板攻击力');
  near(y3.skillTotalDamage, P((520 + 50 + 40) * 2.2), 0.01, '钼铅 Y3 S1 陷阱总伤(damage_scale 不计)');
}

// ---- 罗宾(char_451_robin) 5★ 攻击 513+40=553 ----
{
  const o = loadOp('char_451_robin');
  const ATK = 513 + 40;
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, ATK, 0.01, '罗宾 面板攻击力');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, P(ATK * 3), 0.01, '罗宾 S1 陷阱总伤(×300% 物理)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, P(ATK * 3.3), 0.01, '罗宾 S2 陷阱总伤(×330% 物理)');
  near(s2.normalDps, P(ATK) / 0.85, 0.01, '罗宾 S2 常态化列=自身普攻');
  const y3 = calculateOperator(o, mk(o, 0, mod('uniequip_002_robin', 3)));
  near(y3.skillTotalDamage, P((513 + 41 + 40) * 3), 0.01, '罗宾 Y3 S1 陷阱总伤');
}

// ---- 霜华(char_458_rfrost) 5★ 攻击 529+40=569 ----
{
  const o = loadOp('char_458_rfrost');
  const ATK = 529 + 40;
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, ATK, 0.01, '霜华 面板攻击力');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, P(ATK * 3), 0.01, '霜华 S1 陷阱总伤(×300% 物理)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, P(ATK * 1.7) + P(ATK * 1.6) * 3, 0.01, '霜华 S2 陷阱总伤(踏垫 170% + 追击 160%×3)');
  near(s2.normalDps, P(ATK) / 0.85, 0.01, '霜华 S2 常态化列=自身普攻');
  const y3 = calculateOperator(o, mk(o, 0, mod('uniequip_002_rfrost', 3)));
  near(y3.skillTotalDamage, P((529 + 47 + 40) * 3), 0.01, '霜华 Y3 S1 陷阱总伤');
}

// ---- 数据健全性:6 人 damageType=physical、trait=null(陷阱不单独成条) ----
{
  for (const id of ['char_4048_doroth', 'char_4123_ela', 'char_2027_wang', 'char_4171_wulfen', 'char_451_robin', 'char_458_rfrost']) {
    const o = loadOp(id);
    eq(o.damageType, 'physical', id + ' damageType=physical');
    eq(o.trait, null, id + ' trait=null');
    eq(o.subProfessionId, 'traper', id + ' subProfessionId=traper');
  }
}

// ---- 不变量:非永续、非触发型槽的常态化列 = 无技能态(全模组档) ----
{
  for (const id of ['char_4048_doroth', 'char_4123_ela', 'char_2027_wang', 'char_4171_wulfen', 'char_451_robin', 'char_458_rfrost']) {
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
console.log('陷阱师: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
