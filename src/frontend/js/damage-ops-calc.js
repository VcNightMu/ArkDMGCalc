// ArkDMGCalc - Damage Operator Calculations
import { calcPhysicalDamage, calcArtsDamage, calcTrueDamage } from './calculator.js';
import { calcCycleDps } from './medic-calc.js';

/**
 * Calculate pure damage operator (non-medical)
 * @returns {Object} damage metrics
 */
function calcDamage(params) {
  const { panelAtk, skillAtk, rawAtk, talentAtk, realInterval, normalInterval = realInterval, skillDuration, isToggle, isPermanent, levelData, isArts, normalTypeArts, hitMul = 1, hitCount = 1, talentDmgMul = 1, enemy, isWeakness = false, resPen = 0, isTrueOverride = false, hitMrMul = 1, flatArtsHit = 0, flatAt = null, defPenFixed = 0, skillDmgMul = 1, funnelNormalMul = 1, funnelSkillMul = 1, atkRampUp = null, dmgRamp = 0, mrDebuffMul = 1 } = params;

  const isTrue = levelData.trueDamage === true || isTrueOverride;
  const isDecay = levelData.atkDecay === true && levelData.atk !== undefined;
  // 固定法抗穿透（史尔特尔「熔火」无视 12~22 法抗）：法术结算用有效法抗
  let effRes = Math.max(0, (enemy?.res ?? 0) - resPen);
  // 命中减抗乘数(夜烟黑色迷雾等天赋级,先效果再命中):与技能级 mr 叠加
  if (typeof hitMrMul === 'number' && hitMrMul !== 1) effRes = Math.max(0, effRes * hitMrMul);
  // 天赋级敌方减抗乘数(伊芙利特「精神融解」范围内敌军法抗 -40%):天赋常驻 → 常态行同样含
  if (typeof mrDebuffMul === 'number' && mrDebuffMul !== 1) effRes = Math.max(0, effRes * mrDebuffMul);
  // 常态行有效法抗:含天赋法穿/命中减抗,但不含"技能级减抗"——技能期才生效的减抗不得污染常态行
  // (与"常态 DPS 用基础攻击间隔""技能期才生效的法脆不入常态"同口径;伊芙利特灼地 -13 等)
  const effResNormal = effRes;
  // 技能级减抗（magic_resistance 负值 = 命中后降低目标法抗）：命中效果先于命中结算(用户通用口径),
  // 故本次攻击伤害即按减抗后法抗计算(点燃/贾维 S2 火焰剥离/GALLUS² 落地被动均适用,不限技能时长)。
  // mr 为 (0,1) 区间比例值;≤-1 的整数键(伊芙利特灼地 -7 等)为固定值语义,待对应子职业实现时另行处理
  const mrDebuff = levelData.magic_resistance;
  if (typeof mrDebuff === 'number' && mrDebuff < 0 && mrDebuff > -1) effRes = Math.max(0, effRes * (1 + mrDebuff));
  // ≤-1 的整数键为固定值语义(伊芙利特灼地 -13/-20:命中后目标法抗-N,持续技能期),同样按"命中效果先于命中结算"处理
  if (typeof mrDebuff === 'number' && mrDebuff <= -1) effRes = Math.max(0, effRes + mrDebuff);
  // 无视防御比例（def_penetrate 键，如 35% = 技能期物理结算按 65% 有效防御）：通用机制，供含无视防御的技能使用
  const defPen = levelData.def_penetrate || 0;
  // 剥壳类每击附加法伤(按敌方防御结算后数值,不吃倍率/乘区):仅法术主档并入(物理主档走专用分支独立档)
  const flatOn = isArts ? flatArtsHit : 0;
  // 固定物理穿防(伺夜狼群天性等,天赋级):先减固定值再乘百分比(defPen 为技能级无视防御比例)
  const effDefRaw = Math.max(0, (enemy?.def ?? 0) - defPenFixed);
  const effDef = defPen > 0 ? effDefRaw * (1 - defPen) : effDefRaw;

  // 弱点伤害(赤刃明霄陈「形意洞照」):物理/法术各按目标防御/法抗结算一次,取伤害更高者,
  // 类型按实际赢家。注意 atk-def 与 atk×(100-res)/100 在攻击力跨阈值时会翻转(def600/res50 时 atk=1200 两式相等)。
  const weakPhys = (atk) => calcPhysicalDamage(atk, effDef);
  const weakArts = (atk) => calcArtsDamage(atk, effRes);
  const weakHit = (atk) => Math.max(weakPhys(atk), weakArts(atk));
  const weakType = (atk) => (weakPhys(atk) >= weakArts(atk) ? 'physical' : 'arts');

  // 技能期单次命中伤害：真实伤害无减免(凯尔希·Mon3tr 3技能)；弱点伤害逐击取物法更高。
  // hitMul：技能期每击伤害乘子(暮落 S2 六连发 attack@atk_scale×attack@times；斩业星熊 S3 二连击 MULTI_HIT)。
  // talentDmgMul：常驻伤害乘区(勇冠三军等),物理/法术/真伤一律乘。
  // hitCount：技能期单次攻击的发数(速射手连射:每发同等攻击力逐发结算,等价于 发数×单发伤害)。
  const skillHitDamage = (atk) => { const h = isTrue ? calcTrueDamage(atk) : (isWeakness ? weakHit(atk) : (isArts ? calcArtsDamage(atk, effRes) : calcPhysicalDamage(atk, effDef))); return h * hitMul * hitCount * talentDmgMul * skillDmgMul * funnelSkillMul; };
  // 常态普攻类型由职业决定(normalTypeArts=op.damageType==='arts')；弱点常态同样逐击取优
  const normalHitDamage = (isWeakness ? weakHit(panelAtk) : (normalTypeArts ? calcArtsDamage(panelAtk, effRes) : calcPhysicalDamage(panelAtk, effDef))) * talentDmgMul * funnelNormalMul;
  // 常态行专用普攻伤害:法抗不含"技能级减抗"(周期 cycleDps 仍用含减抗的 normalHitDamage——减抗在循环内有实际覆盖)
  const normalRowHitDamage = (isWeakness ? Math.max(calcPhysicalDamage(panelAtk, effDef), calcArtsDamage(panelAtk, effResNormal)) : (normalTypeArts ? calcArtsDamage(panelAtk, effResNormal) : calcPhysicalDamage(panelAtk, effDef))) * talentDmgMul * funnelNormalMul;
  const singleHitDamage = skillHitDamage(skillAtk);
  // 弱点技能期伤害类型:按技能期攻击力实际赢家(攻击力恒定时逐击同型;衰减技能逐击翻转罕见,取首击口径)
  const skillDmgType = isTrue ? 'true' : (isWeakness ? weakType(skillAtk) : (isArts ? 'arts' : 'physical'));
  const normalDmgType = isWeakness ? (calcPhysicalDamage(panelAtk, effDef) >= calcArtsDamage(panelAtk, effResNormal) ? 'physical' : 'arts') : (normalTypeArts ? 'arts' : 'physical');

  let skillDps, skillTotalDamage, cycleDps = null, normalDps = null;
  let skillAttacks;

  if (isToggle || isPermanent) {
    skillAttacks = 0;
    skillTotalDamage = 0;
    skillDps = (singleHitDamage + flatOn) / realInterval;
    // 驭械术师永续/切换技能:常态行照常展示(本体+既有单元满层);其它职业保持 null 口径不变
    if (funnelNormalMul !== 1) normalDps = (normalRowHitDamage + flatOn) / normalInterval;
  } else if (skillDuration > 0 && (isDecay || atkRampUp)) {
    // 攻击力增幅随时间线性衰减(从 levelData.atk 衰减至 0,衰减到面板攻击力)。
    // 按每次攻击时刻(第 0 秒、第 interval 秒、第 2×interval 秒......)的即时攻击力逐次结算总伤与平均 DPS。
    // 即时攻击力 = rawAtk × (1 + 天赋atk + 剩余增幅);直接乘算加算,不连乘。
    skillAttacks = Math.max(1, Math.floor(skillDuration / realInterval));
    let total = 0;
    for (let i = 0; i < skillAttacks; i++) {
      const t = i * realInterval;
      const bonus = atkRampUp
        ? levelData.atk * Math.min(1, t / ((atkRampUp.span > 0 ? atkRampUp.span : skillDuration) || skillDuration))
        : levelData.atk * (1 - t / skillDuration);
      let hit = skillHitDamage(rawAtk * (1 + (talentAtk || 0) + bonus)) + (flatAt ? flatAt(i) : flatOn);
      if (atkRampUp && dmgRamp > 0) hit = hit * (1 + dmgRamp * (t / skillDuration));  // 蓄力增伤:整个技能内线性递增
      total += hit;
    }
    skillTotalDamage = total;
    skillDps = total / skillDuration;
    normalDps = (normalRowHitDamage + flatOn) / normalInterval;
  } else if (skillDuration > 0) {
    skillAttacks = Math.floor(skillDuration / realInterval);
    if (flatAt) {
      let t = 0;
      for (let i = 0; i < skillAttacks; i++) t += singleHitDamage + flatAt(i);
      skillTotalDamage = t;
    } else {
      skillTotalDamage = (singleHitDamage + flatOn) * skillAttacks;
    }
    skillDps = skillTotalDamage / skillDuration;
    normalDps = (normalRowHitDamage + flatOn) / normalInterval;
  } else {
    skillAttacks = 1;
    skillTotalDamage = singleHitDamage + flatOn;
    skillDps = 0;
    cycleDps = calcCycleDps(levelData, realInterval, normalHitDamage + flatOn, singleHitDamage + flatOn);
    // 驭械术师点燃类(持续0,如至简 S2):常态行照常展示
    if (funnelNormalMul !== 1) normalDps = (normalRowHitDamage + flatOn) / normalInterval;
  }

  return {
    skillDps, skillTotalDamage, cycleDps, normalDps, skillHps: null, normalHps: null, totalHeal: null,
    damageType: skillDmgType,
    // 常态普攻伤害类型:真伤只作用于技能期,常态仍为职业普攻类型(物理/法术)
    normalDamageType: (skillDuration > 0 || funnelNormalMul !== 1) ? normalDmgType : null,
    // 伤害类型拆分(规范化混合伤害):每种>0的类型一档,UI 逐类型渲染只显示有值的部分
    dmgTypes: {
      [skillDmgType]: { skillDps, skillTotalDamage, cycleDps },
    },
  };
}

export { calcDamage };
