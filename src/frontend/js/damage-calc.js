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
  'char_120_hibisc': 0,  // 芙蓉「治疗力提升」：精1 Lv1 起 +4%，Lv55 起 +8%
  'char_4163_rosesa': 0, // 瑰盐：攻击 -5%（治疗代价换倍率，见 TALENT_HEAL_DRIVERS）
  'char_348_ceylon': 0   // 锡兰「湖畔漫步者」：只取默认档 [common].atk（+3%~6% 随精化/潜能5 增强），水地形 [map] 档不计
};

// 常驻治疗倍率天赋驱动表（blackboard.heal_scale 为治疗量乘数）。
// 治疗干员所有治疗量（普攻/技能期/触发）都乘此倍率；无天赋/未解锁 → 1。
const TALENT_HEAL_DRIVERS = {
  'char_4163_rosesa': 0 // 瑰盐：治疗量 +5%~+17%（随精化/潜能5 增强）
};

/**
 * 常驻治疗倍率天赋：按精化阶段/潜能匹配候选，返回治疗量乘数（无天赋/未解锁 → 1）。
 * 候选含潜能档（瑰盐每精化档 pot0/pot4 两条），需 requiredPotentialRank 过滤。
 */
function calcTalentHealScale(op, slotData) {
  const talentIndex = TALENT_HEAL_DRIVERS[op.id];
  if (talentIndex === undefined) return 1;
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 1;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let scale = null;
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const hs = cand.blackboard && typeof cand.blackboard.heal_scale === 'number' ? cand.blackboard.heal_scale : 0;
      if (hs > 0 && (scale === null || hs > scale)) scale = hs;
    }
  }
  return scale === null ? 1 : scale;
}

// 查驱动表，返回常驻加攻天赋在当前精英化/等级下的直接乘算加数（0 表示无此天赋或未生效）。
function calcTalentAtkBonus(op, slotData) {
  const talentIndex = TALENT_ATK_DRIVERS[op.id];
  if (talentIndex === undefined) return 0;
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 0;
  const elite = slotData.elite;
  const level = slotData.level;
  const pot = slotData.potentialRank || 0;
  let bonus = null;   // null=未匹配；负值天赋（如瑰盐 -5%）也必须采纳
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && level >= (cand.level || 1) && candPot <= pot) {
      let atk = 0;
      if (cand.blackboard) {
        // 特殊键天赋（锡兰「湖畔漫步者」ceylon_t_1[common].atk）：只取默认档，忽略 [map] 等环境档
        const commonKey = Object.keys(cand.blackboard).find(k => k.endsWith('[common].atk'));
        if (commonKey !== undefined) atk = cand.blackboard[commonKey];
        else if (typeof cand.blackboard.atk === 'number') atk = cand.blackboard.atk;
      }
      if (bonus === null || atk > bonus) bonus = atk;
    }
  }
  return bonus === null ? 0 : bonus;
}

const MODULE_ATTR_MAP = { max_hp: 'maxHp', atk: 'atk', def: 'def', magic_resistance: 'magicResistance', attack_speed: 'attackSpeed' };

// 视作永续开关的技能：数据 skillDuration=-1 是弹药/结束机制占位，按指定口径不建模该机制。
// 流明「灯火不灭」：默认治疗单位无异常状态 → 耗弹强化（heal_scale×2）不计算，只留 atk+攻速 buff，技能无限持续（可手动关闭）。
const PERMANENT_OVERRIDES = {
  'char_4042_lumen': [2]
};

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

// 常驻攻击速度天赋驱动表（blackboard.attack_speed 为直接加算的攻速值，100 基准上加算）。
// key: 干员 id；value: 攻速天赋在 op.talents 数组中的索引。
const TALENT_SPD_DRIVERS = {
  'char_147_shining': 1,  // 闪灵「法典」：精二起 攻速+10，潜能3 起 +13
  'char_108_silent': 0   // 赫默「医疗支援」：在场全体医疗攻速+6/8（精一），+12/14（精二）；自身必得
};

// 查驱动表，返回常驻攻速天赋的攻速加算值（0 表示无此天赋或未解锁）。
function calcTalentAttackSpeed(op, slotData) {
  const talentIndex = TALENT_SPD_DRIVERS[op.id];
  if (talentIndex === undefined) return 0;
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 0;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const aspd = cand.blackboard && typeof cand.blackboard.attack_speed === 'number' ? cand.blackboard.attack_speed : 0;
      if (aspd > best) best = aspd;
    }
  }
  return best;
}

// 当前模组的指定等级数据（含 attributeBlackboard / talentEnhance）；无模组或等级不存在返回 null。
function getModuleLevelData(op, slotData) {
  const m = slotData.module;
  if (!m) return null;
  const mod = (op.modules || []).find(x => x.id === m.moduleId);
  if (!mod) return null;
  return (mod.levels || []).find(l => l.level === m.moduleLevel) || null;
}

/**
 * 模组对天赋的强化（部分干员效果模组等级≥2 时更新天赋数值/附加效果）。
 * 返回 { attackSpeed: null|number, extraAtkMul: number }：
 * - attackSpeed：若强化候选覆盖了攻速类天赋（如闪灵X模组 L2 法典 10→15），取按潜能匹配的最大值；否则 null（走基础天赋）。
 * - extraAtkMul：强化候选里附加的常态攻击乘算（如闪灵X模组「装备技能2时攻击+X%」）；
 *   判定放调用侧（该乘算只对特定技能组合生效）。
 */
function calcModuleTalentEnhance(op, slotData) {
  const out = { attackSpeed: null, extraAtkMul: 0, healScale: 1 };
  const lv = getModuleLevelData(op, slotData);
  if (!lv || !lv.talentEnhance || lv.talentEnhance.length === 0) return out;
  const pot = slotData.potentialRank || 0;
  let bestAspd = null;
  let extraAtk = 0;
  let healScale = 1;
  for (const cand of lv.talentEnhance) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (candPot > pot) continue;
    const bb = cand.blackboard || {};
    if (typeof bb.attack_speed === 'number' && (bestAspd === null || bb.attack_speed > bestAspd)) bestAspd = bb.attack_speed;
    if (typeof bb.atk === 'number' && bb.atk > extraAtk) extraAtk = bb.atk;
    // 天赋强化的治疗倍率（如夜莺 X 模组强化「白恶魔的庇护」：范围内友方受疗 +3%/+5%）。
    // 治疗目标必在攻击范围内才能被治疗，故该光环直接放大自身治疗数值。
    if (typeof bb.heal_scale === 'number' && bb.heal_scale > healScale) healScale = bb.heal_scale;
  }
  out.attackSpeed = bestAspd;
  out.extraAtkMul = extraAtk;
  out.healScale = healScale;
  return out;
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
  // 模组天赋强化：X模组 L2 把「法典」攻速覆盖为 15/18；Y 模组走基础天赋（10/13）。
  const enh = calcModuleTalentEnhance(op, slotData);
  const talentAspd = enh.attackSpeed !== null ? enh.attackSpeed : calcTalentAttackSpeed(op, slotData);
  // 附加常态攻击乘算：闪灵 X模组≥2级 且装备 2技能（自动掩护）时，面板攻击 ×(1+0.15/0.25) 直接乘算。
  // 与携带技能的 atk 乘算互斥（带 atk 的信条/教条力场 ≠ 2技能），并入同乘区累加。
  const extraAtkMul = (enh.extraAtkMul && slotData.skillIndex === 1) ? enh.extraAtkMul : 0;
  let panelAtk = rawAtk * (1 + talentAtk + extraAtkMul);
  let panelDef = rawDef;
  const panelHp = baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp + mod.maxHp;

  // ======== Skill Modifiers ========
  const skillIndex = slotData.skillIndex || 0;
  const skill = op.skills[skillIndex];
  const isMedic = op.profession === 'MEDIC';
  // 攻速总加成 = 天赋攻速（含模组覆盖）+ 模组白值攻速（100 基准上加算），再换算攻击间隔
  const baseAspdBonus = talentAspd + mod.attackSpeed;
  const realInterval = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus);

  // No skill: return normal stats only
  if (!skill) {
    const healScale = calcTalentHealScale(op, slotData) * (enh.healScale || 1);  // 无技能干员也乘常驻治疗倍率
    const healRatio = 1.0;
    if (isMedic) {
      const normalHeal = panelAtk * healRatio * healScale;
      return { type: 'heal', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null, skillHps: null, normalHps: normalHeal / realInterval, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk };
    }
    const isArts = op.damageType === 'arts';
    const normalDps = isArts ? calcArtsDamage(panelAtk, state.enemy.res) / realInterval : calcPhysicalDamage(panelAtk, state.enemy.def) / realInterval;
    return { type: 'damage', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps, skillHps: null, normalHps: null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk, damageType: isArts ? 'arts' : 'physical', normalDamageType: isArts ? 'arts' : 'physical' };
  }

  const levelData = getSkillLevelData(skill, slotData.skillLevel);

  let skillAtk = panelAtk;
  let skillDef = panelDef;
  let skillInterval = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus);
  let skillDuration = levelData.skillDuration || 0;
  // 手动开启的限时增益（skillDuration=-1 + duration>0，自身必然获得，如华法琳「不稳定血浆」）：
  // 视为持续型技能，技能期长度 = duration。
  if (skillDuration === -1 && levelData.duration > 0 && levelData.atk !== undefined && levelData.skillType === 'MANUAL') {
    skillDuration = levelData.duration;
  }

  const modifiers = [];
  if (levelData.atk !== undefined) modifiers.push({ value: levelData.atk, operator: 'direct_mul' });
  // attack@atk：守望者普攻攻击力加成（风絮2技能“起飞”攻击力+X%）与顶层 atk 同乘区累加
  if (levelData['attack@atk'] !== undefined) modifiers.push({ value: levelData['attack@atk'], operator: 'direct_mul' });
  if (levelData.def !== undefined) modifiers.push({ value: levelData.def, operator: 'final_mul' });
  // atk_scale：输出技能的伤害/治疗倍率。图耶「水流环」的 atk_scale 是屏障吸收倍率，
  // 其治疗部分无倍率（= 普攻治疗），故触发型一次性普攻治疗时不用 atk_scale 算 skillAtk。
  // 限定：仅医疗、手动触发、带 blackboard 持续（duration）、无 atk 加成，
  // 以区分陈「赤霄·拔刀/绝影」（近卫，伤害倍率）与焰影苇草「枯荣共息」（行医，火球伤害倍率）。
  const isOneShotHeal = isMedic && levelData.skillType === 'MANUAL' && levelData.atk_scale !== undefined && levelData.duration !== undefined && levelData.heal_scale === undefined && levelData.atk === undefined;
  if (levelData.atk_scale !== undefined && !isOneShotHeal) skillAtk = panelAtk * levelData.atk_scale;
  if (levelData.attack_speed) skillInterval = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus + levelData.attack_speed);
  // base_attack_time：负值=加算秒（白面鸮脑啡肽 -2.1 等）；(0,1) 正小数=攻击间隔倍率（"间隔缩短至 x 倍"，
  // 清流涌泉 ×0.12、安洁莉娜微粒模式 ×0.15、风笛闭膛连发 ×0.7），官方描述均为“间隔（极）大幅度缩短”。
  if (levelData.base_attack_time) {
    const bat = levelData.base_attack_time;
    skillInterval = (bat > 0 && bat < 1)
      ? calcRealInterval(phase.baseAttackTime * bat, 100 + baseAspdBonus)
      : calcRealInterval(phase.baseAttackTime + bat, 100 + baseAspdBonus);
  }
  // attack@base_attack_time：守望者普攻间隔乘算系数（风絮1技能 0.2 → 间隔 ×0.2，区别于顶层 base_attack_time 的加算秒数）
  if (levelData['attack@base_attack_time']) skillInterval = skillInterval * levelData['attack@base_attack_time'];

  if (modifiers.length > 0 || talentAtk > 0) {
    // 直接乘算累加：技能期攻击力 = 白值 × (1 + 天赋atk + 模组装备乘算 + 技能atk)
    // （extraAtkMul 仅装备特定技能时非 0，与带 atk 技能的乘算互斥，同区累加安全）
    skillAtk = calcAttribute(rawAtk, [
      { value: talentAtk, operator: 'direct_mul' },
      { value: extraAtkMul, operator: 'direct_mul' },
      ...modifiers.filter(m => m.operator === 'direct_mul')
    ]);
    skillDef = calcAttribute(rawDef, modifiers.filter(m => m.operator === 'final_mul'));
  }

  // ======== Dispatch ========
  const isToggle = levelData.isToggle || false;
  const isPermanent = levelData.isPermanent === true || (PERMANENT_OVERRIDES[op.id] || []).includes(skillIndex);
  const skillRealInterval = skillInterval;
  const isIncantationMedic = op.subProfessionId === 'incantationmedic';
  const isArts = op.damageType === 'arts';
  const isSummon = op.profession === 'TOKEN';

  const params = {
    panelAtk, baseAtk, rawAtk, talentAtk, skillAtk, panelHp, realInterval: skillRealInterval, baseInterval: phase.baseAttackTime, skillDuration,
    isToggle, isPermanent, levelData, isArts,
    isIncantationMedic, enemy: state.enemy,
    talentHealScale: calcTalentHealScale(op, slotData) * (enh.healScale || 1)  // 常驻治疗倍率（天赋 × 模组天赋强化，如瑰盐/夜莺X模组）
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
  const enh = calcModuleTalentEnhance(op, slotData);
  const talentAspd = enh.attackSpeed !== null ? enh.attackSpeed : calcTalentAttackSpeed(op, slotData);
  const extraAtkMul = (enh.extraAtkMul && slotData.skillIndex === 1) ? enh.extraAtkMul : 0;
  const attackInterval = calcRealInterval(phase.baseAttackTime, 100 + talentAspd + mod.attackSpeed);

  return {
    panelHp: Math.round(baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp + mod.maxHp),
    panelAtk: Math.round(rawAtk * (1 + talentAtk + extraAtkMul)),
    panelDef: Math.round(baseDef + trustDef + potDef + mod.def),
    magicResistance: (phase.magicResistance ?? 0) + mod.magicResistance,
    baseAttackTime: phase.baseAttackTime,
    attackInterval
  };
}

export { calculateOperator, getSkillLevelData, calcPanelStats, calcTalentAtkBonus, calcTalentAttackSpeed, calcTalentHealScale, calcModuleTalentEnhance, TALENT_ATK_DRIVERS, TALENT_HEAL_DRIVERS, TALENT_SPD_DRIVERS };
