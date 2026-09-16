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
  'char_134_ifrit': 'fire',    // 伊芙利特(Δ/D 模组「灼燃损伤」)：灼燃
  // ---- 本源术师(primcaster) 六人(2026-09-16) ----
  'char_4204_mantra': 'sanity',  // 真言：神经损伤
  'char_1040_blaze2': 'fire',    // 烛煌：灼燃损伤
  'char_4146_nymph': 'dark',     // 妮芙：凋亡损伤
  'char_4198_christ': 'sanity',  // Miss.Christine：神经损伤
  'char_4081_warmy': 'fire',     // 温米：灼燃损伤
  'char_499_kaitou': 'dark',     // 折光：凋亡损伤
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
 * 灼燃爆条窗口增益与爆条总量（事件驱动，含"灼烧持续伤害同样造成损伤"口径，用户 2026-09-16）。
 * 事件流按时间序推进 EP；冷却期锁条（免疫）；爆条后 debuffDur 秒内敌方法抗 -20（直接加算）。
 * 直伤事件在窗口内按 res-20 计算 → 返回加权平均修正系数（法伤对法抗线性，故加权平均精确）。
 * @param {{grade:string, res:number, events:Array<{t:number, atk:number, ep:number}>}} p
 * @returns {{factor:number, element:number, breaks:number}}
 */
export function fireWindowBenefit(p) {
  const def = ELEMENT_BREAK.fire;
  const capacity = EP_CAPACITY[p.grade] || 1000;
  const events = [...(p.events || [])].sort((a, b) => a.t - b.t);
  let ep = capacity, cdUntil = -Infinity;
  const windows = [];
  for (const e of events) {
    if (!(e.ep > 0) || e.t < cdUntil) continue;
    ep -= e.ep;
    if (ep <= 0) { ep = capacity; cdUntil = e.t + def.cd; windows.push([e.t, e.t + def.debuffDur]); }
  }
  const inWindow = (t) => windows.some(w => t >= w[0] && t < w[1]);
  let num = 0, den = 0;
  for (const e of events) {
    if (!(e.atk > 0)) continue;
    const r = inWindow(e.t) ? p.res + def.resDebuff : p.res;
    num += e.atk * (1 - r / 100);
    den += e.atk * (1 - p.res / 100);
  }
  return { factor: den > 0 ? num / den : 1, element: breakTotalDmg('fire') * windows.length, breaks: windows.length };
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

/**
 * 元素爆发窗口时长(秒):火=减抗窗口(debuffDur,与爆发期同长)、凋亡=持续伤害段(dur)、
 * 神经/侵蚀=爆发冷却(cd)。用于"目标处于元素爆发期间"类条件(本源术师额外元素伤害/条件天赋)。
 */
export function elementBurstDur(el) {
  const def = ELEMENT_BREAK[el];
  if (!def) return 0;
  if (def.debuffDur !== undefined) return def.debuffDur;
  if (def.dur !== undefined) return def.dur;
  return def.cd;
}

/**
 * 本源术师(primcaster)统一元素时间轴模拟(用户口径 2026-09-16,与伊芙利特窗口口径同源):
 *  - 损伤基数 = 该次攻击"实际造成的伤害"×比例(即吃法抗后的法伤,不是攻击力)。epBase='damage' 时
 *    EP 值 = 本事件实际法伤 × epMul;epBase='atk' 时为 攻击力 × epMul(本源铁卫口径,兜底)。
 *  - 灼燃爆条→后续事件法抗 -20(窗口内先降抗再结算,含对后续 EP 的放大);神经/凋亡无降抗。
 *  - 条件性额外元素伤害:事件时刻若目标处于该元素爆发窗口内(严格晚于爆条时刻),额外 atk×condScale。
 *  - 窗口内攻击力加成(windowAtkEl/windowAtkMul):折光「预先告知」等自身在爆发窗口内 +攻击力。
 * 事件流可给 times(显式时刻数组)或 interval/count/firstAt。
 * 可选 p.breakDot={el,atk,scale,interval}:爆条窗口内天赋"持续秒伤型"元素 DoT(每窗口 floor(窗口时长/interval) 跳 ×atk×scale)。
 * @returns {{arts:number, element:number, breakDmg:number, condDmg:number, dotDmg:number, dotCount:number, condCount:number,
 *            breaks:Object, breakCount:number, artsInWindow:number}}
 */
export function simulateElementTimeline(p) {
  const grade = p.grade || 'normal';
  const duration = p.duration > 0 ? p.duration : 0;
  const baseRes = (p.enemy && p.enemy.res) || 0;
  const cap = EP_CAPACITY[grade] || 1000;
  const eps = {}, cdUntil = {}, wins = {}, brk = {};
  const ensure = (el) => { if (eps[el] === undefined) { eps[el] = cap; cdUntil[el] = -Infinity; wins[el] = []; brk[el] = []; } };
  const inWin = (el, t) => {
    const w = wins[el];
    if (!w) return false;
    for (const x of w) if (t > x[0] + 1e-9 && t < x[1] - 1e-9) return true;
    return false;
  };
  const evs = [];
  for (const s of (p.streams || [])) {
    if (Array.isArray(s.times)) {
      for (const t of s.times) if (t <= duration + 1e-9) evs.push({ t, s });
    } else {
      const iv = s.interval > 0 ? s.interval : 1;
      const n = s.count !== undefined ? s.count : Math.floor(duration / iv);
      const first = s.firstAt !== undefined ? s.firstAt : iv;
      for (let i = 0; i < n; i++) {
        const t = first + i * iv;
        if (t > duration + 1e-9) break;
        evs.push({ t, s });
      }
    }
  }
  evs.sort((a, b) => a.t - b.t);
  let arts = 0, breakDmg = 0, condDmg = 0, condCount = 0, artsInWindow = 0;
  for (const e of evs) {
    const s = e.s;
    let atk = s.atk;
    if (s.windowAtkEl && s.windowAtkMul && inWin(s.windowAtkEl, e.t)) atk = atk * (1 + s.windowAtkMul);
    let r = baseRes;
    const inFire = ELEMENT_BREAK.fire.resDebuff ? inWin('fire', e.t) : false;
    if (inFire) r = baseRes + ELEMENT_BREAK.fire.resDebuff;
    r = Math.max(0, r);
    const dmg = (s.dmgMul ? atk * s.dmgMul : 0) * (100 - r) / 100;
    arts += dmg;
    if (inFire && dmg > 0) artsInWindow += dmg;
    if (s.condScale && s.condEl !== undefined && inWin(s.condEl, e.t)) { condDmg += atk * s.condScale; condCount++; }
    if (s.el && s.epMul) {
      ensure(s.el);
      if (!(e.t < cdUntil[s.el])) {
        const epAmt = (s.epBase === 'atk' ? atk : dmg) * s.epMul;
        eps[s.el] -= epAmt;
        if (eps[s.el] <= 0) {
          const def = ELEMENT_BREAK[s.el];
          const bd = breakTotalDmg(s.el);
          brk[s.el].push({ t: e.t, dmg: bd });
          wins[s.el].push([e.t, e.t + elementBurstDur(s.el)]);
          breakDmg += bd;
          eps[s.el] = cap;
          cdUntil[s.el] = e.t + def.cd;
        }
      }
    }
  }
  // 爆条窗口内天赋"持续秒伤型"元素 DoT(如妮芙第一天赋「失魂」:爆发期间每秒受到 攻击力×倍率 元素伤害)。
  // 每个爆条窗口独立计:窗口时长 = elementBurstDur(el),跳数 = floor(窗口/间隔),每跳 = atk×scale;
  // 窗口随冷却不重叠(cd≥dur),故总计 = 爆条次数 × 跳数 × 每跳。
  let dotDmg = 0, dotCount = 0;
  if (p.breakDot && p.breakDot.el) {
    const bd = p.breakDot;
    const iv = bd.interval > 0 ? bd.interval : 1;
    const ticks = Math.max(0, Math.floor(elementBurstDur(bd.el) / iv));
    const list = brk[bd.el] || [];
    for (let i = 0; i < list.length; i++) { dotDmg += ticks * bd.atk * bd.scale; dotCount++; }
  }
  let breakCount = 0;
  for (const k of Object.keys(brk)) breakCount += brk[k].length;
  return { arts, element: breakDmg + condDmg + dotDmg, breakDmg, condDmg, dotDmg, dotCount, condCount, breaks: brk, breakCount, artsInWindow };
}

