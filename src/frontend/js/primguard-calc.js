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
import { simulateElementTimeline, OPERATOR_ELEMENT } from './element-calc.js';

// 元素类型按干员登记(OPERATOR_ELEMENT)：聆音=神经(sanity)、克莱门莎=侵蚀(water)。
// 未登记时回退 sanity(聆音的历史硬编码口径)。
const elOf = (id) => OPERATOR_ELEMENT[id] || 'sanity';

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

  if (id === 'char_4231_clemnt') {
    return calcClemntSkill({ op, levelData: L, rawAtk: p.rawAtk, panelAtk, skillAtk, I, D, grade, effDef, effRes: p.effRes, skillIndex, result });
  }

  const ELEMENT = elOf(id);

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

/**
 * 克莱门莎(char_4231_clemnt, 6★ 本源近卫, 2026-10 版本新增, 侵蚀/water)三个技能。
 *
 * 数据侧要点：天赋 1「生死定夺」为**概率类**加攻（物理伤害时 25% 概率攻击力提升至 135~150%，
 * 目标防御低于初始值时概率升至 50%）→ 按本项目通则「概率类不建模」，不并入面板；
 * 天赋 2「习得性防御」为承伤向减伤，不影响自身输出，不建模。
 *
 * 口径与假设（实现时依据技能描述原文 + blackboard；标※者为需用户确认的取舍）：
 *  S1 冲蚀(durationType NONE, 攻回 sp2)：下次攻击攻击力提高至 atk_scale(专三 2.9)，
 *     并造成「相当于该物理伤害 ep_damage_ratio(0.35)」的侵蚀损伤 → 触发型单发 + 元素时间轴。
 *     充能周期按攻回惯例 = spCost × 间隔（不折 initSp）。
 *  S2 风暴潮(dur16, 自然回 sp20)：攻速 +100（→间隔减半），每次攻击对目标造成
 *     攻击力 × attack@physical_atk_scale(专三 3.0) 的物理伤害。
 *     ※「浮游放逐舱」及其留下的**漩涡**（每秒 200 点侵蚀 + 攻击力×aoe 物理）是**区域地面效果**，
 *     本项目为单目标模型、且漩涡范围/持续时间数据未提供 → **不计入**（同场地类机制的既有通则）。
 *  S3 与海为敌(durationType AMMO)：每次攻击造成攻击力 × attack@atk_scale(专三 2.35) 物理伤害
 *     + 该物理伤害 × attack@ep_damage_ratio(0.20) 的侵蚀损伤（epBase='damage'）；
 *     当**全场有敌人侵蚀损伤爆发**时，消耗 1 发弹药，对目标周围四格地面敌人造成
 *     3 次攻击力 × s3_atk_scale(3.0) 物理 + 攻击力 × ep_damage_scale(2.5) 元素伤害。
 *     炮弹有 projectile_life_time(5s) 滞空 → 攻击 t 时刻结算，爆条伤害 t+5 时刻结算（离散模拟）。
 *     ※窗口口径：技能装 trigger_time(10) 发弹药、打完后结束 → 窗口 = 10×弹道周期
 *      （每次爆发消耗 1 发，非每次普攻消耗）。期间即耗弹出击 → 常态化列保持 null（同其他弹药槽）。
 */
function calcClemntSkill(c) {
  const { levelData: L, rawAtk, skillAtk, I, D, grade, effDef, effRes, skillIndex, result } = c;
  const EL = OPERATOR_ELEMENT['char_4231_clemnt'] || 'water';
  const H = (a) => calcPhysicalDamage(a, effDef);
  const num = (v, d) => (typeof v === 'number' ? v : d);

  if (skillIndex === 0) {
    // S1 冲蚀：攻击回复触发型（skillDuration 0 → 技能期为单次触发，周期走 cycleDps）
    const scale = num(L.atk_scale, 1);
    const epRatio = num(L.ep_damage_ratio, 0);
    const phys = H(skillAtk * scale);
    const sim = simulateElementTimeline({
      grade, duration: 1, enemy: { res: effRes || 0 },
      // 损伤基数 = 该次实际造成的物理伤害：以 atk=skillAtk×scale、dmgMul=0、epBase='atk' 表达
      // （epBase='damage' 会取 atk×dmgMul=0 → 损伤恒 0，是错的）
      streams: [{ atk: skillAtk * scale, dmgMul: 0, el: EL, epMul: epRatio, epBase: 'atk', times: [0] }],
    });
    const total = phys + sim.element;
    const sp = num(L.spCost, 0);
    // 周期 = spCost 次普攻（每次攻击回 1 sp）；周期内普攻伤害由通用 cycleDps 提供，按其反推普攻部分
    let cyc = null;
    if (sp > 0) {
      const genCycle = result.cycleDps;
      const normalPart = (genCycle !== null && genCycle !== undefined)
        ? genCycle * sp * I - (result.skillTotalDamage || 0)
        : H(result.panelAtk !== undefined ? result.panelAtk : skillAtk) * sp;
      cyc = (normalPart + total) / (sp * I);
    }
    const dmgTypes = { physical: { skillDps: 0, skillTotalDamage: phys, cycleDps: cyc } };
    if (sim.element > 0) dmgTypes.element = { skillDps: 0, skillTotalDamage: sim.element, cycleDps: null };
    return {
      ...result, type: 'damage', damageType: 'physical', normalDamageType: 'physical',
      skillDps: 0, skillTotalDamage: total, cycleDps: cyc,
      normalDps: result.normalDps, realInterval: I, skillAtkOut: skillAtk, dmgTypes,   // 技能期 ATK = 触发那一下的重击攻击力（入口 skillAtk 已含 atk_scale，不再重复乘）
    };
  }

  if (skillIndex === 1) {
    // S2 风暴潮：持续 16s，攻速 +100（间隔减半），每次攻击攻击力×physical_atk_scale
    const scale = num(L['attack@physical_atk_scale'], 1);
    const perHit = H(skillAtk * scale);
    const dur2 = D > 0 ? D : 16;
    const n = D > 0 && I > 0 ? Math.floor(D / I) : Math.floor(16 / (I > 0 ? I : 1));
    const times = [];
    for (let i = 1; i <= n; i++) times.push(i * I);
    // 浮游放逐舱留下的**漩涡**（区域效果，用户口径 2026-10-10：必然能打到敌方头上，需计入）：
    // 敌人处于漩涡时每秒受到 200 点侵蚀损伤（attack@water_element，固定值）+
    // 相当于攻击力 attack@physical_atk_scale 的物理伤害（技能描述该句即用此占位符）。
    // 漩涡 tick 与普攻 tick 放进同一事件流：侵蚀 EP 为共享资源，时序会影响爆条节奏。
    // ※漩涡持续时间取技能时长（数据未提供单独时长）→ 16s 内每秒一跳。
    const vortexPay = H(skillAtk * scale);              // 每秒物理（逐跳结算，单目标 1 目标）
    const vortexTicks = [];
    for (let s = 1; s <= dur2; s++) vortexTicks.push(s);
    const streams = [
      // 普攻附带固定 200 点侵蚀（attack@water_element 是固定损伤值，不吃攻击力 → 用 epFlat 而非 epMul）
      { times, el: EL, epFlat: num(L['attack@water_element'], 200) },
      { atk: vortexPay, dmgMul: 1, phys: true, times: vortexTicks },   // 漩涡物理（phys 标记 → 走物理结算并透传）
      { atk: 0, dmgMul: 0, el: EL, epFlat: num(L['attack@water_element'], 200), times: vortexTicks },   // 漩涡侵蚀(固定值)
    ];
    const sim = simulateElementTimeline({ grade, duration: dur2, enemy: { res: effRes || 0 }, streams });
    const phys = perHit * times.length + sim.physical;
    const total = phys + sim.element;
    const dmgTypes = { physical: { skillDps: phys / dur2, skillTotalDamage: phys, cycleDps: null } };
    if (sim.element > 0) dmgTypes.element = { skillDps: sim.element / dur2, skillTotalDamage: sim.element, cycleDps: null };
    return {
      ...result, type: 'damage', damageType: 'physical', normalDamageType: 'physical',
      skillDps: dur2 > 0 ? total / dur2 : 0, skillTotalDamage: total, cycleDps: null,
      normalDps: result.normalDps, realInterval: I, skillAtkOut: skillAtk * scale, dmgTypes,
    };
  }

  if (skillIndex === 2) {
    // S3 与海为敌：弹药型。逐次攻击累加侵蚀，爆条时消耗 1 发弹药打出 3 次范围物理 + 3 次元素
    const atkScale = num(L['attack@atk_scale'], 1);
    const epRatio = num(L['attack@ep_damage_ratio'], 0);
    const burstHits = 3;
    const burstPhysScale = num(L.s3_atk_scale, 0);
    const burstElScale = num(L.ep_damage_scale, 0);
    const ammo = Math.round(num(L.trigger_time, 10));
    const flight = num(L.projectile_life_time, 5);
    const burstPhysHit = H(skillAtk * burstPhysScale);
    const burstElHit = skillAtk * burstElScale;   // 元素伤害不吃物防/法抗（独立档位）
    // 入口 skillAtk 已含 attack@atk_scale（引擎在 dispatch 前已乘），故不再重复乘
    const perHitPhys = H(skillAtk);
    const slug = perHitPhys * epRatio;            // 每击侵蚀累积（epBase='damage'：基于该击实际物理伤害）

    const capacity = (grade === 'leader') ? 2000 : 1000;   // 侵蚀 EP 容量：普通/精英 1000、领袖 2000
    const cd = 8;                                 // 侵蚀爆条冷却
    let ep = capacity, cdUntil = -Infinity;
    let t = 0, phys = 0, element = 0, bursts = 0, hits = 0;
    while (bursts < ammo) {
      t += I;                                     // 一次普攻
      hits++;
      phys += perHitPhys;
      // 损伤先于伤害结算的通用口径下，本次攻击的累积按本次实际物理伤害计
      if (t >= cdUntil) {
        ep -= slug;
        if (ep <= 0) {
          ep = capacity;
          cdUntil = t + cd;
          bursts++;
          phys += burstPhysHit * burstHits;
          element += burstElHit * burstHits;
        }
      }
      if (hits > 400) break;                      // 防御性上限
    }
    const T = bursts * I + flight;                // 窗口 = 弹药消耗期 + 末发炮弹滞空
    const total = phys + element;
    const dmgTypes = {
      physical: { skillDps: T > 0 ? phys / T : 0, skillTotalDamage: phys, cycleDps: null },
    };
    if (element > 0) dmgTypes.element = { skillDps: T > 0 ? element / T : 0, skillTotalDamage: element, cycleDps: null };
    return {
      ...result, type: 'damage', damageType: 'physical', normalDamageType: null,
      skillDps: T > 0 ? total / T : 0, skillTotalDamage: total, cycleDps: null,
      normalDps: null,                            // 弹药槽：技能期即耗弹出击，常态行按惯例保持 null
      realInterval: I, skillAtkOut: skillAtk * atkScale, dmgTypes,   // 展示值 = 面板 × attack@atk_scale（该键不在引擎白名单，需显式声明）
    };
  }

  return result;
}
