// ArkDMGCalc - 本源近卫(primguard)元素损伤计算
// 分支特性:能够阻挡两个敌人,可以造成元素伤害。
// 元素类型:聆音 = 神经(sanity)。
//
// 口径(用户 2026-09-17,与本源术师 primcaster-calc.js 同源):
//  1) 损伤累积基数 = 该次攻击"实际造成的伤害"×比例(聆音为物理伤害,吃防御后的量);
//  2) 神经爆条:固定 6000 点元素伤害/次,冷却 10s,EP 容量 1000(元素伤害不吃物防/法抗,独立档位);
//  3) 不施加损伤的技能槽不产生爆条:聆音 S2「破膛弥撒」的"目标处于神经损伤爆发期间则改为元素伤害"——
//     该槽自身不移交损伤,用户口径(2026-09-17 问答)按"视为目标处于爆发"处理 → 三段均按元素伤害结算;
//  4) 充能按惯例不计(聆音 S2 可充能 2 次 → 单次);
//  5) 常态(无技能)不含元素(普攻不移交损伤)→ 常态行不变。
import { calcPhysicalDamage } from './calculator.js';
import { simulateElementTimeline } from './element-calc.js';

const ELEMENT = 'sanity';

export function calcPrimGuardSkill(p) {
  const { op, slotData, levelData, panelAtk, skillAtk, skillRealInterval, skillDuration, skillIndex, result } = p;
  if (!result || skillIndex < 0) return result;
  const id = op.id;
  const L = levelData || {};
  const I = skillRealInterval > 0 ? skillRealInterval : 1.2;
  const D = skillDuration > 0 ? skillDuration : 0;
  const grade = p.grade || 'normal';
  const effDef = p.effDef !== undefined ? p.effDef : 0;
  const H = (a) => calcPhysicalDamage(a, effDef);

  if (id === 'char_4187_graceb') {
    if (skillIndex === 0) {
      // S1 开颅挽歌(自动回复/手动 30s):攻击变为二连击,每击造成攻击力 135%(专一)物理伤害;
      // 每次攻击附带"造成伤害 10%"的神经损伤 → 事件流推进 EP → 爆条(6000/次、cd 10s)
      const hitsPer = 2;
      const nAtk = Math.max(0, Math.floor(D / I));
      const scale = L['attack@atk_scale'] !== undefined ? L['attack@atk_scale'] : 1;
      const perHit = H(skillAtk * scale);
      const times = [];
      for (let i = 1; i <= nAtk; i++) for (let h = 0; h < hitsPer; h++) times.push(i * I);
      const sim = simulateElementTimeline({
        grade, duration: D, enemy: { res: p.effRes || 0 },
        streams: [{ atk: perHit, dmgMul: 0, el: ELEMENT, epMul: L.ep_damage_ratio || 0, epBase: 'atk', times }],
      });
      const phys = perHit * times.length;
      const total = phys + sim.element;
      const physDps = D > 0 ? phys / D : 0;
      const elDps = D > 0 ? sim.element / D : 0;
      const dmgTypes = { physical: { skillDps: physDps, skillTotalDamage: phys, cycleDps: null } };
      if (sim.element > 0) dmgTypes.element = { skillDps: elDps, skillTotalDamage: sim.element, cycleDps: null };
      return {
        ...result, type: 'damage', damageType: 'physical',
        skillDps: D > 0 ? total / D : 0, skillTotalDamage: total, cycleDps: null,
        normalDps: result.normalDps, realInterval: skillRealInterval, panelAtk: skillAtk,
        dmgTypes,
      };
    }
    if (skillIndex === 1) {
      // S2 破膛弥撒:立即对周围最多 6 名地面敌人造成三次攻击力 230%(专一)的伤害(用户口径:按元素伤害结算);
      // 触发型(skillDuration -1)→ 技能期 DPS 0、总伤进 dmgTypes.element;循环 DPS 按元素总伤折算(分母不变)
      const hits = 3;
      const elementTot = skillAtk * hits;
      const cdGen = result.cycleDps;
      const spCost = L.spCost;
      let cycleDps = cdGen;
      if (cdGen !== null && cdGen !== undefined && spCost > 0) {
        const normDmgInCycle = cdGen * spCost - (result.skillTotalDamage || 0);
        cycleDps = (normDmgInCycle + elementTot) / spCost;
      }
      return {
        ...result, type: 'damage', damageType: 'physical',
        skillDps: 0, skillTotalDamage: elementTot, cycleDps,
        normalDps: result.normalDps,
        dmgTypes: { element: { skillDps: 0, skillTotalDamage: elementTot, cycleDps } },
      };
    }
  }
  return result;
}
