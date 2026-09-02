//伤害计算核心逻辑

/**
 * 属性叠加公式（来自 PRTS Wiki 游戏数据基础#属性基本公式）
 * A_f = F_t × [(A + D_p) × (1 + D_t) + F_p]
 *
 * A   = 基础属性值
 * D_p = Σ(直接加算)
 * D_t = Σ(直接乘算)
 * F_p = Σ(最终加算)
 * F_t = Π(最终乘算)  任一项 < 0 时补正为该项 + 1
 */
export function calcAttribute(base, modifiers) {
  let Dp = 0, Dt = 0, Fp = 0;
  let Ft = 1;

  for (const mod of modifiers) {
    switch (mod.operator) {
      case 'direct_add':  Dp += mod.value; break;
      case 'direct_mul':  Dt += mod.value; break;
      case 'final_add':   Fp += mod.value; break;
      case 'final_mul':   Ft *= (mod.value < 0 ? mod.value + 1 : mod.value); break;
      default:            Dp += mod.value; break; // 默认直接加算
    }
  }

  if (1 + Dt < 0) Dt = -1; // 补正为0
  return Ft * ((base + Dp) * (1 + Dt) + Fp);
}

/**
 * 物理伤害公式
 * damage = ATK - DEF
 * 最终伤害 = max(damage, ATK × 0.05)
 */
export function calcPhysicalDamage(atk, def) {
  const damage = atk - def;
  return Math.max(damage, atk * 0.05);
}

/**
 * 法术伤害公式
 * damage = ATK × (100 - RES) / 100
 * 最终伤害 = max(damage, ATK × 0.05)
 */
export function calcArtsDamage(atk, res) {
  const damage = atk * (100 - res) / 100;
  return Math.max(damage, atk * 0.05);
}

/**
 * 真实伤害 - 全额
 */
export function calcTrueDamage(atk) {
  return atk;
}

/**
 * 计算线性插值属性值
 * 实际值 = minLevel值 + (maxLevel值 - minLevel值) × (当前等级 - 1) / (最大等级 - 1)
 */
export function interpolateAttr(minVal, maxVal, currentLevel, maxLevel) {
  if (maxLevel <= 1) return minVal;
  return minVal + (maxVal - minVal) * (currentLevel - 1) / (maxLevel - 1);
}

/**
 * 真实攻击间隔
 * realInterval = baseAttackTime × (100 / (100 + attack_speed - 100))
 * 注意：attack_speed 基础值为100，加算的是超出100的部分
 */
export function calcRealInterval(baseAttackTime, attackSpeed) {
  // attackSpeed 是最终值，不是加成值
  return baseAttackTime * (100 / attackSpeed);
}
