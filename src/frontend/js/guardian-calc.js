// ArkDMGCalc - Guardian (守护者/奶盾) Calculations
import { calcPhysicalDamage, calcArtsDamage, calcRealInterval } from './calculator.js';

/**
 * 守护者（TANK/guardian）技能计算。守护者普攻=近战物理（常态 normalDps 按 1.2s 基础间隔），
 * 技能核心是「普攻转治疗」。治疗默认目标=自身（单目标模型，同医疗先例）。
 * 特殊模式（塞雷娅S3/瑕光S1-S3/黍S3/森西S2）由 attack@* / e_atk / tick_heal_scale 键识别：
 *
 * - avatar（瑕光S3 先贤化身）：每击物理+额外0.8atk法伤（双伤害混合）+治疗友方0.9atk，受击回复无周期
 * - shu3（黍S3 离离枯荣）：攻击同时治疗（每击伤+疗），治疗必播种→自身吃 e_atk/e_attack_speed 增益
 * - slumber（瑕光S2 慑敌辉光）：敌人必睡→普攻×仁慈(atk_scale)；每秒回 0.18atk 范围 HOT
 * - calcium（塞雷娅S3 钙质化）：技能期只治疗（早期技能混乱按实际），每秒 0.25atk 范围 HOT，法脆队友 debuff 不计
 * - feast（森西S2 团体魔物大餐）：10s 停攻，每秒 0.4atk HOT + 收尾 1.6atk 大奶
 * - 治疗模式（base_attack_time）：停攻普攻转治疗，每次=技能期攻击力×100%，间隔引擎已换算（1.2+1.3=2.5s）
 * - radiance（瑕光S1 光芒涌动）：AUTO 双通道，触发 2.3atk 物理伤害 + 1.3atk 治疗（sp4 周期）
 * - 急救族 AUTO（heal_scale）：充能触发单次治疗=面板atk×heal_scale，周期 HPS=单次/spCost；受击型仅单次量
 */
function calcGuardian(params) {
  const { panelAtk, skillAtk, rawAtk, baseInterval, realInterval, skillDuration, levelData, enemy, talentHealScale, sleepAtkMul } = params;
  const talentMul = talentHealScale || 1;
  const normalInterval = baseInterval > 0 ? baseInterval : 1;
  const normalDps = enemy ? calcPhysicalDamage(panelAtk, enemy.def) / normalInterval : null;
  const dur = skillDuration > 0 ? skillDuration : 0;

  // ===== 瑕光 S3 先贤化身：每击物理 + 0.8×技能攻击力法伤 + 治疗 0.9×技能攻击力 =====
  if (levelData['attack@blemsh_s_3_extra_dmg[magic].atk_scale'] !== undefined) {
    const artsScale = levelData['attack@blemsh_s_3_extra_dmg[magic].atk_scale'];
    const healScale = levelData.heal_scale ?? 1;
    const interval = realInterval > 0 ? realInterval : 1;
    const perPhys = calcPhysicalDamage(skillAtk, enemy.def);
    const perArts = calcArtsDamage(skillAtk * artsScale, enemy.res);
    const perHeal = skillAtk * healScale * talentMul;
    const attacks = Math.floor(dur / interval);
    const physTotal = perPhys * attacks, artsTotal = perArts * attacks;
    const physDps = physTotal / dur, artsDps = artsTotal / dur;
    return {
      skillDps: physDps + artsDps, skillTotalDamage: physTotal + artsTotal,
      cycleDps: null, normalDps, skillHps: perHeal / interval, normalHps: null,
      totalHeal: perHeal * attacks, damageType: 'mixed',
      dmgTypes: {  // 规范化混合伤害：物理+法术各一档（UI 只渲染 >0 的档）
        physical: { skillDps: physDps, skillTotalDamage: physTotal, cycleDps: null },
        arts: { skillDps: artsDps, skillTotalDamage: artsTotal, cycleDps: null },
      },
    };
  }

  // ===== 黍 S3 离离枯荣：攻击同时治疗；治疗必播种→自身获 e_atk/e_attack_speed =====
  if (levelData.e_atk !== undefined) {
    const effAtk = skillAtk + panelAtk * (levelData.e_atk || 0);          // 同乘区累加（自身也在播种增益范围）
    const interval = calcRealInterval(baseInterval, 100 + (levelData.e_attack_speed || 0));
    const perPhys = calcPhysicalDamage(effAtk, enemy.def);
    const perHeal = effAtk * talentMul;                                   // 每击治疗（攻击力×100%，文本无倍率）
    const attacks = Math.floor(dur / interval);
    const physTotal = perPhys * attacks, physDps = physTotal / dur;
    return {
      skillDps: physDps, skillTotalDamage: physTotal,
      cycleDps: null, normalDps, skillHps: perHeal / interval, normalHps: null,
      totalHeal: perHeal * attacks, damageType: 'physical', realInterval: interval,
      dmgTypes: { physical: { skillDps: physDps, skillTotalDamage: physTotal, cycleDps: null } },
    };
  }

  // ===== 瑕光 S2 慑敌辉光：敌人必睡→普攻×仁慈；每秒 0.18atk 范围 HOT（受击回复无周期）=====
  if (levelData['attack@atk_to_hp_recovery_ratio'] !== undefined) {
    const hotRatio = levelData['attack@atk_to_hp_recovery_ratio'];
    const mercyMul = sleepAtkMul || 1;                                    // 仁慈：打沉睡目标攻击力×1.4
    const interval = realInterval > 0 ? realInterval : 1;
    const perPhys = calcPhysicalDamage(skillAtk * mercyMul, enemy.def);
    const perSecHeal = skillAtk * hotRatio * talentMul;
    const attacks = Math.floor(dur / interval);
    const physTotal = perPhys * attacks, physDps = physTotal / dur;
    return {
      skillDps: physDps, skillTotalDamage: physTotal,
      cycleDps: null, normalDps, skillHps: perSecHeal, normalHps: null,   // 每秒一跳
      totalHeal: perSecHeal * dur, damageType: 'physical',
      dmgTypes: { physical: { skillDps: physDps, skillTotalDamage: physTotal, cycleDps: null } },
    };
  }

  // ===== 塞雷娅 S3 钙质化：技能期只会治疗（停攻），每秒 0.25atk 范围 HOT =====
  if (levelData['attack@heal_scale'] !== undefined) {
    const perSecHeal = skillAtk * levelData['attack@heal_scale'] * talentMul;
    return {
      skillDps: 0, skillTotalDamage: 0, cycleDps: null,
      normalDps, skillHps: perSecHeal, normalHps: null, totalHeal: perSecHeal * dur,
      damageType: 'physical',
    };
  }

  // ===== 森西 S2 团体魔物大餐：停攻，每秒 0.4atk HOT + 收尾 1.6atk 大奶 =====
  if (levelData.tick_heal_scale !== undefined) {
    const tickHeal = skillAtk * levelData.tick_heal_scale * talentMul;    // 每秒
    const finHeal = skillAtk * (levelData.heal_scale ?? 1) * talentMul;   // 收尾大奶
    return {
      skillDps: 0, skillTotalDamage: 0, cycleDps: null,
      normalDps, skillHps: tickHeal, normalHps: null,
      totalHeal: tickHeal * dur + finHeal, damageType: 'physical',
    };
  }

  // ===== 治疗模式型（base_attack_time）：普攻转治疗 =====
  if (levelData.base_attack_time !== undefined) {
    const disarm = levelData.disarm ?? 0;                      // 烹饪期（古米 S2 前 10s）无治疗
    const effDur = Math.max(0, dur - disarm);
    const interval = realInterval > 0 ? realInterval : 1;
    const singleHeal = skillAtk * talentMul;                   // 治疗量=攻击力×100%（heal_ratio=1.0）
    const attacks = Math.floor(effDur / interval);
    return {
      skillDps: 0, skillTotalDamage: 0, cycleDps: null,
      normalDps, skillHps: singleHeal / interval, normalHps: null,
      totalHeal: singleHeal * attacks, damageType: 'physical',
    };
  }

  // ===== 瑕光 S1 光芒涌动：AUTO 双通道（触发 2.3atk 物理 + 1.3atk 治疗，sp4 周期）=====
  if (levelData.atk_scale !== undefined && levelData.heal_scale !== undefined && levelData.skillType === 'AUTO') {
    const triggerDmg = calcPhysicalDamage(panelAtk * levelData.atk_scale, enemy.def);
    const triggerHeal = panelAtk * levelData.heal_scale * talentMul;
    const spCost = levelData.spCost > 0 ? levelData.spCost : 1;
    return {
      skillDps: 0, skillTotalDamage: 0, cycleDps: triggerDmg / spCost,
      normalDps, skillHps: null, normalHps: triggerHeal / spCost, totalHeal: null,
      damageType: 'physical',
    };
  }

  // ===== 急救族 AUTO：充能触发单次治疗 =====
  const triggerHeal = panelAtk * (levelData.heal_scale ?? 1) * talentMul;
  if (levelData.spType === 'INCREASE_WHEN_TAKEN_DAMAGE') {
    // 受击回复（吽 S1）：无自然充能周期 → 仅单次触发量
    return {
      skillDps: 0, skillTotalDamage: 0, cycleDps: null,
      normalDps, skillHps: null, normalHps: null, totalHeal: triggerHeal, damageType: 'physical',
    };
  }
  const spCost = levelData.spCost > 0 ? levelData.spCost : 1;  // 自然充能秒数/层
  return {
    skillDps: 0, skillTotalDamage: 0, cycleDps: null,
    normalDps, skillHps: null, normalHps: triggerHeal / spCost, totalHeal: null,
    damageType: 'physical',
  };
}

export { calcGuardian };
