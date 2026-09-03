// ArkDMGCalc - Main Calculation Entry
import { calcPhysicalDamage, calcArtsDamage, calcRealInterval, interpolateAttr, calcAttribute } from './calculator.js';
import { SkillType } from './operators.js';
import { state } from './state.js';
import { calcMedical, calcSummonHeal } from './medic-calc.js';
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

const MODULE_ATTR_MAP = { max_hp: 'maxHp', atk: 'atk', def: 'def', magic_resistance: 'magicResistance', attack_speed: 'attackSpeed' };

/**
 * 模组面板加成：按当前装配的模组 id+等级取该级 attributeBlackboard（数据为该等级生效后的最终加成）。
 * 证章（INITIAL 无 levels）/无模组返回全 0；attackSpeed 为攻速值增量（100 基准上加算）。
 */
function calcModuleBonus(op, slotData) {
  const bonus = { maxHp: 0, atk: 0, def: 0, magicResistance: 0, attackSpeed: 0 };
  const m = slotData.module;
  if (!m) return bonus;
  const mod = (op.modules || []).find(x => x.id === m.moduleId);
  if (!mod) return bonus;
  const lv = (mod.levels || []).find(l => l.level === m.moduleLevel);
  if (!lv) return bonus;
  for (const [k, v] of Object.entries(lv.attributeBlackboard || {})) {
    const key = MODULE_ATTR_MAP[k];
    if (key && bonus[key] !== undefined) bonus[key] += v;
  }
  return bonus;
}

function calculateOperator(op, slotData) {
  const phase = op.phases[slotData.elite] || op.phases[op.phases.length - 1];
  const maxLevel = phase.maxLevel;
  const mod = calcModuleBonus(op, slotData);

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

  const rawAtk = baseAtk + trustAtk + potAtk + mod.atk;
  const rawDef = baseDef + trustDef + potDef + mod.def;
  const talentAtk = calcTalentAtkBonus(op, slotData);
  let panelAtk = rawAtk * (1 + talentAtk);
  let panelDef = rawDef;
  const panelHp = baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp + mod.maxHp;

  // ======== Skill Modifiers ========
  const skillIndex = slotData.skillIndex || 0;
  const skill = op.skills[skillIndex];
  const isMedic = op.profession === 'MEDIC';
  // 常态攻击间隔：攻速基准 100，模组 attackSpeed 增量加算后换算（无模组加成时 = baseAttackTime）
  const realInterval = calcRealInterval(phase.baseAttackTime, 100 + mod.attackSpeed);

  // No skill: return normal stats only
  if (!skill) {
    const healRatio = 1.0;
    if (isMedic) {
      const normalHeal = panelAtk * healRatio;
      return { type: 'heal', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null, skillHps: null, normalHps: normalHeal / realInterval, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk };
    }
    const isArts = op.damageType === 'arts';
    const normalDps = isArts ? calcArtsDamage(panelAtk, state.enemy.res) / realInterval : calcPhysicalDamage(panelAtk, state.enemy.def) / realInterval;
    return { type: 'damage', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps, skillHps: null, normalHps: null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk, normalDamageType: isArts ? 'arts' : 'physical' };
  }

  const levelData = getSkillLevelData(skill, slotData.skillLevel);

  let skillAtk = panelAtk;
  let skillDef = panelDef;
  let skillInterval = calcRealInterval(phase.baseAttackTime, 100 + mod.attackSpeed);
  let skillDuration = levelData.skillDuration || 0;
  // 手动开启的限时增益（skillDuration=-1 + duration>0，自身必然获得，如华法琳「不稳定血浆」）：
  // 视为持续型技能，技能期长度 = duration。
  if (skillDuration === -1 && levelData.duration > 0 && levelData.atk !== undefined && levelData.skillType === 'MANUAL') {
    skillDuration = levelData.duration;
  }

  const modifiers = [];
  if (levelData.atk !== undefined) modifiers.push({ value: levelData.atk, operator: 'direct_mul' });
  if (levelData.def !== undefined) modifiers.push({ value: levelData.def, operator: 'final_mul' });
  // atk_scale：输出技能的伤害/治疗倍率。图耶「水流环」的 atk_scale 是屏障吸收倍率，
  // 其治疗部分无倍率（= 普攻治疗），故触发型一次性普攻治疗时不用 atk_scale 算 skillAtk。
  // 限定：仅医疗、手动触发、带 blackboard 持续（duration）、无 atk 加成，
  // 以区分陈「赤霄·拔刀/绝影」（近卫，伤害倍率）与焰影苇草「枯荣共息」（行医，火球伤害倍率）。
  const isOneShotHeal = isMedic && levelData.skillType === 'MANUAL' && levelData.atk_scale !== undefined && levelData.duration !== undefined && levelData.heal_scale === undefined && levelData.atk === undefined;
  if (levelData.atk_scale !== undefined && !isOneShotHeal) skillAtk = panelAtk * levelData.atk_scale;
  if (levelData.attack_speed) skillInterval = calcRealInterval(phase.baseAttackTime, 100 + mod.attackSpeed + levelData.attack_speed);
  if (levelData.base_attack_time) skillInterval = calcRealInterval(phase.baseAttackTime + levelData.base_attack_time, 100 + mod.attackSpeed);

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
  const isSummon = op.profession === 'TOKEN';

  const params = {
    panelAtk, baseAtk, rawAtk, talentAtk, skillAtk, panelHp, realInterval: skillRealInterval, baseInterval: phase.baseAttackTime, skillDuration,
    isToggle, isPermanent, levelData, isArts,
    isIncantationMedic, enemy: state.enemy
  };

  let result;
  // 召唤物路由：带独立技能（非 skcom_ 通用被动）的召唤物按技能语义走伤害/治疗计算
  // （如凯尔希·Mon3tr 攻击型召唤物，技能由持有者注入）；无独立技能的召唤物（如医疗探机）走治疗型 calcSummonHeal。
  const hasRealSkills = (op.skills || []).some(s => s.skillId && !String(s.skillId).startsWith('skcom_'));
  if (isSummon && !hasRealSkills) {
    result = calcSummonHeal(params);
  } else if (isMedic) {
    result = calcMedical(params);
  } else {
    result = calcDamage(params);
  }

  if (skill.type === SkillType.HEAL) {
    const healPercent = levelData.heal_percent || 0;
    const hps = panelHp * (1 + healPercent) / (skillDuration || 1);
    return { type: 'heal', hps, totalHeal: hps * (skillDuration || 1), panelAtk };
  }

  // 伤害类型：技能内判定优先（calcDamage 对真实/物理/法术逐技能给出）。
  // 医疗无普攻伤害，伤害由技能决定（咒愈师、亚叶复合弹片为法术）。
  let damageType = result.damageType || null;
  if (isMedic) {
    if (!damageType && (isIncantationMedic || (levelData['attack@heal_scale'] !== undefined && levelData['attack@atk_scale'] !== undefined))) {
      damageType = 'arts';
    }
  } else if (damageType === null && !isSummon) {
    damageType = op.damageType || 'physical';
  }

  const isHealType = isMedic || (result.totalHeal !== null && result.totalHeal !== undefined);
  return { ...result, type: isHealType ? 'heal' : 'damage', damageType, isToggle, isPermanent, realInterval: skillRealInterval, panelAtk: skillAtk };
}

/**
 * 计算干员面板基础属性（精英化/等级/信赖/潜能加成后）
 * @returns {Object} { panelHp, panelAtk, panelDef, attackSpeed, baseAttackTime }
 */
function calcPanelStats(op, slotData) {
  const phase = op.phases[slotData.elite] || op.phases[op.phases.length - 1];
  const maxLevel = phase.maxLevel;
  const mod = calcModuleBonus(op, slotData);

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

  const rawAtk = baseAtk + trustAtk + potAtk + mod.atk;
  const talentAtk = calcTalentAtkBonus(op, slotData);
  const attackInterval = calcRealInterval(phase.baseAttackTime, 100 + mod.attackSpeed);

  return {
    panelHp: Math.round(baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp + mod.maxHp),
    panelAtk: Math.round(rawAtk * (1 + talentAtk)),
    panelDef: Math.round(baseDef + trustDef + potDef + mod.def),
    magicResistance: (phase.magicResistance ?? 0) + mod.magicResistance,
    baseAttackTime: phase.baseAttackTime,
    attackInterval
  };
}

export { calculateOperator, getSkillLevelData, calcPanelStats, calcTalentAtkBonus, TALENT_ATK_DRIVERS };
