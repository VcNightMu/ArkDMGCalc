// ArkDMGCalc - 召唤师(summoner,辅助)召唤物计算
// 用户口径(2026-09-18):
//   · 召唤师通用:召唤物信息请在「特殊-干员附带单位」中查询(召唤物各自独立成条)
//   · 令:天赋「随付笺咏醉屠苏」的攻击力增幅按满层计算(→ damage-calc.js TALENT_ATK_DRIVERS)
//   · 衡沙:天赋「工匠遗训」的伤害增幅不计算(对机械敌人条件类)
// 模型:召唤物携带持有者的技能槽(由数据层注入),技能期增益作用于召唤物本身;
//      只与特定技能关联的召唤物(令/麦哲伦/电弧),其它技能槽输出 0;多技能共用的召唤物(梅尔/稀音/衡沙/深海色)所有技能槽均输出。
import { calcArtsDamage, calcPhysicalDamage } from './calculator.js';
import { calcCycleDps } from './medic-calc.js';

// tokenId -> { owner, skills:[关联技能索引], dtype:召唤物攻击伤害类型, mods:各技能的增益结构 }
export const TOKEN_MODS = {
  // 令:清平(近战)/逍遥(远程法术)/弦惊(近战,基础物理;合并高级形态为法术)
  'token_10020_ling_soul1': { owner: 'char_2023_ling', skills: [0], dtype: 'physical', mods: { 0: { atkKey: 'atk', spdKey: 'attack_speed', toArts: true } } },
  'token_10020_ling_soul2': { owner: 'char_2023_ling', skills: [1], dtype: 'arts', mods: { 1: { triggerKey: 'atk_scale', arts: true } } },
  'token_10020_ling_soul3': { owner: 'char_2023_ling', skills: [2], dtype: 'physical', mods: { 2: { atkKey: 'atk', ownerDot: { scaleKey: 'atk_scale', intervalKey: 'interval' } } } },
  // 弦惊·升级(合并高级形态):攻击造成法术伤害(独立成条,面板已含高级形态 +80% 攻击力/攻击间隔×0.8)
  'token_10020_ling_soul3_up': { owner: 'char_2023_ling', skills: [2], dtype: 'arts', mods: { 2: { atkKey: 'atk', ownerDot: { scaleKey: 'atk_scale', intervalKey: 'interval' } } } },
  // 麦哲伦:龙腾.F(停顿,无攻击)/龙腾.L(单体法术)/龙腾.A(群体物理)
  'token_10005_mgllan_drone1': { owner: 'char_248_mgllan', skills: [0], dtype: 'physical', mods: { 0: { inert: true } } },
  'token_10005_mgllan_drone2': { owner: 'char_248_mgllan', skills: [1], dtype: 'arts', mods: { 1: { spdKey: 'attack_speed' } } },
  'token_10005_mgllan_drone3': { owner: 'char_248_mgllan', skills: [2], dtype: 'physical', mods: { 2: { atkKey: 'atk' } } },
  // 电弧:戴乌(近战)/赛柯(近战,向前发射子弹)/桑特拉(远程)
  'token_10051_radian_tower1': { owner: 'char_4195_radian', skills: [0], dtype: 'physical', mods: { 0: {} } },
  'token_10052_radian_tower2': { owner: 'char_4195_radian', skills: [1], dtype: 'physical', mods: { 1: { atkKey: 'atk', hitMul: 3 } } },   // 用户口径:开技增加子弹 = 等效 X+1 连击(额外 2 颗 + 基础 1 = 3)
  'token_10053_radian_tower3': { owner: 'char_4195_radian', skills: [2], dtype: 'arts', mods: { 2: { atkKey: 'atk', weakKey: 'damage_scale' } } },   // 用户口径:S3 召唤物为法术伤害;并使其受到 20% 法术脆弱(先状态后伤害)
  // 梅尔:机械水獭(S2 引爆 → 持有者攻击力×500% 法术)
  'token_10004_otter_motter': { owner: 'char_242_otter', skills: [0, 1], dtype: 'physical', mods: { 0: {}, 1: { ownerTriggerKey: 'atk_scale', arts: true } } },
  // 稀音:移动摄影器
  'token_10010_folivo_car': { owner: 'char_336_folivo', skills: [0, 1], dtype: 'physical', mods: { 0: { atkKey: 'atk' }, 1: { atkKey: 'atk' } } },
  // 衡沙:发条羽兽
  'token_10036_lasher_mcbird': { owner: 'char_4140_lasher', skills: [0, 1], dtype: 'physical', mods: { 0: { spdKey: 'attack_speed' }, 1: { atkKey: 'atk' } } },
  // 深海色:触手
  'token_10001_deepcl_tentac': { owner: 'char_110_deepcl', skills: [0, 1], dtype: 'physical', mods: { 0: { atkKey: 'atk' }, 1: {} } },
  // 推击手·温蒂「工程蓄水炮」(本体附带单位,非召唤师):按 PRTS「除基本力度外均以本体的数值为准」→ 伤害基值取温蒂面板攻击力;
  // 常态普攻物理单目标(间隔取自身 2.4s);技能槽=自身「液氮大炮」(群体法术,单目标模型算 1 次;按距离的真实伤害不计)。
  'token_10009_weedy_cannon': { owner: 'char_400_weedy', skills: [0], dtype: 'physical', ownerAtk: true, mods: { 0: { ownerTriggerKey: 'atk_scale', arts: true, noCycle: true } } },
};

// 召唤师自身:这些技能只强化召唤物 → 自身输出按常态展示(技能期无自身伤害)
export const SUMMONER_OWN_NORMAL_SKILLS = {
  'char_336_folivo': [0, 1],   // 稀音:摄影车攻击力
  'char_110_deepcl': [0],      // 深海色:触手攻击力/防御
  'char_242_otter': [1],       // 梅尔:引爆机械水獭(伤害在召唤物侧)
  'char_4140_lasher': [1],     // 衡沙:发条羽兽攻击力
};

// 召唤物获得持有者天赋的攻击力鼓舞(电弧「加油~」:相当于电弧自身 12%/15% 攻击力)
const OWNER_ATK_TALENT = { 'char_4195_radian': { talentIndex: 1, key: 'atk' } };

export function isSummonerToken(op) { return !!(op && TOKEN_MODS[op.id]); }
export function summonerOwnerOf(tokenId) { return TOKEN_MODS[tokenId] ? TOKEN_MODS[tokenId].owner : null; }

/**
 * 召唤物输出。
 * p: { op, slotData, panelAtk(召唤物面板攻击力), realInterval, levelData, skillIndex, isPermanent,
 *      skillDuration, ownerPanelAtk(持有者面板攻击力), enemy, candSourceFor }
 */
export function calcSummonerToken(p) {
  const info = TOKEN_MODS[p.op.id];
  const { enemy } = p;
  const ownerBonus = ownerTalentAtkBonus(p);
  const atk0 = (info.ownerAtk ? (p.ownerPanelAtk || 0) : (p.panelAtk || 0)) + ownerBonus;
  const dtype0 = info.dtype;
  const A = (x) => calcArtsDamage(x, enemy.res);
  const P = (x) => calcPhysicalDamage(x, enemy.def);
  const hitOf = (dtype, x) => (dtype === 'arts' ? A(x) : P(x));
  const baseInterval = p.realInterval > 0 ? p.realInterval : 2.5;

  const si = p.skillIndex;
  const dur = p.skillDuration > 0 ? p.skillDuration : 0;
  const mk = (fields) => Object.assign({
    type: 'damage', damageType: dtype0, isToggle: false, isPermanent: false,
    skillDps: 0, skillTotalDamage: 0, cycleDps: null,
    skillHps: null, normalHps: null, totalHeal: null,
    realInterval: baseInterval, panelAtk: atk0,
  }, fields);

  // 无技能:召唤物常态攻击
  const normalHit = hitOf(dtype0, atk0);
  const normalDps = normalHit / baseInterval;
  const normalTypes = dtype0 === 'arts' ? { arts: { dps: normalDps } } : { physical: { dps: normalDps } };
  if (si == null || si < 0) {
    return mk({ normalDps, normalDamageType: dtype0, normalTypes });
  }
  // 该技能与召唤物无关联 → 召唤物不存在于此配置
  if (!info.skills.includes(si)) {
    return mk({ normalDps: 0, normalDamageType: dtype0, normalTypes: undefined });
  }
  const mod = (info.mods || {})[si] || {};
  const ld = p.levelData || {};

  // 麦哲伦 龙腾.F 类:无攻击
  if (mod.inert) {
    return mk({ normalDps: 0, normalDamageType: dtype0, normalTypes: undefined });
  }

  const atkMul = 1 + (mod.atkKey ? (ld[mod.atkKey] || 0) : 0);
  const spd = mod.spdKey ? (ld[mod.spdKey] || 0) : 0;
  const dtype = mod.toArts ? 'arts' : (mod.arts ? 'arts' : dtype0);
  const interval = spd ? baseInterval * 100 / (100 + spd) : baseInterval;
  const hitMul = mod.hitMul || 1;   // 等效连击(赛柯 S2 增加子弹)
  const weakMul = mod.weakKey ? (ld[mod.weakKey] || 1) : 1;   // 自身施加的法术脆弱(先状态后伤害 → 本次即生效)

  // 触发型:一次性伤害(梅尔引爆 = 持有者攻击力×倍率;令逍遥 = 自身攻击力×倍率)
  if (mod.triggerKey || mod.ownerTriggerKey) {
    const scale = ld[mod.triggerKey || mod.ownerTriggerKey] || 0;
    const src = mod.ownerTriggerKey ? (p.ownerPanelAtk || atk0) : atk0;
    const one = hitOf(mod.arts ? 'arts' : dtype, src * scale);
    const cyc = mod.noCycle ? null : calcCycleDps(ld, baseInterval, normalHit, one);
    return mk({
      normalDps, normalDamageType: dtype0, normalTypes,
      skillTotalDamage: one, cycleDps: cyc,
      dmgTypes: dtype === 'arts' ? { arts: { skillDps: 0, skillTotalDamage: one, cycleDps: cyc } } : { physical: { skillDps: 0, skillTotalDamage: one, cycleDps: cyc } },
    });
  }

  const hitAtk = atk0 * atkMul;
  const hit = hitOf(dtype, hitAtk) * hitMul * weakMul;
  // 无限持续型(稀音 S1 摄影车攻击力+40%):按每秒输出展示,总伤记 0
  if (!(dur > 0) && (mod.atkKey || mod.spdKey)) {
    const dps = hit / interval;
    return mk({ normalDps, normalDamageType: dtype0, normalTypes, damageType: dtype,
      skillDps: dps, skillTotalDamage: 0,
      dmgTypes: dtype === 'arts' ? { arts: { skillDps: dps, skillTotalDamage: 0, cycleDps: null } } : { physical: { skillDps: dps, skillTotalDamage: 0, cycleDps: null } } });
  }
  // 无伤害增益的技能(梅尔 S1 闪避等):技能期不产生伤害,常态照常
  if (!(dur > 0) && !mod.ownerDot) {
    return mk({ normalDps, normalDamageType: dtype0, normalTypes });
  }
  const hits = dur > 0 ? Math.floor(dur / interval) : 1;
  let total = hit * hits;
  const types = dtype === 'arts' ? { arts: { skillTotalDamage: total } } : { physical: { skillTotalDamage: total } };

  // 令 弦惊:召唤物每 interval 秒对周围四格敌人造成 20%×令攻击力 的法术伤害(持有者攻击力缩放)
  if (mod.ownerDot && dur > 0) {
    const dotScale = ld[mod.ownerDot.scaleKey] || 0;
    const dotInt = ld[mod.ownerDot.intervalKey] || 0.5;
    const dotHits = Math.floor(dur / dotInt);
    const dotTotal = calcArtsDamage((p.ownerPanelAtk || 0) * dotScale, enemy.res) * dotHits;
    total += dotTotal;
    types.arts = { skillTotalDamage: (types.arts ? types.arts.skillTotalDamage : 0) + dotTotal };
  }

  const skillDps = dur > 0 ? total / dur : 0;
  for (const k in types) { types[k].skillDps = dur > 0 ? types[k].skillTotalDamage / dur : 0; types[k].cycleDps = null; }
  return mk({
    normalDps, normalDamageType: dtype0, normalTypes,
    skillDps, skillTotalDamage: total, cycleDps: null,
    damageType: dtype,
    dmgTypes: types,
  });
}

// 召唤物获得持有者天赋的攻击力加成(电弧「加油~」)
function ownerTalentAtkBonus(p) {
  const cfg = OWNER_ATK_TALENT[TOKEN_MODS[p.op.id] && TOKEN_MODS[p.op.id].owner];
  if (!cfg) return 0;
  const t = (p.op.talents || [])[cfg.talentIndex];
  if (!t || !t.candidates) return 0;
  const elite = (p.slotData && p.slotData.elite != null) ? p.slotData.elite : 2;
  const pot = (p.slotData && p.slotData.potentialRank) || 0;
  let best = 0;
  for (const cd of t.candidates) {
    if ((cd.phase || 0) > elite) continue;
    if ((cd.potentialRank || 0) > pot) continue;
    const v = (cd.blackboard || {})[cfg.key];
    if (typeof v === 'number') best = Math.max(best, v);
  }
  return (p.ownerPanelAtk || 0) * best;
}
