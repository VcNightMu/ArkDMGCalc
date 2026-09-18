// 推击手(pusher,特种)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50
// 口径(2026-09-18 用户):
//   温蒂:召唤物信息请在「特殊-干员附带单位」中查询,天赋「蓄水炮强化」的攻击力增幅默认不计算,
//        技能「液氮大炮」按距离造成的真实伤害不计算
//   见行者:天赋「技巧射击」的无视防御效果默认不计算
// 引擎:
//   · 温蒂 S2 水炮模式:攻击间隔增大(+220%) → base_attack_time 2.2 走 INTERVAL_GROW_OVERRIDES(1.2×3.2=3.84s)
//   · 温蒂 S3 液氮大炮:群体法术伤害 → SKILL_ARTS_OVERRIDES[2](按距离的真实伤害不计)
//   · 召唤物「工程蓄水炮」token_10009_weedy_cannon 独立成条(伤害基值=本体温蒂面板攻击力,PRTS「除基本力度外均以本体的数值为准」)
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

// ---- 温蒂(char_400_weedy) ----
{
  const o = loadOp('char_400_weedy');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'physical', '温蒂 常态伤害类型=物理');
  near(r0.panelAtk, 722, 0.01, '温蒂 面板攻击力');
  near(r0.normalDps, 101.667, 0.05, '温蒂 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 410.8, 0.5, '温蒂 S1 炮管敲击 总伤(140% 物理)');
  near(s1.cycleDps, 179.76, 0.1, '温蒂 S1 循环 DPS(自动回 sp5)');
  eq(s1.normalDps, null, '温蒂 S1 常态列为 null(触发型)');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.isPermanent, true, '温蒂 S2 水炮模式 持续时间无限(永久型)');
  near(s2.realInterval, 3.84, 0.001, '温蒂 S2 攻击间隔(增大 +220%:1.2×3.2)');
  near(s2.skillDps, 370.208, 0.1, '温蒂 S2 技能期 DPS(攻击力+180% ×2.8)');
  eq(s2.skillTotalDamage, 0, '温蒂 S2 总伤 0(永久型)');
  const s3 = calculateOperator(o, mk(o, 2));
  eq(s3.damageType, 'arts', '温蒂 S3 液氮大炮 伤害类型=法术(群体法术伤害)');
  near(s3.skillTotalDamage, 1191.3, 0.5, '温蒂 S3 总伤(330% 法术,22×3.3 = 2382.6 的 50%)');
  near(s3.cycleDps, 134.758, 0.1, '温蒂 S3 循环 DPS(自动回 sp36)');
  eq(s3.normalDps, null, '温蒂 S3 常态列为 null(触发型)');
  // X 模组 L3(白值 atk+72;天赋「蓄水炮强化」攻击力增幅不计)
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_weedy', 3)));
  near(x3.panelAtk, 794, 0.01, '温蒂 X3 面板攻击力(722+72)');
  near(x3.normalDps, 161.667, 0.05, '温蒂 X3 常态 DPS');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_weedy', 3)));
  near(x3s2.realInterval, 3.84, 0.001, '温蒂 X3 S2 攻击间隔');
  near(x3s2.skillDps, 422.708, 0.1, '温蒂 X3 S2 技能期 DPS');
  const x3s3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_002_weedy', 3)));
  eq(x3s3.damageType, 'arts', '温蒂 X3 S3 法术');
  near(x3s3.skillTotalDamage, 1310.1, 0.5, '温蒂 X3 S3 总伤');
  // Y 模组 L3(白值 atk+68)
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_003_weedy', 3)));
  near(y3.panelAtk, 790, 0.01, '温蒂 Y3 面板攻击力(722+68)');
  const y3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_003_weedy', 3)));
  near(y3s2.skillDps, 419.792, 0.1, '温蒂 Y3 S2 技能期 DPS');
  const y3s3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_003_weedy', 3)));
  near(y3s3.skillTotalDamage, 1303.5, 0.5, '温蒂 Y3 S3 总伤');
}

// ---- 食铁兽(char_241_panda) ----
{
  const o = loadOp('char_241_panda');
  near(calculateOperator(o, mk(o, -1)).normalDps, 70.833, 0.05, '食铁兽 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 85, 0.5, '食铁兽 S1 铁意六合 总伤(=普攻 1 次,无伤害增幅)');
  near(s1.cycleDps, 85, 0.1, '食铁兽 S1 循环 DPS');
  eq(s1.skillDps, 0, '食铁兽 S1 技能期 DPS 0(推动/减速无增伤)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 838.5, 0.5, '食铁兽 S2 崩拳式 总伤(210% 物理)');
  near(s2.cycleDps, 119.324, 0.1, '食铁兽 S2 循环 DPS(自动回 sp17)');
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_panda', 3)));
  near(y3.panelAtk, 720, 0.01, '食铁兽 Y3 面板攻击力(685+35)');
  near(y3.normalDps, 100, 0.05, '食铁兽 Y3 常态 DPS');
  const y3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_panda', 3)));
  near(y3s2.skillTotalDamage, 912, 0.5, '食铁兽 Y3 S2 总伤');
}

// ---- 见行者(char_4036_forcer) ----
{
  const o = loadOp('char_4036_forcer');
  near(calculateOperator(o, mk(o, -1)).normalDps, 44.167, 0.05, '见行者 常态 DPS(技巧射击无视防御不计)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 53, 0.5, '见行者 S1 护身射击 总伤(=普攻 1 次)');
  near(s1.cycleDps, 53, 0.1, '见行者 S1 循环 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 53, 0.5, '见行者 S2 惊爆射击 总伤(=普攻 1 次)');
  near(s2.cycleDps, 44.632, 0.1, '见行者 S2 循环 DPS(自动回 sp19)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_forcer', 3)));
  near(x3.panelAtk, 713, 0.01, '见行者 X3 面板攻击力(653+60)');
  near(x3.normalDps, 94.167, 0.05, '见行者 X3 常态 DPS(无视防御仍不计)');
}

// ---- 阿消(char_277_sqrrel) ----
{
  const o = loadOp('char_277_sqrrel');
  near(calculateOperator(o, mk(o, -1)).normalDps, 25.625, 0.05, '阿消 常态 DPS(保底伤害 5%×615=30.75)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 261, 0.5, '阿消 S1 水蒸气泵 总伤(140% 物理)');
  near(s1.cycleDps, 76.8, 0.1, '阿消 S1 循环 DPS(自动回 sp5)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 999, 0.5, '阿消 S2 高压水炮 总伤(260% 物理)');
  near(s2.cycleDps, 76.855, 0.1, '阿消 S2 循环 DPS(自动回 sp19)');
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_sqrrel', 3)));
  near(y3.panelAtk, 648, 0.01, '阿消 Y3 面板攻击力(615+33)');
  near(y3.normalDps, 40, 0.05, '阿消 Y3 常态 DPS');
}

// ---- 温蒂召唤物「工程蓄水炮」(token_10009_weedy_cannon) ----
{
  const at = INDEX.findIndex((x) => x.id === 'char_400_weedy');
  eq(INDEX[at + 1] && INDEX[at + 1].id, 'token_10009_weedy_cannon', '工程蓄水炮 索引紧随 char_400_weedy');
  const o = loadOp('token_10009_weedy_cannon');
  eq(o.ownerOperatorId, 'char_400_weedy', '工程蓄水炮 owner=char_400_weedy');
  eq(o.profession, 'TOKEN', '工程蓄水炮 职业=TOKEN');
  eq(o.subProfessionId, 'notchar1', '工程蓄水炮 子职业=notchar1');
  eq((o.skills || []).length, 1, '工程蓄水炮 自身技能 1 个(sktok_weedy_token 液氮大炮)');
  eq(o.skills[0].skillId, 'sktok_weedy_token', '工程蓄水炮 技能=液氮大炮');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 722, 0.01, '工程蓄水炮 面板攻击力=本体温蒂(E2 满级/满信赖)');
  near(r0.realInterval, 2.4, 0.001, '工程蓄水炮 攻击间隔(自身 2.4s)');
  near(r0.normalDps, 50.833, 0.05, '工程蓄水炮 常态普攻 DPS((722-600)/2.4)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 1191.3, 0.5, '工程蓄水炮 液氮大炮 总伤(本体攻击力×330% 法术)');
  near(s1.dmgTypes.arts.skillTotalDamage, 1191.3, 0.5, '工程蓄水炮 液氮大炮 法术段');
  eq(s1.cycleDps, null, '工程蓄水炮 液氮大炮 无循环 DPS(sp0,由持有者技能触发)');
  near(s1.normalDps, 50.833, 0.05, '工程蓄水炮 液氮大炮 常态普攻保留');
}

// ---- 不变量:非永久/非触发槽的常态化列 = 无技能态 ----
{
  const ids = ['char_400_weedy', 'char_241_panda', 'char_4036_forcer', 'char_277_sqrrel', 'token_10009_weedy_cannon'];
  for (const id of ids) {
    const o = loadOp(id);
    const mods = [null];
    for (const m of (o.modules || [])) if (m.type === 'ADVANCED') for (const lv of (m.levels || [])) mods.push(mod(o, m.id, lv.level));
    for (const mm of mods) {
      const n0 = calculateOperator(o, mk(o, -1, mm)).normalDps;
      for (let si = 0; si < (o.skills || []).length; si++) {
        const r = calculateOperator(o, mk(o, si, mm));
        if (r.normalDps === null || r.isPermanent) continue;
        near(r.normalDps, n0, 0.02, `${o.name} S${si + 1} 常态=无技能态`);
      }
    }
  }
}
console.log('推击手: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
