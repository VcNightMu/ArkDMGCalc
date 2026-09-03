// ArkDMGCalc - Medical Operator Calculations
import { calcArtsDamage } from './calculator.js';

/**
 * Calculate pure medical operator (physician/ringhealer/healer/wandermedic)
 * @returns {Object} healing metrics
 */
function calcMedical(params) {
  const { panelAtk, skillAtk, realInterval, baseInterval, skillDuration, isToggle, isPermanent, levelData, isIncantationMedic } = params;

  if (isIncantationMedic) return calcIncantationMedic(params);

  // 独立治疗 + 独立伤害（亚叶「复合型药物弹片」）：攻击变为弹片，
  // 每次攻击同时治疗（攻击力 × heal_scale）并造成法术伤害（攻击力 × atk_scale），两者完全独立。
  if (levelData['attack@heal_scale'] !== undefined && levelData['attack@atk_scale'] !== undefined) {
    return calcDualMedic(params);
  }

  // 最大生命百分比触发型治疗（华法琳「紧急包扎」）：攻击回复 + 自动触发，
  // 额外回复目标最大生命值 hp_ratio 比例（计算器默认目标为自身，取 panelHp）。
  if (levelData.hp_ratio !== undefined && levelData.heal_scale === undefined && levelData.spType === 'INCREASE_WHEN_ATTACK') {
    return calcHpRatioTriggerHeal(params);
  }

  // 触发型治疗：嘉维尔「活力再生」持续增益（heal_scale+interval+duration）、
  // 末药/录武官「二重治疗/触类旁通」一次性额外治疗（heal_scale，无 interval）、
  // 图耶「水流环」一次性普攻治疗（MANUAL + atk_scale 屏障标记，无 atk 加成）。
  // 图耶强心剂/Touch 等带 atk 加成的技能机制不同，不在此列。
  const isTriggerHeal =
    (levelData.heal_scale !== undefined && levelData.atk === undefined) ||
    (levelData.skillType === 'MANUAL' && levelData.atk_scale !== undefined && levelData.atk === undefined);
  if (isTriggerHeal) {
    return calcTriggerHeal(params);
  }

  // 常驻治疗倍率（天赋，如瑰盐 ×1.05~1.17）作用于所有治疗量：
  // 普攻治疗与技能期治疗（skillAtk 为面板或技能乘算后攻击力）同乘。
  const healScale = params.talentHealScale ?? 1;
  const healRatio = (levelData.heal_ratio || 1.0) * healScale;
  const singleHeal = skillAtk * healRatio;
  const normalHeal = panelAtk * healRatio;

  const normalHps = normalHeal / baseInterval;
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
 * 触发型治疗，分两类：
 * 1. 持续增益型（嘉维尔「活力再生」）：施加增益每秒回复，持续 duration 秒。
 * 2. 一次性额外型（末药「二重治疗」/录武官「触类旁通」）：触发时额外治疗一名单位。
 * 两类均自动回复，按充能 + 增益持续（或触发瞬间）循环计算总治疗量与周期 HPS。
 */
function calcTriggerHeal(params) {
  const { panelAtk, skillAtk, baseInterval, levelData } = params;

  const healScale = levelData.heal_scale ?? 1;     // 治疗量比例；无 heal_scale 时默认 1（一次普攻治疗）
  const interval = levelData.interval || 1;        // 回复间隔（秒），仅持续型有
  const buffDuration = levelData.duration || 0;    // 增益持续秒数，仅持续型有
  const spCost = levelData.spCost || 0;
  const spType = levelData.spType || 'INCREASE_WITH_TIME';
  const skillType = levelData.skillType || 'MANUAL'; // AUTO=自动触发, MANUAL=手动触发
  const isSustained = levelData.interval !== undefined; // true=持续增益型，false=一次性额外型

  const talentScale = params.talentHealScale ?? 1; // 常驻治疗倍率（天赋，如瑰盐）
  const normalHeal = panelAtk * 1.0 * talentScale; // 1 次常态治疗（医师 heal_ratio 默认 1.0）
  const normalHps = normalHeal / baseInterval;   // 常态 HPS

  // 技能额外提供的治疗量
  let totalHeal;
  if (isSustained) {
    const tickHeal = skillAtk * healScale * talentScale;                 // 每次回复量（技能 heal_scale × 天赋倍率）
    const tickCount = Math.floor(buffDuration / interval); // 回复次数
    totalHeal = tickHeal * tickCount;                      // 总治疗量
  } else {
    totalHeal = skillAtk * healScale * talentScale;                      // 触发时一次性额外治疗
  }

  let cycleHps = null;
  if (spType === 'INCREASE_WITH_TIME' && spCost > 0) {
    // 自动触发：触发时机是 sp 蓄满后的下一次普攻，蓄满到下次普攻之间多攒的 sp 被吞（延迟）。
    // 手动触发：玩家卡普攻瞬间释放，无延迟。
    let delay = 0;
    if (skillType === 'AUTO' && baseInterval > 0) {
      delay = Math.ceil(spCost / baseInterval) * baseInterval - spCost;
      if (delay < 0) delay = 0; // 浮点误差保护
    }
    // 持续型周期含增益持续；一次性型周期仅充能 + 延迟（触发即生效，无后续持续）
    const cycleTime = spCost + delay + (isSustained ? buffDuration : 0);
    // 全程普攻治疗不中断（充能/延迟/增益期间都在普攻），额外治疗叠加
    cycleHps = cycleTime > 0 ? (normalHps * cycleTime + totalHeal) / cycleTime : 0;
  }

  return {
    skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null,
    skillHps: null,  // 触发型技能无持续技能期，不显示技能期 HPS
    normalHps, totalHeal, cycleHps
  };
}

/**
 * 最大生命百分比触发型治疗（华法琳「紧急包扎」）。
 * 攻击回复（INCREASE_WHEN_ATTACK，每次攻击回 1 sp）自动触发，sp 蓄满即在下一次治疗攻击上附带
 * 额外回复：目标最大生命值 × hp_ratio（计算器默认目标为自身，取干员自身最大生命 panelHp）。
 * 周期 = 蓄满 spCost 所需的攻击次数 × 攻击间隔；周期 HPS 计入全程常态普攻治疗。
 * 可充能层数（ct）仅影响技力上限，稳态下每攒满一层即触发，与触发频率无关。
 */
function calcHpRatioTriggerHeal(params) {
  const { panelAtk, panelHp, baseInterval, levelData } = params;

  const hpRatio = levelData.hp_ratio || 0;
  const spCost = levelData.spCost || 0;
  const increment = levelData.attackIncrement || 1; // 每次攻击回复 sp 数，缺省 1

  const normalHeal = panelAtk * 1.0;            // 常态普攻治疗（医师 heal_ratio = 1.0）
  const normalHps = normalHeal / baseInterval;
  const extraHeal = panelHp * hpRatio;          // 单次触发额外治疗（默认目标 = 自身）

  const attacksToCharge = Math.max(1, Math.ceil(spCost / increment));
  const cycleTime = attacksToCharge * baseInterval;   // 蓄满一次所需的攻击时间
  const cycleHps = cycleTime > 0 ? (normalHeal * attacksToCharge + extraHeal) / cycleTime : 0;

  return {
    skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null,
    skillHps: null,  // 触发型无持续技能期，不显示技能期 HPS
    // 总治疗量 = 触发那一次的实际总回复：普攻治疗（仍在）+ 额外最大生命回复。
    // 常态普攻由常态HPS体现；周期HPS 已含全程普攻 + 单次额外。
    normalHps, totalHeal: normalHeal + extraHeal, cycleHps
  };
}

/**
 * 独立治疗 + 独立伤害型医疗技能（亚叶「复合型药物弹片」）。
 * 与咒愈师（治疗 = 伤害 × scale）不同：此模板的治疗与法术伤害各自独立计算。
 * 攻击变为弹片，每次攻击治疗（攻击力 × heal_scale）+ 法术伤害（攻击力 × atk_scale）。
 * @returns {Object} combined healing + independent damage metrics
 */
function calcDualMedic(params) {
  const { panelAtk, skillAtk, realInterval, baseInterval, skillDuration, isToggle, isPermanent, levelData, enemy } = params;

  const healScale = levelData['attack@heal_scale'] || 1;
  const atkScale = levelData['attack@atk_scale'] || 1;

  const normalHeal = panelAtk * 1.0;                         // 常态普攻治疗（医师 heal_ratio = 1.0）
  const normalHps = normalHeal / baseInterval;

  const singleHeal = skillAtk * healScale;                   // 每次弹片治疗量
  const singleDamage = calcArtsDamage(skillAtk * atkScale, enemy.res); // 每次弹片法术伤害

  let skillHps, skillDps, totalHeal, skillTotalDamage;
  if (isToggle || isPermanent) {
    skillHps = singleHeal / realInterval;
    skillDps = singleDamage / realInterval;
    totalHeal = null;
    skillTotalDamage = 0;
  } else if (skillDuration > 0) {
    const skillAttacks = Math.floor(skillDuration / realInterval);
    skillHps = singleHeal / realInterval;
    skillDps = singleDamage / realInterval;
    totalHeal = singleHeal * skillAttacks;
    skillTotalDamage = singleDamage * skillAttacks;
  } else {
    skillHps = 0;
    skillDps = 0;
    totalHeal = singleHeal;
    skillTotalDamage = singleDamage;
  }

  return {
    skillDps, skillTotalDamage, cycleDps: null, normalDps: null,
    skillHps, normalHps, totalHeal
  };
}

/**
 * Calculate incantation medic (arts damage + healing from damage)
 * @returns {Object} combined damage + healing metrics
 */
function calcIncantationMedic(params) {
  const { panelAtk, skillAtk, realInterval, baseInterval, skillDuration, isToggle, isPermanent, levelData, enemy } = params;

  const healScale = levelData.scale || 0.5;
  const singleHitDamage = calcArtsDamage(skillAtk, enemy.res);
  const normalHitDamage = calcArtsDamage(panelAtk, enemy.res);
  const singleHealFromDamage = singleHitDamage * healScale;
  const normalHealFromDamage = normalHitDamage * healScale;

  const normalHps = normalHealFromDamage / baseInterval;
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

/**
 * 治疗型召唤物（如赫默「医疗无人机/医疗探机」）。
 * 部署后持续 duration 秒，每 realInterval 秒治疗一次（治疗量 = 攻击力 × 1.0），到时销毁。
 * 无技能期/常态之分，以固定 HPS 持续治疗；normalHps 承载治疗速率，totalHeal 为持续期间总治疗量。
 */
function calcSummonHeal(params) {
  const { panelAtk, realInterval, skillDuration } = params;

  const healPerTick = panelAtk * 1.0;                 // 每次治疗量（医师 heal_ratio = 1.0）
  const hps = realInterval > 0 ? healPerTick / realInterval : 0;
  const duration = skillDuration || 0;
  const totalHeal = duration > 0 ? healPerTick * Math.floor(duration / realInterval) : healPerTick;

  return {
    skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null,
    skillHps: null, normalHps: hps, totalHeal
  };
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

export { calcMedical, calcIncantationMedic, calcDualMedic, calcSummonHeal, calcCycleDps, calcTriggerHeal, calcHpRatioTriggerHeal };
