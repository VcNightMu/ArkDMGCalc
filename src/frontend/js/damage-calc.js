// ArkDMGCalc - Main Calculation Entry
import { calcPhysicalDamage, calcArtsDamage, calcRealInterval, interpolateAttr, calcAttribute } from './calculator.js';
import { SkillType } from './operators.js';
import { state } from './state.js';
import { calcMedical } from './medic-calc.js';
import { calcDamage } from './damage-ops-calc.js';

function getSkillLevelData(skill, level) {
  const levels = skill.levels;
  return levels[level] || levels[levels.length - 1];
}

// 常驻攻击力天赋驱动表。
// 此类天赋的 blackboard.atk 为「直接乘算」加数（与技能的直接乘算累加，不连乘），
// 作用于常态与技能期，随精英化/等级/潜能强化取满足条件的最高档。
// key: 干员 id；value: 常驻加攻天赋在 op.talents 数组中的索引。
const TALENT_ATK_DRIVERS = {
  'char_120_hibisc': 0  // 芙蓉「治疗力提升」：精1 Lv1 起 +4%，Lv55 起 +8%
};

// 查驱动表，返回常驻加攻天赋在当前精英化/等级下的直接乘算加数（0 表示无此天赋或未生效）。
function calcTalentAtkBonus(op, slotData) {
  const talentIndex = TALENT_ATK_DRIVERS[op.id];
  if (talentIndex === undefined) return 0;
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 0;
  const elite = slotData.elite;
  const level = slotData.level;
  let bonus = 0;
  for (const cand of talent.candidates) {
    if (cand.phase <= elite && level >= (cand.level || 1)) {
      const atk = cand.blackboard && typeof cand.blackboard.atk === 'number' ? cand.blackboard.atk : 0;
      if (atk > bonus) bonus = atk;
    }
  }
  return bonus;
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

  const rawAtk = baseAtk + trustAtk + potAtk;
  const rawDef = baseDef + trustDef + potDef;
  const talentAtk = calcTalentAtkBonus(op, slotData);
  let panelAtk = rawAtk * (1 + talentAtk);
  let panelDef = rawDef;
  const panelHp = baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp;

  // ======== Skill Modifiers ========
  const skillIndex = slotData.skillIndex || 0;
  const skill = op.skills[skillIndex];
  const isMedic = op.profession === 'MEDIC';
  const realInterval = phase.baseAttackTime;

  // No skill: return normal stats only
  if (!skill) {
    const healRatio = 1.0;
    if (isMedic) {
      const normalHeal = panelAtk * healRatio;
      return { type: 'heal', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null, skillHps: null, normalHps: normalHeal / realInterval, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk };
    }
    const isArts = op.damageType === 'arts';
    const normalDps = isArts ? calcArtsDamage(panelAtk, state.enemy.res) / realInterval : calcPhysicalDamage(panelAtk, state.enemy.def) / realInterval;
    return { type: 'damage', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps, skillHps: null, normalHps: null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk };
  }

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
  if (levelData.base_attack_time) skillInterval = phase.baseAttackTime + levelData.base_attack_time;

  if (modifiers.length > 0 || talentAtk > 0) {
    // 直接乘算累加：技能期攻击力 = 白值 × (1 + 天赋atk + 技能atk)
    skillAtk = calcAttribute(rawAtk, [
      { value: talentAtk, operator: 'direct_mul' },
      ...modifiers.filter(m => m.operator === 'direct_mul')
    ]);
    skillDef = calcAttribute(rawDef, modifiers.filter(m => m.operator === 'final_mul'));
  }

  // ======== Dispatch ========
  const isToggle = levelData.isToggle || false;
  const isPermanent = levelData.isPermanent || false;
  const skillRealInterval = skillInterval;
  const isIncantationMedic = op.subProfessionId === 'incantationmedic';
  const isArts = op.damageType === 'arts';

  const params = {
    panelAtk, baseAtk, skillAtk, realInterval: skillRealInterval, baseInterval: phase.baseAttackTime, skillDuration,
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

  return { ...result, type: isMedic ? 'heal' : 'damage', isToggle, isPermanent, realInterval: skillRealInterval, panelAtk: skillAtk };
}

/**
 * 计算干员面板基础属性（精英化/等级/信赖/潜能加成后）
 * @returns {Object} { panelHp, panelAtk, panelDef, attackSpeed, baseAttackTime }
 */
function calcPanelStats(op, slotData) {
  const phase = op.phases[slotData.elite] || op.phases[op.phases.length - 1];
  const maxLevel = phase.maxLevel;

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

  const rawAtk = baseAtk + trustAtk + potAtk;
  const talentAtk = calcTalentAtkBonus(op, slotData);

  return {
    panelHp: Math.round(baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp),
    panelAtk: Math.round(rawAtk * (1 + talentAtk)),
    panelDef: Math.round(baseDef + trustDef + potDef),
    magicResistance: phase.magicResistance ?? 0,
    baseAttackTime: phase.baseAttackTime
  };
}

export { calculateOperator, getSkillLevelData, calcPanelStats, calcTalentAtkBonus, TALENT_ATK_DRIVERS };
