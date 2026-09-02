// ArkDMGCalc - Medical Operator Calculations
import { calcArtsDamage } from './calculator.js';

/**
 * Calculate pure medical operator (physician/ringhealer/healer/wandermedic)
 * @returns {Object} healing metrics
 */
function calcMedical(params) {
  const { panelAtk, baseAtk, skillAtk, realInterval, skillDuration, isToggle, isPermanent, levelData, isIncantationMedic } = params;

  if (isIncantationMedic) return calcIncantationMedic(params);

  const healRatio = levelData.heal_ratio || 1.0;
  const singleHeal = panelAtk * healRatio;
  const normalHeal = baseAtk * healRatio;

  const normalHps = normalHeal / realInterval;
  let skillHps, totalHeal;

  if (isToggle || isPermanent) {
    skillHps = singleHeal / realInterval;
    totalHeal = null;
  } else if (skillDuration > 0) {
    skillHps = singleHeal / realInterval;
    const skillHealAttacks = Math.floor(skillDuration / realInterval);
    totalHeal = singleHeal * skillHealAttacks;
  } else {
    skillHps = 0;
    totalHeal = singleHeal;
  }

  return {
    skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null,
    skillHps, normalHps, totalHeal
  };
}

/**
 * Calculate incantation medic (arts damage + healing from damage)
 * @returns {Object} combined damage + healing metrics
 */
function calcIncantationMedic(params) {
  const { panelAtk, skillAtk, realInterval, skillDuration, isToggle, isPermanent, levelData, enemy } = params;

  const healScale = levelData.scale || 0.5;
  const singleHitDamage = calcArtsDamage(skillAtk, enemy.res);
  const normalHitDamage = calcArtsDamage(panelAtk, enemy.res);
  const singleHealFromDamage = singleHitDamage * healScale;
  const normalHealFromDamage = normalHitDamage * healScale;

  const normalHps = normalHealFromDamage / realInterval;
  let skillDps, skillHps, skillTotalDamage, totalHeal, cycleDps = null;
  let skillAttacks;

  if (isToggle || isPermanent) {
    skillDps = singleHitDamage / realInterval;
    skillHps = singleHealFromDamage / realInterval;
    skillTotalDamage = 0;
    totalHeal = null;
  } else if (skillDuration > 0) {
    skillAttacks = Math.floor(skillDuration / realInterval);
    skillTotalDamage = singleHitDamage * skillAttacks;
    skillDps = skillTotalDamage / skillDuration;
    skillHps = singleHealFromDamage / realInterval;
    totalHeal = singleHealFromDamage * skillAttacks;
  } else {
    skillTotalDamage = singleHitDamage;
    skillDps = 0;
    skillHps = 0;
    totalHeal = singleHealFromDamage;
    cycleDps = calcCycleDps(levelData, realInterval, normalHitDamage, singleHitDamage);
  }

  return { skillDps, skillTotalDamage, cycleDps, normalDps: null, skillHps, normalHps, totalHeal };
}

// ======== Common ========

function calcCycleDps(levelData, realInterval, normalHitDamage, singleHitDamage) {
  const spCost = levelData.spCost || 0;
  const spType = levelData.spType || 'INCREASE_WITH_TIME';

  if (spType === 'INCREASE_WHEN_ATTACK') {
    const increment = levelData.attackIncrement || 1;
    const attacksToCharge = Math.ceil(spCost / increment);
    const cycleAttacks = attacksToCharge + 1;
    const cycleTime = cycleAttacks * realInterval;
    return cycleTime > 0 ? ((attacksToCharge * normalHitDamage) + singleHitDamage) / cycleTime : 0;
  } else {
    const attacksDuringCharge = Math.floor(spCost / realInterval);
    const cycleDamage = (attacksDuringCharge * normalHitDamage) + singleHitDamage;
    return spCost > 0 ? cycleDamage / spCost : 0;
  }
}

export { calcMedical, calcIncantationMedic, calcCycleDps };
