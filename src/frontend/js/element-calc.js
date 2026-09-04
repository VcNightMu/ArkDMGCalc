// ArkDMGCalc - 元素损伤系统核心
// 数据源：PRTS「元素」条目（客户端 2.7.61；2026-04-07 起敌人类单位统一使用敌方爆发效果）
// 元素伤害不吃物防/法抗，独立档位（UI 灰色 --dmg-element）。
//
// 机制速记：
// - 敌人默认 EP 1000（普通/精英）/ 2000（领袖），每秒恢复 0，损伤抵抗 0。
// - 损伤累积使 EP 归零 → 爆发（爆条）：立刻给敌方效果，进入爆发冷却（期间所有类型 EP 锁定），
//   冷却结束 EP 回满重新累积。
// - 我方干员挨打版效果（神经晕眩/侵蚀减防/凋亡阻回等）不进模型（承伤向）。

// 敌方爆发效果表。cd=爆发冷却秒数。dmg=一次性元素伤害。
// fire 额外：爆发起 debuffDur 秒内敌方法抗 -20（直接加算，先于伤害生效）→ 灼燃减抗增伤只算爆条后窗口。
// water 额外：永久 -120 防御（可叠）→ 用户口径：计算干员伤害时不考虑减防，按原防御。仅记录爆条次数供参考。
// sanity 额外：3 层麻痹（打断普攻）→ 不影响我方输出，不计。
// dark：50% 虚弱（衰减）+ 期间每秒 800 元素伤害 ×15s → 虚弱不影响我方输出，只算持续伤害总量。
export const ELEMENT_BREAK = {
  fire:   { dmg: 7000, cd: 10, resDebuff: -20, debuffDur: 10, label: '灼燃' },
  water:  { dmg: 5000, cd: 8, label: '侵蚀' },
  sanity: { dmg: 6000, cd: 10, label: '神经' },
  dark:   { dmgPerSec: 800, dur: 15, cd: 15, label: '凋亡' }, // 总量 = 800×15
};

// 敌人 EP 容量（按敌人阶级；损伤抵抗全员 0）
export const EP_CAPACITY = { normal: 1000, elite: 1000, leader: 2000 };

// 干员损伤类型归属（后续元素系干员逐个登记）
// key: 干员 id；value: ELEMENT 键
export const OPERATOR_ELEMENT = {
  'char_2026_yu': 'fire',      // 余：灼燃
  'char_4235_thumpy': 'water', // 珊比：侵蚀
  'char_4214_cairn': 'sanity', // 响石：神经
};

/**
 * 模拟敌方损伤条（时间轴事件驱动，底层纯函数，干员函数各自组合）。
 * @param {string} grade 敌人阶级 normal/elite/leader（决定 EP 容量）
 * @param {string} el ELEMENT 键（决定爆发伤害与冷却）
 * @param {Array<{t:number, ep:number}>} events 损伤施加事件，t 为相对模拟起点的秒
 * @returns {{ breaks: Array<{t:number, dmg:number, resWindowEnd:number|null}>,
 *             totalDmg: number, count: number, capacity: number }}
 *   breaks[i].resWindowEnd：灼燃爆条后 debuffDur 秒窗口终点（其它类型 null）
 *   dark 的 dmg 为整段持续伤害总量（800×15）
 */
export function simulateEp(grade, el, events) {
  const def = ELEMENT_BREAK[el];
  if (!def) throw new Error('未知元素类型: ' + el);
  const capacity = EP_CAPACITY[grade] || 1000;
  const sorted = [...events].sort((a, b) => a.t - b.t);
  let ep = capacity;         // 当前 EP（满值起算：技能期开始/常态模拟起点时敌人未受损伤）
  let cdUntil = -Infinity;   // 爆发冷却截止时刻
  const breaks = [];
  let totalDmg = 0;
  for (const ev of sorted) {
    if (ev.t < cdUntil) continue; // 冷却期损伤免疫（EP 锁定）
    ep -= ev.ep;
    if (ep > 0) continue;
    // 爆条
    const dmg = def.dmg !== undefined ? def.dmg : (def.dmgPerSec * def.dur);
    breaks.push({
      t: ev.t,
      dmg,
      resWindowEnd: def.resDebuff ? ev.t + def.debuffDur : null,
    });
    totalDmg += dmg;
    ep = capacity;
    cdUntil = ev.t + def.cd;
  }
  return { breaks, totalDmg, count: breaks.length, capacity };
}

/** dark/灼燃等持续型敌方爆发伤害总量（供断言与展示） */
export function breakTotalDmg(el) {
  const def = ELEMENT_BREAK[el];
  return def.dmg !== undefined ? def.dmg : def.dmgPerSec * def.dur;
}

/** 灼燃爆条窗口内敌方法抗（减抗直接加算，窗口外回原值）；res 为空/无窗口时原样返回 */
export function resWithFireDebuff(res, t, breaks) {
  if (!breaks || breaks.length === 0) return res;
  for (const b of breaks) {
    if (b.resWindowEnd !== null && t >= b.t && t < b.resWindowEnd) {
      return res + ELEMENT_BREAK.fire.resDebuff;
    }
  }
  return res;
}

/**
 * 常态损伤稳态循环：干员常驻损伤源（天赋每秒/每击型）在常态持续施加，
 * 从条满起算：n 次事件攒满→爆条（记一次元素伤害）→冷却期免疫→条回满循环。
 * 平均元素 DPS = 爆条伤害 / 周期；爆条时刻与冷却时长以离散事件精确模拟。
 * @param {string} grade
 * @param {string} el
 * @param {number} epPerEvent 每次事件的损伤值（按常态攻击力折算）
 * @param {number} eventInterval 事件间隔秒（每秒型=1，每击型=攻击间隔）
 * @param {number|null} cdOverride 冷却覆盖（珊比 duration_dec 折算后 5s）
 * @returns {{avgDps:number, cycleSec:number, breakAt:number, countPerCycle:number}}
 */
export function steadyElementDps(grade, el, epPerEvent, eventInterval, cdOverride = null) {
  const def = ELEMENT_BREAK[el];
  if (!def || !(epPerEvent > 0) || !(eventInterval > 0)) {
    return { avgDps: 0, cycleSec: null, breakAt: null, countPerCycle: 0 };
  }
  const capacity = EP_CAPACITY[grade] || 1000;
  const cd = cdOverride !== null ? cdOverride : def.cd;
  const dmg = def.dmg !== undefined ? def.dmg : (def.dmgPerSec * def.dur);
  // 首事件 t=0：第 n 次事件时刻 t=(n-1)×interval；需 n×ep ≥ capacity
  const n = Math.ceil(capacity / epPerEvent);
  const breakAt = (n - 1) * eventInterval; // 爆条发生在第 n 次事件的时刻
  const cycleSec = breakAt + cd;
  return { avgDps: cycleSec > 0 ? dmg / cycleSec : 0, cycleSec, breakAt, countPerCycle: 1 };
}

/**
 * 技能期时间轴模拟：从条满起（用户口径：开技时敌人未受损伤），逐事件推进。
 * 事件流分两类并行走：
 *  - 攻击事件：每 attackInterval 一击（首击 t=0），直伤按 type 公式（法伤实时查灼燃窗口 res）
 *  - 持续事件：每 dotInterval 一跳（首跳 t=dotStart），可带直伤与损伤
 * @param {Object} p
 * @param {string} p.grade
 * @param {number} p.duration 技能时长
 * @param {{def:number,res:number}} p.enemy
 * @param {Array<{type:'physical'|'arts'|'true', atk:number, interval:number}|null>} p.attacks 攻击流（可空；口径同引擎：首击在开技后第一个 interval，共 floor(duration/interval) 击）
 * @param {Array<{type?:'physical'|'arts'|'true', atk:number, dmgMul?:number, epMul?:number, el?:string, interval:number, count?:number}>} p.dots 持续流（首跳在 interval 后）：每跳直伤 = atk×dmgMul，每跳损伤 = atk×epMul
 * @returns {{physical:number, arts:number, true:number, element:number, breaks:number, artHitsInFire:number}}
 */
export function simulateSkillTimeline(p) {
  const { grade, duration, enemy } = p;
  const capacity = EP_CAPACITY[grade] || 1000;
  // 元素状态：按类型独立维护（灼燃/侵蚀/神经同场可能并存，各自条与冷却）
  const eps = {};   // 当前 EP（满值起算）
  const cdUntil = {}; // 冷却截止
  const breaks = {};  // 每类型爆条列表 {t, dmg}
  const epState = (el) => {
    if (!eps[el]) { eps[el] = capacity; cdUntil[el] = -Infinity; breaks[el] = []; }
  };
  const applyEp = (el, amount, t) => {
    if (!amount || !(amount > 0)) return;
    epState(el);
    if (t < cdUntil[el]) return; // 冷却免疫（条锁定）
    eps[el] -= amount;
    if (eps[el] > 0) return;
    const def = ELEMENT_BREAK[el];
    const dmg = def.dmg !== undefined ? def.dmg : (def.dmgPerSec * def.dur);
    breaks[el].push({ t, dmg, resWindowEnd: def.resDebuff ? t + def.debuffDur : null });
    eps[el] = capacity;
    cdUntil[el] = t + def.cd;
  };
  const allBreaks = (el) => breaks[el] || [];
  // 单发直伤（法伤实时查灼燃窗口内法抗减益）
  const hit = (type, atk, t) => {
    if (type === 'physical') return Math.max(atk - enemy.def, atk * 0.05);
    if (type === 'true') return atk;
    const res = resWithFireDebuff(enemy.res, t, allBreaks('fire'));
    const dmg = atk * (100 - res) / 100;
    return Math.max(dmg, atk * 0.05);
  };

  // 攻击流：首击 t=interval（开技后第一个攻击间隔），共 floor(duration/interval) 击
  const events = [];
  if (p.attacks && p.attacks.length) {
    for (const a of p.attacks) {
      const interval = a.interval > 0 ? a.interval : 1;
      const n = a.count !== undefined ? a.count : Math.floor(duration / interval);
      for (let i = 1; i <= n; i++) {
        const t = i * interval;
        if (t > duration) break;
        events.push({ t, kind: 'hit', type: a.type, atk: a.atk });
      }
    }
  }
  // 持续流（DOT/损伤）：首跳 t=interval
  if (p.dots && p.dots.length) {
    for (const d of p.dots) {
      const interval = d.interval > 0 ? d.interval : 1;
      const n = d.count !== undefined ? d.count : Math.floor(duration / interval);
      for (let i = 1; i <= n; i++) {
        const t = i * interval;
        if (t > duration) break;
        if (d.epMul && d.epMul > 0) applyEp(d.el || 'fire', d.epMul * d.atk, t);
        if (d.type) events.push({ t, kind: 'dot', type: d.type, atk: d.atk * (d.dmgMul || 1) });
      }
    }
  }

  const out = { physical: 0, arts: 0, true: 0, element: 0, breaks: 0, artHitsInFire: 0 };
  // 元素伤害总量（各类型爆条总和）
  for (const el of Object.keys(breaks)) {
    out.element += breaks[el].reduce((s, b) => s + b.dmg, 0);
    out.breaks += breaks[el].length;
  }
  // 直伤按时间序结算
  events.sort((a, b) => a.t - b.t);
  for (const e of events) {
    const v = hit(e.type, e.atk, e.t);
    if (e.type === 'physical') out.physical += v;
    else if (e.type === 'true') out.true += v;
    else { out.arts += v; if (resWithFireDebuff(enemy.res, e.t, allBreaks('fire')) !== enemy.res) out.artHitsInFire++; }
  }
  return out;
}
