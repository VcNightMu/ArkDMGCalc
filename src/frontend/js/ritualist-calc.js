// ArkDMGCalc - 巫役(ritualist,辅助)计算
// 特性「攻击造成法术伤害，可以造成元素损伤」→ 直伤按法术结算(引擎 SUBPROF_ARTS 已覆盖,数据 damageType 仍为 physical)。
// 损伤为攻击力×倍率的附带效果(与本源铁卫同口径:epBase = 'atk',不吃物防/法抗,只推动敌方 EP 条)。
// 元素类型:酒神=神经(sanity)/塑心=凋亡(dark)/凛视=凋亡(dark)/伯塔尼=侵蚀(water)/波卜=灼燃(fire)/PhonoR-0=凋亡(dark)。
// 敌方爆发:神经 6000(cd10)/凋亡 800×15(cd15)/侵蚀 5000(cd8)/灼燃 7000+10s 法抗-20(cd10);EP 容量 1000(普通/精英)/2000(领袖)。
//
// 用户口径(2026-09-18):
//   · 巫役通用:由于损伤条性质特殊,干员实际造成伤害可能与理论不符(损伤条按敌方 EP 稳态/窗口模拟,属近似)
//   · 波卜:天赋「焦点诱导」的损伤 DOT 不计算
//   · 酒神:召唤物信息请在「特殊-干员附带单位」中查询(本能的召唤/迷狂牢笼独立成条)
//   · 伯塔尼:天赋「背弃沉默」的攻击速度增幅按满层计算(经 TALENT_SPD_DRIVERS,叠层上限 max_stack_cnt)
import { calcArtsDamage, calcPhysicalDamage } from './calculator.js';
import { simulateSkillTimeline, steadyElementDps, ELEMENT_BREAK, EP_CAPACITY } from './element-calc.js';
import { calcCycleDps } from './medic-calc.js';

// 模组特性追加「对精英和领袖敌人造成的元素损伤提升 18%」(traitEnhance.ep_damage_scale):
// 敌方为精英/领袖时,该次计算内所有损伤量统一乘以倍率(损伤累积端 → 更快爆条)。
// 由 damage-calc.js 在调用前根据敌人类型(state.enemy.grade)与本干员模组设置。
let EP_MUL = 1;
const epm = (v) => v * EP_MUL;
export function setRitualEpMul(m) { EP_MUL = typeof m === 'number' && m > 0 ? m : 1; }

// 巫役损伤类型归属
export const RITUAL_ELEMENT = {
  'char_1042_phatm2': 'sanity',   // 酒神:神经损伤
  'char_245_cello': 'dark',       // 塑心:凋亡损伤
  'char_4102_threye': 'dark',     // 凛视:凋亡损伤
  'char_4223_botany': 'water',    // 伯塔尼:侵蚀损伤
  'char_487_bobb': 'fire',        // 波卜:灼燃损伤
  'char_4136_phonor': 'dark',     // PhonoR-0:凋亡损伤
};

// 读天赋 blackboard(模组同名 te 覆盖感知;按精化阶段/潜能过滤候选,取最高档)
function bbValue(candSource, blackboardKey, elite = 2, pot = 0) {
  let best = null;
  for (const cand of candSource) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (typeof cand.phase === 'number' && cand.phase > elite) continue;
    if (candPot > pot) continue;
    const bb = cand.blackboard || {};
    const v = bb[blackboardKey];
    if (typeof v === 'number' && (best === null || v > best)) best = v;
  }
  return best;
}

/**
 * 巫役天赋损伤源(常态,不含技能)。
 * @returns {el, perHitEp, perSecEp, epScale, deploy}
 *   perHitEp/perSecEp:攻击力×倍率 的损伤(每击 / 每秒)
 *   epScale:敌方受到的损伤倍率(塑心「精神逆构」受到的凋亡损伤提高;模组同名 te 覆盖)
 */
export function ritualTalentRates(op, slotData, candSourceFor) {
  const el = RITUAL_ELEMENT[op.id] || null;
  const elite = slotData && typeof slotData.elite === 'number' ? slotData.elite : 2;
  const pot = (slotData && slotData.potentialRank) || 0;
  const r = { el, perHitEp: 0, perSecEp: 0, epScale: 1 };
  if (op.id === 'char_1042_phatm2') {
    r.perHitEp = bbValue(candSourceFor(op, slotData, 0), 'attack@ep_damage_ratio', elite, pot) || 0;   // 形为心役:攻击附带 20~33%
  } else if (op.id === 'char_245_cello') {
    r.perSecEp = bbValue(candSourceFor(op, slotData, 0), 'ep_damage_ratio', elite, pot) || 0;          // 无词哀歌:范围内每秒 6~10%
    r.epScale = bbValue(candSourceFor(op, slotData, 1), 'ep_damage_scale', elite, pot) || 1;            // 精神逆构:受到的凋亡损伤提高 20%(模组 X 1.28/1.33)
  } else if (op.id === 'char_4102_threye') {
    // 天赋「揭示者」仅在【探索者的银凇止境】中生效(模式限定,条件类) → 默认不计算;
    // 其凋亡损伤来自技能(S1 80%/S2 35%)。
    r.perHitEp = 0;
  } else if (op.id === 'char_487_bobb') {
    // 天赋「焦点诱导」(首次攻击后 5s 每秒灼燃损伤) → 用户口径:不计算
    r.perHitEp = 0;
  } else if (op.id === 'char_4136_phonor') {
    // 悠远河谷的齐唱:部署后 40s 内攻击附带固定点凋亡损伤 + 法术/元素脆弱(落地点火处理)
    r.deploy = {
      dur: bbValue(candSourceFor(op, slotData, 0), 'duration', elite, pot) || 40,
      epFlat: bbValue(candSourceFor(op, slotData, 0), 'attack@dark_damage_value', elite, pot) || 0,
      fragile: bbValue(candSourceFor(op, slotData, 0), 'damage_scale', elite, pot) || 1,
    };
  }
  // 精英/领袖:模组特性追加的元素损伤提升(损伤累积端;非精英/领袖时 EP_MUL = 1)
  r.perHitEp = epm(r.perHitEp || 0);
  r.perSecEp = epm(r.perSecEp || 0);
  if (r.deploy && typeof r.deploy.epFlat === 'number') r.deploy.epFlat = epm(r.deploy.epFlat);
  return r;
}

/** 巫役常态三档:法术普攻 DPS + 天赋损伤爆条平均 DPS */
export function ritualNormalFields(op, slotData, panelAtk, enemy, baseInt, candSourceFor) {
  const grade = (enemy && enemy.grade) || 'normal';
  const rates = ritualTalentRates(op, slotData, candSourceFor);
  const int = baseInt > 0 ? baseInt : 1.6;
  const artsDps = calcArtsDamage(panelAtk, enemy.res) / int;
  let elementDps = 0;
  if (rates.el && rates.perHitEp > 0) {
    elementDps += steadyElementDps(grade, rates.el, panelAtk * rates.perHitEp * rates.epScale, int).avgDps;
  }
  if (rates.el && rates.perSecEp > 0) {
    elementDps += steadyElementDps(grade, rates.el, panelAtk * rates.perSecEp * rates.epScale, 1).avgDps;
  }
  const normalTypes = { arts: { dps: artsDps } };
  if (elementDps > 0) normalTypes.element = { dps: elementDps };
  return { normalDps: artsDps + elementDps, normalTypes, grade, int };
}

// 触发型技能(无 duration)的充能窗口:攻击回复=(ceil(spCost)+1)×间隔;自动回复=spCost 秒
function cycleWindow(levelData, int) {
  const spCost = levelData.spCost || 0;
  if (levelData.spType === 'INCREASE_WHEN_ATTACK') {
    const charge = Math.max(1, Math.ceil(spCost / 1));
    return { chargeAttacks: charge, cycleSec: (charge + 1) * int };
  }
  const charge = Math.max(0, Math.floor(spCost / int));
  return { chargeAttacks: charge, cycleSec: spCost > 0 ? spCost : int };
}

// 损伤稳态:每周期损伤总量 → 平均爆条 DPS / 周期元素总量(用 steadyElementDps,含爆发冷却锁条)
function cycleElement(grade, el, epPerCycle, cycleSec) {
  if (!el || !(epPerCycle > 0) || !(cycleSec > 0)) return { dps: 0, total: 0 };
  const st = steadyElementDps(grade, el, epPerCycle, cycleSec);
  return { dps: st.avgDps, total: st.avgDps * cycleSec };
}

function mkResult(p, fields) {
  const { panelAtk, skillDuration } = p;
  const base = {
    type: 'damage', damageType: 'arts', isToggle: false, isPermanent: false,
    skillDps: 0, skillTotalDamage: 0, cycleDps: null,
    skillHps: null, normalHps: null, totalHeal: null,
    normalDps: p.normalDps !== undefined ? p.normalDps : null,
    normalTypes: p.normalTypes,
    realInterval: p.realInterval, panelAtk,
  };
  return Object.assign(base, fields);
}

/**
 * 巫役技能期结果(全员特殊:元素损伤窗口/触发型损伤均需元素模拟)。
 * @param {Object} p { op, slotData, panelAtk, skillAtk, skillDuration, realInterval, levelData, enemy, candSourceFor }
 */
export function calcRitualSkill(p) {
  const { op, slotData, skillAtk, panelAtk, levelData, enemy } = p;
  const si = slotData.skillIndex || 0;
  const grade = (enemy && enemy.grade) || 'normal';
  const rates = ritualTalentRates(op, slotData, p.candSourceFor);
  const el = rates.el;
  const int = p.realInterval > 0 ? p.realInterval : 1.6;
  const dur = p.skillDuration > 0 ? p.skillDuration : 0;
  const A = (x) => calcArtsDamage(x, enemy.res);
  const B = (x) => calcPhysicalDamage(x, enemy.def);

  // ===== 酒神 char_1042_phatm2(神经) =====
  if (op.id === 'char_1042_phatm2') {
    const epPerHit = panelAtk * rates.perHitEp;      // 天赋损伤(按面板攻击力)
    if (si === 0) {
      // S1「暗夜回声」:下次攻击造成两次 atk_scale 法术伤害并束缚;束缚期间目标受到的神经损伤提升至 ep_damage_scale 倍
      const hits = 2;                                 // bb.times
      const hit = A(skillAtk);
      const epHit = (skillAtk * rates.perHitEp) * (levelData.ep_damage_scale ?? 1);
      const { chargeAttacks, cycleSec } = cycleWindow(levelData, int);
      const single = hit * hits;
      const cdps = calcCycleDps(levelData, int, A(panelAtk), single);
      const ce = cycleElement(grade, el, chargeAttacks * epPerHit + epHit * hits, cycleSec);
      return Object.assign(mkResult(p, {
        skillDps: 0, skillTotalDamage: single, cycleDps: cdps + ce.dps,
        dmgTypes: {
          arts: { skillDps: 0, skillTotalDamage: single, cycleDps: cdps },
          element: { skillDps: ce.dps, skillTotalDamage: ce.total, cycleDps: ce.dps },
        },
      }));
    }
    if (si === 1) {
      // S2「群体性谵妄」:攻击速度+30/35,持续时间无限(召唤物「本能的召唤」独立成条,不计入自身输出)
      // 注意:本技能 atk_scale 是召唤物伤害倍率,不是酒神自身普攻倍率 → 自身攻击取面板
      const dps = A(panelAtk) / int;
      const ce = steadyElementDps(grade, el, panelAtk * rates.perHitEp, int);
      return mkResult(p, {
        isPermanent: true, basePanelAtk: true, skillDps: dps + ce.avgDps, skillTotalDamage: 0, cycleDps: null,
        dmgTypes: {
          arts: { skillDps: dps, skillTotalDamage: 0, cycleDps: null },
          element: { skillDps: ce.avgDps, skillTotalDamage: 0, cycleDps: null },
        },
      });
    }
    if (si === 2) {
      // S3「空剧场」:攻击范围扩大,攻击力+105%(专一);技能期间造成过神经损伤的敌人每秒受到 10% 攻击力神经损伤直至爆发
      const sim = simulateSkillTimeline({
        grade, duration: dur, enemy,
        attacks: [{ type: 'arts', atk: skillAtk, interval: int, count: Math.floor(dur / int) }],
        dots: [
          { type: null, atk: skillAtk, epMul: rates.perHitEp, el, interval: int, count: Math.floor(dur / int) },
          { type: null, atk: skillAtk, epMul: epm(levelData.ep_damage_ratio ?? 0), el, interval: 1, count: Math.floor(dur) },
        ],
      });
      const total = sim.arts + sim.element;
      return mkResult(p, {
        skillDps: dur > 0 ? total / dur : 0, skillTotalDamage: total, cycleDps: null,
        dmgTypes: {
          arts: { skillDps: dur > 0 ? sim.arts / dur : 0, skillTotalDamage: sim.arts, cycleDps: null },
          element: { skillDps: dur > 0 ? sim.element / dur : 0, skillTotalDamage: sim.element, cycleDps: null },
        },
      });
    }
  }

  // ===== 塑心 char_245_cello(凋亡) =====
  if (op.id === 'char_245_cello') {
    const scale = rates.epScale;
    if (si === 0) {
      // S1「黄金的狂喜」:对一个未处于爆发期间的敌人造成 2.6/3.0×攻击力法术伤害并附带 100/110% 攻击力凋亡损伤;
      // 可充能,技能未开启时无法普通攻击 → 常态行 0,触发型按周期(充能窗口)结算
      const hit = A(skillAtk);
      const ep = skillAtk * epm(levelData.ep_damage_ratio ?? 0) * scale;
      const { chargeAttacks, cycleSec } = cycleWindow(levelData, int);
      const cdps = hit / cycleSec;
      const ce = cycleElement(grade, el, chargeAttacks * 0 + ep + skillAtk * rates.perSecEp * scale * cycleSec, cycleSec);
      return mkResult(p, {
        skillDps: 0, skillTotalDamage: hit, cycleDps: cdps + ce.dps,
        normalDps: 0, normalTypes: undefined,   // 技能未开启时无法普通攻击
        dmgTypes: {
          arts: { skillDps: 0, skillTotalDamage: hit, cycleDps: cdps },
          element: { skillDps: ce.dps, skillTotalDamage: ce.total, cycleDps: ce.dps },
        },
      });
    }
    if (si === 1) {
      // S2「安魂的弥撒」:攻速+50/60,额外攻击1个目标(单目标口径不计),自身造成伤害时附带 20/25% 攻击力凋亡损伤
      const sim = simulateSkillTimeline({
        grade, duration: dur, enemy,
        attacks: [{ type: 'arts', atk: skillAtk, interval: int, count: Math.floor(dur / int) }],
        dots: [
          { type: null, atk: skillAtk, epMul: epm(levelData.ep_damage_ratio ?? 0), el, interval: int, count: Math.floor(dur / int), epScale: scale },
          { type: null, atk: skillAtk, epMul: rates.perSecEp, el, interval: 1, count: Math.floor(dur), epScale: scale },
        ],
      });
      const total = sim.arts + sim.element;
      return mkResult(p, {
        skillDps: dur > 0 ? total / dur : 0, skillTotalDamage: total, cycleDps: null,
        dmgTypes: {
          arts: { skillDps: dur > 0 ? sim.arts / dur : 0, skillTotalDamage: sim.arts, cycleDps: null },
          element: { skillDps: dur > 0 ? sim.element / dur : 0, skillTotalDamage: sim.element, cycleDps: null },
        },
      });
    }
    if (si === 2) {
      // S3「自由的探戈」:停止攻击,攻击力+155%,第二天赋效果提升至 2.3 倍(受到的凋亡损伤提高 (scale-1)×2.3)
      const boosted = 1 + (scale - 1) * (levelData.scale_delta_to_one ?? 1);
      const sim = simulateSkillTimeline({
        grade, duration: dur, enemy,
        dots: [{ type: null, atk: skillAtk, epMul: rates.perSecEp, el, interval: 1, count: Math.floor(dur), epScale: boosted }],
      });
      return mkResult(p, {
        damageType: 'element',
        normalDps: 0, normalTypes: undefined,   // 停止攻击
        skillDps: dur > 0 ? sim.element / dur : 0, skillTotalDamage: sim.element, cycleDps: null,
        dmgTypes: { element: { skillDps: dur > 0 ? sim.element / dur : 0, skillTotalDamage: sim.element, cycleDps: null } },
      });
    }
  }

  // ===== 凛视 char_4102_threye(凋亡;天赋凋亡为模式限定 → 损伤全部来自技能) =====
  if (op.id === 'char_4102_threye') {
    if (si === 0) {
      // S1「我见崩毁之前」:下一次攻击造成 1.1/1.3×攻击力法术伤害并附带 60/80% 攻击力凋亡损伤(可充能)
      const hit = A(skillAtk);
      const ep = skillAtk * epm(levelData.ep_damage_ratio ?? 0);
      const { chargeAttacks, cycleSec } = cycleWindow(levelData, int);
      const cdps = calcCycleDps(levelData, int, A(panelAtk), hit);
      const ce = cycleElement(grade, el, ep, cycleSec);
      return mkResult(p, {
        skillDps: 0, skillTotalDamage: hit, cycleDps: cdps + ce.dps,
        dmgTypes: {
          arts: { skillDps: 0, skillTotalDamage: hit, cycleDps: cdps },
          element: { skillDps: ce.dps, skillTotalDamage: ce.total, cycleDps: ce.dps },
        },
      });
    }
    if (si === 1) {
      // S2「我见枯朽之后」:攻速+40/50,额外攻击一名目标(单目标口径不计),每次攻击附带 30/35% 攻击力凋亡损伤
      const sim = simulateSkillTimeline({
        grade, duration: dur, enemy,
        attacks: [{ type: 'arts', atk: skillAtk, interval: int, count: Math.floor(dur / int) }],
        dots: [{ type: null, atk: skillAtk, epMul: epm(levelData['attack@ep_damage_ratio'] ?? 0), el, interval: int, count: Math.floor(dur / int) }],
      });
      const total = sim.arts + sim.element;
      return mkResult(p, {
        skillDps: dur > 0 ? total / dur : 0, skillTotalDamage: total, cycleDps: null,
        dmgTypes: {
          arts: { skillDps: dur > 0 ? sim.arts / dur : 0, skillTotalDamage: sim.arts, cycleDps: null },
          element: { skillDps: dur > 0 ? sim.element / dur : 0, skillTotalDamage: sim.element, cycleDps: null },
        },
      });
    }
  }

  // ===== 伯塔尼 char_4223_botany(侵蚀;天赋攻速叠层按满层,损伤来自技能) =====
  if (op.id === 'char_4223_botany') {
    if (si === 0) {
      // S1「谐波破坏」:下一次攻击造成 0.9/1.1×攻击力法术伤害并附带 90/100% 攻击力侵蚀损伤;
      // 「若目标未受到侵蚀损伤则额外…」为条件类 → 不计算(用户口径之外,按引擎惯例)
      const hit = A(skillAtk);
      const ep = skillAtk * epm(levelData.ep_damage_ratio ?? 0);
      const { cycleSec } = cycleWindow(levelData, int);
      const cdps = calcCycleDps(levelData, int, A(panelAtk), hit);
      const ce = cycleElement(grade, el, ep, cycleSec);
      return mkResult(p, {
        skillDps: 0, skillTotalDamage: hit, cycleDps: cdps + ce.dps,
        dmgTypes: {
          arts: { skillDps: 0, skillTotalDamage: hit, cycleDps: cdps },
          element: { skillDps: ce.dps, skillTotalDamage: ce.total, cycleDps: ce.dps },
        },
      });
    }
    if (si === 1) {
      // S2「静域回声」:攻击范围扩大,同时攻击2个目标(单目标口径计1),每次攻击额外造成 1.3/1.5×攻击力物理伤害
      // 和 60/65% 攻击力侵蚀损伤;范围内敌人侵蚀损伤冷却恢复速度+25%(缩短 CD,用户口径外按数据不计)
      const physMul = levelData['attack@extra_atk_scale'] ?? 0;
      const sim = simulateSkillTimeline({
        grade, duration: dur, enemy,
        attacks: [
          { type: 'arts', atk: skillAtk, interval: int, count: Math.floor(dur / int) },
          { type: 'physical', atk: skillAtk * physMul, interval: int, count: Math.floor(dur / int) },
        ],
        dots: [{ type: null, atk: skillAtk, epMul: epm(levelData['attack@ep_damage_ratio'] ?? 0), el, interval: int, count: Math.floor(dur / int) }],
      });
      const total = sim.arts + sim.physical + sim.element;
      return mkResult(p, {
        skillDps: dur > 0 ? total / dur : 0, skillTotalDamage: total, cycleDps: null,
        dmgTypes: {
          arts: { skillDps: dur > 0 ? sim.arts / dur : 0, skillTotalDamage: sim.arts, cycleDps: null },
          physical: { skillDps: dur > 0 ? sim.physical / dur : 0, skillTotalDamage: sim.physical, cycleDps: null },
          element: { skillDps: dur > 0 ? sim.element / dur : 0, skillTotalDamage: sim.element, cycleDps: null },
        },
      });
    }
  }

  // ===== 波卜 char_487_bobb(灼燃;天赋损伤 DOT 不计算) =====
  if (op.id === 'char_487_bobb') {
    if (si === 0) {
      // S1「非和平劝说」:下一次攻击造成 1.7/2.0×攻击力法术伤害并附带 110/120% 攻击力灼燃损伤
      const hit = A(skillAtk);
      const ep = skillAtk * epm(levelData.ep_damage_ratio ?? 0);
      const { cycleSec } = cycleWindow(levelData, int);
      const cdps = calcCycleDps(levelData, int, A(panelAtk), hit);
      const ce = cycleElement(grade, el, ep, cycleSec);
      return mkResult(p, {
        skillDps: 0, skillTotalDamage: hit, cycleDps: cdps + ce.dps,
        dmgTypes: {
          arts: { skillDps: 0, skillTotalDamage: hit, cycleDps: cdps },
          element: { skillDps: ce.dps, skillTotalDamage: ce.total, cycleDps: ce.dps },
        },
      });
    }
    if (si === 1) {
      // S2「此路不通」:停止攻击,灼烧地段内地面敌人每秒受到 1.1/1.4×攻击力法术伤害和 18/20% 攻击力灼燃损伤
      const sim = simulateSkillTimeline({
        grade, duration: dur, enemy,
        dots: [
          { type: 'arts', atk: skillAtk, dmgMul: levelData['attack@atk_scale'] ?? 0, interval: 1, count: Math.floor(dur) },
          { type: null, atk: skillAtk, epMul: epm(levelData['attack@ep_damage_ratio'] ?? 0), el, interval: 1, count: Math.floor(dur) },
        ],
      });
      const total = sim.arts + sim.element;
      return mkResult(p, {
        normalDps: 0, normalTypes: undefined,   // 停止攻击
        skillDps: dur > 0 ? total / dur : 0, skillTotalDamage: total, cycleDps: null,
        dmgTypes: {
          arts: { skillDps: dur > 0 ? sim.arts / dur : 0, skillTotalDamage: sim.arts, cycleDps: null },
          element: { skillDps: dur > 0 ? sim.element / dur : 0, skillTotalDamage: sim.element, cycleDps: null },
        },
      });
    }
  }

  // 兜底:普攻照常(无攻击增益时 skillAtk ≈ panelAtk)
  const hit = A(skillAtk);
  const dps = hit / int;
  return mkResult(p, {
    skillDps: dur > 0 ? dps : 0, skillTotalDamage: dur > 0 ? dps * dur : hit, cycleDps: dur > 0 ? null : dps,
    dmgTypes: { arts: { skillDps: dur > 0 ? dps : 0, skillTotalDamage: dur > 0 ? dps * dur : hit, cycleDps: dur > 0 ? null : dps } },
  });
}

/**
 * PhonoR-0(1★,无技能)落地点火:部署后 N 秒内攻击附带固定点凋亡损伤 + 法术/元素脆弱;
 * 常态(窗口外)仅法术普攻。
 */
export function calcPhonorDeploy(p) {
  const { op, slotData, panelAtk, realInterval, enemy } = p;
  const grade = (enemy && enemy.grade) || 'normal';
  const rates = ritualTalentRates(op, slotData, p.candSourceFor);
  const dep = rates.deploy;
  const int = realInterval > 0 ? realInterval : 1.6;
  if (!dep) return null;
  const frag = dep.fragile || 1;
  const n = Math.floor(dep.dur / int);
  const sim = simulateSkillTimeline({
    grade, duration: dep.dur, enemy,
    attacks: [{ type: 'arts', atk: panelAtk * frag, interval: int, count: n }],
    dots: [{ type: null, atk: 0, epMul: 0, el: rates.el, interval: int, count: n, epFlat: dep.epFlat }],
  });
  const element = sim.element * frag;
  const total = sim.arts + element;
  const normalDps = calcArtsDamage(panelAtk, enemy.res) / int;
  return {
    type: 'damage', damageType: 'arts', isToggle: false, isPermanent: false,
    skillDps: dep.dur > 0 ? total / dep.dur : 0, skillTotalDamage: total, cycleDps: null,
    normalDps, normalDamageType: 'arts', normalTypes: { arts: { dps: normalDps } },
    skillHps: null, normalHps: null, totalHeal: null, realInterval: int, panelAtk,
    deploySkill: true,
    dmgTypes: {
      arts: { skillDps: dep.dur > 0 ? sim.arts / dep.dur : 0, skillTotalDamage: sim.arts, cycleDps: null },
      element: { skillDps: dep.dur > 0 ? element / dep.dur : 0, skillTotalDamage: element, cycleDps: null },
    },
  };
}
