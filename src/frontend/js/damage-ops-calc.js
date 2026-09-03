// ArkDMGCalc - Damage Operator Calculations
import { calcPhysicalDamage, calcArtsDamage, calcTrueDamage } from './calculator.js';
import { calcCycleDps } from './medic-calc.js';

/**
 * Calculate pure damage operator (non-medical)
 * @returns {Object} damage metrics
 */
function calcDamage(params) {
  const { panelAtk, skillAtk, rawAtk, talentAtk, realInterval, skillDuration, isToggle, isPermanent, levelData, isArts, normalTypeArts, hitMul = 1, talentDmgMul = 1, enemy } = params;

  const isTrue = levelData.trueDamage === true;
  const isDecay = levelData.atkDecay === true && levelData.atk !== undefined;

  // 技能期单次命中伤害：真实伤害无减免(凯尔希·Mon3tr 3技能)；常态普攻伤害类型不变(物理/法术)。
  // hitMul：技能期每击伤害乘子(暮落 S2 六连发 attack@atk_scale×attack@times；斩业星熊 S3 二连击 MULTI_HIT)。
  // talentDmgMul：常驻伤害乘区(勇冠三军等),物理/法术/真伤一律乘。
  const skillHitDamage = (atk) => { const h = isTrue ? calcTrueDamage(atk) : (isArts ? calcArtsDamage(atk, enemy.res) : calcPhysicalDamage(atk, enemy.def)); return h * hitMul * talentDmgMul; };
  // 常态普攻类型由职业决定(normalTypeArts=op.damageType==='arts')；技能开启切法伤的技能(年 S1/驭法铁卫)不改常态
  const normalHitDamage = (normalTypeArts ? calcArtsDamage(panelAtk, enemy.res) : calcPhysicalDamage(panelAtk, enemy.def)) * talentDmgMul;
  const singleHitDamage = skillHitDamage(skillAtk);

  let skillDps, skillTotalDamage, cycleDps = null, normalDps = null;
  let skillAttacks;

  if (isToggle || isPermanent) {
    skillAttacks = 0;
    skillTotalDamage = 0;
    skillDps = singleHitDamage / realInterval;
  } else if (skillDuration > 0 && isDecay) {
    // 攻击力增幅随时间线性衰减(从 levelData.atk 衰减至 0,衰减到面板攻击力)。
    // 按每次攻击时刻(第 0 秒、第 interval 秒、第 2×interval 秒......)的即时攻击力逐次结算总伤与平均 DPS。
    // 即时攻击力 = rawAtk × (1 + 天赋atk + 剩余增幅);直接乘算加算,不连乘。
    skillAttacks = Math.max(1, Math.floor(skillDuration / realInterval));
    let total = 0;
    for (let i = 0; i < skillAttacks; i++) {
      const t = i * realInterval;
      const bonus = levelData.atk * (1 - t / skillDuration);
      total += skillHitDamage(rawAtk * (1 + (talentAtk || 0) + bonus));
    }
    skillTotalDamage = total;
    skillDps = total / skillDuration;
    normalDps = normalHitDamage / realInterval;
  } else if (skillDuration > 0) {
    skillAttacks = Math.floor(skillDuration / realInterval);
    skillTotalDamage = singleHitDamage * skillAttacks;
    skillDps = skillTotalDamage / skillDuration;
    normalDps = normalHitDamage / realInterval;
  } else {
    skillAttacks = 1;
    skillTotalDamage = singleHitDamage;
    skillDps = 0;
    cycleDps = calcCycleDps(levelData, realInterval, normalHitDamage, singleHitDamage);
  }

  return {
    skillDps, skillTotalDamage, cycleDps, normalDps, skillHps: null, normalHps: null, totalHeal: null,
    damageType: isTrue ? 'true' : (isArts ? 'arts' : 'physical'),
    // 常态普攻伤害类型:真伤只作用于技能期,常态仍为职业普攻类型(物理/法术)
    normalDamageType: skillDuration > 0 ? (normalTypeArts ? 'arts' : 'physical') : null,
    // 伤害类型拆分(规范化混合伤害):每种>0的类型一档,UI 逐类型渲染只显示有值的部分
    dmgTypes: {
      [isTrue ? 'true' : (isArts ? 'arts' : 'physical')]: { skillDps, skillTotalDamage, cycleDps },
    },
  };
}

export { calcDamage };
