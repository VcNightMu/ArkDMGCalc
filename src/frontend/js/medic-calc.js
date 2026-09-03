// ArkDMGCalc - Medical Operator Calculations
import { calcArtsDamage, calcTrueDamage } from './calculator.js';

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
  // 图耶「水流环」一次性普攻治疗（MANUAL + atk_scale 屏障标记，无 atk 加成）、
  // 流明「沐雨」光环触发 HOT（aura.heal_scale，attack@ 之外的前缀键）、诺威尔「生命不息」挂持续 HOT。
  // 图耶强心剂/Touch 等带 atk 加成的技能机制不同，不在此列。
  const isTriggerHeal =
    ((levelData.heal_scale !== undefined || levelData['aura.heal_scale'] !== undefined) && levelData.atk === undefined) ||
    (levelData.skillType === 'MANUAL' && levelData.atk_scale !== undefined && levelData.atk === undefined);
  if (isTriggerHeal) {
    return calcTriggerHeal(params);
  }

  // 常驻治疗倍率（天赋，如瑰盐 ×1.05~1.17）作用于所有治疗量：
  // 普攻治疗与技能期治疗（skillAtk 为面板或技能乘算后攻击力）同乘。
  const healScale = params.talentHealScale ?? 1;
  const healRatio = (levelData.heal_ratio || 1.0) * healScale;
  // attack@heal_scale：普攻治疗倍率替换（守望者起飞型技能，如风絮1技能每次回复攻击力 0.4~0.6 倍生命）
  // 仅技能期单次生效；常态普攻维持 heal_ratio（100%）不受影响
  const skillHealRatio = healRatio * (levelData['attack@heal_scale'] ?? 1) * (params.healChain || 1);  // healChain：单次攻击多重治疗（纯烬 S3 五连发）
  const singleHeal = skillAtk * skillHealRatio;
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

  const healScale = levelData.heal_scale ?? levelData['aura.heal_scale'] ?? 1;  // aura.* 前缀：光环类触发型（流明沐雨），语义映射到同名字段
  const hasInterval = levelData.interval !== undefined || levelData['aura.interval'] !== undefined;
  const interval = hasInterval ? (levelData.interval ?? levelData['aura.interval'] ?? 1) : 1;  // 回复间隔（秒），仅持续型有
  // 持续秒数：duration 优先；诺威尔「生命不息」时长由 status_resistance[limit]（12s 抵抗 = 12s HOT）给出；流明「沐雨」取 aura.projectile_life_time
  const buffDuration = levelData.duration ?? levelData['aura.projectile_life_time'] ?? levelData['status_resistance[limit]'] ?? 0;
  const spCost = levelData.spCost || 0;
  const spType = levelData.spType || 'INCREASE_WITH_TIME';
  const skillType = levelData.skillType || 'MANUAL'; // AUTO=自动触发, MANUAL=手动触发
  const isSustained = hasInterval; // true=持续增益型，false=一次性额外型

  const talentScale = params.talentHealScale ?? 1; // 常驻治疗倍率（天赋，如瑰盐）
  const normalHeal = panelAtk * 1.0 * talentScale; // 1 次常态治疗（医师 heal_ratio 默认 1.0）
  const normalHps = normalHeal / baseInterval;   // 常态 HPS

  // 技能额外提供的治疗量
  let totalHeal;
  if (isSustained) {
    const tickHeal = skillAtk * healScale * talentScale;                 // 每次回复量（技能 heal_scale × 天赋倍率）
    const tickCount = Math.floor(buffDuration / interval); // 回复次数
    totalHeal = tickHeal * tickCount;                      // HOT 总量
    // aura.* 光环随普攻挂载（流明「沐雨」）：触发那下普攻治疗照常进行，总治疗量 = 普攻 + HOT 总量
    if (levelData['aura.heal_scale'] !== undefined) totalHeal += normalHeal;
  } else {
    totalHeal = skillAtk * healScale * talentScale;                      // 触发时一次性治疗
  }

  let cycleHps = null;
  if (spCost > 0 && spType === 'INCREASE_WHEN_ATTACK') {
    // 攻击回复触发型：充能 spCost 次攻击后触发一次。totalHeal 为触发那下的实际回复
    // （含普通治疗部分，如絮雨「定向诊断」下次治疗提升至 X 倍），与常态普攻重叠需扣除，只叠加强化增量。
    const increment = levelData.attackIncrement || levelData.increment || 1;
    const attacksToCharge = Math.max(1, Math.ceil(spCost / increment));
    const cycleTime = attacksToCharge * baseInterval;
    const extra = totalHeal - normalHeal;
    cycleHps = cycleTime > 0 ? (normalHps * cycleTime + Math.max(0, extra)) / cycleTime : 0;
  } else if (spType === 'INCREASE_WITH_TIME' && spCost > 0) {
    // 自动触发：触发时机是 sp 蓄满后的下一次普攻，蓄满到下次普攻之间多攒的 sp 被吞（延迟）。
    // 手动触发：玩家卡普攻瞬间释放，无延迟。
    let delay = 0;
    if (skillType === 'AUTO' && baseInterval > 0) {
      delay = Math.ceil(spCost / baseInterval) * baseInterval - spCost;
      if (delay < 0) delay = 0; // 浮点误差保护
    }
    // 持续型周期含增益持续；一次性型周期仅充能 + 延迟（触发即生效，无后续持续）
    const cycleTime = spCost + delay + (isSustained ? buffDuration : 0);
    // 全程普攻治疗不中断（充能/延迟/增益期都在普攻），额外治疗叠加
    // aura 型的 totalHeal 已含一次普攻，叠加时扣除避免与全程普攻重复计数
    const overlap = levelData['aura.heal_scale'] !== undefined ? normalHeal : 0;
    cycleHps = cycleTime > 0 ? (normalHps * cycleTime + totalHeal - overlap) / cycleTime : 0;
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
  const ammo = levelData['attack@trigger_time'] || 0;
  const isAmmo = skillDuration === -1 && ammo > 0;
  // 弹药型（如凯尔希·思衡托2技能）为真实伤害；其余双轨医疗（亚叶）为法术伤害
  const singleDamage = isAmmo ? calcTrueDamage(skillAtk * atkScale) : calcArtsDamage(skillAtk * atkScale, enemy.res);

  let skillHps, skillDps, totalHeal, skillTotalDamage;
  let damageType = null; // 弹药真伤标记（双轨医疗默认法伤由调用方兜底）
  if (isAmmo) {
    // 弹药机制：技能无持续时间，普攻消耗弹药（attack@trigger_time 发），打完后技能结束
    // 总伤/总治疗 = 弹药数 × 单发；用时 = 弹药数 × 攻击间隔 → DPS/HPS = 总量/用时
    const ammoTime = ammo * realInterval;
    skillHps = ammoTime > 0 ? (singleHeal * ammo) / ammoTime : 0;
    skillDps = ammoTime > 0 ? (singleDamage * ammo) / ammoTime : 0;
    totalHeal = singleHeal * ammo;
    skillTotalDamage = singleDamage * ammo;
    damageType = 'true';
  } else if (isToggle || isPermanent) {
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
    skillHps, normalHps, totalHeal,
    ...(damageType ? { damageType } : {})
  };
}

/**
 * Calculate incantation medic (arts damage + healing from damage)
 * @returns {Object} combined damage + healing metrics
 */
function calcIncantationMedic(params) {
  const { panelAtk, skillAtk, realInterval, baseInterval, skillDuration, isToggle, isPermanent, levelData, enemy } = params;
  const mode = params.incantMode || null;

  // 特性治疗比例 scale：技能级覆盖优先（未来技能若改比例），否则取特性/模组（traitScale，0.5→模组 0.6）
  const healScale = levelData.scale ?? (params.traitScale ?? 0.5);
  const fragileMul = params.magicFragileMul ?? 1;  // 法脆必触发增伤（芙蓉常驻 / 焰苇S3灼痕），实际造成伤害 ×damage_scale
  const artsHit = (atk) => calcArtsDamage(atk, enemy.res) * fragileMul;
  const normalHitDamage = artsHit(panelAtk);
  const normalHealFromDamage = normalHitDamage * healScale;

  const normalHps = normalHealFromDamage / baseInterval;
  const normalDps = normalHitDamage / baseInterval;
  // 每击额外治疗（阿米娅S1「哀恸共情」：攻击时额外治疗自身周围我方 = 攻击力×heal_scale，单目标模型 1 份=自身）
  const extraHealPerHit = typeof levelData.heal_scale === 'number' ? skillAtk * levelData.heal_scale : 0;

  // —— 阿米娅S2「慈悲愿景」(zerohit-true)：开启一击强制 0 命中（无伤害、0 叠层无增幅）→ 后续普攻真实伤害（面板攻击力）——
  if (mode === 'zerohit-true') {
    const trueHit = calcTrueDamage(panelAtk);
    const attacks = Math.max(1, Math.floor(skillDuration / realInterval));
    const skillTotalDamage = trueHit * attacks;
    const totalHeal = trueHit * healScale * attacks;
    return { skillDps: skillTotalDamage / skillDuration, skillTotalDamage, cycleDps: null, normalDps, skillHps: trueHit * healScale / realInterval, normalHps, totalHeal, damageType: 'true' };
  }

  // —— 焰苇S2「枯荣共息」(orbital)：给地面干员（默认自身）挂三颗火球，每 cooldown 秒 3 发 atk_scale 法伤，
  //    仅对该干员触发特性治疗；苇草自身普攻照常（技能期无 buff），输出=普攻+火球 ——
  if (mode === 'orbital') {
    const perOrb = artsHit(panelAtk * (levelData.atk_scale ?? 1));
    const tickEvery = levelData.cooldown || 1.5;
    const ticks = Math.max(1, Math.floor(skillDuration / tickEvery));
    const orbHits = ticks * 3;                      // 三颗火球每轮齐发
    const normalSkillHit = artsHit(panelAtk);       // 苇草自身普攻（法伤）
    const atkAttacks = Math.max(1, Math.floor(skillDuration / realInterval));
    const skillTotalDamage = normalSkillHit * atkAttacks + perOrb * orbHits;
    const skillDps = skillDuration > 0 ? skillTotalDamage / skillDuration : 0;
    const healHps = normalSkillHit * healScale / realInterval + perOrb * healScale * 3 / tickEvery;
    const totalHeal = normalSkillHit * healScale * atkAttacks + perOrb * healScale * orbHits;
    return { skillDps, skillTotalDamage, cycleDps: null, normalDps, skillHps: healHps, normalHps, totalHeal };
  }

  // —— 焰苇S3「生命火种」(burning)：普攻 2 目标（单目标模型×1）法伤 ×灼痕法脆；
  //    附带灼痕敌人每秒受 talent@s3_atk_scale 法伤（灼痕DOT，同样吃灼痕法脆；非苇草攻击 → 不治疗）；死亡爆炸(aoe_scale)默认不计 ——
  if (mode === 'burning') {
    const singleHitDamage = artsHit(skillAtk);
    const s3DotScale = levelData['talent@s3_atk_scale'] ?? 0;
    const dotTick = artsHit(skillAtk * s3DotScale);  // 灼痕秒伤：技能期攻击力×X%，吃灼痕法脆
    const attacks = Math.max(1, Math.floor(skillDuration / realInterval));
    const dotTicks = Math.max(1, Math.floor(skillDuration / 1));
    const atkTotal = singleHitDamage * attacks;
    const dotTotal = dotTick * dotTicks;
    const skillTotalDamage = atkTotal + dotTotal;
    const totalHeal = singleHitDamage * healScale * attacks;   // 仅普攻治疗，DOT 不治疗
    return { skillDps: skillTotalDamage / skillDuration, skillTotalDamage, cycleDps: null, normalDps, skillHps: singleHitDamage * healScale / realInterval, normalHps, totalHeal };
  }

  // —— 缇缇S2「封护」(standby)：停止攻击（atk 加成只服务天赋1伤害，天赋伤害不建模型）→ 技能期无输出无治疗 ——
  if (mode === 'standby') {
    return { skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps, skillHps: 0, normalHps, totalHeal: 0 };
  }

  // —— 缇缇S3「旧日绽放」(slumber)：每击普攻全额法伤（min=1.0 档，打睡与睡着无差别）；第 4x+1 击打睡（1.6s 间隔×4=6.4s > 沉睡5s），
  //    每次打睡 → 醒来结算一次睡满 5s 的 max_atk_scale 法伤（醒伤非攻击 → 不触发特性治疗）；死亡结算/友方沉睡不计 ——
  if (mode === 'slumber') {
    const attacks = Math.max(1, Math.floor(skillDuration / realInterval));
    const sleepCount = Math.ceil(attacks / 4);              // 打睡次数（第 1/5/9/13…击）
    const hitDmg = artsHit(skillAtk);
    const wakeHit = calcArtsDamage(skillAtk * (levelData.max_atk_scale ?? 1), enemy.res);
    const skillTotalDamage = hitDmg * attacks + wakeHit * sleepCount;
    const totalHeal = hitDmg * healScale * attacks;          // 醒伤不治疗
    return { skillDps: skillDuration > 0 ? skillTotalDamage / skillDuration : 0, skillTotalDamage, cycleDps: null, normalDps, skillHps: hitDmg * healScale / realInterval, normalHps, totalHeal };
  }

  const singleHitDamage = artsHit(skillAtk);
  const singleHealFromDamage = singleHitDamage * healScale;

  // DOT 替换型（濯尘芙蓉S2「抚业之触」）：技能期普攻替换为每秒一跳法伤（atk_scale×面板，伤害已含法脆），
  // 每秒一跳视为一次攻击 → 特性治疗每跳触发；间隔展示 1s。
  if (params.isDotTick) {
    const ticks = Math.max(1, Math.floor(skillDuration / 1));
    const skillTotalDamage = singleHitDamage * ticks;
    const skillDps = skillDuration > 0 ? skillTotalDamage / skillDuration : singleHitDamage;
    const totalHeal = singleHealFromDamage * ticks;
    return { skillDps, skillTotalDamage, cycleDps: null, normalDps, skillHps: singleHealFromDamage, normalHps, totalHeal, realInterval: 1 };
  }

  // 技能期单发治疗 = 特性治疗 + 每击额外治疗（阿米娅S1）
  const singleHealPerHit = singleHealFromDamage + extraHealPerHit;

  let skillDps, skillHps, skillTotalDamage, totalHeal, cycleDps = null;
  let skillAttacks;

  if (isToggle || isPermanent) {
    skillDps = singleHitDamage / realInterval;
    skillHps = singleHealPerHit / realInterval;
    skillTotalDamage = 0;
    totalHeal = null;
  } else if (skillDuration > 0) {
    skillAttacks = Math.floor(skillDuration / realInterval);
    skillTotalDamage = singleHitDamage * skillAttacks;
    skillDps = skillTotalDamage / skillDuration;
    skillHps = singleHealPerHit / realInterval;
    totalHeal = singleHealPerHit * skillAttacks;
  } else {
    skillTotalDamage = singleHitDamage;
    skillDps = 0;
    skillHps = 0;
    totalHeal = singleHealFromDamage + extraHealPerHit;
    cycleDps = calcCycleDps(levelData, realInterval, normalHitDamage, singleHitDamage);
  }

  return { skillDps, skillTotalDamage, cycleDps, normalDps, skillHps, normalHps, totalHeal };
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
