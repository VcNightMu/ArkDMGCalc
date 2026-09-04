// ArkDMGCalc - Damage Operator Calculations
import { calcPhysicalDamage, calcArtsDamage, calcTrueDamage } from './calculator.js';
import { calcCycleDps } from './medic-calc.js';

/**
 * Calculate pure damage operator (non-medical)
 * @returns {Object} damage metrics
 */
function calcDamage(params) {
  const { panelAtk, skillAtk, rawAtk, talentAtk, realInterval, skillDuration, isToggle, isPermanent, levelData, isArts, normalTypeArts, hitMul = 1, talentDmgMul = 1, enemy, isWeakness = false } = params;

  const isTrue = levelData.trueDamage === true;
  const isDecay = levelData.atkDecay === true && levelData.atk !== undefined;

  // 弱点伤害(赤刃明霄陈「形意洞照」):物理/法术各按目标防御/法抗结算一次,取伤害更高者,
  // 类型按实际赢家。注意 atk-def 与 atk×(100-res)/100 在攻击力跨阈值时会翻转(def600/res50 时 atk=1200 两式相等)。
  const weakPhys = (atk) => calcPhysicalDamage(atk, enemy.def);
  const weakArts = (atk) => calcArtsDamage(atk, enemy.res);
  const weakHit = (atk) => Math.max(weakPhys(atk), weakArts(atk));
  const weakType = (atk) => (weakPhys(atk) >= weakArts(atk) ? 'physical' : 'arts');

  // 技能期单次命中伤害：真实伤害无减免(凯尔希·Mon3tr 3技能)；弱点伤害逐击取物法更高。
  // hitMul：技能期每击伤害乘子(暮落 S2 六连发 attack@atk_scale×attack@times；斩业星熊 S3 二连击 MULTI_HIT)。
  // talentDmgMul：常驻伤害乘区(勇冠三军等),物理/法术/真伤一律乘。
  const skillHitDamage = (atk) => { const h = isTrue ? calcTrueDamage(atk) : (isWeakness ? weakHit(atk) : (isArts ? calcArtsDamage(atk, enemy.res) : calcPhysicalDamage(atk, enemy.def))); return h * hitMul * talentDmgMul; };
  // 常态普攻类型由职业决定(normalTypeArts=op.damageType==='arts')；弱点常态同样逐击取优
  const normalHitDamage = (isWeakness ? weakHit(panelAtk) : (normalTypeArts ? calcArtsDamage(panelAtk, enemy.res) : calcPhysicalDamage(panelAtk, enemy.def))) * talentDmgMul;
  const singleHitDamage = skillHitDamage(skillAtk);
  // 弱点技能期伤害类型:按技能期攻击力实际赢家(攻击力恒定时逐击同型;衰减技能逐击翻转罕见,取首击口径)
  const skillDmgType = isTrue ? 'true' : (isWeakness ? weakType(skillAtk) : (isArts ? 'arts' : 'physical'));
  const normalDmgType = isWeakness ? weakType(panelAtk) : (normalTypeArts ? 'arts' : 'physical');

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
    damageType: skillDmgType,
    // 常态普攻伤害类型:真伤只作用于技能期,常态仍为职业普攻类型(物理/法术)
    normalDamageType: skillDuration > 0 ? normalDmgType : null,
    // 伤害类型拆分(规范化混合伤害):每种>0的类型一档,UI 逐类型渲染只显示有值的部分
    dmgTypes: {
      [skillDmgType]: { skillDps, skillTotalDamage, cycleDps },
    },
  };
}

export { calcDamage };
