// ArkDMGCalc - 本源铁卫(primprotector)计算
// 本源铁卫特性：攻击造成物理伤害 + 可造成元素损伤（余=灼燃/珊比=侵蚀/响石=神经；菲莱/裂响为受击型不进损伤模拟）。
// 元素机制（PRTS 敌方版）：EP 满 1000(普通/精英)/2000(领袖)，损伤归零爆条：
//   灼燃 7000 元素伤害 + 10s 法抗-20（冷却期=减抗窗口，锁条无叠加）；侵蚀 5000（-120 防不计）；神经 6000（麻痹不计）；
// 侵蚀 CD 珊比按 5s（duration_dec 折算，用户口径）。周期 = 攒条时间 + CD；技能期起点敌人条满。
import { calcPhysicalDamage, calcArtsDamage } from './calculator.js';
import { steadyElementDps, simulateSkillTimeline, OPERATOR_ELEMENT } from './element-calc.js';

// 从天赋候选按精化/潜能取当前生效档 bb 值（数据驱动，避免硬编码档位）
function talentBbValue(op, talentIndex, slotData, key) {
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return null;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let best = null;
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const v = cand.blackboard && typeof cand.blackboard[key] === 'number' ? cand.blackboard[key] : null;
      if (v !== null && (best === null || v > best)) best = v;
    }
  }
  return best;
}

// 本源铁卫天赋损伤/直伤源（未解锁返回 null）
// 余:天赋0 每秒 0.25~0.4×atk 法伤 + 0.08~0.12×atk 灼燃（interval=1；对阻挡目标，单目标默认满足）
// 珊比:天赋0 每击附带 0.1~0.12×atk 侵蚀（造成物理伤害时；精1 解锁，精0 无）
// 响石:天赋0 每秒 0.09~0.1×atk 神经损伤（interval=1 隐含）
export function primTalentRates(op, slotData) {
  const rates = { perSecArts: null, perSecEp: null, perHitEp: null, el: OPERATOR_ELEMENT[op.id] || null };
  if (op.id === 'char_2026_yu') {
    rates.perSecArts = talentBbValue(op, 0, slotData, 'yu_t_1[enemy].atk_scale');   // 每秒法伤倍率
    rates.perSecEp = talentBbValue(op, 0, slotData, 'yu_t_1[enemy].ep_damage_ratio'); // 每秒灼燃倍率
  } else if (op.id === 'char_4235_thumpy') {
    rates.perHitEp = talentBbValue(op, 0, slotData, 'ep_damage_ratio[trigger]');
  } else if (op.id === 'char_4214_cairn') {
    rates.perSecEp = talentBbValue(op, 0, slotData, 'ep_damage_ratio');
  }
  return rates;
}

/**
 * 本源铁卫常态三档：物理普攻 dps + 天赋直伤(余每秒法伤,吃法抗) + 元素爆条平均 dps。
 * @returns {normalDps, normalTypes, grade, baseInt}
 */
export function primNormalFields(op, slotData, panelAtk, enemy) {
  const baseInt = ((op.phases[slotData.elite] || op.phases[op.phases.length - 1]) || {}).baseAttackTime || 1.6;
  const grade = (enemy && enemy.grade) || 'normal';
  const rates = primTalentRates(op, slotData);
  const el = rates.el;
  const normInt = baseInt > 0 ? baseInt : 1.6;
  const physDps = calcPhysicalDamage(panelAtk, enemy.def) / normInt;
  let artsDps = 0, elementDps = 0;
  // 余：每秒法伤直伤（常态持续；吃法抗；与普攻并行）
  if (rates.perSecArts) artsDps += calcArtsDamage(panelAtk * rates.perSecArts, enemy.res) / 1;
  // 常驻损伤源 → 爆条平均（steadyElementDps：从条满起 n 事件攒满 → 周期 = 攒条 + CD）
  if (rates.perHitEp && el) {
    // 每击型（珊比）：ep 事件间隔 = 攻击间隔
    const st = steadyElementDps(grade, el, panelAtk * rates.perHitEp, normInt, el === 'water' ? 5 : null);
    elementDps += st.avgDps;
  }
  if (rates.perSecEp && el) {
    const st = steadyElementDps(grade, el, panelAtk * rates.perSecEp, 1, null);
    elementDps += st.avgDps;
  }
  const normalTypes = { physical: { dps: physDps } };
  if (artsDps > 0) normalTypes.arts = { dps: artsDps };
  if (elementDps > 0) normalTypes.element = { dps: elementDps };
  return { normalDps: physDps + artsDps + elementDps, normalTypes, grade, baseInt: normInt };
}

/** 组合本源铁卫技能期时间轴结果为 result 对象（normal 三档照常给） */
function makeResult(sim, p, extra = {}) {
  const { skillDuration, realInterval, panelAtk } = p;
  const dur = skillDuration > 0 ? skillDuration : 1;
  const norm = primNormalFields(p.op, p.slotData, panelAtk, p.enemy);
  const arts = sim.arts + (extra.burstArts || 0);
  const total = sim.physical + arts + sim.element;
  const dmgTypes = {};
  if (sim.physical > 0 || total === 0) dmgTypes.physical = { skillDps: sim.physical / dur, skillTotalDamage: sim.physical, cycleDps: null };
  if (arts > 0) dmgTypes.arts = { skillDps: arts / dur, skillTotalDamage: arts, cycleDps: null };
  if (sim.element > 0) dmgTypes.element = { skillDps: sim.element / dur, skillTotalDamage: sim.element, cycleDps: null };
  return {
    type: 'damage',
    skillDps: dur > 0 ? total / dur : 0,
    skillTotalDamage: total,
    cycleDps: null,
    normalDps: norm.normalDps,
    normalTypes: norm.normalTypes,
    skillHps: extra.skillHps ?? null,
    normalHps: null,
    totalHeal: extra.totalHeal ?? null,
    isToggle: false, isPermanent: false,
    realInterval,
    panelAtk,
    damageType: arts > 0 && sim.physical === 0 ? 'arts' : 'physical',
    normalDamageType: 'physical',
    dmgTypes,
  };
}

/**
 * 本源铁卫技能期时间轴入口（余/珊比/响石全员特殊建模）。
 * 菲莱/裂响（纯防御/受击）不进此入口。
 * @param {Object} p { op, slotData, panelAtk, panelHp, skillAtk, skillDuration, realInterval, levelData, enemy }
 */
export function calcPrimSkill(p) {
  const { op, slotData, panelAtk, panelHp, skillAtk, skillDuration, realInterval, levelData, enemy } = p;
  const id = op.id;
  const si = slotData.skillIndex || 0;
  const grade = (enemy && enemy.grade) || 'normal';
  const rates = primTalentRates(op, slotData);
  const el = rates.el;
  const int = realInterval > 0 ? realInterval : 1.6;

  // ========== 余 char_2026_yu（灼燃） ==========
  if (id === 'char_2026_yu') {
    const dots = [];
    if (rates.perSecArts) dots.push({ type: 'arts', atk: skillAtk, dmgMul: rates.perSecArts, interval: 1 });
    if (rates.perSecEp) dots.push({ type: null, atk: skillAtk, epMul: rates.perSecEp, el, interval: 1 });
    if (si === 0) {
      // S1 今日做东：嘲讽+血防，受击对攻击者造成灼燃（受击无频率→不计）。无攻击增益 → 普攻照常。
      const sim = simulateSkillTimeline({ grade, duration: skillDuration, enemy, attacks: [{ type: 'physical', atk: skillAtk, interval: int }], dots });
      return makeResult(sim, p);
    }
    if (si === 1) {
      // S2 厚礼上宾：先加属性再瞬发 atk_scale×atk 法伤一发；20s 普攻变法术 atk+X%。
      const burstArts = calcArtsDamage(skillAtk * (levelData.atk_scale || 1), enemy.res);
      const sim = simulateSkillTimeline({
        grade, duration: skillDuration, enemy,
        attacks: [{ type: 'arts', atk: skillAtk, interval: int }],
        dots,
      });
      return makeResult(sim, p, { burstArts });
    }
    if (si === 2) {
      // S3 灶里乾坤：血/攻/防加成 + 把天赋2(闲云隐市)赋予全场——但天赋2是条件天赋(场上≥4干员才触发)，
      // 默认模型全场仅自身1人 → 不触发，自回不计；火墙需队友法术伤害触发灼燃，单目标不计。
      // 仅剩：普攻物理 + 天赋1 每秒法伤/灼燃（阻挡目标默认满足）。
      const sim = simulateSkillTimeline({
        grade, duration: skillDuration, enemy,
        attacks: [{ type: 'physical', atk: skillAtk, interval: int }],
        dots,
      });
      return makeResult(sim, p);
    }
  }

  // ========== 珊比 char_4235_thumpy（侵蚀） ==========
  if (id === 'char_4235_thumpy') {
    const epMul = rates.perHitEp; // 每击侵蚀倍率（精1 起）
    const epDot = (interval, baseAtk) => (epMul ? [{ type: null, atk: baseAtk, epMul, el, interval }] : []);
    if (si === 0) {
      // S1 还不走：atk/def+，普攻照常附侵蚀；推动不计。
      const sim = simulateSkillTimeline({
        grade, duration: skillDuration, enemy,
        attacks: [{ type: 'physical', atk: skillAtk, interval: int }],
        dots: epDot(int, skillAtk),
      });
      return makeResult(sim, p);
    }
    if (si === 1) {
      // S2 慢慢走：攻防+，普攻照常附侵蚀；4格胶每 interval(0.7s) 0.43~0.5×atk 物伤+停顿(胶伤害源珊比→每跳附侵蚀)；队友附加 0.15 侵蚀不计
      const gumInt = levelData.interval || 0.7;
      const gumScale = levelData.atk_scale || 0.5;
      const sim = simulateSkillTimeline({
        grade, duration: skillDuration, enemy,
        attacks: [{ type: 'physical', atk: skillAtk, interval: int }],
        dots: [
          ...epDot(int, skillAtk),                                   // 普攻附侵蚀
          { type: 'physical', atk: skillAtk, dmgMul: gumScale, interval: gumInt },  // 胶物伤（每跳伤害=攻击力×0.5）
          ...epDot(gumInt, skillAtk),                                // 胶每跳附侵蚀=天赋倍率×当前攻击力
        ],
      });
      return makeResult(sim, p);
    }
    if (si === 2) {
      // S3 不准走：阻挡+2 同时攻击所有阻挡(单目标=普攻)附侵蚀；传送带每秒 interval 0.33~0.4×atk 物伤（能攻击到的敌人在带上→每跳附侵蚀）
      const beltInt = levelData.interval || 1;
      const beltScale = levelData.atk_scale || 0.4;
      const sim = simulateSkillTimeline({
        grade, duration: skillDuration, enemy,
        attacks: [{ type: 'physical', atk: skillAtk, interval: int }],
        dots: [
          ...epDot(int, skillAtk),
          { type: 'physical', atk: skillAtk, dmgMul: beltScale, interval: beltInt },
          ...epDot(beltInt, skillAtk),
        ],
      });
      return makeResult(sim, p);
    }
  }

  // ========== 响石 char_4214_cairn（神经） ==========
  if (id === 'char_4214_cairn') {
    if (si === 0) {
      // S1 覆盖式休整：血上限+ 纯防御 → 普攻照常，天赋每秒神经照常
      const sim = simulateSkillTimeline({
        grade, duration: skillDuration, enemy,
        attacks: [{ type: 'physical', atk: skillAtk, interval: int }],
        dots: rates.perSecEp ? [{ type: null, atk: skillAtk, epMul: rates.perSecEp, el, interval: 1 }] : [],
      });
      return makeResult(sim, p);
    }
    if (si === 1) {
      // S2 震撼型指路：触发型(dur=-1)。立即屏障(承伤不计)+周围地面 10s 每秒 atk_scale×atk 法伤 + ep 神经损伤。
      // 触发即给 buff，不影响常态普攻 → 技能总伤 = 10s 窗口法伤+神经爆条(若有)；普攻照常在常态行。
      const win = levelData.buff_duration || 10;
      const artsMul = levelData.atk_scale || 0.8;
      const epMulS2 = levelData.ep_damage_ratio || 0.1;
      const sim = simulateSkillTimeline({
        grade, duration: win, enemy,
        dots: [
          { type: 'arts', atk: skillAtk, dmgMul: artsMul, interval: 1 },
          { type: null, atk: skillAtk, epMul: epMulS2, el: 'sanity', interval: 1 },
        ],
      });
      const norm = primNormalFields(op, slotData, panelAtk, enemy);
      const dur = win;
      const arts = sim.arts;
      const total = arts + sim.element;
      const dmgTypes = {};
      if (arts > 0) dmgTypes.arts = { skillDps: arts / dur, skillTotalDamage: arts, cycleDps: null };
      if (sim.element > 0) dmgTypes.element = { skillDps: sim.element / dur, skillTotalDamage: sim.element, cycleDps: null };
      return {
        type: 'damage', skillDps: 0, skillTotalDamage: total, cycleDps: null,
        normalDps: norm.normalDps, normalTypes: norm.normalTypes,
        skillHps: null, normalHps: null, totalHeal: null,
        isToggle: false, isPermanent: false, realInterval: int, panelAtk,
        damageType: 'arts', normalDamageType: 'physical', dmgTypes,
      };
    }
  }

  // 菲莱/裂响等防御向干员技能兜底：普攻照常（无攻击增益时 skillAtk≈panelAtk）
  const physHit = calcPhysicalDamage(skillAtk, enemy.def);
  const sim = simulateSkillTimeline({
    grade, duration: skillDuration > 0 ? skillDuration : 1, enemy,
    attacks: [{ type: 'physical', atk: skillAtk, interval: int }],
  });
  return makeResult(sim, p);
}
