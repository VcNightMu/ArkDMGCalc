// ArkDMGCalc - Main Calculation Entry
import { calcRealInterval, interpolateAttr, calcAttribute } from './calculator.js';
import { SkillType } from './operators.js';
import { state } from './state.js';
import { calcMedical } from './medic-calc.js';
import { calcDamage } from './damage-ops-calc.js';

function getSkillLevelData(skill, level) {
  const levels = skill.levels;
  return levels[level] || levels[levels.length - 1];
}

function calculateOperator(op, slotData) {
  const phase = op.phases[slotData.elite] || op.phases[op.phases.length - 1];
  const maxLevel = phase.maxLevel;

  // ======== Panel Stats ========
  const baseAtk = interpolateAttr(phase.atk[0], phase.atk[1], slotData.level, maxLevel);
  const baseDef = interpolateAttr(phase.def[0], phase.def[1], slotData.level, maxLevel);
  const baseHp = interpolateAttr(phase.maxHp[0], phase.maxHp[1], slotData.level, maxLevel);

  const trustAtk = op.trustBonus.atk * (slotData.trustPercent / 100);
  const trustDef = op.trustBonus.def * (slotData.trustPercent / 100);

  let potAtk = 0, potDef = 0, potHp = 0;
  const potRank = slotData.potentialRank || 0;
  if (potRank > 0 && op.potentialRanks) {
    for (let i = 0; i < Math.min(potRank, op.potentialRanks.length); i++) {
      for (const m of (op.potentialRanks[i].modifiers || [])) {
        if (m.attr === 'ATK' && m.formula === 'ADDITION') potAtk += m.value;
        if (m.attr === 'DEF' && m.formula === 'ADDITION') potDef += m.value;
        if (m.attr === 'MAX_HP' && m.formula === 'ADDITION') potHp += m.value;
      }
    }
  }

  let panelAtk = baseAtk + trustAtk + potAtk;
  let panelDef = baseDef + trustDef + potDef;
  const panelHp = baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp;

  // ======== Skill Modifiers ========
  const skillIndex = slotData.skillIndex || 0;
  const skill = op.skills[skillIndex];
  if (!skill) return { type: 'unknown', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null, skillHps: null, normalHps: null, totalHeal: null, realInterval: phase.baseAttackTime, panelAtk };

  const levelData = getSkillLevelData(skill, slotData.skillLevel);

  let skillAtk = panelAtk;
  let skillDef = panelDef;
  let skillInterval = phase.baseAttackTime;
  let skillDuration = levelData.duration || 0;

  const modifiers = [];
  if (levelData.atk !== undefined) modifiers.push({ value: levelData.atk, operator: 'direct_mul' });
  if (levelData.def !== undefined) modifiers.push({ value: levelData.def, operator: 'final_mul' });
  if (levelData.atk_scale !== undefined) skillAtk = panelAtk * levelData.atk_scale;
  if (levelData.attack_speed) skillInterval = calcRealInterval(phase.baseAttackTime, 100 + levelData.attack_speed);
  if (levelData.base_attack_time) skillInterval = levelData.base_attack_time;

  if (modifiers.length > 0) {
    skillAtk = calcAttribute(panelAtk, modifiers.filter(m => m.operator === 'direct_mul'));
    skillDef = calcAttribute(panelDef, modifiers.filter(m => m.operator === 'final_mul'));
  }

  // ======== Dispatch ========
  const isToggle = levelData.isToggle || false;
  const isPermanent = levelData.isPermanent || false;
  const realInterval = skillInterval;
  const isMedic = op.profession === 'MEDIC';
  const isIncantationMedic = op.subProfessionId === 'incantationmedic';
  const isArts = op.damageType === 'arts';

  const params = {
    panelAtk, baseAtk, skillAtk, realInterval, skillDuration,
    isToggle, isPermanent, levelData, isArts,
    isIncantationMedic, enemy: state.enemy
  };

  let result;
  if (isMedic) {
    result = calcMedical(params);
  } else {
    result = calcDamage(params);
  }

  if (skill.type === SkillType.HEAL) {
    const healPercent = levelData.heal_percent || 0;
    const hps = panelHp * (1 + healPercent) / (skillDuration || 1);
    return { type: 'heal', hps, totalHeal: hps * (skillDuration || 1), panelAtk };
  }

  return { ...result, type: isMedic ? 'heal' : 'damage', isToggle, isPermanent, realInterval, panelAtk: skillAtk };
}

export { calculateOperator, getSkillLevelData };
