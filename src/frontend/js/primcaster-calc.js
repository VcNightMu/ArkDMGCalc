// ArkDMGCalc - 本源术师(primcaster)元素损伤计算
// 分支特性:攻击造成法术伤害,可以造成元素伤害(可对空)。
// 元素类型:真言/Christine=神经(sanity)、烛煌/温米=灼燃(fire)、妮芙/折光=凋亡(dark)。
//
// 口径(用户 2026-09-16,与伊芙利特 Δ/D 模组同源):
//  1) 损伤累积基数 = 该次攻击"实际造成的伤害"×比例(吃法抗后的法伤,不是攻击力);
//  2) 爆条窗口统一:损伤事件流推进 EP→爆条→窗口内降抗(火法抗-20)/条件性元素伤害按时间加权摊算;
//     神经爆发 6000/cd10、灼燃 7000+10s 法抗-20、凋亡 800×15=12000/cd15;
//  3) 弹药型(烛煌 S3)、蓄力型(温米 S2 按 enhanced_duration 满蓄力档)沿用既有机制;妮芙 S2 充能按「点燃」cycle 处理;
//  4) 不施加损伤的技能槽(Christine S2 / 温米 S2 / 折光 S2 / 烛煌 S3 / 妮芙 S3 等)不得产生爆条 → 其"对爆发期目标的
//     额外元素伤害"一律归零(用户口径 2026-09-16);依赖外部损伤源的天赋(烛煌「熔点引爆」全场、Christine「诱人美馔」、
//     真言两条天赋、妮芙第二天赋「窥心钥」)默认不计;
//  5) 同一干员自己造成的爆条在其自供槽位要算:温米 S1「难免会溢锅」(攻击范围内=自身火圈满足)、
//     妮芙 S1/S2 第一天赋「失魂」(自供爆条 → 爆发窗口内每秒 攻击力×0.4 元素 DoT)、
//     折光 S1「预先告知」(范围内存在爆发单位)随窗口计入。
// 常态(无技能)不含元素(普攻不移交损伤)→ 常态行不变。
import { calcArtsDamage } from './calculator.js';
import { OPERATOR_ELEMENT, simulateElementTimeline } from './element-calc.js';

// 从天赋候选按精化/潜能取当前生效档 bb 值 + 模组 talentEnhance 强化(按 requiredPotentialRank 过滤,取最大)
function talentBbMax(op, slotData, talentIndex, key) {
  const t = (op.talents || [])[talentIndex];
  if (!t) return 0;
  const phase = slotData.elite, pot = slotData.potentialRank || 0;
  let best = 0;
  for (const c of (t.candidates || [])) {
    const cp = c.potentialRank ?? c.requiredPotentialRank ?? 0;
    if (c.phase <= phase && cp <= pot) {
      const v = c.blackboard && typeof c.blackboard[key] === 'number' ? c.blackboard[key] : 0;
      if (v > best) best = v;
    }
  }
  const m = slotData.module;
  if (m) {
    const mod = (op.modules || []).find(x => x.id === m.moduleId);
    const lv = mod && (mod.levels || []).find(l => l.level === m.moduleLevel);
    if (lv) for (const te of (lv.talentEnhance || [])) {
      const rp = te.requiredPotentialRank ?? 0;
      const bb = te.blackboard || {};
      if (rp <= pot && typeof bb[key] === 'number' && bb[key] > best) best = bb[key];
    }
  }
  return best;
}

// 组合本源术师技能期结果:arts + element(爆条/条件元素/自满足天赋),保留原常态行
function buildResult(result, { arts, element, window, cycle }) {
  const total = arts + element;
  const dur = window > 0 ? window : 1;
  const dmgTypes = {};
  if (arts > 0) dmgTypes.arts = { skillDps: arts / dur, skillTotalDamage: arts, cycleDps: cycle ? arts / dur : null };
  if (element > 0) dmgTypes.element = { skillDps: element / dur, skillTotalDamage: element, cycleDps: cycle ? element / dur : null };
  if (!dmgTypes.arts && !dmgTypes.element) dmgTypes.arts = { skillDps: 0, skillTotalDamage: 0, cycleDps: null };
  return {
    ...result,
    type: 'damage',
    skillTotalDamage: total,
    skillDps: total / dur,
    cycleDps: cycle ? total / dur : null,
    dmgTypes,
    damageType: 'arts',
  };
}

/**
 * 本源术师技能期元素/爆条建模入口(damage-calc.js 在通用结算后调用)。
 * @param {Object} p { op, slotData, levelData, panelAtk, skillAtk, skillRealInterval, skillDuration, effRes, skillIndex, grade, result }
 * @returns 覆盖后的 result(arts/element/总伤/DPS/dmgTypes);未建模槽位原样返回。
 */
export function calcPrimCasterSkill(p) {
  const { op, slotData, levelData, panelAtk, skillRealInterval, skillDuration, effRes, skillIndex, result } = p;
  if (!result || skillIndex < 0) return result;
  const id = op.id;
  const L = levelData || {};
  const el = OPERATOR_ELEMENT[id];
  const res = effRes || 0;
  const grade = p.grade || 'normal';
  const I = skillRealInterval > 0 ? skillRealInterval : 1.6;
  const D = skillDuration > 0 ? skillDuration : 0;
  const enemy = { res };
  const A = (a) => calcArtsDamage(a, res);

  // ========== 真言 char_4204_mantra（神经 sanity） ==========
  if (id === 'char_4204_mantra') {
    if (skillIndex === 0) {
      // S1 共鸣溃缩(攻击回复 AUTO「强化下一次攻击」):点燃类周期,每 spCost 击触发一次强化击;普攻不移交损伤。
      const sp = L.spCost || 3;
      const cyc = (Math.ceil(sp / 1) + 1) * I;      // 周期 = 攻击间隔 ×(sp+1)(同 calcCycleDps 攻回口径)
      const epPer = A(panelAtk * L.atk_scale) * L.ep_damage_ratio;  // 损伤基数 = 强化击实际法伤 × 比例
      const cycles = Math.max(1, Math.ceil(1000 / epPer));
      const window = cycles * cyc;
      const timesN = [], timesR = [];
      for (let c = 0; c < cycles; c++) {
        const base = c * cyc;
        for (let i = 1; i <= sp; i++) timesN.push(base + i * I);
        timesR.push(base + cyc);
      }
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { times: timesN, atk: panelAtk, dmgMul: 1 },
        { times: timesR, atk: panelAtk, dmgMul: L.atk_scale, el, epMul: L.ep_damage_ratio, epBase: 'damage', condScale: L.element_atk_scale, condEl: el },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: true });
    }
    if (skillIndex === 1) {
      // S2 意识联协(手动 25s,间隔 -0.7 秒,弹跳 3 敌):单目标口径只取主目标段(每击 ×attack@atk_scale)。
      const window = D || 25;
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: panelAtk, dmgMul: L['attack@atk_scale'], interval: I, el, epMul: L['attack@ep_damage_ratio'], epBase: 'damage', condScale: L['attack@element_atk_scale'], condEl: el },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: false });
    }
    if (skillIndex === 2) {
      // S3 无言为真(手动 40s,攻击力+230%):本体不施加损伤;atk_scale 是麻痹溢出弹射(事件/多目标,不计)。
      const window = D || 40;
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: panelAtk * (1 + (L.atk || 0)), dmgMul: 1, interval: I },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: false });
    }
  }

  // ========== 烛煌 char_1040_blaze2（灼燃 fire） ==========
  if (id === 'char_1040_blaze2') {
    if (skillIndex === 0) {
      // S1 炙手之援(AUTO 灼烧火圈,持续 max_duration 20s):本体普攻照常 + 火圈每秒 0.6×atk 法伤 + 30% 灼燃损伤。
      const window = L.max_duration || 20;
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: panelAtk, dmgMul: 1, interval: I },
        { atk: panelAtk, dmgMul: L.atk_scale, interval: 1, el, epMul: L.element_multiplier, epBase: 'damage' },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: true });
    }
    if (skillIndex === 1) {
      // S2 沸血燎原(手动 35s,攻击力+130%,间隔 +0.9 秒):本体普攻 + 灼烧地段每秒 0.35×atk 法伤 + 30% 灼燃损伤。
      const window = D || 35;
      const atkS = panelAtk * (1 + (L.atk || 0));
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: atkS, dmgMul: 1, interval: I },
        { atk: atkS, dmgMul: L.atk_scale, interval: 1, el, epMul: L.element_damage_scale, epBase: 'damage' },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: false });
    }
    if (skillIndex === 2) {
      // S3 众恶的焚场(弹药型 attack@trigger_time 发,间隔 -1.3 → 0.3s):每发 攻击力×(1+atk)。
      // 用户口径(2026-09-16):S3 自体不施加灼燃损伤 → 不产生爆条,亦不得产生任何元素伤害;
      // 原"整弹药窗口视目标处于灼燃爆发期、每发额外 attack@atk_scale×攻击力"的处理作废 → 元素归零,
      // S3 只保留本体法伤(弹药窗口口径不变)。
      const ammo = Math.max(1, Math.round(L['attack@trigger_time'] || 1));
      const window = ammo * I;
      const atkS = panelAtk * (1 + (L.atk || 0));
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: atkS, dmgMul: 1, interval: I },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: true });
    }
  }

  // ========== 妮芙 char_4146_nymph（凋亡 dark） ==========
  if (id === 'char_4146_nymph') {
    if (skillIndex === 0) {
      // S1 笞心击(手动 20s,攻击力+90%,附 15% 凋亡损伤;爆发期额外 0.4×atk 元素伤害)。
      // 另计第一天赋「失魂」:自供爆条 → 爆发窗口(15s)内目标每秒受 攻击力×0.4 元素 DoT(用户口径 2026-09-16)。
      const window = D || 20;
      const atkS = panelAtk * (1 + (L.atk || 0));
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: atkS, dmgMul: 1, interval: I, el, epMul: L['attack@ep_damage_ratio'], epBase: 'damage', condScale: L['attack@extra_ep_damage_scale'], condEl: el },
      ], breakDot: { el, atk: atkS, scale: talentBbMax(op, slotData, 0, 'element_atk_scale'), interval: talentBbMax(op, slotData, 0, 'nymph_t_1[ep_damage].interval') || 1 } });
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: false });
    }
    if (skillIndex === 1) {
      // S2 怵然震爆(充能瞬发,可存 ct 次):点燃类 cycle,每 spCost 秒一发,单发 攻击力×3.6 + 22% 凋亡损伤;
      // 爆发期强化第一天赋(元素倍率)属条件 → 仅窗口内计;
      // 并存第一天赋「失魂」DoT(基数 = 面板攻击力,S2 无攻击力加成)→ 自供爆条窗口内每秒 攻击力×0.4 元素伤害。
      const sp = L.spCost || 13;
      const epPer = A(panelAtk * L.atk_scale) * L.ep_damage_ratio;
      const cycles = Math.max(1, Math.ceil(1000 / epPer));
      const window = cycles * sp;
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: panelAtk, dmgMul: L.atk_scale, interval: sp, el, epMul: L.ep_damage_ratio, epBase: 'damage', condScale: L.element_atk_scale, condEl: el },
      ], breakDot: { el, atk: panelAtk, scale: talentBbMax(op, slotData, 0, 'element_atk_scale'), interval: talentBbMax(op, slotData, 0, 'nymph_t_1[ep_damage].interval') || 1 } });
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: true });
    }
    if (skillIndex === 2) {
      // S3 心防溃决(手动 31s,攻击力+190%,攻速+45):不施加损伤 → 无爆条/无元素(条件元素默认不计)。
      const window = D || 31;
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: panelAtk * (1 + (L.atk || 0)), dmgMul: 1, interval: I },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: false });
    }
  }

  // ========== Miss.Christine char_4198_christ（神经 sanity） ==========
  if (id === 'char_4198_christ') {
    if (skillIndex === 0) {
      // S1 自由用餐礼仪(手动 25s,攻击力+30%,附 15% 神经损伤):自供损伤 → 视条内是否攒满决定是否爆条。
      const window = D || 25;
      const atkS = panelAtk * (1 + (L.atk || 0));
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: atkS, dmgMul: 1, interval: I, el, epMul: L['attack@ep_damage_ratio'], epBase: 'damage' },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: false });
    }
    if (skillIndex === 1) {
      // S2 狂饮之宴(手动 20s,自身停攻,感知灵体每秒 0.95×atk 法伤):S2 不施加损伤 → 无爆条;
      // "对神经爆发期目标额外 atk_scale_ep×atk 元素伤害"为条件型且无自供 → 默认不计。
      const window = D || 20;
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: panelAtk, dmgMul: L.atk_scale, interval: 1 },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: false });
    }
  }

  // ========== 温米 char_4081_warmy（灼燃 fire） ==========
  if (id === 'char_4081_warmy') {
    if (skillIndex === 0) {
      // S1 炎炎火焰(手动 20s,攻速+80,附 15% 灼燃损伤):自供损伤;天赋「难免会溢锅」(攻击范围内爆发开始时
      // +ep_damage_scale×攻击力 元素伤害,S1 自满足)按每次爆条计入。
      const window = D || 20;
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: panelAtk, dmgMul: 1, interval: I, el, epMul: L['attack@ep_damage_ratio'], epBase: 'damage' },
      ]});
      const talent = talentBbMax(op, slotData, 0, 'ep_damage_scale');
      const talentElem = sim.breakCount * panelAtk * talent;
      return buildResult(result, { arts: sim.arts, element: sim.element + talentElem, window, cycle: false });
    }
    if (skillIndex === 1) {
      // S2 滔滔热流(手动,攻击力+180%,间隔 +0.9 秒):按满蓄力档计——持续取 enhanced_duration(15→30s),
      // 攻击间隔不变故攻击次数随之翻倍(沿用引擎既有蓄力口径,参卡涅利安「所有技能均按蓄力计算」);
      // 多目标(蓄力 3 目标)按单目标模型只计 1。S2 自身不移交灼燃损伤 → 无爆条;
      // 蓄力"额外元素伤害"(0.5×atk)与天赋「难免会溢锅」均需外部灼燃源 → S2 槽仍不计(与烛煌 S3 同理)。
      const window = (L.enhanced_duration > 0 ? L.enhanced_duration : (D || 15));
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: panelAtk * (1 + (L.atk || 0)), dmgMul: 1, interval: I },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: false });
    }
  }

  // ========== 折光 char_499_kaitou（凋亡 dark） ==========
  if (id === 'char_499_kaitou') {
    if (skillIndex === 0) {
      // S1 镭射穿凿(手动 20s,攻击力+90%,附 15% 凋亡损伤;爆发期额外 0.4×atk 元素伤害)。
      // 天赋「预先告知」(攻击范围内存在爆发单位时 攻击力+18%,S1 自满足)→ 窗口内攻击力提升(同时放大 arts/EP/条件元素)。
      const window = D || 20;
      const atkS = panelAtk * (1 + (L.atk || 0));
      const talentAtk = talentBbMax(op, slotData, 0, 'atk');
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: atkS, dmgMul: 1, interval: I, el, epMul: L['attack@ep_damage_ratio'], epBase: 'damage',
          windowAtkEl: el, windowAtkMul: talentAtk, condScale: L['attack@extra_ep_damage_scale'], condEl: el },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: false });
    }
    if (skillIndex === 1) {
      // S2 热处理变色(手动 35s,攻速+80):不施加损伤 → 无爆条;额外元素(条件)/天赋(需外部凋亡源)默认不计。
      const window = D || 35;
      const sim = simulateElementTimeline({ grade, duration: window, enemy, streams: [
        { atk: panelAtk, dmgMul: 1, interval: I },
      ]});
      return buildResult(result, { arts: sim.arts, element: sim.element, window, cycle: false });
    }
  }

  return result;
}
