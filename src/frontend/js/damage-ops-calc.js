// ArkDMGCalc - Damage Operator Calculations
import { calcPhysicalDamage, calcArtsDamage } from './calculator.js';
import { calcCycleDps } from './medic-calc.js';

/**
 * Calculate pure damage operator (non-medical)
 * @returns {Object} damage metrics
 */
function calcDamage(params) {
  const { panelAtk, skillAtk, realInterval, skillDuration, isToggle, isPermanent, levelData, isArts, enemy } = params;

  const singleHitDamage = isArts ? calcArtsDamage(skillAtk, enemy.res) : calcPhysicalDamage(skillAtk, enemy.def);
  const normalHitDamage = isArts ? calcArtsDamage(panelAtk, enemy.res) : calcPhysicalDamage(panelAtk, enemy.def);

  let skillDps, skillTotalDamage, cycleDps = null, normalDps = null;
  let skillAttacks;

  if (isToggle || isPermanent) {
    skillAttacks = 0;
    skillTotalDamage = 0;
    skillDps = singleHitDamage / realInterval;
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

  return { skillDps, skillTotalDamage, cycleDps, normalDps, skillHps: null, normalHps: null, totalHeal: null };
}

export { calcDamage };
