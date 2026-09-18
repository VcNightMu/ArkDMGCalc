// ArkDMGCalc - Main Calculation Entry
import { calcPhysicalDamage, calcArtsDamage, calcTrueDamage, calcRealInterval, interpolateAttr, calcAttribute } from './calculator.js';
import { SkillType } from './operators.js';
import { state } from './state.js';
import { calcMedical, calcSummonHeal, calcCycleDps } from './medic-calc.js';
import { calcGuardian } from './guardian-calc.js';
import { calcDamage } from './damage-ops-calc.js';
import { calcPrimSkill, primNormalFields } from './primprotector-calc.js';
import { OPERATOR_ELEMENT, steadyElementDps, fireWindowBenefit, simulateSkillTimeline } from './element-calc.js';
import { calcPrimCasterSkill } from './primcaster-calc.js';
import { calcPrimGuardSkill } from './primguard-calc.js';
import { calcRitualSkill, ritualNormalFields, calcPhonorDeploy, setRitualEpMul } from './ritualist-calc.js';
import { calcSummonerToken, isSummonerToken, SUMMONER_OWN_NORMAL_SKILLS } from './summoner-calc.js';

function getSkillLevelData(skill, level) {
  const levels = skill.levels;
  return levels[level] || levels[levels.length - 1];
}

// 常驻攻击力天赋驱动表。
// 此类天赋的 blackboard.atk 为「直接乘算」加数(与技能的直接乘算累加,不连乘),
// 作用于常态与技能期,随精英化/等级/潜能强化取满足条件的最高档。
// key: 干员 id;value: 常驻加攻天赋在 op.talents 数组中的索引。
const TALENT_ATK_DRIVERS = {
  'char_4117_ray': 1,   // 莱伊「入神」(天赋1):攻击相同目标每次+8%攻击力,最多3层(Y 模组 4 层)→ 攻击次数型,叠满 24%/32%/36%
  'char_113_cqbw': 0,   // W「设伏」(天赋0)Y 模组:部署后每秒+1层永久攻击力(0.5%×20 / 1.25%×16)→ 时间型,叠满 10%/20%

  'char_137_brownb': 0,   // 猎蜂「竞技专注」:攻击力每层 +3/4/5/6%,最多 5 层(引擎按满层叠满)
  'char_1026_gvial2': 0,   // 百炼嘉维尔「战地巨斧」:攻击力 +10%(默认按"不阻挡敌人"的档,atk_add 档不计)
  'char_281_popka': 0,     // 泡普卡:攻击力 +3/5/6/8%(E2 潜0 = 6%)
  'char_017_huang': { talentIndex: 1, key: 'huang_t_2[e_002_atk].atk' },   // 煌「严酷训练」:攻击力增幅(模组 X 新增档,默认生效)
  // ---- 狙击·神射手(longrange) ----
  'char_4193_lemuen': 1,   // 蕾缪安「逃犯引渡手续」:在场20秒后攻击力+10%(用户口径:默认常驻;弹药上限+1 在专用分支内计)
  // ---- 狙击·炮手(aoesniper) ----
  'char_118_yuki': 0,
  'char_4177_brigid': 0,   // 水灯心「结绳老手」:本体无攻击力,模组 te 才给 atk 0.06/0.1(用户:默认常驻)   // 白雪「重型手里剑」:攻击力+20%(攻击间隔 +0.2s 见 TALENT_BAT_ADD)
  // ---- 驭械术师(funnel) ----
  'char_4013_kjera': 0,   // 耶拉「低眉」:攻击力+10%(E2);攻击范围内≥2格地面地形改+16%(地形条件默认不计,取无条件档)
  'char_4040_rockr': 0,   // 洛洛「立于磐石」:每15s+4%(E2 pot0),最多4层(时间累积长线默认满层,×max_stack_cnt=+16%)
  'char_4236_tmslot': 0,  // 时隙「新产品测评」:攻击力+8%(浮游单元攻击15%概率停顿为概率控制类,不计)
  // ---- 链术师(chain) ----
  // 异客「孤卒」(周围4格无敌人时 +8%/+10%)与「机理分析」(敌方血量>80%)均为条件型,用户口径默认不生效 → 不入表(见 notes.json)
  'char_4004_pudd': 0,    // 布丁「电磁波」:攻击力+8%(E1)/+10%(E2);Y 模组同名 te 覆盖至 13%/16%
  // ---- 轰击术师(blastcaster) ----
  // 协律「律脉同构」加成对象为"友方干员"(不含自身) → 自身输出不吃,不入表(用户口径 2026-09-16)
  'char_120_hibisc': 0,  // 芙蓉「治疗力提升」:精1 Lv1 起 +4%,Lv55 起 +8%
  'char_4163_rosesa': 0, // 瑰盐:攻击 -5%(治疗代价换倍率,见 TALENT_HEAL_DRIVERS)
  'char_348_ceylon': 0,// 锡兰「湖畔漫步者」:只取默认档 [common].atk(+3%~6% 随精化/潜能5 增强),水地形 [map] 档不计
  'char_172_svrash': 0,   // 银灰「领袖」:攻击+5%/7%(精1)→+10%/12%(精2 潜4),自身常驻(编队再部署-5% 忽略)
  'char_010_chen': 1,     // 陈「持刀格斗术」精二:攻击+5%~6%(防御部分在 TALENT_HP_DEF_DRIVERS)
  'char_103_angel': 1,    // 能天使「天使的祝福」精二:自身攻击+6%~8%(随机友方同效不计)
  'char_180_amgoat': 0,   // 艾雅法拉「炎息」:在场全体术师攻+7%~16%,自身为术师必吃(同赫默光环先例)
  'char_202_demkni': 0,   // 塞雷娅「莱茵充能护服」:站场每20s叠1层×5(单层 atk+5~6%/def+4~5%),按满层处理 → atk+25~30%
  'char_260_durnar': 0,    // 坚雷「攻守兼备」:攻击力+7%(防御部分在 TALENT_HP_DEF_DRIVERS)
  'char_4039_horn': 0,     // 号角「军事要塞」:在场所有重装干员攻击力+20%(自身为重装必得,同炎息先例)
  'char_431_ashlok': 0,    // 灰毫「炮术研习」:攻击力+8%(周身四格地面改+16% 条件版不计,取无条件档)
  'char_493_firwhl': 0,    // 火哨「进退自如」:未阻挡敌人时攻击力+12%(默认远程轰击位未阻挡;阻挡时 def+12% 承伤向不计)
  'char_1050_chen3': 0,   // 赤刃明霄陈「形意洞照」:攻击力+8/11%(精1)→+13/16%(精2 潜4);同天赋攻速在 TALENT_SPD_DRIVERS,弱点伤害另设开关
  'char_210_stward': 0,   // 史都华德「铠甲突破」:攻击力+3%(精1 Lv1 起)→+6%(精1 Lv55 起),优先攻击防御最高目标(索敌不计)
  // ---- 先锋(PIONEER) ----
  'char_240_wyvern': 0,  // 香草「攻击提升」:攻击力+4%(精1 Lv1)→+8%(精1 Lv55),无无条件档
  'char_192_falco': 0,   // 翎羽「攻击提升」:攻击力+8%(精1 Lv55,同香草模板)
  // ---- 冲锋手 ----
  'char_149_scave': 0,   // 清道夫「单独行动者」:攻击+5~13%(精1 5%→精2 潜4 13%,周围四格无友军默认成立,防御在 TALENT_HP_DEF_DRIVERS)
  'char_112_siege': 0,   // 推进之王「万兽之王」:编队所有先锋攻/防+4~10%,自身为先锋必得(同炎息先例),防御在 TALENT_HP_DEF_DRIVERS
  'char_1001_amiya2': 0, // 阿米娅(近卫)「青色怒火」:全场友方攻/防+4%(精1)→+7%(精2),自身必得;技能开启期间效果加倍(见 SKILL_TALENT_ATK_MUL)
  'char_164_nightm': { talentIndex: 0, skillIndex: 1 },  // 夜魔「表里人格」:装备 2 技能(夜魇魔影)时攻击+X%(精1 9%/12%潜4→精2 15%/18%潜4);装 1 技能为闪避向不计
  // ---- 战术家 ----
  'char_4228_closur': 1,  // 可露希尔「极限调度」:携带时【罗德岛】干员攻击+4%
  // ---- 扩散术士(splashcaster) ----
  'char_341_sntlla': 0,   // 寒檀「生于冰寒」:战场停留 20s 后攻击+15%(E2)且获得抵抗——时间条件长线必达成默认触发(同凛御雪境先驱 15s 翻倍先例);Y 模组缩短至 15s 且 +18/20%
  'char_373_lionhd': 0,   // 莱恩哈特「破片杀伤」:攻击范围内每有一个敌人攻击+X%(E2 4%)——键 max_valid_stack_cnt(非 max_stack_cnt)不进叠层乘,天然=单目标 1 层(用户口径);X 模组每层 5%
  'char_4141_marcil': 0,  // 玛露西尔「建校以来第一才女」:有魔力时攻击+25%(E2)且溅射扩大——魔力为常驻资源默认持有(简化口径),技能消耗魔力另计(精2,潜能只改费用不改atk);自身罗德岛必得(携带即生效同编队光环先例);X模组同名te覆盖至6/8%
  // ---- 速射手(fastshot) ----
  'char_133_mm': 0,       // 梅「维多利亚探员」:攻击力+7%(E2 潜0,潜4 +8%)(攻速档在 TALENT_SPD_DRIVERS)
  // ---- 近卫·重剑手(crusher) ----
  'char_4063_quartz': 0,  // 石英「行于荒野」:生命值+4/8%、攻击力+4/8%(E2 潜0 = +8%),无条件面板乘区;X 模组 te 覆盖至 12%/14%
  // ---- 近卫·撼地者(hammer) ----
  'char_4058_pepe': 1,     // 佩佩「弥漫莲香」:在场时所有【近卫】干员攻击力+16%(潜2 +20%)——本人即近卫,吃自己光环(问答确认 2026-09-17)
  'char_4131_odda': 0,     // 奥达「落锤」:累计造成 30 次伤害后攻击力+15%(潜4 +18%;X 模组 te 提到 20%/23% 且计数降至 20)——用户口径默认常驻
  'char_4185_amoris': 1,   // 祐天寺若麦「毋畏爱意」:Ave Mujica 成员攻击力+8%(潜4 +9%)——本人即 Ave Mujica 成员,吃自己光环(问答确认)
  // ---- 近卫·本源近卫(primguard) ----
  'char_4187_graceb': 0,   // 聆音「趁势怜悯」:攻击力+5/10%(E2)→ 用户口径"仅计算基础加成"(击倒神经损伤爆发敌人后的 atk_bonus 升级档不计)
  // ---- 近卫·佣兵(mercenary) ----
  'char_394_hadiya': 0,    // 哈蒂娅「荒野的后裔」:每层攻击力+4%(E2,潜4 +5%),最多 5 层 → 用户口径"默认叠满"(×max_stack_cnt = +20%)
  // ---- 辅助·凝滞师(slower) ----
  'char_1047_halo2': { talentIndex: 0, noStack: true },   // 溯光星源「数据建模」:本体无攻击加成,Y 模组「叠满后攻击力+12%」te(叠满为用户口径默认,该 atk 非每层值 → noStack)
  'char_258_podego': 0,   // 波登可「园丁」:所有【辅助】攻击力 +9%(E2,自身为辅助必得);X 模组同名 te 覆盖为 9%/11%
  'char_358_lisa': 0,     // 铃兰「技力光环·辅助」:本体无攻击加成,X 模组「怀中御守」te 追加攻击力 +6%/9%(无条件,计入)
  // ---- 辅助·削弱者(underminer) ----
  'char_206_gnosis': 1,   // 灵知「殊途同归」:Y 模组「一号项目模型」te 改写为「所有【谢拉格】干员攻击力+10%/15%」——灵知本人即谢拉格(nation=kjerag),吃自己光环;基础天赋无该键 → 无 Y 模组为 0
  // ---- 辅助·巫役(ritualist) ----
  'char_4102_threye': 1,  // 凛视「隐居者」:攻击力 +6%(E2,潜4 +7%);X 模组同名 te 0.09/0.11;同源天赋攻速在 TALENT_SPD_DRIVERS
  // ---- 辅助·召唤师(summoner) ----
  'char_2023_ling': 1,    // 令「随付笺咏醉屠苏」:召唤物被击倒/吸收/回收时攻击力 +3%/层(最多 5 层) — 用户口径 2026-09-18:按满层计算(+15%)
  // ---- 特种·怪杰(geek) ----
  'char_1041_angel2': { talentIndex: 1, mulKey: 'mult' },  // 新约能天使「铳弹协约」:在场时携带弹药类技能的干员攻击力 +9%,
                           // 对【拉特兰】干员效果翻倍(mult=2)——本人即【拉特兰】且三技能全为弹药类 → 自身 +18%
                           // (阵营光环含自身,同佩佩「弥漫莲香」本人吃口径)
  // ---- 特种·陷阱师(traper) ----
  'char_4048_doroth': 1,  // 多萝西「梦想家」:陷阱触发后攻击力 +2%/层,最多叠 10 层(潜4 12 层);用户口径 2026-09-18「默认叠满」
                           // → ×max_stack_cnt = +20%;Y 模组「童话书」L2/L3 同名 te 覆盖为 0.03/0.04(×10 = +30%/+40%)
                           // (该模组 traitEnhance 里 {prob:0.2,atk_scale:2} 为概率类,traitEnhance 不入天赋乘区,天然不计)
};

// 常驻治疗倍率天赋驱动表(blackboard.heal_scale 为治疗量乘数)。
// 治疗干员所有治疗量(普攻/技能期/触发)都乘此倍率;无天赋/未解锁 → 1。
const TALENT_HEAL_DRIVERS = {
  'char_4163_rosesa': 0, // 瑰盐:治疗量 +5%~+17%(随精化/潜能5 增强)
  'char_148_nearl': 0,   // 临光「天马光环」:全图友方医疗效果+10~12%(自身治疗为友方医疗,光环先例自身必得)
  'char_4143_sensi': 0,  // 森西「十年魔物餐经验」:自身治疗量+10%(防御部分在 TALENT_HP_DEF_DRIVERS)
  'char_494_vendla': 0,  // 刺玫「土壤基肥改良」:攻击范围内生命上限最高友方受疗+8~18%(精1→精2 潜5),单目标默认治疗目标=自身=范围内生命最高
};

/**
 * 常驻治疗倍率天赋:按精化阶段/潜能匹配候选,返回治疗量乘数(无天赋/未解锁 → 1)。
 * 候选含潜能档(瑰盐每精化档 pot0/pot4 两条),需 requiredPotentialRank 过滤。
 */
function calcTalentHealScale(op, slotData) {
  const talentIndex = TALENT_HEAL_DRIVERS[op.id];
  if (talentIndex === undefined) return 1;
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 1;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let scale = null;
  for (const cand of talentCandSource(op, slotData, talentIndex, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const hs = cand.blackboard && typeof cand.blackboard.heal_scale === 'number' ? cand.blackboard.heal_scale : 0;
      if (hs > 0 && (scale === null || hs > scale)) scale = hs;
    }
  }
  return scale === null ? 1 : scale;
}

// 查驱动表,返回常驻加攻天赋在当前精英化/等级下的直接乘算加数(0 表示无此天赋或未生效)。
// ===== 斗士(fighter)专用助手 =====
// 贝洛内「家族手段」:攻击使目标防御力降低,默认按叠满(本体 5 层,2 技能期间 8 层)
function demetrDefDownPct(op, slotData, skillIndex) {
  if (op.id !== 'char_4037_demetr') return 0;
  const talent = (op.talents || [])[0];
  if (!talent) return 0;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, 0, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const bb = cand.blackboard || {};
      const per = Math.abs(typeof bb['attack@def'] === 'number' ? bb['attack@def'] : 0);
      const key = skillIndex === 1 ? 'attack@s2_limited_stack_cnt' : 'attack@limited_stack_cnt';
      const stacks = typeof bb[key] === 'number' ? bb[key] : (typeof bb['attack@limited_stack_cnt'] === 'number' ? bb['attack@limited_stack_cnt'] : 0);
      const v = per * stacks;
      if (v > best) best = v;
    }
  }
  return best;
}

// 燧石「身轻无痕」:伤害提升(non-skill 不生效,仅 2 技能期间);返回倍率
function fighterFlintScale(op, slotData) {
  if (op.id !== 'char_415_flint') return 1;
  const talent = (op.talents || [])[0];
  if (!talent) return 1;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let best = 1;
  for (const cand of talentCandSource(op, slotData, 0, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const bb = cand.blackboard || {};
      if (typeof bb.damage_scale === 'number' && bb.damage_scale > best) best = bb.damage_scale;
    }
  }
  return best;
}

// 斗士特例技能表(只拦这些,其余走引擎通用链尾以免丢字段)
const FIGHTER_SPECIAL = {
  'char_347_jaksel': [1],   // 全神贯注:闪避默认不生效 → 0
  'char_157_dagda': [0],    // 反制技巧:默认受击一次结算帮派精神
  'char_2024_chyue': [2],   // 我无:按开满 5 次
  'char_415_flint': [1],    // 锋芒毕露:身轻无痕伤害提升仅 2 技能
  'char_4037_demetr': [1, 2] // 军师的手段 / 清算
};

// ===== 剑豪(sword)专用助手 =====
// ===== 辅助·凝滞师(slower) =====
// 特性「攻击造成法术伤害」:数据 damageType 仍为 physical,统一按法术结算(常态/技能期/模组档)。
// 凝滞师(slower):「攻击造成法术伤害，并使敌人停顿」;削弱者(underminer):「攻击造成法术伤害」(攻击使敌攻击力-10% 持续2秒为敌方减益,非己方输出,不建模);
// 护佑者(blessing):「攻击造成法术伤害,技能开启后改为治疗友方单位(治疗量相当于75%攻击力)」——常态也是法术伤害(同特米米口径,数据 damageType 仍为 physical)。
// 巫役(ritualist):「攻击造成法术伤害，可以造成元素损伤」——直伤按法术,损伤为攻击力×倍率附带(元素爆条走 element-calc 模拟)。
const SUBPROF_ARTS = { slower: true, underminer: true, blessing: true, ritualist: true };
// 巫役(ritualist)天赋 blackboard 读取(模组同名 te 覆盖感知)
const ritualCandSource = (o, sd, ti) => talentCandSource(o, sd, ti, ((o.talents || [])[ti] || {}).candidates);
// 巫役模组特性追加「对精英和领袖敌人造成的元素损伤提升 18%」(traitEnhance.ep_damage_scale):
// 仅当敌人设置为精英/领袖时生效(损伤累积端倍率)。
function ritualGradeEpMul(op, slotData) {
  const g = state.enemy && state.enemy.grade;
  if (g !== 'elite' && g !== 'leader') return 1;
  const lv = getModuleLevelData(op, slotData);
  let mul = 1;
  for (const c of (lv && lv.traitEnhance) || []) {
    const bb = c.blackboard || {};
    if (typeof bb.ep_damage_scale === 'number') mul = Math.max(mul, bb.ep_damage_scale);
  }
  return mul;
}
// 技能期每击倍率改写表(值 = 技能 blackboard 中的倍数键;安洁莉娜 S2「微粒模式」:间隔极大缩短但每击只造成 40% 攻击力法伤)
const SKILL_PER_HIT_SCALE = {
  'char_291_aglina': { 1: 'damage_scale' },
};
// 削弱者(underminer)需专用结算的技能(其余落回引擎通用链尾):
// 灵知:「寒冷/冻结先结算状态再结算伤害」(用户口径 2026-09-17)→ S1 二连击第二下、S2 蓄力、S3 第2击起均处于冻结,
// 吃的是「坚冰」冻结脆弱而非寒冷脆弱,且 S3 顶层 atk_scale 是「技能结束时对冻结目标」的一次性爆发倍率(非普攻倍率)
// → 三个技能都走专用分支,用 gnosisFrozenFragileMul 叠冻结档。
const UNDERMINER_SPECIAL = {
  'char_206_gnosis': [0, 1, 2],
};
// 灵知「坚冰」冻结脆弱倍率(blackboard.damage_scale_freeze;数据里恒有该键,缺失时按天赋文案「冻结则脆弱效果提升至2倍」由
// 寒冷脆弱推算:damage_scale_freeze = 2×damage_scale_cold - 1,如特限证章 A 的 te 只给 damage_scale_cold)。
// 用户口径(2026-09-17):S3「失温症」把敌人冻结延长至技能结束 → 第 2 击起目标始终处于冻结,吃冻结脆弱;
// 第 1 击落点目标尚未冻结,但已处于寒冷(按寒冷脆弱计)。X 模组「誓言」te 覆盖该值(1.56/1.6)。
function gnosisFrozenFragileMul(op, slotData) {
  const talent = (op.talents || [])[0];
  if (!talent) return 1;
  let bestFreeze = 1, bestCold = 1;
  for (const cand of talentCandSource(op, slotData, 0, talent.candidates)) {
    const pot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= slotData.elite && pot <= (slotData.potentialRank || 0)) {
      const bb = cand.blackboard || {};
      const fz = typeof bb.damage_scale_freeze === 'number' ? bb.damage_scale_freeze : 0;
      const cd = typeof bb.damage_scale_cold === 'number' ? bb.damage_scale_cold : 0;
      if (fz > bestFreeze) bestFreeze = fz;
      if (cd > bestCold) bestCold = cd;
    }
  }
  return Math.max(bestFreeze, bestCold > 1 ? 2 * bestCold - 1 : 1);
}
// ===== 吟游者(bard)专用结算 =====
// 特性:不攻击,持续恢复范围内所有友军生命(每秒相当于自身攻击力 10% 的生命),自身不受鼓舞影响
// (U-Official 另加「不受部署数量限制/再部署时间极长」,与输出无关)。用户口径(2026-09-18):
//   · 「鼓舞」作用于友方 → 不进自身输出,纯鼓舞技能(空 S2 / 海蒂 S1)自身无输出变化;
//   · 只看技能期治疗量:技能把特性效果提高至 X% → 技能期 HPS = 面板攻击力 × X(每秒一跳,同铃兰 S3 的 heal 型结果);
//   · 技能改为造成伤害的按伤害算(浊心斯卡蒂 S3 每秒真伤 / 魔王 S2 微尘碰撞真伤 / 三角初华 S2 每 0.3s 法伤)。
// 数据坑:三角初华与 U-Official 的 trait 键少了 attack@ 前缀(atk_to_hp_recovery_ratio),两个键名都认。
function bardTraitRatio(op, levelData) {
  if (levelData && typeof levelData['attack@atk_to_hp_recovery_ratio'] === 'number') return levelData['attack@atk_to_hp_recovery_ratio'];
  const bb = (op.trait && op.trait.blackboard) || {};
  if (typeof bb['attack@atk_to_hp_recovery_ratio'] === 'number') return bb['attack@atk_to_hp_recovery_ratio'];
  return typeof bb['atk_to_hp_recovery_ratio'] === 'number' ? bb['atk_to_hp_recovery_ratio'] : 0.1;
}
// 浊心斯卡蒂本体与其海嗣(token_10017_skadi2_dedant)共用同一套结算(海嗣数据层即继承同等级浊心斯卡蒂的数据)
function isSkadi2(op) { return op.id === 'char_1012_skadi2' || op.id === 'token_10017_skadi2_dedant'; }
// 魔王「过往尘埃」:被“微尘”撞到的友方受到的「特性效果」提升至 1.2(E1)/1.5(E2) 倍(X 模组 te 覆写为 1.6)、持续 6 秒。
// 用户口径(2026-09-18):该「微尘对友方产生的效果」不计算 → 不建模该倍率,特性治疗就按基础比率(10%)计。
// 三角初华「谎言的假面」:技能未开启时每 attack@heal_cd 秒治疗攻击范围内生命最低的友方相当于攻击力 attack@heal_scale
// 的生命(技能期间治疗照常,只是优先选丰川祥子)→ 折算成每秒等效系数(×攻击力)。X 模组 te 覆写为 3s / 30%。
function bardTalentHealRate(op, slotData) {
  if (op.id !== 'char_4184_dolris') return 0;
  const talent = (op.talents || [])[0];
  if (!talent) return 0;
  let rate = 0;
  for (const cand of talentCandSource(op, slotData, 0, talent.candidates || [])) {
    const pot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= slotData.elite && pot <= (slotData.potentialRank || 0)) {
      const bb = cand.blackboard || {};
      const cd = bb['attack@heal_cd'], sc = bb['attack@heal_scale'];
      if (typeof cd === 'number' && cd > 0 && typeof sc === 'number' && sc / cd > rate) rate = sc / cd;
    }
  }
  return rate;
}
// 浊心斯卡蒂「捕食习性」:自身或海嗣攻击范围内存在我方干员时自身攻击力 +6%(存在【深海猎人】干员时改为 +15%)。
// 计算器口径「自身必在自身范围内」(同纯烬艾雅法拉/琴柳先例)→ 取基础档(浊心斯卡蒂本身 group 不属深海猎人);
// Y 模组「一号项目模型」te 覆写为 8%/9%(E2)等(键名 skadi2_e_003_t_2[atk][1].atk)。
function bardSelfAtkMul(op, slotData) {
  if (!isSkadi2(op)) return 1;
  const talent = (op.talents || [])[1];
  if (!talent) return 1;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, 1, talent.candidates || [])) {
    const pot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= slotData.elite && pot <= (slotData.potentialRank || 0)) {
      const bb = cand.blackboard || {};
      for (const k of Object.keys(bb)) if (/\[atk\]\[1\]\.atk$/.test(k) && typeof bb[k] === 'number' && bb[k] > best) best = bb[k];
    }
  }
  return 1 + best;
}
// 吟游者技能结算:全部技能走此分支(纯鼓舞技能返回无自身输出变化的常态 HPS)。
function calcBardSkill(op, slotData, skillIndex, levelData, ctx) {
  const { panelAtk, skillDuration, isPermanent } = ctx;
  const talentRate = bardTalentHealRate(op, slotData);
  const baseRatio = bardTraitRatio(op, null);
  const normalHps = panelAtk * baseRatio + panelAtk * talentRate;   // 常态 HPS(特性 + 常驻天赋额外治疗;过往尘埃倍率不计)
  const dur = skillDuration > 0 ? skillDuration : 0;
  const mk = (sHps, totalHeal, extra) => Object.assign({
    type: 'heal', damageType: 'arts', isToggle: false, isPermanent: !!isPermanent,
    skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null,
    skillHps: sHps, normalHps, totalHeal: totalHeal === undefined ? null : totalHeal,
    realInterval: 1, panelAtk,
  }, extra || {});
  const ratioHps = () => panelAtk * bardTraitRatio(op, levelData);
  if (isSkadi2(op)) {
    if (skillIndex === 0) { const h = ratioHps(); return mk(h, h * dur); }        // S1 同归殊途之吟:特性提高至 70%(专一) dur30
    if (skillIndex === 1) return mk(ratioHps(), null);                            // S2 同葬无光之愿:永久,特性提高至 18%(专一)
    if (skillIndex === 2) {                                                       // S3 潮涌,潮枯:特性变为每秒真伤(无治疗)
      // 用户口径(2026-09-18):S3 伤害仅计自身的(海嗣那部分在召唤物侧查询) → 单份 atk_scale
      const dps = panelAtk * (levelData.atk_scale ?? 0);
      const total = dps * dur;
      return mk(0, null, { damageType: 'true', skillDps: dps, skillTotalDamage: total, dmgTypes: { true: { skillDps: dps, skillTotalDamage: total, cycleDps: null } } });
    }
  }
  if (op.id === 'char_4134_cetsyr') {
    if (skillIndex === 0) return mk(ratioHps(), null);                            // S1 往昔萦绕身旁:永久,特性提高至 30%(专一)
    if (skillIndex === 1) {                                                       // S2 明日渺远不及:微尘碰撞真伤
      // 用户口径(2026-09-18):微尘的伤害按「每秒造成一次伤害」计算(不再按 6 枚/8s 一圈的命中节奏拆)
      const dps = panelAtk * (levelData.atk_scale ?? 0);
      const total = dps * dur;
      return mk(panelAtk * baseRatio, null, { damageType: 'true', skillDps: dps, skillTotalDamage: total, dmgTypes: { true: { skillDps: dps, skillTotalDamage: total, cycleDps: null } } });
    }
    if (skillIndex === 2) { const h = ratioHps(); return mk(h, h * dur); }        // S3 编织重构现世:特性提高至 80%(专一) dur30
  }
  if (op.id === 'char_101_sora') {
    if (skillIndex === 0) { const h = ratioHps(); return mk(h, h * dur); }        // S1 睡眠之歌:特性提高至 80%(专一) dur7
    if (skillIndex === 1) return mk(panelAtk * baseRatio, null);                  // S2 战斗之歌:仅鼓舞 → 自身输出不变化
  }
  if (op.id === 'char_4045_heidi') {
    if (skillIndex === 0) return mk(panelAtk * baseRatio, null);                  // S1 虚构故事·怒士:鼓舞 + 阻挡-3,特性不变
    if (skillIndex === 1) { const h = ratioHps(); return mk(h, h * dur); }        // S2 虚构故事·锈城:特性提高至 25%(专一) dur20
  }
  if (op.id === 'char_4184_dolris') {
    // S1 我思念的:鼓舞 + 目标受击补 85 点(用户口径 2026-09-18:目标受伤时的治疗不计算);特性不变(0.1)+ 天赋治疗照常
    if (skillIndex === 0) return mk(panelAtk * baseRatio + panelAtk * talentRate, null);
    if (skillIndex === 1) {                                                       // S2 我悲悯的:特性停止回血,每 interval 秒法伤 + 治疗
      const iv = levelData.interval ?? 0.3;
      const dps = panelAtk * (levelData['attack@atk_scale'] ?? 0) / iv;
      const hps = panelAtk * (levelData['attack@heal_scale'] ?? 0) / iv + panelAtk * talentRate;
      const total = dps * dur;
      return mk(hps, null, { damageType: 'arts', skillDps: dps, skillTotalDamage: total, dmgTypes: { arts: { skillDps: dps, skillTotalDamage: total, cycleDps: null } } });
    }
  }
  return mk(normalHps, null);
}
// ===== 护佑者(blessing,辅助)专用结算 =====
// 特性(7 人一致):「攻击造成法术伤害,技能开启后改为治疗友方单位(治疗量相当于 heal_scale×攻击力,基础 75%)」。
// 与咒愈师的区别:咒愈师是「攻击时同时治疗(治疗量=50%伤害)」,护佑者是「技能开启后攻击改为治疗」→ 技能期无伤害。
// 用户口径(2026-09-18):天赋的生命回复/技力回复效果不计算(淬羽赫默「丰润羽翼」、遥「扶摇花火」);
// 召唤物(淬羽赫默的夜灯)信息在「特殊-干员附带单位」中查询。
// X 模组 traitEnhance 把 heal_scale 提到 1(100%),走 calcTraitScale(op,slot,'heal_scale') 自动生效。
const BLESSING_SPECIAL = {
  'char_343_tknogi': [1],   // 月禾 S2 森廻:停止攻击,每秒恢复友军 攻击力×attack@atk_to_hp_recovery_ratio(专一 12%)
};
// 技能攻击力加成不计入治疗基准的技能(暂无:遥 S2 的攻击力+30% 已按用户口径 2026-09-18「直接按第二次使用永续计算」计入)
const BLESSING_ATK_IGNORE = {};
function calcBlessingSkill(op, slotData, skillIndex, levelData, ctx) {
  const { panelAtk, skillRealInterval, skillDuration, isPermanent, normalDps } = ctx;
  const healScale = calcTraitScale(op, slotData, 'heal_scale') ?? 0.75;
  const dur = skillDuration > 0 ? skillDuration : 0;
  const mk = (sHps, totalHeal, extra) => Object.assign({
    type: 'heal', damageType: 'arts', isToggle: false, isPermanent: !!isPermanent,
    skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps, normalHps: null,
    skillHps: sHps, totalHeal: totalHeal === undefined ? null : totalHeal,
    realInterval: skillRealInterval, panelAtk,
  }, extra || {});
  // 技能期攻击力 = 面板 ×(1+技能 atk 加成);治疗量同吃攻击力加成(skillAtk 含 atk_scale,不用)
  const atkBuff = (BLESSING_ATK_IGNORE[op.id] || []).includes(skillIndex) ? 0 : (levelData.atk || 0);
  const healAtk = panelAtk * (1 + atkBuff);
  // 停止攻击型(月禾 S2):技能期改为每秒按比率恢复友军
  if ((BLESSING_SPECIAL[op.id] || []).includes(skillIndex)) {
    const perSec = healAtk * (levelData['attack@atk_to_hp_recovery_ratio'] || 0);
    return mk(perSec, perSec * dur, { realInterval: 1 });
  }
  // 瞬发治疗型(dur≤−1、立即治疗 heal_scale;撷英调香师 S1 可充能 cnt 次):一次性给量,只记总治疗量(同落地点火惯例)
  // 无限制型(持续时间无限/手动开关,如夏栎 S1)不走此分支 → 按每击治疗常态 HPS。
  if ((skillDuration === -1 || skillDuration === 0) && !isPermanent && levelData.heal_scale !== undefined) {
    const total = healAtk * (levelData.heal_scale ?? 0) * (levelData.cnt ?? 1);
    return mk(0, total);
  }
  // 常规:每次攻击改为治疗一次(治疗量 = 技能期攻击力 × heal_scale)
  const perHit = healAtk * healScale;
  const hits = Math.max(1, Math.floor(dur / skillRealInterval));
  // 遥 S2「幽隙栖萤」:友方受到遥的治疗效果时,对周围 3 名敌人造成相当于治疗量 atk_scale_extra 的法术伤害
  // (治疗目标数+add 个 → 每击触发 add+1 次;单目标口径下每次触发命中同一敌人)
  // 用户口径(2026-09-18):S2 直接按「第二次及以后使用」计算 → 攻击力+30% 生效、持续时间无限(永续型,不记总治疗量/总伤)
  if (op.id === 'char_4202_haruka' && (levelData.atk_scale_extra !== undefined)) {
    const healTargets = 1 + (levelData['attack@max_target_heal_add'] || 0);
    const dmgPerHit = calcArtsDamage(perHit * (levelData.atk_scale_extra ?? 0), state.enemy.res) * healTargets;
    if (isPermanent) {
      return mk(perHit / skillRealInterval, null, {
        skillDps: dmgPerHit / skillRealInterval, skillTotalDamage: 0,
        dmgTypes: { arts: { skillDps: dmgPerHit / skillRealInterval, skillTotalDamage: 0, cycleDps: null } },
      });
    }
    const total = dmgPerHit * hits;
    return mk(perHit / skillRealInterval, perHit * hits, {
      skillDps: total / dur, skillTotalDamage: total,
      dmgTypes: { arts: { skillDps: total / dur, skillTotalDamage: total, cycleDps: null } },
    });
  }
  // 行箸 S2「食不厌精」:额外治疗 1 名目标,且每秒恢复天赋生效目标 攻击力×ratio 的生命
  const extraRegenRatio = levelData['attack@xingzh_s_2[heal].atk_to_hp_recovery_ratio'];
  if (typeof extraRegenRatio === 'number') {
    const hps = perHit / skillRealInterval + healAtk * extraRegenRatio;   // 每击治疗 + 每秒恢复天赋生效目标
    return mk(hps, hps * dur, { realInterval: skillRealInterval });
  }
  // 无限持续型(夏栎 S1):按每击治疗给 HPS,总治疗量不记(同永久型惯例)
  if (isPermanent) return mk(perHit / skillRealInterval, null);
  return mk(perHit / skillRealInterval, perHit * hits);
}
// 凝滞师需专用结算的技能(其余落回引擎通用链尾)
const SLOWER_SPECIAL = {
  'char_326_glacus': [1],    // S2 反制电磁脉冲:冲击波单发 340%(专一)×atk 法伤(对【无人机】加倍不计,用户口径)
  'char_358_lisa': [2],      // S3 狐火渺然:停止攻击,每秒回复范围内友方 攻击力×14%(专一) 生命
  'char_4032_provs': [1],    // S2 致胜立论:开启瞬间全范围 300%(专一) 法伤 + 之后攻击间隔缩短(-1)
  'char_4122_grabds': [1],   // S2 乡音沉沉:先停攻沉睡 5s(专一),剩余时长攻速 +100 并攻击 3 敌(单目标口径)
  'char_258_podego': [0, 1], // S1 花香疗法(普攻转治疗)/ S2 孢子扩散(6s 孢子群每秒 65% 法伤)
};
// 技能期天赋攻速额外档(模组 te 中带 [skill] 前缀的「技能期间攻速加成额外提升」;真理 Y「读书笔记」)
const TALENT_SPD_SKILL_ONLY = {
  'char_195_glassb': { talentIndex: 0, key: 'glassb_e_t_1[skill].attack_speed' },
};
// 模组 te 整体忽略表(该天赋的 te 与自身无关:安洁莉娜 X「加速力场」自身攻击范围内友方额外攻速,自身不在自身攻击范围内)
const MODULE_TE_IGNORE = {
  'char_291_aglina': [0],
};

const SWORD_SPECIAL = {
  'char_010_chen': [2],      // 赤霄·绝影:10 次连斩(纯 times 键,引擎不识别)
  'char_301_cutter': [0],    // 红移:4 把飞刀(times 键)
  'char_4009_irene': [2],    // 判决:300% + 12 次 230%(multi_times/multi_atk_scale)
  'char_4116_blkkgt': [0, 1, 2], // 锏:三技能均按天赋在 2/3 技能生效的口径
  'char_459_tachak': [0]     // 燃烧榴弹:6 秒燃烧区域(每秒 50% 法术)
};

// ===== 武者(musha)专用助手 =====
// 武者共性(用户口径 2026-09-17):坚忍类天赋(按已损失生命给攻击速度/防御力/技力回复)
// 默认视为满血 → 全部不触发;特性「不成为治疗目标,每次攻击到敌人后回复自身 30/50/70 生命」
// 是自回血不是输出,不建模型(常态/技能期列均不含)。
const MUSHA_SPECIAL = {
  'char_1030_noirc2': [0, 1],  // S1 居合拔刀气刃斩(受击反击 4 段) / S2 气刃兜割(瞬发 7 段)
  'char_4121_zuole': [2]       // S3 佑序有炎(7 段斩击 + 末击系数加倍)
};

// ===== 收割者(reaper)专用助手 =====
// 收割者共性:特性「无法被友方角色治疗,攻击造成群体伤害,每攻击到一个敌人回复自身生命」
// 是自回血不是输出,不建模型;海沫「收割,给养」(回复元素损伤)同理;群体伤害按单目标口径。
// 隐德来希「萃血」的每秒法术 DOT 走通用固定 DOT 通道(TALENT_FLAT_DOT)。
const REAPER_SPECIAL = {
  'char_1032_excu2': [0, 1, 2],  // 圣约送葬人:三技能均为弹药型(攻击装有 N 发弹药,打完技能结束)
  'char_4010_etlchi': [1, 2]     // 隐德来希:S2 绯红壁合(停止攻击,血镰每 0.5s 切割) / S3 灵与欲的惜别(心烛)
};

// ===== 解放者(librator)专用助手 =====
// 解放者共性(用户口径 2026-09-17):特性「技能未开启时攻击力逐渐提升至最高+200%」→ 技能期默认按叠满计,
// 即攻击力加成 +200%(面板 ×3);特性「通常不攻击且阻挡数为 0」→ 常态行恒为 0(同阵法术师处理,见链尾修正)。
// 玛恩纳 S3「未照耀的荣光」描述「特性提升至2倍」→ 特性加成翻倍为 +400%(面板 ×5,用户口径 2026-09-17)。
// 「攻击力提升至 X%」型天赋(玛恩纳「游侠」基础档、司霆惊蛰「明断」技能期档)按独立乘区(不并入同一加算池,用户口径 2026-09-17);
// 攻速/间隔改动(龙舌兰/骋风 S1 attack_speed、玛恩纳 S2 base_attack_time、司霆惊蛰 S3 +1.7s)由通用参数区处理。
const LIBRATOR_SPECIAL = {
  'char_1043_leizi2': [0, 1, 2], // 司霆惊蛰:S1 浩气长存(三方向斩击) / S2 正霆摄威(叠层) / S3 天地通明(电流)
  'char_4064_mlynar': [0, 1, 2], // 玛恩纳:S1 未声张的怒火 / S2 未宽解的悲哀(二连击) / S3 未照耀的荣光(特性 ×2、光环真伤)
  'char_445_wscoot': [0, 1],     // 骋风:天赋「藏锋伺敌」追加一次攻击默认生效(特性叠满时)
  'char_486_takila': [0, 1]      // 龙舌兰:S2「剑走偏锋」默认按蓄力档(同时 3 名、持续 30s)
};

// ===== 无畏者(fearless)特例 =====
// 用户口径(2026-09-17):
//  · 芙兰卡「铝热剑」无视防御(概率触发)、断罪者「断罪」概率暴击与「创世纪」概率失败、
//    摩根「沸血先锋」坚忍、止颂「苦痛专注」无视防御与「痛楚砺刃」攻击力增幅、莱欧斯「胆小剑助」精力充沛 → 默认不计算;
//  · 近战单目标场景不视为「目标被自身阻挡」→「攻击被阻挡的敌人」类效果不计算(X 模组 115%、止颂 S3 的 190% 加成);
//  · 耀骑士临光 S3 召唤的「耀阳」那一击为无条件效果,按单目标 1 次计入。
// 其余(摩根 S1/S2 的 attack@atk_scale 走 ATK_SCALE_REWRITE、止颂 S2 的 2 连击走 MULTI_HIT)由通用表处理。
const FEARLESS_SPECIAL = {
  'char_159_peacok': [1],   // 断罪者:S2 创世纪(法术 290%,按成功档结算)
  'char_4142_laios': [1],   // 莱欧斯:S2 威吓战法(停止攻击,技能结束时 1 击 400% 物理)
  'char_1014_nearl2': [2]   // 耀骑士临光:S3 耀阳颔首(本体物理 + 耀阳 1 击真实伤害)
};

// ===== 重剑手(crusher)特例 =====
// 用户口径(2026-09-17):
//  · 铎铃「走山路」的精力充沛(生命>50% 时 +20%/22% 攻击力,X 模组 28%/33%)不计算;
//  · 赫德雷「及锋而试」攻击力增幅仅计算基础加成(110%/120%/130%,晕眩/束缚档 140% 不计);
//  · 乌尔比安「血脉的哺养」的击倒叠攻击力不计算(第一天赋「本性的坚守」为受击自愈,非输出)。
// 其余口径:特性「同时攻击阻挡的所有敌人」按单目标;重剑手各模组特性追加「受到的治疗效果提升20%」非输出不计;
// 赫德雷 Y 模组「笔迹」特性追加「对被阻挡的敌人伤害提升至110%」为条件类(按不视为被阻挡口径不计)。
const CRUSHER_SPECIAL = {
  'char_4083_chimes': [1],    // 铎铃:S2 乡心无改(停止攻击,技能结束时挥刀 1 击,攻击力取叠满 +50% 档)
  'char_4088_hodrer': [1, 2], // 赫德雷:S2 余烬重荷(切换型,被动 +32% 计入常态) / S3 死境硝烟(真实伤害 DOT)
  'char_4145_ulpia': [2]      // 乌尔比安:S3 必须开辟的通路(船锚 1 击 + 技能期本体普攻)
};

// ===== 撼地者(hammer)特例 =====
// 用户口径(2026-09-17):
//  · 奥达「落锤」的攻击力增幅效果默认常驻(累计 30 次伤害后 +15%,X 模组 +20%);
//  · 祐天寺若麦「双利手」的脆弱效果默认不触发(概率类,走说明文本);
//  · 怒潮凛冬 S2「绝不罢休」默认为第二次加成(能力加成翻倍、持续时间无限)。
// 问答确认(2026-09-17):①佩佩 S2 攻速叠层默认满层 2 层(+40×2=+80);
//  ②佩佩「弥漫莲香」(近卫 +16%)与祐天寺若麦「毋畏爱意」(Ave Mujica +8%)本人符合条件 → 自身也吃(已入 TALENT_ATK_DRIVERS)。
// 其余口径:特性「攻击使目标周围的其他敌人受到攻击力 50% 的群体物理伤害」只打其他敌人 → 单目标场景不计;
//  各模组特性追加「溅射范围内有≥3 个敌人时使当次攻击力提升至 115%」为条件类不计;佩佩 RA-α/生息演算 相关效果为特殊模式不计。
//  怒潮凛冬第二天赋「万众巨潮」:技能期间全场干员攻击力+14%(潜2 +18%),本人属【乌萨斯学生自治团】→ 加成翻倍 → 技能期 ×1.28。
const HAMMER_SPECIAL = {
  'char_1051_headb2': [0, 1, 2], // 怒潮凛冬:S1 誓不低头(第二天赋光环) / S2 绝不罢休(第二次加成、持续无限) / S3 无可抵挡(五连击递增)
  'char_4058_pepe': [1, 2],      // 佩佩:S2 阻遏混乱锤(攻速叠层满层) / S3 时光震荡(每击后攻击力额外+20%,最多 4 层)
  'char_4185_amoris': [0, 1]     // 祐天寺若麦:S1 如焰般热烈(三连击 151%/20%/20%) / S2 如麦般生长(八连击 118%×2 + 10%×6)
};

// 锏「天生的武者」:攻击力提升(bb.atk_scale),仅在 2/3 技能(索引 1/2)生效
function swordTalentAtkScale(op, slotData, skillIndex) {
  if (op.id !== 'char_4116_blkkgt' || (skillIndex !== 1 && skillIndex !== 2)) return 1;
  const talent = (op.talents || [])[0];
  if (!talent) return 1;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let best = 1;
  for (const cand of talentCandSource(op, slotData, 0, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const bb = cand.blackboard || {};
      if (typeof bb.atk_scale === 'number' && bb.atk_scale > best) best = bb.atk_scale;
    }
  }
  return best;
}
// 锏「活着的传奇」:无视防御百分比,仅在 2/3 技能生效
function swordTalentDefPen(op, slotData, skillIndex) {
  if (op.id !== 'char_4116_blkkgt' || (skillIndex !== 1 && skillIndex !== 2)) return 0;
  const talent = (op.talents || [])[1];
  if (!talent) return 0;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, 1, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const bb = cand.blackboard || {};
      if (typeof bb.def_penetrate === 'number' && bb.def_penetrate > best) best = bb.def_penetrate;
    }
  }
  return best;   // bb 中 def_penetrate 已是小数(0.25 = 25%)
}
// 虎狼丸「黑色狼牙」:部署后 5 次 atk_scale 法术斩击 + 最后 1 次 final_atk_scale 法术斩击
function kormrBurst(op, slotData) {
  const talent = (op.talents || [])[0];
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let scale = 1, finalScale = 2;
  for (const cand of talentCandSource(op, slotData, 0, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const bb = cand.blackboard || {};
      if (typeof bb.atk_scale === 'number') scale = bb.atk_scale;
      if (typeof bb.final_atk_scale === 'number') finalScale = bb.final_atk_scale;
    }
  }
  return { scale, finalScale };
}

// ===== 落地点火 / 开局定时触发天赋(一次性爆发) =====
// 用户口径(2026-09-17):这类天赋按"落地点火技能"处理——即使没有技能选择,也依旧显示技能期数值;
// 常态化列改回该干员自身的普攻/普攻治疗(不再把天赋摊销进常态,也不与技能期重复计算)。
// 伤害型走技能期 DPS/总伤,技能期时长 = 次数 × 攻击间隔(与既有落地生效技能同款)。
// 治疗型为瞬发一次性给量,不存在"技能期 HPS"概念,只给总治疗量(damageType: 'heal' 区分)。
// 处理范围仅限 ★1/★2 干员(低星常无技能,落地天赋是其输出主体);有技能的正常干员落地类天赋一般不处理。
const DEPLOY_BURST_TALENTS = {
  // THRM-EX「延迟引爆·I」:部署 3s 后对周围 8 格所有敌人造成 攻击力×damage_by_atk_scale 的物理伤害
  // (8s 脆弱为敌方减益,不产生自身输出 → 不计);自身随即退场。单目标 1 次。
  'char_376_therex': (op, slotData, panelAtk) => {
    const talent = (op.talents || [])[0];
    const pot = slotData.potentialRank || 0;
    let scale = 0;
    for (const cand of talentCandSource(op, slotData, 0, talent.candidates)) {
      const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
      if (cand.phase <= slotData.elite && candPot <= pot) {
        const bb = cand.blackboard || {};
        if (typeof bb.damage_by_atk_scale === 'number' && bb.damage_by_atk_scale > scale) scale = bb.damage_by_atk_scale;
      }
    }
    return { total: calcPhysicalDamage(panelAtk * scale, Math.max(0, state.enemy.def)), hits: 1, damageType: 'physical' };
  },
  // 虎狼丸「黑色猎犬」:部署后 5 次 atk_scale 法术斩击 + 末次 final_atk_scale 法术斩击(单目标)
  'char_4220_kormr': (op, slotData, panelAtk) => {
    const b = kormrBurst(op, slotData);
    const hits = 6;
    const total = calcArtsDamage(panelAtk * b.scale, state.enemy.res) * (hits - 1)
      + calcArtsDamage(panelAtk * b.finalScale, state.enemy.res);
    return { total, hits, damageType: 'arts' };
  },
  // Lancet-2「救援喷雾」:部署后立即恢复全场友方单位 N 点生命(固定值,不随攻击力;1★ 无技能槽)
  'char_285_medic2': (op, slotData) => {
    const talent = (op.talents || [])[0];
    const elite = slotData.elite;
    const pot = slotData.potentialRank || 0;
    let value = 0;
    for (const cand of talentCandSource(op, slotData, 0, talent.candidates)) {
      const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
      if (cand.phase <= elite && candPot <= pot) {
        const bb = cand.blackboard || {};
        if (typeof bb.value === 'number' && bb.value > value) value = bb.value;
      }
    }
    return { total: value, hits: 1, damageType: 'heal' };
  },
};
// ===== 特种·处决者(executor)辅助 =====
// 天赋静态 blackboard(优先模组同名 te 覆盖档;否则按精英化/潜能取最高档的最后一条候选)。
function execTalentBB(op, slotData, talentIndex) {
  const enh = getTalentEnhBB(op, slotData, talentIndex);
  if (enh) return enh;
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return null;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let best = null;
  for (const c of talent.candidates || []) {
    if (c.phase <= elite && (c.potentialRank ?? c.requiredPotentialRank ?? 0) <= pot) best = c.blackboard || {};
  }
  return best;
}

// 麒麟R夜刀「双雷剑麒麟」:每次攻击额外造成 攻击力×attack@atk_scale_1 的法术伤害(每击触发);
// Y 模组追加「术法充盈」(按造成法术伤害次数叠层,属攻击次数型 → 按叠满 ×(1+damage_up×max_stack_cnt))。
// scaleMul = 技能对该第一天赋的额外倍率(S2 用 blackboard.talent_scale;S3 用 atk_scale)。
function yato2TalentMagicDmg(op, slotData, atk, effRes, scaleMul, hits) {
  const bb = execTalentBB(op, slotData, 0) || {};
  const scale = typeof bb['attack@atk_scale_1'] === 'number' ? bb['attack@atk_scale_1'] : 0;
  if (scale <= 0) return 0;
  let mul = 1;
  const up = bb.damage_up, cap = bb.max_stack_cnt;
  if (typeof up === 'number' && typeof cap === 'number') {
    // 「术法充盈」按造成法术伤害次数叠层:先结算攻击增幅、再结算伤害 → 第 k 击(第 k 次法术伤害)吃到 k 层。
    // 用户口径(2026-09-18 修正):落地技能窗口第 1 击即已有 1 层,逐击叠层取平均收益(非叠满);hits = 窗口内法术伤害次数
    // (Infinity/缺省 = 常态化稳态,叠满)。
    if (hits > 0 && hits !== Infinity) {
      let s = 0;
      for (let j = 1; j <= hits; j++) s += Math.min(j, cap);
      mul = 1 + up * (s / hits);
    } else {
      mul = 1 + up * cap;
    }
  }
  return calcArtsDamage(atk * scale * mul * (scaleMul || 1), effRes);
}

// 处决者常态普攻的附加段(仅麒麟R夜刀:每次攻击附第一天赋法术伤害),并入常态化列
// 处决者(executor)Y 模组特性「周围四格没有友方干员时攻击力+X%」:数据驱动读取模组等级 traitEnhance
// 的无名条目 blackboard.atk(与 talentEnhance 天赋增强分属不同字段,天然不重复计天赋)。
// 用户口径(2026-09-18):按「单打独斗、周围无友军默认成立」计入,与天赋 atk 同区累加。
function executorTraitAtkMul(op, slotData) {
  if (op.subProfessionId !== 'executor') return 0;
  const lv = getModuleLevelData(op, slotData);
  if (!lv || !Array.isArray(lv.traitEnhance)) return 0;
  const pot = slotData.potentialRank || 0;
  let best = 0;
  for (const c of lv.traitEnhance) {
    if (!c) continue;
    const cPot = c.requiredPotentialRank ?? c.potentialRank ?? 0;
    if (cPot > pot) continue;
    const v = (c.blackboard || {}).atk;
    if (typeof v === 'number' && v > best) best = v;
  }
  return best;
}

function executorNormalExtraDps(op, slotData, panelAtk, effRes, realInterval) {
  if (op.subProfessionId !== 'executor') return 0;
  const iv = realInterval > 0 ? realInterval : 1;
  if (op.id === 'char_1029_yato2') return yato2TalentMagicDmg(op, slotData, panelAtk, effRes) / iv;
  return 0;
}

function calcDeployBurstSkill(op, slotData, panelAtk, realInterval) {
  const handler = DEPLOY_BURST_TALENTS[op.id];
  if (!handler) return null;
  const r = handler(op, slotData, panelAtk);
  const duration = realInterval > 0 ? (r.hits || 1) * realInterval : 0;
  return { total: r.total, dps: duration > 0 ? r.total / duration : 0, duration, damageType: r.damageType };
}

function calcTalentAtkBonus(op, slotData) {
  const cfg = TALENT_ATK_DRIVERS[op.id];
  if (cfg === undefined) return 0;
  // 携带技能条件天赋(夜魔「表里人格」:装备 2 技能时攻击+X%,装 1 技能为闪避向不计):cfg = {talentIndex, skillIndex}
  if (typeof cfg === 'object' && cfg.skillIndex !== undefined && (slotData.skillIndex ?? -1) !== cfg.skillIndex) return 0;
  const talentIndex = typeof cfg === 'number' ? cfg : cfg.talentIndex;
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 0;
  // 「自身额外」型增强(驱动表 TE_EXTRA_ADD):同名 te 仅为额外加数,叠加基础最佳档(星熊/推进之王等)
  if ((TE_EXTRA_ADD[op.id] || []).includes('atk')) {
    const r = calcTeExtraAdd(op, slotData, talentIndex, 'atk');
    if (r !== null) return r;
  }
  // 正常路径走 talentCandSource(覆盖层增强感知)
  return calcTalentAtkBonusEnhanced(op, slotData, talent, talentIndex);
}


// ===== 驭械术师(funnel):本体普攻 + 浮游单元(叠层) =====
// 单元伤害 = 干员攻击力 × scale;scale 首击 init_atk_scale,每次命中同一目标 +delta_atk_scale,上限 max_atk_scale。
// 单目标模型:已存在的单元默认满层(max);技能期新增单元从 0(init)起叠,按其技能期攻击次数取平均。
// levelData['attack@cnt'] = 技能期新增单元数;FUNNEL_PASSIVE_UNITS = 装备即常驻的新增(技能被动,如荒芜 S1 +1);
// FUNNEL_STOP_BODY = 技能期本体停止攻击、仅单元输出(澄闪 S3「澄净闪耀」:停止攻击,浮游单元+2)。
// 干员级特例配置:
//   talentUnits  常驻天赋带来的浮游单元数量(荒芜「头狼」为时间序列天赋,口径=默认全部获得)
//   talentCap    常驻天赋对「单元伤害上限」的乘数(读该天赋 blackboard[key])
//   skillCap     技能对「单元伤害上限」的乘数(读 levelData['scale'])
//   passiveUnits 技能被动新增单元(装备即常驻,含常态)
//   stopBody     技能期本体停止攻击、仅单元输出
//   normalHalf   常态减半(洛洛 S2 携带时技能后过载 20s/40s,该段无输出)
//   selfDestruct 技能期每击额外伤害(澄闪「信标的愤怒」:每击 概率×自爆倍率×攻击力)
const FUNNEL_OPS = {
  'char_1038_whitw2': { talentUnits: 1, talentCap: { talentIndex: 0, key: 'scale' }, passiveUnits: { 0: 1 } },
  'char_377_gdglow': { selfDestruct: { talentIndex: 0, prob: 0.1, key: 'attack@atk_scale_2' }, stopBody: [2] },
  'char_4040_rockr': { skillCap: { 1: true }, normalHalf: [1], phases: { 1: { dur1: 20, dur2: 20, ph1SkillSpd: true } } },
  // 分段技能(两段计量槽,后段=过载):
  //   时隙「科技与传统仪式」:40s;锁定敌人离开自身攻击范围时立刻过载并把剩余时长改写为 20s
  //     前 20s 未过载(本体+既有单元+新增单元按前半段叠层,不吃技能攻击力/攻速),后 20s 过载(本体停攻,单元叠满并吃 +40%/+55)
  //   洛洛「自负此轭」:40s,技能进行到一半触发过载
  //     前 20s 只有攻速(+65 全段生效),后 20s 过载(特性上限 ×1.8、攻击力+50%,本体照打)
  'char_4236_tmslot': { phases: { 1: { dur1: 20, dur2: 20, stopBody2: true } } },
};
// 读天赋指定 blackboard 键在当前精英/等级/潜能下的最大可用值(含模组 te 覆盖层)
function funnelTalentValue(op, slotData, talentIndex, key) {
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 0;
  const elite = slotData.elite, level = slotData.level, pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, talentIndex, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && level >= (cand.level || 1) && candPot <= pot) {
      const v = cand.blackboard && typeof cand.blackboard[key] === 'number' ? cand.blackboard[key] : 0;
      if (v > best) best = v;
    }
  }
  return best;
}
function calcFunnelTraitCfg(op, slotData) {
  const bb = Object.assign({}, (op.trait && op.trait.blackboard) || {});
  const lv = getModuleLevelData(op, slotData);
  if (lv && Array.isArray(lv.traitEnhance) && lv.traitEnhance[0] && lv.traitEnhance[0].blackboard) Object.assign(bb, lv.traitEnhance[0].blackboard);
  return { init: bb.init_atk_scale ?? 0.2, delta: bb.delta_atk_scale ?? 0.15, max: bb.max_atk_scale ?? 1.1 };
}
function funnelAvgNewScale(cfg, skillDuration, interval) {
  if (!(skillDuration > 0) || !(interval > 0)) return cfg.max;   // 永续/切换技能:长线叠满
  const n = Math.max(1, Math.floor(skillDuration / interval));
  let sum = 0;
  for (let k = 0; k < n; k++) sum += Math.min(cfg.init + k * cfg.delta, cfg.max);
  return sum / n;
}
function calcFunnelMuls(op, slotData, skillIndex, levelData, skillDuration, skillInterval, ctx) {
  const cfg = FUNNEL_OPS[op.id] || {};
  const t = calcFunnelTraitCfg(op, slotData);
  const hasSkill = typeof skillIndex === 'number' && skillIndex >= 0;
  let tCap = 1;
  if (cfg.talentCap) { const v = funnelTalentValue(op, slotData, cfg.talentCap.talentIndex, cfg.talentCap.key); if (v > 0) tCap = v; }
  const capNormal = t.max * tCap;                                      // 常态单元满层 scale
  const units0 = 1 + (cfg.talentUnits || 0) + (((cfg.passiveUnits || {})[skillIndex]) || 0);
  let normalMul = 1 + units0 * capNormal;                              // 本体 100% + 各单元满层
  if (hasSkill && (cfg.normalHalf || []).includes(skillIndex)) normalMul *= 0.5;
  if (!hasSkill) return { normalMul, skillMul: normalMul };
  let sCap = capNormal;
  if (cfg.skillCap && cfg.skillCap[skillIndex] && typeof levelData['scale'] === 'number') sCap = capNormal * levelData['scale'];
  const added = typeof levelData['attack@cnt'] === 'number' ? levelData['attack@cnt'] : 0;
  const avgNew = added > 0 ? funnelAvgNewScale({ init: t.init, delta: t.delta, max: sCap }, skillDuration, skillInterval) : 0;
  // 分段技能(时隙 S2):当量为「前半段 + 过载段」按各自击数加权后折算回技能期单次攻击
  const ph = (cfg.phases || {})[skillIndex];
  if (ph && ctx && ctx.panelAtk > 0 && ctx.skillAtk > 0) {
    const I1 = ph.ph1SkillSpd ? skillInterval : (ctx.baseInterval > 0 ? ctx.baseInterval : skillInterval);
    const n1 = Math.max(1, Math.floor(ph.dur1 / I1));
    const n2 = Math.max(1, Math.floor(ph.dur2 / skillInterval));
    const x1 = 1 + units0 * capNormal + added * funnelAvgNewScale({ init: t.init, delta: t.delta, max: capNormal }, ph.dur1, I1);
    const x2 = (ph.stopBody2 ? 0 : 1) + (units0 + added) * sCap;
    const denom = Math.max(1, Math.floor((ph.dur1 + ph.dur2) / skillInterval));
    return { normalMul, skillMul: (x1 * n1 * (ctx.panelAtk / ctx.skillAtk) + x2 * n2) / denom };
  }
  const stop = ((cfg.stopBody || []).includes(skillIndex)) ? 0 : 1;
  let skillMul = stop + units0 * sCap + added * avgNew;
  // 技能期每击额外伤害(澄闪自爆简化:每击 概率×自爆倍率×攻击力)
  if (cfg.selfDestruct) {
    const v = funnelTalentValue(op, slotData, cfg.selfDestruct.talentIndex, cfg.selfDestruct.key);
    if (v > 0) skillMul += cfg.selfDestruct.prob * v;
  }
  // 浮游单元光环(荒芜 S3):每个单元每 attack@times 秒造成 attack@magic_atk_scale×攻击力 法伤
  const auraScale = levelData['attack@magic_atk_scale'];
  if (typeof auraScale === 'number' && auraScale > 0) {
    const times = typeof levelData['attack@times'] === 'number' && levelData['attack@times'] > 0 ? levelData['attack@times'] : 1;
    skillMul += (units0 + added) * auraScale * (skillInterval / times);
  }
  return { normalMul, skillMul };
}
function calcTalentAtkBonusEnhanced(op, slotData, talent, talentIndex) {
  const elite = slotData.elite;
  const level = slotData.level;
  const pot = slotData.potentialRank || 0;
  let bonus = null;
  const noStack = (typeof TALENT_ATK_DRIVERS[op.id] === 'object' && TALENT_ATK_DRIVERS[op.id] !== null && TALENT_ATK_DRIVERS[op.id].noStack === true);
  // 倍率键(如新约能天使「铳弹协约」对【拉特兰】效果翻倍 blackboard.mult=2)
  const mulKey = (typeof TALENT_ATK_DRIVERS[op.id] === 'object' && TALENT_ATK_DRIVERS[op.id] !== null) ? TALENT_ATK_DRIVERS[op.id].mulKey : undefined;
  for (const cand of talentCandSource(op, slotData, talentIndex, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && level >= (cand.level || 1) && candPot <= pot) {
      let atk = 0;
      if (cand.blackboard) {
        const commonKey = Object.keys(cand.blackboard).find(k => k.endsWith('[common].atk'));
        if (commonKey !== undefined) atk = cand.blackboard[commonKey];
        else if (typeof cand.blackboard.atk === 'number') atk = cand.blackboard.atk;
        if (typeof cand.blackboard.max_stack_cnt === 'number' && !noStack) atk = atk * cand.blackboard.max_stack_cnt;
        if (mulKey && typeof cand.blackboard[mulKey] === 'number') atk = atk * cand.blackboard[mulKey];
      }
      if (bonus === null || atk > bonus) bonus = atk;
    }
  }
  return bonus === null ? 0 : bonus;
}
// 常驻生命/防御百分比天赋驱动(bb.max_hp / bb.def = 自身面板百分比乘区),仅收"必然生效于自身"类:
// 范围友方光环(蜜莓/纯烬/夜莺白恶魔等,自身不在自身攻击范围内)与条件性/限时(桑葚双医疗、嘉维尔限时15s)不入表。
// 叠层天赋按满层处理(塞雷娅「莱茵充能护服」单层 × max_stack_cnt)。
const TALENT_HP_DEF_DRIVERS = {
  'char_1052_kalts2': 0, // 凯尔希·思衡托「遗尘守望」:生命与防御 +5%~30%(随精化/潜3 增强,阻挡等忽略)
  'char_010_chen': 1,    // 陈「持刀格斗术」精二:防御 +5%~6%(攻击部分在 TALENT_ATK_DRIVERS)
  'char_103_angel': 1,    // 能天使「天使的祝福」精二:自身生命 +10%~13%(攻击部分在 TALENT_ATK_DRIVERS)
  'char_449_glider': 0,  // 蜜莓「集体意识」:攻击范围内远程干员最大生命+5%/7%(精1)→+10%/12%(精2 潜4),自身为远程医疗必在范围(单目标模型默认奶自己)
  'char_1016_agoat2': 1, // 纯烬艾雅法拉「火山灰疗愈」:攻击范围内友方生命上限+6%(E2)/+8%(E2 潜4),自身必在范围(同前);同天赋普攻层叠增益治疗(heal_scale)不入面板
  'char_2014_nian': 0,   // 年「积甲成山」:编队时全体重装生命上限+8%~20%(自身为重装必得,编队光环先例同赫默/蜜莓)
  'char_4143_sensi': 0,  // 森西「十年魔物餐经验」:防御+10%(治疗部分在 TALENT_HEAL_DRIVERS)
  'char_226_hmau': 0,    // 吽「门神」:防御+6~8% 无条件常驻(身后高台治疗+75% 为条件部分不计,单目标默认自身非高台)
  'char_202_demkni': 0,  // 塞雷娅「莱茵充能护服」:防御叠层按满层 ×5(单层 def+4~5% → +20~25%),攻击部分在 TALENT_ATK_DRIVERS
  'char_260_durnar': 0,  // 坚雷「攻守兼备」:防御力+7%(攻击部分在 TALENT_ATK_DRIVERS)
  'char_136_hsguma': 1,  // 星熊「特种作战策略」(天赋2,精二解锁):全场重装防御+6~8%,自身为重装必得(编队光环先例);天赋1 战术装甲伤害抵挡不建模
  // ---- 先锋(PIONEER) ----
  'char_149_scave': 0,   // 清道夫「单独行动者」:防御+5~13%(周围四格无友军默认成立,攻击部分在 TALENT_ATK_DRIVERS)
  'char_112_siege': 0,   // 推进之王「万兽之王」:防御+4~10%(先锋光环覆盖自身,攻击部分在 TALENT_ATK_DRIVERS)
  'char_1001_amiya2': 0, // 阿米娅(近卫)「青色怒火」:防御+4~7%(同天赋攻击,技能期加倍部分同 atk 口径只计攻击侧)
  'char_1037_amiya3': 0,  // 阿米娅(医疗)「诚挚期许」:自身生命上限+5%(精1)/+8%(精2)无条件(X 模组同名覆盖 9%/10%);自回(1.5%~3.5%maxHp/s)为生存展示与咒愈治疗 normalHps 通道冲突,不建模
  'char_150_snakek': 0,  // 蛇屠箱「防御专精」:防御力+6%(精1)→+12%(精2) 无条件常驻(此前漏入引擎)
};

// 光环拆分特例表:模组把光环类天赋拆为 name=null(全场新值,自身在受益职业内也吃)与同名(自身额外)两部分,
// 数值相加而非覆盖(星熊 X 护身符 L2:全场重装 9%+自身额外 4% → 自身 13%;L3:11%+6% → 17%,潜5 13%+6% → 19%)
// 「自身额外」型模组增强驱动表:此类模组天赋增强(te 同名条目)仅含"自身额外"加数而非整体替换——
// 基础天赋为全场光环(自身必得),模组文本「基础值不变,自身额外+X%」;若同档另含 name=null 条目,
// null 条目为光环新值(覆盖基础光环,星熊X)。统一公式:族值 = max(基础最佳档, null光环值) + 同名额外值。
// key: 干员id;value: 族键(取候选 blackboard 键名:'atk'/'def'/'max_hp'/'attack_speed'/'heal_scale')
const TE_EXTRA_ADD = {
  'char_136_hsguma': ['def'],     // 星熊X「护身符」特种作战策略:null 光环 0.09/0.11/0.13 + 同名自身额外 0.04/0.06
  'char_112_siege': ['atk', 'def'], // 推进之王X「万兽之王」:无 null,基础全场 0.08/0.10 保持 + 同名自身额外 0.06/0.08
  // 'char_291_aglina': ['attackSpeed'], // 安洁莉娜X「实验用反重力模块」加速力场:基础全场 7 + 同名自身额外 3/5(slower 线实现时启用)
};

// 查「自身额外」型增强的指定族键最终值:返回 max(原始基础最佳档, null光环条目同族值) + 同名条目同族值;
// 该档无同名条目(无自身额外)返回 null(调用方走普通覆盖层路径)。
function calcTeExtraAdd(op, slotData, talentIndex, bbKey) {
  const talent = (op.talents || [])[talentIndex];
  const lv = getModuleLevelData(op, slotData);
  if (!talent || !lv || !Array.isArray(lv.talentEnhance) || lv.talentEnhance.length === 0) return null;
  const tNames = new Set((talent.candidates || []).map(c => c && c.name).filter(Boolean));  // 全候选名(防精化改名漏接)
  const pot = slotData.potentialRank || 0;
  let sameV = null, nullV = null;
  for (const c of lv.talentEnhance) {
    if (!c) continue;
    const cPot = c.requiredPotentialRank ?? c.potentialRank ?? 0;
    if (cPot > pot) continue;
    const v = (c.blackboard || {})[bbKey];
    if (typeof v !== 'number') continue;
    if (c.name && tNames.has(c.name)) sameV = Math.max(sameV ?? -Infinity, v);
    else if (!c.name) nullV = Math.max(nullV ?? -Infinity, v);
  }
  if (sameV === null) return null;  // 无自身额外条目 → 不属本类
  // 基础最佳档(原始候选,不含 te)
  let base = 0;
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase > slotData.elite || slotData.level < (cand.level || 1) || candPot > pot) continue;
    const v = (cand.blackboard || {})[bbKey];
    if (typeof v === 'number') base = Math.max(base, v);
  }
  return Math.max(base, nullV ?? 0) + sameV;
}

// 查 HP/DEF 常驻百分比天赋,返回 { hpMul, defMul }(未解锁/无键为 0)
function calcTalentHpDefMul(op, slotData) {
  const talentIndex = TALENT_HP_DEF_DRIVERS[op.id];
  const out = { hpMul: 0, defMul: 0 };
  if (talentIndex === undefined) return out;
  // 「自身额外」型增强(驱动表 TE_EXTRA_ADD):同名 te 仅为自身额外加数,叠加基础最佳档(星熊X/推进之王X)
  const teExtraKeys = TE_EXTRA_ADD[op.id];
  if (teExtraKeys) {
    const rDef = teExtraKeys.includes('def') ? calcTeExtraAdd(op, slotData, talentIndex, 'def') : null;
    const rHp = teExtraKeys.includes('max_hp') ? calcTeExtraAdd(op, slotData, talentIndex, 'max_hp') : null;
    if (rDef !== null || rHp !== null) {
      if (rDef !== null) out.defMul = rDef;
      if (rHp !== null) out.hpMul = rHp;
      return out;
    }
  }
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return out;
  const elite = slotData.elite;
  const level = slotData.level;
  const pot = slotData.potentialRank || 0;
  for (const cand of talentCandSource(op, slotData, talentIndex, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase > elite || level < (cand.level || 1) || candPot > pot) continue;
    const bb = cand.blackboard || {};
    const stack = typeof bb.max_stack_cnt === 'number' ? bb.max_stack_cnt : 1;   // 叠层天赋按满层(塞雷娅)
    if (typeof bb.max_hp === 'number') out.hpMul = Math.max(out.hpMul, bb.max_hp * stack);
    if (typeof bb.def === 'number') out.defMul = Math.max(out.defMul, bb.def * stack);
  }
  return out;
}

// 范围友方光环(防御/法抗绝对值)作用于自身:单目标模型默认奶自己,自身必在自身攻击范围内。
// 闪灵「黑恶魔的庇护」(范围内友方防御+X)与夜莺「白恶魔的庇护」(范围内友方法抗+X)自加成;
// 模组天赋强化(闪灵 Y 干枯剑鞘 def 80/85/100/105、夜莺 X 002 法抗+heal_scale)覆盖天赋基准值。
const SELF_AURA_DRIVERS = {
  'char_147_shining': 0, // 闪灵:def 光环 +20/25(精0) +40/45(精1) +60/65(精2 pot0/pot5)
  'char_179_cgbird': 0   // 夜莺:magic_resistance 光环 +5/7(精0) +10/12(精1) +15/17(精2 pot0/pot4)
};

// 查范围光环绝对值加成(天赋基准 + 模组强化覆盖),返回 { defFlat, resFlat }
function calcSelfAuraFlat(op, slotData) {
  const out = { defFlat: 0, resFlat: 0 };
  const ti = SELF_AURA_DRIVERS[op.id];
  if (ti === undefined) return out;
  const elite = slotData.elite;
  const level = slotData.level || 0;
  const pot = slotData.potentialRank || 0;
  const take = (bb) => {
    if (bb && typeof bb.def === 'number') out.defFlat = Math.max(out.defFlat, bb.def);
    if (bb && typeof bb.magic_resistance === 'number') out.resFlat = Math.max(out.resFlat, bb.magic_resistance);
  };
  const talent = (op.talents || [])[ti];
  if (talent) {
    for (const cand of talent.candidates || []) {
      const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
      if (cand.phase > elite || level < (cand.level || 1) || candPot > pot) continue;
      take(cand.blackboard || {});
    }
  }
  // 模组天赋强化覆盖(值更大者胜;夜莺 X L2/L3 法抗同基准值、heal_scale 走 calcModuleTalentEnhance)
  const lv = getModuleLevelData(op, slotData);
  if (lv && lv.talentEnhance) {
    for (const cand of lv.talentEnhance) {
      const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
      if (candPot > pot) continue;
      take(cand.blackboard || {});
    }
  }
  return out;
}

// 自身固定值属性天赋(无条件常驻,直接加面板):拜松「交叉掩护」def+25/50(X模组60/80/100)、
// 角峰「雪原卫士」法抗+7/15(Y 18/20)、石棉「湿润皮肤」法抗+5/10(X 12;受击回技力不计)、
// 车尔尼「回声」法抗+5/10(X 维持10;受击反伤不建模)。
// 与范围光环(SELF_AURA_DRIVERS)同构:基础候选与模组 te 取满足档最大值(天然防模组削弱)。
const TALENT_FLAT_ATTR_DRIVERS = {
  'char_325_bison': 0,    // 拜松 交叉掩护:自身防御+X(身后先锋/近卫同享不影响自身口径)
  'char_199_yak': 0,      // 角峰 雪原卫士:法术抗性+X
  'char_378_asbest': 0,   // 石棉 湿润皮肤:法术抗性+X(受法伤回技力 sp 不计)
  'char_4047_pianst': 0,  // 车尔尼 回声:法术抗性+X(受击反伤 atk_scale 不建模,同泡泡反伤口径)
  'char_4109_baslin': { talentIndex: 0, resSelf: 'baslin_t[self].magic_resistance', resCond: 'baslin_t[ally].magic_resistance' },
  // 深律 威权教诲:前缀键自身法抗+X(无条件,精2 12)+周围8格有友方时额外+Y(Y 模组后 14+5,条件默认成立同满层先例);null te 为友方侧增益不计自身
};

// 查自身固定值属性天赋,返回 { defFlat, resFlat }(0 表示无此天赋或未解锁)
function calcTalentFlatAttr(op, slotData) {
  const out = { defFlat: 0, resFlat: 0 };
  const cfg = TALENT_FLAT_ATTR_DRIVERS[op.id];
  if (cfg === undefined) return out;
  const ti = typeof cfg === 'number' ? cfg : cfg.talentIndex;
  const elite = slotData.elite;
  const level = slotData.level || 0;
  const pot = slotData.potentialRank || 0;
  // 前缀键配置(深律):每档自身值=无条件 self 键 + 条件 cond 键(默认成立),te 同名整体参与竞争
  const prefixMode = typeof cfg === 'object';
  const candScore = (bb) => {
    bb = bb || {};
    if (prefixMode) {
      const selfV = typeof bb[cfg.resSelf] === 'number' ? bb[cfg.resSelf] : 0;
      const condV = typeof bb[cfg.resCond] === 'number' ? bb[cfg.resCond] : 0;
      return { resFlat: selfV + condV };
    }
    return { defFlat: typeof bb.def === 'number' ? bb.def : 0, resFlat: typeof bb.magic_resistance === 'number' ? bb.magic_resistance : 0 };
  };
  const take = (bb) => {
    const sc = candScore(bb);
    out.defFlat = Math.max(out.defFlat, sc.defFlat || 0);
    out.resFlat = Math.max(out.resFlat, sc.resFlat || 0);
  };
  const talent = (op.talents || [])[ti];
  if (talent) {
    for (const cand of talent.candidates || []) {
      const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
      if (cand.phase > elite || level < (cand.level || 1) || candPot > pot) continue;
      take(cand.blackboard || {});
    }
  }
  const lv = getModuleLevelData(op, slotData);
  if (lv && lv.talentEnhance) {
    for (const cand of lv.talentEnhance) {
      const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
      if (candPot > pot || cand.name === null || cand.name === undefined) continue;
      take(cand.blackboard || {});
    }
  }
  return out;
}

const MODULE_ATTR_MAP = { max_hp: 'maxHp', atk: 'atk', def: 'def', magic_resistance: 'magicResistance', attack_speed: 'attackSpeed' };

// 视作永续开关的技能:数据 skillDuration=-1 是弹药/结束机制占位,按指定口径不建模该机制。
// 流明「灯火不灭」:默认治疗单位无异常状态 → 耗弹强化(heal_scale×2)不计算,只留 atk+攻速 buff,技能无限持续(可手动关闭)。
const PERMANENT_OVERRIDES = {
  'char_4042_lumen': [2],   // 流明 S3 灯火不灭：skillDuration=-1 弹药占位，实际永续
  'char_4230_mcnist': [1],  // 机械师 S2 协防术式：弹药仅屏障被摧毁时消耗（爆盾机制无受击模型）→ 永续
};
// 数据标记 isPermanent 但改按「有界技能期 + 一次性总伤」展示的技能:
// 琳琅诗怀雅 S3 千金一掷(用户口径 2026-09-18):技能期=二连击,关闭时金币弹爆发按一次性总伤展示
const PERMANENT_EXCLUDE = {
  'char_1033_swire2': [2],
};

// 单次攻击多重治疗的技能(连发全打同一目标/单目标模型):纯烬艾雅法拉「火山回响」治疗变 5 连发(每发 attack@heal_scale),全部计入。
const SKILL_HEAL_CHAIN = {
  'char_1016_agoat2': { 2: 5 }   // 纯烬·艾雅法拉 S3 火山回响:每次攻击 5 连发
};

// 咒愈师普攻替换为每秒持续伤害的技能(濯尘芙蓉S2「抚业之触」):技能期无普攻,
// 改为对范围内敌人每秒造成 atk_scale×面板 法伤(每秒一跳=一次攻击 → 特性治疗每跳触发)。
const INCANTATION_DOT_OVERRIDES = {
  'char_1024_hbisc2': [1],
};

// 咒愈师特殊技能模式(键=干员id,值=技能索引→模式):
// - orbital     焰影苇草S2「枯荣共息」:给地面干员(默认自身)挂三颗火球,每 cooldown 秒 3 发 atk_scale 法伤,
//               仅对该干员触发特性治疗(单目标模型=默认治疗目标);技能期无苇草自身普攻。
// - burning     焰影苇草S3「生命火种」:攻击力增幅键带前缀(见 SKILL_ATK_KEY_OVERRIDES);一天赋灼痕 100% 必触发
//               (法脆增伤 ×damage_scale);附带灼痕敌人每秒受 talent@s3_atk_scale 法伤(灼痕DOT,不触发治疗);
//               敌人被击倒爆炸(aoe_scale)默认不计算(无死亡)。
// - zerohit-true 阿米娅S2「慈悲愿景」:开启一击强制 0 命中 → 0 叠层无伤;后续普攻转真实伤害(面板攻击力)。
// - standby     缇缇S2「封护」:停止攻击(天赋1伤害×talent_scale 不建模型)→ 技能期无输出无治疗。
// - slumber     缇缇S3「旧日绽放」:每 4 击一个睡眠周期(1.6s 间隔,睡眠 5s),第 4x+1 击打睡(普攻伤害照算),
//               每次打睡 → 睡满 5s 醒来结算一次 max_atk_scale 法伤(醒伤次数=打睡次数);普攻伤害=攻击力全额(min=1.0 档)。
const INCANTATION_SPECIAL_MODES = {
  'char_1037_amiya3': { 1: 'zerohit-true' },
  'char_1020_reed2': { 1: 'orbital', 2: 'burning' },
  'char_4056_titi': { 1: 'standby', 2: 'slumber' },
};

// 技能攻击力增幅键别名:数据把增幅放在带 switch_mode 前缀的键里(焰影苇草S3 reed2_skil_3[switch_mode].atk、
// 年S3 nian_s_3[self].atk),语义与顶层 atk 相同(直接乘算累加);顶层 atk 缺省时查此别名。
// 技能攻击速度键覆盖(数据为瞬时/非线性值时取等效口径):忍冬 S3「隐狐之艺」攻击速度从 +180 线性衰减至 +0
// → 全程等效平均 +90(用户口径);引擎只支持固定攻速值。
const SKILL_ATTACK_SPEED_OVERRIDES = {
  'char_4164_tecno': { 0: 0, 1: 0 },  // 特克诺 S2 恣意挥洒:attack_speed 为召唤物攻速(自身不吃)
  'char_4026_vulpis': { 2: 90 },   // 忍冬 S3:平均 +90
  'char_180_amgoat': { 0: 50 },    // 艾雅法拉 S1 二重咏唱:攻速+50(M1)
  'char_455_nothin': { 1: 0 },     // 乌有 S2 阴晴圆缺:随机三选一中的「攻击速度+25」按用户口径 2026-09-18 不计(只留攻击力+50%)
};
const SKILL_ATK_KEY_OVERRIDES = {
  'char_1020_reed2': { 2: 'reed2_skil_3[switch_mode].atk' },
  'char_2014_nian': { 2: 'nian_s_3[self].atk' },   // 年 S3「铁御」:自身攻击力增幅(友方 def/阻挡 buff 不计)
  'char_4199_makiri': { 1: 'makiri_s_2[passive].atk' },  // 松桐 S2 万手成局:攻击+X% 在 passive 前缀键
  'char_180_amgoat': { 0: 'amgoat_s_1[b].atk' },  // 艾雅法拉 S1 二重咏唱:默认第二次开启口径(追加攻击力+50% M1,[a] 首启只有攻速)
  // ---- 近卫·佣兵(mercenary) ----
  'char_394_hadiya': { 0: 'extra.atk' },  // 哈蒂娅 S1 沙地战术改良:装备应变 攻击力+80%(专一)记在 extra.atk(用户口径"视为开启装备应变")
};

// ===== 佣兵(mercenary)特例 =====
// 用户口径(2026-09-17):所有佣兵可开启装备应变的技能均视为开启装备应变;
//   哈蒂娅「荒野的后裔」攻击力增幅默认叠满(入 TALENT_ATK_DRIVERS,×max_stack_cnt);
//   雷狼龙S空爆「斧模式变形」不考虑增加持续时间、所有技能均不考虑充能。
// 佣兵特性:可消耗部署费用来强化作战能力(消耗费用本身不改输出,DPS 不建模)。
const MERCENARY_SPECIAL = {
  'char_1049_catap2': [0, 1],  // 雷狼龙S空爆:S1 高压回填斩(变形斩5+五连击5+十连击10=20 击,每击附 29% 法伤) / S2 超高输出属性解放斩(装备应变一击 300%)
};
// 佣兵「装备应变」视为开启:技能期时长的额外加成登记(哈蒂娅 S2 剑角之锋:消耗 15 费用延长 15 秒)
const ALTER_EQUIP_DURATION = {
  'char_394_hadiya': { 1: 'extra.duration' },
};

// 技能自回键别名(数据把每秒回血比例放带前缀的键,语义同顶层 hp_recovery_per_sec_by_max_hp_ratio):
// 松桐 S2「万手成局」每秒恢复最大生命 X% 在 makiri_s_2[passive] 前缀键
const SKILL_HP_RECOVERY_KEY_OVERRIDES = {
  'char_4199_makiri': { 1: 'makiri_s_2[passive].hp_recovery_per_sec_by_max_hp_ratio' },
};
// 顶层自回键误触排除:技能 bb 的顶层 hp_recovery_* 实为召唤物/其他单位的效果,非持有者本体自回 → 跳过技能自回建模
// (夜半 S1「半醒」hp_recovery_per_sec_by_max_hp_ratio 0.14 是眠兽休眠回血,本体只回费;
//  缪尔赛思 S2「流形复制」0.04 是流形形态的回血效果,归属召唤物侧建模)
const SKILL_REGEN_IGNORE = {
  'char_476_blkngt': [0],
  'char_249_mlyss': [1],
  'char_110_deepcl': [0],   // 深海色 S1:每秒恢复 55 点生命属触手(召唤物),非本体自回
};

// 技能期普攻切换为法术伤害(驭法铁卫类机制,如年 S1「锡灼」普通攻击造成法术伤害):
// 技能期每击按法术结算(吃敌方法抗),常态普攻仍为物理。
const SKILL_ARTS_OVERRIDES = {
  'char_140_whitew': [1],   // 拉普兰德 S2「狼魂」:伤害类型变为法术
  'char_294_ayer': [0, 1],  // 断崖 S1/S2:伤害类型变为法术
  'char_271_spikes': [1],   // 芳汀 S2「致命恶作剧」:伤害类型变为法术
  'char_2014_nian': [0],   // 年 S1「锡灼」
  'char_107_liskam': [1],  // 雷蛇 S2 反击电弧：攻击变为对最多 3 敌造成法术伤害（单目标=法伤）
  'char_4230_mcnist': [2], // 机械师 S3 工程学十字星：攻击变为十字范围法术伤害（召唤物轮再校冲锋口径）
  // ---- 先锋(PIONEER) ----
  'char_102_texas': [1],   // 德克萨斯 S2 剑雨:对周围敌人两次 1.7×atk 法术伤害(单目标全中)
  'char_349_chiave': [1],  // 贾维 S2 火焰剥离:对周围敌人 3.5×atk 法术伤害
  'char_4026_vulpis': [1], // 忍冬 S2 坠刃拷问:对周围最多6敌 3×atk 法术伤害
  // ---- 近卫·武者(musha) ----
  'char_337_utage': [1],   // 宴 S2 落地斩·破门(落地限时被动):技能期伤害类型变为法术(常态仍为物理普攻)
  // ---- 特种·推击手(pusher) ----
  'char_400_weedy': [2],   // 温蒂 S3 液氮大炮:群体法术伤害(按距离的真实伤害按用户口径不计算)
  // ---- 特种·钩索师(hookmaster) ----
  'char_474_glady': [2],   // 歌蕾蒂娅 S3 缺水的碎漩狂舞:每 1.5s 法术伤害(专用分支结算跳数)
  'char_173_slchan': [0],  // 崖心 S1 锁链勾爪:法术伤害
  'char_383_snsant': [1],  // 雪雉 S2 伸缩式电捕网:法术伤害
};

/**
 * 模组面板加成:按当前装配的模组 id+等级取该级 attributeBlackboard(数据为该等级生效后的最终加成)。
 * 证章(INITIAL 无 levels)/无模组返回全 0;attackSpeed 为攻速值增量(100 基准上加算)。
 */
// ===== 模组技能伤害提升(仅技能期伤害乘,常态普攻不乘) =====
// 德克萨斯 Y「外勤私人补给包」(Y2/Y3):天赋「战术快递」增强为"技能造成的伤害提高10%/15%"
// (编入无条件生效)→ 读 te 同名条目的 damage_scale,calcDamage 技能期每击乘。
const MODULE_SKILL_DMG_MUL = {
  'char_102_texas': { talentIndex: 0 },  // 德克萨斯 Y:战术快递增强 damage_scale 1.1(Y2)/1.15(Y3)
};
function calcModuleSkillDmgMul(op, slotData) {
  const cfg = MODULE_SKILL_DMG_MUL[op.id];
  if (!cfg) return 1;
  const bb = getTalentEnhBB(op, slotData, cfg.talentIndex);
  return (bb && typeof bb.damage_scale === 'number') ? bb.damage_scale : 1;
}

// ===== 模组新增天赋:技能治疗量提升(仅技能期治疗乘,常态普攻不乘) =====
// 清流 Y「江河之韵」(Y2/Y3):新增天赋「细水长流」=技能的治疗效果提高10%/20%
// (te name=细水长流,基础天赋名是快速愈合故同名覆盖接不到;Y2 heal_scale 1.1 / Y3 1.2 无条件必生效)。
const MODULE_SKILL_HEAL_MUL = {
  'char_385_finlpp': { teName: '细水长流' },  // 清流 Y2/Y3:技能治疗量 ×1.1/×1.2
};
function calcModuleSkillHealMul(op, slotData) {
  const cfg = MODULE_SKILL_HEAL_MUL[op.id];
  if (!cfg) return 1;
  const lv = getModuleLevelData(op, slotData);
  if (!lv || !Array.isArray(lv.talentEnhance)) return 1;
  const pot = slotData.potentialRank || 0;
  let best = null;
  for (const c of lv.talentEnhance) {
    if (!c || c.name !== cfg.teName) continue;
    const cPot = c.requiredPotentialRank ?? c.potentialRank ?? 0;
    if (cPot > pot) continue;
    const v = (c.blackboard || {}).heal_scale;
    if (typeof v === 'number' && (best === null || v > best)) best = v;
  }
  return best ?? 1;
}

// ===== 模组特性追加/增强常驻段的无条件面板属性(仅读 name=null 条目,同名条件条目天然排除) =====
// 号角 Y「旧日新装」:L1 起特性追加"不阻挡敌人时…攻击速度+10"(要塞常态远程,同火哨默认未阻挡口径);
// Y2/Y3 血战增强新增常驻段 horn_e_003_t[attr](攻速+5/8%、def+5/8%)——同名"血战"条目是被击倒后段
// (攻速20~25/def20~25%,hp_ratio 条件)不读 null 规则排除;基础血战维持"不计"口径。
const MODULE_UNCOND_ATTR = {
  'char_4039_horn': {  // 号角 Y:攻速两来源累加(特性+10 + 血战常驻5/8);def 乘算 5/8%
    adds: [
      { key: 'attack_speed', dst: 'aspd' },
      { key: 'horn_e_003_t[attr].attack_speed', dst: 'aspd' },
      { key: 'horn_e_003_t[attr].def', dst: 'defMul' },
    ],
  },
};
function calcModuleUncondAttr(op, slotData) {
  const out = { aspd: 0, defMul: 0 };
  const cfg = MODULE_UNCOND_ATTR[op.id];
  if (!cfg) return out;
  const lv = getModuleLevelData(op, slotData);
  if (!lv || !Array.isArray(lv.talentEnhance)) return out;
  // 每个 adds 源独立取该档最高值后累加(号角:特性攻速+10 与血战常驻攻速 5/8 叠加=Y3 总 18)
  const acc = { aspd: 0, defMul: 0 };
  for (const a of cfg.adds) {
    let best = 0;
    for (const c of lv.talentEnhance) {
      if (!c || c.name !== null) continue;   // 仅 null 条目:同名=条件/倒地段,绝不消费
      const v = (c.blackboard || {})[a.key];
      if (typeof v === 'number' && v > best) best = v;
    }
    acc[a.dst] += best;
  }
  out.aspd = acc.aspd;
  out.defMul = acc.defMul;
  return out;
}


function calcModuleBonus(op, slotData) {
  const bonus = { maxHp: 0, atk: 0, def: 0, magicResistance: 0, attackSpeed: 0 };
  const m = slotData.module;
  if (!m) return bonus;
  const mod = (op.modules || []).find(x => x.id === m.moduleId);
  if (!mod) return bonus;
  const lv = (mod.levels || []).find(l => l.level === m.moduleLevel);
  if (!lv) return bonus;
  for (const [k, v] of Object.entries(lv.attributeBlackboard || {})) {
    const key = MODULE_ATTR_MAP[k];
    if (key && bonus[key] !== undefined) bonus[key] += v;
  }
  return bonus;
}

// 常驻攻击速度天赋驱动表(blackboard.attack_speed 为直接加算的攻速值,100 基准上加算)。
// key: 干员 id;value: 攻速天赋在 op.talents 数组中的索引。
// 攻速天赋不看叠层数的干员(Y 模组 te 的 attack_speed 为平值、叠层的是别的效果)
const TALENT_SPD_NO_STACK = {
  'char_103_angel': true,   // Y「快速弹匣」:攻速 +12 为平值,叠层的是「无视防御」(走 TALENT_DEF_PEN_FIXED)
};

const TALENT_SPD_DRIVERS = {
  'char_4194_rmixer': { talentIndex: 0, key: 'attack_speed' },   // 信仰搅拌机「扫射迎宾仪礼」:每次造成伤害 10s 内攻速+3(X 模组 +4/+5),最多3层 → 攻击次数型,叠满 9/12/15

  'char_4009_irene': 1,   // 艾丽妮「净化之剑」:攻速 +18/21(E2 潜0 = 18,基础版;模组新增攻击力部分按口径不计)
  'char_017_huang': { talentIndex: 1, key: 'huang_t_2[e_002_atk_speed].attack_speed' },   // 煌「严酷训练」:攻速增幅(模组 X 新增档,默认生效)
  'char_294_ayer': 0,   // 断崖「索敌援助」:自身(与周围8格友方)攻速 +4/6/8/10(常驻)
  'char_1013_chen2': { talentIndex: 1, key: 'chen2_t_2[common].attack_speed' },   // 假日威龙陈「假日余韵」:攻速+8(水地形档 [map] 默认不计,用户口径取基础效果)
  // ---- 狙击·神射手(longrange) ----
  'char_218_cuttle': 0,   // 安哲拉「深海直觉」:所有【深海猎人】攻速+6/8/12(E2潜0=12);自身即为深海猎人,按常驻计(用户 2026-09-17 确认)
  'char_328_cammou': 0,   // 卡达「协调一致」:自身与浮游单元攻速+6(精1)/+12(精2)
  'char_4040_rockr': 0,       // 洛洛「立于磐石」:本体无攻速;X 模组 L3 追加「叠满后攻击速度+5」(te 为 name=null 条目)
  'char_1038_whitw2': 1,      // 荒芜拉普兰德「叙拉古的荣幸」:本体无攻速;X 模组 L2/L3 追加「首次触发技能后攻速+6/+10」
  'char_147_shining': 1,  // 闪灵「法典」:精二起 攻速+10,潜能3 起 +13
  'char_108_silent': 0,// 赫默「医疗支援」:在场全体医疗攻速+6/8(精一),+12/14(精二);自身必得
  'char_103_angel': 0,    // 能天使「快速弹匣」:精一 Lv1 起攻速+6 自身常驻
  'char_4179_monstr': 1,  // Mon3tr「战术协同」:自身/重构体造成治疗时攻速+10~22 持续10s无法叠加;
                          // 自身每 2.85s 治疗一次持续刷新 → 等效常驻(重构体默认不放不影响自身触发)
  'char_1050_chen3': 0,   // 赤刃明霄陈「形意洞照」:攻击速度+8/11(精1)→+13/16(精2 潜4),同源天赋 atk 在 TALENT_ATK_DRIVERS
  'char_274_astesi': 0,   // 星极「天体仪」:在场每20s叠1层攻速+3/5,最多5层(100s叠满)→等效常驻满层+15/25(用户口径同塞雷娅叠满先例)
  // ---- 执旗手(bearer) ----
  'char_479_sleach': { talentIndex: 0, key: 'sleach_t_1[ally].attack_speed' }, // 琴柳「不退之旗」:军旗周围8格干员攻速+5(E1)→+10(E2),自身持旗必吃(敌人攻速-10 不计)
  // ---- 情报官(agent) ----
  // ---- 秘术师(mystic) ----
  'char_4226_veen': 0,    // 维伊「在挥刀之前」:有转置能量时攻击力+2%~10%,无转置时攻速+5~15;持续打人模型下无储存能量(故无转置)→取攻速档
  'char_497_ctable': 0,   // 晓歌「万全」:未阻挡敌人时攻速+6/8(E1)→+12/14(E2 潜4),阻挡时改攻击力+12% 二选一(远程位默认未阻挡吃攻速档)
  // ---- 链术师(chain) ----
  'char_135_halo': 0,     // 星源「科研热忱」:每在场上停留15s攻速+3(E1)/+4(E2),最多5层 → 时间累积默认满层(×max_stack_cnt,同星极「天体仪」先例)=+15/+20;Y 模组改 10s/6~7层 → +24/+28
  // ---- 速射手(fastshot) ----
  'char_133_mm': 0,       // 梅「维多利亚探员」:攻击速度+7(E2 潜0,潜4 +8)(攻击力 +7% 在 TALENT_ATK_DRIVERS)
  'char_367_swllow': 0,   // 灰喉「顺风」:攻击速度+6(「15% 概率攻击力×1.5」为概率类,不建模走说明)
  'char_235_jesica': 0,   // 杰西卡「快速弹匣」:攻击速度+6(精1)/+12(精2)
  'char_211_adnach': 0,   // 安德切尔「短板突破」:攻击速度+4(精1 潜0)/+8(精1 潜0 高档)(「优先攻击远程」为索敌规则,不计)
  // ---- 辅助·凝滞师(slower) ----
  'char_291_aglina': 0,   // 安洁莉娜「加速力场」:全场友方攻速 +7(含自身);X 模组「自身攻击范围内的友方额外 +3/5」不含自身,te 见 MODULE_TE_IGNORE
  'char_1047_halo2': 0,   // 溯光星源「数据建模」:造成停顿时自身攻速 +1,最多 18 层 → 满层 +18(用户口径:攻速默认叠满);Y 模组 23/25 经 MODULE_TE_ASPD_STACK
  'char_195_glassb': 0,    // 真理「探知者」:攻速 +18(E2);Y 模组同名 te 覆盖为 21/24
  'char_4032_provs': 0,    // 但书「卡西米尔法律专精」:攻速 +10(E2)
  'char_4122_grabds': 0,   // 小满「好好听话」:攻速 +10(E2);X 模组同名 te 覆盖为 12→14/16
  'char_278_orchid': 0,    // 梓兰「施法速度提升」:攻速 +5(E1)/+9(E1 55 级满级)
  // ---- 辅助·巫役(ritualist) ----
  'char_4102_threye': 1,   // 凛视「隐居者」:攻速 +6(E2,潜4 +7);X 模组同名 te 0.09/0.11(同源天赋攻击力在 TALENT_ATK_DRIVERS)
  'char_4223_botany': 0,   // 伯塔尼「背弃沉默」:攻击范围内有敌人侵蚀损伤爆发时攻速 +6(E2)/+7(潜4),最多 3 层 →
                           // 用户口径(2026-09-18)按满层:×max_stack_cnt = +18/+21(X 模组 L3 te 7×4 层 = +28)
  // ---- 特种·伏击客(stalker) ----
  'char_4132_ascln': 1,   // 阿斯卡纶「噬光残影」:攻击速度 +8(E2),自身周围四格有高台时额外 +6
                          // —— 用户口径(2026-09-18)按基础计算 → 仅 +8(条件类 +6 不计)
};


// 模组 te 攻速跳过表(条件型:仅在"拥有储存能量"等前提下生效的 te 攻速,持续打人模型下不成立)
// 模组 te 攻速按满层叠乘的干员(其天赋本身是叠层攻速型,模组同步改叠层上限/间隔)。
// 默认不叠乘:洛洛 X L3「叠满后攻击速度+5」是固定加算值(×max_stack_cnt 会误算成 +20)。
const MODULE_TE_ASPD_STACK = {
  'char_4194_rmixer': true,   // X「扫射迎宾仪礼」te 攻速 4/5 × 最大 3 层

  'char_135_halo': true,   // 星源「科研热忱」:Y 模组改 10s/6~7 层、每层 +4 → +24/+28
  'char_1047_halo2': true,   // 溯光星源 Y「探索者的收藏」:数据建模叠层上限 23/25(te attack_speed 1 × max_stack_cnt)
  'char_4223_botany': true,  // 伯塔尼 X「昨日、今日、明日」:背弃沉默 te attack_speed 7 × max_stack_cnt(3/4 层)
                             // ——用户口径 2026-09-18 攻速增幅按满层计
};

// 模组 te 与基础天赋"合并而非替换"表:部分模组 te 只写变更部分(如异客 X 模组「孤卒」te 仅给 sp_recovery_per_sec),
// 整体替换会丢失未写出的基础数值(攻击力+8%/10%)。
// name=null 的模组 te(不指名天赋)允许并入的天赋索引白名单:需与 MODULE_TE_TALENT_MERGE 配合
const MODULE_TE_NULL_MERGE = {
  'char_113_cqbw': [0],   // W Y 模组:部署后每秒+1层永久攻击力,并入天赋0「设伏」
  'char_437_mizuki': [0], // 水月 A 模组(特限证章):创伤性癔症 te 为 name=null 多条(含空 blackboard 占位),并入天赋0
};

const MODULE_TE_TALENT_MERGE = {
  'char_113_cqbw': [0],   // W Y 模组 te(name=null):部署后每秒+1层攻击力,并入天赋0「设伏」

  // 异客 X 模组「孤卒」te 只给技力回复,但该天赋按用户口径不计 → 无需合并
  // 佩佩 RA-α「弥漫莲香」te 含空 blackboard 占位档(全模组档重复列出),整体替换会清掉基础 atk 键 → 改为合并
  'char_4058_pepe': [1],
  // 水月 A 模组(特限证章)te 含“创伤性癔症={}”空占位档,整体替换会把第一天每击附加法伤清零 → 改为合并
  // (实际数值在 name=null 的 te 里:atk_scale 0.5,与基础档同值)
  'char_437_mizuki': [0],
};

// ===== 投掷手(bombarder)专用结算 =====
// 用户口径(2026-09-17):投掷手特性(余震)要计入 —— 每次攻击附带 attack@times × append_atk_scale(0.5)×攻击力 的余震伤害;
// 迷迭香「思维膨大」额外一次 140% 法术;维什戴尔「好礼」额外伤害仅在 3 技能开启时计;承曦格雷伊「窃光链缚」伤害增幅不计。
function calcBombarderSkill(op, slotData, skillIndex, levelData, ctx) {
  const { panelAtk, realInterval, normalInterval, effDef, enemy, skillDuration, generic } = ctx;
  const af = bombarderAftershocks(op, slotData);
  const h = (atk, def) => calcPhysicalDamage(atk, def === undefined ? effDef : def);
  const a = (atk) => calcArtsDamage(atk, enemy.res);
  const nrm = () => (normalInterval > 0 ? (h(panelAtk) + af.n * h(panelAtk * af.scale)) / normalInterval : null);
  const res = (total, dps, cycle, extraArts) => ({
    skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle, normalDps: nrm(),
    skillHps: null, normalHps: null, totalHeal: null, damageType: extraArts > 0 ? 'physical' : 'physical', realInterval,
    dmgTypes: extraArts > 0 && extraArts >= total
      ? { arts: { skillDps: dps, skillTotalDamage: total, cycleDps: null } }
      : extraArts > 0
        ? { physical: { skillDps: dps, skillTotalDamage: total - extraArts, cycleDps: null }, arts: { skillDps: 0, skillTotalDamage: extraArts, cycleDps: null } }
        : { physical: { skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle } },
  });
  const nAtk = realInterval > 0 && skillDuration > 0 ? Math.floor(skillDuration / realInterval + 1e-9) : 0;
  // 迷迭香
  if (op.id === 'char_391_rosmon') {
    if (skillIndex === 0) {                    // 「思维膨大」:下次攻击 + 一次 140% 法伤 + 余震
      const phys = h(panelAtk) + af.n * h(panelAtk * af.scale);
      const arts = a(panelAtk * (levelData.extra_atk_scale || 0));
      return res(phys, 0, calcCycleDps(levelData, realInterval, h(panelAtk), phys + arts), arts);
    }
    if (skillIndex === 1) {                    // 「末梢阻断」:atk+37%、额外 2 次余震、间隔增大
      const atk = panelAtk * (1 + (levelData.atk || 0));
      const n = Math.max(af.n, levelData.add_times || 0);
      const per = h(atk) + n * h(atk * af.scale);
      const total = per * nAtk;
      return res(total, skillDuration > 0 ? total / skillDuration : 0, null);
    }
    if (skillIndex === 2) {                    // 「如你所愿」:atk+50%、间隔缩短、目标默认被阻挡(战术装备减防 160)
      const atk = panelAtk * (1 + (levelData.atk || 0));
      const def = Math.max(0, effDef - 160);
      const per = h(atk, def) + af.n * h(atk * af.scale, def);
      const total = per * nAtk;
      return res(total, skillDuration > 0 ? total / skillDuration : 0, null);
    }
  }
  // 维什戴尔
  if (op.id === 'char_1035_wisdel') {
    const bombScale = funnelTalentValue(op, slotData, 0, 'attack@bomb_atk_scale') || 0;
    if (skillIndex === 0) {                    // 「定点清算」:额外 2 次余震(余震伤害按 append_atk_scale)
      const per = h(panelAtk) + 2 * h(panelAtk * (levelData.append_atk_scale || af.scale));
      return res(per, 0, calcCycleDps(levelData, realInterval, h(panelAtk), per));
    }
    if (skillIndex === 1) {                    // 「饱和复仇」过载:4 连发 × attack@atk_scale_ol,默认均可命中
      const atk = panelAtk * (1 + (levelData.atk || 0));
      const shots = 4;
      const per = shots * h(atk * (levelData['attack@atk_scale_ol'] || 1));
      const total = per * nAtk;
      return res(total, skillDuration > 0 ? total / skillDuration : 0, null);
    }
    if (skillIndex === 2) {                    // 「爆裂黎明」:atk+160%、攻击力提升至 200%、弹药 6、好礼额外伤害计入
      const atk = panelAtk * (1 + (levelData.atk || 0));
      const main = h(atk * (levelData['attack@atk_scale_3'] || 1));
      const bomb = h(atk * bombScale);
      const per = main + bomb + af.n * h(atk * af.scale);
      const ammo = levelData['attack@trigger_time'] || 0;
      const total = per * ammo;
      return res(total, ammo > 0 && realInterval > 0 ? total / (ammo * realInterval) : 0, null);
    }
  }
  // 承曦格雷伊
  if (op.id === 'char_1027_greyy2') {
    if (skillIndex === 0) {                    // 「迅捷打击·γ型」:atk+37% + 攻速+35
      const atk = panelAtk * (1 + (levelData.atk || 0));
      const per = h(atk) + af.n * h(atk * af.scale);
      const total = per * nAtk;
      return res(total, skillDuration > 0 ? total / skillDuration : 0, null);
    }
    if (skillIndex === 1) {                    // 「晨曦信标」:雷电球每 interval 秒造成 120% 法伤,持续 10 秒(可充能 2 次 → 计 1 个球的持续时间)
      const tick = a(panelAtk * (levelData.atk_scale || 0));   // 技能伤害基数 = 攻击力×atk_scale(120%)
      const dur = levelData.projectile_delay_time || 0;
      const iv = levelData.interval || 1.5;
      const ticks = Math.floor(dur / iv + 1e-9) + 1;
      const total = tick * ticks;
      return res(total, 0, null, total);
    }
  }
  return generic();
}

// ===== 猎手(hunter)补弹间隔 =====
// 用户口径(2026-09-17):基准装填时间 = 攻击间隔;常态"1攻1装弹"(A 装弹 A 装弹)→ 两次普攻之间 = 攻速 + 装填间隔 = 2×攻击间隔;
// X 模组"2攻1装弹"(A A 装弹 A A 装弹)→ 攻速+攻速+装填间隔内打 2 次 → 每次普攻摊到 1.5×攻击间隔。
// 技能里的 reload_interval 增减量作用在装填段(装填 = 攻击间隔 + reload_interval)。
function hunterReloadShots(op, slotData) {
  const lv = getModuleLevelData(op, slotData);
  if (lv && Array.isArray(lv.traitEnhance)) {
    for (const tr of lv.traitEnhance) {
      const bb = tr.blackboard || {};
      if (typeof bb.extra_add === 'number' && bb.extra_add >= 1) return 2;
    }
  }
  return 1;
}
// 一轮循环 = 攻击间隔 + 装填间隔/n(装填间隔 = 攻击间隔 + 技能 reload_interval 增减量)
function hunterCycleInterval(baseInterval, op, slotData, levelData) {
  if (op.subProfessionId !== 'hunter' || !(baseInterval > 0)) return baseInterval;
  const reload = Math.max(0, baseInterval + ((levelData && levelData.reload_interval) || 0));
  return baseInterval + reload / hunterReloadShots(op, slotData);
}

// ===== 投掷手(bombarder)余震 =====
// 用户口径(2026-09-17):投掷手特性要算(余震伤害 = 攻击力×append_atk_scale,次数取 trait 的 attack@times;
// X 模组 traitEnhance 会把余震提到 3 次/或开启第三段)。重射手/速射手特性不影响伤害,不计。
// 转换后干员数据不带 trait(为 null),按原始 character_table 的特性键写死:
// 投掷手特性 = 攻击附带 attack@times 次、每次 attack@append_atk_scale(0.5)×攻击力的余震;
// X 模组 traitEnhance 把余震提到 3 次(迷迭香 attack@times 3 / 其余 attack@enable_third_attack 1)。
const BOMBARDER_AFTERSHOCK = {
  'char_391_rosmon': { n: 2, scale: 0.5 },
  'char_1035_wisdel': { n: 2, scale: 0.5 },
  'char_1027_greyy2': { n: 2, scale: 0.5 },
  'char_4077_palico': { n: 2, scale: 0.5 },
};
// ===== 回环射手(loopshooter) =====
// 特性:持有回旋投射物时才能攻击(投射物需回收),数值上不改变间隔。
// 用户口径(2026-09-17):娜仁图亚「我见，我得」偷取数值默认为满 → 常驻 +attack@steal_atk_max 攻击力;
// 跃跃「乐趣加倍」二连击、娜仁图亚「吞日」三连击、水灯心「可驯服的」五连击(技能额外发射/斩击的段数)。
function narantStealAtk(op, slotData) {
  if (op.id !== 'char_4138_narant') return 0;
  const cands = (op.talents && op.talents[0] && op.talents[0].candidates) || [];
  const pick = [];
  for (const c of cands) {
    const ph = (c.unlockCondition && c.unlockCondition.phase) || 'PHASE_0';
    const phIdx = ph === 'PHASE_0' ? 0 : ph === 'PHASE_1' ? 1 : 2;
    if (phIdx > slotData.elite) continue;
    if ((c.potentialRank || 0) > (slotData.potentialRank || 0)) continue;
    pick.push(c);
  }
  const src = talentCandSource(op, slotData, 0, pick.length ? pick : cands);
  let best = 0;
  for (const c of (src || [])) {
    const v = (c.blackboard || {})['attack@steal_atk_max'];
    if (typeof v === 'number' && v > best) best = v;
  }
  return best;
}
// 常态:偷取攻击力带来的额外秒伤(与常态行其余项相加)
function loopshooterExtraAtkDps(op, slotData, panelAtk, effDef, realInterval) {
  const steal = narantStealAtk(op, slotData);
  if (!steal || !(realInterval > 0)) return 0;
  return (calcPhysicalDamage(panelAtk + steal, effDef) - calcPhysicalDamage(panelAtk, effDef)) / realInterval;
}

// 投掷手常态普攻的余震秒伤(计入常态行;余震同样吃 5% 保底伤害)
function bombarderNormalExtraDps(op, slotData, panelAtk, effDef, realInterval) {
  const af = bombarderAftershocks(op, slotData);
  if (!af.n || !(realInterval > 0)) return 0;
  return af.n * calcPhysicalDamage(panelAtk * af.scale, effDef) / realInterval;
}
function bombarderAftershocks(op, slotData) {
  const base = BOMBARDER_AFTERSHOCK[op.id];
  if (!base) return { n: 0, scale: 0.5 };
  let n = base.n, scale = base.scale;
  const lv = getModuleLevelData(op, slotData);
  if (lv && Array.isArray(lv.traitEnhance)) {
    for (const tr of lv.traitEnhance) {
      const bb = tr.blackboard || {};
      if (typeof bb['attack@times'] === 'number') n = bb['attack@times'];
      if (typeof bb['attack@append_atk_scale'] === 'number') scale = bb['attack@append_atk_scale'];
      if (typeof bb['attack@enable_third_attack'] === 'number' && bb['attack@enable_third_attack'] >= 1) n = Math.max(n, 3);
    }
  }
  return { n, scale };
}

// ===== 攻城手(siegesniper)专用结算 =====
// 说明文本(用户 2026-09-17):早露「深入骨髓」防御忽视与额外伤害不生效;熔泉「火热直觉」攻击力提升不生效;
// 埃拉托「琴音入梦」防御忽视不生效;铅踝「目光如炬」攻击力增幅不生效、S2「破虹」默认攻击多个敌人(只算本目标);
// 提丰「锐如兽牙」无视防御按最高计算、「重如沼泥」攻击力提升不计、S3「冰原秩序」默认攻击不同目标(只算本目标);
// 矩「墨守」伤害提升不计、S2「良翼难乘」额外物理伤害不计。
function calcSiegeSkill(op, slotData, skillIndex, levelData, ctx) {
  const { panelAtk, realInterval, normalInterval, effDef, enemy, skillDuration, generic } = ctx;
  const h = (atk, def) => calcPhysicalDamage(atk, def === undefined ? effDef : def);
  const nrm = () => (normalInterval > 0 ? calcPhysicalDamage(panelAtk, effDef) / normalInterval : null);
  const nAtk = realInterval > 0 && skillDuration > 0 ? Math.floor(skillDuration / realInterval + 1e-9) : 0;
  const res = (total, dps, cycle) => ({
    skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle, normalDps: nrm(),
    skillHps: null, normalHps: null, totalHeal: null, damageType: 'physical', realInterval,
    dmgTypes: { physical: { skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle } },
  });
  // 早露 S3「雪崩击」:束缚期间每秒受到一次攻击,持续 hit_duration 秒(多目标只算本目标)
  if (op.id === 'char_197_poca' && skillIndex === 2) {
    const per = h(panelAtk * (1 + (levelData.atk || 0)));
    const ticks = Math.floor((levelData.hit_duration || skillDuration) / (levelData.hit_interval || 1) + 1e-9);
    return res(per * ticks, per, calcCycleDps(levelData, realInterval, h(panelAtk), per * ticks));
  }
  // 提丰 S3「永恒狩猎」:8 发弹药,每发一轮箭雨共 5 次命中(单目标口径)
  if (op.id === 'char_2012_typhon' && skillIndex === 2) {
    const per = h(panelAtk * levelData['attack@s3_atk_scale']);
    const hits = (levelData['attack@s3_trigger_time'] || 0) * (levelData['attack@s3_max_hit_num'] || 1);
    const total = per * hits;
    return res(total, realInterval > 0 && (levelData['attack@s3_trigger_time'] || 0) > 0 ? total / ((levelData['attack@s3_trigger_time'] / 1) * realInterval) : 0, null);
  }
  // 熔泉:S1「信号矢」每击 attack@atk_scale + 目标防御 -25%;S2「便携破城矢」10 发弹药(直击 + 爆炸对目标)
  if (op.id === 'char_363_toddi') {
    if (skillIndex === 0) {
      const defDown = 1 + (levelData.def || 0);
      const per = h(panelAtk * levelData['attack@atk_scale'], Math.max(0, effDef * defDown));
      const total = per * nAtk;
      return res(total, skillDuration > 0 ? total / skillDuration : 0, null);
    }
    if (skillIndex === 1) {
      const per = h(panelAtk * levelData['attack@atk_scale']) + h(panelAtk * levelData['attack@splash_atk_scale']);
      const ammo = levelData['attack@trigger_time'] || 0;
      const total = per * ammo;
      return res(total, realInterval > 0 ? total / (ammo * realInterval) : 0, null);
    }
  }
  // 提丰 S1/S2:走本分支以保证技能行常态 DPS 与常态口径一致(锐如兽牙无视防御 50%)
  if (op.id === 'char_2012_typhon' && (skillIndex === 0 || skillIndex === 1)) {
    if (skillIndex === 0) {
      const per = h(panelAtk * (1 + (levelData.atk || 0)));
      const total = per * nAtk;
      return res(total, skillDuration > 0 ? total / skillDuration : 0, null);
    }
    const per = h(panelAtk * (1 + (levelData.atk || 0)));
    return res(0, realInterval > 0 ? per / realInterval : 0, null);
  }
  // 矩 S1「良弓难张」:atk_scale_s1(前缀键,原引擎不识别)
  if (op.id === 'char_4221_ju' && skillIndex === 0) {
    const per = h(panelAtk * levelData.atk_scale_s1);
    return res(per, 0, calcCycleDps(levelData, realInterval, h(panelAtk), per));
  }
  return generic();
}

// ===== 散射手(reaperrange)专用结算 =====
// 说明文本(用户 2026-09-17):奥斯塔「尖钉」流血不生效;松果「便携电源」技力回复不生效、S2「电能过载」默认无攻击力追加;
// 假日威龙陈「节约风气」不消耗弹药不生效、「假日余韵」取基础效果(三级模组技能期强制视为水地形);
// 吉星「好运连击！」伤害增幅不生效。(陈 S2「堇青之夜」用户说明文案被截断,暂按蓄力档处理,待补)
// 散射手特性:攻击时对攻击范围内的所有敌人应用特性加成(atk_scale 基础 1.5,X 模组 traitEnhance 提升至 1.6)。
// 用户口径(2026-09-17):一般情况下不触发特性加成,仅技能描述明确写"应用特性加成"的技能计入(陈 S1/S3、送葬人 S1)。
function calcReaperTraitScale(op, slotData) {
  let v = 1.5;
  const lv = getModuleLevelData(op, slotData);
  if (lv && Array.isArray(lv.traitEnhance)) {
    for (const tr of lv.traitEnhance) {
      const s = (tr.blackboard || {}).atk_scale;
      if (typeof s === 'number' && s > v) v = s;
    }
  }
  return v;
}

function calcReaperSkill(op, slotData, skillIndex, levelData, ctx) {
  const { panelAtk, realInterval, normalInterval, effDef, enemy, skillDuration, phase, generic, module } = ctx;
  const h = (atk, def) => calcPhysicalDamage(atk, def === undefined ? effDef : def);
  const atkUp = 1 + (levelData.atk || 0);
  const nrm = () => (normalInterval > 0 ? calcPhysicalDamage(panelAtk, effDef) / normalInterval : null);
  const res = (total, dps, cycle, interval, n) => ({
    skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle, normalDps: nrm(),
    skillHps: null, normalHps: null, totalHeal: null, damageType: 'physical',
    realInterval: interval === undefined ? realInterval : interval,
    dmgTypes: { physical: { skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle } },
  });
  // 假日威龙陈:「假日余韵」技能期档位 — 三级模组技能期强制视为水地形(取 [map] 档),否则取 [common] 档
  if (op.id === 'char_1013_chen2') {
    const isL3 = module && module.moduleLevel >= 3 && String(module.moduleId).includes('_003_');
    let aspd = isL3 ? 20 : 8;
    let atkMul = isL3 ? 1.28 : 1;
    // 模组的 [common] 档(常驻)在三级模组时被 [map] 覆盖(技能期);低等级模组取 [common]
    const phaseBase = phase ? phase.baseAttackTime : 2.3;
    const interval = calcRealInterval(phaseBase, 100 + aspd);
    const ammo = levelData['attack@trigger_time'] || 0;
    const traitScale = calcReaperTraitScale(op, slotData);
    if (skillIndex === 0) {
      // 「高压冲击」:4 发弹夹,技能描述明确"应用特性加成" → 计入特性 atk_scale
      const per = h(panelAtk * atkUp * atkMul * traitScale);
      const total = per * ammo;
      return res(total, interval > 0 ? total / (ammo * interval) : 0, calcCycleDps(levelData, interval, h(panelAtk), total), interval);
    }
    if (skillIndex === 1) {
      // 「堇青之夜」:粘液(减速/减防)不计;默认蓄力 → 弹药 20 发(用户文案截断,暂按蓄力档)
      const ammoZ = levelData['attack@another_trigger_time'] || ammo;
      const per = h(panelAtk * atkUp * atkMul);
      const total = per * ammoZ;
      return res(total, interval > 0 ? total / (ammoZ * interval) : 0, calcCycleDps(levelData, interval, h(panelAtk), total), interval);
    }
    if (skillIndex === 2) {
      // 「假日风暴」:32 发,每次攻击消耗 2 发且造成两次伤害 → 32 次命中;技能描述明确"应用特性加成" → 计入
      const hits = levelData['attack@trigger_time'] || 0;
      const per = h(panelAtk * atkUp * atkMul * traitScale);
      const total = per * hits;
      return res(total, interval > 0 ? total / ((hits / 2) * interval) : 0, null, interval);
    }
  }
  // 送葬人:S2「最终旅程」普攻变二连击;S1「铳口收束」攻击力+55%
  if (op.id === 'char_279_excu') {
    const traitScale = calcReaperTraitScale(op, slotData);
    const per = skillIndex === 1 ? h(panelAtk, effDef) * 2 : h(panelAtk * atkUp * traitScale);
    const n = realInterval > 0 && skillDuration > 0 ? Math.floor(skillDuration / realInterval + 1e-9) : 0;
    const total = per * n;
    return res(total, skillDuration > 0 ? total / skillDuration : 0, n ? null : calcCycleDps(levelData, realInterval, h(panelAtk), per), realInterval);
  }
  // 松果:S1「RMA长钉」技能级固定穿防 220;S2「电能过载」默认无攻击力追加(只用基础 +45%)
  if (op.id === 'char_440_pinecn') {
    if (skillIndex === 0) {
      const per = h(panelAtk * levelData.atk_scale, Math.max(0, effDef - (levelData.def_penetrate_fixed || 0)));
      return res(per, 0, calcCycleDps(levelData, realInterval, h(panelAtk), per), realInterval);
    }
    if (skillIndex === 1) {
      const per = h(panelAtk * (1 + (levelData['pinecn_s_2[a].atk'] || 0)));
      const n = realInterval > 0 && skillDuration > 0 ? Math.floor(skillDuration / realInterval + 1e-9) : 0;
      const total = per * n;
      return res(total, skillDuration > 0 ? total / skillDuration : 0, null, realInterval);
    }
  }
  // 奥斯塔:S2「影钉」攻击力+55%(间隔增大走 BAT_ADD;天赋流血不生效)
  if (op.id === 'char_346_aosta' && skillIndex === 1) {
    const per = h(panelAtk * atkUp);
    const n = realInterval > 0 && skillDuration > 0 ? Math.floor(skillDuration / realInterval + 1e-9) : 0;
    const total = per * n;
    return res(total, skillDuration > 0 ? total / skillDuration : 0, null, realInterval);
  }
  // 吉星:S1「欢迎您来」按满层(4 层 ×+22%);S2「吉星高照」攻击力+65%(控制效果不计)
  if (op.id === 'char_4203_kichi') {
    const stacks = skillDuration > 0 ? (levelData.max_stack_cnt || 0) : 0;
    const per = skillIndex === 0 ? h(panelAtk * (1 + (levelData.atk || 0) * stacks)) : h(panelAtk * atkUp);
    const n = realInterval > 0 && skillDuration > 0 ? Math.floor(skillDuration / realInterval + 1e-9) : 0;
    const total = per * n;
    return res(total, skillDuration > 0 ? total / skillDuration : 0, null, realInterval);
  }
  return generic();
}

// ===== 神射手(longrange)专用结算 =====
// 说明文本(用户 2026-09-17):守林人「暗杀者」攻击力增幅不计、S2「战术电台」炸弹只计一次;
// 远牙「凝神」攻击力增幅不计、S3「光羽箭」伤害增幅不计;蕾缪安「跨境追缉许可」伤害增幅不计、
// 「逃犯引渡手续」攻击力增幅与弹药上限提升默认常驻、S2「归乡邀约」默认不触发特殊狙击、S3「礼炮·强制追思」默认基础伤害。
function calcLongrangeSkill(op, slotData, skillIndex, levelData, ctx) {
  const { panelAtk, realInterval, normalInterval, effDef, enemy, skillDuration, generic } = ctx;
  const h = (atk, def) => calcPhysicalDamage(atk, def === undefined ? effDef : def);
  const atkUp = 1 + (levelData.atk || 0);
  const nrm = () => (normalInterval > 0 ? calcPhysicalDamage(panelAtk, effDef) / normalInterval : null);
  const res = (total, dps, cycle, isPhys = true) => ({
    skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle, normalDps: nrm(),
    skillHps: null, normalHps: null, totalHeal: null, damageType: isPhys ? 'physical' : 'arts', realInterval,
    dmgTypes: isPhys
      ? { physical: { skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle } }
      : { arts: { skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle } },
  });
  // 打字机(鸿雪召唤物):技能继承鸿雪(抑扬格/点题/锐笔速写),面板用自身;目标防御按其天赋「弱点速记」-18%(打在自身结算内)
  if (op.id === 'token_10026_bgsnow_subbow') {
    const tAtkMul = 1 + (levelData.atk || 0);
    if (skillIndex === 0) {          // 「抑扬格」:持续无限,攻击力 +53%(30% 概率档不计)
      const per = h(panelAtk * tAtkMul);
      return res(0, realInterval > 0 ? per / realInterval : 0, null);
    }
    if (skillIndex === 1) {          // 「点题」:立即对前方进行 3 次攻击(每次 atk_scale)
      const per = h(panelAtk * (levelData['attack@atk_scale'] ?? levelData.atk_scale ?? 1)) * 3;
      return res(per, 0, calcCycleDps(levelData, realInterval, h(panelAtk * tAtkMul), per));
    }
    if (skillIndex === 2) {          // 「锐笔速写」:间隔缩短,每击 attack@atk_scale(默认不在正前方 3 格 → 取基础倍率)
      const per = h(panelAtk * (levelData['attack@atk_scale'] ?? levelData.atk_scale ?? 1));
      const nn = realInterval > 0 && skillDuration > 0 ? Math.floor(skillDuration / realInterval + 1e-9) : 1;
      return res(per * nn, skillDuration > 0 ? (per * nn) / skillDuration : 0, null);
    }
  }

  // 蕾缪安(弹夹型):弹药 = attack@trigger_time + 天赋2 弹药上限 +add_count;打完后技能结束
  if (op.id === 'char_4193_lemuen') {
    const ammo = (levelData['attack@trigger_time'] || 0) + (funnelTalentValue(op, slotData, 1, 'add_count') || 0);
    if (skillIndex === 0) {
      // 「重逢问候」:每发 attack@atk_scale,额外攻击 1 名敌人(单目标口径只算本目标)
      const per = h(panelAtk * atkUp * levelData['attack@atk_scale']);
      const total = per * ammo;
      return res(total, 0, calcCycleDps(levelData, realInterval, h(panelAtk), total));
    }
    if (skillIndex === 1) {
      // 「归乡邀约」:默认不触发特殊狙击 → 不消耗弹药 → 按永续技能处理(攻速 +70%、攻击力 +60% 持续)
      const per = h(panelAtk * atkUp);
      return res(0, realInterval > 0 ? per / realInterval : 0, null);
    }
    if (skillIndex === 2) {
      // 「礼炮·强制追思」:停止攻击,每发锁定一名敌人,默认基础伤害(非中心伤害) proj_atk_scale_2
      const per = h(panelAtk * atkUp * levelData['attack@proj_atk_scale_2']);
      const total = per * ammo;
      return res(total, 0, calcCycleDps(levelData, realInterval, h(panelAtk), total));
    }
  }
  return generic();
}

// ===== 炮手(aoesniper)专用结算 =====
// 说明文本(用户 2026-09-17):陨星天赋「爆破附着改装」概率增幅不计、S2「高爆弹头」防御力 -250 仅对本技能伤害生效;
// 慑砂「弱点拆解」物理伤害增幅不计;W「设伏」「落井下石」增幅不计;菲亚梅塔「陈述苦难」精力充沛不计、
// S2「你须愧悔」灼痕爆炸只计一次、S3「你须偿还」攻击力提升不计;截云「初出荒野」攻击力增幅不计。
function calcAoeSkill(op, slotData, skillIndex, levelData, ctx) {
  const { panelAtk, realInterval, normalInterval, effDef, enemy, skillDuration, generic } = ctx;
  const h = (atk, def) => calcPhysicalDamage(atk, def === undefined ? effDef : def);
  const ar = (atk) => calcArtsDamage(atk, enemy?.res ?? 0);
  const nrm = () => (normalInterval > 0 ? h(panelAtk) / normalInterval : null);
  const nAtk = realInterval > 0 && skillDuration > 0 ? Math.floor(skillDuration / realInterval + 1e-9) : 0;
  const res = (isPhys, total, dps, cycle, nrmVal) => {
    const dmgTypes = isPhys
      ? { physical: { skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle } }
      : { arts: { skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle } };
    return {
      skillDps: dps, skillTotalDamage: total, cycleDps: cycle === undefined ? null : cycle, normalDps: nrmVal === undefined ? null : nrmVal,
      skillHps: null, normalHps: null, totalHeal: null, damageType: isPhys ? 'physical' : 'arts', realInterval, dmgTypes,
    };
  };
  // 陨星 S2 高爆弹头:防御力 -250 仅对本技能伤害生效(默认 10s 内,单次结算按减防后防御)
  if (op.id === 'char_219_meteo' && skillIndex === 1) {
    const per = h(panelAtk * levelData.atk_scale, Math.max(0, effDef - Math.abs(levelData.def || 0)));
    return res(true, per, 0, calcCycleDps(levelData, realInterval, h(panelAtk), per), nrm());
  }
  // 菲亚梅塔 S2 你须愧悔:主爆炸 atk_scale + 灼痕爆炸只计一次(atk_scale_2)
  if (op.id === 'char_300_phenxi' && skillIndex === 1) {
    const per = h(panelAtk * levelData.atk_scale) + h(panelAtk * levelData.atk_scale_2);
    return res(true, per, 0, calcCycleDps(levelData, realInterval, h(panelAtk), per), nrm());
  }
  // 慑砂 S2 延时震荡零件:每击 attack@atk_scale(目标攻速 -13 为敌方 debuff,不计)
  if (op.id === 'char_379_sesa' && skillIndex === 1) {
    const per = h(panelAtk * levelData['attack@atk_scale']);
    const total = per * nAtk;
    return res(true, total, skillDuration > 0 ? total / skillDuration : 0, null, nrm());
  }
  // 截云 S2 掷旧尘:停止攻击,飞轮按 interval(1s) 每秒造成 atk_scale 物理伤害
  if (op.id === 'char_4078_bdhkgt' && skillIndex === 1) {
    const per = h(panelAtk * levelData.atk_scale);
    const ticks = Math.floor(skillDuration / (levelData.interval || 1) + 1e-9);
    return res(true, per * ticks, per, null, nrm());
  }
  // 白雪 S2 凝武:攻击变为回旋飞镖,每秒受到 attack@atk_scale 的法术伤害(技能持续期间)
  if (op.id === 'char_118_yuki' && skillIndex === 1) {
    const dps = ar(panelAtk * levelData['attack@atk_scale']);
    const ticks = Math.floor(skillDuration / 1 + 1e-9);
    return res(false, dps * ticks, dps, null, nrm());
  }
  return generic();
}

// ===== 重射手(closerange)专用口径与结算 =====
// 说明文本(用户 2026-09-17):
//  黑「尖锐箭头/破甲箭头」的攻击力增幅与防御力下降仅在 3 技能开启时计算(该技能 talent@prob=1 必然发动,持续时间窗内覆盖全程);
//    天赋「交叉火力」攻击力增幅默认不计算(需场上另有狙击)。
//  普罗旺斯「狩猎箭头」概率增幅不计;「狼眼」默认攻击目标满血 → 无增幅。
//  酸糖「滑射技巧」默认敌人不在正前方两格 → 单次伤害下限取基础档(atk_scale 25%,正前方两格的 40% 档不计)。
//  鸿雪:打字机相关(弱点速记减防)默认不生效;「抑扬格」概率增幅不计;「锐笔速写」默认敌人不在正前方 3 格 → 取基础倍率。
//  玫拉「参数校准」伤害提升默认常驻(技能期伤害 ×damage_scale);「临界爆发」默认伤害随距离衰减至最低(取 scale 档)。
//  焰狐龙梓兰「强击瓶专家」「翔虫机动」攻击力增幅不计;「刚射」有充能即立刻释放 → 不触发刚连射,只按基础档(4 支 × atk_scale_1);
//    「龙之箭」默认敌人仅受到一次伤害(物理 + 法术各一次)。
function acdropMinDamage(op, slotData, atk) {
  // 处决者·红「刺骨」:每次攻击至少造成 atk_scale×攻击力 的伤害(攻击伤害下限)
  if (op.id !== 'char_366_acdrop' && op.id !== 'char_144_red') return 0;
  const mul = funnelTalentValue(op, slotData, 0, 'atk_scale');
  return mul > 0 ? mul * atk : 0;
}

function calcCloserangeSkill(op, slotData, skillIndex, levelData, ctx) {
  const { panelAtk, realInterval, normalInterval, effDef, enemy, skillDuration, generic } = ctx;
  const h = (atk, def) => calcPhysicalDamage(atk, def === undefined ? effDef : def);
  const ar = (atk) => calcArtsDamage(atk, enemy?.res ?? 0);
  const atkUp = 1 + (levelData.atk || 0);
  const nAtk = realInterval > 0 && skillDuration > 0 ? Math.floor(skillDuration / realInterval + 1e-9) : 0;
  // 常态普攻 DPS(重射手分支内自算:酸糖单次伤害下限;其余同通用口径)
  const normDps = normalInterval > 0 ? Math.max(h(panelAtk), acdropMinDamage(op, slotData, panelAtk)) / normalInterval : null;
  const one = (per) => ({
    skillDps: skillDuration > 0 ? (per * nAtk) / skillDuration : 0,
    skillTotalDamage: per * nAtk, cycleDps: null, normalDps: normDps, skillHps: null, normalHps: null, totalHeal: null,
    damageType: 'physical', realInterval, dmgTypes: { physical: { skillDps: skillDuration > 0 ? (per * nAtk) / skillDuration : 0, skillTotalDamage: per * nAtk, cycleDps: null } },
  });
  const trigger = (total, cycle, phys, arts) => {
    const dmgTypes = {
      physical: { skillDps: 0, skillTotalDamage: phys === undefined ? total : phys, cycleDps: arts === undefined ? cycle : (cycle === null ? null : cycle * (phys / total)) },
    };
    if (arts !== undefined) dmgTypes.arts = { skillDps: 0, skillTotalDamage: arts, cycleDps: cycle === null ? null : cycle * (arts / total) };
    return {
      skillDps: 0, skillTotalDamage: total, cycleDps: cycle, normalDps: normDps, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval, dmgTypes,
    };
  };

  // 黑 S3 战术的终结:天赋必发动 → 攻击力 ×atk_scale(1.6) 且目标防御 -20%(持续 5s,间隔 2.0s 全程覆盖)
  if (op.id === 'char_340_shwaz' && skillIndex === 2) {
    const cands = talentCandSource(op, slotData, 0, (op.talents[0] || {}).candidates || []);
    const tScale = Math.max(1, ...cands.map((c) => (typeof c.blackboard?.atk_scale === 'number' ? c.blackboard.atk_scale : 1)));
    const tDef = Math.min(0, ...cands.map((c) => (typeof c.blackboard?.def === 'number' ? c.blackboard.def : 0)));
    const per = h(panelAtk * atkUp * tScale, effDef * (1 + tDef));
    return one(per);
  }
  // 玫拉:「参数校准」技能期伤害提升默认常驻
  if (op.id === 'char_4006_melnte') {
    const dmgMul = funnelTalentValue(op, slotData, 0, 'damage_scale') || 1;
    if (skillIndex === 0) {
      // S1 饱和脉冲:间隔 2.4s(加算),攻击力 +170%
      return one(h(panelAtk * atkUp) * dmgMul);
    }
    // S2 临界爆发:穿透弹单发,默认伤害衰减至最低档(scale)
    const per = h(panelAtk * (levelData.scale || levelData.atk_scale)) * dmgMul;
    return trigger(per, calcCycleDps(levelData, realInterval, h(panelAtk), per));
  }
  // 焰狐龙梓兰:刚射 / 飞翔瞪射 / 龙之箭
  if (op.id === 'char_1048_orchd2') {
    if (skillIndex === 0) {
      // 刚射:有充能即立刻释放 → 不会积攒到"刚连射",只按基础档 4 支 × atk_scale_1(用户 2026-09-17 订正)
      const per = h(panelAtk * levelData.atk_scale_1) * 4;
      return trigger(per, calcCycleDps(levelData, realInterval, h(panelAtk), per));
    }
    if (skillIndex === 1) {
      // 飞翔瞪射:3 次齐射(3/4/5 支 × atk_scale_loop)+ 降落一次 atk_scale_end
      const loop = h(panelAtk * levelData['attack@atk_scale_loop']);
      const end = h(panelAtk * levelData['attack@atk_scale_end']);
      const total = loop * 12 + end;
      const dur = skillDuration > 0 ? skillDuration : 0;
      return {
        skillDps: dur > 0 ? total / dur : 0, skillTotalDamage: total, cycleDps: null, normalDps: normDps,
        skillHps: null, normalHps: null, totalHeal: null, damageType: 'physical', realInterval,
        dmgTypes: { physical: { skillDps: dur > 0 ? total / dur : 0, skillTotalDamage: total, cycleDps: null } },
      };
    }
    if (skillIndex === 2) {
      // 龙之箭:默认敌人仅受到一次伤害 → 物理一次 + 法术一次
      const phys = h(panelAtk * levelData.atk_scale);
      const arts = ar(panelAtk * levelData.atk_scale_magic);
      const total = phys + arts;
      return trigger(total, calcCycleDps(levelData, realInterval, h(panelAtk), total), phys, arts);
    }
  }
  // 鸿雪 S2 点题:立即对前方进行 3 次攻击(每次 atk_scale)
  if (op.id === 'char_4055_bgsnow' && skillIndex === 1) {
    const total = h(panelAtk * levelData.atk_scale) * 3;
    return trigger(total, calcCycleDps(levelData, realInterval, h(panelAtk), total));
  }
  // 酸糖:单次伤害下限(滑射技巧基础档)
  if (op.id === 'char_366_acdrop') {
    const fl = (atk) => Math.max(h(atk), acdropMinDamage(op, slotData, atk));
    if (skillIndex === 0) return one(fl(panelAtk));
    if (skillIndex === 1) return one(fl(panelAtk * atkUp) * 2);   // 2 连射
  }
  return generic();
}

// 模组 te 攻速"放行"表:本体无攻速天赋、但模组 te 给的是无条件常驻攻速的干员
// (蓝毒 X「标准比色卡」L1 起 te attack_speed 8,name=null 无条件条目——用户口径 2026-09-17:模组新增的加成要算)
const MODULE_TE_SPD_ALLOW = {
  'char_129_bluep': true,
};

const MODULE_TE_SPD_SKIP = {
  'char_103_angel': true,   // Y「快速弹匣」te 的 attack_speed 12 是平值(叠层的是无视防御),不可 ×max_stack_cnt(否则 300)

  'char_291_aglina': true,   // X「实验用反重力模块」加速力场 te(attack_speed 3/5)是「自身攻击范围内友方额外」,自身不计

  'char_4226_veen': true,   // X 模组「在挥刀之前」增强:拥有已储存的攻击能量时攻速+30(本模型无储存能量→不适用)
};

// 固定法抗穿透(无视目标 X 法抗,法术伤害结算时敌人法抗直减;史尔特尔「熔火」12~22)
const TALENT_RES_PEN_DRIVERS = {
  'char_377_gdglow': { talentIndex: 1, key: 'magic_resist_penetrate_fixed' },  // 精准导流:自身与浮游单元无视15(潜5 18)法抗
  'char_350_surtr': { talentIndex: 0, key: 'magic_resist_penetrate_fixed' },  // 熔火:精1 无视12/14(潜5)→精2 20/22(潜5),全法伤结算生效
  'char_4229_aphris': { talentIndex: 1, key: 'magic_resist_penetrate_fixed' },  // 取样优化:攻击范围内友军(含自身)攻击时无视10(潜6 13)法抗
};
// 固定物理穿防天赋表(敌人被 X 阻挡时攻击无视其 N 防御):伺夜「狼群天性」——单目标模型默认战术点狼群在场阻挡
// (阻挡条件默认成立同满层先例);Y模组「时光不再」同名增强 te 覆盖(Y3: 225/250)
const TALENT_DEF_PEN_FIXED = {
  'char_103_angel': 0,   // 能天使 Y「快速弹匣」:连续造成伤害逐渐无视防御,叠满 = max_stack_cnt 25 × def_penetrate_fixed(6/10) = 150/250(攻击次数型,用户口径按叠满)

  'char_279_excu': 0,   // 送葬人「终结改装」:攻击时无视目标防御力(E2潜0=160;模组 te 覆盖 190~225)
  'char_427_vigil': 1,   // 伺夜 狼群天性(天赋2):无视 175(精2 潜5 200)
};
// 天赋级"敌方减抗"乘数表(键值 = 比例,如 -0.4 表示范围内敌军法抗 -40%):作用于自身全部法伤结算,含常态行
const TALENT_MR_DEBUFF_MUL = {
  'char_134_ifrit': { talentIndex: 0, key: 'magic_resistance' },  // 精神融解:攻击范围内敌军法抗 -15%(E0)/-27%(E1)/-40%(E2)
};
function calcTalentMrDebuffMul(op, slotData) {
  const cfg = TALENT_MR_DEBUFF_MUL[op.id];
  if (!cfg) return 1;
  const talent = (op.talents || [])[cfg.talentIndex];
  if (!talent) return 1;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, cfg.talentIndex, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= slotData.elite && candPot <= (slotData.potentialRank || 0)) {
      const v = cand.blackboard && typeof cand.blackboard[cfg.key] === 'number' ? cand.blackboard[cfg.key] : 0;
      if (v < best) best = v;
    }
  }
  return best < 0 && best > -1 ? 1 + best : 1;
}

// 技能期攻速 buff(模组给部署触发天赋附加的限时攻速窗口):寻澜 X「佳肴」独自远走增强——部署时回费且
// 攻速+X 持续 10s(attack_speed_up_duration)。level → {atkSpeed, duration};engine 在技能期窗口内分两段模拟。
const SKILL_MODULE_SPD_BUFF = {
  'char_4052_surfer': { 2: { atkSpeed: 10, duration: 10 }, 3: { atkSpeed: 15, duration: 10 } },  // 寻澜 X 佳肴 L2/L3
};

// 天赋百分比无视防御(id → 天赋索引;读 bb.def_penetrate × bb.max_stack_cnt,即叠满档)
const TALENT_DEF_IGNORE_PCT = {
  'char_2012_typhon': 0,   // 提丰「锐如兽牙」:连续攻击逐渐无视防御,叠满 = max_stack_cnt × def_penetrate(E2潜0 = 5×10% = 50%,用户口径"按最高计算")
  // 打字机「弱点速记」:自身攻击使目标防御 -18%(默认不在鸿雪周围四格 → 取基础档,用户口径 2026-09-17)
  'token_10026_bgsnow_subbow': { talentIndex: 1, key: 'bgsnow_token[def_down]_1.def' },
};
function calcTalentDefIgnorePct(op, slotData) {
  const cfg = TALENT_DEF_IGNORE_PCT[op.id];
  if (cfg === undefined) return 0;
  const idx = typeof cfg === 'number' ? cfg : cfg.talentIndex;
  const key = typeof cfg === 'number' ? 'def_penetrate' : (cfg.key || 'def_penetrate');
  const talent = (op.talents || [])[idx];
  if (!talent) return 0;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, idx, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const bb = cand.blackboard || {};
      if (typeof bb[key] === 'number') {
        const stacks = typeof bb.max_stack_cnt === 'number' ? bb.max_stack_cnt : 1;
        if (Math.abs(bb[key]) * stacks > best) best = Math.abs(bb[key]) * stacks;
      }
    }
  }
  return Math.min(1, best);
}

// 查固定物理穿防:返回最高满足档 def_penetrate_fixed(0 表示无或未解锁)
function calcTalentDefPenFixed(op, slotData) {
  const idx = TALENT_DEF_PEN_FIXED[op.id];
  if (idx === undefined) return 0;
  const talent = (op.talents || [])[idx];
  if (!talent) return 0;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, idx, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const bb = cand.blackboard || {};
      const v = typeof bb.def_penetrate_fixed === 'number' ? bb.def_penetrate_fixed : 0;
      const stacks = typeof bb.max_stack_cnt === 'number' ? bb.max_stack_cnt : 1;   // 攻击次数型叠层 → 按叠满计(用户口径 2026-09-17)
      if (v * stacks > best) best = v * stacks;
    }
  }
  return best;
}

// 偷取防御稳态(伺夜 Y 模组「时光不再」:攻击被狼群阻挡敌人时偷取其防御,逐击 15/20 至目标减防上限)。
// 用户口径:站场常态按叠满算 → 目标防御最终减 vigil_def_max(100);读取模组 te 中 name=null 的 vigil_def 条目。
function calcTalentDefStealSteady(op, slotData) {
  const lv = getModuleLevelData(op, slotData);
  if (!lv || !Array.isArray(lv.talentEnhance)) return 0;
  let best = 0;
  for (const c of lv.talentEnhance) {
    if (!c || c.name !== null) continue;
    const v = c.blackboard && typeof c.blackboard.vigil_def_max === 'number' ? c.blackboard.vigil_def_max : 0;
    if (v > best) best = v;
  }
  return best;
}

// 查固定法抗穿透值(0 表示无或未解锁)
function calcTalentResPen(op, slotData) {
  const cfg = TALENT_RES_PEN_DRIVERS[op.id];
  if (!cfg) return 0;
  const talent = (op.talents || [])[cfg.talentIndex];
  if (!talent) return 0;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, cfg.talentIndex, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const v = cand.blackboard && typeof cand.blackboard[cfg.key] === 'number' ? cand.blackboard[cfg.key] : 0;
      if (v > best) best = v;
    }
  }
  return best;
}

// 弱点伤害开关:天赋将造成的物理/法术伤害变为弱点伤害(物理/法伤各结算一次取高者,类型随赢家)。
// 解锁条件与 TALENT_ATK_DRIVERS 同(精1 起),故用 calcTalentAtkBonus > 0 判定。
const WEAKNESS_DAMAGE = {
  'char_1050_chen3': true,  // 赤刃明霄陈「形意洞照」:精1 起攻击变为弱点伤害;精0 无此天赋 → 全法术
};

// 技能期伤害强制真实:数据缺 trueDamage 标记的技能(阿米娅 S3 奇美拉:攻击造成真实伤害,数据仅 atk/max_hp 键)
const SKILL_TRUE_DAMAGE = {
  'char_002_amiya': [2],  // 阿米娅(术师) S3 奇美拉:30s 攻击力+X% 且伤害变真伤(自损/生命上限提升生存向不计)
  // ---- 特种·钩索师(hookmaster) ----
  'char_173_slchan': [1],  // 崖心 S2 束缚链:造成相当于攻击力 X% 的真实伤害(数据仅 atk_scale/force/max_target)
};

// 技能开启期普攻切物理(特米米「荒野法术」:技能开启时攻击范围缩小、攻击变物理且只打地面——单目标模型范围不计)
const SKILL_PHYSICAL_OVERRIDES = {
  'char_411_tomimi': [0, 1],  // 特米米 S1 部族技艺/S2 嘉维尔保护方案:开启即物理
};

// 技能开启期才生效的天赋攻击加成(特米米「荒野法术」atk+50/75/100% 随精化,常态无加成不能走 TALENT_ATK_DRIVERS 常驻通道)
const SKILL_TALENT_ATK_ONLY = {
  'char_411_tomimi': 0,
  'char_4229_aphris': 0,  // 谬因「链路协议」:中继器在场时自身攻击力+15%(E1)/+25%(E2) → 用户口径"按技能期才生效"算(X 模组 te 覆盖至 30%/35%)
};

// 每击按敌方防御附加法伤天赋(刻俄柏「剥壳」):攻击时对目标额外造成相当于其防御力 X% 的法术伤害——
// 100% 无条件触发(目标防御为 0 时无伤害),不吃攻击力/技能倍率,吃目标法抗;每次攻击动作附加一次(常态/技能期同)。
const TALENT_DEF_HIT_ARTS = {
  'char_2013_cerber': 0,  // 刻俄柏:精1 25%(潜5 +4%)→精2 40%(潜5 +4%)
};
// 查每击附加法伤配置(剥壳族):基础档来自天赋 atk_scale;装备带 basic_atk_scale/max_atk_scale/delta_atk_scale 的
// X 效果模组(如刻俄柏「很干的面包」L2+)后按模组档覆盖——连续攻击同一目标逐击递增(单目标模型=恒同一目标)。
// 返回 { scale }(无递增)或 { base, basic, max, delta }(模组递增);null = 无此天赋或未解锁。
function calcDefHitArtsCfg(op, slotData) {
  const idx = TALENT_DEF_HIT_ARTS[op.id];
  if (idx === undefined) return null;
  const talent = (op.talents || [])[idx];
  if (!talent) return null;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let base = 0;
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const v = cand.blackboard && typeof cand.blackboard.atk_scale === 'number' ? cand.blackboard.atk_scale : 0;
      if (v > base) base = v;
    }
  }
  if (base <= 0) return null;
  // X 效果模组天赋强化(剥壳递增参数)
  const lv = getModuleLevelData(op, slotData);
  let modCfg = null;
  if (lv && lv.talentEnhance) {
    for (const cand of lv.talentEnhance) {
      const candPot = cand.requiredPotentialRank ?? cand.potentialRank ?? 0;
      if (candPot > pot) continue;
      const bb = cand.blackboard || {};
      if (typeof bb.basic_atk_scale === 'number' && typeof bb.max_atk_scale === 'number') {
        if (!modCfg || bb.max_atk_scale > modCfg.max) {
          modCfg = { basic: bb.basic_atk_scale, max: bb.max_atk_scale, delta: typeof bb.delta_atk_scale === 'number' ? bb.delta_atk_scale : 0 };
        }
      }
    }
  }
  return modCfg ? { base, ...modCfg } : { scale: base };
}
// 第 i 击(0 起)的比例:基础档恒定;模组递增档第 1 击=basic,每击 +delta 至 max 封顶
function defHitArtsScaleAt(cfg, i) {
  if (!cfg) return 0;
  if (cfg.scale !== undefined) return cfg.scale;
  return Math.min(cfg.basic + cfg.delta * i, cfg.max);
}
// 逐击附加结算伤害(技能期按攻击序逐击递增)
function defHitArtsAt(op, slotData, i) {
  const cfg = calcDefHitArtsCfg(op, slotData);
  if (!cfg) return 0;
  const def = (state.enemy && typeof state.enemy.def === 'number') ? state.enemy.def : 0;
  return calcArtsDamage(def * defHitArtsScaleAt(cfg, i), state.enemy.res ?? 0);
}
// 稳态档(常态/无界/循环展示):基础档恒值;模组递增档取上限(连续攻击长期稳定后)
function defHitArtsMax(op, slotData) {
  const cfg = calcDefHitArtsCfg(op, slotData);
  if (!cfg) return 0;
  const def = (state.enemy && typeof state.enemy.def === 'number') ? state.enemy.def : 0;
  return calcArtsDamage(def * defHitArtsScaleAt(cfg, 999), state.enemy.res ?? 0);
}

// 命中减抗天赋(夜烟「黑色迷雾」:攻击命中使目标 1s 法抗-X%;命中效果先于命中结算(用户口径),
// 故每次攻击的伤害都吃减抗后的法抗 → 等效常驻乘算;间隔>减抗时长也无碍)
const TALENT_HIT_MR_DEBUFF = {
  'char_141_nights': 0,  // 夜烟:精1 -10%(潜4 -12%)→精2 -13%(潜4 -15%)
};
// 查命中减抗乘数:返回最高满足档 (1+magic_resistance)(1 表示无或未解锁)
function calcTalentHitMrMul(op, slotData) {
  const idx = TALENT_HIT_MR_DEBUFF[op.id];
  if (idx === undefined) return 1;
  const talent = (op.talents || [])[idx];
  if (!talent) return 1;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let best = 0;  // 最负值(减抗最多)
  for (const cand of talentCandSource(op, slotData, idx, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const v = cand.blackboard && typeof cand.blackboard.magic_resistance === 'number' ? cand.blackboard.magic_resistance : 0;
      if (v < best) best = v;
    }
  }
  return best < 0 ? 1 + best : 1;
}
// 空中法脆(雪绒「冰原生存」:攻击范围内所有空中单位受法伤 +10~22%,自身坠雪使目标浮空必触发 → 跳伤 ×damage_scale)
function calcAirFragileMul(op, slotData) {
  const idx = 0;  // 雪绒第一天赋(冰原生存:攻击范围空中单位法脆)
  const talent = (op.talents || [])[idx];
  if (!talent) return 1;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let best = 0;
  // talentCandSource:Y 模组同名增强(damage_scale 1.2→1.25/1.3)覆盖基础档
  for (const cand of talentCandSource(op, slotData, idx, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const v = cand.blackboard && typeof cand.blackboard.damage_scale === 'number' ? cand.blackboard.damage_scale : 0;
      if (v > best) best = v;
    }
  }
  return best > 0 ? best : 1;
}
// 查技能开启期才生效的天赋攻击加成(特米米「荒野法术」atk+50/75/100% 随精英化,p0 即解锁):
// 独立读 SKILL_TALENT_ATK_ONLY 表指向的天赋(不能走 TALENT_ATK_DRIVERS,否则常态也吃)
function calcSkillTalentAtkOnly(op, slotData) {
  const idx = SKILL_TALENT_ATK_ONLY[op.id];
  if (idx === undefined) return 0;
  const talent = (op.talents || [])[idx];
  if (!talent) return 0;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let best = 0;
  // talentCandSource:Y 模组同名荒野法术增强(atk +100%→+105/110% 或 +125/130%)覆盖基础档
  for (const cand of talentCandSource(op, slotData, idx, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const v = cand.blackboard && typeof cand.blackboard.atk === 'number' ? cand.blackboard.atk : 0;
      if (v > best) best = v;
    }
  }
  return best;
}

// 常驻每秒生命回复天赋表(全场光环自身必吃):桃金娘「浮光跃金」在场所有先锋每秒回血(E2 25/s 潜5 28/s,自回不吃治疗加成)
const TALENT_HPS_REGEN = {
  'char_151_myrtle': 0,  // 桃金娘 浮光跃金:自身为先锋必吃(同炎息光环先例)
};
// 偷取攻击力天赋(伊内丝「影织」):对每个敌人首次造成伤害后偷取(束缚控制不计),单目标持续输出首次命中即触发→全程生效。
// 偷取值直接加在基础攻击(参与技能倍率乘算),但 calcPanelStats 白值不显示(用户口径:直接加但不显示白值)。
const TALENT_STEAL_ATK = {
  'char_4087_ines': 0,  // 伊内丝 影织:偷取 50(E1)→90(E2 潜4 100),持续至目标被击倒/离场
};
// 查偷取攻击力:返回最高满足档 bb.steal_atk(0 表示无或未解锁)
function calcTalentStealAtk(op, slotData) {
  const idx = TALENT_STEAL_ATK[op.id];
  if (idx === undefined) return 0;
  const talent = (op.talents || [])[idx];
  if (!talent) return 0;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, idx, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const v = cand.blackboard && typeof cand.blackboard.steal_atk === 'number' ? cand.blackboard.steal_atk : 0;
      if (v > best) best = v;
    }
  }
  return best;
}
// 查常驻每秒自回:返回最高满足档 hp_recovery_per_sec(0 表示无此天赋或未解锁)
function calcTalentHps(op, slotData) {
  const idx = TALENT_HPS_REGEN[op.id];
  if (idx === undefined) return 0;
  const talent = (op.talents || [])[idx];
  if (!talent) return 0;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, idx, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const v = cand.blackboard && typeof cand.blackboard.hp_recovery_per_sec === 'number' ? cand.blackboard.hp_recovery_per_sec : 0;
      if (v > best) best = v;
    }
  }
  return best;
}
// 常驻固定防御+百分比自回天赋(满层口径):凛御银灰「雪境先驱」在场 15s 后防御与回血翻倍
// → 直接取满足档×2(E2 潜0 def+60/回1.5% → 满层 def+120/回3%;潜4 def+80/回2% → def+160/回4%)。
// def 固定值加面板白值(伤害计算不用防御);回血按每秒最大生命比例注入常态 HPS。
const TALENT_FLAT_DEF_PCT_REGEN = {
  'char_1045_svash2': { talentIndex: 1, defKey: 'def', ratioKey: 'hp_recovery_per_sec_by_max_hp_ratio', scale: 2 },
  // 绮良「离群独守」:每秒回复 2% 生命(仅固定值比例、无防御项;按基础档,周围 8 格无友方的 3.5% 档不计)
  'char_478_kirara': { talentIndex: 0, ratioKey: 'hp_recovery_per_sec_by_max_hp_ratio' },
};
function calcTalentFlatDefPctRegen(op, slotData) {
  const cfg = TALENT_FLAT_DEF_PCT_REGEN[op.id];
  if (!cfg) return null;
  const talent = (op.talents || [])[cfg.talentIndex];
  if (!talent) return null;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let flatDef = 0, ratio = 0;
  for (const cand of talentCandSource(op, slotData, cfg.talentIndex, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const d = (cfg.defKey && cand.blackboard && typeof cand.blackboard[cfg.defKey] === 'number') ? cand.blackboard[cfg.defKey] : 0;
      const r = cand.blackboard && typeof cand.blackboard[cfg.ratioKey] === 'number' ? cand.blackboard[cfg.ratioKey] : 0;
      if (d > flatDef) flatDef = d;
      if (r > ratio) ratio = r;
    }
  }
  if (flatDef <= 0 && ratio <= 0) return null;
  return { flatDef: flatDef * (cfg.scale || 1), ratio: ratio * (cfg.scale || 1) };
}

// 查驱动表,返回常驻攻速天赋的攻速加算值(0 表示无此天赋或未解锁)。
function calcTalentAttackSpeed(op, slotData) {
  const cfg = TALENT_SPD_DRIVERS[op.id];
  if (cfg === undefined) return 0;
  // 值为天赋索引(读 bb.attack_speed)或 {talentIndex, key}(bb 为前缀别名键,如琴柳 sleach_t_1[ally].attack_speed)
  const talentIndex = typeof cfg === 'number' ? cfg : cfg.talentIndex;
  const bbKey = typeof cfg === 'number' ? 'attack_speed' : (cfg.key || 'attack_speed');
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 0;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, talentIndex, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const aspd = cand.blackboard && typeof cand.blackboard[bbKey] === 'number' ? cand.blackboard[bbKey] : 0;
      // 叠层攻速天赋(星极「天体仪」每层+3/5、最多5层):按满层等效常驻(同塞雷娅 HP/DEF 叠层口径)
      const stack = (cand.blackboard && typeof cand.blackboard.max_stack_cnt === 'number' && !TALENT_SPD_NO_STACK[op.id]) ? cand.blackboard.max_stack_cnt : 1;
      if (aspd * stack > best) best = aspd * stack;
    }
  }
  return best;
}

// 技能期才生效的天赋攻速额外档(读 talentCandSource,故模组 te 的 [skill] 键同样生效)
function calcTalentSpdSkillOnly(op, slotData) {
  const cfg = TALENT_SPD_SKILL_ONLY[op.id];
  if (!cfg) return 0;
  const talent = (op.talents || [])[cfg.talentIndex];
  if (!talent) return 0;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, cfg.talentIndex, talent.candidates)) {
    const bb = cand.blackboard || {};
    if (typeof bb[cfg.key] === 'number' && bb[cfg.key] > best) best = bb[cfg.key];
  }
  return best;
}

// 当前模组的指定等级数据(含 attributeBlackboard / talentEnhance);无模组或等级不存在返回 null。
function getModuleLevelData(op, slotData) {
  const m = slotData.module;
  if (!m) return null;
  const mod = (op.modules || []).find(x => x.id === m.moduleId);
  if (!mod) return null;
  return (mod.levels || []).find(l => l.level === m.moduleLevel) || null;
}

/**
 * 模组天赋同名增强查询(覆盖层):效果模组(ADVANCED)档内 talentEnhance 存在与基础天赋同名
 * (以 candidates[0].name 为准)的强化候选时,装备该模组即天赋整体被模组改写(数值替换/参数更新)。
 * 返回按潜能匹配的最高档 blackboard;无同名增强/未装备模组返回 null。phase 无意义(模组本身有解锁门槛)。
 */
function getTalentEnhBB(op, slotData, talentIndex) {
  const talent = (op.talents || [])[talentIndex];
  // 天赋名集合取全部候选(同一天赋可随精化改名:临光 t0 精1「医疗效果大提升」→精2「天马光环」,
  // 模组增强名对应精英化后的名字,只取 candidates[0].name 会漏接)
  const tNames = new Set((talent && talent.candidates || []).map(c => c && c.name).filter(Boolean));
  if (tNames.size === 0) return null;
  if ((MODULE_TE_IGNORE[op.id] || []).includes(talentIndex)) return null;   // 该天赋的 te 与自身无关(如安洁莉娜 X 加速力场)
  const lv = getModuleLevelData(op, slotData);
  if (!lv || !Array.isArray(lv.talentEnhance) || lv.talentEnhance.length === 0) return null;
  const pot = slotData.potentialRank || 0;
  let bestPot = -1, best = null;
  const allowNullTe = (MODULE_TE_NULL_MERGE[op.id] || []).includes(talentIndex);
  for (const c of lv.talentEnhance) {
    if (!c) continue;
    if (!tNames.has(c.name) && !(allowNullTe && c.name === null)) continue;
    const cPot = c.requiredPotentialRank ?? c.potentialRank ?? 0;
    if (cPot > pot || cPot < bestPot) continue;
    if (cPot > bestPot) { bestPot = cPot; best = { ...(c.blackboard || {}) }; }   // 更高潜能档:重置
    else best = { ...(best || {}), ...(c.blackboard || {}) };                     // 同档同名多条:合并(天赋被拆为多条增强)

  }
  if (!best) return null;
  if ((MODULE_TE_TALENT_MERGE[op.id] || []).includes(talentIndex)) {
    let base = null, basePot = -1;
    for (const cand of (talent.candidates || [])) {
      const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
      if (cand.phase <= slotData.elite && candPot <= pot && candPot >= basePot) { basePot = candPot; base = cand.blackboard || {}; }
    }
    return { ...(base || {}), ...best };
  }
  return best;
}

// 候选源包装:增强档以 {blackboard, phase:0, level:1, potentialRank:0} 参与既有过滤(phase<=elite 恒真)
function talentCandSource(op, slotData, talentIndex, cands) {
  const enh = getTalentEnhBB(op, slotData, talentIndex);
  return enh ? [{ blackboard: enh, phase: 0, level: 1, potentialRank: 0 }] : cands;
}

/**
 * 模组对天赋的强化(部分干员效果模组等级≥2 时更新天赋数值/附加效果)。
 * 返回 { attackSpeed: null|number, extraAtkMul: number }:
 * - attackSpeed:若强化候选覆盖了攻速类天赋(如闪灵X模组 L2 法典 10→15),取按潜能匹配的最大值;否则 null(走基础天赋)。
 * - extraAtkMul:强化候选里附加的常态攻击乘算(如闪灵X模组「装备技能2时攻击+X%」);
 *   判定放调用侧(该乘算只对特定技能组合生效)。
 */
function calcModuleTalentEnhance(op, slotData) {
  const out = { attackSpeed: null, extraAtkMul: 0, healScale: 1 };
  const lv = getModuleLevelData(op, slotData);
  if (!lv || !lv.talentEnhance || lv.talentEnhance.length === 0) return out;
  const pot = slotData.potentialRank || 0;
  let bestAspd = null;
  let extraAtk = 0;
  let healScale = 1;
  for (const cand of lv.talentEnhance) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (candPot > pot) continue;
    const bb = cand.blackboard || {};
    // 限时攻速窗口(带 attack_speed_up_duration 的部署触发型,如寻澜 X「独自远走」增强:部署时攻速+X 持续 10s)
    // 不是常驻攻速强化,不参与 attackSpeed 拾取——由 SKILL_MODULE_SPD_BUFF 专用通道在技能窗口内分两段模拟。
    const isTimedAspd = typeof bb.attack_speed_up_duration === 'number' && bb.attack_speed_up_duration > 0;
    // 仅常驻攻速天赋入表干员(闪灵法典/琴柳不退之旗/晓歌万全等)允许攻速拾取;表外干员的 te 攻速为条件/触发型(冬时疾笔撰录/录武官学成于聚)不计
    const spdOk = TALENT_SPD_DRIVERS[op.id] !== undefined || (MODULE_TE_SPD_ALLOW[op.id] || false) === true;
    const spdTeSkip = (MODULE_TE_SPD_SKIP[op.id] || false) === true;
    const aspStack = (MODULE_TE_ASPD_STACK[op.id] === true && typeof bb.max_stack_cnt === 'number') ? bb.max_stack_cnt : 1;
    if (spdOk && !spdTeSkip && typeof bb.attack_speed === 'number' && !isTimedAspd && (bestAspd === null || bb.attack_speed * aspStack > bestAspd)) bestAspd = bb.attack_speed * aspStack;
    if (typeof bb.atk === 'number' && bb.atk > extraAtk) extraAtk = bb.atk;
    // 天赋强化的治疗倍率(如夜莺 X 模组强化「白恶魔的庇护」:范围内友方受疗 +3%/+5%)。
    // 治疗目标必在攻击范围内才能被治疗,故该光环直接放大自身治疗数值。
    // 注意:自身治疗天赋入表干员(临光/森西/瑰盐/刺玫 TALENT_HEAL_DRIVERS)的 te.heal_scale
    // 已由 calcTalentHealScale(talentCandSource 覆盖)消费,此处排除避免双重乘算(刺玫 X3 曾 1.23²);
    // MODULE_SKILL_HEAL_MUL 干员(清流 Y 细水长流)的 heal_scale 是技能治疗提升,由 calcModuleSkillHealMul
    // 专用消费(仅技能期),排除避免误当全治疗倍率拾取(清流曾普攻治疗也被 ×1.2)。
    if (typeof bb.heal_scale === 'number' && bb.heal_scale > healScale && TALENT_HEAL_DRIVERS[op.id] === undefined && MODULE_SKILL_HEAL_MUL[op.id] === undefined) healScale = bb.heal_scale;
  }
  out.attackSpeed = bestAspd;
  out.extraAtkMul = extraAtk;
  out.healScale = healScale;
  return out;
}

/**
 * 特性数值读取(咒愈师:攻击造成法伤并治疗 scale 倍伤害量的生命)。
 * 基础值在干员 trait.blackboard.scale(如咒愈师 0.5);装备效果模组后由模组 TRAIT
 * 强化覆盖(overrideTraitDataBundle,如咒愈师模组 L1 起 scale 0.5→0.6)。
 * 返回 null 表示干员无此特性变量(调用方回退默认值)。
 */
function calcTraitScale(op, slotData, key = 'scale') {
  const base = (op.trait && op.trait.blackboard && typeof op.trait.blackboard[key] === 'number')
    ? op.trait.blackboard[key] : null;
  const lv = getModuleLevelData(op, slotData);
  if (lv && lv.traitEnhance) {
    for (const cand of lv.traitEnhance) {
      const s = cand.blackboard && cand.blackboard[key];
      if (typeof s === 'number') return s;
    }
  }
  return base;
}

// 咒愈师法脆增伤驱动(必触发 debuff,如濯尘芙蓉「朝开夕落」:攻击使敌人法术脆弱,自身伤害 ×damage_scale)。
// 档位:精1 1.06/1.08(潜4)、精2 1.12/1.14(潜4);X模组「结晶胸花」L2/L3 天赋强化覆盖至 1.17~1.22。
// talentIndex 参数支持显式指定天赋(焰影苇草S3 灼痕必触发时由调用方传 0 查灼痕档)。
const INCANTATION_FRAGILE_DRIVERS = {
  'char_1024_hbisc2': 0,   // 濯尘芙蓉「朝开夕落」:常驻必触发
};

function calcMagicFragileMul(op, slotData, talentIndex = INCANTATION_FRAGILE_DRIVERS[op.id]) {
  if (talentIndex === undefined) return 1;
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 1;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let mul = null;
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const ds = cand.blackboard && typeof cand.blackboard.damage_scale === 'number' ? cand.blackboard.damage_scale : 0;
      if (ds > 0 && (mul === null || ds > mul)) mul = ds;
    }
  }
  const lv = getModuleLevelData(op, slotData);
  if (lv && lv.talentEnhance) {
    for (const cand of lv.talentEnhance) {
      const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
      if (candPot > pot) continue;
      const ds = cand.blackboard && typeof cand.blackboard.damage_scale === 'number' ? cand.blackboard.damage_scale : 0;
      if (ds > 0 && (mul === null || ds > mul)) mul = ds;
    }
  }
  return mul === null ? 1 : mul;
}

// 瑕光「仁慈」:攻击沉睡目标时攻击力提升至 atk_scale 倍(技能期必睡场景如 S2 启用)。
// 返回满足当前精化/潜能的最高倍率(无 → 1)。
function calcSleepAtkMul(op, slotData) {
  const talent = (op.talents || [])[1];
  if (!talent) return 1;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let mul = null;
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const v = cand.blackboard && typeof cand.blackboard.atk_scale === 'number' ? cand.blackboard.atk_scale : 0;
      if (v > 0 && (mul === null || v > mul)) mul = v;
    }
  }
  return mul === null ? 1 : mul;
}

// ===== 常驻伤害乘区天赋驱动（通用，非白值加成：物理/法术/真伤一律乘，如森蚺「勇冠三军」满血时攻击造成 115% 伤害）=====
// 值：干员 id → { talentIndex, key }（blackboard 中伤害倍率所在键，各干员键名不一：damage_scale/atk_scale…）
const TALENT_DMG_MUL_DRIVERS = {
  'char_143_ghost': { talentIndex: 0, key: 'damage_scale', moduleTe: true },   // 幽灵鲨 X 模组「溶于血的经验」:额外伤害倍率(本体无该键 → 1 倍)
  'char_416_zumama': { talentIndex: 0, key: 'atk_scale' },  // 森蚺「勇冠三军」：hp>50% 时攻击伤害 ×1.15/1.17（默认满血必触发；≤50% 的庇护向不计）
  // 薇薇安娜「燃烛施明」:法术伤害加成 additive(damage_scale_m 0.05~0.09),攻击范围内有精英/领袖敌人时 super_scale 翻倍
  // (damage_resistance_pm 受击减伤为承伤向不计)——superGrades 按 state.enemy.grade 判定
  'char_4098_vvana': { talentIndex: 0, key: 'damage_scale_m', additive: true, superKey: 'super_scale', superGrades: ['elite', 'leader'] },
  'char_4218_aigis': { talentIndex: 1, key: 'damage_scale' },  // 埃癸斯「反暗影特殊压制兵装」:造成物理伤害 ×1.05~1.10(模组 te 提到 1.13~1.17);受击减伤为承伤向不计
  'char_4088_hodrer': { talentIndex: 1, key: 'damage_scale', moduleTe: true },  // 赫德雷「余火之氅」X 模组「新的生活」:造成的物理伤害提升6%/10%(无条件,伤害乘区);Y 模组「笔迹」特性追加的 110% 属「对被阻挡的敌人」条件类不计
  // ---- 辅助·凝滞师(slower) ----
  'char_358_lisa': { talentIndex: 1, key: 'damage_scale', moduleTe: true },                       // 铃兰「画地为牢」:攻击范围内被停顿的敌人受 20% 脆弱 → 自身伤害 ×1.2(Y 模组 1.21/1.22)
  'char_1047_halo2': { talentIndex: 1, key: 'halo2_t_1[weak].damage_scale_max' },                 // 溯光星源「能源解析」:脆弱默认为最高层(14%;潜4 16%) → ×1.14
  // ---- 辅助·削弱者(underminer) ----
  // 灵知「坚冰」:「攻击造成1秒寒冷;范围内寒冷的敌人受到脆弱(冻结则脆弱×2)」。用户口径(2026-09-17):寒冷/冻结都是先结算状态再结算伤害,
  // 灵知所有攻击都按此逻辑 → 自身每次攻击(含常态普攻)落点目标必已处于寒冷(本次攻击自己刚叠上的 1 层) → 常态吃寒冷脆弱 ×damage_scale_cold。
  // 冻结档(damage_scale_freeze)在冻结场景(S1 二连击第二下 / S2 蓄力 / S3 第2击起)由 UNDERMINER_SPECIAL 分支用 gnosisFrozenFragileMul 叠加。
  'char_206_gnosis': { talentIndex: 0, key: 'damage_scale_cold' },
};
// 返回满足当前精化/潜能的最高伤害乘子（无 → 1）
// 领主(近卫)特性:攻击默认为远程攻击,攻击力按 80% 计算(用户 2026-09-17 口径)。
// 下列技能描述含"远程攻击不再降低攻击力",技能期按 100% 攻击力;其余技能与常态按 80%。
const LORD_REMOTE_MUL = 0.8;
const LORD_NO_DOWN = {
  'char_193_frostl': { 0: true },            // 霜叶 S1 寒霜枪刃
  'char_294_ayer': { 0: true, 1: true },     // 断崖 S1 多导向散射弹丸 / S2 浮游刃启动
  'char_140_whitew': { 1: true },            // 拉普兰德 S2 狼魂
  'char_172_svrash': { 0: true, 2: true },   // 银灰 S1 强力击γ / S3 真银斩
  'char_293_thorns': { 2: true },            // 棘刺 S3 至高之术
  'char_271_spikes': { 1: true },            // 芳汀 S2 致命恶作剧
  'char_4067_lolxh': { 0: true, 1: true },   // 罗小黑 S1 掠光尾影 / S2 碎金为刃
  'char_4082_qiubai': { 0: true, 2: true },  // 仇白 S1 留羽 / S3 问雪(S2 仅起手与结束的伤害不降,分支内单独处理)
  'char_194_leto': { 1: true },              // 烈夏 S2
};
function lordAtkMul(op, skillIndex) {
  if (op.subProfessionId !== 'lord') return 1;
  const set = LORD_NO_DOWN[op.id];
  return (skillIndex >= 0 && set && set[skillIndex]) ? 1 : LORD_REMOTE_MUL;
}
// 读取天赋 blackboard 数值上限(按精化/潜能过滤,兼容模组 te 覆盖)
function lordTalentBb(op, slotData, talentIndex, key) {
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 0;
  let best = 0;
  for (const cand of talentCandSource(op, slotData, talentIndex, talent.candidates)) {
    const pot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= slotData.elite && pot <= (slotData.potentialRank || 0)) {
      const v = (cand.blackboard || {})[key];
      if (typeof v === 'number' && v > best) best = v;
    }
  }
  return best;
}
// 烈夏「快点快点！」:开启技能时自身攻速 +10/13/21/24(E2 潜0 = 21),仅技能期
function lordSkillAspd(op, slotData) {
  if (op.id !== 'char_194_leto') return 0;
  return lordTalentBb(op, slotData, 0, 'attack_speed') || 0;
}
// 棘刺「神经腐蚀」:攻击使目标中毒,3 秒内每秒 125 点法术伤害(默认不取"对远程目标翻倍"档)
function lordThornsDot(op, slotData) {
  if (op.id !== 'char_293_thorns') return 0;
  return lordTalentBb(op, slotData, 0, 'damage[normal]') || 0;
}
function lordThornsDotDps(op, slotData) {
  const v = lordThornsDot(op, slotData);
  const lay = lordTalentBb(op, slotData, 0, 'max_cnt') || 1;   // 「默认叠满」;无模组/模组1级无 max_cnt → 1 层,L2 = 3 层,L3 = 4 层
  return v > 0 ? calcArtsDamage(v * lay, state.enemy?.res || 0) : 0;
}
function calcLordSkill(op, slotData, skillIndex, levelData, ctx, cbase) {
  const { panelAtk, effDef, skillDuration, realInterval, skillRealInterval, skillAtk, generic } = ctx;
  const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
  const res = state.enemy?.res || 0;
  const tmul = calcTalentDmgMul(op, slotData);
  const h = (atk) => calcPhysicalDamage(atk, effDef) * tmul;
  const aa = (atk) => calcArtsDamage(atk, res) * tmul;
  const dot = lordThornsDotDps(op, slotData);
  const nrm = () => (realInterval > 0 ? h(panelAtk * LORD_REMOTE_MUL) / realInterval + dot : null);
  const nAtk = (dur, iv) => (dur > 0 && iv > 0 ? Math.floor(dur / iv + 1e-9) : 0);
  const skill = (dmgType, sTot, sDps, cd, dmgTypes, panel) => ({
    type: 'damage', damageType: dmgType, isToggle: false, isPermanent: false,
    skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd, normalDps: nrm(),
    skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: panel || skillAtk,
    dmgTypes: dmgTypes || { [dmgType]: { skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd } },
  });
  // 棘刺「护身尖刺」:停止攻击,尖刺仅在受击时释放(条件触发)→ 不计输出
  if (op.id === 'char_293_thorns' && skillIndex === 1) return skill('physical', 0, 0, null, {});
  // 棘刺「至高之术」:第二次及以后使用加成翻倍且持续无限(数据在 thorns_s_3[b] 档)
  if (op.id === 'char_293_thorns' && skillIndex === 2) {
    const a2 = levelData['thorns_s_3[b].atk'];
    const s2 = levelData['thorns_s_3[b].attack_speed'];
    const atk = panelAtk * (1 + (typeof a2 === 'number' ? a2 : (levelData.atk || 0)));
    const iv = calcRealInterval(cbase.baseInterval, 100 + cbase.baseAspdBonus + (typeof s2 === 'number' ? s2 : (levelData.attack_speed || 0)));
    const d = h(atk) / iv + dot;
    return skill('physical', 0, d, null, { physical: { skillDps: d, skillTotalDamage: 0, cycleDps: null } }, atk);
  }
  // 仇白「留羽」:束缚结束时对目标与附近敌人造成 260% 攻击力法术伤害(触发型)
  if (op.id === 'char_4082_qiubai' && skillIndex === 0) {
    const per = aa(skillAtk * (levelData.aoe_scale || 0));
    const cd = realInterval > 0 ? calcCycleDps(levelData, realInterval, h(panelAtk * LORD_REMOTE_MUL), per) : null;
    return skill('physical', per, 0, cd, { arts: { skillDps: 0, skillTotalDamage: per, cycleDps: cd } });
  }
  // 仇白「承影」:起手 260% 法术 + 技能期普攻(3 击,攻击力+100%,远程仍降) + 结束时 260% 物理(不降)
  if (op.id === 'char_4082_qiubai' && skillIndex === 1) {
    const full = panelAtk * (1 + (levelData.atk || 0));   // 起手/结束按 100% 攻击力
    const begin = aa(full * (levelData.sword_begin_atk_scale || 0));
    const end = h(full * (levelData.sword_end_atk_scale || 0));
    const mid = nAtk(skillDuration, sIvl) * h(skillAtk);
    const tot = begin + mid + end;
    const cd = realInterval > 0 ? calcCycleDps(levelData, realInterval, h(panelAtk * LORD_REMOTE_MUL), tot) : null;
    return skill('physical', tot, skillDuration > 0 ? tot / skillDuration : 0, cd,
      { physical: { skillDps: (mid + end) / (skillDuration || 1), skillTotalDamage: mid + end, cycleDps: cd }, arts: { skillDps: begin / (skillDuration || 1), skillTotalDamage: begin, cycleDps: null } }, full);
  }
  // 仇白「问雪」:法术(伤害类型变为法术);攻速 +13/次,默认满 6 层 = +78
  if (op.id === 'char_4082_qiubai' && skillIndex === 2) {
    const aspd = (levelData.attack_speed || 0) * (levelData.max_stack_cnt || 1);
    const iv = calcRealInterval(cbase.baseInterval, 100 + cbase.baseAspdBonus + aspd);
    const tot = nAtk(skillDuration, iv) * aa(skillAtk);
    const sDps = skillDuration > 0 ? tot / skillDuration : 0;
    return skill('physical', tot, sDps, null, { arts: { skillDps: sDps, skillTotalDamage: tot, cycleDps: null } });
  }
  // 芳汀「小玩笑」(S1):二连击,每击 135% 攻击力物理
  if (op.id === 'char_271_spikes' && skillIndex === 0) {
    const per = 2 * h(skillAtk * (levelData['attack@atk_scale'] || 1));
    const cd = realInterval > 0 ? calcCycleDps(levelData, realInterval, h(panelAtk * LORD_REMOTE_MUL), per) : null;
    return skill('physical', per, 0, cd, { physical: { skillDps: 0, skillTotalDamage: per, cycleDps: cd } });
  }
  // 芳汀「致命恶作剧」(S2):伤害类型变法术,每击 145%
  if (op.id === 'char_271_spikes' && skillIndex === 1) {
    const tot = nAtk(skillDuration, sIvl) * aa(skillAtk * (levelData['attack@atk_scale'] || 1));
    const sDps = skillDuration > 0 ? tot / skillDuration : 0;
    return skill('physical', tot, sDps, null, { arts: { skillDps: sDps, skillTotalDamage: tot, cycleDps: null } });
  }
  // 丰川祥子「新月的苏醒」:8 个音符依次从 85% 递减到 5%(法术,可充能 2 次 → 触发型)
  if (op.id === 'char_4182_oblvns' && skillIndex === 0) {
    const scales = ['atk_scale', 'atk_scale_2', 'atk_scale_3', 'atk_scale_4', 'atk_scale_5', 'atk_scale_6', 'atk_scale_7', 'atk_scale_8'].map(k => levelData[k]).filter(v => typeof v === 'number');
    const per = scales.reduce((s, v) => s + aa(skillAtk * v), 0);
    const cd = realInterval > 0 ? calcCycleDps(levelData, realInterval, h(panelAtk * LORD_REMOTE_MUL), per) : null;
    return skill('physical', per, 0, cd, { arts: { skillDps: 0, skillTotalDamage: per, cycleDps: cd } });
  }
  // 丰川祥子「残月的余响」:每次攻击同时演奏钢琴(2×190% 物理)与风琴(2×190% 法术)
  if (op.id === 'char_4182_oblvns' && skillIndex === 2) {
    const s = levelData['attack@atk_scale'] || 1;
    const hits = nAtk(skillDuration, sIvl);
    const ph = 2 * h(skillAtk * s) * hits;
    const ar = 2 * aa(skillAtk * s) * hits;
    const tot = ph + ar;
    const sDps = skillDuration > 0 ? tot / skillDuration : 0;
    return skill('physical', tot, sDps, null,
      { physical: { skillDps: skillDuration > 0 ? ph / skillDuration : 0, skillTotalDamage: ph, cycleDps: null }, arts: { skillDps: skillDuration > 0 ? ar / skillDuration : 0, skillTotalDamage: ar, cycleDps: null } });
  }
  // 烈夏:天赋「快点快点！」技能期内自身攻速 +10/13/21/24(E2 潜0 = 21)
  if (op.id === 'char_194_leto') {
    const aspd = lordSkillAspd(op, slotData);
    if (skillIndex === 0 || skillIndex === 1) {
      const extra = skillIndex === 0 ? (levelData.attack_speed || 0) : 0;
      const iv = calcRealInterval(cbase.baseInterval, 100 + cbase.baseAspdBonus + aspd + extra);
      const tot = nAtk(skillDuration, iv) * h(skillAtk);
      return skill('physical', tot, skillDuration > 0 ? tot / skillDuration : 0, null, null, skillAtk);
    }
  }
  // 其余领主技能走通用结算,只额外并入棘刺的毒伤
  const g = generic();
  if (dot > 0) {
    const overDur = skillDuration > 0 ? dot * skillDuration : 0;
    return Object.assign({}, g, {
      skillDps: (g.skillDps || 0) + dot,
      skillTotalDamage: (g.skillTotalDamage || 0) + overDur,
      cycleDps: g.cycleDps == null ? null : g.cycleDps + dot,
      normalDps: nrm(),
      panelAtk: skillAtk,
      realInterval: sIvl,
      dmgTypes: Object.assign({}, g.dmgTypes || {}, { arts: { skillDps: dot, skillTotalDamage: overDur, cycleDps: null } }),
    });
  }
  return Object.assign({}, g, { normalDps: nrm(), panelAtk: skillAtk, realInterval: sIvl });
}
function calcTalentDmgMul(op, slotData) {
  const cfg = TALENT_DMG_MUL_DRIVERS[op.id];
  if (!cfg) return 1;
  const talent = (op.talents || [])[cfg.talentIndex];
  if (!talent) return 1;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let mul = null;
  for (const cand of talentCandSource(op, slotData, cfg.talentIndex, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const bb0 = cand.blackboard || {};
      const bb = (bb0.blackboard && typeof bb0.blackboard === 'object') ? bb0.blackboard : bb0;
      if (typeof bb[cfg.key] !== 'number') continue;   // 本体没有这个键 = 1 倍(用户 2026-09-17:增幅默认 1 倍)
      let v = bb[cfg.key];
      // 条件翻倍:薇薇安娜攻击范围内存在精英/领袖敌人时法伤加成 ×super_scale
      if (v > 0 && cfg.superKey && typeof bb[cfg.superKey] === 'number' && (cfg.superGrades || []).includes(state.enemy?.grade)) {
        v = v * bb[cfg.superKey];
      }
      const use = cfg.additive ? (1 + v) : v;  // additive:键值是加成比例(0.05→×1.05);否则键值即完整乘子
      if (mul === null || use > mul) mul = use;
    }
  }
  // 模组 talentEnhance 兜底:本体天赋没有该键时,直接读当前模组档 te 里的键(模块改写天赋数值的情况)
  const ml = (mul === null && cfg.moduleTe && typeof getModuleLevelData === 'function') ? getModuleLevelData(op, slotData) : null;
  for (const enh of (ml && Array.isArray(ml.talentEnhance) ? ml.talentEnhance : [])) {
    const bbx = enh.blackboard || {};
    if ((enh.requiredPotentialRank ?? 0) > (slotData.potentialRank || 0)) continue;   // 只取当前潜力档
    if (typeof bbx[cfg.key] === 'number') {
      const use = cfg.additive ? (1 + bbx[cfg.key]) : bbx[cfg.key];
      if (mul === null || use > mul) mul = use;
    }
  }
  return mul === null ? 1 : mul;
}

// ===== 不屈者(unyield)及相关通用机制驱动表 =====
// base_attack_time 正小数按加算秒处理(引擎默认 (0,1)=乘算缩短;描述为"间隔增大"的技能例外)
const BAT_ADD_OVERRIDES = {
  'char_433_windft': { 1: true },   // 掠风 S2「此身为源」:攻击间隔增大(1.5+0.5=2.0s;数据给正小数 0.5 按加算秒处理)
  'char_264_f12yin': { 2: true },   // 山 S3「震地碎岩击」:攻击间隔增大(0.78+0.7)
  'char_356_broca': { 1: true },   // 布洛卡 S2「高压电流」:基础攻击间隔 +0.65 秒(加算)
  'char_163_hpsts': { 1: true },   // 火神 S2 武力模式:攻击间隔略微增大(1.6+0.4=2.0s)
  'char_4065_judge': { 2: true },  // 斥罪 S3 披荆斩棘:攻击间隔增大(1.6+0.9=2.5s)
  'char_378_asbest': { 1: true },  // 石棉 S2 火电模式:攻击间隔增大(1.6+0.4=2.0s)
  'char_416_zumama': { 1: true },  // 森蚺 S2 震慑劈砍:攻击间隔略微增大(1.6+0.4=2.0s)
  'char_422_aurora': { 1: true },  // 极光 S2 人工降雪:攻击间隔略微增大(1.6+0.25=1.85s)
  'char_1034_jesca2': { 2: true }, // 涤火杰西卡 S3 饱和迸射:攻击间隔增大(1.2+0.6=1.8s)
  'char_107_liskam': { 1: true },  // 雷蛇 S2 反击电弧:攻击间隔增大(1.2+0.7=1.9s)
  'char_4098_vvana': { 2: true },  // 薇薇安娜 S3 明灭:攻击间隔延长 +0.5(1.25+0.5=1.75s,PRTS 备注:攻击间隔+0.5)
  // ---- 先锋(PIONEER) ----
  'char_362_saga': { 2: true },    // 嵯峨 S3 怒目:攻击间隔稍微增大(1.05+0.5=1.55s)
  'char_112_siege': { 2: true },   // 推进之王 S3 碎颅击:攻击间隔增大(1.05+1=2.05s)
  // ---- 冲锋手 ----
  'char_222_bpipe': { 2: true },   // 风笛 S3 闭膛连发:攻击间隔增大(1.0+0.7=1.7s)
  'char_290_vigna': { 1: true },  // 红豆 S2 槌音:攻击间隔略微增大(1.0+0.5=1.5s)
  // ---- 速射手(fastshot) ----
  'char_133_mm': { 1: true },      // 梅 S2 束缚电击:攻击间隔增大(1.0+0.5=1.5s)
  'char_340_shwaz': { 2: true },   // 黑 S3 战术的终结:攻击间隔略微增大(1.6+0.4=2.0s)
  'char_4006_melnte': { 0: true }, // 玫拉 S1 饱和脉冲:攻击间隔增大(1.6+0.8=2.4s)
  'char_302_glaze': { 1: true },   // 安比尔 S2 雷达定位:攻击间隔略微增大(2.7+0.9=3.6s)
  'char_346_aosta': { 1: true },   // 奥斯塔 S2 影钉:攻击间隔增大(2.3+0.5=2.8s)
  'char_4203_kichi': { 0: true, 1: true }, // 吉星 S1 欢迎您来/S2 吉星高照:攻击间隔增大(2.3+0.5=2.8s / 2.3+0.7=3.0s)
  'char_363_toddi': { 1: true },   // 熔泉 S2 便携破城矢:攻击间隔稍微延长(2.4+0.3=2.7s)
  // ---- 本源术师(primcaster) ----
  'char_1040_blaze2': { 1: true },  // 烛煌 S2 沸血燎原:攻击间隔增大(+0.9 秒 → 2.5s)
  'char_4081_warmy': { 1: true },   // 温米 S2 滔滔热流:攻击间隔增大(+0.9 秒 → 2.5s)
  // ---- 近卫·收割者(reaper) ----
  'char_1032_excu2': { 2: true },   // 圣约送葬人 S3 圣约决裁:攻击间隔略微增大(+0.5 → 1.3+0.5=1.8s)
  // ---- 近卫·解放者(librator) ----
  'char_4064_mlynar': { 1: true },  // 玛恩纳 S2 未宽解的悲哀:攻击间隔延长 +0.3(1.2+0.3=1.5s)
  // ---- 近卫·重剑手(crusher) ----
  'char_4088_hodrer': { 1: true },  // 赫德雷 S2 余烬重荷切换态:攻击间隔略微增大(+0.5 → 2.5+0.5=3.0s)
  // ---- 近卫·撼地者(hammer) ----
  'char_4058_pepe': { 2: true },    // 佩佩 S3 时光震荡:攻击间隔略微增大(+0.2 → 1.8+0.2=2.0s)
};

// base_attack_time 负数按"缩短 X%"解释的白名单(键值 -0.8 = -80% → 间隔 ×(1-0.8)=×0.2)。
// 与 BAT_ADD_OVERRIDES 相反:默认负数=加算秒(白面鸮脑啡肽 -2.1、卡涅利安 S2 -0.8 官方描述"攻击间隔-0.8秒")。
const BAT_PCT_OVERRIDES = {
  'char_469_indigo': { 0: true },   // 深靛 S1 灯塔守卫者:攻击间隔大幅度缩短(-80%) → 3.0×0.2=0.6s
  'char_472_pasngr': { 1: true },   // 异客 S2 聚焦指令:攻击间隔缩短(-40%) → 2.3×0.6=1.38s(同深靛口径,官方文案为百分比)
  // ---- 近卫·收割者(reaper) ----
  'char_421_crow': { 1: true },    // 羽毛笔 S2 收割:攻击间隔缩短(-30% L1~3/-35% L4~6/-40% 专一/-50% 专三) → 专一 1.3×0.6=0.78s
};

// 攻击间隔缩短值"×N"折算表(用户口径 2026-09-17):能天使「过载模式」游戏内技能描述为"攻击间隔一定程度缩短(-0.22)",
// 而原始数据 base_attack_time 只有一半(专三 -0.11),按游戏描述口径 ×2 后参与攻速结算((1-0.22)/1.12 ≈ 0.696s)。
const BAT_SCALE_OVERRIDES = {
  'char_103_angel': { 2: 2 },   // 能天使 S3 过载模式
};

// 蓝毒「神经毒素」固定 DOT 每秒伤害(用户口径 2026-09-17):攻击使目标中毒 3.1s,每秒 poison_damage 点法术伤害,不叠层;
// 持续攻击下等效常驻,常态/技能期各加一份。DPS = poison_damage × (1 - 法抗)。E2 潜0 = 75/秒。
function calcBluePoisonDps(op, slotData, enemy) {
  if (op.id !== 'char_129_bluep') return 0;
  const v = funnelTalentValue(op, slotData, 0, 'poison_damage');
  return v > 0 ? calcArtsDamage(v, enemy?.res ?? 0) : 0;
}

// 间隔"增大(+X%)"型:描述为"攻击间隔增大(+70%/+40%)"的 base_attack_time 正小数,
// 语义=攻击间隔 ×(1+val)(区别于 (0,1) 乘算缩短与 BAT_ADD 加算秒——天火 S2 2.9×1.7=4.93/夕 S3 2.9×1.4=4.06)
const INTERVAL_GROW_OVERRIDES = {
  'char_166_skfire': { 1: true },  // 天火 S2 天坠之火:攻击间隔增大(+70%)
  'char_2015_dusk': { 2: true },   // 夕 S3 写意胜形:攻击间隔增大(+40%)
  // ---- 近卫·佣兵(mercenary) ----
  'char_1049_catap2': { 0: true },  // 雷狼龙S空爆 S1 高压回填斩:攻击间隔增大(+100% → 1.25×2=2.5s)
  // ---- 特种·推击手(pusher) ----
  'char_400_weedy': { 1: true },   // 温蒂 S2 水炮模式:攻击间隔增大(+220% → 1.2×3.2=3.84s)
  // ---- 特种·钩索师(hookmaster) ----
  'char_474_glady': { 1: true },   // 歌蕾蒂娅 S2 缺水的掌握怒海:攻击间隔增大(+50% → 1.8×1.5=2.7s)
};

// 普攻改写注册表(attack@atk_scale 无 attack@times 的持续型,值=技能期每击伤害倍率):
// 天火 S2 天坠之火(间隔+70% 陨石 2.2×atk)/寒檀 S2 女巫之泪(间隔 0.5s 冰凌 0.8×atk)
const ATK_SCALE_REWRITE = {
  'char_166_skfire': [1],
  'char_341_sntlla': [1],
  // ---- 近卫·无畏者(fearless) ----
  'char_154_morgan': [0, 1],  // 摩根 S1 街头好手 / S2 无畏招架:每次攻击造成 170%(专一)攻击力的物理伤害(攻击倍率改写)
  // ---- 秘术师(mystic) ----
  'char_4046_ebnhlz': [0],  // 黑键 S1 渐快急板:间隔×0.17,每次攻击 43%(L7)/50%(专三)
  'char_297_hamoni': [0],   // 和弦 S1 轻巧舞步:间隔×0.2,每次攻击 40/43/50%
  'char_338_iris': [0],     // 爱丽丝 S1 童话守卫者:间隔×0.2,每次攻击 40/43/50%
  'char_4110_delphn': [0],  // 戴菲恩 S1「贯注」:间隔×0.2,每次攻击 40/43/50%
  'char_469_indigo': [0],   // 深靛 S1 灯塔守卫者:每次攻击 40/43/50%(间隔键 -0.8 语义待定,见口径清单)
  // ---- 辅助·工匠(craftsman) ----
  'char_4072_ironmn': [0],  // 白铁 S1「极致火力」:攻击造成相当于 180%(专一)攻击力的物理伤害(attack@atk_scale 作每击倍率改写)
  // ---- 特种·钩索师(hookmaster) ----
  'char_474_glady': [1],   // 歌蕾蒂娅 S2 缺水的掌握怒海:attack@atk_scale(专一 160%)作每击倍率(顶层无 atk)
};
// 阵法术师技能改造①:技能「每次攻击造成相当于攻击力 X% 的法术伤害」→ 把该值作为技能期每击最终倍率
// (键名多为 attack@atk_scale_s2/_s3 或 attack@atk_scale;伤害对攻击力线性,等价于最终乘算倍率;永续槽同样生效故不设时长门槛)
const PHALANX_PER_HIT_SCALE = {
  'char_1046_sbell2': { 1: 'attack@atk_scale_s2', 2: 'attack@atk_scale_s3' },
  'char_388_mint': { 0: 'attack@atk_scale', 1: 'attack@atk_scale' },
};
// 阵法术师技能改造②:攻击力线性递增 + 蓄力增伤线性递增
// (卡涅利安「食噬之印」:攻击力在 span 秒内从 +0% 线性增至满值;蓄力额外使目标受伤提升 20%×5 层,按整个技能线性折算)
const PHALANX_ATK_RAMP = {
  'char_426_billro': { 2: { span: 20, dmgRamp: 1 } },
};
// 阵法术师技能改造③:DoT 与技能结束收尾爆发
const PHALANX_EXTRA = {
  'char_1046_sbell2': { dot: { 1: 'talent@s2_magic_scale' } },  // S2 积雪:能攻击到即站在积雪上,每秒受 talent@s2_magic_scale×攻击力 法伤
  'char_388_mint': { endBurst: { 1: 'atk_scale' } },            // S2 技能结束时对范围内敌人造成 atk_scale×攻击力 法伤(一次性)
  'char_344_beewax': { endBurst: { 1: 'atk_scale' } },           // S2 技能开启召唤方尖塔时对附近敌人造成 atk_scale×攻击力 法伤(一次性;时点在技能开始,计入总伤)
};
// 链术师(chain) AUTO「下次攻击强化」型(自然回技力触发,仅强化一次普攻):
// 周期=spCost 自然回,期间普攻照常 → cycleDps=(周期内普攻数×普攻伤害+强化击)/spCost(同艾雅法拉 S2 点燃口径);
// 技能框内"同时攻击 N 个目标/最多跳跃 N 次"属多目标模型不计(单目标)。
const AUTO_BOOST_SKILLS = {
  'char_472_pasngr': { 0: 'pasngr_s_1.atk_scale' },   // 电能之触:下次攻击 210%(L7档)/220%(专一)
  'char_135_halo': { 0: 'atk_scale' },                // 双端导流:下次攻击 110%(L7档)/115%(专一)
};

// 轰击术师(blastcaster)技能期每击附带 DoT(必触发,非概率;key=每跳倍率键(相对面板攻击力),durKey=持续秒数键)
const BLASTCASTER_HIT_DOT = {
  'char_134_ifrit': { 1: { key: 'burn.atk_scale', durKey: 'duration' } },  // 炎爆:命中目标 3s 内每秒受面板攻击力 33% 法伤
};
// 伊芙利特 Δ/D 模组「灼燃损伤」:攻击附带元素损伤(EP),EP 满 1000(领袖 2000) → 爆条 7000 元素伤害,
// 爆条后 10s 内敌方法抗 -20(冷却期锁条)。倍率取模组内 name=null 的 talentEnhance.element_atk_scale
// (L2 0.4 / L3 0.5)优先,无该键时退回特性 traitEnhance.ep_damage_ratio(L1 0.08);未装备模组返回 0。
function ifritEpScale(op, slotData) {
  if (op.id !== 'char_134_ifrit') return 0;
  const lv = getModuleLevelData(op, slotData);
  if (!lv) return 0;
  let scale = 0;
  for (const te of (lv.talentEnhance || [])) {
    const bb = te.blackboard || {};
    if ((te.name === null || te.name === undefined) && typeof bb.element_atk_scale === 'number') {
      scale = Math.max(scale, bb.element_atk_scale);
    }
  }
  if (scale <= 0) {
    for (const te of (lv.traitEnhance || [])) {
      const bb = te.blackboard || {};
      if (typeof bb.ep_damage_ratio === 'number') scale = Math.max(scale, bb.ep_damage_ratio);
    }
  }
  return scale;
}
// 常态稳态(面板间隔逐击):每击 EP = 当前攻击力 × 模组倍率 → 爆条;返回常态行修正
//   factor = 爆条窗口(法抗-20)对常态法伤的平均修正;elementDps = 稳态爆条平均元素 DPS
function ifritNormalFields(op, slotData, panelAtk, normInterval, effResN) {
  const scale = ifritEpScale(op, slotData);
  if (!(scale > 0) || !(normInterval > 0)) return { factor: 1, elementDps: 0 };
  const grade = (state.enemy && state.enemy.grade) || 'normal';
  const epPerHit = panelAtk * scale;
  const n = Math.ceil(1000 / epPerHit);
  const count = 2 * n + Math.ceil(40 / normInterval);   // 覆盖 ≥2 个爆条周期
  const events = [];
  for (let i = 1; i <= count; i++) events.push({ t: i * normInterval, atk: panelAtk, ep: epPerHit });
  const fb = fireWindowBenefit({ grade, res: effResN, events });
  const elDps = steadyElementDps(grade, 'fire', epPerHit, normInterval).avgDps;
  return { factor: fb.factor, elementDps: elDps };
}
// 技能期损伤/伤害事件流:狂热逐击 / 炎爆(强化击 + 灼烧跳伤,灼烧同样造成损伤) / 灼地每秒领域跳伤
function ifritSlotEvents(levelData, c) {
  const { skillAtk, panelAtk, skillRealInterval, skillDuration, effRes, epScale, skillIndex } = c;
  const skillMr = (typeof levelData.magic_resistance === 'number' && levelData.magic_resistance <= -1) ? levelData.magic_resistance : 0;
  const res = Math.max(0, effRes + skillMr);
  // EP 基准 = 当前"攻击力"(仅吃技能攻击力加成,不吃 atk_scale 类伤害倍率)
  const epBase = panelAtk * (1 + (typeof levelData.atk === 'number' ? levelData.atk : 0));
  const events = [];
  if (skillIndex === 0) {
    const iv = skillRealInterval > 0 ? skillRealInterval : 1;
    const n = Math.floor(skillDuration / iv);
    for (let i = 1; i <= n; i++) events.push({ t: i * iv, atk: skillAtk, ep: epBase * epScale });
  } else if (skillIndex === 1) {
    events.push({ t: 0, atk: skillAtk, ep: epBase * epScale });
    const bdAtk = panelAtk * (typeof levelData['burn.atk_scale'] === 'number' ? levelData['burn.atk_scale'] : 0);
    const ticks = Math.max(1, Math.floor(typeof levelData.duration === 'number' ? levelData.duration : 3));
    for (let i = 1; i <= ticks; i++) events.push({ t: i, atk: bdAtk, ep: epBase * epScale });
  } else if (skillIndex === 2) {
    const n = Math.floor(skillDuration / 1);
    for (let i = 1; i <= n; i++) events.push({ t: i, atk: skillAtk, ep: epBase * epScale });
  }
  return { res, events };
}

// 常态行比例扣减(技能结束后自身失能:该槽常态输出 = 无技能态 × 系数;用户口径 2026-09-16)
const NORMAL_ROW_MUL = {
  'char_489_serum': { 0: 2 / 3 },  // 蚀清 S1「专注力超载」:技能结束眩晕 10s(技能 30s)→ 常态 ×(1-10/30)
  'char_291_aglina': { 1: 0, 2: 0 },  // 安洁莉娜 S2/S3「技能未开启时无法普通攻击」→ 该槽常态输出记 0
};

// 秘术师(mystic)技能期必然生效的 DoT(描述为"每秒受到 X 伤害",不含概率/条件):
// dpsKey = 每秒固定法伤键(固定值);atkScaleKey = 每秒按技能期攻击力的比例键
const MYSTIC_SKILL_DOT = {
  'char_297_hamoni': { 1: { dpsKey: 'damage_value' } },          // 和弦 S2 沉溺之灾:水域内地面敌人每秒受 180/250 固定法伤
  'char_4110_delphn': { 1: { atkScaleKey: 'attack@max_cnt' } },  // 戴菲恩 S2 抢攻:目标每秒受 6%×最多4层=24% 攻击力法伤(持续至技能结束)
};

// 技能开启期天赋自回(技能期每秒回 maxHp 比例,与技能自带自回键求和;火神「自我防护」对所有技能生效)
const TALENT_SKILL_RECOVER = {
  'char_163_hpsts': 0,  // 火神:技能开启时每秒恢复 4~5% 最大生命(与 S1 自带 4% 叠加,S2 亦生效)
};
// 技能结束回血天赋(技能结束时恢复 maxHp×hp_ratio,如折桠「简易包扎」50~60%)
const TALENT_SKILL_END_HEAL = {
  'char_4207_branch': 0,  // 折桠:技能结束时恢复自身 50~60% 最大生命
};
// 受击回复触发时的自疗(单发回 maxHp×hp_ratio,泥岩 S2 岩崩锤)
const TAKEN_SELF_HEAL = {
  'char_311_mudrok': { 1: true },  // 泥岩 S2 岩崩锤:下次攻击回复 5% 最大生命
};
// 攻击吸血(每次攻击回 maxHp×hp_ratio,火神 S2 武力模式 8%--区别于受击自疗/屏障 hp_ratio)
const LEECH_SKILLS = {
  'char_163_hpsts': { 1: true },   // 火神 S2:每次攻击恢复自身 8% 最大生命
};
// 前段延迟输出(技能期前 N 秒无输出,泥岩 S3 前 10s 沉睡无敌)
const DELAYED_OUTPUT = {
  'char_311_mudrok': { 2: 10 },    // 泥岩 S3 秽壤的血脉:沉睡 10s 后攻击 20s
};
// 停攻 + 周期法术 DOT(把正常攻击改为周期性范围法伤):interval=跳间隔;atkScaleKey=倍率键
// (null 表示 skillAtk 已含顶层 atk_scale 倍率,直接用技能攻击力作每跳)
const PERIODIC_DOT = {
  'char_4130_luton': { 1: { interval: 2, atkScaleKey: 'magic_atk_scale' } },  // 露托 S2 强磁防卫:每2s 0.8×atk
  'char_4065_judge': { 1: { interval: 1, atkScaleKey: null } },               // 斥罪 S2 坚心苦修:每秒 1.2×atk(skillAtk 已含)
  // ---- 扩散术士(splashcaster) ----
  'char_213_mostma': { 1: { interval: 1, atkScaleKey: null } },  // 莫斯提马 S2 荒时之锁:范围内敌人全晕眩,每秒受 1.3×atk 法伤(晕眩不计)
  'char_1011_lava2': { 1: { interval: 1, atkScaleKey: null } },  // 炎狱炎熔 S2 狱火之环:停止攻击,火环每秒对周围敌人造成 0.4×atk 法伤(默认自身环,友方环不计)
  // ---- 轰击术师(blastcaster) ----
  'char_134_ifrit': { 2: { interval: 1, atkScaleKey: null } },  // 灼地:20s 内对范围内地面敌人每秒造成 1.2×atk(skillAtk 已含 atk_scale)法伤,命中目标法抗-13(技能级,见 dotRes)
};
// 每攻击多次连击(技能描述"二/三连击",单目标模型全中;value=连击数)
const MULTI_HIT = {
  'char_157_dagda': { 1: 2 },    // 达格达 S2「精准捕杀」:攻击变为二连击
  'char_264_f12yin': { 2: 2 },   // 山 S3「震地碎岩击」:攻击变为 2 连击
  'char_4037_demetr': { 0: 2 },  // 贝洛内 S1「家主的余裕」:对目标造成两次 220% 物理伤害
  'char_271_spikes': { 0: 2 },   // 芳汀 S1「小玩笑」:攻击变为二连击(数据无 times,按文案写死)
  'char_4054_malist': { 1: 2 },   // 至简 S2「神工意匠」:下次攻击造成 1.7×atk 法伤并连续攻击两次(点燃类,可充能3次)
  'char_1044_hsgma2': { 2: 2 },    // 斩业星熊 S3 地狱变相:二连击打最多3敌(单目标=2连全中)
  'char_4194_rmixer': { 0: 3 },    // 信仰搅拌机 S1 铳骑主考官:下次攻击变三连击(每击 1.7×atk → 单次触发 5.1×atk)
  'char_1050_chen3': { 0: 2 },     // 赤刃明霄陈 S1 奔夜:攻击变为二连击(每击=技能期攻击力全额弱点,乘 2 连)
  'char_4098_vvana': { 0: 2, 2: 2 }, // 薇薇安娜 S1 光影迅捷剑:下次攻击连击两次(每击 atk_scale×atk);S3 明灭:攻击变为二连击(单目标 2 连全中)
  // ---- 近卫·武者(musha) 「攻击变为二连击」(写在技能文案里,数据无 times 键) ----
  'char_188_helage': { 0: 2, 1: 2 }, // 赫拉格 S1 新月「并连续攻击两次」/ S2 弦月「攻击变为二连击」
  'char_475_akafyu': { 0: 2 },       // 赤冬 S1 信影流·雷刀之势「攻击变为二连击」
  // ---- 近卫·收割者(reaper) 「并连续攻击两次」(写在技能文案里,数据无 times 键) ----
  'char_4010_etlchi': { 0: 2 },  // 隐德来希 S1 玫影觅迹
  'char_4066_highmo': { 0: 2 },  // 海沫 S1 回首，断舍
  'char_421_crow': { 0: 2 },     // 羽毛笔 S1 高速切割
  // ---- 近卫·无畏者(fearless) ----
  'char_4011_lessng': { 1: 2 },  // 止颂 S2 虔修对决「攻击变为 2 连击」(被动限时,数据无 times 键)
  // ---- 先锋(PIONEER) ----
  'char_102_texas': { 1: 2 },  // 德克萨斯 S2 剑雨:造成两次 1.7×atk 法伤(单目标=2 段全中)
  'char_420_flamtl': { 1: 2 }, // 焰尾 S2 "红松林":造成两次 2.4×atk 物伤(单目标=2 段全中)
  'char_1001_amiya2': { 0: 2 },  // 阿米娅(近卫) S1 影霄·奔夜:攻击变为二连击(dur28 法伤)
  'char_1036_fang2': { 0: 2 },  // 历阵锐枪芬 S1 贯敌刺枪:下次攻击变二连击(1.8×atk×2,AUTO dur0 触发)
  'char_222_bpipe': { 2: 3 },   // 风笛 S3 闭膛连发:攻击变三连击(dur20 间隔+0.7→1.7s,atk+100% 三连全中)
  // ---- 特种·行商(merchant) ----
  'char_1033_swire2': { 2: 2 },  // 琳琅诗怀雅 S3 千金一掷:「攻击变为二连击」(数据无 times,按文案写死;atk_scale 1.3 是金币弹倍率,由 SKILL_ATK_SCALE_EXCLUDE 排除)
  // 注:灵知 S1「高速思考」的「下次攻击连续攻击两次」已由 UNDERMINER_SPECIAL 专用分支结算(二连击第二下处于冻结要吃冻结脆弱,不能只乘次数)
};
// 速射手连射(用户口径 2026-09-17):一次攻击打出 N 发,单目标模型全部命中。
// hitCount = 每次攻击的发数;attack@atk_scale 归"每发倍率"(进 skillAtk,与 top-level atk_scale 区分)。
// 数据里没有 times 键、只写在技能文案里的固定连射在此写死(灰喉 S1/S2、寒芒克洛丝 S1/S2)。
const FASTSHOT_MULTI_HARD = {
  'char_367_swllow': { 0: 2, 1: 3 },    // 灰喉 S1 飞羽「连续射击2次」/ S2 回流「攻击变为3连射」
  'char_1021_kroos2': { 0: 2, 1: 2 },   // 寒芒克洛丝 S1 无痕 / S2 封喉「攻击变为2连射」(命中32次后转4连射未建模)
};
function fastshotMultiHit(opId, skillIndex, levelData) {
  const times = levelData['attack@times'] ?? levelData.times ?? (FASTSHOT_MULTI_HARD[opId] || {})[skillIndex] ?? 0;
  if (!times) return null;
  const scale = levelData['attack@atk_scale'] !== undefined ? levelData['attack@atk_scale'] : 1;
  return { times, scale };
}

// 白金「蓄力攻击」(用户口径 2026-09-17):距上次攻击间隔越长,下次攻击倍率越高。
// 间隔 min_delta~max_delta 秒线性映射 min_atk_scale~max_atk_scale;常态 1.0s 无加成,天马视域(攻速-20 → 1.25s)≈1.13×。
function calcPlatnmChargeMul(op, slotData, interval) {
  const talent = (op.talents || [])[0];
  if (!talent) return 1;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let minD = null, maxD = null, minS = null, maxS = null;
  for (const cand of talentCandSource(op, slotData, 0, talent.candidates)) {
    const candPot = cand.potentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const bb = cand.blackboard || {};
      if (typeof bb['attack@min_delta'] === 'number') minD = bb['attack@min_delta'];
      if (typeof bb['attack@max_delta'] === 'number') maxD = bb['attack@max_delta'];
      if (typeof bb['attack@min_atk_scale'] === 'number') minS = bb['attack@min_atk_scale'];
      if (typeof bb['attack@max_atk_scale'] === 'number') maxS = bb['attack@max_atk_scale'];
    }
  }
  if (minD === null || maxD === null || minS === null || maxS === null || maxD <= minD) return 1;
  const t = Math.min(Math.max(interval, minD), maxD);
  const ratio = (t - minD) / (maxD - minD);
  return minS + (maxS - minS) * ratio;
}

// 仅攻击到一个敌人时的伤害倍率(单目标模型恒成立;读 attack@xxx[critical] 键,与 atk 加成相乘)
const SINGLE_CRIT_MUL = {
  'char_350_surtr': { 1: true },   // 史尔特尔 S2 熔核巨影:仅攻击到一个敌人时攻击力提升至 1.4~1.6
};
// 天赋层攻击间隔加算(读天赋 bb.base_attack_time;含模组 te 覆盖):白雪「重型手里剑」+0.2s、
// 子月「荒野本能」E2 -0.15s(X 模组 L2/L3 覆盖为 -0.2/-0.25)。常态与技能期都生效。
const TALENT_BAT_ADD = {
  'char_118_yuki': 0, 'char_4014_lunacu': 0,   // 干员 id → 天赋索引(白雪「重型手里剑」+0.2s、子月「荒野本能」E2 -0.15s)
  'char_193_frostl': 0,                          // 霜叶「掩护打击」:攻击间隔 +0.15 秒,常态与技能期都加算
};
function calcTalentBatAdd(op, slotData) {
  const idx = TALENT_BAT_ADD[op.id];
  if (idx === undefined) return 0;
  const base = ((op.talents[idx] || {}).candidates || []).filter((c) => (c.phase ?? 0) <= (slotData.elite ?? 0) && (c.potentialRank ?? 0) <= (slotData.potentialRank ?? 0));
  const list = talentCandSource(op, slotData, idx, base).filter((c) => typeof (c.blackboard || {}).base_attack_time === 'number');
  if (!list.length) return 0;
  list.sort((a, b) => (b.phase ?? 0) - (a.phase ?? 0));
  return list[0].blackboard.base_attack_time;
}
// 菲亚梅塔「宣告终局」:技能持续期间外攻击速度 +X(模组可提升至 30/33);X 模组另给技能期内攻速
// (te 键 phenxi_e_t_2[in_skill].attack_speed,+5/+10)。常态只吃前者,技能期只吃后者(用户 2026-09-17 提示检查模组技能期加成)
function phenxiEndgameAspdBb(op, slotData) {
  if (op.id !== 'char_300_phenxi') return null;
  const base = ((op.talents[1] || {}).candidates || []).filter((c) => (c.phase ?? 0) <= (slotData.elite ?? 0) && (c.potentialRank ?? 0) <= (slotData.potentialRank ?? 0));
  const cands = talentCandSource(op, slotData, 1, base);
  let normal = 0, inSkill = 0;
  for (const c of cands) {
    const bb = c.blackboard || {};
    if (typeof bb.attack_speed === 'number') normal = Math.max(normal, bb.attack_speed);
    const s = bb['phenxi_e_t_2[in_skill].attack_speed'];
    if (typeof s === 'number') inSkill = Math.max(inSkill, s);
  }
  return { normal, inSkill };
}
function phenxiNormalAspd(op, slotData) { const v = phenxiEndgameAspdBb(op, slotData); return v ? v.normal : 0; }
function phenxiSkillAspd(op, slotData) { const v = phenxiEndgameAspdBb(op, slotData); return v ? v.inSkill : 0; }

// atk_scale 不作为普攻倍率(技能结束爆炸等一次性伤害语义,如车尔尼 S2 结束时 2.1×atk 法伤)
const SKILL_ATK_SCALE_EXCLUDE = {
  'char_4182_oblvns': { 0: true },   // 丰川祥子 S1:顶层 atk_scale 只是第 1 个音符的倍率,8 个音符由领主分支逐个结算
  'char_294_ayer': { 1: true },   // 断崖 S2 顶层 atk_scale 1.4 属"额外对友方阻挡敌人"的条件伤害,不计
  'char_4047_pianst': { 1: true },  // 车尔尼 S2 曲惊四座：atk_scale 2.1 是技能结束爆炸，非普攻倍率
  'char_494_vendla': { 1: true },   // 刺玫 S2 荆藤庇荫：atk_scale 是受击反伤倍率（反伤不计），普攻只吃 atk 加攻
  'char_4230_mcnist': { 1: true, 2: true },
  'char_388_mint': { 1: true },    // 薄绿 S2 聚能漩涡:atk_scale 2.6 是技能结束时对范围内敌人的爆发倍率,不作普攻倍率(普攻倍率走 attack@atk_scale 1.2)
  'char_344_beewax': { 1: true },   // 蜜蜡 S2 守卫尖峰:atk_scale 2.5 是方尖塔出现时的一次性范围爆发,不作普攻倍率(技能期普攻为正常倍率)
  'char_450_necras': { 1: true },   // 死芒 S2 折朽:atk_scale 是沉睡目标每 0.5s 的 DoT 倍率,不作普攻倍率
  'char_4055_bgsnow': { 0: true },  // 鸿雪 S1 抑扬格:atk_scale 1.85 是 30% 概率触发的当次攻击倍率(用户口径:概率增幅不计)
  'char_1033_swire2': { 2: true },  // 琳琅诗怀雅 S3 千金一掷:顶层 atk_scale 1.3 实为「关闭技能时每枚金币」的弹道倍率,不作攻击力乘算(用户口径 2026-09-18:S3 = 二连击 + 关闭金币爆发)
  'token_10026_bgsnow_subbow': { 0: true },  // 打字机继承鸿雪 S1 同口径(继承技能,面板为打字机自身)   // 蜜蜡 S2 守卫尖峰:atk_scale 2.5 是方尖塔出现时的一次性范围爆发,不作普攻倍率(技能期普攻为正常倍率)    // 薄绿 S2 聚能漩涡:atk_scale 2.6 是技能结束时对范围内敌人的爆发倍率,不作普攻倍率(普攻倍率走 attack@atk_scale 1.2) // 机械师 S2 atk_scale 2 是屏障被摧毁法伤（受击机制不计）；S3 atk_scale 3 是冲锋碰撞倍率（召唤物轮处理）
};
// 顶层 atk 不作为普攻加成(键值是受击叠层基值,默认不受击 0 层,如车尔尼 S2 每层 +26%)
const SKILL_ATK_EXCLUDE = {
  'char_4047_pianst': { 1: true },  // 车尔尼 S2:atk 0.26/层,默认不叠
  'char_4164_tecno': { 0: true, 1: true },  // 特克诺 S1 关节锁定/S2 恣意挥洒:atk/max_hp/def 均为召唤物加成(用户口径:召唤物增幅只在召唤物侧体现)
};
// 技能开启期间常驻光环天赋倍率(阿米娅(近卫)「青色怒火」:技能开启期间效果加倍 → 技能期 atk 额外加一份 talentAtk)
// key: 干员id; value: { 技能index: 倍率 }
const SKILL_TALENT_ATK_MUL = {
  'char_1001_amiya2': { 0: 2, 1: 2 },  // 影霄·奔夜/影霄·绝影 开技天赋 ×2
};
// 技能结束爆炸伤害(结束后对周围敌人造成 atk_scale×atk 法伤单发,加入技能期总伤)
const SKILL_END_ARTS_BURST = {
  'char_4047_pianst': { 1: true },  // 车尔尼 S2:结束时 2.1×atk 法伤
};
// 技能不计算(效果全在未建模机制上,展示常态普攻即可)
const SKIP_SKILLS = {
  // (暂空)斩业星熊 S2 曾整技能跳过,后改为只算三连击(见 dispatch 拦截)
};
// AUTO 触发附加法伤(下次攻击=普攻物理+额外 X×atk 法伤,自然回充能周期;斥罪 S1 蓄力分支永不触发)
const TRIGGER_ARTS_ADD = {
  'char_4065_judge': { 0: { scaleKey: 'atk_scale_2' } },  // 斥罪 S1 一锤定音:额外 1.9×atk 法伤
  // ---- 先锋(PIONEER) ----
  'char_4026_vulpis': { 0: { scaleKey: 'extra_damage_ratio' } }, // 忍冬 S1 小施惩戒(充能 ct3 不改变触发频率):下次攻击额外 2.9×atk 法伤(倍率键 extra_damage_ratio 非 atk_scale)
};

// 技能开启期天赋自回比例(读 candidates 的 hp_recovery_per_sec_by_max_hp_ratio 当前档,未解锁→0)
function calcTalentSkillRecoverRatio(op, slotData) {
  const idx = TALENT_SKILL_RECOVER[op.id];
  if (idx === undefined) return 0;
  const talent = (op.talents || [])[idx];
  if (!talent) return 0;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let v = 0;
  for (const cand of talentCandSource(op, slotData, idx, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const r = cand.blackboard && typeof cand.blackboard.hp_recovery_per_sec_by_max_hp_ratio === 'number' ? cand.blackboard.hp_recovery_per_sec_by_max_hp_ratio : 0;
      if (r > v) v = r;
    }
  }
  return v;
}
// 技能结束回血比例(读 talents 的 hp_ratio 当前档)
function calcTalentEndHealRatio(op, slotData) {
  const idx = TALENT_SKILL_END_HEAL[op.id];
  if (idx === undefined) return 0;
  const talent = (op.talents || [])[idx];
  if (!talent) return 0;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let v = 0;
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const r = cand.blackboard && typeof cand.blackboard.hp_ratio === 'number' ? cand.blackboard.hp_ratio : 0;
      if (r > v) v = r;
    }
  }
  return v;
}

// 停止攻击类防御技能(技能期转纯防御,普攻停止):技能期伤害记 0,防御/面板变化仅展示。
// key: 干员 id;value: 停止攻击的 skillIndex 列表。铁卫先行,其它子职业轮到时追加。
// 执旗手(bearer) S2 治疗技能:技能期每秒 1 跳治疗(治疗=面板攻击力×ratio/秒,量不吃治疗加成/禁疗),
// 目标=周围 1 名友方(桃金娘/嘉辛塔/琴柳生命最低者;万顷周围友方按单目标口径),治疗期停攻由 STOP_ATTACK 清零。
// value: { skillIndex: ratio键 }
const BEARER_HEAL_SKILLS = {
  'char_151_myrtle': { 1: 'attack@heal_scale' },      // 桃金娘 S2 治愈之翼:atk×0.4(专一) dur16 每秒
  'char_4119_wanqin': { 1: 'attack@heal_scale' },     // 万顷 S2 应东风:atk×0.2(专一) dur15 每秒
  'char_4237_jcinta': { 1: 'attack@heal_scale' },     // 嘉辛塔 S2 伞下乘荫:atk×0.22(专一) dur30 每秒
  'char_479_sleach': { 1: 'atk_to_hp_recovery_ratio' }, // 琴柳 S2 信仰传承:atk×0.4(专一) dur15 每秒(生命回复速度属性)
};
const STOP_ATTACK_SKILLS = {
  'char_2014_nian': [1],    // 年 S2「铜印」
  'char_325_bison': [1],    // 拜松 S2「深化阵线」
  'char_150_snakek': [1],   // 蛇屠箱 S2「壳状防御」
  'char_381_bubble': [1],   // 泡泡 S2「挨打」
  'char_304_zebra': [1],    // 暴雨 S2「群体迷彩」
  'char_4194_rmixer': [2],  // 信仰搅拌机 S3 退休前布道：停止主动攻击转受击反击（无受击模型，反击不计）
  'char_4148_philae': [1],  // 菲莱 S2 冥河诅咒：停止攻击转受击反伤挂凋亡（受击无模型，反伤/凋亡不计）
  // ---- 执旗手(bearer) 技能开启期间停止攻击(持续回费/增益),技能期伤害记 0 ----
  'char_151_myrtle': [0, 1],  // 桃金娘 S1 支援号令·β / S2 治愈之翼(治疗增益另议)
  'char_401_elysm': [0, 1],   // 极境 S1 支援号令·γ / S2 聆听(减速减防反隐)
  'char_4119_wanqin': [0, 1], // 万顷 S1 支援号令·γ / S2 应东风(攻速增益+治疗另议)
  'char_4237_jcinta': [0, 1], // 嘉辛塔 S1 支援号令·γ / S2 伞下乘荫(治疗另议)
  'char_479_sleach': [0, 1],  // 琴柳 S1 支援号令·γ / S2 信仰传承(def增益受击回血另议);S3 光辉旗帜见专用分支
  // ---- 近卫·武者(musha) 技能开启期间停止攻击 ----
  'char_337_utage': [0],      // 宴 S1 分神:停止攻击,阻挡数归零,防御力+100%~200% 且每秒回血(技能期伤害记 0)
  // ---- 辅助·凝滞师(slower) ----
  'char_183_skgoat': [1],  // 地灵 S2 流沙化:停止攻击,范围内敌方每秒受一次停顿(无伤害)
  // ---- 辅助·工匠(craftsman) 技能开启期间停止攻击 ----
  'char_4212_nasti': [1],   // 娜斯提 S2「执行」:停止攻击(屏障/技力给予,受击/护盾无输出模型)
  'char_4162_cathy': [1],   // 凯瑟琳 S2「战火淬炼」:停止攻击(生命上限/防御增益)
  'char_484_robrta': [1],   // 罗比菈塔 S2「全自动造型仪」:停止攻击(阻挡数/防御增益)
};
// 纯防御/控制技能（无输出增益，技能期普攻照常归常态展示）：雷蛇 S1 充能防御、闪击 S1 闪光护盾
const NORMAL_ATK_SKILLS = {
  'char_107_liskam': [0],
  'char_457_blitz': [0],
  'char_4148_philae': [0],   // 菲莱 S1 灵河护佑：血上限+清损伤条+损伤屏障（屏障承伤不计）
  'char_4225_tanya': [0, 1], // 裂响 S1 涤净（血上限+自清损伤）/ S2 溃决（防御叠层，受击消耗挂侵蚀，受击无模型）
  // ---- 先锋(PIONEER) 冲锋号令系(瞬发回费不影响普攻,技能期无输出增益→归常态展示) ----
  'char_123_fang': [0],      // 芬 S1 冲锋号令·α:立即回 6 费
  'char_149_scave': [0],     // 清道夫 S1 冲锋号令·β:立即回 9 费
  'char_198_blackd': [0, 1], // 讯使 S1 冲锋号令·β(回9费) / S2 冲锋号令·防御(def+80% 周期回费,纯防御无输出增益)
  'char_115_headbr': [0],    // 凛冬 S1 冲锋号令·γ:立即回 12 费
  'char_102_texas': [0],     // 德克萨斯 S1 冲锋号令·γ
  'char_112_siege': [0],     // 推进之王 S1 冲锋号令·γ
  'char_349_chiave': [0],    // 贾维 S1 冲锋号令·γ
  'char_362_saga': [0],      // 嵯峨 S1 冲锋号令·γ
  'char_4023_rfalcn': [0],   // 红隼 S1 冲锋号令·γ
  'char_488_buildr': [0],    // 青枳 S1 冲锋号令·γ
  'char_420_flamtl': [0],    // 焰尾 S1 迅敏直觉:回6费+闪避下次物理攻击(闪避无伤害增益)
  // ---- 冲锋手 ----
  'char_220_grani': [0],    // 格拉尼 S1 防御力强化·γ:防御+100% dur40 纯防御,普攻照常归常态展示
  // ---- 情报官(agent) ----
  'char_4144_chilc': [0],   // 齐尔查克 S1 开锁工具:特殊回费机制(dur3 概率增减费用)无输出增益,普攻照常归常态展示
  // ---- 策士(counsellor) ----
  'char_1045_svash2': [0],  // 凛御银灰 S1 周旋的谋略:立即回费+减费+屏障,纯部署区支援无输出
  'char_4199_makiri': [0],  // 松桐 S1 入场安排:立即回 10 费+待部署区最右干员-4 费,纯回费无输出
  // ---- 辅助·削弱者(underminer) 纯 debuff / 召唤类技能(自身无输出增益 → 归常态普攻展示) ----
  'char_174_slbell': [0],   // 初雪 S1 传音回响:范围内敌人攻击速度-(敌方减益,自身法伤普攻不变)
  'char_254_vodfox': [1],   // 巫恋 S2 诅咒娃娃:召唤物周围敌人攻/防-(自身为法伤,降防不受益;降攻为敌方减益)
  // ---- 中坚术师(corecaster) ----
  'char_164_nightm': [1],  // 夜魔 S2 夜魇魔影:AUTO 施加梦魇 debuff(减速+移动真伤),移动增伤不考虑(用户口径)无输出 → 归常态
  // ---- 战术家(tactician) 召唤物强化/纯回费技能(本体无输出增益→归常态;召唤物侧效果见持有者技能建模与说明) ----
  'char_427_vigil': [0, 1],  // 伺夜 S1 领袖的呼唤:回 7 费+增加狼影;S2 领袖的馈赠:回 2 费+狼群下次攻击强化(vigil_wolf_s_2)
  'char_4228_closur': [0],   // 可露希尔 S1 紧急支援:回费+护盾(shield_cnt 承伤不计)
  'char_452_bstalk': [0, 1], // 豆苗 S1 磐蟹部署指令:回 8 费;S2 定向指令:磐蟹防御强化(attack@def 0.7,本体无输出增益)
  'char_4147_mitm': [0],     // 渡桥 S1 出击指令:回 6 费+模様三号自爆(aoe_damage_scale 3.7 在召唤物侧建模),本体无输出
  'char_476_blkngt': [0, 1], // 夜半 S1 半醒:回费+眠兽休眠回血(bb 的 hp_recovery 是眠兽的,本体无输出);S2 安眠:沉睡+回费(控制无本体伤害)
  // ---- 特种·怪杰(geek) ----
  'char_225_haak': [1],      // 阿 S2 爆发剂·γ型:对友方 15 次 500 攻击(友伤非敌伤)并使自身和目标防御/生命上限+X%,自身对敌输出不变 → 归常态展示
};
// 附带固定 DOT 天赋（每次攻击施加，攻击间隔<持续秒数 → 等效常驻秒伤）：深巡「细胞活性抑制剂」
// 攻击使目标 3s 每秒受 80 法伤（对海怪加倍不计），1.2s 间隔 < 3s 全覆盖 → 恒 80/s（吃法抗，不吃攻击加成）
const TALENT_FLAT_DOT = {
  'char_4137_udflow': { talentIndex: 0, key: 'damage', duration: 3 },
  // 维伊「战争技艺」:攻击/能量命中后 5s 内每秒受 attack@value 法伤,最多叠 attack@max_stack_cnt 层;
  // 攻击间隔 2.5s < 5s 全覆盖 → 等效常驻 value×层数 秒伤(模组 Y L2/L3 的 100×4 / 120×4 经同名 te 自动生效)
  'char_4226_veen': { talentIndex: 1, key: 'attack@value', stackKey: 'attack@max_stack_cnt', duration: 5 },
  // 隐德来希「萃血」:每次攻击敌人时使目标 5s 内每秒受 magic_value 点法术伤害(重复施加仅重置持续时间、不叠层);
  // 攻击间隔 1.3s < 5s → 等效常驻秒伤(吃法抗、不吃攻击加成)。E2 潜0 = 200/秒;Y 模组 L2/L3 = 350/450(经同名 te 自动生效)
  'char_4010_etlchi': { talentIndex: 0, key: 'magic_value', duration: 5 },
};
function calcTalentFlatDotDps(op, slotData) {
  const cfg = TALENT_FLAT_DOT[op.id];
  if (!cfg) return 0;
  const talent = (op.talents || [])[cfg.talentIndex];
  if (!talent) return 0;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let dmg = 0;
  for (const cand of talentCandSource(op, slotData, cfg.talentIndex, talent.candidates)) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const raw = cand.blackboard && typeof cand.blackboard[cfg.key] === 'number' ? cand.blackboard[cfg.key] : 0;
      const stack = (cfg.stackKey && cand.blackboard && typeof cand.blackboard[cfg.stackKey] === 'number') ? cand.blackboard[cfg.stackKey] : 1;
      const v = raw * stack;
      if (v > dmg) dmg = v;
    }
  }
  return dmg;
}

// 被动技能(SKILL PASSIVE)里非标准键名的自身属性加成:PASSIVE 区块只认 atk/def/max_hp 三个键名,
// 其他键名(如凯瑟琳 S1「岁月锻打」的 s1_atk/s1_def)在此登记。装置默认不放置 → 只计自身那份。
const PASSIVE_ATTR_KEYS = {
  'char_4162_cathy': { 0: { atk: 's1_atk', def: 's1_def' } },
};
// 工匠(craftsman)的装置类召唤物:不攻击、不治疗,仅占位置(提供友方增益不建模) → 输出全 0
const INERT_SUMMONS = [
  'token_10027_ironmn_pile1', 'token_10027_ironmn_pile2', 'token_10027_ironmn_pile3',   // 白铁™多功能平台 / 铁钳号·原型机
  'token_10059_nasti_nstdef', 'token_10060_nasti_nstchr', 'token_10061_nasti_nstbld',   // 娜斯提装置(质检专员/监工专员/应急承重小组)
  'token_10041_cathy_catsld',   // 凯瑟琳·爬行号·防护单元
  'token_10045_alanna_crane',   // 阿兰娜·小螺帽
  'token_10023_windft_wrench',  // 掠风·可靠电池
  'token_10018_robrta_mach',    // 罗比菈塔·全自动造型仪
  'token_10055_phatm2_mndclv',  // 巫役·酒神·迷狂牢笼(神经损伤爆发时生成的阻挡物,无输出)
];

// 拥有真实自身技能的召唤物(sktok_ 前缀通常为占位/联动技能,但傀影「镜中虚影」的 sktok_phatom_1/2/3
// 与持有者技能同构、携带完整数值 → 按召唤物自身数据建模,需越过 isSummon && !hasRealSkills 分支)。
const TOKEN_REAL_SKILL_IDS = ['token_10007_phatom_twin', 'token_10009_weedy_cannon'];  // 工程蓄水炮:自身携带 sktok 液氮大炮技能数据,按召唤物自身建模

// ===== 特种·伏击客(stalker) =====
// 特性:对攻击范围内所有敌人造成伤害(单目标模型=1目标)、阻挡数 0、攻击间隔 3.5s、
//       50% 物理与法术闪避且更不易被选中(闪避/嘲讽为生存向、非输出 → 不建模)。
// 每击附加法术伤害天赋(水月「创伤性癔症」):每次攻击额外对目标造成 攻击力×scale 的法术伤害;
//       技能期由 talent_scale 放大(唤醒 2.5 倍)。
const STALKER_HIT_ARTS = {
  'char_437_mizuki': { talentIndex: 0, key: 'attack@mizuki_t_1.atk_scale', skillMulKey: 'talent_scale' },
};
// 常驻法伤 DOT 天赋(阿斯卡纶「死亡拘审」):每次攻击施加 DOT(移速-,每秒受 攻击力×atk_ratio 法伤),
//       最多 max_stack_cnt 层 —— 用户口径(2026-09-18)层数默认叠满;攻击间隔 <持续时间 → 等效常驻秒伤。
const STALKER_TALENT_DOT = {
  'char_4132_ascln': { talentIndex: 0, key: 'atk_ratio', stackKey: 'max_stack_cnt' },
};
// 被动技能附带的普攻 DOT(伊桑 S1「花式回旋」):普通攻击时额外使目标每秒受 attack@poison_damage 法伤,
//       持续 attack@duration 秒;攻击间隔 3.5s < 4s → 等效常驻(不叠层)。仅在装备该被动技能槽位时生效。
const STALKER_PASSIVE_DOT = {
  'char_355_ethan': { 0: { key: 'attack@poison_damage' } },
};

// 伏击客常态行附加法伤(每击附加法伤 + 常驻 DOT + 被动技能普攻 DOT)→ 返回附加秒伤
function stalkerNormalExtras(op, slotData, panelAtk, effRes, realInterval) {
  const nI = realInterval > 0 ? realInterval : 1;
  let artsDps = 0;
  const hit = STALKER_HIT_ARTS[op.id];
  if (hit) {
    const sc = funnelTalentValue(op, slotData, hit.talentIndex, hit.key);
    if (sc > 0) artsDps += calcArtsDamage(panelAtk * sc, effRes) / nI;
  }
  const dot = STALKER_TALENT_DOT[op.id];
  if (dot) {
    const rate = funnelTalentValue(op, slotData, dot.talentIndex, dot.key);
    const stack = funnelTalentValue(op, slotData, dot.talentIndex, dot.stackKey) || 1;
    if (rate > 0) artsDps += calcArtsDamage(panelAtk * rate * stack, effRes);
  }
  const pd = STALKER_PASSIVE_DOT[op.id];
  if (pd) {
    const si = slotData.skillIndex ?? -1;
    const cfg = pd[si];
    const sk = (op.skills || [])[si];
    if (cfg && sk) {
      const ld = getSkillLevelData(sk, slotData.skillLevel);
      const v = ld[cfg.key];
      if (typeof v === 'number' && v > 0) artsDps += calcArtsDamage(v, effRes);
    }
  }
  return artsDps;
}

// 伏击客技能期结算。特性(0 阻挡/3.5s 间隔/闪避)非输出不建模;技能多为普攻叠加天赋特效或领域型。
function calcStalkerSkill(op, slotData, c) {
  const { panelAtk, skillAtk, effDef, effRes, realInterval, skillRealInterval, skillDuration, levelData, skillIndex } = c;
  const P = (a) => calcPhysicalDamage(a, effDef);
  const A = (a) => calcArtsDamage(a, effRes);
  const nI = realInterval > 0 ? realInterval : 1;
  const sI = skillRealInterval > 0 ? skillRealInterval : nI;
  const atkNow = panelAtk * (1 + (levelData.atk || 0));    // 技能期基础攻击力(不含 atk_scale 伤害倍率)
  const normPhys = P(panelAtk) / nI;
  const normArts = stalkerNormalExtras(op, slotData, panelAtk, effRes, realInterval);
  const normRow = normPhys + normArts;
  const nTypes = normArts > 0 ? { physical: { dps: normPhys }, arts: { dps: normArts } } : undefined;

  // 水月「创伤性癔症」每击附加法伤(技能期 talent_scale 放大)
  let wScale = 0, wScaleBase = 0;
  const hitCfg = STALKER_HIT_ARTS[op.id];
  if (hitCfg) {
    wScaleBase = funnelTalentValue(op, slotData, hitCfg.talentIndex, hitCfg.key);
    wScale = wScaleBase;
    if (hitCfg.skillMulKey && typeof levelData[hitCfg.skillMulKey] === 'number') wScale *= levelData[hitCfg.skillMulKey];
  }
  const wArts = (atk, sc) => (sc > 0 ? A(atk * sc) : 0);
  // 阿斯卡纶「死亡拘审」DOT 倍率(默认叠满)
  let dotRate = 0;
  const dotCfg = STALKER_TALENT_DOT[op.id];
  if (dotCfg) {
    const r = funnelTalentValue(op, slotData, dotCfg.talentIndex, dotCfg.key);
    const st = funnelTalentValue(op, slotData, dotCfg.talentIndex, dotCfg.stackKey) || 1;
    dotRate = r * st;
  }
  const dotDps = (atk) => (dotRate > 0 ? A(atk * dotRate) : 0);

  const durHits = (dur, iv) => (dur > 0 && iv > 0 ? Math.max(1, Math.floor(dur / iv + 1e-9)) : 1);
  const mk = (dt, sd, st, cd, iv, types) => ({
    type: 'damage', damageType: dt, normalDamageType: 'physical',
    isToggle: false, isPermanent: false,
    skillDps: sd, skillTotalDamage: st, cycleDps: cd,
    normalDps: normRow, skillHps: null, normalHps: null, totalHeal: null,
    realInterval: iv || sI, panelAtk, dmgTypes: types, normalTypes: nTypes,
  });

  // ---- 狮蝎(char_215_mantic) ----
  if (op.id === 'char_215_mantic') {
    // S1 蝎毒(被动:每次攻击使目标 4s 内移速 -40%,无自身输出)→ 技能期 0,普攻归常态
    if (skillIndex === 0) return mk('physical', 0, 0, null, nI);
    // S2 蓄力毒尾击:攻击前摇与攻击间隔增大(+1.7s → 5.2s),攻击力 +70%(M3 +90%),命中晕眩(非输出)
    // 间隔 5.2s > 天赋重新隐匿阈值 5s → 每次攻击均解除隐匿,天赋「隐匿的杀手」当次攻击加成必然触发(用户口径 2026-09-18)
    const talAtk = funnelTalentValue(op, slotData, 0, 'atk');
    const effAtk = panelAtk * (1 + (levelData.atk || 0) + talAtk);
    const per = P(effAtk);
    const h = durHits(skillDuration, sI);
    const tot = per * h;
    return mk('physical', tot / (skillDuration || 1), tot, null, sI, { physical: { skillDps: tot / (skillDuration || 1), skillTotalDamage: tot, cycleDps: null } });
  }

  // ---- 伊桑(char_355_ethan) ----
  if (op.id === 'char_355_ethan') {
    // S2 十字悬挂:攻击力 +55%(M1 +70%),天赋触发几率提升(概率类不计)。S1 花式回旋为被动(走无技能路径附加 DOT)
    const per = P(skillAtk);
    const h = durHits(skillDuration, sI);
    const tot = per * h;
    return mk('physical', tot / (skillDuration || 1), tot, null, sI, { physical: { skillDps: tot / (skillDuration || 1), skillTotalDamage: tot, cycleDps: null } });
  }

  // ---- 阿斯卡纶(char_4132_ascln) ----
  if (op.id === 'char_4132_ascln') {
    const dN = dotDps(panelAtk);
    if (skillIndex === 0) {
      // S1 追袭:自动回复自动触发(sp8)→ 下次攻击攻击力提升至 atk_scale,并连续攻击两次(每击 = skillAtk)
      const per = 2 * P(skillAtk);
      const cd = calcCycleDps(levelData, nI, P(panelAtk), per) + dN;
      return mk('physical', 0, per, cd, nI, { physical: { skillDps: 0, skillTotalDamage: per, cycleDps: cd - dN }, arts: { skillDps: 0, skillTotalDamage: 0, cycleDps: dN } });
    }
    // S2 恩赐(攻击力+130%)/ S3 降临(间隔 -1.5s、攻击力+50%):技能期普攻物理 + 天赋 DOT 法伤
    const perPhys = P(skillAtk);
    const dS = dotDps(atkNow);
    const h = durHits(skillDuration, sI);
    const physTot = perPhys * h, artsTot = dS * skillDuration;   // DOT 按每秒结算至技能结束(与出手次数无关)
    const tot = physTot + artsTot;
    return mk('physical', tot / (skillDuration || 1), tot, null, sI, {
      physical: { skillDps: physTot / (skillDuration || 1), skillTotalDamage: physTot, cycleDps: null },
      arts: { skillDps: artsTot / (skillDuration || 1), skillTotalDamage: artsTot, cycleDps: null },
    });
  }

  // ---- 八幡海铃(char_4186_tmoris) ----
  if (op.id === 'char_4186_tmoris') {
    if (skillIndex === 0) {
      // S1 颤栗之弦:攻击回复手动触发 → 发动 5 连击,每击 atk_scale 攻击力的法术伤害
      // (其他 Ave Mujica 成员开启技能额外释放一次 —— 用户口径 2026-09-18:不计)
      const per = 5 * A(skillAtk);
      const cd = calcCycleDps(levelData, nI, P(panelAtk), per);
      return mk('arts', 0, per, cd, nI, { arts: { skillDps: 0, skillTotalDamage: per, cycleDps: cd } });
    }
    // S2 无存之所:立即恐惧(控制非输出),技能期间停止普攻,每秒对范围内敌人造成 attack@atk_scale 攻击力法伤
    const tick = levelData['attack@interval'] > 0 ? levelData['attack@interval'] : 1;
    const perTick = A(atkNow * (levelData['attack@atk_scale'] || 0));
    const ticks = Math.max(1, Math.floor(skillDuration / tick + 1e-9));
    const tot = perTick * ticks;
    return mk('arts', perTick, tot, null, tick, { arts: { skillDps: perTick, skillTotalDamage: tot, cycleDps: null } });
  }

  // ---- 水月(char_437_mizuki) ----
  if (op.id === 'char_437_mizuki') {
    if (skillIndex === 0) {
      // S1 唤醒:自动回复自动触发 → 下次攻击造成 atk_scale 攻击力物理伤害,且第一天赋伤害倍率提升至 talent_scale 倍
      const perPhys = P(skillAtk);
      const perArts = wArts(panelAtk, wScale);
      const per = perPhys + perArts;
      const nHit = P(panelAtk) + wArts(panelAtk, wScaleBase);
      const cd = calcCycleDps(levelData, nI, nHit, per);
      return mk('physical', 0, per, cd, nI, {
        physical: { skillDps: 0, skillTotalDamage: perPhys, cycleDps: calcCycleDps(levelData, nI, P(panelAtk), perPhys) },
        arts: { skillDps: 0, skillTotalDamage: perArts, cycleDps: calcCycleDps(levelData, nI, wArts(panelAtk, wScaleBase), perArts) },
      });
    }
    // S2 囚徒困境(间隔 -1.5s、攻击力+30%)/ S3 镜花水月(攻击力+150%):技能期普攻物理 + 第一天每击附加法伤
    const perPhys = P(skillAtk);
    const perArts = wArts(atkNow, wScale);
    const h = durHits(skillDuration, sI);
    const physTot = perPhys * h, artsTot = perArts * h;
    const tot = physTot + artsTot;
    return mk('physical', tot / (skillDuration || 1), tot, null, sI, {
      physical: { skillDps: physTot / (skillDuration || 1), skillTotalDamage: physTot, cycleDps: null },
      arts: { skillDps: artsTot / (skillDuration || 1), skillTotalDamage: artsTot, cycleDps: null },
    });
  }

  // ---- 绮良(char_478_kirara) ----
  if (op.id === 'char_478_kirara') {
    if (skillIndex === 0) {
      // S1 锚击:攻击回复自动触发 → 下次攻击额外造成 kirara_s_1.atk_scale(120%)攻击力的法术伤害
      const sc = levelData['kirara_s_1.atk_scale'] || 0;
      const physHit = P(panelAtk);
      const artsHit = A(panelAtk * sc);
      const per = physHit + artsHit;
      const cd = calcCycleDps(levelData, nI, physHit, per);
      return mk('physical', 0, per, cd, nI, {
        physical: { skillDps: 0, skillTotalDamage: physHit, cycleDps: calcCycleDps(levelData, nI, physHit, physHit) },
        arts: { skillDps: 0, skillTotalDamage: artsHit, cycleDps: calcCycleDps(levelData, nI, 0, artsHit) },
      });
    }
    // S2 锚点捕捉:天赋效果提升(talent_scale,仅回血)、停止普攻,每秒对范围内敌人造成 attack@atk_scale 攻击力法伤
    const tick = levelData['attack@duration'] > 0 ? levelData['attack@duration'] : 1;
    const perTick = A(atkNow * (levelData['attack@atk_scale'] || 0));
    const ticks = Math.max(1, Math.floor(skillDuration / tick + 1e-9));
    const tot = perTick * ticks;
    return mk('arts', perTick, tot, null, tick, { arts: { skillDps: perTick, skillTotalDamage: tot, cycleDps: null } });
  }

  return calcDamage(c);
}

// ===== 特种·行商(merchant) =====
// 特性(再部署时间减少、撤退不返还部署费用、在场时每 3 秒消耗 3 点部署费用)非输出,不建模。
// 用户口径 2026-09-18:孑「解剖高手」、裁度「谨慎择客」、老鲤「和气生财」、乌有「出其不意」的
//   攻击力/攻速/伤害增幅一律默认不计算(条件类或概率类);乌有 S2 的随机「攻击速度+25」不计;
//   孑 S2 的治疗、乌有 S1 的回血给出治疗量。
function calcMerchantSkill(op, slotData, c) {
  const { panelAtk, skillAtk, effDef, effRes, realInterval, skillRealInterval, levelData, skillIndex } = c;
  const mIvl = skillRealInterval > 0 ? skillRealInterval : (realInterval > 0 ? realInterval : 1);
  const nIvl = realInterval > 0 ? realInterval : 1;
  const P = (a) => calcPhysicalDamage(a, effDef);
  if (op.id === 'char_272_strong') {
    // 孑(4★):S1 断螯 / S2 刺身拼盘 均为「自动回复·自动触发·持续时间无限」的常驻攻击强化。
    // S1:攻击力+50%(专一),命中目标失去特殊能力(沉默)。S2:攻击力+50%,
    // 且每次攻击治疗周围一名友方(含自身)相当于造成伤害 40%(专一)的生命值 → 给出技能期治疗量(用户口径 2026-09-18)。
    const dps = P(skillAtk) / mIvl;
    const heal = skillIndex === 1 ? dps * (levelData.scale || 0) : 0;
    return {
      type: heal > 0 ? 'heal' : 'damage', damageType: 'physical', normalDamageType: 'physical',
      skillDps: dps, skillTotalDamage: 0, cycleDps: null, normalDps: null,
      skillHps: heal > 0 ? heal : null, normalHps: null, totalHeal: null,
      isToggle: false, isPermanent: true, realInterval: mIvl, panelAtk: skillAtk,
      dmgTypes: { physical: { skillDps: dps, skillTotalDamage: 0, cycleDps: null } },
    };
  }
  if (op.id === 'char_322_lmlee' && skillIndex === 1) {
    // 老鲤 S2 驱凶辟邪(手动,dur0 触发型):被动效果 攻击速度+20;主动开启标记目标,5 秒后标记爆炸
    // 对周围造成 攻击力×(default_atk_scale + factor_atk_scale×叠层次数) 的法术伤害。
    // 叠层次数来自「我方对目标造成伤害的次数」,但标记只存在 paper_duration(=5) 秒 → 用户口径 2026-09-18:
    // 只计 5 次(而非满层 max_stack_cnt=25),直接用 blackboard.paper_duration。
    const stacks = levelData.paper_duration || 0;
    const boomMul = (levelData.default_atk_scale || 0) + (levelData.factor_atk_scale || 0) * stacks;
    const boom = calcArtsDamage(panelAtk * boomMul, effRes);
    const sp = levelData.spCost > 0 ? levelData.spCost : 10;
    const cycleDps = sp > 0 ? (Math.floor(sp / mIvl) * P(panelAtk) + boom) / sp : 0;
    return {
      type: 'damage', damageType: 'arts', normalDamageType: 'physical',
      skillDps: 0, skillTotalDamage: boom, cycleDps,
      normalDps: P(panelAtk) / nIvl, skillHps: null, normalHps: null, totalHeal: null,
      isToggle: false, isPermanent: false, realInterval: mIvl, panelAtk,
      dmgTypes: { arts: { skillDps: 0, skillTotalDamage: boom, cycleDps } },
    };
  }
  if (op.id === 'char_1033_swire2' && skillIndex === 1) {
    // 琳琅诗怀雅 S2「见面礼」(PASSIVE 无时长):技能主动 = 放置一个香槟炸弹(按陷阱处理)。
    // 用户口径 2026-09-18:技能期总伤 = 一个陷阱造成的伤害 = 攻击力×atk_scale(专一 1.8)物理;
    // 技能期 DPS 记 0;常态化列 = 自身普攻。(陷阱建模口径,与陷阱师子职业一致)
    const s2Trap = P(panelAtk * (levelData.atk_scale || 1));
    return {
      type: 'damage', damageType: 'physical', normalDamageType: 'physical',
      skillDps: 0, skillTotalDamage: s2Trap, cycleDps: null,
      normalDps: P(panelAtk) / nIvl, skillHps: null, normalHps: null, totalHeal: null,
      isToggle: false, isPermanent: false, realInterval: mIvl, skillAtkOut: panelAtk,
      dmgTypes: { physical: { skillDps: 0, skillTotalDamage: s2Trap, cycleDps: null } },
    };
  }
  // 琳琅诗怀雅 S3 千金一掷(自动触发·持续时间无限):攻击变为二连击(顶层 atk_scale 1.3 实为
  // 「关闭技能时每枚金币」的弹道倍率,不作攻击力乘算 → 已由 SKILL_ATK_SCALE_EXCLUDE 排除);
  // 主动关闭时消耗所有金币(上限 10)对前方敌人随机攻击,每枚金币造成攻击力×atk_scale 物理伤害。
  // 用户口径 2026-09-18:S3 = 二连击 + 关闭金币爆发(按 10 枚)。
  const swDps = P(panelAtk) * 2 / mIvl;
  const swBurst = P(panelAtk * (levelData.atk_scale || 1)) * 10;
  return {
    type: 'damage', damageType: 'physical', normalDamageType: 'physical',
    skillDps: swDps, skillTotalDamage: swBurst, cycleDps: null, normalDps: null,
    skillHps: null, normalHps: null, totalHeal: null,
    isToggle: false, isPermanent: false, realInterval: mIvl, panelAtk,
    dmgTypes: { physical: { skillDps: swDps, skillTotalDamage: swBurst, cycleDps: null } },
  };
}

// ===== 特种·陷阱师(traper) =====
// 特性(可放置陷阱/召唤物,陷阱触发造成伤害)非输出,不建模。
// 用户口径 2026-09-18(陷阱建模口径,与行商 琳琅诗怀雅 S2 一致,后续子职业沿用):
//   技能主动 = 放置陷阱的技能 → 技能期 DPS 记 0、技能期总伤 = 一个陷阱触发造成的伤害
//   = 攻击力 × 陷阱倍率(atk_scale 或 attack@atk_scale);常态化列 = 自身普攻;陷阱不单独成条
//   (已确认 data/TOKEN/index.json 无陷阱 token)。
//   天赋:多萝西「梦想家」攻击力增幅默认叠满(TALENT_ATK_DRIVERS,×max_stack_cnt);
//        艾拉「正中靶心」30% 概率部分默认不计,只把「对受陷阱影响目标必定触发」折成 S2 一次、S3 两次的 ×atk_scale;
//        望「料敌机先」伤害增幅与法抗穿透默认 2 层;钼铅「探险家的从容」(Y 模组 damage_scale)默认不计。
//   数据核查(2026-09-18,对照仓库 skill_table):望 S1/S2/S3 与多萝西 S3 的陷阱为【法术】伤害(望天赋亦为法抗穿透),
//   其余为物理 —— 与任务书「物理结算」表述冲突,已按数据实作并在 tools/traper-report.md 列出待用户验收。
function calcTraperSkill(op, slotData, c) {
  const { panelAtk, effDef, effRes, realInterval, skillRealInterval, levelData, skillIndex } = c;
  const mIvl = skillRealInterval > 0 ? skillRealInterval : (realInterval > 0 ? realInterval : 1);
  const nIvl = realInterval > 0 ? realInterval : 1;
  const P = (a) => calcPhysicalDamage(a, effDef);
  const normalDps = P(panelAtk) / nIvl;
  const mk = (trap, dmgType) => ({
    type: 'damage', damageType: dmgType, normalDamageType: 'physical',
    skillDps: 0, skillTotalDamage: trap, cycleDps: null,
    normalDps, skillHps: null, normalHps: null, totalHeal: null,
    isToggle: false, isPermanent: false, realInterval: mIvl, skillAtkOut: panelAtk,
    dmgTypes: { [dmgType]: { skillDps: 0, skillTotalDamage: trap, cycleDps: null } },
  });
  if (op.id === 'char_4048_doroth') {
    // 多萝西:陷阱倍率 = 顶层 atk_scale。S3 陷阱为法术伤害,其余物理。
    const scale = levelData.atk_scale ?? 1;
    if (skillIndex === 2) return mk(calcArtsDamage(panelAtk * scale, effRes), 'arts');
    return mk(P(panelAtk * scale), 'physical');
  }
  if (op.id === 'char_4123_ela') {
    // 艾拉:天赋「正中靶心」atk_scale(专一 1.5;D 模组 1.6/1.7)——S2 按 1 个陷阱、S3 按 2 个陷阱。
    // S1 陷阱无伤害倍率 → 0。(S2 护盾/穿防、S3 40 发弹药攻击等额外效果默认不计,见报告)
    const tScale = funnelTalentValue(op, slotData, 1, 'atk_scale') || 1.5;
    const n = skillIndex === 1 ? 1 : (skillIndex === 2 ? 2 : 0);
    return mk(n > 0 ? P(panelAtk * tScale) * n : 0, 'physical');
  }
  if (op.id === 'char_2027_wang') {
    // 望:陷阱为法术伤害;「料敌机先」默认 2 层(伤害 +2×per_atk_scale,法抗穿透 2×per_magic_resist_penetrate_fixed)。
    const per = funnelTalentValue(op, slotData, 1, 'attack@per_atk_scale') || 0;
    const pen = funnelTalentValue(op, slotData, 1, 'attack@per_magic_resist_penetrate_fixed') || 0;
    const mul = 1 + per * 2;
    const res = Math.max(0, effRes - pen * 2);
    const scale = levelData.atk_scale !== undefined ? levelData.atk_scale : (levelData['attack@atk_scale'] ?? 1);
    return mk(calcArtsDamage(panelAtk * scale * mul, res), 'arts');
  }
  if (op.id === 'char_4171_wulfen') {
    // 钼铅:S1 atk_scale×1;S2「两次」→ 引爆造成两次 atk_scale → ×2(逐击结算)。
    const scale = levelData.atk_scale ?? 1;
    const times = skillIndex === 1 ? 2 : 1;
    return mk(P(panelAtk * scale) * times, 'physical');
  }
  if (op.id === 'char_451_robin') {
    // 罗宾:S1/S2 均为陷阱单次 atk_scale 物理(束缚/推动为控制效果,不计)。
    return mk(P(panelAtk * (levelData.atk_scale ?? 1)), 'physical');
  }
  if (op.id === 'char_458_rfrost') {
    // 霜华:S1 陷阱 atk_scale;S2 踏垫造成 trap_atk_scale 伤害 + 若在攻击范围内则追加 atk_scale×times 次攻击
    // (单目标模型默认在范围内 → 并入一次触发总伤)。
    if (skillIndex === 1) {
      const trap = P(panelAtk * (levelData.trap_atk_scale ?? 0));
      const extra = P(panelAtk * (levelData.atk_scale ?? 0)) * (levelData.times ?? 1);
      return mk(trap + extra, 'physical');
    }
    return mk(P(panelAtk * (levelData.atk_scale ?? 1)), 'physical');
  }
  return mk(0, 'physical');
}

function calculateOperator(op, slotData, ctx) {
  // 辅助·凝滞师(slower):特性「攻击造成法术伤害」——数据 damageType 为 physical,统一按法术结算(常态/技能期/模组档)
  if (SUBPROF_ARTS[op.subProfessionId]) op = { ...op, damageType: 'arts' };
  // 吟游者(及继承其口径的浊心斯卡蒂海嗣 TOKEN):不攻击,输出形式是治疗 → 走 bard 专用分支(见 calcBardSkill)
  const isBard = op.subProfessionId === 'bard' || op.id === 'token_10017_skadi2_dedant';
  const phase = op.phases[slotData.elite] || op.phases[op.phases.length - 1];
  const maxLevel = phase.maxLevel;
  const mod = calcModuleBonus(op, slotData);
  const skillIndex = slotData.skillIndex || 0;
  const isSummon = op.profession === 'TOKEN';
  const equippedSkill = op.skills[skillIndex];
  // PASSIVE 被动技能(星熊「荆棘」def+24%、森蚺「轻型挂斧」atk/def+20%):装备即常驻入面板(与天赋同乘区累加),无技能期
  // (仅干员职业;召唤物的 skcom 被动型技能不在此列,走 summon 分支)
  // 限时被动(PASSIVE 且 duration>0,如芬 S2 执守阵线/野鬃 S1 骑枪刺击/红 S1 处决模式):部署后自动生效 N 秒的一次性强化,
  // 不走被动常驻面板,按技能期=duration 的普通技能计算;永久被动(duration 0)仍常驻入面板。
  // 限时被动判定用「生效时长」:PASSIVE 且 skillDuration>0(野鬃 S1 骑枪刺击/红 S1 处决模式/历阵锐枪芬 S2 执守阵线);
  // 另有部分数据把时长写在 blackboard.duration、skillDuration=-1(宴 S2 落地斩·破门、斯卡蒂 S2 跃浪击),
  // 同属"部署后生效 N 秒"的一次性强化 → 一并按限时被动走技能期,不再并入常驻面板。
  const passiveRaw = (!isSummon && equippedSkill && equippedSkill.levels[0]?.skillType === 'PASSIVE') ? getSkillLevelData(equippedSkill, slotData.skillLevel) : null;
  const passiveRawDur = passiveRaw ? (passiveRaw.skillDuration > 0 ? passiveRaw.skillDuration : (passiveRaw.duration > 0 ? passiveRaw.duration : 0)) : 0;
  const passiveLv = (passiveRaw && !(passiveRawDur > 0) && op.subProfessionId !== 'executor'
    // 琳琅诗怀雅 S2「见面礼」(PASSIVE 无时长):主动=放置香槟炸弹(按陷阱建模)→ 需走技能路径,
    // 否则被当作常驻被动吞掉、陷阱总伤不可见(用户口径 2026-09-18,见 calcMerchantSkill / notes.json)
    && !(op.id === 'char_1033_swire2' && slotData.skillIndex === 1)) ? passiveRaw : null;

  // ======== Panel Stats ========
  const baseAtk = interpolateAttr(phase.atk[0], phase.atk[1], slotData.level, maxLevel);
  const baseDef = interpolateAttr(phase.def[0], phase.def[1], slotData.level, maxLevel);
  const baseHp = interpolateAttr(phase.maxHp[0], phase.maxHp[1], slotData.level, maxLevel);

  const trustAtk = op.trustBonus.atk * (slotData.trustPercent / 100);
  const trustDef = op.trustBonus.def * (slotData.trustPercent / 100);

  let potAtk = 0, potDef = 0, potHp = 0;
  const potRank = slotData.potentialRank || 0;
  if (potRank > 0 && op.potentialRanks) {
    for (let i = 0; i < Math.min(potRank, op.potentialRanks.length); i++) {
      for (const m of (op.potentialRanks[i].modifiers || [])) {
        if (m.attr === 'ATK' && m.formula === 'ADDITION') potAtk += m.value;
        if (m.attr === 'DEF' && m.formula === 'ADDITION') potDef += m.value;
        if (m.attr === 'MAX_HP' && m.formula === 'ADDITION') potHp += m.value;
      }
    }
  }

  const rawAtk = baseAtk + trustAtk + potAtk + mod.atk + calcTalentStealAtk(op, slotData);  // 伊内丝影织偷攻:平加基础攻击(白值面板不显示)
  const rawDef = baseDef + trustDef + potDef + mod.def;
  let talentAtk = calcTalentAtkBonus(op, slotData);
  const pctTalent = calcTalentHpDefMul(op, slotData);  // 常驻生命/防御百分比天赋
  if (passiveLv) {  // 被动技能乘区与天赋同区累加(装备即生效)
    if (passiveLv.atk !== undefined) talentAtk += passiveLv.atk;
    if (passiveLv.def !== undefined) pctTalent.defMul += passiveLv.def;
    if (passiveLv.max_hp !== undefined) pctTalent.hpMul += passiveLv.max_hp;
    // 非标准键名的被动属性加成(凯瑟琳 S1「岁月锻打」s1_atk/s1_def;装置默认不放置 → 只计自身)
    const pk = (PASSIVE_ATTR_KEYS[op.id] || {})[slotData.skillIndex ?? 0];
    if (pk) {
      if (pk.atk && typeof passiveLv[pk.atk] === 'number') talentAtk += passiveLv[pk.atk];
      if (pk.def && typeof passiveLv[pk.def] === 'number') pctTalent.defMul += passiveLv[pk.def];
    }
  }
  // 模组天赋强化:X模组 L2 把「法典」攻速覆盖为 15/18;Y 模组走基础天赋(10/13)。
  const enh = calcModuleTalentEnhance(op, slotData);
  const talentAspd = enh.attackSpeed !== null ? enh.attackSpeed : calcTalentAttackSpeed(op, slotData);
  // 附加常态攻击乘算:仅闪灵 X模组≥2级 且装备 2技能(自动掩护)时,面板攻击 ×(1+0.15/0.25) 直接乘算。
  // (白名单限定:其他干员 te 的 atk 同名增强已由 calcTalentAtkBonus 消费,不可走此通道——可露希尔 X3 曾双吃 ×1.76)
  const extraAtkMul = (op.id === 'char_147_shining' && enh.extraAtkMul && slotData.skillIndex === 1) ? enh.extraAtkMul : 0;
  // 战术家分支特性:自身攻击援军(召唤物)阻挡的敌人时攻击力提升至150%——攻击力乘区(非伤害乘区,提高破甲线),
  // 单目标模型默认召唤物在场并阻挡目标 → 本体攻击常驻 ×1.5(面板白值与伤害统一含;召唤物本体不享受)
  const isTacticianOp = !isSummon && op.profession === 'PIONEER' && op.subProfessionId === 'tactician';
  // 重剑手·赫德雷「及锋而试」(用户口径 2026-09-17:仅计算基础加成):攻击敌人时攻击力提升至 110%(E2 潜0 基础档),
  // 属攻击力乘区(逐击先乘再减防)→ 直接并入面板乘区(等价);晕眩/束缚中的 140% 档为条件类不计。
  // Y 模组「笔迹」te 把基础档覆盖为 120%/130%(经 funnelTalentValue 感知模组 te)。
  const hodrerAtkScale = op.id === 'char_4088_hodrer' ? (funnelTalentValue(op, slotData, 0, 'atk_scale_2') || 1) : 1;
  // 吟游者自身不受鼓舞影响(不吃别人的鼓舞加成);浊心斯卡蒂「捕食习性」是自身攻击力加成(影响治疗量与 S3 真伤)
  const bardAtkMul = isBard ? bardSelfAtkMul(op, slotData) : 1;
  const execTraitAtk = executorTraitAtkMul(op, slotData);  // 处决者 Y 模组特性:周围四格无友军(默认成立) atk+10%
  let panelAtk = rawAtk * (1 + talentAtk + extraAtkMul + execTraitAtk) * (isTacticianOp ? 1.5 : 1) * hodrerAtkScale * bardAtkMul;
  const flatDefRegen = calcTalentFlatDefPctRegen(op, slotData);
  const flatAttr = calcTalentFlatAttr(op, slotData);
  const modUncond = calcModuleUncondAttr(op, slotData);  // 模组特性追加/常驻段无条件属性(号角 Y 攻速/def)
  let panelDef = rawDef * (1 + pctTalent.defMul + modUncond.defMul) + (flatDefRegen ? flatDefRegen.flatDef : 0) + flatAttr.defFlat;
  const panelHp = (baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp + mod.maxHp) * (1 + pctTalent.hpMul);

  // ======== Skill Modifiers ========
  const skill = passiveLv ? null : equippedSkill;   // PASSIVE 无技能期:走 no-skill 路径(面板已含被动加成)
  const isMedic = op.profession === 'MEDIC';
  // 固定法抗穿透(史尔特尔「熔火」):常态与技能期法伤结算统一吃有效法抗
  const resPen = calcTalentResPen(op, slotData);
  // 命中减抗天赋(夜烟黑色迷雾):每击先减抗再结算 → 等效法抗 ×(1+mr)
  const hitMrMul = calcTalentHitMrMul(op, slotData);
  const effRes = Math.max(0, (state.enemy.res || 0) - resPen) * hitMrMul * calcTalentMrDebuffMul(op, slotData);  // 含天赋级敌方减抗(伊芙利特精神融解)
  // 固定物理穿防(伺夜「狼群天性」):常态与技能期物理结算统一减有效防御(同 resPen 模式)
  const defPenFixed = calcTalentDefPenFixed(op, slotData);
  // 有效防御:固定穿防直接减(defPenFixed=0 干员与 enemy.def 等价,函数内物理结算统一引用)
  // 偷取防御稳态(伺夜 Y 模组叠满:目标减防至上限,无模组为 0)
  const defStealSteady = calcTalentDefStealSteady(op, slotData);
  const defIgnorePct = calcTalentDefIgnorePct(op, slotData) + demetrDefDownPct(op, slotData, slotData.skillIndex ?? -1);
  const effDef = Math.max(0, state.enemy.def * (1 - defIgnorePct) - defPenFixed - defStealSteady);
  // 攻速总加成 = 天赋攻速(含模组覆盖)+ 模组白值攻速(100 基准上加算),再换算攻击间隔
  const baseAspdBonus = talentAspd + mod.attackSpeed + modUncond.aspd;
  const talentBat = calcTalentBatAdd(op, slotData);
  const realInterval = hunterCycleInterval(calcRealInterval(phase.baseAttackTime + talentBat, 100 + baseAspdBonus + phenxiNormalAspd(op, slotData)), op, slotData, null);

  // No skill: return normal stats only
  if (!skill) {
    const healScale = calcTalentHealScale(op, slotData) * (enh.healScale || 1);  // 无技能干员也乘常驻治疗倍率
    const healRatio = 1.0;
    // 工匠(craftsman)装置类召唤物:无技能、不攻击不治疗 → 输出全 0(仅占位置;给友方的增益不建模)
    if (INERT_SUMMONS.includes(op.id)) {
      return { type: 'damage', damageType: 'physical', normalDamageType: 'physical', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: 0, skillHps: null, normalHps: null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk };
    }
    // 召唤师(summoner)召唤物:独立成条(「特殊-干员附带单位」),槽位与持有者技能一一对应;未关联的技能槽输出 0
    if (isSummonerToken(op)) {
      return calcSummonerToken({ op, slotData, panelAtk, realInterval, levelData: null, skillIndex: -1, isPermanent: false, skillDuration: 0, ownerPanelAtk: summonerOwnerPanelAtk(op, slotData), enemy: state.enemy });
    }
    if (isMedic) {
      // 咒愈师:常态普攻=法术伤害 + 治疗 scale×伤害(单目标模型默认治疗目标=自身,必在攻击范围)
      if (op.subProfessionId === 'incantationmedic') {
        const traitScale = calcTraitScale(op, slotData) ?? 0.5;
        const fragileMul = calcMagicFragileMul(op, slotData);  // 法脆必触发增伤(芙蓉:伤害×1.06~1.14)
        const normalHit = calcArtsDamage(panelAtk, state.enemy.res) * fragileMul;
        const hpsPerSec = normalHit * traitScale * healScale / realInterval;
        return { type: 'heal', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: normalHit / realInterval, skillHps: null, normalHps: hpsPerSec, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk, damageType: 'arts', normalDamageType: 'arts' };
      }
      const normalHeal = panelAtk * healRatio * healScale;
      // 落地点火天赋(Lancet-2「救援喷雾」:部署即回血)是一次性给量,无"技能期 HPS"——只给总治疗量
      const dHeal = calcDeployBurstSkill(op, slotData, panelAtk, realInterval);
      const isDeployHeal = !!dHeal && dHeal.damageType === 'heal';
      return { type: 'heal', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null, skillHps: null, normalHps: normalHeal / realInterval, totalHeal: isDeployHeal ? dHeal.total : null, isToggle: false, isPermanent: false, realInterval, panelAtk };
    }
    // 吟游者(bard):不攻击 → 常态无 DPS,输出形式是治疗(每秒一跳,特性比率×攻击力;三角初华另有天赋额外治疗)
    if (isBard) {
      const hps = panelAtk * bardTraitRatio(op, null) + panelAtk * bardTalentHealRate(op, slotData);
      return { type: 'heal', damageType: 'arts', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null, skillHps: null, normalHps: hps, totalHeal: null, isToggle: false, isPermanent: false, realInterval: 1, panelAtk };
    }
    // 护佑者(blessing):常态是法术伤害普攻(技能开启后才改为治疗) → 常态只有 DPS,无治疗
    if (op.subProfessionId === 'blessing') {
      const normHit = calcArtsDamage(panelAtk, effRes);
      return { type: 'damage', damageType: 'arts', normalDamageType: 'arts', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: normHit / realInterval, skillHps: null, normalHps: null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk };
    }
    // 巫役(ritualist):常态 = 法术普攻 + 天赋损伤爆条均摊;PhonoR-0(1★)为落地点火(部署后 40s 附带固定点凋亡损伤 + 法术/元素脆弱)
    if (op.subProfessionId === 'ritualist') {
      setRitualEpMul(ritualGradeEpMul(op, slotData));
      const nf = ritualNormalFields(op, slotData, panelAtk, state.enemy, realInterval, ritualCandSource);
      if (op.id === 'char_4136_phonor') {
        const dep = calcPhonorDeploy({ op, slotData, panelAtk, realInterval, enemy: state.enemy, candSourceFor: ritualCandSource });
        if (dep) return dep;
      }
      return { type: 'damage', damageType: 'arts', normalDamageType: 'arts', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: nf.normalDps, normalTypes: nf.normalTypes, skillHps: null, normalHps: null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk };
    }
    const isArts = op.damageType === 'arts';
    // 弱点伤害干员(赤刃明霄陈 形意洞照,精1+):常态普攻逐击取物理/法伤更高值
    const isWeaknessOn = WEAKNESS_DAMAGE[op.id] === true && calcTalentAtkBonus(op, slotData) > 0;
    const normalDpsRaw = isWeaknessOn
      ? Math.max(calcPhysicalDamage(panelAtk, effDef), calcArtsDamage(panelAtk, effRes))
      : (isArts ? calcArtsDamage(panelAtk, effRes) : calcPhysicalDamage(panelAtk, effDef));
    // 本源铁卫 no-skill：天赋损伤源常驻（珊比每击侵蚀/余每秒灼燃+法伤/响石每秒神经），常态三档展示
    if (op.profession === 'TANK' && op.subProfessionId === 'primprotector' && primNormalFields) {
      const norm = primNormalFields(op, slotData, panelAtk, state.enemy);
      const isMed = op.id === 'char_2026_yu' && norm.normalTypes.arts; // 余常态含每秒法伤
      return { type: 'damage', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: norm.normalDps, normalTypes: norm.normalTypes, skillHps: null, normalHps: null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk, damageType: isMed ? 'physical' : 'physical', normalDamageType: 'physical' };
    }
    // 阵法术师:特性「通常时不攻击」→ 常态不造成伤害(normalDps = 0)
    // 解放者(librator):特性「通常不攻击且阻挡数为 0」→ 无技能态常态行记 0(用户口径 2026-09-17)
    const normalDps = (op.subProfessionId === 'phalanx' || op.subProfessionId === 'librator') ? 0
      : (op.subProfessionId === 'lord'
        ? Math.max(calcPhysicalDamage(panelAtk * LORD_REMOTE_MUL, effDef), acdropMinDamage(op, slotData, panelAtk * LORD_REMOTE_MUL))
        : Math.max(normalDpsRaw * (op.id === 'char_2024_chyue' ? 2 : 1), acdropMinDamage(op, slotData, panelAtk))) / realInterval * (op.subProfessionId === 'funnel' ? calcFunnelMuls(op, slotData, -1, {}, 0, 0).normalMul : 1)  // 驭械术师:无技能槽常态=本体+浮游单元(满层)
        * ifritNormalFields(op, slotData, panelAtk, realInterval, effRes).factor  // 伊芙利特 Δ/D 模组:常态法伤按爆条窗口(法抗-20)平均修正
        + calcArtsDamage(calcTalentFlatDotDps(op, slotData), state.enemy.res)  // 附带固定 DOT 天赋(维伊"战争技艺"/深巡"细胞活性抑制剂"):常态普攻同样施加 → 并入常态秒伤
        + ifritNormalFields(op, slotData, panelAtk, realInterval, effRes).elementDps  // Δ/D 模组:常态化元素爆条平均 DPS
        + bombarderNormalExtraDps(op, slotData, panelAtk, effDef, realInterval)  // 投掷手特性:常态普攻的余震(含保底伤害)
        + loopshooterExtraAtkDps(op, slotData, panelAtk, effDef, realInterval)  // 回环射手:娜仁图亚偷取攻击力(默认满层)
        + executorNormalExtraDps(op, slotData, panelAtk, effRes, realInterval)  // 处决者:常态化列附加段(麒麟R夜刀第一天赋法伤)
    // 常驻伤害乘区（勇冠三军等）：常态普攻同步乘
    const normType = isWeaknessOn ? (calcPhysicalDamage(panelAtk, effDef) >= calcArtsDamage(panelAtk, state.enemy.res) ? 'physical' : 'arts') : (isArts ? 'arts' : 'physical');
    // 剥壳类每击附加法伤(按敌方防御):常态普攻频率并入(不吃伤害乘区,独立加算;递增模组取稳态上限)
    const normFlat = defHitArtsMax(op, slotData);
    // 落地点火/开局定时触发天赋(虎狼丸等):其伤害移入技能期显示,常态只留普攻
    const deployBurst = calcDeployBurstSkill(op, slotData, panelAtk, realInterval);
    // 特种·伏击客(stalker):常态普攻(物理) + 天赋/被动附加法伤(水月每击附加、阿斯卡纶 DOT、伊桑被动 DOT)
    if (op.subProfessionId === 'stalker') {
      const stArts = stalkerNormalExtras(op, slotData, panelAtk, effRes, realInterval);
      const stPhys = normalDps * calcTalentDmgMul(op, slotData);
      const stRegen = calcTalentFlatDefPctRegen(op, slotData);
      const stHps = calcTalentHps(op, slotData) + (stRegen ? panelHp * stRegen.ratio : 0);
      return { type: stHps > 0 ? 'heal' : 'damage', damageType: 'physical', normalDamageType: 'physical', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: stPhys + stArts, skillHps: null, normalHps: stHps > 0 ? stHps : null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk, normalTypes: stArts > 0 ? { physical: { dps: stPhys }, arts: { dps: stArts } } : undefined };
    }
    return { type: 'damage', skillDps: deployBurst ? deployBurst.dps : 0, skillTotalDamage: deployBurst ? deployBurst.total : 0, cycleDps: null, normalDps: normalDps * calcTalentDmgMul(op, slotData) + normFlat / realInterval + calcBluePoisonDps(op, slotData, state.enemy) + (op.subProfessionId === 'lord' ? lordThornsDotDps(op, slotData) : 0), skillHps: null, normalHps: null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk, damageType: normType, normalDamageType: normType, deploySkill: !!deployBurst, dmgTypes: deployBurst ? { [deployBurst.damageType]: { skillDps: deployBurst.dps, skillTotalDamage: deployBurst.total, cycleDps: null } } : undefined };
  }

  const levelData = getSkillLevelData(skill, slotData.skillLevel);

  // Mon3tr S2「超负荷」:第二天赋(战术协同)效果 ×talent_scale 放大--自身治疗持续刷新天赋 buff,
  // 技能期等效攻速 = 常驻天赋攻速 × talent_scale(无重构体也不影响自身触发)
  const skillAspdExtra = (levelData.talent_scale !== undefined && op.id === 'char_4179_monstr')
    ? talentAspd * (levelData.talent_scale - 1) : 0;

  let skillAtk = panelAtk;
  let skillDef = panelDef;
  const skillOnlyAspd = calcTalentSpdSkillOnly(op, slotData);
  let skillInterval = calcRealInterval(phase.baseAttackTime + talentBat, 100 + baseAspdBonus + skillAspdExtra + skillOnlyAspd + phenxiSkillAspd(op, slotData));
  let skillDuration = levelData.skillDuration || 0;
  // 手动开启的限时增益(skillDuration=-1 + duration>0,自身必然获得,如华法琳「不稳定血浆」):
  // 视为持续型技能,技能期长度 = duration。
  if (skillDuration === -1 && levelData.duration > 0 && levelData.atk !== undefined && (levelData.skillType === 'MANUAL' || levelData.skillType === 'PASSIVE')) {
    skillDuration = levelData.duration;
  }
  // 前段延迟输出(泥岩 S3 秽壤的血脉:前 10s 沉睡无敌无输出,仅后 20s 攻击计算)
  const delayedSec = (DELAYED_OUTPUT[op.id] || {})[skillIndex];
  if (delayedSec) skillDuration = Math.max(0, skillDuration - delayedSec);
  // 佣兵「装备应变」视为开启(用户口径 2026-09-17):技能期时长的额外加成计入技能期长度
  const aeDur = (ALTER_EQUIP_DURATION[op.id] || {})[skillIndex];
  if (aeDur && typeof levelData[aeDur] === 'number') skillDuration += levelData[aeDur];

  const modifiers = [];
  // 技能开启期间常驻光环天赋加倍(阿米娅(近卫)「青色怒火」:青色怒火开技效果 ×2,补一份 talentAtk)
  const talentAtkMul = (SKILL_TALENT_ATK_MUL[op.id] || {})[skillIndex];
  if (talentAtkMul && talentAtk > 0) modifiers.push({ value: talentAtk * (talentAtkMul - 1), operator: 'direct_mul' });
  // 技能攻击力增幅:顶层 atk;缺省时查前缀别名键(焰苇S3 reed2_skil_3[switch_mode].atk)
  const atkKey = (SKILL_ATK_KEY_OVERRIDES[op.id] || {})[skillIndex] || 'atk';
  const atkExcluded = (SKILL_ATK_EXCLUDE[op.id] || {})[skillIndex] === true;
  if (levelData[atkKey] !== undefined && !atkExcluded) modifiers.push({ value: levelData[atkKey], operator: 'direct_mul' });
  // attack@atk:守望者普攻攻击力加成(风絮2技能"起飞"攻击力+X%)与顶层 atk 同乘区累加
  if (levelData['attack@atk'] !== undefined) modifiers.push({ value: levelData['attack@atk'], operator: 'direct_mul' });
  if (levelData.def !== undefined) modifiers.push({ value: levelData.def, operator: 'final_mul' });
  // atk_scale:输出技能的伤害/治疗倍率。图耶「水流环」的 atk_scale 是屏障吸收倍率,
  // 其治疗部分无倍率(= 普攻治疗),故触发型一次性普攻治疗时不用 atk_scale 算 skillAtk。
  // 限定:仅医疗、手动触发、带 blackboard 持续(duration)、无 atk 加成,
  // 以区分陈「赤霄·拔刀/绝影」(近卫,伤害倍率)与焰影苇草「枯荣共息」(行医,火球伤害倍率)。
  const isOneShotHeal = isMedic && levelData.skillType === 'MANUAL' && levelData.atk_scale !== undefined && levelData.duration !== undefined && levelData.heal_scale === undefined && levelData.atk === undefined;
  // atk_scale 排除:车尔尼 S2 的 2.1 是技能结束爆炸倍率,不作普攻倍率乘算
  const scaleExcluded = (SKILL_ATK_SCALE_EXCLUDE[op.id] || {})[skillIndex] === true;
  const asOverride = (SKILL_ATTACK_SPEED_OVERRIDES[op.id] || {})[skillIndex];
  if (asOverride !== undefined) { skillInterval = calcRealInterval(phase.baseAttackTime + talentBat, 100 + baseAspdBonus + skillAspdExtra + skillOnlyAspd + asOverride); }
  else if (levelData.attack_speed) skillInterval = calcRealInterval(phase.baseAttackTime + talentBat, 100 + baseAspdBonus + skillAspdExtra + skillOnlyAspd + levelData.attack_speed);
  // base_attack_time:负值=加算秒(白面鸮脑啡肽 -2.1 等);(0,1) 正小数=攻击间隔倍率("间隔缩短至 x 倍",
  // 清流涌泉 ×0.12、安洁莉娜微粒模式 ×0.15、风笛闭膛连发 ×0.7,官方描述均为"间隔(极)大幅度缩短")。
  // 描述为"间隔增大"却给正小数的技能(火神S2 +0.4s/斥罪S3 +0.9s)经 BAT_ADD_OVERRIDES 按加算秒处理。
  if (levelData.base_attack_time) {
    let bat = levelData.base_attack_time;
    // 间隔缩短值折算(能天使「过载模式」:数据 -0.11 与游戏描述 -0.22 差一倍,见 BAT_SCALE_OVERRIDES)
    const batScale = (BAT_SCALE_OVERRIDES[op.id] || {})[skillIndex] || 1;
    if (batScale !== 1) bat = bat * batScale;
    if ((INTERVAL_GROW_OVERRIDES[op.id] || {})[skillIndex]) {
      // 间隔增大(+X%):base_attack_time 为增幅 → 间隔 ×(1+X)(天火 S2 +70%、夕 S3 +40%)
      skillInterval = calcRealInterval(phase.baseAttackTime * (1 + bat), 100 + baseAspdBonus + skillAspdExtra + skillOnlyAspd);
    } else {
      const isAdd = (BAT_ADD_OVERRIDES[op.id] || {})[skillIndex] === true;
      const isPct = (BAT_PCT_OVERRIDES[op.id] || {})[skillIndex] === true;   // 负数按"缩短 X%"解释 → ×(1+bat)
      skillInterval = (isPct || (bat > 0 && bat < 1 && !isAdd))
        ? calcRealInterval((phase.baseAttackTime + talentBat) * (isPct ? 1 + bat : bat), 100 + baseAspdBonus + skillAspdExtra + skillOnlyAspd)
        : calcRealInterval(phase.baseAttackTime + talentBat + bat, 100 + baseAspdBonus + skillAspdExtra + skillOnlyAspd);
    }
  }
  // attack@base_attack_time:守望者普攻间隔乘算系数(风絮1技能 0.2 → 间隔 ×0.2,区别于顶层 base_attack_time 的加算秒数)
  if (levelData['attack@base_attack_time']) skillInterval = skillInterval * levelData['attack@base_attack_time'];

  if (modifiers.length > 0 || talentAtk > 0) {
    // 直接乘算累加:技能期攻击力 = 白值 × (1 + 天赋atk + 模组装备乘算 + 技能atk)
    // (extraAtkMul 仅装备特定技能时非 0,与带 atk 技能的乘算互斥,同区累加安全)
    skillAtk = calcAttribute(rawAtk, [
      { value: talentAtk, operator: 'direct_mul' },
      { value: extraAtkMul, operator: 'direct_mul' },
      ...modifiers.filter(m => m.operator === 'direct_mul')
    ]) * (isTacticianOp ? 1.5 : 1);  // 战术家特性攻击×1.5:技能期攻击力同样基于 rawAtk 重算,需与面板同乘
    skillDef = calcAttribute(rawDef, modifiers.filter(m => m.operator === 'final_mul'));
  }
  // atk_scale 输出倍率:在天赋/atk 重算之后乘(atk_scale 技能同时带常驻加攻天赋时不被重算覆盖,如号角 S1 2.4×+军事要塞20%)
  if (levelData.atk_scale !== undefined && !isOneShotHeal && !scaleExcluded) skillAtk = skillAtk * levelData.atk_scale;
  // attack@atk_scale 普攻改写(注册表驱动):技能期每次攻击伤害倍率改写为该值——仅扩散术士 T2 无顶层 atk 的改写型
  // (天火 S2 天坠之火每击 2.2×atk、寒檀 S2 女巫之泪每击 0.8×atk)。其余带 attack@atk_scale 的技能
  // (暮落S2 times 连发/推进之王S3/机师S3/霍尔海雅S2 等)均已有专用分支消费,不得通用乘以免双倍
  if (((ATK_SCALE_REWRITE[op.id] || []).includes(skillIndex)) && levelData['attack@atk_scale'] !== undefined && skillDuration > 0) skillAtk = skillAtk * levelData['attack@atk_scale'];
  // 阵法术师每击倍率(见 PHALANX_PER_HIT_SCALE)
  const phHitKey = (PHALANX_PER_HIT_SCALE[op.id] || {})[skillIndex];
  const phBaseSkillAtk = skillAtk;  // 阵法术师:每击倍率之前的技能期攻击力(供 DoT / 收尾爆发使用)
  if (phHitKey && levelData[phHitKey] !== undefined) skillAtk = skillAtk * levelData[phHitKey];
  // 凝滞师技能期每击倍率改写(安洁莉娜 S2 微粒模式:间隔极大缩短 ×0.15,每击只造成 40% 攻击力法伤)
  const spHitKey = (SKILL_PER_HIT_SCALE[op.id] || {})[skillIndex];
  if (spHitKey && levelData[spHitKey] !== undefined) skillAtk = skillAtk * levelData[spHitKey];
  // 技能开启期天赋攻击(特米米「荒野法术」+50~100%):常态无加成,开启期与面板同乘区
  if (SKILL_TALENT_ATK_ONLY[op.id] !== undefined && skill) {
    const tOnly = calcSkillTalentAtkOnly(op, slotData);
    if (tOnly > 0) skillAtk = skillAtk * (1 + tOnly);
  }

  // ======== Dispatch ========
  const isToggle = levelData.isToggle || false;
  const isPermanent = levelData.isPermanent === true || (PERMANENT_OVERRIDES[op.id] || []).includes(skillIndex);
  const skillRealInterval = hunterCycleInterval(skillInterval, op, slotData, levelData);
  const isIncantationMedic = op.subProfessionId === 'incantationmedic';
  // 驭法铁卫特性:技能开启时普通攻击变为法术伤害(常态仍物理);技能期=有持续时间/常驻的技能
  const artsProtectorSkill = op.subProfessionId === 'artsprotector' && (skillDuration > 0 || isPermanent) && skillDuration !== 0;
  // 技能期切物理(特米米荒野法术):覆盖职业法术
  const physSkillOn = (SKILL_PHYSICAL_OVERRIDES[op.id] || []).includes(skillIndex);
  const isArts = (op.damageType === 'arts' && !physSkillOn) || ((SKILL_ARTS_OVERRIDES[op.id] || []).includes(skillIndex)) || artsProtectorSkill;
  // 弱点伤害:赤刃明霄陈「形意洞照」精1+ 所有物理/法术伤害逐击取物法更高(精0 无天赋全法术)
  const isWeaknessOn = WEAKNESS_DAMAGE[op.id] === true && calcTalentAtkBonus(op, slotData) > 0;
  // 速射手连射:每发倍率进 skillAtk、发数走 hitCount(与"整次乘算"的 hitMul 语义区分,参见 fastshotMultiHit)
  const fsMulti = op.subProfessionId === 'fastshot' ? fastshotMultiHit(op.id, skillIndex, levelData) : null;
  // 多连击(用户口径 2026-09-17):"attack@times" 是不同的攻击次数 → 每击单独结算(逐击扣减防御/法抗)。
  // 所以每击倍率(attack@atk_scale)进 skillAtk、次数进 hitCount,不再用"整次乘算"的 hitMul(会在减防之后才乘)。
  // 注意:attack@times 只在"整数且 ≥2"时才是攻击次数(能天使 5 连射 times=5);
  // 取小数值(如 荒拉普兰德 S3 times=1.3)是"倍率"而非次数,仍走整次乘算的 hitMul。
  const timesIsCount = typeof levelData['attack@times'] === 'number' && Number.isInteger(levelData['attack@times']) && levelData['attack@times'] >= 2;
  const multiHitData = (!fsMulti && timesIsCount)
    ? { scale: levelData['attack@atk_scale'] !== undefined ? levelData['attack@atk_scale'] : 1, times: levelData['attack@times'] }
    : null;
  const hm = fsMulti || multiHitData;
  if (hm && hm.scale !== 1) skillAtk = skillAtk * hm.scale;
  // 技能期整次伤害乘子:小数 times 倍率(荒拉普兰德 S3 1.3 等)+ MULTI_HIT(每击全额×连击数,与逐击等价)
  const legacyMul = (hm ? 1 : ((levelData['attack@atk_scale'] !== undefined && levelData['attack@times'] !== undefined)
    ? levelData['attack@atk_scale'] * levelData['attack@times'] : 1));
  const hitMul = legacyMul * ((MULTI_HIT[op.id] || {})[skillIndex] || 1)
    * (((SINGLE_CRIT_MUL[op.id] || {})[skillIndex] && levelData['attack@surtr_s_2[critical].atk_scale']) || 1);
  const hitCount = hm ? hm.times : 1;
  // 白金「蓄力攻击」:按技能期实际间隔折算攻击力倍率(常态间隔 1.0s → ×1,不产生影响)
  if (op.id === 'char_204_platnm') { const cMul = calcPlatnmChargeMul(op, slotData, skillInterval); if (cMul !== 1) skillAtk = skillAtk * cMul; }
  const incantMode = (INCANTATION_SPECIAL_MODES[op.id] || {})[skillIndex] || null;
  // 法脆必触发增伤:芙蓉常驻(×damage_scale);焰苇S3 灼痕 100% 触发(talent@prob=1)再乘灼痕档
  const fragileBase = calcMagicFragileMul(op, slotData);
  const fragileExtra = (incantMode === 'burning' && levelData['talent@prob'] === 1) ? calcMagicFragileMul(op, slotData, 0) : 1;

  const funnelMuls = op.subProfessionId === 'funnel'
    ? calcFunnelMuls(op, slotData, skillIndex, levelData, skillDuration, skillRealInterval, { panelAtk, skillAtk, baseInterval: realInterval })
    : { normalMul: 1, skillMul: 1 };

  const params = {
    panelAtk, baseAtk, rawAtk, talentAtk, skillAtk: (op.subProfessionId === 'lord' ? skillAtk * lordAtkMul(op, skillIndex) : skillAtk), panelHp, realInterval: skillRealInterval, normalInterval: realInterval, baseInterval: phase.baseAttackTime, skillDuration,
    isToggle, isPermanent, levelData, isArts, normalTypeArts: op.damageType === 'arts', hitMul, hitCount,
    isIncantationMedic, enemy: state.enemy,
    incantMode,
    traitScale: calcTraitScale(op, slotData),
    magicFragileMul: fragileBase * fragileExtra,          // 技能期法脆(含技能期才必触发的部分)
    normalMagicFragileMul: fragileBase,                    // 常态法脆:仅常驻(芙蓉),不含技能期才生效的(焰苇S3灼痕)
    isDotTick: (INCANTATION_DOT_OVERRIDES[op.id] || []).includes(skillIndex),
    healChain: (SKILL_HEAL_CHAIN[op.id] || {})[skillIndex] || 1,
    talentHealScale: calcTalentHealScale(op, slotData) * (enh.healScale || 1),  // 常驻治疗倍率(天赋 × 模组天赋强化,如瑰盐/夜莺X模组)
    talentDmgMul: calcTalentDmgMul(op, slotData),  // 常驻伤害乘区(勇冠三军满血×1.15 等,calcDamage 内乘)
    sleepAtkMul: calcSleepAtkMul(op, slotData),  // 瑕光「仁慈」沉睡目标攻击倍率(仅 S2 必睡场景启用)
    skillDmgMul: calcModuleSkillDmgMul(op, slotData),  // 模组技能伤害提升(德克萨斯 Y 战术快递:技能期伤害 ×1.1/1.15,常态不乘)
    skillHealMul: calcModuleSkillHealMul(op, slotData),  // 模组新增天赋技能治疗提升(清流 Y 细水长流:技能期治疗 ×1.1/1.2,常态普攻不乘)
    resPen,  // 固定法抗穿透(史尔特尔熔火:法术结算时敌人法抗直减)
    mrDebuffMul: calcTalentMrDebuffMul(op, slotData),  // 天赋级敌方减抗乘数(伊芙利特精神融解:E2 -40%)
    hitMrMul,  // 命中减抗乘数(夜烟黑色迷雾:先效果再命中,技能期同吃)
    isTrueOverride: (SKILL_TRUE_DAMAGE[op.id] || []).includes(skillIndex),  // 技能期强制真伤(阿米娅S3奇美拉)
    isWeakness: isWeaknessOn,
    funnelNormalMul: funnelMuls.normalMul,  // 驭械术师:本体+浮游单元(常态)攻击力当量倍数
    funnelSkillMul: funnelMuls.skillMul,    // 驭械术师:技能期当量倍数(技能期新增单元按叠层取平均)  // 弱点伤害逐击取优(赤刃明霄陈,精1+)
    flatArtsHit: defHitArtsMax(op, slotData),  // 每击敌方防御附加法伤稳态档(刻俄柏剥壳:不吃倍率吃法抗;常态/循环用)
    flatAt: defHitArtsMax(op, slotData) > 0 ? (i => defHitArtsAt(op, slotData, i)) : null,
    atkRampUp: (PHALANX_ATK_RAMP[op.id] || {})[skillIndex] || null,  // 阵法术师:攻击力线性递增(卡涅利安 S3)
    dmgRamp: ((PHALANX_ATK_RAMP[op.id] || {})[skillIndex] || {}).dmgRamp || 0,  // 蓄力增伤线性递增(整个技能)  // 逐击档(X模组剥壳递增:技能期按攻击序爬升)
    defPenFixed,  // 天赋级固定物理穿防(能天使 Y「快速弹匣」等):技能期与常态同一口径,否则技能槽常态与无技能态不一致
  };

  let result;
  // 战术家召唤物形态模式表:技能位 = 持有者技能激活期间召唤物输出的形态变化(用户口径,数值=M1 显示档)。
  // mode: arts-sleep 眠兽S2安眠——5s 沉睡窗口内普攻变群体法伤,攻击沉睡目标攻击力×mul(M1 1.7)
  // mode: attack-buff-single 狼群S2领袖的馈赠——狼群下次攻击攻击力提升至 mul(M1 1.8) 单发(触发型,无周期)
  // mode: sleep-regen 眠兽S1半醒休眠——10s 休眠期每秒恢复 maxHp×ratio(M1 0.14),停止攻击(heal 型)
  // mode: owner-arts-add 狼群S3领袖的尊严——15s 内狼群每击自身物伤 + 伺夜面板atk×mul(M1 0.35)法伤(伤害源=持有者,ctx 注入)
  const SUMMON_FORM_MODES = {
    'token_10021_blkngt_hypnos': {
      0: { mode: 'sleep-regen', ratio: 0.14, dur: 10 },
      1: { mode: 'arts-sleep', mul: 1.7, dur: 5 },
    },
    'token_10028_vigil_wolf': {
      1: { mode: 'attack-buff-single', mul: 1.8 },
      2: { mode: 'owner-arts-add', mul: 0.35, dur: 15, ownerId: 'char_427_vigil' },
    },
    // 樱桃三号 S1(渡桥遥控解体激活):自毁对周围4格敌人造成渡桥攻击力×3.7(M1)物理伤害,伤害源=渡桥(可受特性加成,
    // 基值=持有者满练面板×1.5,经 UI ctx.ownerOp 注入;爆炸后三号退场无常态)
    'token_10037_mitm_trshrb': { 0: { mode: 'owner-phys-burst', mul: 3.7, ownerId: 'char_4147_mitm' } },
    // 流形双形态(缪尔赛思技能激活期,自身与流形攻击力+40% M1;S1 另攻速+40;形态效果:远程=法伤,近战=物伤):
    // 远程 S2 生态耦合=普攻二连击;近战 S2=每秒回 5% 最大生命(自回);S3 控制类无输出增益(远程束缚/近战拖拽眩晕)
    'token_10030_mlyss_wtrman': {
      0: { mode: 'flow-buff', atkMul: 0.4, aspd: 40, dur: 15 },
      1: { mode: 'flow-double', atkMul: 0.4, dur: 15 },
      2: { mode: 'flow-buff', atkMul: 0.4, dur: 15 },
    },
    'token_10030_mlyss_melee': {
      0: { mode: 'flow-buff', atkMul: 0.4, aspd: 40, dur: 15 },
      1: { mode: 'flow-buff', atkMul: 0.4, dur: 15, regenRatio: 0.05 },
      2: { mode: 'flow-buff', atkMul: 0.4, dur: 15 },
    },
    // 巫役·酒神 S2 的支援召唤物「本能的召唤」:诱导至多4名敌人 10s 后撤退,使周围所有敌人在 buff_time 秒内停顿、
    // 每 interval_damage 秒受到酒神攻击力×atk_scale 的法术伤害与攻击力×ep_damage_ratio_token 的神经损伤
    // (伤害源=酒神面板,经 UI ctx.ownerOp 注入;召唤物自身面板为占位值)
    'token_10054_phatm2_encdool': { 0: { mode: 'ritual-ep-window', el: 'sanity', ownerId: 'char_1042_phatm2' } },
  };
  // 继承持有者技能、用自身面板的召唤物(用户 2026-09-17 口径:打字机技能=鸿雪的技能,面板=打字机自己的)
const TOKEN_INHERIT_OWNER_SKILLS = { 'token_10026_bgsnow_subbow': true };

function calcSummonFormMode(op, skillIndex, panelAtk, phase, ctx, levelData) {
    const cfg = (SUMMON_FORM_MODES[op.id] || {})[skillIndex];
    if (!cfg) return null;
    if (cfg.mode === 'ritual-ep-window') {
      // 巫役·酒神「本能的召唤」:伤害源 = 持有者(酒神)面板攻击力(经 ctx 注入;无 ctx 时退回召唤物自身面板)
      let ownerAtk = panelAtk;
      if (ctx && ctx.ownerOp && cfg.ownerId === ctx.ownerOp.id) ownerAtk = calcPanelStats(ctx.ownerOp, ctx.ownerSlot).panelAtk;
      const ld = levelData || {};
      const win = ld.buff_time > 0 ? ld.buff_time : 6;
      const tick = ld.interval_damage > 0 ? ld.interval_damage : 0.5;
      const atkScale = ld.atk_scale !== undefined ? ld.atk_scale : 1.3;
      const epRatio = ld.ep_damage_ratio_token !== undefined ? ld.ep_damage_ratio_token : 0.2;
      const ticks = Math.max(1, Math.floor(win / tick));
      const sim = simulateSkillTimeline({
        grade: (state.enemy && state.enemy.grade) || 'normal', duration: win, enemy: state.enemy,
        dots: [
          { type: 'arts', atk: ownerAtk * atkScale, interval: tick, count: ticks },
          { type: null, atk: ownerAtk, epMul: epRatio, el: cfg.el, interval: tick, count: ticks },
        ],
      });
      const total = sim.arts + sim.element;
      const iv = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1;
      return {
        type: 'damage', damageType: 'arts', normalDamageType: 'arts',
        skillDps: total / win, skillTotalDamage: total, cycleDps: null,
        normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
        isToggle: false, isPermanent: false, realInterval: iv, panelAtk,
        dmgTypes: {
          arts: { skillDps: sim.arts / win, skillTotalDamage: sim.arts, cycleDps: null },
          element: { skillDps: sim.element / win, skillTotalDamage: sim.element, cycleDps: null },
        },
      };
    }
    if (cfg.mode === 'arts-sleep') {
      const interval = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1.25;
      const hits = Math.max(1, Math.floor(cfg.dur / interval));  // 5s/1.25 = 4 击
      const perHit = calcArtsDamage(panelAtk * cfg.mul, state.enemy.res);  // 群体法术,单目标模型 1 目标
      const total = perHit * hits;
      return {
        type: 'damage', skillDps: total / cfg.dur, skillTotalDamage: total, cycleDps: null,
        normalDps: calcPhysicalDamage(panelAtk, effDef) / interval, skillHps: null, normalHps: null, totalHeal: null,
        isToggle: false, isPermanent: false, realInterval: interval, panelAtk,
        damageType: 'arts', normalDamageType: 'physical',
        dmgTypes: { arts: { skillDps: total / cfg.dur, skillTotalDamage: total, cycleDps: null } },
      };
    }
    if (cfg.mode === 'attack-buff-single') {
      // 狼群下次攻击强化:触发型单发(持有者 AUTO sp6 充能,召唤物无周期概念)→ 仅精确单发总伤+常态普攻
      const interval = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1.25;
      const singleHit = calcPhysicalDamage(panelAtk * cfg.mul, effDef);
      return {
        type: 'damage', skillDps: 0, skillTotalDamage: singleHit, cycleDps: null,
        normalDps: calcPhysicalDamage(panelAtk, effDef) / interval, skillHps: null, normalHps: null, totalHeal: null,
        isToggle: false, isPermanent: false, realInterval: interval, panelAtk,
        damageType: 'physical', normalDamageType: 'physical',
        dmgTypes: { physical: { skillDps: 0, skillTotalDamage: singleHit, cycleDps: null } },
      };
    }
    if (cfg.mode === 'owner-phys-burst') {
      // 持有者源物理爆发(樱桃三号 S1 自爆):伤害 = 持有者面板 atk(满练默认,含战术家特性×1.5)×mul(M1 3.7),
      // 由 UI 注入 ctx.ownerOp/ownerSlot;自爆后召唤物退场 → 无常态普攻行
      const interval = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1.25;
      let ownerAtk = panelAtk;
      if (ctx && ctx.ownerOp && cfg.ownerId === ctx.ownerOp.id) {
        ownerAtk = calcPanelStats(ctx.ownerOp, ctx.ownerSlot).panelAtk;
      }
      const burst = calcPhysicalDamage(ownerAtk * cfg.mul, effDef);
      return {
        type: 'damage', skillDps: 0, skillTotalDamage: burst, cycleDps: null,
        normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
        isToggle: false, isPermanent: false, realInterval: interval, panelAtk,
        damageType: 'physical', normalDamageType: 'physical',
        dmgTypes: { physical: { skillDps: 0, skillTotalDamage: burst, cycleDps: null } },
      };
    }
    if (cfg.mode === 'sleep-regen') {
      // 眠兽 S1 半醒:10s 休眠期每秒恢复最大生命×ratio(M1 14%),休眠停止攻击 → 纯治疗展示(常态普攻保留)
      const baseAT = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1.25;
      const maxHp = (phase.maxHp && phase.maxHp[phase.maxHp.length - 1]) || 0;
      const hps = maxHp * cfg.ratio;
      const normHit = calcPhysicalDamage(panelAtk, effDef);
      return {
        type: 'heal', skillDps: 0, skillTotalDamage: 0, cycleDps: null,
        normalDps: normHit / baseAT, skillHps: hps, normalHps: null, totalHeal: hps * cfg.dur,
        isToggle: false, isPermanent: false, realInterval: baseAT, panelAtk,
        damageType: 'physical', normalDamageType: 'physical',
      };
    }
    if (cfg.mode === 'owner-arts-add') {
      // 狼群 S3 领袖的尊严:15s 内每击 = 狼群自身物伤 + 伺夜面板 atk×0.35(M1)法伤(附加基值=持有者,经 ctx 注入)
      const baseAT = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1.25;
      const hits = Math.max(1, Math.floor(cfg.dur / baseAT));
      const ownerAtk = (ctx && ctx.ownerOp && cfg.ownerId === ctx.ownerOp.id) ? calcPanelStats(ctx.ownerOp, ctx.ownerSlot).panelAtk : panelAtk;
      const physHit = calcPhysicalDamage(panelAtk, effDef);
      const artsHit = calcArtsDamage(ownerAtk * cfg.mul, state.enemy.res);
      const total = (physHit + artsHit) * hits;
      const normHit = calcPhysicalDamage(panelAtk, effDef);
      return {
        type: 'damage', skillDps: total / cfg.dur, skillTotalDamage: total, cycleDps: null,
        normalDps: normHit / baseAT, skillHps: null, normalHps: null, totalHeal: null,
        isToggle: false, isPermanent: false, realInterval: baseAT, panelAtk,
        damageType: 'physical', normalDamageType: 'physical',
        dmgTypes: {
          physical: { skillDps: (physHit * hits) / cfg.dur, skillTotalDamage: physHit * hits, cycleDps: null },
          arts: { skillDps: (artsHit * hits) / cfg.dur, skillTotalDamage: artsHit * hits, cycleDps: null },
        },
      };
    }
    // 流形形态系列(缪尔赛思技能激活期):召唤物伤害类型按 op.damageType(流形·远程=法伤/近战=物伤)
    if (cfg.mode === 'flow-buff' || cfg.mode === 'flow-double') {
      const baseAT = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1.5;
      const interval = cfg.aspd ? calcRealInterval(baseAT, 100 + cfg.aspd) : baseAT;
      const hits = Math.max(1, Math.floor(cfg.dur / interval));
      const hitAtk = panelAtk * (1 + (cfg.atkMul || 0));
      const isArtsForm = op.damageType === 'arts';
      const perHit = isArtsForm ? calcArtsDamage(hitAtk, state.enemy.res) : calcPhysicalDamage(hitAtk, effDef);
      const chain = cfg.mode === 'flow-double' ? 2 : 1;
      const total = perHit * hits * chain;
      const normHit = isArtsForm ? calcArtsDamage(panelAtk, state.enemy.res) : calcPhysicalDamage(panelAtk, effDef);
      // 近战 S2 每秒回血(自身最大生命比例)附加:damage 结果带 skillHps/totalHeal(UI 逐行渲染不互斥)
      const regenHps = cfg.regenRatio ? ((phase.maxHp && phase.maxHp[phase.maxHp.length - 1]) || 0) * cfg.regenRatio : 0;
      return {
        type: 'damage', skillDps: total / cfg.dur, skillTotalDamage: total, cycleDps: null,
        normalDps: normHit / baseAT,
        skillHps: regenHps > 0 ? regenHps : null, normalHps: null, totalHeal: regenHps > 0 ? regenHps * cfg.dur : null,
        isToggle: false, isPermanent: false, realInterval: interval, panelAtk,
        damageType: isArtsForm ? 'arts' : 'physical', normalDamageType: isArtsForm ? 'arts' : 'physical',
        dmgTypes: { [isArtsForm ? 'arts' : 'physical']: { skillDps: total / cfg.dur, skillTotalDamage: total, cycleDps: null } },
      };
    }
    return null;
  }

  // 召唤物路由:带独立技能(非 skcom_ 通用被动、非 sktok_ 召唤物原生占位)的召唤物按技能语义走伤害/治疗计算
  // (如凯尔希·Mon3tr 攻击型召唤物,技能由持有者注入 skchr_);仅占位技能(战术家狼群/眠兽/流形/模様三号等 sktok_,
  // 与医疗探机 skcom_)的召唤物无独立技能期 → 攻击型走常态普攻、非攻击型走 calcSummonHeal。
  // 继承持有者技能的召唤物(鸿雪「打字机」:技能与鸿雪同名同值,但用打字机自身面板)按普通干员口径结算
  const inheritedSkills = TOKEN_INHERIT_OWNER_SKILLS[op.id] === true;
  const hasRealSkills = inheritedSkills || TOKEN_REAL_SKILL_IDS.includes(op.id) || (op.skills || []).some(s => s.skillId && !String(s.skillId).startsWith('skcom_') && !String(s.skillId).startsWith('sktok_'));
  // 守护者治疗技能识别:治疗模式型(bb 带 base_attack_time,普攻转治疗)、
  // 急救族 AUTO(heal_scale + AUTO 充能触发治疗)与特殊模式(塞雷娅S3 钙质化每秒HOT attack@heal_scale;
  // 瑕光S1 双通道 atk_scale+heal_scale AUTO / S2 沉睡 attack@atk_to_hp_recovery_ratio / S3 物法双伤 attack@blemsh_s_3...;
  // 黍S3 双轨 e_atk;森西S2 烹饪 HOT tick_heal_scale)
  const isGuardianSkill = op.profession === 'TANK' && op.subProfessionId === 'guardian';
  const isGuardianHealSkill = isGuardianSkill && (
    levelData.base_attack_time !== undefined ||
    levelData['attack@heal_scale'] !== undefined ||
    levelData['attack@atk_to_hp_recovery_ratio'] !== undefined ||
    levelData['attack@blemsh_s_3_extra_dmg[magic].atk_scale'] !== undefined ||
    levelData.e_atk !== undefined ||
    levelData.tick_heal_scale !== undefined ||
    (levelData.heal_scale !== undefined && (levelData.skillType === 'AUTO' || levelData.atk_scale !== undefined))
  );
  // ===== 术战者(artsfighter)特殊拦截:置于通用分支链最前,命中即结算 =====
  // 维娜·维多利亚 S1(AUTO 自然回 sp5):下次攻击对四周地面敌人额外造成 atk_scale×atk 真伤 + 普攻法伤照常
  // (斥罪 S1 同构但附加为真伤;普攻为术战者法伤),cycleDps 按自然回充能折算。
  if (op.id === 'char_180_amgoat' && skillIndex === 1) {
    // 艾雅法拉 S2 点燃(AUTO sp6 触发):下次攻击变为点燃,命中造成 fk×atk 法伤(M1 fk=3.3=330%,PRTS 专一档一致),
    // 并令目标 6s 法抗-20%(duration 窗口)。点燃周期 sp6 ≈ 减抗 6s 全覆盖 → 等效全程目标法抗×0.8(用户口径)。
    // cycle=自然回 6s:充能期普攻与点燃均按有效法抗 mrRes 结算;命中目标周围半伤爆炸(单目标模型不计)。
    const mrRes = Math.max(0, (state.enemy.res || 0) * 0.8);
    const igMul = levelData.fk ?? 0;   // 主倍率键(M1 3.3);atk_scale/atk_scale_2 为双段拆分不重复乘(dispatch 前 skillAtk 已乘过 atk_scale,故用 panelAtk)
    const igHit = calcArtsDamage(panelAtk * igMul, mrRes);
    const spCost = levelData.spCost > 0 ? levelData.spCost : 6;
    const interval = skillRealInterval > 0 ? skillRealInterval : 1;
    const chargeAttacks = Math.floor(spCost / interval);
    const cycleTime = spCost;
    const artsCycle = chargeAttacks * calcArtsDamage(panelAtk, mrRes) + igHit;
    result = {
      skillDps: 0, skillTotalDamage: igHit, cycleDps: cycleTime > 0 ? artsCycle / cycleTime : 0,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: interval,
      dmgTypes: { arts: { skillDps: 0, skillTotalDamage: igHit, cycleDps: cycleTime > 0 ? artsCycle / cycleTime : 0 } },
    };
  } else if (op.id === 'char_164_nightm' && skillIndex === 0) {
    // 夜魔 S1 灵魂汲取(手动 60s):技能期普攻法伤照常,每击对攻击范围内友方恢复生命
    // (治疗基值 = 面板攻击力 × 0.8(M1),非伤害量、不吃法抗——用户口径;至多2名友方按单目标模型默认1名)
    const intv = skillRealInterval > 0 ? skillRealInterval : 1;
    const hits = Math.max(1, Math.floor(skillDuration / intv));
    const dmgPerHit = calcArtsDamage(skillAtk, state.enemy.res);
    const healPerHit = 0.8 * panelAtk;
    const dmgTot = dmgPerHit * hits, healTot = healPerHit * hits;
    const dmgDps = skillDuration > 0 ? dmgTot / skillDuration : 0;
    result = {
      type: 'damage', skillDps: dmgDps, skillTotalDamage: dmgTot, cycleDps: null,
      normalDps: null, skillHps: healPerHit / intv, normalHps: null, totalHeal: healTot,
      damageType: 'arts', realInterval: intv, panelAtk,
      dmgTypes: { arts: { skillDps: dmgDps, skillTotalDamage: dmgTot, cycleDps: null } },
    };
  } else if (op.id === 'char_2013_cerber' && skillIndex === 2) {
    // 刻俄柏 S3 很重的枪(手动 58s):攻击力+175%(M1,skillAtk 已含)且伤害类型变为物理、优先攻击防御最低目标
    // (单目标模型目标=面板假想敌)——通用 isArts 按职业法伤,故专用拦截走物理结算;
    // 天赋剥壳(按敌方防御附加法伤)对物理攻击照常生效 → 独立 arts 档,物法双档展示。
    const heavyHits = skillDuration > 0 ? Math.max(1, Math.floor(skillDuration / skillRealInterval)) : 1;  // 58/1.6=36
    const heavyHit = calcPhysicalDamage(skillAtk, effDef);
    const physTot = heavyHit * heavyHits;
    let artsTot = 0;
    for (let k = 0; k < heavyHits; k++) artsTot += defHitArtsAt(op, slotData, k);  // 剥壳逐击(X模组递增)
    const heavyDps = skillDuration > 0 ? (physTot + artsTot) / skillDuration : 0;
    result = {
      type: 'damage', skillDps: heavyDps, skillTotalDamage: physTot + artsTot, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval, panelAtk,
      dmgTypes: {
        physical: { skillDps: physTot / skillDuration, skillTotalDamage: physTot, cycleDps: null },
        arts: { skillDps: artsTot / skillDuration, skillTotalDamage: artsTot, cycleDps: null },
      },
    };
  } else if (op.id === 'char_4027_heyak' && skillIndex === 1) {
    // 霍尔海雅 S2 群星逶迤(手动 16s):普通攻击变为 attack@atk_scale(M1 0.38)的 9 连发随机攻击范围内目标,
    // 每发 13% 概率浮空——用户口径:默认全部不浮空(概率不计);单目标模型=9 发全中同一目标,
    // 技能期攻击次数 = dur/间隔(10 次) × 9 连发 = 90 发(同剑雨 AOE 单目标全中先例)。
    const hyMul = levelData['attack@atk_scale'] ?? 0.38;
    const hyVolley = 9;  // 每次普攻动作 9 连发
    const hyActions = skillDuration > 0 ? Math.max(1, Math.floor(skillDuration / skillRealInterval)) : 1;
    const hyHits = hyActions * hyVolley;
    const hyPer = calcArtsDamage(skillAtk * hyMul, effRes);
    const hyTot = hyPer * hyHits;
    const hyDps = skillDuration > 0 ? hyTot / skillDuration : 0;
    result = {
      type: 'damage', skillDps: hyDps, skillTotalDamage: hyTot, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: skillRealInterval, panelAtk,
      dmgTypes: { arts: { skillDps: hyDps, skillTotalDamage: hyTot, cycleDps: null } },
    };
  } else if (op.id === 'char_4027_heyak' && skillIndex === 2) {
    // 霍尔海雅 S3 博览者的狂语(手动 45s):攻击间隔延长 +1.4 → 3.0s(通用 BAT 已消费 base_attack_time),
    // 普攻变为向前吹出的旋风,伤害随行进距离 0~3 格自 min_atk_scale 线性增强至 max_atk_scale
    // (M1 2.67→4.0)。单目标模型距离不可知 → 取最低档 2.67(用户口径);传承终焉需空中/失重目标,
    // 曾有羽翼为满血条件可能失效 + S3 自浮空 2s < 攻击间隔 3s 后续击打不到 → 不建模走说明。
    const cycMul = levelData['attack@min_atk_scale'] ?? 2.67;
    const cycHit = calcArtsDamage(skillAtk * cycMul, effRes);
    const cycHits = skillDuration > 0 ? Math.max(1, Math.floor(skillDuration / skillRealInterval)) : 1;
    const cycTot = cycHit * cycHits;
    const cycDps = skillDuration > 0 ? cycTot / skillDuration : 0;
    result = {
      type: 'damage', skillDps: cycDps, skillTotalDamage: cycTot, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: skillRealInterval, panelAtk,
      dmgTypes: { arts: { skillDps: cycDps, skillTotalDamage: cycTot, cycleDps: null } },
    };
  } else if (op.id === 'char_4133_logos' && skillIndex === 1) {
    // 逻各斯 S2 提喻(手动 20s):法抗+X% 自身生存向不计;攻击改为锁定一个目标,每 attack@cooldown 0.5s
    // 造成一次攻击力 attack@atk_scale_base(M1 0.6)法伤,对相同目标伤害线性递增——每跳 +attack@atk_scale_delta
    // (0.12),至 attack@max_stack_cnt(10) 层封顶 = base×3(0.6→1.8,文本"逐渐提高至3倍");减速/被打断重索敌不计。
    // 用户口径:线性递增模式。首跳 base,第 n 跳 = base+delta×min(n-1,max),约 5.5s 后满层。
    const tJumpCd = levelData['attack@cooldown'] ?? 0.5;
    const tBase = levelData['attack@atk_scale_base'] ?? 0.6;
    const tDelta = levelData['attack@atk_scale_delta'] ?? 0.12;
    const tMax = levelData['attack@max_stack_cnt'] ?? 10;
    const tJumps = skillDuration > 0 ? Math.max(1, Math.floor(skillDuration / tJumpCd)) : 1;  // 20/0.5=40
    let tTot = 0;
    for (let j = 0; j < tJumps; j++) {
      const mul = tBase + tDelta * Math.min(j, tMax);  // 第1跳=base,第11跳起=0.6+0.12×10=1.8
      tTot += calcArtsDamage(skillAtk * mul, effRes);
    }
    const tDps = skillDuration > 0 ? tTot / skillDuration : 0;
    result = {
      type: 'damage', skillDps: tDps, skillTotalDamage: tTot, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: tJumpCd, panelAtk,
      dmgTypes: { arts: { skillDps: tDps, skillTotalDamage: tTot, cycleDps: null } },
    };
  } else if (op.id === 'char_466_qanik' && skillIndex === 1) {
    // 雪绒 S2 坠雪(手动 7s):技能期停止攻击,对范围内至多 2 名地面敌人(单目标模型=1)每 0.5s 造成
    // trigger_atk_scale×atk(M1 0.65)法伤并浮空 7 秒,浮空结束时(坠地)一次 critical_damage_scale×atk(M1 2.5)坠落伤害。
    // 浮空期间目标为空中单位 → 每跳吃冰原生存法脆(×1.2 E2);坠落伤于落地瞬间造成,不吃(用户口径:非暴击);
    // 坠落 AOE 溅射周围敌人不计(单目标模型)。
    const jumpMul = levelData.trigger_atk_scale ?? 0.65;
    const endMul = levelData.critical_damage_scale ?? 2.5;
    const airMul = calcAirFragileMul(op, slotData);
    const perJump = calcArtsDamage(skillAtk * jumpMul, effRes) * airMul;
    const endHit = calcArtsDamage(skillAtk * endMul, effRes);
    const jumpCnt = skillDuration > 0 ? Math.max(1, Math.floor(skillDuration / 0.5)) : 1;  // 7s/0.5s=14 跳
    const qkTot = perJump * jumpCnt + endHit;
    const qkDps = skillDuration > 0 ? qkTot / skillDuration : 0;
    result = {
      type: 'damage', skillDps: qkDps, skillTotalDamage: qkTot, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: 0.5, panelAtk,
      dmgTypes: { arts: { skillDps: qkDps, skillTotalDamage: qkTot, cycleDps: null } },
    };
  } else if (op.id === 'char_1019_siege2' && skillIndex === 0) {
    const trigArts = calcArtsDamage(panelAtk, effRes);                                  // 触发当次普攻法伤
    const trigTrue = calcTrueDamage(panelAtk * (levelData.atk_scale ?? 1));              // 附加真伤(atk_scale 逐级)
    const spCost = levelData.spCost > 0 ? levelData.spCost : 1;
    const interval = skillRealInterval > 0 ? skillRealInterval : 1;
    const chargeAttacks = Math.floor(spCost / interval);                                 // 充能期普攻数(自然回)
    const cycleTime = spCost;
    const artsCycle = ((chargeAttacks + 1) * trigArts);                                  // 法伤:充能普攻+触发当次
    const trueCycle = trigTrue;
    const normDps = trigArts / interval;
    result = {
      skillDps: 0, skillTotalDamage: trigArts + trigTrue,
      cycleDps: cycleTime > 0 ? (artsCycle + trueCycle) / cycleTime : 0,
      normalDps: normDps, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: interval,
      dmgTypes: {
        arts: { skillDps: 0, skillTotalDamage: trigArts, cycleDps: artsCycle / cycleTime },
        true: { skillDps: 0, skillTotalDamage: trigTrue, cycleDps: trueCycle / cycleTime },
      },
    };
  } else if (op.id === 'char_1019_siege2' && skillIndex === 2) {
    // 维娜·维多利亚 S3(手动 25s):技能期伤害类型变真实(普攻转真伤),atk+X%、间隔 -0.25s(→1.0s)。
    // (黄金盟誓召唤物已单独入库,本体只算转真伤普攻)
    const trueHit = calcTrueDamage(panelAtk * (1 + (levelData.atk || 0)));
    const interval = skillRealInterval > 0 ? skillRealInterval : 1;
    const hits = Math.floor(skillDuration / interval);
    const total = trueHit * hits;
    result = {
      skillDps: skillDuration > 0 ? total / skillDuration : 0, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'true', realInterval: interval,
      dmgTypes: { true: { skillDps: skillDuration > 0 ? total / skillDuration : 0, skillTotalDamage: total, cycleDps: null } },
    };
  } else if (op.id === 'char_427_vigil' && skillIndex === 2) {
    // 伺夜 S3 领袖的尊严(手动 15s):普攻变三连击(每次攻击 3 连物理,每连全额);
    // 伺夜与狼群攻击被狼群阻挡单位造成伤害时额外附加 attack@vigil_s_3.atk_scale×伺夜攻击力 法伤(M1 0.35,
    // PRTS 备注附加可受特性加成→基值为含战术家×1.5 的面板攻击);单目标模型默认目标被狼群阻挡 → 每轮三连物理+1 次附加。
    // S3 无 atk 加成(回费在 value/interval 键),间隔保持 1.0s → 15 轮。
    const triHit = calcPhysicalDamage(panelAtk, effDef);
    const triTotal = triHit * 3;
    const extraArts = calcArtsDamage(panelAtk * (levelData['attack@vigil_s_3.atk_scale'] ?? 0.35), state.enemy.res);
    const interval = skillRealInterval > 0 ? skillRealInterval : 1;
    const rounds = Math.floor(skillDuration / interval);
    const physTotal = triTotal * rounds;
    const artsTotal = extraArts * rounds;
    const total = physTotal + artsTotal;
    result = {
      skillDps: skillDuration > 0 ? total / skillDuration : 0, skillTotalDamage: total, cycleDps: null,
      normalDps: calcPhysicalDamage(panelAtk, effDef) / interval, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: interval,
      dmgTypes: {
        physical: { skillDps: skillDuration > 0 ? physTotal / skillDuration : 0, skillTotalDamage: physTotal, cycleDps: null },
        arts: { skillDps: skillDuration > 0 ? artsTotal / skillDuration : 0, skillTotalDamage: artsTotal, cycleDps: null },
      },
    };
  } else if (isSummon && !hasRealSkills) {
    // 战术家召唤物形态技能:技能位 = 持有者技能激活态对召唤物的输出影响(基值为召唤物自身面板,数值引用见 SUMMON_FORM_MODES)
    const summonForm = calcSummonFormMode(op, skillIndex, panelAtk, phase, ctx, levelData);
    if (summonForm) {
      result = summonForm;
    } else {
    // 攻击型召唤物无独立技能(机械师·结构性原理、战术家狼群/眠兽/流形/模様三号/牙猎犬等,冲锋等行为由持有者技能触发已计入本体查询)
    // → 常态物理普攻;非攻击型(治疗型召唤物与 atk 基础 0 单位:医疗探机/幻影/指挥中心等)走治疗型/空视图 calcSummonHeal。
    // 注意医疗探机的 phases.atk 是治疗力(125>0),须显式按治疗型处理
    const HEAL_SUMMONS = ['token_10000_silent_healrb', 'token_10003_cgbird_bird', 'token_10032_jesca2_jckshd'];
    const summonBaseAtk = (phase.atk && phase.atk[phase.atk.length - 1]) || 0;
    if (INERT_SUMMONS.includes(op.id)) {
      // 工匠装置类召唤物:不攻击、不治疗,仅占位置(给友方的增益不建模) → 输出全 0
      result = {
        type: 'damage', skillDps: 0, skillTotalDamage: 0, cycleDps: null,
        normalDps: 0, skillHps: null, normalHps: null, totalHeal: null,
        isToggle: false, isPermanent: false, realInterval: phase.baseAttackTime > 0 ? phase.baseAttackTime : 1, panelAtk,
        damageType: 'physical', normalDamageType: 'physical',
      };
    } else if (!HEAL_SUMMONS.includes(op.id) && summonBaseAtk > 0) {
      const normInt = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1;
      const isArtsSummon = op.damageType === 'arts';  // 流形·远程默认法伤水炮
      const normHit = isArtsSummon ? calcArtsDamage(panelAtk, state.enemy.res) : calcPhysicalDamage(panelAtk, effDef);
      result = {
        type: 'damage', skillDps: 0, skillTotalDamage: 0, cycleDps: null,
        normalDps: normHit / normInt, skillHps: null, normalHps: null, totalHeal: null,
        isToggle: false, isPermanent: false, realInterval: normInt, panelAtk,
        damageType: isArtsSummon ? 'arts' : 'physical', normalDamageType: isArtsSummon ? 'arts' : 'physical',
      };
    } else {
      result = calcSummonHeal(params);
    }
    }
  } else if (isMedic) {
    result = calcMedical(params);
  } else if (isGuardianHealSkill) {
    result = calcGuardian(params);
  } else if (isSummonerToken(op)) {
    // 召唤师召唤物:技能期增益作用于召唤物本身(数据层已注入持有者的技能槽与天赋)
    result = calcSummonerToken({
      op, slotData: { ...slotData, skillIndex },
      panelAtk, realInterval, levelData, skillIndex, isPermanent, skillDuration,
      ownerPanelAtk: summonerOwnerPanelAtk(op, slotData), enemy: state.enemy,
    });
  } else if (op.subProfessionId === 'ritualist') {
    // 巫役(辅助,ritualist):特性「攻击造成法术伤害,可以造成元素损伤」→ 全员特殊结算
    // (直伤法术 + 攻击力×倍率损伤 → 敌方 EP 爆条模拟;损伤不吃防/抗,单独一档)
    setRitualEpMul(ritualGradeEpMul(op, slotData));
    const rNorm = ritualNormalFields(op, slotData, panelAtk, state.enemy, realInterval, ritualCandSource);
    result = calcRitualSkill({
      op, slotData: { ...slotData, skillIndex },
      panelAtk, skillAtk, skillDuration, realInterval: skillRealInterval,
      levelData, enemy: state.enemy, candSourceFor: ritualCandSource,
      normalDps: rNorm.normalDps, normalTypes: rNorm.normalTypes,
    });
  } else if (op.subProfessionId === 'primprotector' && skill && OPERATOR_ELEMENT[op.id]) {
    // 本源铁卫元素系三人（余灼燃/珊比侵蚀/响石神经）：技能全部特殊（元素损伤时间轴），且 bb 的 atk_scale 为附加伤害倍率
    // （余S2 瞬发群伤/珊比S2 胶、S3 传送带/响石S2 区域法伤）而非普攻倍率，不能走通用 skillAtk 计算。
    // 内部以 panelAtk×(1+atk) 重算（本源铁卫无加攻天赋，panelAtk 未含天赋 atk 乘区）。
    result = calcPrimSkill({
      op, slotData: { ...slotData, skillIndex },
      panelAtk, panelHp,
      skillAtk: panelAtk * (1 + (levelData.atk || 0)),
      skillDuration, realInterval: skillRealInterval,
      levelData, enemy: state.enemy,
    });
  } else if (op.id === 'char_4039_horn' && skillIndex === 2) {
    // 号角 S3 终极防线(dur24 过载两段):前12s atk+50% 间隔1.0s,后12s 过载 atk+100%(自损不计)
    const frontHit = calcPhysicalDamage(panelAtk * 1.5, effDef);
    const overloadHit = calcPhysicalDamage(panelAtk * 2.0, effDef);
    const frontTotal = frontHit * 12;    // 前12击
    const backTotal = overloadHit * 12;  // 后12击
    const total = frontTotal + backTotal;
    result = {
      skillDps: total / 24, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: 1.0,
      dmgTypes: { physical: { skillDps: total / 24, skillTotalDamage: total, cycleDps: null } },
    };
  } else if (op.id === 'char_4039_horn' && skillIndex === 1) {
    // 号角 S2 暴风号令(10发弹药,不提前关闭):前5发=2×atk物理,后5发过载弹药=2×atk物理+0.5×atk法伤;
    // 用时=10发×2.8s,DPS=总伤/用时
    const physPer = calcPhysicalDamage(panelAtk * 2, effDef);
    const artsPer = calcArtsDamage(panelAtk * 0.5, state.enemy.res);
    const physTotal = physPer * 10;
    const artsTotal = artsPer * 5;
    const total = physTotal + artsTotal;
    const ammoTime = 10 * (phase.baseAttackTime > 0 ? phase.baseAttackTime : 1);
    result = {
      skillDps: ammoTime > 0 ? total / ammoTime : 0, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: {
        physical: { skillDps: physTotal / ammoTime, skillTotalDamage: physTotal, cycleDps: null },
        arts: { skillDps: artsTotal / ammoTime, skillTotalDamage: artsTotal, cycleDps: null },
      },
    };
  } else if (op.id === 'char_493_firwhl' && skillIndex === 0) {
    // 火哨 S1 野火（AUTO 自然回 sp8）：下次攻击 1.6×atk 物理 + 引燃 4s 每秒 0.4×atk 法伤（附带 DOT 计入，同流明先例）
    const trigPhys = calcPhysicalDamage(skillAtk, effDef);       // skillAtk 已含 atk_scale 1.6
    const dotHit = calcArtsDamage(panelAtk * 0.4, state.enemy.res);
    const dotTotal = dotHit * 4;                                          // 4 秒 4 跳
    const trigTotal = trigPhys + dotTotal;
    const int = skillRealInterval > 0 ? skillRealInterval : 1;
    const chargeAttacks = Math.floor(8 / int);                            // 自然回充能期普攻数（sp8）
    const cycleTime = 8;
    const normPhys = calcPhysicalDamage(panelAtk, effDef);
    result = {
      skillDps: 0, skillTotalDamage: trigTotal,
      cycleDps: (chargeAttacks * normPhys + trigTotal) / cycleTime,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: int,
      dmgTypes: {
        physical: { skillDps: 0, skillTotalDamage: trigPhys, cycleDps: (chargeAttacks * normPhys + trigPhys) / cycleTime },
        arts: { skillDps: 0, skillTotalDamage: dotTotal, cycleDps: dotTotal / cycleTime },
      },
    };
  } else if (op.id === 'char_422_aurora' && skillIndex === 1) {
    // 极光 S2 人工降雪（9发弹药制，打完即结束，间隔 1.6+0.25=1.85s）：每3发一循环——第1发进寒冷、第2发叠层冻结、第3发暴击（冻结目标攻击力提高至 310%）。
    // 默认单目标：9发=普通发(atk+65%)×6 + 暴击发(×3.1)×3（寒冷/冻结状态本身无伤害）
    const normHit = calcPhysicalDamage(panelAtk * (1 + 0.65), effDef);   // 普通发：atk 0.65 加攻
    const critHit = calcPhysicalDamage(panelAtk * 3.1, effDef);           // 暴击发：提高至 310%（替换非叠加）
    const total = normHit * 6 + critHit * 3;
    const ammoTime = 9 * (skillRealInterval > 0 ? skillRealInterval : 1);   // 打完总用时 9×1.85s
    result = {
      skillDps: ammoTime > 0 ? total / ammoTime : 0, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: { physical: { skillDps: ammoTime > 0 ? total / ammoTime : 0, skillTotalDamage: total, cycleDps: null } },
    };
  } else if (op.id === 'char_493_firwhl' && skillIndex === 1) {
    // 火哨 S2 焦土:普攻照常(物理 6击)+ 燃烧区持续5s>攻击间隔2.8s 区域重叠常驻 → 全程每秒0.75×atk法伤×17s
    const physHit = calcPhysicalDamage(panelAtk, effDef);
    const physAttacks = Math.floor(skillDuration / (skillRealInterval > 0 ? skillRealInterval : 1));
    const physTotal = physHit * physAttacks;
    const burnHit = calcArtsDamage(panelAtk * 0.75, state.enemy.res);
    const burnTotal = burnHit * skillDuration;
    const total = physTotal + burnTotal;
    result = {
      skillDps: total / skillDuration, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: {
        physical: { skillDps: physTotal / skillDuration, skillTotalDamage: physTotal, cycleDps: null },
        arts: { skillDps: burnTotal / skillDuration, skillTotalDamage: burnTotal, cycleDps: null },
      },
    };
  } else if (op.id === 'char_1034_jesca2' && skillIndex === 2) {
    // 涤火杰西卡 S3 饱和迸射（20发弹药打完即结束，间隔 1.2+0.6=1.8s）：
    // 弹药=atk+X% 普攻（skillAtk 数据驱动）+ 首炮一发 attack@extrabomb.atk_scale×技能期攻击力（默认玩家放盾开炮）
    const perHit = calcPhysicalDamage(skillAtk, effDef);
    const firstShot = calcPhysicalDamage(skillAtk * (levelData['attack@extrabomb.atk_scale'] ?? 1), effDef);
    const ammoN = levelData.trigger_time ?? levelData['attack@trigger_time'] ?? 20;
    const total = perHit * ammoN + firstShot;
    const ammoTime = ammoN * (skillRealInterval > 0 ? skillRealInterval : 1);
    result = {
      skillDps: ammoTime > 0 ? total / ammoTime : 0, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: { physical: { skillDps: ammoTime > 0 ? total / ammoTime : 0, skillTotalDamage: total, cycleDps: null } },
    };
  } else if (op.id === 'char_1045_svash2' && skillIndex === 2) {
    // 凛御银灰 S3 变革已至(dur48 手动):攻击范围扩大,攻击对直线范围敌人造成 atk×bird_atk_scale 物理伤害并施加脆弱
    // (专一档 1.8×;damage_scale 脆弱为目标受伤害提升,单目标持续命中必然全程吃到→每击乘 1.25;
    // 回费/换费/风雪之眼可部署为部署区机制不计)。
    const s3Mul = (levelData.bird_atk_scale ?? 1.8) * (levelData.damage_scale ?? 1);
    const perHit = calcPhysicalDamage(skillAtk * s3Mul, effDef);
    const s3Hits = Math.floor(skillDuration / (skillRealInterval > 0 ? skillRealInterval : 1));
    const s3Total = perHit * s3Hits;
    result = {
      skillDps: skillDuration > 0 ? s3Total / skillDuration : 0, skillTotalDamage: s3Total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: { physical: { skillDps: skillDuration > 0 ? s3Total / skillDuration : 0, skillTotalDamage: s3Total, cycleDps: null } },
    };
  } else if (op.id === 'char_261_sddrag' && skillIndex === 1) {
    // 苇草 S2 生灵火花(dur30):攻击力+X(物理普攻强化),每次攻击附加 atk×attack@skill.atk_scale 法术伤害
    // (击杀回费不计);每击=物理+法伤混合,物法双档;附加法伤按技能期攻击力×0.35 结算
    const addScale = levelData['attack@skill.atk_scale'] ?? 0;
    const intWc = skillRealInterval > 0 ? skillRealInterval : 1;
    const hitsWc = skillDuration > 0 ? Math.floor(skillDuration / intWc) : 0;
    const physHitWc = calcPhysicalDamage(skillAtk, effDef);
    const artsHitWc = calcArtsDamage(skillAtk * addScale, state.enemy.res);
    const physTotalWc = physHitWc * hitsWc;
    const artsTotalWc = artsHitWc * hitsWc;
    const totalWc = physTotalWc + artsTotalWc;
    result = {
      skillDps: skillDuration > 0 ? totalWc / skillDuration : 0, skillTotalDamage: totalWc, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: intWc,
      dmgTypes: {
        physical: { skillDps: skillDuration > 0 ? physTotalWc / skillDuration : 0, skillTotalDamage: physTotalWc, cycleDps: null },
        arts: { skillDps: skillDuration > 0 ? artsTotalWc / skillDuration : 0, skillTotalDamage: artsTotalWc, cycleDps: null },
      },
    };
  } else if (BEARER_HEAL_SKILLS[op.id] && BEARER_HEAL_SKILLS[op.id][skillIndex] !== undefined) {
    // 执旗手 S2 治疗:每秒 1 跳,治疗量=面板攻击力×ratio(不吃技能期攻击/治疗加成);停攻回费,普攻转治疗
    const ratioKey = BEARER_HEAL_SKILLS[op.id][skillIndex];
    const ratioVal = levelData[ratioKey] ?? 0;
    const hpsBear = panelAtk * ratioVal;
    const durBear = skillDuration > 0 ? skillDuration : 1;
    const normIntB = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1;
    result = {
      type: 'heal', skillHps: hpsBear, totalHeal: hpsBear * durBear,
      skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalHps: null,
      normalDps: calcPhysicalDamage(panelAtk, effDef) / realInterval,
      realInterval: normIntB, panelAtk,
    };
  } else if (op.id === 'char_479_sleach' && skillIndex === 2) {
    // 琴柳 S3 光辉旗帜(dur10 MANUAL):开启瞬间单发物理伤害(panelAtk×atk_scale 逐级),眩晕/易伤(damage_scale)/减攻(debuff)/回费不计
    const flagHit = calcPhysicalDamage(panelAtk * (levelData.atk_scale ?? 1), effDef);
    const flagInt = phase.baseAttackTime > 0 ? calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus) : 1;  // 常态间隔含天赋攻速(不退之旗+10)
    result = {
      skillDps: skillDuration > 0 ? flagHit / skillDuration : 0, skillTotalDamage: flagHit, cycleDps: null,
      normalDps: calcPhysicalDamage(panelAtk, effDef) / flagInt, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: flagInt,
      dmgTypes: { physical: { skillDps: skillDuration > 0 ? flagHit / skillDuration : 0, skillTotalDamage: flagHit, cycleDps: null } },
    };
  } else if (op.id === 'char_4087_ines' && skillIndex === 0) {
    // 伊内丝 S1 淬影突袭(攻回 AUTO sp3,触发当次普攻照常):下次攻击附带 3s 流血 DOT(每秒 0.65×atk 法伤 专一,不叠加)
    const inesPhys = calcPhysicalDamage(panelAtk, effDef);
    const bleedScale = levelData.bleed_atk_scale ?? 0;
    const bleedSecs = Math.max(1, Math.round(levelData.bleed_duration ?? 3));
    const bleedTotal = calcArtsDamage(panelAtk * bleedScale, state.enemy.res) * bleedSecs;
    const spCostI1 = levelData.spCost > 0 ? levelData.spCost : 1;
    const intI1 = skillRealInterval > 0 ? skillRealInterval : 1;
    const chargeI1 = Math.ceil(spCostI1 / (levelData.attackIncrement || 1));   // 攻回充能击数
    const cycleTimeI1 = (chargeI1 + 1) * intI1;
    const physCycleI1 = (chargeI1 + 1) * inesPhys;                             // 充能普攻+触发当次
    result = {
      skillDps: 0, skillTotalDamage: inesPhys + bleedTotal, cycleDps: cycleTimeI1 > 0 ? (physCycleI1 + bleedTotal) / cycleTimeI1 : 0,
      normalDps: inesPhys / intI1, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: intI1,
      dmgTypes: {
        physical: { skillDps: 0, skillTotalDamage: inesPhys, cycleDps: physCycleI1 / cycleTimeI1 },
        arts: { skillDps: 0, skillTotalDamage: bleedTotal, cycleDps: bleedTotal / cycleTimeI1 },
      },
    };
  } else if (op.id === 'char_4087_ines' && skillIndex === 1) {
    // 伊内丝 S2 暗夜无明(dur12 攻回):攻击力+90%(专一),每次攻击偷取 6 攻速(至多 60→10 击满),
    // 线性模拟:攻速逐击爬升(100→160),击时刻=Σ 基础间隔×(100/当前攻速),直到超出持续时间
    const inesAtk = skillAtk;  // 已含 atk+90%(无 atk_scale 污染)
    let t2 = 0, aspd2 = 100, hits2 = 0;
    while (t2 < skillDuration - 1e-9) {
      hits2++;
      aspd2 = Math.min(aspd2 + (levelData['attack@steal_atk_speed'] ?? 0), 100 + (levelData['attack@steal_atk_speed_max'] ?? 0));
      t2 += calcRealInterval(phase.baseAttackTime, aspd2);
    }
    const inesTotal2 = calcPhysicalDamage(inesAtk, effDef) * hits2;
    result = {
      skillDps: skillDuration > 0 ? inesTotal2 / skillDuration : 0, skillTotalDamage: inesTotal2, cycleDps: null,
      normalDps: calcPhysicalDamage(panelAtk, effDef) / (phase.baseAttackTime > 0 ? phase.baseAttackTime : 1),
      skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: phase.baseAttackTime > 0 ? phase.baseAttackTime : 1,
      dmgTypes: { physical: { skillDps: skillDuration > 0 ? inesTotal2 / skillDuration : 0, skillTotalDamage: inesTotal2, cycleDps: null } },
    };
  } else if (op.id === 'char_4087_ines' && skillIndex === 2) {
    // 伊内丝 S3 独影归途(被动 dur14):部署后攻击力+140%(专一)持续期间普攻照常(atk_scale 非普攻倍率,还原);
    // 开启瞬间收回影哨对穿过敌人造成 atk_scale×当前攻击 单发物理(专一 1.6,多目标按单目标 1 次)
    const inesAtk3 = skillAtk / (levelData.atk_scale ?? 1);   // 还原不含 atk_scale 的技能期攻击力
    const inesInt3 = skillRealInterval > 0 ? skillRealInterval : 1;
    const inesHits3 = Math.floor(skillDuration / inesInt3);
    const inesNorm3 = calcPhysicalDamage(inesAtk3, effDef) * inesHits3;
    const inesFlag3 = calcPhysicalDamage(inesAtk3 * (levelData.atk_scale ?? 1), effDef);
    const inesTotal3 = inesNorm3 + inesFlag3;
    result = {
      skillDps: skillDuration > 0 ? inesTotal3 / skillDuration : 0, skillTotalDamage: inesTotal3, cycleDps: null,
      normalDps: calcPhysicalDamage(panelAtk, effDef) / inesInt3, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: inesInt3,
      dmgTypes: { physical: { skillDps: skillDuration > 0 ? inesTotal3 / skillDuration : 0, skillTotalDamage: inesTotal3, cycleDps: null } },
    };
  } else if (op.id === 'char_4052_surfer' && skillIndex === 0 && getModuleLevelData(op, slotData) && (SKILL_MODULE_SPD_BUFF[op.id] || {})[getModuleLevelData(op, slotData).level]) {
    // 寻澜 S1 探寻(限时被动 dur18s atk+X%)+ X 模组「佳肴」攻速 buff:部署时若周围4格无干员(默认成立)
    // 回费并攻击速度+10/15 持续 10s(attack_speed_up_duration)。用户口径:落地生效技能分两部分计算——
    // 前 10s 按 buff 攻速间隔打,后 8s 按常态间隔,两段击数求和(伤害每击恒定 atk 加成)。
    const spdCfg = (SKILL_MODULE_SPD_BUFF[op.id] || {})[getModuleLevelData(op, slotData).level];
    const buffDur = Math.min(skillDuration || 0, spdCfg.duration);
    const buffInt = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus + spdCfg.atkSpeed);
    // buff 结束后模组白值攻速仍在(baseAspdBonus 含 mod.attackSpeed),后段用无 buff 间隔
    const normInt = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus);
    const hitsA = buffDur > 0 ? Math.floor(buffDur / buffInt + 1e-9) : 0;
    const hitsB = (skillDuration - buffDur) > 0 ? Math.floor((skillDuration - buffDur) / normInt + 1e-9) : 0;
    const perHit = calcPhysicalDamage(panelAtk * (1 + (levelData.atk || 0)), effDef) * calcTalentDmgMul(op, slotData);
    const total = perHit * (hitsA + hitsB);
    result = {
      skillDps: skillDuration > 0 ? total / skillDuration : 0, skillTotalDamage: total, cycleDps: null,
      normalDps: calcPhysicalDamage(panelAtk, effDef) * calcTalentDmgMul(op, slotData) / normInt,
      skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: buffInt,
      dmgTypes: { physical: { skillDps: skillDuration > 0 ? total / skillDuration : 0, skillTotalDamage: total, cycleDps: null } },
    };
  } else if (op.id === 'char_4052_surfer' && skillIndex === 1) {
    // 寻澜 S2 洞悉(dur10 攻回 手动):攻击速度+47(专一),每次攻击偷取 45 防御(至多 225=5 层),
    // 线性模拟:敌人防御逐击递减(600→555→...→375 第 6 击起),每击伤害按当时防御结算
    const surferInt = calcRealInterval(phase.baseAttackTime, 100 + (levelData.attack_speed ?? 0));
    const surferHits = Math.floor(skillDuration / surferInt);
    const defSteal = levelData.def_steal ?? 0, defMax = levelData.def_steal_max ?? 0;
    let surferTotal = 0;
    for (let k = 0; k < surferHits; k++) {
      const effDefL = Math.max(0, effDef - Math.min(defMax, defSteal * k));
      surferTotal += calcPhysicalDamage(panelAtk, effDefL);
    }
    result = {
      skillDps: skillDuration > 0 ? surferTotal / skillDuration : 0, skillTotalDamage: surferTotal, cycleDps: null,
      normalDps: calcPhysicalDamage(panelAtk, effDef) / (phase.baseAttackTime > 0 ? phase.baseAttackTime : 1),
      skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: surferInt,
      dmgTypes: { physical: { skillDps: skillDuration > 0 ? surferTotal / skillDuration : 0, skillTotalDamage: surferTotal, cycleDps: null } },
    };
  } else if (op.id === 'char_4017_puzzle' && skillIndex === 1) {
    // 谜图 S2 疑点追踪(dur8 攻回 手动):攻击速度+63(专一),每击使目标 16s 内每秒受 0.13×atk 法伤 DOT,
    // 层数逐击递增至多 10 且刷新 16s(单 DOT 合并,层数=当前层);线性模拟:整秒跳伤害×当时层数
    const puzzleInt = calcRealInterval(phase.baseAttackTime, 100 + (levelData.attack_speed ?? 0));
    const puzzleHits = Math.floor(skillDuration / puzzleInt);
    const tickScale = levelData['attack@atk_scale_2'] ?? 0;
    const tickDur = levelData['attack@duration_2'] ?? 16;
    const maxCnt = levelData['attack@max_cnt'] ?? 10;
    // 击时刻表 t_i=(i-1)×interval
    const tEnd = (puzzleHits - 1) * puzzleInt + tickDur;   // 最后一击 DOT 窗口结束
    let dotTotal = 0;
    for (let sec = 1; sec <= Math.ceil(tEnd); sec++) {
      let layers = 0;
      for (let i = 0; i < puzzleHits; i++) { if ((i) * puzzleInt < sec && sec <= (i) * puzzleInt + tickDur) layers = Math.min(maxCnt, i + 1); }
      if (layers > 0) dotTotal += calcArtsDamage(panelAtk * tickScale * layers, state.enemy.res);
    }
    const puzzleNorm = calcPhysicalDamage(panelAtk, effDef) * puzzleHits;
    const puzzleTotal = puzzleNorm + dotTotal;
    result = {
      skillDps: skillDuration > 0 ? puzzleTotal / skillDuration : 0, skillTotalDamage: puzzleTotal, cycleDps: null,
      normalDps: calcPhysicalDamage(panelAtk, effDef) / (phase.baseAttackTime > 0 ? phase.baseAttackTime : 1),
      skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: puzzleInt,
      dmgTypes: {
        physical: { skillDps: puzzleNorm / skillDuration, skillTotalDamage: puzzleNorm, cycleDps: null },
        arts: { skillDps: dotTotal / skillDuration, skillTotalDamage: dotTotal, cycleDps: null },
      },
    };
  } else if (op.id === 'char_497_ctable' && skillIndex === 1) {
    // 晓歌 S2 浮光(弹药型手动):攻击力+32% 攻速+38(专一),16 发弹药打完结束(弹药数=attack@trigger_time 键),
    // 天赋万全攻速+12 已入面板基数;DPS=单发伤害/实际攻击间隔(等效普攻 dps)
    const cantInt = calcRealInterval(phase.baseAttackTime, 100 + (levelData.attack_speed ?? 0) + calcTalentAttackSpeed(op, slotData));
    const ammo = Math.round(levelData['attack@trigger_time'] ?? 16);
    const cantHit = calcPhysicalDamage(skillAtk, effDef);   // skillAtk 已含 atk+32%
    const cantTotal = cantHit * ammo;
    const cantDur = cantInt * ammo;
    result = {
      skillDps: cantDur > 0 ? cantTotal / cantDur : 0, skillTotalDamage: cantTotal, cycleDps: null,
      normalDps: calcPhysicalDamage(panelAtk, effDef) / realInterval,
      skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: cantInt,
      dmgTypes: { physical: { skillDps: cantDur > 0 ? cantTotal / cantDur : 0, skillTotalDamage: cantTotal, cycleDps: null } },
    };
  } else if (op.id === 'char_1001_amiya2' && skillIndex === 1) {
    // 阿米娅(近卫) S2 影霄·绝影(手动,整场一次):对前方生命最低目标 10 次斩击——前 9 次 atk_scale×atk 法伤,
    // 最后一击系数加倍(atk_scale_2)且为真实伤害;斩击期间每击败敌人叠 40%atk 与伤害变真——默认不击杀不触发(同烈焰魔剑口径)。
    // 斩击耗时无数据源 → skillDps=0 仅展示精确总伤,cycleDps=null(一次性技能无周期)。
    const slashHit = calcArtsDamage(skillAtk, state.enemy.res);
    const tailRatio = (levelData.atk_scale && levelData.atk_scale > 0) ? (levelData.atk_scale_2 / levelData.atk_scale) : 2;
    const tailHit = calcTrueDamage(skillAtk * tailRatio);
    const nSlash = levelData.times ?? 10;
    const totalSlash = slashHit * Math.max(0, nSlash - 1) + tailHit;
    result = {
      skillDps: 0, skillTotalDamage: totalSlash, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: skillRealInterval,
      dmgTypes: {
        arts: { skillDps: 0, skillTotalDamage: slashHit * Math.max(0, nSlash - 1), cycleDps: null },
        true: { skillDps: 0, skillTotalDamage: tailHit, cycleDps: null },
      },
    };
  } else if (op.id === 'char_112_siege' && skillIndex === 2) {
    // 推进之王 S3 碎颅击(dur22~25):攻击间隔增大(1.05+1=2.05s,BAT_ADD),攻击时攻击力提高至 attack@atk_scale 倍(3.4→3.8 普攻改写),
    // 40% 概率晕眩(控制不计)→ 每击 atk_scale×atk 物理
    const perHit = calcPhysicalDamage(skillAtk * (levelData['attack@atk_scale'] ?? 1), effDef);
    const hits = Math.floor(skillDuration / (skillRealInterval > 0 ? skillRealInterval : 1));
    const total = perHit * hits;
    result = {
      skillDps: skillDuration > 0 ? total / skillDuration : 0, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: { physical: { skillDps: skillDuration > 0 ? total / skillDuration : 0, skillTotalDamage: total, cycleDps: null } },
    };
  } else if (op.id === 'char_4230_mcnist' && skillIndex === 2) {
    // 机械师 S3 工程学十字星（dur40，间隔 1.2+2.3=3.5s）：普攻改写为 attack@atk_scale×技能期攻击力法伤（11击）
    // + 结构性原理冲锋一发 atk_scale×技能期攻击力物理（默认结构体在场命中；虚弱不计）
    const artsHit = calcArtsDamage(skillAtk * (levelData['attack@atk_scale'] ?? 1), state.enemy.res);
    const artsAttacks = Math.floor(skillDuration / (skillRealInterval > 0 ? skillRealInterval : 1));
    const artsTotal = artsHit * artsAttacks;
    const chargeHit = calcPhysicalDamage(skillAtk * (levelData.atk_scale ?? 1), effDef);
    const total = artsTotal + chargeHit;
    const dps = total / skillDuration;
    result = {
      skillDps: dps, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: skillRealInterval,
      dmgTypes: {
        arts: { skillDps: artsTotal / skillDuration, skillTotalDamage: artsTotal, cycleDps: null },
        physical: { skillDps: chargeHit / skillDuration, skillTotalDamage: chargeHit, cycleDps: null },
      },
    };
  } else if (op.id === 'char_4194_rmixer' && skillIndex === 1) {
    // 信仰搅拌机 S2 八臂电锯侠（47发弹药打完即结束）：atk+120% 普攻弹药（致命伤耗弹抵挡不计）
    const perHit = calcPhysicalDamage(panelAtk * (1 + 1.2), effDef);
    const total = perHit * 47;
    const ammoTime = 47 * (skillRealInterval > 0 ? skillRealInterval : 1);
    result = {
      skillDps: ammoTime > 0 ? total / ammoTime : 0, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: { physical: { skillDps: ammoTime > 0 ? total / ammoTime : 0, skillTotalDamage: total, cycleDps: null } },
    };
  } else if (op.id === 'char_457_blitz' && skillIndex === 1) {
    // 闪击 S2 突破防线：先手对阻挡敌 1.8×atk 物理+眩晕6s；攻速+200(间隔0.4s)期间攻击眩晕目标，天赋倍率×1.5 → 每击 160%×1.5=240%
    // 0.4s×15击=6s 全在眩晕窗口 → 15 击全部 2.4 倍
    const leadHit = calcPhysicalDamage(panelAtk * 1.8, effDef);
    const stunHit = calcPhysicalDamage(panelAtk * 2.4, effDef);
    const hitInt = calcRealInterval(phase.baseAttackTime, 100 + 200);
    const stunAttacks = Math.floor(skillDuration / hitInt);
    const total = leadHit + stunHit * stunAttacks;
    result = {
      skillDps: total / skillDuration, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: hitInt,
      dmgTypes: { physical: { skillDps: total / skillDuration, skillTotalDamage: total, cycleDps: null } },
    };
  } else if (!isSummon && ((NORMAL_ATK_SKILLS[op.id] || []).includes(skillIndex) || (SUMMONER_OWN_NORMAL_SKILLS[op.id] || []).includes(skillIndex))) {
    // 纯防御/控制技能（无输出增益，普攻照常）：雷蛇 S1 充能防御（受击自动 def）、闪击 S1 闪光护盾（眩晕控制）；
    // 伤害类型按职业(法伤干员如夜魔 S2 归常态=术师法伤普攻,含减抗/穿透后的有效法抗)
    // 常态普攻间隔用 realInterval(含天赋/模组白值攻速),与无技能态展示一致
    // (曾用 phase.baseAttackTime 硬写,baseline 攻速被忽略 → 初雪 X 模组 S1 与 S0 常态不一致)
    const naArts = op.damageType === 'arts';
    const normHit = naArts ? calcArtsDamage(panelAtk, effRes) : calcPhysicalDamage(panelAtk, effDef);
    const naInterval = realInterval > 0 ? realInterval : 1;
    result = {
      skillDps: 0, skillTotalDamage: 0, cycleDps: null,
      normalDps: normHit / naInterval,
      skillHps: null, normalHps: null, totalHeal: null,
      damageType: naArts ? 'arts' : 'physical', realInterval: skillRealInterval,
    };
  } else if (!isSummon && levelData.heal_scale !== undefined && levelData.skillDuration === 0) {
    // 自愈型一次性技能(非医疗,如卡缇 S1「生命回复·α」skcom_heal_self):立即恢复最大生命 heal_scale 比例
    const healAmount = panelHp * levelData.heal_scale;
    result = { skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null, skillHps: null, normalHps: null, totalHeal: healAmount };
  } else if (op.id === 'char_4229_aphris' && skillIndex === 1) {
    // 谬因 S2「临界瞬爆」:向前一条持续 8s 的光束,每 0.5s 对直线上敌人造成 1.3×atk(专一)法伤 = 16 跳;
    // 技能期间本体不再普攻(用户口径:二技能期间没有普攻);常态行按无技能态照常展示
    const beamTicks = Math.floor(skillDuration / 0.5);
    const beamHit = calcArtsDamage(skillAtk, effRes);
    const beamTotal = beamHit * beamTicks;
    const normI = realInterval > 0 ? realInterval : 1;
    const normHit = op.damageType === 'arts' ? calcArtsDamage(panelAtk, effRes) : calcPhysicalDamage(panelAtk, effDef);
    result = {
      skillDps: skillDuration > 0 ? beamTotal / skillDuration : 0, skillTotalDamage: beamTotal,
      cycleDps: null, normalDps: normHit / normI, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', normalDamageType: op.damageType, realInterval: 0.5,
      dmgTypes: { arts: { skillDps: skillDuration > 0 ? beamTotal / skillDuration : 0, skillTotalDamage: beamTotal, cycleDps: null } },
    };
  } else if (op.id === 'char_4229_aphris' && skillIndex === 2) {
    // 谬因 S3「混沌的本质」:弹药 20 发(attack@trigger_time),开启停攻 3s 后以 1.8s 间隔逐发打出;
    // 每发 1.7×atk(专一)法伤,弹道经中继器额外造成 0.3×atk 法伤(用户口径:中继器吃满 → 每发都算);
    // 弹药槽口径:技能期即耗弹出击,常态行保持 null(同玛露西尔/维伊 S3)
    const ammo = typeof levelData['attack@trigger_time'] === 'number' ? levelData['attack@trigger_time'] : 20;
    const shotBase = skillAtk;   // 含技能 atk+125% 与「链路协议」技能期 +25% 的攻击力
    const shotHit = calcArtsDamage(shotBase * 1.7, effRes);
    const shotExtra = calcArtsDamage(shotBase * 0.3, effRes);
    const shotTotal = (shotHit + shotExtra) * ammo;
    const ammoWindow = ammo * (skillRealInterval > 0 ? skillRealInterval : 1);
    result = {
      skillDps: ammoWindow > 0 ? shotTotal / ammoWindow : 0, skillTotalDamage: shotTotal,
      cycleDps: null, normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', normalDamageType: null, realInterval: skillRealInterval,
      dmgTypes: { arts: { skillDps: ammoWindow > 0 ? shotTotal / ammoWindow : 0, skillTotalDamage: shotTotal, cycleDps: null } },
    };
  } else if (!isSummon && (PERIODIC_DOT[op.id] || {})[skillIndex]) {
    // 停攻 + 周期法术 DOT(把正常攻击改为周期性范围法伤):
    // 露托 S2 强磁防卫每2s 0.8×atk(magic_atk_scale 键);斥罪 S2 坚心苦修每秒 1.2×atk(skillAtk 已含 atk_scale)
    const dotCfg = (PERIODIC_DOT[op.id] || {})[skillIndex];
    const dotInterval = dotCfg.interval > 0 ? dotCfg.interval : 1;
    // 有效法抗:天赋法穿(resPen)/天赋减抗(mrDebuffMul) → 技能级减抗(命中效果先于结算);
    // 常态行只含天赋部分,不含技能级减抗(技能期才生效的效果不得污染常态行)
    const dotTalentRes = Math.max(0, ((state.enemy.res || 0) - (resPen || 0)) * calcTalentMrDebuffMul(op, slotData) * (hitMrMul || 1));
    const dotMrRaw = levelData.magic_resistance;
    let dotRes = dotTalentRes;
    if (typeof dotMrRaw === 'number' && dotMrRaw < 0 && dotMrRaw > -1) dotRes = Math.max(0, dotRes * (1 + dotMrRaw));
    if (typeof dotMrRaw === 'number' && dotMrRaw <= -1) dotRes = Math.max(0, dotRes + dotMrRaw);
    const dotHit = calcArtsDamage(dotCfg.atkScaleKey ? skillAtk * levelData[dotCfg.atkScaleKey] : skillAtk, dotRes);
    const jumps = Math.floor(skillDuration / dotInterval);
    const dotTotal = dotHit * jumps;
    const normInterval = realInterval;   // 常态间隔=面板间隔
    const normDps = (op.damageType === 'arts' ? calcArtsDamage(panelAtk, dotTalentRes) : calcPhysicalDamage(panelAtk, effDef)) / normInterval;
    result = {
      skillDps: skillDuration > 0 ? dotTotal / skillDuration : 0, skillTotalDamage: dotTotal,
      cycleDps: null, normalDps: normDps, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: dotInterval, normalDamageType: op.damageType,
      dmgTypes: { arts: { skillDps: skillDuration > 0 ? dotTotal / skillDuration : 0, skillTotalDamage: dotTotal, cycleDps: null } },
    };
  } else if (op.id === 'char_4141_marcil' && skillIndex === 0) {
    // 玛露西尔 S1 才女的实力(魔力弹药口径):短暂吟唱 1.5s 后开启,每次攻击消耗 sp_cost 魔力使攻击+X%(L8 +100%)——
    // 满魔(mana_max 80)共 floor(80/2)=40 下弹药,打完自动结束(非永续,用户口径);弹药总时长 40×2.9≈116s,
    // 期间无常态普攻(攻击即耗弹强化);找不到目标转治疗、魔力不自然回复不计
    const mInterval = skillRealInterval > 0 ? skillRealInterval : 1;
    const mManaMax = levelData.mana_max ?? 80;
    const mCostPerHit = levelData.sp_cost ?? 2;
    const mAmmo = Math.max(1, Math.floor(mManaMax / mCostPerHit));   // 40 击
    const mHit = calcArtsDamage(skillAtk, state.enemy.res);          // skillAtk 含天赋 20%+技能 atk+100%(乘区累加 2.2×raw)
    const mTotal = mHit * mAmmo;
    const mWindow = mAmmo * mInterval;
    result = {
      skillDps: mWindow > 0 ? mTotal / mWindow : 0, skillTotalDamage: mTotal, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: mInterval,
      dmgTypes: { arts: { skillDps: mWindow > 0 ? mTotal / mWindow : 0, skillTotalDamage: mTotal, cycleDps: null } },
    };
  } else if (op.id === 'char_4141_marcil' && skillIndex === 2) {
    // 玛露西尔 S3 爆破魔法(魔力系统简化口径):吟唱 5s 后对正前方范围造成 atk_scale×atk 法伤(基础 1 爆,耗 8 魔),
    // 追加吟唱 10s 每额外 8 魔力追加 1 爆——满魔(mana_max 80)折算 1+(80-8)/8=10 爆全中(单目标模型),
    // 每爆间隔 interval 0.45s;魔力自然回复/吟唱前摇/眩晕不计
    const mBurstHit = calcArtsDamage(skillAtk, state.enemy.res);  // skillAtk 已含 atk_scale 3.5
    const mManaMax = levelData.mana_max ?? 80;
    const mBaseCost = levelData.skill_cost_min_sp ?? 8;
    const mPerCost = levelData.sp_cost_extra ?? 8;
    const mExtra = Math.max(0, Math.floor((mManaMax - mBaseCost) / mPerCost));
    const mTotal = mBurstHit * (1 + mExtra);
    result = {
      skillDps: 0, skillTotalDamage: mTotal, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: (levelData.interval ?? 0.45) > 0 ? levelData.interval : 1,
      dmgTypes: { arts: { skillDps: 0, skillTotalDamage: mTotal, cycleDps: null } },
    };
  } else if (op.id === 'char_4031_liesel' && skillIndex === 1) {
    // 复奏 S2 直到终曲(手动,单发):立即对攻击范围内最多 3 个目标造成 atk_scale×atk 法伤(单目标模型=1 目标全额),
    // 命中敌人 6s 内每秒受 liesel_s_2[dot].atk_scale×atk 法伤(DOT 每秒一跳,6 跳全中)
    const burstHit = calcArtsDamage(skillAtk, state.enemy.res);   // skillAtk 已含顶层 atk_scale 1.7
    const dotScale = levelData['liesel_s_2[dot].atk_scale'] ?? 0.3;
    const dotSecs = Math.floor(levelData['liesel_s_2[dot].duration'] ?? 6);
    const dotTotal = calcArtsDamage(panelAtk * dotScale, state.enemy.res) * dotSecs;
    const spCost = levelData.spCost > 0 ? levelData.spCost : 1;
    const interval = skillRealInterval > 0 ? skillRealInterval : 1;
    const chargeAttacks = Math.floor(spCost / interval);
    const cycleTotal = chargeAttacks * calcArtsDamage(panelAtk, state.enemy.res) + burstHit + dotTotal;
    result = {
      skillDps: 0, skillTotalDamage: burstHit + dotTotal, cycleDps: cycleTotal / spCost,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: interval,
      dmgTypes: { arts: { skillDps: 0, skillTotalDamage: burstHit + dotTotal, cycleDps: cycleTotal / spCost } },
    };
  } else if (!isSummon && (TRIGGER_ARTS_ADD[op.id] || {})[skillIndex]) {
    // AUTO 触发附加法伤(斥罪 S1 一锤定音,sp4 自然回):下次攻击=普攻物理+额外 atk_scale_2×atk 法伤,
    // 混合单发(蓄力分支 judge_s_1_enhance_checker 设计上持续输出永远无法蓄力,不计)
    const trigCfg = (TRIGGER_ARTS_ADD[op.id] || {})[skillIndex];
    const artsScale = levelData[trigCfg.scaleKey] ?? 1;
    const triggerPhys = calcPhysicalDamage(panelAtk, effDef);
    const triggerArts = calcArtsDamage(panelAtk * artsScale, state.enemy.res);
    const spCost = levelData.spCost > 0 ? levelData.spCost : 1;
    const interval = skillRealInterval > 0 ? skillRealInterval : 1;
    const chargeAttacks = Math.floor(spCost / interval);              // 充能期普攻次数(自然回)
    const cycleTime = spCost;
    const physCycle = ((chargeAttacks + 1) * triggerPhys);            // 触发当次普攻也算物理
    const artsCycle = triggerArts;
    const normDps = triggerPhys / interval;
    result = {
      skillDps: 0, skillTotalDamage: triggerPhys + triggerArts,
      cycleDps: cycleTime > 0 ? (physCycle + artsCycle) / cycleTime : 0,
      normalDps: normDps, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: interval,
      dmgTypes: {
        physical: { skillDps: 0, skillTotalDamage: triggerPhys, cycleDps: physCycle / cycleTime },
        arts: { skillDps: 0, skillTotalDamage: triggerArts, cycleDps: artsCycle / cycleTime },
      },
    };
  } else if (op.id === 'char_1044_hsgma2' && skillIndex === 1) {
    // 斩业星熊 S2 无始无明(AUTO 攻回 sp7 触发):仅算本体三连击(0.75×atk 法伤×3),
    // 盾牌环绕法伤/吸血/停顿不计;每 7 次普攻充能触发一次(cycle 口径同 calcCycleDps 攻回)
    const trigPhys = calcPhysicalDamage(panelAtk, effDef);
    const triggerHit = calcArtsDamage(panelAtk * 0.75, state.enemy.res) * 3;
    const interval = skillRealInterval > 0 ? skillRealInterval : 1;
    const chargeAttacks = 7;                                // sp7 攻回
    const cycleTime = (chargeAttacks + 1) * interval;
    result = {
      skillDps: 0, skillTotalDamage: triggerHit,
      cycleDps: cycleTime > 0 ? (chargeAttacks * trigPhys + triggerHit) / cycleTime : 0,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', normalDamageType: 'physical', realInterval: interval,
      dmgTypes: {
        physical: { skillDps: 0, skillTotalDamage: 0, cycleDps: chargeAttacks * trigPhys / cycleTime },
        arts: { skillDps: 0, skillTotalDamage: triggerHit, cycleDps: triggerHit / cycleTime },
      },
    };
  } else if (op.id === 'char_1050_chen3' && skillIndex === 1) {
    // 赤刃明霄陈 S2 绝影-驰(手动 6s):开启瞬发 10 次斩击(每次面板攻击力×4.8 弱点,不吃 +300%),
    // 默认打不死不转移;斩击结束移动后 +300% 攻击(×4)持续 6 秒,期间普攻照常(弱点)。
    // 技能期总伤 = 10 斩 + 6s 加攻普攻;技能期时长口径 = 斩击演出 + 6s,斩击耗时无数据源
    // → 按引擎惯例 skillDuration=6 折算 DPS(用户口径:斩击耗时不计入分母,但完整技能时间>6s,
    //   此处 DPS 用总伤/6 近似会高估,故改用 cycleDps=null + skillTotalDamage 精确、skillDps 按总伤/6 仅供量级参考)
    const weakHit2 = (atk) => isWeaknessOn ? Math.max(calcPhysicalDamage(atk, effDef), calcArtsDamage(atk, state.enemy.res)) : calcArtsDamage(atk, state.enemy.res);
    const weakType2 = (atk) => (!isWeaknessOn || calcPhysicalDamage(atk, effDef) >= calcArtsDamage(atk, state.enemy.res)) ? 'physical' : 'arts';
    const slashScale = levelData.atk_scale ?? 4.8;      // 斩击倍率(逐级取档 3.5→4.8)
    const slashAtk = panelAtk * slashScale;             // 斩击:面板×倍率(技能无顶层 atk 加成)
    const slashTotal = weakHit2(slashAtk) * 10;         // 10 斩
    // 斩击后 +300%:respawn_buff.atk 乘算加数(逐级 2→3,×3~4),持续 6s(移动后状态),期间普攻间隔=面板攻速后间隔
    const buffMul = (levelData['chen3_s2[respawn_buff].atk'] ?? 3) + 1;
    const buffAtk = panelAtk * buffMul;
    const buffHits = Math.floor(6 / skillRealInterval); // 6s 内普攻次数(向下取整)
    const buffTotal = weakHit2(buffAtk) * buffHits;
    const total = slashTotal + buffTotal;
    const interval = skillRealInterval > 0 ? skillRealInterval : 1;
    // 弱点类型按主要贡献段(斩击)标;混合段类型拆分放 dmgTypes
    const slashType = weakType2(slashAtk);
    const buffType = weakType2(buffAtk);
    result = {
      skillDps: 0, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: slashType, normalDamageType: null, realInterval: interval,
      dmgTypes: {
        [slashType]: { skillDps: 0, skillTotalDamage: slashTotal, cycleDps: null },
        [buffType]: { skillDps: 0, skillTotalDamage: buffTotal, cycleDps: null },
      },
    };
    // 同类型合并展示(若斩击与加攻普攻同为物理/法伤,合并成单档)
    if (slashType === buffType) {
      result.dmgTypes = { [slashType]: { skillDps: 0, skillTotalDamage: total, cycleDps: null } };
    }
  } else if (op.id === 'char_1050_chen3' && skillIndex === 2) {
    // 赤刃明霄陈 S3 天喟(手动 20s):开启释放剑气一次(对穿过的敌人造成当前生命 6% 法伤,
    // 至少面板×projectile_min_atk_scale;剑气飞行无法控制 → 单目标默认只结算 1 次;6% 按敌人当前生命默认满血取 hp)。
    // 技能期普攻:每次攻击对最多 4 名地面敌人造成 3 次面板×attack@atk_scale 伤害(前缀键
    // → 单目标 = 每次攻击 3 连击×倍率弱点,攻击次数=floor(20/间隔) 向下取整)。
    const weakHit3 = (atk) => isWeaknessOn ? Math.max(calcPhysicalDamage(atk, effDef), calcArtsDamage(atk, state.enemy.res)) : calcArtsDamage(atk, state.enemy.res);
    const weakType3 = (atk) => (!isWeaknessOn || calcPhysicalDamage(atk, effDef) >= calcArtsDamage(atk, state.enemy.res)) ? 'physical' : 'arts';
    const enemyHp = (state.enemy && state.enemy.hp) || 50000;
    const swordScale = levelData.projectile_min_atk_scale ?? 5.8;  // 剑气保底倍率(逐级取档)
    const atkScale3 = levelData['attack@atk_scale'] ?? 2.1;        // 普攻每击倍率(逐级取档)
    const swordAtk = Math.max(enemyHp * 0.06, panelAtk * swordScale);  // 剑气当量(6% 当前生命 vs 保底倍率,取高)
    const swordHit = weakHit3(swordAtk);                            // 剑气 1 次(弱点取优)
    const interval = skillRealInterval > 0 ? skillRealInterval : 1;
    const attacks = Math.floor(20 / interval);                      // 20s 内攻击次数(向下取整)
    const perAtk = weakHit3(panelAtk * atkScale3) * 3;              // 每次攻击=3 连击×每击倍率
    const atkTotal = perAtk * attacks;
    const total = swordHit + atkTotal;
    const swordType = weakType3(swordAtk);
    const atkType = weakType3(panelAtk * 2.1);
    const skillDps = total / 20;
    result = {
      skillDps, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: swordType, normalDamageType: null, realInterval: interval,
      dmgTypes: {
        [swordType]: { skillDps: swordHit / 20, skillTotalDamage: swordHit, cycleDps: null },
        [atkType]: { skillDps: atkTotal / 20, skillTotalDamage: atkTotal, cycleDps: null },
      },
    };
    if (swordType === atkType) {
      result.dmgTypes = { [swordType]: { skillDps, skillTotalDamage: total, cycleDps: null } };
    }
  } else if (op.id === 'char_4226_veen' && skillIndex === 1) {
    // 维伊 S2「以鲜血洗去」(手动 28s):攻击间隔小幅缩短(键 -0.5 = 加算秒 → 3.0-0.5=2.5s,再算攻速);
    // 每次攻击或发射储存能量后使自身后续攻击力 +attack@veen_s_2_buff[stack].atk、攻击速度 +...attack_speed,
    // 至多 ...max_stack_cnt 层,持续至技能结束(发射转置能量可叠 3 层,本模型无转置能量) → 用户口径:整个技能线性计算。
    // 逐击模拟:第 i 击前层数 = min(i, 上限),命中按当前层数结算、下一击间隔按当前层数重算;单目标模型全中。
    const vSt = 'attack@veen_s_2_buff[stack]';
    const vMax = levelData[vSt + '.max_stack_cnt'] ?? 9;
    const vAtk = levelData[vSt + '.atk'] ?? 0;
    const vSpd = levelData[vSt + '.attack_speed'] ?? 0;
    const vBase = phase.baseAttackTime + (levelData.base_attack_time || 0);
    const vNormI = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus);
    let vT = 0, vStacks = 0, vTotal = 0, vHits = 0;
    while (vHits < 500) {
      const iv = calcRealInterval(vBase, 100 + baseAspdBonus + vSpd * Math.min(vStacks, vMax));
      if (iv <= 0) break;
      if (vT + iv > skillDuration + 1e-9 && vHits > 0) break;
      vTotal += calcArtsDamage(panelAtk * (1 + vAtk * Math.min(vStacks, vMax)), state.enemy.res);
      vHits++;
      vStacks = Math.min(vMax, vStacks + 1);
      vT += iv;
    }
    const vDps = skillDuration > 0 ? vTotal / skillDuration : 0;
    result = {
      skillDps: vDps, skillTotalDamage: vTotal, cycleDps: null,
      normalDps: op.damageType === 'arts' ? calcArtsDamage(panelAtk, state.enemy.res) / vNormI : calcPhysicalDamage(panelAtk, effDef) / vNormI,
      skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', normalDamageType: op.damageType,
      realInterval: calcRealInterval(vBase, 100 + baseAspdBonus),
      dmgTypes: { arts: { skillDps: vDps, skillTotalDamage: vTotal, cycleDps: null } },
    };
  } else if (op.id === 'char_4226_veen' && skillIndex === 2) {
    // 维伊 S3「用赤铁铭记」(手动,弹药型):攻击速度 +150;攻击装有 attack@trigger_time 发弹药(24),
    // 每发 = 一次攻击(发射储存能量)造成攻击力 attack@base_atk_scale(=100%) 法伤;
    // 弹射(attack@bounce_atk_scale,优先不同目标)在单目标模型下无第二目标 → 不计;
    // 弹药打完结束 → 技能窗口 = 弹药数×间隔,期间无常态普攻(攻击即耗弹) → 常态行 null。
    const vAmmo = Math.max(1, Math.round(levelData['attack@trigger_time'] ?? 1));
    const vIv = skillRealInterval > 0 ? skillRealInterval : 1;
    const vHit = calcArtsDamage(panelAtk * (levelData['attack@base_atk_scale'] ?? 1), state.enemy.res);
    const vTot = vHit * vAmmo;
    const vWin = vAmmo * vIv;
    result = {
      skillDps: vWin > 0 ? vTot / vWin : 0, skillTotalDamage: vTot, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', normalDamageType: op.damageType, realInterval: vIv,
      dmgTypes: { arts: { skillDps: vWin > 0 ? vTot / vWin : 0, skillTotalDamage: vTot, cycleDps: null } },
    };
  } else if (op.id === 'char_1041_angel2') {
    // 特种·怪杰 新约能天使:三技能均为弹药型「攻击装有 attack@trigger_time 发弹药,打完后结束(可随时停止)」——
    // 弹药打完即结束 → 技能窗口 = 弹药数 × 攻击间隔(期间逐发出击、即耗弹出伤),常态化列仍按自身普攻(同圣约送葬人口径)。
    // 天赋「火力电台」的轰炸(概率溅射)按用户口径 2026-09-18 不计算。
    const nI = realInterval > 0 ? realInterval : 1;
    const sI = skillRealInterval > 0 ? skillRealInterval : nI;
    const aP = (a) => calcPhysicalDamage(a, effDef);
    const nDps = aP(panelAtk) / nI;
    const aAmmo = Math.max(0, Math.round(levelData['attack@trigger_time'] || 0));
    const aMk = (tot, win, iv) => ({
      type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false,
      skillDps: win > 0 ? tot / win : 0, skillTotalDamage: tot, cycleDps: null,
      normalDps: nDps, skillHps: null, normalHps: null, totalHeal: null,
      realInterval: iv, panelAtk: skillAtk, dmgTypes: { physical: { skillDps: win > 0 ? tot / win : 0, skillTotalDamage: tot, cycleDps: null } },
    });
    if (skillIndex === 0) {
      // S1 天空大扫除(自动触发,8 发):每发 = 攻击力 attack@atk_scale 物理(优先空中单位=索敌规则不计)
      const per = aP(panelAtk * (levelData['attack@atk_scale'] || 1));
      const win = aAmmo * nI;
      result = aMk(per * aAmmo, win, nI);
    } else if (skillIndex === 1) {
      // S2 开火成瘾症(手动,35 发):攻击间隔 -0.7s(1.3→0.6);每发 = 攻击力 attack@atk_scale 物理;
      // 用户口径 2026-09-18:默认不偷取友方攻击速度(也不额外 +5 发弹药);屏障/回血非输出不计
      const per = aP(panelAtk * (levelData['attack@atk_scale'] || 1));
      const win = aAmmo * sI;
      result = aMk(per * aAmmo, win, sI);
    } else {
      // S3 使命必达！:攻击力 +X%(顶层 atk),每次攻击变为 5 连击每击 attack@atk_scale;弹药 50 发、每次攻击消耗 5 发 → 10 次攻击。
      // 「投递坐标」的 250% 溅射与投送部署属部署区机制(需存在合法投递对象)→ 不计。
      const perAtk = 5 * aP(skillAtk * (levelData['attack@atk_scale'] || 1));
      const nAtk = Math.max(1, Math.floor(aAmmo / 5));
      const win = nAtk * nI;
      result = aMk(perAtk * nAtk, win, nI);
    }
  } else if (op.id === 'char_272_strong' || (op.id === 'char_322_lmlee' && skillIndex === 1) || (op.id === 'char_1033_swire2' && (skillIndex === 1 || skillIndex === 2))) {
    // 特种·行商(merchant)专用分支:孑 S1/S2(常驻强化 + S2 治疗量)、老鲤 S2(标记引爆法术)、
    // 琳琅诗怀雅 S2(香槟炸弹陷阱)、S3(二连击 + 关闭金币爆发)
    result = calcMerchantSkill(op, slotData, { panelAtk, skillAtk, effDef, effRes, realInterval, skillRealInterval, levelData, skillIndex });
  } else if (op.subProfessionId === 'traper') {
    // 特种·陷阱师(traper)专用分支:技能主动=放置陷阱 → 技能期 DPS 0、总伤=一个陷阱触发伤害,常态化列=自身普攻
    result = calcTraperSkill(op, slotData, { panelAtk, skillAtk, effDef, effRes, realInterval, skillRealInterval, levelData, skillIndex });
  } else if ((AUTO_BOOST_SKILLS[op.id] || {})[skillIndex] !== undefined) {
    // AUTO 下次攻击强化:自然回 sp 周期内普攻照常,强化击按级别倍率(单目标:多目标/弹跳不计)
    const abKey = AUTO_BOOST_SKILLS[op.id][skillIndex];
    const abInt = skillRealInterval > 0 ? skillRealInterval : 1;
    const abSp = levelData.spCost > 0 ? levelData.spCost : 8;
    const abHit = calcArtsDamage(panelAtk * levelData[abKey], state.enemy.res);
    const abNorm = calcArtsDamage(panelAtk, state.enemy.res);
    const abCycle = Math.floor(abSp / abInt) * abNorm + abHit;
    result = {
      skillDps: 0, skillTotalDamage: abHit, cycleDps: abSp > 0 ? abCycle / abSp : 0,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', normalDamageType: op.damageType, realInterval: abInt,
      dmgTypes: { arts: { skillDps: 0, skillTotalDamage: abHit, cycleDps: abSp > 0 ? abCycle / abSp : 0 } },
    };
  } else if (op.id === 'char_472_pasngr' && skillIndex === 2) {
    // 异客 S3 辉煌裂片(手动,可充能2次):在生命值最高目标处生成持续 duration=4s 的雷暴区域,
    // 每 interval=0.5s 以 atk_scale(130% L7档/135% 专一)对该区域敌人追加一次攻击 —— 与本体攻击独立并行 → 8 跳;
    // 充能按"一次释放一次"口径(同圣聆初雪 S1),长期量以 cycleDps=(周期普攻+8跳)/spCost 展示,常态行照常。
    const ffTicks = Math.max(1, Math.floor((levelData.duration || 0) / (levelData.interval || 0.5)));
    const ffHit = calcArtsDamage(panelAtk * levelData.atk_scale, state.enemy.res);
    const ffTotal = ffHit * ffTicks;
    const ffField = levelData.duration || 4;
    const ffInt = skillRealInterval > 0 ? skillRealInterval : 1;
    const ffSp = levelData.spCost > 0 ? levelData.spCost : 30;
    const ffCycle = Math.floor(ffSp / ffInt) * calcArtsDamage(panelAtk, state.enemy.res) + ffTotal;
    const ffNormInt = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus);
    result = {
      skillDps: ffTotal / ffField, skillTotalDamage: ffTotal, cycleDps: ffSp > 0 ? ffCycle / ffSp : 0,
      normalDps: op.damageType === 'arts' ? calcArtsDamage(panelAtk, effRes) / ffNormInt : calcPhysicalDamage(panelAtk, effDef) / ffNormInt,
      skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', normalDamageType: op.damageType, realInterval: ffInt,
      dmgTypes: { arts: { skillDps: ffTotal / ffField, skillTotalDamage: ffTotal, cycleDps: ffSp > 0 ? ffCycle / ffSp : 0 } },
    };
  } else if ((SKIP_SKILLS[op.id] || {})[skillIndex]) {
    // 技能不计算(斩业星熊 S2 无始无明:投盾系伤害不建模型)→ 技能期无增益,常态普攻照常展示
    const nI = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1;
    const isArtsOp = op.damageType === 'arts';
    result = {
      skillDps: 0, skillTotalDamage: 0, cycleDps: null,
      normalDps: isArtsOp ? calcArtsDamage(panelAtk, state.enemy.res) / nI : calcPhysicalDamage(panelAtk, effDef) / nI,
      skillHps: null, normalHps: null, totalHeal: null,
      damageType: isArtsOp ? 'arts' : 'physical', normalDamageType: isArtsOp ? 'arts' : 'physical',
      type: 'damage', realInterval: skillRealInterval,
    };
  } else if (op.id === 'char_456_ash' && skillIndex === 1) {
    // 灰烬 S2 突击战术(用户口径 2026-09-17):弹药型 31 发,间隔 1.0-0.8=0.2s;不计对晕眩目标增伤(敌人不一定被晕眩)。
    // 每发 = 技能期攻击力 × ash_s_2[atk_scale](专一 2.2);总伤 = 31 × 每发;用时 = 31 × 间隔。
    const ashScale = levelData['ash_s_2[atk_scale].atk_scale'] ?? 1;
    const ashPer = calcPhysicalDamage(panelAtk * ashScale, effDef);
    const ashAmmo = 31;
    const ashTotal = ashPer * ashAmmo;
    const ashTime = ashAmmo * (skillRealInterval > 0 ? skillRealInterval : 0.2);
    const ashDps = ashTime > 0 ? ashTotal / ashTime : 0;
    result = {
      skillDps: ashDps, skillTotalDamage: ashTotal, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: { physical: { skillDps: ashDps, skillTotalDamage: ashTotal, cycleDps: null } },
    };
  } else if (op.id === 'char_456_ash' && skillIndex === 2) {
    // 灰烬 S3 攻坚榴弹(用户口径 2026-09-17):手动瞬发,一次部署两发;每发 = 沿途(not_hitwall_scale)+ 爆炸(atk_scale),
    // 打墙项(hitwall_scale,伤害更高)按墙外爆炸口径不计。总伤 = 2 × (atk_scale + not_hitwall_scale) × 攻击力。
    const ashBurstPer = calcPhysicalDamage(panelAtk * ((levelData.atk_scale || 0) + (levelData.not_hitwall_scale || 0)), effDef);
    const ashBurstTotal = ashBurstPer * 2;
    result = {
      skillDps: 0, skillTotalDamage: ashBurstTotal, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: { physical: { skillDps: 0, skillTotalDamage: ashBurstTotal, cycleDps: null } },
    };
  } else if (op.id === 'char_498_inside' && (skillIndex === 0 || skillIndex === 1)) {
    // 隐现「不惹麻烦」/「解决麻烦」(用户口径 2026-09-17):弹药型,弹药量 = attack@trigger_time + 天赋「火力支援」
    // self_ammo(在场停留 20s 后 +3,E2 潜0);S1 每发 = 攻击力 × attack@atk_scale(专一 2.1),S2 每发 = 技能期攻击力(顶层 atk);
    // 间隔:S1 1.0s、S2 1.0-0.3=0.7s。总伤 = 弹药数 × 每发;用时 = 弹药数 × 间隔。
    const inAmmo = (levelData['attack@trigger_time'] || 0) + funnelTalentValue(op, slotData, 0, 'self_ammo');
    const inPer = skillIndex === 0
      ? calcPhysicalDamage(panelAtk * (levelData['attack@atk_scale'] ?? 1), effDef)
      : calcPhysicalDamage(skillAtk, effDef);
    const inTotal = inPer * inAmmo;
    const inTime = inAmmo * (skillRealInterval > 0 ? skillRealInterval : 1);
    const inDps = inTime > 0 ? inTotal / inTime : 0;
    result = {
      skillDps: inDps, skillTotalDamage: inTotal, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: { physical: { skillDps: inDps, skillTotalDamage: inTotal, cycleDps: null } },
    };
  } else if (op.id === 'char_1021_kroos2' && skillIndex === 1) {
    // 寒芒克洛丝 S2 封喉(用户口径 2026-09-17):窗口连射——攻击变为 2 连射,累计命中 max_stack_count 次后转 4 连射。
    // 单目标模型:前 ceil(stacks/2) 次攻击为 2 连射,其余 4 连射;逐击伤害相同 → 按平均发数折算总伤。
    const kroosInt = skillRealInterval > 0 ? skillRealInterval : 1;
    const kroosAtt = Math.max(0, Math.floor(skillDuration / kroosInt + 1e-9));
    const kroosStacks = levelData['attack@max_stack_count'] || 32;
    const kroosN2 = Math.min(kroosAtt, Math.ceil(kroosStacks / 2));
    const kroosHits = kroosN2 * 2 + (kroosAtt - kroosN2) * 4;
    const kroosPer = calcPhysicalDamage(panelAtk, effDef);
    const kroosTotal = kroosPer * kroosHits;
    const kroosDps = skillDuration > 0 ? kroosTotal / skillDuration : 0;
    result = {
      skillDps: kroosDps, skillTotalDamage: kroosTotal, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: { physical: { skillDps: kroosDps, skillTotalDamage: kroosTotal, cycleDps: null } },
    };
  } else if (op.subProfessionId === 'musha' && MUSHA_SPECIAL[op.id] && MUSHA_SPECIAL[op.id].includes(skillIndex)) {
    const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
    const Pp = (a) => calcPhysicalDamage(a, effDef);
    const mkM = (sTot, sDps, cd, panel, nDps) => ({ type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd, normalDps: nDps, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: panel || skillAtk, dmgTypes: { physical: { skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd } } });
    const nAtk = realInterval > 0 ? Pp(panelAtk) / realInterval : null;  // 常态化列:自身普攻 DPS(与引擎 dur>0 技能同口径)
    // 火龙S黑角 S1「居合拔刀气刃斩」:纳刀期间停止攻击,受击时反击 multi_times 段(每段 multi_atk_scale,逐段单独扣防)。
    // 用户口径(2026-09-17):受击默认触发一次,技能期 DPS 按技能标注窗口(6s)摊;常态化列保留自身普攻。
    if (op.id === 'char_1030_noirc2' && skillIndex === 0) {
      const n = levelData.multi_times || 4;
      const a = panelAtk * (levelData.multi_atk_scale || 1);
      const tot = Pp(a) * n;
      return mkM(tot, skillDuration > 0 ? tot / skillDuration : 0, null, a, nAtk);
    }
    // 火龙S黑角 S2「气刃兜割」:瞬发对单敌 7 段 multi_atk_scale(逐段单独扣防),技能期长度 = 技能标注 1.4s;
    // 「可充能2次」只影响再充能,不计入单次伤害(与现有充能型技能同一口径)。
    if (op.id === 'char_1030_noirc2' && skillIndex === 1) {
      const n = levelData.multi_times || 7;
      const a = panelAtk * (levelData.multi_atk_scale || 1);
      const tot = Pp(a) * n;
      return mkM(tot, skillDuration > 0 ? tot / skillDuration : 0, null, a, nAtk);
    }
    // 左乐 S3「佑序有炎」:立刻 7 段斩击,末击系数加倍(总段数 = times - 1 + last_atk_bonus),触发型(dur 0)
    // → 只给技能期总伤 + 循环 DPS(同陈 S3/艾丽妮 S3 口径);最多 3 名目标按单目标口径。
    if (op.id === 'char_4121_zuole' && skillIndex === 2) {
      const times = levelData.times || 7;
      const lastMul = levelData.last_atk_bonus || 1;
      const a = panelAtk * (levelData.atk_scale || 1);
      const tot = Pp(a) * (times - 1) + Pp(a * lastMul);
      return mkM(tot, 0, calcCycleDps(levelData, realInterval, Pp(panelAtk), tot), a, null);
    }
    return calcDamage(params);
  } else if (op.subProfessionId === 'reaper' && REAPER_SPECIAL[op.id] && REAPER_SPECIAL[op.id].includes(skillIndex)) {
    // 收割者分支采用「赋值 result 后继续走链尾后处理」的写法(同晓歌 S2 弹药口径),不提前 return:
    // 隐德来希天赋「萃血」的固定 DOT 由链尾 TALENT_FLAT_DOT 通道追加,提前 return 会漏掉。
    const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
    const Pp = (a) => calcPhysicalDamage(a, effDef);
    const nDps = realInterval > 0 ? Pp(panelAtk) / realInterval : null;   // 常态化列:自身普攻 DPS(与引擎 dur>0 技能同口径)
    const mkR = (sTot, sDps, cd, panel, nD) => ({ type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd, normalDps: nD, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: panel || skillAtk, dmgTypes: { physical: { skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd } } });
    // 圣约送葬人:三个技能均为弹药型「攻击装有 N 发弹药,打完后结束」。
    // 弹药数 = attack@trigger_time + 天赋「铳弹共感」弹药上限(每有 1 名【拉特兰】干员在场 +1,最多 4 层;
    // 用户口径 2026-09-17:默认按 1 层 → +1);技能期窗口 = 弹药数 × 攻击间隔,期间即耗弹出击 → 常态化列仍按自身普攻;
    // Y 模组「已知悉」的「弹药类技能期间攻击力 +8%/+12%」是必然生效效果(闪避部分不计) → 计入。
    if (op.id === 'char_1032_excu2') {
      const ammo = Math.round(levelData['attack@trigger_time'] || 0) + (funnelTalentValue(op, slotData, 1, 'add_count') || 0);
      const yMul = 1 + (funnelTalentValue(op, slotData, 1, 'atk') || 0);
      const win = ammo * (sIvl > 0 ? sIvl : 1.3);
      if (skillIndex === 0) {
        // S1 遗嘱执行:攻击力 +X%(专一 +40%),攻击时无视目标 def_penetrate_fixed 防御(专一 320);8 发弹药
        const a = skillAtk * yMul;
        const per = calcPhysicalDamage(a, Math.max(0, effDef - (levelData.def_penetrate_fixed || 0)));
        const tot = per * ammo;
        result = mkR(tot, win > 0 ? tot / win : 0, null, a, nDps);
      } else if (skillIndex === 1) {
        // S2 近身铳斗:攻击力 +X%(专一 +70%);防御力/阻挡数不计输出,「受击闪避补 1 颗弹药」默认不触发 → 弹药不增加;12 发弹药
        const a = skillAtk * yMul;
        const tot = Pp(a) * ammo;
        result = mkR(tot, win > 0 ? tot / win : 0, null, a, nDps);
      } else {
        // S3 圣约决裁:攻击间隔略微增大 +0.5(BAT_ADD,1.3→1.8s);攻击力 +X%(专一 +160%),
        // 每消耗 1 颗弹药攻击力额外 +attack@atk%(专一 5%,上限 attack@max_stack_cnt = 30 层)。
        // 结算顺序(用户口径 2026-09-17):「先结算弹药消耗带来的攻击力增加、再出伤」→ 第 k 发含 k 层
        // (首击即 +5%,末发 17 发时 +85%);
        // 技能结束时追加 1 击:对技能期间攻击过的目标造成 attack@final_atk_scale × 攻击力 的物理伤害
        // (专一 200%/专三 250%)。PRTS 备注「技能结束时的攻击受到攻击力/特性加成影响」→ 基值取叠满后的攻击力
        // (即叠加收益被末击再吃一次)。
        // 注:attack@atk 已由引擎按 1 层并入 skillAtk(见参数区 attack@atk 的 direct_mul),故每层增量单列。
        const perAmmo = levelData['attack@atk'] || 0;
        const capSt = levelData['attack@max_stack_cnt'] || 30;
        const stepAtk = panelAtk * perAmmo;
        let tot = 0, lastAtk = skillAtk * yMul;
        for (let i = 1; i <= ammo; i++) {
          lastAtk = (skillAtk + stepAtk * (Math.min(i, capSt) - 1)) * yMul;
          tot += Pp(lastAtk);
        }
        tot += Pp(lastAtk * (levelData['attack@final_atk_scale'] || 1));
        result = mkR(tot, win > 0 ? tot / win : 0, null, skillAtk * yMul, nDps);
      }
    } else if (op.id === 'char_4010_etlchi' && skillIndex === 2) {
      // 隐德来希 S3「灵与欲的惜别」:攻击范围扩大、攻击速度 +100(间隔 1.3→0.65s)、攻击力 +X%(专一 +120%),
      // 立刻为攻击范围内最多 3 名敌人召唤「心烛」(心烛继承原敌 100% 防御/法抗与 60% 当前生命;
      // 每击对心烛至少造成 35% 攻击力的伤害,心烛受伤时原敌受等量真实伤害)→ 单目标口径。
      // 用户口径 2026-09-17:每击 = max(常规物理伤害, 35%×攻击力);总伤按心烛生命(原敌当前生命 × attack@max_hp_scale)封顶。
      const hits = Math.max(1, Math.floor(skillDuration / (sIvl > 0 ? sIvl : 0.65) + 1e-9));
      const per = Math.max(Pp(skillAtk), skillAtk * 0.35);
      let tot = per * hits;
      const capHp = (state.enemy && state.enemy.hp ? state.enemy.hp : 0) * (levelData['attack@max_hp_scale'] || 0);
      if (capHp > 0) tot = Math.min(tot, capHp);
      result = mkR(tot, skillDuration > 0 ? tot / skillDuration : 0, null, skillAtk, nDps);
    } else if (op.id === 'char_4010_etlchi' && skillIndex === 1) {
      // 隐德来希 S2「绯红壁合」:停止攻击,召唤血镰每 bb.interval(0.5s)对周围敌人造成 atk_scale × 攻击力 的物理伤害;
      // 用户口径 2026-09-17:单目标只按 1 个血镰结算;血镰期间天赋「萃血」DOT 照旧整段计入(走链尾固定 DOT 通道)。
      const tick = levelData.interval > 0 ? levelData.interval : 0.5;
      const n = Math.max(1, Math.floor(skillDuration / tick + 1e-9));
      const a = panelAtk * (levelData.atk_scale || 1);
      const tot = Pp(a) * n;
      const d = skillDuration > 0 ? skillDuration : tick * n;
      result = { type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: d > 0 ? tot / d : 0, skillTotalDamage: tot, cycleDps: null, normalDps: nDps, skillHps: null, normalHps: null, totalHeal: null, realInterval: tick, panelAtk: a, dmgTypes: { physical: { skillDps: d > 0 ? tot / d : 0, skillTotalDamage: tot, cycleDps: null } } };
    } else {
      result = calcDamage(params);
    }
  } else if (op.subProfessionId === 'librator' && LIBRATOR_SPECIAL[op.id] && LIBRATOR_SPECIAL[op.id].includes(skillIndex)) {
    // 解放者分支(用户口径 2026-09-17):技能期默认特性叠满(+200%;玛恩纳 S3 按特性倍率 ×2 → +400%),
    // 常态行由链尾 librator 修正统一置 0(特性「通常不攻击」)。
    const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
    const Pp = (a) => calcPhysicalDamage(a, effDef);
    const Aa = (a) => calcArtsDamage(a, state.enemy.res);
    const traitBonus = (op.id === 'char_4064_mlynar' && skillIndex === 2) ? 4.0 : 2.0;   // 叠满 +200%;玛恩纳 S3 特性倍率 ×2
    // 「攻击力提升至 X%」型天赋:游侠(E2 潜0 110%,X 模组 L3 120%)、明断技能期(E2 潜0 107%,X 模组 L3 113%)
    // 用户口径 2026-09-17:此类天赋按独立乘区(乘在特性/技能等的攻击力加算池之外),不并入同一池
    const scaleTal = op.id === 'char_4064_mlynar' ? (funnelTalentValue(op, slotData, 0, 'atk_scale_base') || 1)
      : (op.id === 'char_1043_leizi2' ? (funnelTalentValue(op, slotData, 0, 'atk_scale[skill_up]') || 1) : 1);
    const atkT = panelAtk * (1 + traitBonus) * scaleTal;
    // 明断落雷等效(用户口径):攻击范围内地块每秒 10% 概率 × 100% 攻击力法术 → 等效每秒 0.1 × 原伤害
    // (基础等价量按技能期基础攻击力计;S2 正霆摄威期间改为按秒实时结算、该秒取当时已叠层数,见 S2 分支;
    //  常态行恒为 0,不计落雷)
    const lightScale = op.id === 'char_1043_leizi2' ? (funnelTalentValue(op, slotData, 0, 'atk_scale_t') || 0) : 0;
    const lightDps = lightScale > 0 ? 0.1 * Aa(atkT * lightScale) : 0;
    // 追责(司霆惊蛰第二天赋):开启技能时全地面地块落雷,对范围内敌人造成 100% 攻击力法术伤害 → 每次开技能 1 击
    const zhuizeTot = op.id === 'char_1043_leizi2' ? Aa(atkT * (funnelTalentValue(op, slotData, 1, 'atk_scale_t2') || 0)) : 0;
    const nHitsOf = (dur) => (dur > 0 && sIvl > 0) ? Math.max(1, Math.floor(dur / sIvl + 1e-9)) : 1;
    const mkL = (parts, winSec, panel) => {
      const phys = parts.phys || 0, arts = parts.arts || 0, tru = parts.true || 0;
      const tot = phys + arts + tru;
      const dt = {};
      if (phys > 0) dt.physical = { skillDps: winSec > 0 ? phys / winSec : 0, skillTotalDamage: phys, cycleDps: null };
      if (arts > 0) dt.arts = { skillDps: winSec > 0 ? arts / winSec : 0, skillTotalDamage: arts, cycleDps: null };
      if (tru > 0) dt.true = { skillDps: winSec > 0 ? tru / winSec : 0, skillTotalDamage: tru, cycleDps: null };
      return { type: 'damage', damageType: phys > 0 ? 'physical' : (arts > 0 ? 'arts' : 'true'), isToggle: false, isPermanent: false, skillDps: winSec > 0 ? tot / winSec : 0, skillTotalDamage: tot, cycleDps: null, normalDps: 0, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: panel || atkT, dmgTypes: dt };
    };
    if (op.id === 'char_1043_leizi2') {
      const n = nHitsOf(skillDuration);
      if (skillIndex === 0) {
        // S1 浩气长存:朝左/前/右各斩一次,对三个方向地面敌人各造成 315%(专一)物理(单目标只算命中它的 1 次);
        // 「可充能 3 次」不计;数据 skillDuration = -1,属触发型 → 只给总伤 + 循环 DPS(同陈 S3 口径,按自动回复 spCost 结算)
        const a = atkT * (levelData['attack@atk_scale_s1'] || 1);
        const phys = Pp(a), arts = zhuizeTot;
        const cd = (phys + arts) / (levelData.spCost || 1);
        const dt = { physical: { skillDps: 0, skillTotalDamage: phys, cycleDps: cd } };
        if (arts > 0) dt.arts = { skillDps: 0, skillTotalDamage: arts, cycleDps: cd };
        return { type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: 0, skillTotalDamage: phys + arts, cycleDps: cd, normalDps: 0, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: a, dmgTypes: dt };
      }
      if (skillIndex === 1) {
        // S2 正霆摄威:每击 130%(专一)物理,同时 3 名敌人(单目标口径 1 名);技能期间每次落雷使攻击力 +10%
        // (最多 25 层;用户口径:默认按每次攻击增加一层,先结算再出伤 → 第 k 击含 k 层)
        const scale = levelData['attack@atk_scale_s2'] || 1;
        const step = levelData['thunder_atk'] || 0.1;
        const cap = levelData['thunder_max_stack_cnt'] || 25;
        let phys = 0;
        for (let k = 1; k <= n; k++) phys += Pp(panelAtk * (1 + traitBonus + step * Math.min(k, cap)) * scaleTal * scale);
        // 明断落雷按秒实时结算(用户口径 2026-09-17):第 s 秒已完成攻击次数 = floor(s / 间隔)(上限 cap),
        // 该秒落雷伤害 = 0.1 × atk_scale_t × 叠层后的攻击力 → 取当时攻击力,叠层收益一并计入
        let lightTot = 0;
        const lightTicks = Math.floor(skillDuration + 1e-9);
        for (let s = 1; s <= lightTicks; s++) {
          const stk = Math.min(Math.floor(s / realInterval), cap);
          lightTot += 0.1 * Aa(panelAtk * (1 + traitBonus + step * stk) * scaleTal * lightScale);
        }
        return mkL({ phys, arts: lightTot + zhuizeTot }, skillDuration, atkT * scale);
      }
      // S3 天地通明:间隔 +1.7s(通用参数区 → 2.9s),每击 260%(专一)范围物理(单目标 1 击);
      // 电流:在目标位置生成朝四周流动的三格电流,电流所在地块敌人每 0.6s 受 60%(专一)攻击力法术伤害
      // (用户口径 2026-09-17:电流每 0.6s 独立结算一次,与本体普攻/攻击次数无关;持续时间同技能期 →
      //  结算次数 = floor(dur / 0.6);prob 5-15% 战栗为减益不计)
      const scale = levelData['attack@atk_scale_s3'] || 1;
      const curScale = levelData['attack@atk_scale_current'] || 0;
      const curTicks = Math.floor(skillDuration / 0.6 + 1e-9);
      const phys = Pp(atkT * scale) * n;
      const arts = Aa(atkT * curScale) * curTicks + lightDps * skillDuration + zhuizeTot;
      return mkL({ phys, arts }, skillDuration, atkT * scale);
    }
    if (op.id === 'char_4064_mlynar') {
      const n = nHitsOf(skillDuration);
      if (skillIndex === 0) {
        // S1 未声张的怒火:每击 180%(专一)物理(防御力 +45% 不计输出)
        const a = atkT * (levelData['attack@atk_scale'] || 1);
        return mkL({ phys: Pp(a) * n }, skillDuration, a);
      }
      if (skillIndex === 1) {
        // S2 未宽解的悲哀:间隔 +0.3s(见 BAT_ADD_OVERRIDES → 1.5s),每击 170%(专一)物理 × 二连击
        const a = atkT * (levelData['attack@atk_scale'] || 1);
        return mkL({ phys: Pp(a) * n * 2 }, skillDuration, a);
      }
      // S3 未照耀的荣光:特性倍率 ×2 → +400%;每击 160%(专一)物理,对 5 名目标(单目标口径 1 名);
      // 光环:范围内敌人受到卡西米尔干员攻击时额外附带玛恩纳 11%(专一)攻击力真实伤害(玛恩纳自身即卡西米尔)
      // 用户口径:默认不击倒任何敌人 → 特性加成不衰减(维持 +400%)
      const a = atkT * (levelData['attack@atk_scale'] || 1);
      const trueMul = levelData['atk_scale'] || 0;
      return mkL({ phys: Pp(a) * n, true: atkT * trueMul * n }, skillDuration, a);
    }
    if (op.id === 'char_445_wscoot') {
      // 藏锋伺敌(用户口径:默认生效):特性攻击力提升至最高时,每次攻击额外追加一次 X% 攻击力的攻击
      // (E2 潜0 = 40%,X 模组 L3 = 52%;追加攻击单独扣防)
      const extra = funnelTalentValue(op, slotData, 0, 'atk_scale') || 0;
      const n = nHitsOf(skillDuration);
      if (skillIndex === 0) {
        // S1 以攻为守:攻击速度 +42(专一,通用参数区折算间隔),无攻击力倍率 → 每击 = 攻击力 + 追加 40%
        return mkL({ phys: (Pp(atkT) + Pp(atkT * extra)) * n }, skillDuration, atkT);
      }
      // S2 招无虚发:每击 180%(专一)物理,同时 2 名敌人(单目标 1 名);备注明确追加攻击不享受技能攻击力倍率
      const a = atkT * (levelData['attack@atk_scale'] || 1);
      return mkL({ phys: (Pp(a) + Pp(atkT * extra)) * n }, skillDuration, a);
    }
    // 龙舌兰(char_486_takila)
    if (skillIndex === 0) {
      // S1 当机立断:攻击速度 +42(专一),每击 155%(专一)物理
      const a = atkT * (levelData['attack@atk_scale'] || 1);
      return mkL({ phys: Pp(a) * nHitsOf(skillDuration) }, skillDuration, a);
    }
    {
      // S2 剑走偏锋(用户口径:默认蓄力):每击 210%(专一)物理,同时 3 名敌人(单目标 1 名),
      // 持续时间取蓄力档 enhance_duration = 30s(技能标注 15s + duration_plus 15);「可主动关闭」不影响口径
      const a = atkT * (levelData['attack@atk_scale'] || 1);
      const durC = levelData.enhance_duration > 0 ? levelData.enhance_duration : skillDuration;
      return mkL({ phys: Pp(a) * nHitsOf(durC) }, durC, a);
    }
  } else if (op.subProfessionId === 'crusher' && CRUSHER_SPECIAL[op.id] && CRUSHER_SPECIAL[op.id].includes(skillIndex)) {
    // 重剑手(crusher)特例(用户口径 2026-09-17,详见 CRUSHER_SPECIAL 注释):
    //  · 赫德雷 S2 为切换型:被动攻击力 +32%(专一)计入常态(同荒芜拉普兰德 S1「装备即生效」先例),切换态间隔 +0.5s(见 BAT_ADD_OVERRIDES);
    //    S3「死境硝烟」的「自身攻击过和攻击过自身的敌人每秒受 200 点真实伤害」计入技能期(70s×200,无来源真实 DOT,不吃攻击/法抗/增伤);
    //    「每秒流失 100 生命」为自身流失、「25% 概率晕眩」为条件类,均不计。
    //  · 铎铃 S2 技能期停止攻击,结束时挥刀对前方所有地面敌人造成此时攻击力 210%(专一)物理伤害 → 单目标 1 击,结算取叠满档(+50%);
    //    「可主动关闭」不改变 5s 时长口径;25% 概率晕眩不计。
    //  · 乌尔比安 S3:立即船锚 1 击(此时攻击力 ×145%,单目标)+ 技能期本体普攻(攻击力 +240%),窗口 25s。
    const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
    const Pp = (a) => calcPhysicalDamage(a, effDef);
    const nn = (dur) => (dur > 0 && sIvl > 0) ? Math.max(1, Math.floor(dur / sIvl + 1e-9)) : 1;
    const tmul = calcTalentDmgMul(op, slotData);
    const mkC = (parts, winSec, panel, nDps) => {
      const phys = parts.phys || 0, arts = parts.arts || 0, tru = parts.tru || 0;
      const tot = phys + arts + tru;
      const dt = {};
      if (phys > 0) dt.physical = { skillDps: winSec > 0 ? phys / winSec : 0, skillTotalDamage: phys, cycleDps: null };
      if (arts > 0) dt.arts = { skillDps: winSec > 0 ? arts / winSec : 0, skillTotalDamage: arts, cycleDps: null };
      if (tru > 0) dt.true = { skillDps: winSec > 0 ? tru / winSec : 0, skillTotalDamage: tru, cycleDps: null };
      return { type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: winSec > 0 ? tot / winSec : 0, skillTotalDamage: tot, cycleDps: null, normalDps: nDps, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: panel, dmgTypes: dt };
    };
    if (op.id === 'char_4088_hodrer' && skillIndex === 1) {
      // S2 余烬重荷(切换型):被动攻击力 +32% + 切换态(间隔 3.0s/阻挡+1/攻击晕眩)。持续型展示(总伤 0,给每秒 DPS)
      const a = panelAtk * (1 + (levelData.atk || 0));
      const dps = Pp(a) * tmul / sIvl;
      return { type: 'damage', damageType: 'physical', isToggle: true, isPermanent: false, skillDps: dps, skillTotalDamage: 0, cycleDps: null, normalDps: Pp(a) * tmul / realInterval, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: a, dmgTypes: { physical: { skillDps: dps, skillTotalDamage: 0, cycleDps: null } } };
    }
    if (op.id === 'char_4088_hodrer') {
      // S3 死境硝烟:攻击力 +100%(专一)普攻 28 击 + 真实伤害 DOT(200/s × 70s)
      const a = panelAtk * (1 + (levelData.atk || 0));
      const phys = Pp(a) * tmul * nn(skillDuration);
      const tru = (levelData['attack@damage'] || 0) * Math.max(0, skillDuration);
      return mkC({ phys, tru }, skillDuration, a, Pp(panelAtk) * tmul / realInterval);
    }
    if (op.id === 'char_4083_chimes') {
      // S2 乡心无改:技能期停止攻击,结束时 1 击(此时攻击力 = 面板 ×1.5 叠满档,倍率 210%)
      const a = panelAtk * (1 + (levelData.atk || 0));
      const hit = Pp(a * (levelData['attack@atk_scale'] || 1)) * tmul;
      return mkC({ phys: hit }, skillDuration, a, Pp(panelAtk) * tmul / realInterval);
    }
    {
      // 乌尔比安 S3 必须开辟的通路:船锚 1 击(攻击力 ×145%)+ 技能期本体普攻(攻击力 +240%)
      const a = panelAtk * (1 + (levelData.atk || 0));
      const anchor = Pp(a * (levelData.atk_scale || 1)) * tmul;
      const body = Pp(a) * tmul * nn(skillDuration);
      return mkC({ phys: anchor + body }, skillDuration, a, Pp(panelAtk) * tmul / realInterval);
    }
  } else if (op.subProfessionId === 'mercenary' && MERCENARY_SPECIAL[op.id] && MERCENARY_SPECIAL[op.id].includes(skillIndex)) {
    // 佣兵(mercenary)特例(用户口径 2026-09-17,详见 MERCENARY_SPECIAL 注释)
    const Pm = (a) => calcPhysicalDamage(a, effDef);
    const Am = (a) => calcArtsDamage(a, effRes);
    const nMerc = Pm(panelAtk) / realInterval;
    // X 模组「狩猎之路」特性追加:开启技能消耗费用时每 1 点费用使本次技能期攻击力 +2%(上限 10 层)→ 满层 +20%
    // (模组 talentEnhance 里 name=null 的 {max_stack_cnt,atk} 档即此特性;与技能攻击力同池加算)
    let mercEquipAtk = 0;
    const mSlot = slotData.module;
    if (mSlot) {
      const modObj = (op.modules || []).find(x => x.id === mSlot.moduleId);
      const ml = modObj && (modObj.levels || []).find(l => l.level === mSlot.moduleLevel);
      if (ml) for (const te of (ml.talentEnhance || [])) {
        const bb = te.blackboard || {};
        if (te.name === null && typeof bb.atk === 'number' && typeof bb.max_stack_cnt === 'number') mercEquipAtk = Math.max(mercEquipAtk, bb.atk * bb.max_stack_cnt);
      }
    }
    if (skillIndex === 0) {
      // S1 高压回填斩:攻击变为"变形斩五连击 + 五连击 5 击 + 十连击 10 击"共 20 击(问答确认),
      // 每一击造成普攻物理伤害并附带攻击力 29%(专一)的法术伤害;间隔 +100%(INTERVAL_GROW_OVERRIDES)→ 窗口 4s
      const magicScale = levelData['attack@atk_magic'] !== undefined ? levelData['attack@atk_magic'] : (levelData.atk_magic || 0);
      const a = rawAtk * (1 + mercEquipAtk);
      const hits = 20;
      const physPer = Pm(a), artsPer = Am(a * magicScale);
      const win = skillDuration > 0 ? skillDuration : 4;
      const physTot = physPer * hits, artsTot = artsPer * hits;
      const sTot = physTot + artsTot;
      return { type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: sTot / win, skillTotalDamage: sTot, cycleDps: null, normalDps: nMerc, skillHps: null, normalHps: null, totalHeal: null, realInterval: skillRealInterval, panelAtk: a, dmgTypes: { physical: { skillDps: physTot / win, skillTotalDamage: physTot, cycleDps: null }, arts: { skillDps: artsTot / win, skillTotalDamage: artsTot, cycleDps: null } } };
    }
    {
      // S2 超高输出属性解放斩:装备应变(视为开启)→ 对前方造成一次攻击力 300%(专一)的物理伤害,之后技能立即结束;
      // 充能附加法术伤害按"不考虑充能"记 0(用户口径);技能自身攻击力 +90%(专一,顶层 atk)
      const a = rawAtk * (1 + mercEquipAtk + (levelData.atk || 0));
      const sTot = Pm(a * (levelData['attack@extra_physic_atk_scale'] || 0));
      const win = skillDuration > 0 ? skillDuration : 4;
      return { type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: sTot / win, skillTotalDamage: sTot, cycleDps: null, normalDps: nMerc, skillHps: null, normalHps: null, totalHeal: null, realInterval: skillRealInterval, panelAtk: a, dmgTypes: { physical: { skillDps: sTot / win, skillTotalDamage: sTot, cycleDps: null } } };
    }
  } else if (op.subProfessionId === 'hammer' && HAMMER_SPECIAL[op.id] && HAMMER_SPECIAL[op.id].includes(skillIndex)) {
    // 撼地者(hammer)特例(用户口径 2026-09-17,详见 HAMMER_SPECIAL 注释)
    const Ph = (a) => calcPhysicalDamage(a, effDef);
    // 怒潮凛冬「万众巨潮」:技能期间全场攻击力+14%(潜2 +18%),本人属【乌萨斯学生自治团】→ 翻倍
    // 与技能攻击力同池加算(引擎技能期口径 = 白值×(1+天赋%+技能%),同奥达/石英)
    const t2 = op.id === 'char_1051_headb2' ? 2 * (funnelTalentValue(op, slotData, 1, 'atk') || 0) : 0;
    const nBase = Ph(panelAtk) / realInterval;
    const mkH = (sTot, winSec, panel, nDps, cd = null) => ({ type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: winSec > 0 ? sTot / winSec : 0, skillTotalDamage: sTot, cycleDps: cd, normalDps: nDps, skillHps: null, normalHps: null, totalHeal: null, realInterval: skillRealInterval, panelAtk: panel, dmgTypes: { physical: { skillDps: winSec > 0 ? sTot / winSec : 0, skillTotalDamage: sTot, cycleDps: cd } } });
    if (op.id === 'char_1051_headb2' && skillIndex === 0) {
      // S1 誓不低头:攻击力+42%、攻速+45(通用键) + 第二天赋光环
      const a = panelAtk * (1 + t2 + (levelData.atk || 0));
      const n = Math.floor(skillDuration / skillRealInterval);
      return mkH(Ph(a) * n, skillDuration, a, nBase);
    }
    if (op.id === 'char_1051_headb2' && skillIndex === 1) {
      // S2 绝不罢休:第二次及以后能力加成翻倍(用户口径)→ 取数据 headb2_s_2[second] 档;持续时间无限 → 持续型(总伤 0、给每秒 DPS)
      const sec = levelData['headb2_s_2[second].atk'];
      const a = panelAtk * (1 + t2 + (sec !== undefined ? sec : (levelData.atk || 0)));
      const dps = Ph(a) / skillRealInterval;
      return { type: 'damage', damageType: 'physical', isToggle: false, isPermanent: true, skillDps: dps, skillTotalDamage: 0, cycleDps: null, normalDps: nBase, skillHps: null, normalHps: null, totalHeal: null, realInterval: skillRealInterval, panelAtk: a, dmgTypes: { physical: { skillDps: dps, skillTotalDamage: 0, cycleDps: null } } };
    }
    if (op.id === 'char_1051_headb2') {
      // S3 无可抵挡:对前方一格五连击(不受攻速影响,锤击间隔 1.8s),每击造成攻击力 210%(专一)物理伤害且攻击力额外+30%(逐击叠加)→ 窗口 5×1.8=9s
      const step = levelData.atk_step || 0;
      const base = panelAtk * (1 + t2 + (levelData.atk_base || 0));
      const scale = levelData.atk_scale || 1;
      let tot = 0;
      for (let k = 0; k < 5; k++) tot += Ph(base * (1 + step * k) * scale);
      return mkH(tot, 5 * 1.8, base, nBase);
    }
    if (op.id === 'char_4058_pepe' && skillIndex === 1) {
      // S2 阻遏混乱锤:攻击力+75%、攻速+70,叠层满 2 层额外 +40×2(问答确认)→ 间隔 1.8/(1+150/100)=0.72s
      const aspd = (levelData.attack_speed || 0) + (levelData.attack_speed_extra || 0) * (levelData.max_stack_cnt || 0);
      const iv = calcRealInterval(phase.baseAttackTime, 100 + aspd);
      const n = Math.floor(skillDuration / iv);
      const r = mkH(Ph(skillAtk) * n, skillDuration, skillAtk, nBase);
      return { ...r, realInterval: iv };
    }
    if (op.id === 'char_4058_pepe') {
      // S3 时光震荡:攻击间隔+0.2(入 BAT_ADD_OVERRIDES → 2.0s),每次攻击后攻击力额外+20%(专一)最多叠 4 层(逐击叠加,首击无层)
      const step = levelData['attack@atk'] || 0;
      const cap = levelData['attack@max_stack_cnt'] || 0;
      const n = Math.floor(skillDuration / skillRealInterval);
      const a1 = panelAtk * (1 + (levelData.atk || 0));
      let tot = 0;
      for (let k = 0; k < n; k++) tot += Ph(a1 * (1 + step * Math.min(k, cap)));
      return mkH(tot, skillDuration, a1, nBase);
    }
    if (op.id === 'char_4185_amoris' && skillIndex === 0) {
      // S1 如焰般热烈:特殊三连击(首击 151% 且溅射范围扩大,后两次 20%),一次攻击动作为 3 击
      const hv = levelData['attack@atk_scale_heavy'] || 1, lt = levelData['attack@atk_scale_light'] || 0;
      const n = Math.floor(skillDuration / skillRealInterval);
      return mkH((Ph(panelAtk * hv) + 2 * Ph(panelAtk * lt)) * n, skillDuration, panelAtk, nBase);
    }
    {
      // S2 如麦般生长:特殊八连击(第一、五次 118%,其余 10%),一次攻击动作为 8 击
      const hv = levelData['attack@atk_scale_heavy'] || 1, lt = levelData['attack@atk_scale_light'] || 0;
      const n = Math.floor(skillDuration / skillRealInterval);
      return mkH((2 * Ph(panelAtk * hv) + 6 * Ph(panelAtk * lt)) * n, skillDuration, panelAtk, nBase);
    }
  } else if (op.subProfessionId === 'fearless' && FEARLESS_SPECIAL[op.id] && FEARLESS_SPECIAL[op.id].includes(skillIndex)) {
    // 无畏者(fearless)特例(用户口径 2026-09-17,详见 FEARLESS_SPECIAL 注释):
    //  · 只拦下面三个技能,其余(芙兰卡/摩根/止颂/炎客/玫兰莎/缠丸/斯卡蒂/Castle-3 等)走引擎通用链;
    //  · 止颂 S3 的 lessng_s3[atk_scale] 190% 属「攻击被阻挡目标时」的加成,按不视为被阻挡口径不消费该键(只算本体普攻);
    //  · 摩根 S1/S2 的 attack@atk_scale 170% 走 ATK_SCALE_REWRITE,止颂 S2 的 2 连击走 MULTI_HIT。
    const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
    const Pp = (a) => calcPhysicalDamage(a, effDef);
    const Aa = (a) => calcArtsDamage(a, state.enemy.res);
    const nn = (dur) => (dur > 0 && sIvl > 0) ? Math.max(1, Math.floor(dur / sIvl + 1e-9)) : 1;
    const mkF = (parts, winSec, panel) => {
      const phys = parts.phys || 0, arts = parts.arts || 0, tru = parts.tru || 0;
      const tot = phys + arts + tru;
      const dt = {};
      if (phys > 0) dt.physical = { skillDps: winSec > 0 ? phys / winSec : 0, skillTotalDamage: phys, cycleDps: null };
      if (arts > 0) dt.arts = { skillDps: winSec > 0 ? arts / winSec : 0, skillTotalDamage: arts, cycleDps: null };
      if (tru > 0) dt.true = { skillDps: winSec > 0 ? tru / winSec : 0, skillTotalDamage: tru, cycleDps: null };
      return { type: 'damage', damageType: phys > 0 ? 'physical' : (arts > 0 ? 'arts' : 'true'), isToggle: false, isPermanent: false, skillDps: winSec > 0 ? tot / winSec : 0, skillTotalDamage: tot, cycleDps: null, normalDps: null, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: panel, dmgTypes: dt };
    };
    if (op.id === 'char_159_peacok') {
      // S2 创世纪:立即对周围所有敌人造成 290%(专一)攻击力的法术伤害(50% 失败效果按口径不计算 → 按成功档;
      // 「失去特殊能力」为减益不计);无持续时间 → 只给总伤 + 循环 DPS(同陈 S3 口径)
      const a = panelAtk * (levelData['success.atk_scale'] || 1);
      const hit = Aa(a);
      const cd = calcCycleDps(levelData, realInterval, Pp(panelAtk), hit);
      return { type: 'damage', damageType: 'arts', isToggle: false, isPermanent: false, skillDps: 0, skillTotalDamage: hit, cycleDps: cd, normalDps: null, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: a, dmgTypes: { arts: { skillDps: 0, skillTotalDamage: hit, cycleDps: cd } } };
    }
    if (op.id === 'char_4142_laios') {
      // S2 威吓战法:停止攻击,技能结束时立即对阻挡的敌人造成 400%(专一)攻击力的物理伤害(单目标 1 次)
      const a = panelAtk * (levelData.atk_scale || 1);
      return mkF({ phys: Pp(a) }, skillDuration, a);
    }
    {
      // S3 耀阳颔首:本体每击按技能期攻击力(专一 +110%)物理(「攻击自身与耀阳阻挡的单位时转真实」按不视为被阻挡口径不计),
      // 召唤「耀阳」那一击为无条件效果:110%(专一)攻击力真实伤害 1 次
      const n = nn(skillDuration);
      const phys = Pp(skillAtk) * n;
      const tru = skillAtk * (levelData.value || 0);
      return mkF({ phys, tru }, skillDuration, skillAtk);
    }
  } else if (op.subProfessionId === 'slower' && SLOWER_SPECIAL[op.id] && SLOWER_SPECIAL[op.id].includes(skillIndex)) {
    // ===== 辅助·凝滞师(slower)特例技能 =====
    // 通用口径:凝滞师普攻/技能均为法术伤害(SUBPROF_ARTS);特性「停顿」与减速为非输出,不建模。
    // 用户口径(2026-09-17):格劳克斯「反制装置」对【无人机】攻击力增幅不计、「反制电磁脉冲」对【无人机】加倍不计;
    // 溯光星源「数据建模」攻速默认叠满、「能源解析」脆弱默认最高层(表 TALENT_DMG_MUL_DRIVERS)。
    const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
    const Aa = (a) => calcArtsDamage(a, state.enemy.res);
    const tmul = calcTalentDmgMul(op, slotData);
    const nAtk = Aa(panelAtk) * tmul;     // 常态单次伤害(含常驻伤害乘区)
    const nDps = nAtk / realInterval;     // 常态普攻秒伤
    const mkS = (sTot, sDps, cd, iv) => ({ type: 'damage', damageType: 'arts', isToggle: false, isPermanent: false, skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd, normalDps: nDps, skillHps: null, normalHps: null, totalHeal: null, realInterval: iv, panelAtk: skillAtk, dmgTypes: { arts: { skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd } } });
    if (op.id === 'char_326_glacus' && skillIndex === 1) {
      // S2 反制电磁脉冲:冲击波单发 340%(专一)×攻击力法伤(【无人机】加倍不计),自然回触发型
      const hit = Aa(panelAtk * (levelData['atk_scale[normal]'] ?? levelData.atk_scale ?? 1)) * tmul;
      result = mkS(hit, 0, calcCycleDps(levelData, realInterval, nAtk, hit), realInterval);
    } else if (op.id === 'char_358_lisa' && skillIndex === 2) {
      // S3 狐火渺然:停止攻击;每秒回复范围内友方 攻击力×14%(专一) 生命(生命回复速度属性);技能期无伤害
      const hps = panelAtk * (levelData['attack@atk_to_hp_recovery_ratio'] ?? 0);
      result = { type: 'heal', skillHps: hps, totalHeal: hps * Math.max(skillDuration, 1), skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: nDps, normalHps: null, realInterval: sIvl, panelAtk, damageType: 'arts' };
    } else if (op.id === 'char_4032_provs' && skillIndex === 1) {
      // S2 致胜立论:开启瞬间对范围内所有敌人 300%(专一)×攻击力法伤,之后自身攻击间隔缩短(-1)持续到结束
      const burst = Aa(panelAtk * (levelData.atk_scale ?? 1)) * tmul;
      const hits = skillDuration > 0 ? Math.floor(skillDuration / sIvl) : 0;
      const total = burst + hits * nAtk;
      result = mkS(total, skillDuration > 0 ? total / skillDuration : 0, null, sIvl);
    } else if (op.id === 'char_4122_grabds' && skillIndex === 1) {
      // S2 乡音沉沉:先停止攻击(=沉睡时间 sleep 5s 专一),剩余时长攻速 +100 且攻击 3 敌(单目标口径)
      const act = Math.max(0, skillDuration - (levelData.sleep ?? 0));
      const iv = calcRealInterval(phase.baseAttackTime + talentBat, 100 + baseAspdBonus + (levelData.attack_speed || 0));
      const hits = iv > 0 ? Math.floor(act / iv) : 0;
      const total = hits * nAtk;
      result = mkS(total, skillDuration > 0 ? total / skillDuration : 0, null, iv);
    } else if (op.id === 'char_258_podego' && skillIndex === 0) {
      // S1 花香疗法:普通攻击改为治疗友方单位,治疗量 = 攻击力×(1+40% 专一)
      const hps = panelAtk * (1 + (levelData.atk || 0)) / realInterval;
      result = { type: 'heal', skillHps: hps, totalHeal: hps * Math.max(skillDuration, 1), skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: nDps, normalHps: null, realInterval, panelAtk, damageType: 'arts' };
    } else if (op.id === 'char_258_podego' && skillIndex === 1) {
      // S2 孢子扩散:投掷孢子群,持续 6s(专一)每秒 65%×攻击力法伤(触发型,自然回充能周期)
      const dotSec = levelData.projectile_delay_time ?? 5;
      const total = dotSec * Aa(panelAtk * (levelData.atk_scale ?? 1)) * tmul;
      result = mkS(total, dotSec > 0 ? total / dotSec : 0, calcCycleDps(levelData, realInterval, nAtk, total), realInterval);
    }
  } else if (op.subProfessionId === 'executor') {
    // ===== 特种·处决者(executor):全部技能为 spType 8「落地/限时被动」型 =====
    // 特性(再部署时间)与敌方减益/位移/控制不建模;概率/条件类(闪避、概率增幅、被击条件增伤)默认不计。
    // 口径:一次性爆发(skillDuration≤0 且无 blackboard.duration)技能期时长 = 攻击次数×攻击间隔(同「落地点火」);
    //       限时强化(skillDuration>0 或 blackboard.duration>0)技能期时长 = 该时长。
    //       常态化列恒为自身普攻 DPS(与无技能态一致)。
    const eIv = realInterval > 0 ? realInterval : 1;
    const eP = (a) => calcPhysicalDamage(a, effDef);
    const eA = (a, res) => calcArtsDamage(a, res === undefined ? effRes : res);
    const eFloor = op.id === 'char_144_red' ? (funnelTalentValue(op, slotData, 0, 'atk_scale') || 0) : 0;  // 红「刺骨」伤害下限
    const ePf = (a) => (eFloor > 0 ? Math.max(eP(a), eFloor * a) : eP(a));
    const eNormHit = Math.max(eP(panelAtk), eFloor * panelAtk)
      + (op.id === 'char_1029_yato2' ? yato2TalentMagicDmg(op, slotData, panelAtk, effRes) : 0);
    const eNormalDps = eNormHit / eIv;
    const eBB = (ti) => execTalentBB(op, slotData, ti) || {};
    const eDur = skillDuration > 0 ? skillDuration : ((levelData.duration > 0) ? levelData.duration : 0);
    const eHits = Math.max(1, Math.floor((eDur > 0 ? eDur : eIv) / eIv + 1e-9));
    const eFinish = (tp, ta, dur, skIv, skAtk) => {
      const dtot = tp + ta;
      const dts = {};
      if (tp > 0 || ta === 0) dts.physical = { skillDps: dur > 0 ? tp / dur : 0, skillTotalDamage: tp, cycleDps: null };
      if (ta > 0) dts.arts = { skillDps: dur > 0 ? ta / dur : 0, skillTotalDamage: ta, cycleDps: null };
      return {
        type: 'damage', isToggle: false, isPermanent: false, skillHps: null, normalHps: null, totalHeal: null, cycleDps: null,
        normalDps: eNormalDps, skillDps: dur > 0 ? dtot / dur : 0, skillTotalDamage: dtot,
        damageType: ta > tp ? 'arts' : 'physical', normalDamageType: 'physical',
        realInterval: skIv, panelAtk: skAtk, skillAtkOut: skAtk, dmgTypes: dts,
      };
    };
    const eZero = () => ({
      type: 'damage', isToggle: false, isPermanent: false, skillHps: null, normalHps: null, totalHeal: null, cycleDps: null,
      normalDps: eNormalDps, skillDps: 0, skillTotalDamage: 0, damageType: 'physical', normalDamageType: 'physical',
      realInterval: eIv, panelAtk, skillAtkOut: panelAtk, dmgTypes: { physical: { skillDps: 0, skillTotalDamage: 0, cycleDps: null } },
    });

    if (op.id === 'char_144_red') {
      if (skillIndex === 0) {  // S1 处决模式:攻击力+70%,10s(40% 物法闪避不计)
        const skAtk = panelAtk * (1 + (levelData.atk || 0));
        result = eFinish(ePf(skAtk) * eHits, 0, eDur, eIv, skAtk);
      } else {                 // S2 狼群:落地立即 攻击力210% 物理(眩晕不计),单目标 1 次
        const skAtk = panelAtk * (levelData.atk_scale || 1);
        result = eFinish(ePf(skAtk), 0, eIv, eIv, skAtk);
      }
    } else if (op.id === 'char_1028_texas2') {
      const txAtk = typeof eBB(0).atk === 'number' ? eBB(0).atk : 0;  // 天赋「德克萨斯传统」被动技能持续时间内攻击力+
      if (skillIndex === 0) {  // S1 细雨无声:攻击力+60%,12s;命中沉默8s 期间每秒 350 法伤(沉默不计,DOT 计入)
        const skAtk = panelAtk * (1 + (levelData.atk || 0) + txAtk);
        const totP = eP(skAtk) * eHits;
        // 「细雨无声」DOT(沉默期间每秒 dot_damage 法伤):技能期全程持续 + 技能结束后仍残留 duration 秒。
        // 用户口径(2026-09-18):8~10s 尾伤计入技能期总伤;DPS 按 总伤/(skillDuration+dotDuration) 摊。
        const dotDur = levelData['attack@texas2_s_1[dot].duration'] || 0;
        const dotWin = eDur + dotDur;
        const totA = eA(levelData['attack@texas2_s_1[dot].dot_damage'] || 0) * dotWin;
        result = eFinish(totP, totA, dotWin, eIv, skAtk);
      } else if (skillIndex === 1) {  // S2 阵雨连绵:落地 攻击力200% 法术(先减抗再结算) + 10s 攻击力+45% 二连击法伤
        const skRes = Math.max(0, effRes * (1 + (levelData.magic_resistance || 0)));
        const skAtk = panelAtk * (1 + (levelData.atk || 0) + txAtk);
        const burst = eA(skAtk * (levelData.atk_scale || 0), skRes);
        const totA = burst + eA(skAtk, skRes) * eHits * 2;
        result = eFinish(0, totA, eDur, eIv, skAtk);
      } else {                 // S3 剑雨滂沱:落地 2×135% 法术 + 之后每 1s 剑雨 110% 法术 7s(单目标每跳 1 次)
        const skAtk = panelAtk * (1 + txAtk);
        const appear = eA(skAtk * (levelData['appear.atk_scale'] || 0)) * 2;
        const ticks = Math.max(1, Math.floor(eDur / (levelData['texas2_s_3[sword].interval'] || 1) + 1e-9));
        const rain = eA(skAtk * (levelData.atk_scale || 0)) * ticks;
        result = eFinish(0, appear + rain, eDur, eIv, skAtk);
      }
    } else if (op.id === 'char_1029_yato2') {
      const t1 = eBB(1);
      const t1Atk = (typeof t1.atk === 'number' ? t1.atk : 0)
        + (typeof t1['yato2_e_002[atk].atk'] === 'number' ? t1['yato2_e_002[atk].atk'] : 0);  // 天赋「鬼人强化状态」技能期间攻击力+
      if (skillIndex === 0) {  // S1 鬼人化:攻速+80,20s;每击二连击,每第三次攻击变六连击(占 2 个间隔:前4+后2)→ 4 间隔共 10 击
        const skIv = calcRealInterval(phase.baseAttackTime + talentBat, 100 + baseAspdBonus + (levelData.attack_speed || 0));
        const skAtk = panelAtk * (1 + t1Atk);
        const nIv = Math.max(0, Math.floor(eDur / skIv + 1e-9));
        const CUM = [0, 2, 4, 10, 10];
        const hits = Math.floor(nIv / 4) * 10 + CUM[nIv % 4];
        const per = eP(skAtk) + yato2TalentMagicDmg(op, slotData, skAtk, effRes, undefined, hits);
        result = eFinish(per * hits, 0, eDur, skIv, skAtk);
      } else if (skillIndex === 1) {  // S2 乱舞:落地 16 次斩击,攻击力135%(倍率同时作用于第一天赋,blackboard talent_scale 已含)
        const skAtk = panelAtk * (1 + t1Atk);
        const phys = eP(skAtk * (levelData.atk_scale || 1));
        const magic = yato2TalentMagicDmg(op, slotData, skAtk, effRes, levelData.talent_scale || 1, 16);  // talent_scale 已含 atk_scale 倍率
        result = eFinish((phys + magic) * 16, 0, 16 * eIv, eIv, skAtk);
      } else {                 // S3 空中回旋乱舞:突进斩击,每 dist_unit 格一段(最多 max_dist)→ 段数,攻击力270%(倍率同时作用于第一天赋)
        const skAtk = panelAtk * (1 + t1Atk);
        const segs = Math.max(1, Math.floor((levelData.max_dist || 0) / (levelData.dist_unit || 1) + 1e-9));
        const phys = eP(skAtk * (levelData.atk_scale || 1));
        const magic = yato2TalentMagicDmg(op, slotData, skAtk, effRes, levelData.atk_scale || 1, segs);  // 攻击倍率同时作用于第一天赋
        result = eFinish((phys + magic) * segs, 0, segs * eIv, eIv, skAtk);
      }
    } else if (op.id === 'char_1502_crosly') {
      if (skillIndex === 0) {  // S1 尘烟蔽目:攻击力+85%,10s(40% 闪避不计)
        const skAtk = panelAtk * (1 + (levelData.atk || 0));
        result = eFinish(eP(skAtk) * eHits, 0, eDur, eIv, skAtk);
      } else if (skillIndex === 1) {  // S2 硝烟震爆:停攻 8s,结束时 400% 物理(第一天赋倍率/嘲讽不计)
        const skAtk = panelAtk * (levelData['attack@atk_scale_s2'] || 0);
        result = eFinish(eP(skAtk), 0, eDur, eIv, skAtk);
      } else {                 // S3 烽烟行刑场:16s,同一目标每 mark_duration(6s)触发一次 2 击 ×210% 物理(眩晕/隐匿不计)
        const skAtk = panelAtk * (levelData['attack@atk_scale_s3'] || 0);
        const times = levelData['attack@times'] || 2;
        const trig = Math.max(1, Math.ceil(eDur / (levelData.mark_duration || 1)));
        result = eFinish(eP(skAtk) * times * trig, 0, eDur, eIv, skAtk);
      }
    } else if (op.id === 'char_250_phatom' || op.id === 'token_10007_phatom_twin') {
      if (skillIndex === 0) {  // S1 暗夜魅影:闪避+屏障,无输出
        result = eZero();
      } else if (skillIndex === 1) {  // S2 血色乐章:times 层可叠加攻击力+atk,每击(造成伤害后)消耗一层
        const times = levelData.times || 0;
        const inc = levelData.atk || 0;
        let tot = 0;
        for (let i = 1; i <= times; i++) tot += eP(panelAtk * (1 + inc * (times - i + 1)));
        result = eFinish(tot, 0, Math.max(1, times) * eIv, eIv, panelAtk * (1 + inc * times));
      } else {                 // S3 夜幕突袭:落地 260% 物理(小力推开/随机状态不计)
        const skAtk = panelAtk * (levelData.atk_scale || 1);
        result = eFinish(eP(skAtk), 0, eIv, eIv, skAtk);
      }
    } else if (op.id === 'char_214_kafka') {
      const kAtk = typeof eBB(0).atk === 'number' ? eBB(0).atk : 0;  // 天赋「注意力误导」被动技能触发期间攻击力+
      const skAtk = panelAtk * (1 + kAtk);
      if (skillIndex === 0) {  // S1 怪异魔方:停攻 5s,结束时 380% 法术(沉睡不计)
        result = eFinish(0, eA(skAtk * (levelData.atk_scale || 0)), eDur, eIv, skAtk);
      } else {                 // S2 诡异剪刀:落地 330% 法术 + 之后 13s 对目标格单体法术攻击
        const burst = eA(skAtk * (levelData.atk_scale || 0));
        result = eFinish(0, burst + eA(skAtk) * eHits, eDur, eIv, skAtk);
      }
    } else if (op.id === 'char_243_waaifu') {
      if (skillIndex === 0) {  // S1 寸劲:攻击力+60%,10s(敌方减攻不计)
        const skAtk = panelAtk * (1 + (levelData['waaifu_s_1[self].atk'] || 0));
        result = eFinish(eP(skAtk) * eHits, 0, eDur, eIv, skAtk);
      } else {                 // S2 七武掠阵踢:落地 255% 物理(沉默/击退不计)
        const skAtk = panelAtk * (levelData.atk_scale || 1);
        result = eFinish(eP(skAtk), 0, eIv, eIv, skAtk);
      }
    } else {
      // 砾(char_237_gravel):纯防御/屏障技能 → 技能期无输出(常态仍为自身普攻)
      result = eZero();
    }
  } else if (isBard) {
    // 吟游者:全部技能走专用分支(特性比率覆盖 / 微尘真伤 / 每跳法伤;鼓舞不计入自身输出)
    result = calcBardSkill(op, slotData, skillIndex, levelData, { panelAtk, skillDuration, isPermanent });
  } else if (op.subProfessionId === 'blessing') {
    // 护佑者:全部技能走专用分支(技能开启后攻击改为治疗 → 技能期 HPS;天赋生命/技力回复不计)
    result = calcBlessingSkill(op, slotData, skillIndex, levelData, {
      panelAtk, skillRealInterval, skillDuration, isPermanent,
      normalDps: calcArtsDamage(panelAtk, effRes) / realInterval,
    });
  } else if (op.subProfessionId === 'supportiveranger') {
    // ===== 辅助·游击手(supportiveranger) =====
    // 特性「可以使用触发型效果协助作战」:触发型效果是施加于敌我单位、需满足条件才一次性生效的增减益。
    // 普攻为物理伤害(特性未声明法术伤害;佩德洛的标记需由我方其他法术伤害触发,故其自身普攻不吃标记)。
    // 用户口径(2026-09-18):
    //   佩德洛「掩护战术」的攻击力增幅不计算(条件类:攻击范围内≥ 2 名其他干员);
    //   佩德洛「标记射击」直接将触发型效果进行伤害计算(每发 = 物理 atk_scale + 法术 debuff_atk_scale);
    //   佩德洛「交替撤离」的触发型效果不计算(治疗/不易被选中不计);
    //   岳羽由加莉「明镜止水」的触发型效果默认自己立刻生效(术法充盈=法术伤害提升,自身普攻为物理 → 不影响自身输出)。
    // 岳羽由加莉「龙卷箭」为一次性法术伤害(3 发 multi_atk_scale + 追加 final_atk_scale)。
    const AaS = (a) => calcArtsDamage(a, effRes);
    const nAtkS = calcPhysicalDamage(panelAtk, effDef);
    const nDpsS = nAtkS / realInterval;
    const mkS = (sTot, sDps, cd, dmgTypes, iv, normalDps) => ({
      type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false,
      skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd,
      normalDps: normalDps === undefined ? nDpsS : normalDps,
      skillHps: null, normalHps: null, totalHeal: null, realInterval: iv || realInterval, panelAtk, dmgTypes,
    });
    if (op.id === 'char_4234_pedro' && skillIndex === 0) {
      // S1「标记射击」(攻击回复,专一 spCost 5):下次攻击攻击力提升至 atk_scale(专一 125%),同时攻击 2 个目标
      // (单目标口径计 1),并对目标施加触发型效果 → 用户口径直接计入:
      // 目标受到法术伤害时额外受到 debuff_atk_scale(专一 190%)攻击力的法术伤害(一次性,不叠加)。
      const phys = calcPhysicalDamage(panelAtk * (levelData.atk_scale ?? 1), effDef);
      const arts = AaS(panelAtk * (levelData.debuff_atk_scale ?? 0));
      const total = phys + arts;
      result = mkS(total, 0, calcCycleDps(levelData, realInterval, nAtkS, total), {
        physical: { skillDps: 0, skillTotalDamage: phys, cycleDps: null },
        arts: { skillDps: 0, skillTotalDamage: arts, cycleDps: null },
      }, realInterval, null);
    } else if (op.id === 'char_4219_yukari' && skillIndex === 0) {
      // S1「龙卷箭」(自动回复,专一 spCost 24):立即发射三发箭矢(每发 multi_atk_scale 专一 70% 法术伤害),
      // 随后追加一次 final_atk_scale(专一 350%)范围法术伤害并浮空 1.5s → 一次性法术总伤(单目标口径)。
      const per = AaS(panelAtk * ((levelData.multi_atk_scale ?? 0) * 3 + (levelData.final_atk_scale ?? 0)));
      result = mkS(per, 0, calcCycleDps(levelData, realInterval, nAtkS, per), { arts: { skillDps: 0, skillTotalDamage: per, cycleDps: null } }, realInterval, null);
    } else {
      // 其余技能(佩德洛 S2「交替撤离」/ 岳羽由加莉 S2「明镜止水」)触发型效果不计 → 技能期普攻照常归常态展示
      result = { ...mkS(0, 0, null, undefined, realInterval, nDpsS), basePanelAtk: true };
    }
  } else if (op.subProfessionId === 'underminer' && UNDERMINER_SPECIAL[op.id] && UNDERMINER_SPECIAL[op.id].includes(skillIndex)) {
    // ===== 辅助·削弱者(underminer)特例技能 =====
    // 通用口径:削弱者普攻/技能均为法术伤害(SUBPROF_ARTS);特性「攻击使敌人攻击力-10% 持续2秒」为敌方减益(非己方输出),
    // 不建模。用户口径(2026-09-17):初雪「虚弱化」/巫恋「溃败暗示」的脆弱默认不计算;海霓「阻滞性显色剂」默认不击倒目标;
    // 灵知「零度爆发」默认蓄力。
    // 灵知专项(用户 2026-09-17):寒冷/冻结都是先结算状态再结算伤害,所有攻击都按此逻辑 →
    //   常态普攻与各技能首击落点目标必已处于寒冷(本次攻击刚叠的 1 层)→ 吃寒冷脆弱(damage_scale_cold,已由 TALENT_DMG_MUL_DRIVERS 的 tmul 带出);
    //   叠到 2 层即冻结 → 吃冻结脆弱(damage_scale_freeze),相对寒冷档的额外倍率 frz 如下。
    const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
    const Aa = (a) => calcArtsDamage(a, effRes);
    const tmul = calcTalentDmgMul(op, slotData);
    const nAtk = Aa(panelAtk) * tmul;     // 常态单次伤害(灵知=含寒冷脆弱;常态普攻间隔 > 寒冷时长,不会叠到冻结)
    const nDps = nAtk / realInterval;     // 常态普攻秒伤
    const frz = (() => { const fc = gnosisFrozenFragileMul(op, slotData); return tmul > 0 ? fc / tmul : 1; })();   // 冻结脆弱/寒冷脆弱(无模组 1.5/1.25=1.2)
    const mkU = (sTot, sDps, cd, iv) => ({ type: 'damage', damageType: 'arts', isToggle: false, isPermanent: false, skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd, normalDps: nDps, skillHps: null, normalHps: null, totalHeal: null, realInterval: iv, panelAtk, dmgTypes: { arts: { skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd } } });
    if (op.id === 'char_206_gnosis' && skillIndex === 0) {
      // S1「高速思考」:下次攻击连续攻击两次,每次 atk_scale(专一 1.55)法术伤害。
      // 第 1 击落点即寒冷(1 层),第 2 击叠至 2 层 → 冻结 → 吃冻结脆弱。
      const per = Aa(panelAtk * (levelData.atk_scale ?? 1)) * tmul;
      const total = per * (1 + frz);
      result = mkU(total, 0, calcCycleDps(levelData, realInterval, nAtk, total), sIvl);
    } else if (op.id === 'char_206_gnosis' && skillIndex === 1) {
      // S2「零度爆发」:对范围内敌人造成 {cold} 秒寒冷 + atk_scale(专一 1.7)法术伤害;蓄力额外造成一层寒冷。
      // 用户口径默认蓄力 → 2 层即时冻结 → 该发吃冻结脆弱。
      const total = Aa(panelAtk * (levelData.atk_scale ?? 1)) * tmul * frz;
      result = mkU(total, 0, calcCycleDps(levelData, realInterval, nAtk, total), sIvl);
    } else if (op.id === 'char_206_gnosis' && skillIndex === 2) {
      // S3 失温症:攻速 +130(M1 +124)、同时攻击 2 敌(单目标口径);技能期普攻为常态倍率(非 atk_scale);
      // 「范围内所有敌人的冻结延长至技能结束」→ 第 2 击起目标始终冻结 → 吃冻结脆弱;第 1 击仅寒冷。
      // 技能结束时对所有冻结目标爆发 atk_scale(专一 4.5)×攻击力法伤(单目标=1 发,同吃冻结脆弱)。
      const hits = skillDuration > 0 ? Math.floor(skillDuration / sIvl) : 0;
      const normal = hits > 0 ? nAtk + (hits - 1) * nAtk * frz : 0;
      const burst = Aa(panelAtk * (levelData.atk_scale ?? 0)) * tmul * frz;
      const total = normal + burst;
      result = mkU(total, skillDuration > 0 ? total / skillDuration : 0, null, sIvl);
    }
  } else if (op.subProfessionId === 'sword' && SWORD_SPECIAL[op.id] && SWORD_SPECIAL[op.id].includes(skillIndex)) {
    const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
    const Pp = (a) => calcPhysicalDamage(a, effDef);
    const Aa = (a) => calcArtsDamage(a, state.enemy.res);
    const mk2 = (sTot, sDps, cd, panel, dt) => ({ type: 'damage', damageType: dt || 'physical', isToggle: false, isPermanent: false, skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd, normalDps: null, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: panel || skillAtk, dmgTypes: { [dt || 'physical']: { skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd } } });
    // 陈 S3 赤霄·绝影:10 次 280% 连斩
    if (op.id === 'char_010_chen' && skillIndex === 2) {
      const times = levelData.times || levelData['attack@times'] || 10;
      return mk2(Pp(panelAtk * levelData.atk_scale) * times, 0, calcCycleDps(levelData, realInterval, Pp(panelAtk), Pp(panelAtk * levelData.atk_scale) * times), panelAtk * levelData.atk_scale);
    }
    // 刻刀 S1 红移:4 把飞刀
    if (op.id === 'char_301_cutter' && skillIndex === 0) {
      const times = levelData.times || 4;
      return mk2(Pp(panelAtk * levelData.atk_scale) * times, 0, calcCycleDps(levelData, realInterval, Pp(panelAtk), Pp(panelAtk * levelData.atk_scale) * times), panelAtk * levelData.atk_scale);
    }
    // 艾丽妮 S3 判决:300% + 12 次 230%
    if (op.id === 'char_4009_irene' && skillIndex === 2) {
      const main = Pp(panelAtk * levelData.atk_scale);
      const times = levelData.multi_times || 12;
      const sub = Pp(panelAtk * levelData.multi_atk_scale) * times;
      return mk2(main + sub, 0, calcCycleDps(levelData, realInterval, Pp(panelAtk), main + sub), panelAtk * levelData.atk_scale);
    }
    // 锏:天赋按 2/3 技能生效口径
    if (op.id === 'char_4116_blkkgt') {
      const tMul = swordTalentAtkScale(op, slotData, skillIndex);
      const defEff = Math.max(0, state.enemy.def * (1 - swordTalentDefPen(op, slotData, skillIndex)));
      const Ph = (a) => calcPhysicalDamage(a, defEff);
      if (skillIndex === 0) {   // 纯粹的战意:两次 200%
        const a = panelAtk * (levelData.atk_scale_s1 || levelData.atk_scale || 2);
        return mk2(Ph(a) * 2, 0, calcCycleDps(levelData, realInterval, Pp(panelAtk), Ph(a) * 2), a);
      }
      if (skillIndex === 1) {   // 无声的嘲弄:2 次斩击(未被阻挡)
        const a = panelAtk * (levelData.dot_scale || 0) * tMul;
        const cnt = levelData['blkkgt_s_2[not_blocked].trig_cnt'] || 2;
        return mk2(Ph(a) * cnt, 0, calcCycleDps(levelData, realInterval, Pp(panelAtk), Ph(a) * cnt), a);
      }
      // 归于宁静:10 次 + 最终一击
      const a1 = panelAtk * (levelData.d_atk_scale || 0) * tMul;
      const a2 = panelAtk * (levelData.e_atk_scale_end || 0) * tMul;
      const tot = Ph(a1) * 10 + Ph(a2);
      return mk2(tot, 0, calcCycleDps(levelData, realInterval, Pp(panelAtk), tot), a1);
    }
    // 战车 S1 燃烧榴弹:6 秒燃烧区域,每秒 50% 法术
    if (op.id === 'char_459_tachak' && skillIndex === 0) {
      const per = Aa(panelAtk * (levelData.atk_scale || 0));
      const ticks = levelData.projectile_delay_time || 6;
      return mk2(per * ticks, 0, calcCycleDps(levelData, realInterval, Pp(panelAtk), per * ticks), panelAtk * (levelData.atk_scale || 0), 'arts');
    }
    return calcDamage(params);
  } else if (op.subProfessionId === 'fighter' && FIGHTER_SPECIAL[op.id] && FIGHTER_SPECIAL[op.id].includes(skillIndex)) {
    const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
    const Pp = (a) => calcPhysicalDamage(a, effDef);
    const mk = (sTot, sDps, cd, panel, mul) => ({ type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd, normalDps: null, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: panel || skillAtk, dmgTypes: { physical: { skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd } } });
    // 杰克 S2「全神贯注」:仅闪避成功后反击,闪避默认不生效 → 输出 0
    if (op.id === 'char_347_jaksel' && skillIndex === 1) return mk(0, 0, 0, panelAtk);
    // 达格达 S1「反制技巧」:默认受击一次结算帮派精神(1 层 +5%),下次攻击力提高至 190%
    if (op.id === 'char_157_dagda' && skillIndex === 0) {
      const a = panelAtk * 1.05 * 1.9;
      return mk(Pp(a), 0, calcCycleDps(levelData, realInterval, Pp(panelAtk), Pp(a)), a);
    }
    // 重岳「我无」按开满 5 次处理:攻击变二连击 + 技能额外一次伤害(共 3 次 320%)
    if (op.id === 'char_2024_chyue' && skillIndex === 2) {
      return mk(Pp(skillAtk) * 3, 0, calcCycleDps(levelData, realInterval, Pp(panelAtk), Pp(skillAtk) * 3), skillAtk);
    }
    // 燧石 S2「锋芒毕露」:身轻无痕的伤害提升仅 2 技能开启时生效
    if (op.id === 'char_415_flint' && skillIndex === 1) {
      const mul = fighterFlintScale(op, slotData);
      const n = skillDuration > 0 && sIvl > 0 ? Math.floor(skillDuration / sIvl + 1e-9) : 0;
      const tot = n * Pp(skillAtk) * mul;
      return mk(tot, skillDuration > 0 ? tot / skillDuration : 0, null, skillAtk);
    }
    // 贝洛内 S1「军师的手段」:每击 180%(键带 attack@ 前缀)+ 家族手段按 8 层减防
    if (op.id === 'char_4037_demetr' && skillIndex === 1) {
      const sc = levelData['attack@atk_scale'] || 1;
      const n = skillDuration > 0 && sIvl > 0 ? Math.floor(skillDuration / sIvl + 1e-9) : 0;
      const a = panelAtk * sc;
      const tot = n * Pp(a);
      return mk(tot, skillDuration > 0 ? tot / skillDuration : 0, null, a);
    }
    // 贝洛内 S2「清算」:攻击力 +150%、攻速 +40(键均带前缀);45% 概率追加伤害默认不生效
    if (op.id === 'char_4037_demetr' && skillIndex === 2) {
      const atkPct = levelData['attack@demetr_s3[bonus].atk'] || 0;
      const aspd = levelData['attack@demetr_s3[bonus].attack_speed'] || 0;
      const iv = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus + aspd);
      const n = skillDuration > 0 && iv > 0 ? Math.floor(skillDuration / iv + 1e-9) : 0;
      const a = panelAtk * (1 + atkPct);
      const tot = n * Pp(a);
      return Object.assign(mk(tot, skillDuration > 0 ? tot / skillDuration : 0, null, a), { realInterval: iv, skillInterval: iv });
    }
    return calcDamage(params);
  } else if (op.subProfessionId === 'centurion' && op.id === 'char_017_huang' && skillIndex === 2) {
    const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
    const tmul = calcTalentDmgMul(op, slotData);
    const mk = (sTot, sDps, cd, panel) => ({ type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd, normalDps: null, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: panel || skillAtk, dmgTypes: { physical: { skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd } } });
    // 煌 S3「沸腾爆裂」:技能期持续灼烧,结束时对范围内造成 360% 攻击力物理(单目标算一次)
    {
      const n = skillDuration > 0 && sIvl > 0 ? Math.floor(skillDuration / sIvl + 1e-9) : 0;
      const base = n * calcPhysicalDamage(skillAtk, effDef) * tmul;
      const boom = calcPhysicalDamage(skillAtk * (levelData.damage_by_atk_scale || 0), effDef) * tmul;
      return mk(base + boom, skillDuration > 0 ? (base + boom) / skillDuration : 0, null, skillAtk);
    }
    // 摆渡人 S2「同胞的意志」:攻击力提升至 185%(数据键带 attack@ 前缀)
    if (false) {
      const sc = levelData['attack@s2_atk_scale'] || 1;
      const n = skillDuration > 0 && sIvl > 0 ? Math.floor(skillDuration / sIvl + 1e-9) : 0;
      const tot = n * calcPhysicalDamage(panelAtk * sc, effDef) * tmul;
      return mk(tot, skillDuration > 0 ? tot / skillDuration : 0, null, panelAtk * sc);
    }
    return calcDamage(params);
  } else if (op.subProfessionId === 'centurion' && op.id === 'char_4166_varkis' && skillIndex === 1) {
    const sIvl = (typeof skillRealInterval === 'number' && skillRealInterval > 0) ? skillRealInterval : realInterval;
    const tmul = calcTalentDmgMul(op, slotData);
    const mk = (sTot, sDps, cd, panel) => ({ type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd, normalDps: null, skillHps: null, normalHps: null, totalHeal: null, realInterval: sIvl, panelAtk: panel, dmgTypes: { physical: { skillDps: sDps, skillTotalDamage: sTot, cycleDps: cd } } });
    // 摆渡人 S2「同胞的意志」:攻击力提升至 185%(数据键带 attack@ 前缀,引擎不识别)
    const sc = levelData['attack@s2_atk_scale'] || 1;
    const n = skillDuration > 0 && sIvl > 0 ? Math.floor(skillDuration / sIvl + 1e-9) : 0;
    const tot = n * calcPhysicalDamage(panelAtk * sc, effDef) * tmul;
    return mk(tot, skillDuration > 0 ? tot / skillDuration : 0, null, panelAtk * sc);
  } else if (op.subProfessionId === 'lord') {
    return calcLordSkill(op, slotData, skillIndex, levelData, { panelAtk, effDef, skillDuration, realInterval, skillRealInterval, skillAtk: skillAtk * lordAtkMul(op, skillIndex), generic: () => calcDamage(params) }, { baseInterval: phase.baseAttackTime, baseAspdBonus });
  } else if (op.subProfessionId === 'skybreaker') {
    const tmul = calcTalentDmgMul(op, slotData);
    const h = (atk) => calcPhysicalDamage(atk, effDef) * tmul;
    const nrm = () => (realInterval > 0 ? calcPhysicalDamage(panelAtk, effDef) * tmul / realInterval : null);
    // 天空盒「电磁脉冲恩宠」:10 枚弹药,每枚 200%(攻击范围扩大不影响单目标伤害)
    if (op.id === 'char_4213_skybx' && skillIndex === 1) {
      const ammo = levelData['attack@trigger_time'] || 0;
      const per = h(panelAtk * (levelData['attack@atk_scale'] || 1));
      const total = per * ammo;
      const dur = ammo > 0 ? ammo * realInterval : realInterval;
      return { type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: dur > 0 ? total / dur : 0, skillTotalDamage: total, cycleDps: null, normalDps: nrm(), skillHps: null, normalHps: null, totalHeal: null, realInterval, panelAtk, dmgTypes: { physical: { skillDps: dur > 0 ? total / dur : 0, skillTotalDamage: total, cycleDps: null } } };
    }
    // 埃癸斯「全弹发射」:6 枚导弹各 140% + 飞踢 280%(目标及周围,单目标算一次)
    if (op.id === 'char_4218_aigis' && skillIndex === 1) {
      const per = 6 * h(panelAtk * (levelData.atk_scale || 1)) + h(panelAtk * (levelData.kick_atk_scale || 0));
      const cd = realInterval > 0 ? calcCycleDps(levelData, realInterval, calcPhysicalDamage(panelAtk, effDef) * tmul, per) : null;
      return { type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: 0, skillTotalDamage: per, cycleDps: cd, normalDps: nrm(), skillHps: null, normalHps: null, totalHeal: null, realInterval, panelAtk, dmgTypes: { physical: { skillDps: 0, skillTotalDamage: per, cycleDps: cd } } };
    }
    const g = calcDamage(params);
    return { ...g, type: 'damage', damageType: g.damageType || 'physical', isToggle: false, isPermanent: false, realInterval: skillRealInterval, skillInterval: skillRealInterval, normalInterval: realInterval, panelAtk: panelAtk * (1 + (levelData.atk || 0)) };
  } else if (op.subProfessionId === 'loopshooter') {
    const steal = narantStealAtk(op, slotData);
    const baseAtk = panelAtk + steal;
    const h = (atk) => calcPhysicalDamage(atk, effDef);
    const nrm = () => (realInterval > 0 ? h(baseAtk) / realInterval : null);   // 常态间隔
    const nAtk = skillDuration > 0 && realInterval > 0 ? Math.floor(skillDuration / realInterval + 1e-9) : 0;
    const mk = (total, dps, panel) => ({ type: 'damage', damageType: 'physical', isToggle: false, isPermanent: false, skillDps: dps, skillTotalDamage: total, cycleDps: null, normalDps: nrm(), skillHps: null, normalHps: null, totalHeal: null, realInterval, panelAtk: panel || panelAtk, dmgTypes: { physical: { skillDps: dps, skillTotalDamage: total, cycleDps: null } } });
    // 跃跃「乐趣加倍」:二连击
    if (op.id === 'char_4100_caper' && skillIndex === 1) {
      const atk = baseAtk * (1 + (levelData.atk || 0));
      const per = 2 * h(atk);
      const total = per * nAtk;
      return mk(total, skillDuration > 0 ? total / skillDuration : 0, atk);
    }
    // 娜仁图亚「旋刃」(切换):每击 170%(弹跳只对多目标生效,单目标 1 段)
    if (op.id === 'char_4138_narant' && skillIndex === 0) {
      const per = h(baseAtk * (levelData['attack@atk_scale'] || 1));
      return mk(0, realInterval > 0 ? per / realInterval : 0);
    }
    // 娜仁图亚「恶魇」:命中 230% + 折返对穿过敌人 180%(用户 2026-09-17:折返要算,单目标视为命中)
    if (op.id === 'char_4138_narant' && skillIndex === 1) {
      const per = h(baseAtk * (levelData['attack@atk_scale'] || 1))
        + h(baseAtk * (levelData['attack@atk_scale_comeback'] || 0));
      const total = per * nAtk;
      return mk(total, skillDuration > 0 ? total / skillDuration : 0);
    }
    // 娜仁图亚「吞日」:三连击(cnt 个投射物,每个 165%)+ 投射物全回收时一次范围伤害 145%(用户 2026-09-17)
    if (op.id === 'char_4138_narant' && skillIndex === 2) {
      const shots = levelData.cnt || 1;
      const per = shots * h(baseAtk * (levelData['attack@atk_scale'] || 1))
        + h(baseAtk * (levelData['atk_scale_aoe'] || 0));
      const total = per * nAtk;
      return mk(total, skillDuration > 0 ? total / skillDuration : 0);
    }
    // 水灯心「可驯服的」:五连击(命中后额外斩击 4 次)
    if (op.id === 'char_4177_brigid' && skillIndex === 1) {
      const atk = baseAtk * (1 + (levelData.atk || 0));
      const per = 5 * h(atk);
      const total = per * nAtk;
      return mk(total, skillDuration > 0 ? total / skillDuration : 0, atk);
    }
    const g = calcDamage(params);
    if (g && steal > 0 && g.normalDps !== null && g.normalDps !== undefined) g.normalDps = nrm();
    // 未命中特例的技能照常走通用结算:补上引擎返回字段(本分支是最终返回值,不能只依赖通用链)
    return { ...g, type: 'damage', damageType: g.damageType || 'physical', isToggle: false, isPermanent: false, realInterval: skillRealInterval, skillInterval: skillRealInterval, normalInterval: realInterval, panelAtk: panelAtk * (1 + (levelData.atk || 0)) };
  } else if (op.subProfessionId === 'bombarder') {
    result = calcBombarderSkill(op, slotData, skillIndex, levelData, {
      panelAtk, realInterval: skillRealInterval, normalInterval: realInterval, effDef, enemy: state.enemy, skillDuration,
      generic: () => calcDamage(params),
    });
  } else if (op.subProfessionId === 'siegesniper') {
    result = calcSiegeSkill(op, slotData, skillIndex, levelData, {
      panelAtk, realInterval: skillRealInterval, normalInterval: realInterval, effDef, enemy: state.enemy, skillDuration,
      generic: () => calcDamage(params),
    });
  } else if (op.subProfessionId === 'reaperrange') {
    result = calcReaperSkill(op, slotData, skillIndex, levelData, {
      panelAtk, realInterval: skillRealInterval, normalInterval: realInterval, effDef, enemy: state.enemy, skillDuration,
      phase, module: slotData.module, generic: () => calcDamage(params),
    });
  } else if (op.subProfessionId === 'longrange' || op.id === 'token_10026_bgsnow_subbow') {
    result = calcLongrangeSkill(op, slotData, skillIndex, levelData, {
      panelAtk, realInterval: skillRealInterval, normalInterval: realInterval, effDef, enemy: state.enemy, skillDuration,
      generic: () => calcDamage(params),
    });
  } else if (op.subProfessionId === 'aoesniper') {
    result = calcAoeSkill(op, slotData, skillIndex, levelData, {
      panelAtk, realInterval: skillRealInterval, normalInterval: realInterval, effDef, enemy: state.enemy, skillDuration,
      generic: () => calcDamage(params),
    });
  } else if (op.subProfessionId === 'closerange') {
    result = calcCloserangeSkill(op, slotData, skillIndex, levelData, {
      panelAtk, realInterval: skillRealInterval, normalInterval: realInterval, effDef, enemy: state.enemy, skillDuration,
      generic: () => calcDamage(params),
    });
  } else if (op.id === 'char_474_glady' && skillIndex === 2) {
    // 歌蕾蒂娅 S3 缺水的碎漩狂舞(手动 8s):对最远目标制造龙卷风,每 interval(1.5s)造成 atk_scale×攻击力 法术伤害;
    // 龙卷风持续 hit_duration(9s)→ 共 6 次伤害(PRTS:7 次拖拽、第 7 次无伤害不计);单目标模型=1 个龙卷风。
    const gTickIvl = levelData.interval > 0 ? levelData.interval : 1.5;
    const gTickDur = levelData.hit_duration > 0 ? levelData.hit_duration : skillDuration;
    const gTicks = gTickIvl > 0 ? Math.max(1, Math.floor(gTickDur / gTickIvl + 1e-9)) : 1;
    const gHit = calcArtsDamage(panelAtk * (levelData.atk_scale || 1), state.enemy.res);
    const gTot = gHit * gTicks;
    const gDps = skillDuration > 0 ? gTot / skillDuration : 0;
    const gNorm = realInterval > 0 ? calcPhysicalDamage(panelAtk, effDef) / realInterval : null;
    result = {
      type: 'damage', damageType: 'arts', isToggle: false, isPermanent: false,
      skillDps: gDps, skillTotalDamage: gTot, cycleDps: null, normalDps: gNorm,
      skillHps: null, normalHps: null, totalHeal: null, realInterval: gTickIvl, panelAtk,
      dmgTypes: { arts: { skillDps: gDps, skillTotalDamage: gTot, cycleDps: null } },
    };
  } else if (op.subProfessionId === 'stalker') {
    // 特种·伏击客(stalker):攻击范围内所有敌人(单目标模型)、0 阻挡、3.5s 间隔;天赋附加法伤/DOT/被动 DOT
    result = calcStalkerSkill(op, slotData, { panelAtk, skillAtk, effDef, effRes, realInterval, skillRealInterval, skillDuration, levelData, skillIndex });
  } else {
    result = calcDamage(params);
  }

  // 蓝毒「神经毒素」固定 DOT(见 calcBluePoisonDps):技能期 DPS/总伤与周期行各加一份(法术伤害,法抗结算)
  if (op.id === 'char_129_bluep' && skillIndex >= 0) {
    const poison = calcBluePoisonDps(op, slotData, state.enemy);
    if (poison > 0) {
      const pDur = skillDuration > 0 ? skillDuration : 0;
      const addTotal = poison * pDur;
      const pSd = (result.skillDps || 0) + poison;
      const pSt = (result.skillTotalDamage || 0) + addTotal;
      result = {
        ...result,
        skillDps: pSd, skillTotalDamage: pSt,
        cycleDps: result.cycleDps === null || result.cycleDps === undefined ? result.cycleDps : result.cycleDps + poison,
        normalDps: result.normalDps === null || result.normalDps === undefined ? result.normalDps : result.normalDps + poison,
        dmgTypes: { ...(result.dmgTypes || {}), arts: { skillDps: poison, skillTotalDamage: addTotal, cycleDps: null } },
      };
    }
  }

  // 阵法术师(phalanx):特性「通常时不攻击」→ 常态行恒为 0(技能期照常计算)
  if (op.subProfessionId === 'phalanx') result = { ...result, normalDps: 0, normalHps: null, normalDamageType: op.damageType };

  // 解放者(librator):特性「通常不攻击且阻挡数为 0」→ 常态行恒为 0(用户口径 2026-09-17:常态 DPS 记 0)
  if (op.subProfessionId === 'librator') result = { ...result, normalDps: 0, normalHps: null, normalDamageType: op.damageType };

  // 阵法术师技能改造③:DoT(圣聆初雪 S2 积雪每秒法伤)与技能结束收尾爆发(薄绿 S2)
  if (op.subProfessionId === 'phalanx' && skillIndex >= 0) {
    const phExtra = PHALANX_EXTRA[op.id] || {};
    const phDotKey = (phExtra.dot || {})[skillIndex];
    if (phDotKey && levelData[phDotKey] !== undefined) {
      const dotDps = calcArtsDamage(phBaseSkillAtk * levelData[phDotKey], state.enemy.res);
      const addTotal = skillDuration > 0 ? dotDps * skillDuration : 0;
      result = { ...result, skillDps: (result.skillDps || 0) + dotDps, skillTotalDamage: (result.skillTotalDamage || 0) + addTotal };
    }
    const phBurstKey = (phExtra.endBurst || {})[skillIndex];
    if (phBurstKey && levelData[phBurstKey] !== undefined && skillDuration > 0) {
      const newTotal = (result.skillTotalDamage || 0) + calcArtsDamage(phBaseSkillAtk * levelData[phBurstKey], state.enemy.res);
      result = { ...result, skillTotalDamage: newTotal, skillDps: newTotal / skillDuration };
    }
    if (result.dmgTypes) {
      const dk = op.damageType === 'arts' ? 'arts' : 'physical';
      if (result.dmgTypes[dk]) result.dmgTypes = { ...result.dmgTypes, [dk]: { ...result.dmgTypes[dk], skillDps: result.skillDps, skillTotalDamage: result.skillTotalDamage } };
    }
  }

  // ======== 重装/防御通用修正 ========
  // 技能期切物理(特米米荒野法术)只作用于技能期:非技能期仍是职业法术普攻,常态行照常展示
  // (与驭法铁卫镜像口径一致——那边技能期切法术,常态物理照常显示;此处曾误置空)
  // 停止攻击:技能期伤害记 0(普攻停止,防御/面板变化仅展示)
  if ((STOP_ATTACK_SKILLS[op.id] || []).includes(skillIndex) && !isMedic && !isSummon) {
    result = { ...result, skillDps: 0, skillTotalDamage: 0, cycleDps: null };
    // 同步清内部档位(UI dmgValHtml 优先读 dmgTypes,不清则技能期残留非零)
    if (result.dmgTypes) {
      const clean = {};
      for (const k of Object.keys(result.dmgTypes)) clean[k] = { skillDps: 0, skillTotalDamage: 0, cycleDps: null };
      result = { ...result, dmgTypes: clean };
    }
  }
  // 受击回复触发型技能(INCREASE_WHEN_TAKEN_DAMAGE,无自然充能周期):不展示周期 DPS,仅保留单次技能总伤/总治疗；
  // 常态普攻照常展示——这类技能不停止攻击(可颂 S2 磁爆锤/泥岩 S2 岩崩锤等单发触发型 dur=0 走 calcDamage
  // else 分支 normalDps 为 null,此处统一按职业普攻口径补回;有持续时间的受击型(斥罪 S3)已有 normalDps 不覆盖)
  if (levelData.spType === 'INCREASE_WHEN_TAKEN_DAMAGE' && !isMedic && !isSummon) {
    const normI = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1;
    const normTypeArts = op.damageType === 'arts';
    const normalDps = (normTypeArts ? calcArtsDamage(panelAtk, state.enemy.res) : calcPhysicalDamage(panelAtk, effDef)) / normI;
    result = {
      ...result,
      cycleDps: null,
      normalDps: result.normalDps ?? normalDps,
      normalDamageType: normTypeArts ? 'arts' : 'physical',
    };
  }
  // 受击回复触发时的自疗(泥岩 S2 岩崩锤:触发时回 maxHp×hp_ratio 单发;常态普攻保留展示)
  if ((TAKEN_SELF_HEAL[op.id] || {})[skillIndex] === true && typeof levelData.hp_ratio === 'number') {
    result = { ...result, totalHeal: panelHp * levelData.hp_ratio };
  }
  // 攻击吸血(火神 S2 武力模式:每次攻击回 maxHp×hp_ratio,HPS=单次回复/攻击间隔)
  if ((LEECH_SKILLS[op.id] || {})[skillIndex] === true && skillDuration > 0 && typeof levelData.hp_ratio === 'number') {
    const interval = skillRealInterval > 0 ? skillRealInterval : 1;
    const leechPerHit = panelHp * levelData.hp_ratio;
    const leechAttacks = Math.floor(skillDuration / interval);
    result = {
      ...result,
      skillHps: (result.skillHps ?? 0) + leechPerHit / interval,
      totalHeal: (result.totalHeal ?? 0) + leechPerHit * leechAttacks,
    };
  }
  // 自回通道(hp_recovery_per_sec 固定值/秒;hp_recovery_per_sec_by_max_hp_ratio 最大生命百分比/秒):
  // 按治疗展示 skillHps 与总治疗;技能开启期天赋自回(火神「自我防护」)与技能自带键求和。
  const skillRecoverRatio = calcTalentSkillRecoverRatio(op, slotData);
  // 自回键别名:数据把每秒回血比例放前缀键(松桐 S2 makiri_s_2[passive].hp_recovery_per_sec_by_max_hp_ratio),取到即生效
  const hpRecKey = (SKILL_HP_RECOVERY_KEY_OVERRIDES[op.id] || {})[skillIndex];
  const regenIgnored = (SKILL_REGEN_IGNORE[op.id] || []).includes(skillIndex);
  const hpRecByMaxHp = regenIgnored ? undefined : (hpRecKey ? levelData[hpRecKey] : levelData.hp_recovery_per_sec_by_max_hp_ratio);
  const hasSkillRegen = !regenIgnored && (levelData.hp_recovery_per_sec !== undefined || hpRecByMaxHp !== undefined);
  if (!isMedic && !isSummon && (hasSkillRegen || skillRecoverRatio > 0)) {
    const perSec = (levelData.hp_recovery_per_sec ?? 0) + panelHp * ((hpRecByMaxHp ?? 0) + skillRecoverRatio);
    const dur = skillDuration > 0 ? skillDuration : (levelData.duration > 0 ? levelData.duration : 0);
    // AUTO 触发型自回(暴雨 S1「应急迷彩」:攻击触发给低血友方挂持续恢复):
    // 无技能期概念,输出归常态普攻(normalDps),治疗按单次触发量展示
    if (levelData.skillType === 'AUTO') {
      result = { ...result, skillDps: 0, skillTotalDamage: 0, skillHps: (result.skillHps ?? 0) + perSec, totalHeal: (result.totalHeal ?? 0) + perSec * dur };
    } else {
      result = { ...result, skillHps: (result.skillHps ?? 0) + perSec, totalHeal: (result.totalHeal ?? 0) + perSec * dur };
    }
  }
  // 技能结束爆炸(车尔尼 S2 曲惊四座:结束时对周围敌人造成 atk_scale×atk 法伤单发,加入技能期总伤;受击叠攻默认 0 层不计)
  if ((SKILL_END_ARTS_BURST[op.id] || {})[skillIndex] && typeof levelData.atk_scale === 'number') {
    const burst = calcArtsDamage(panelAtk * levelData.atk_scale, state.enemy.res);
    result = {
      ...result,
      skillTotalDamage: (result.skillTotalDamage ?? 0) + burst,
      dmgTypes: result.dmgTypes ? {
        ...result.dmgTypes,
        arts: { ...(result.dmgTypes.arts || {}), skillTotalDamage: (result.dmgTypes.arts?.skillTotalDamage ?? 0) + burst },
      } : { arts: { skillDps: 0, skillTotalDamage: burst, cycleDps: null } },
      damageType: result.damageType || 'arts',
    };
  }
  // 技能结束回血(折桠「简易包扎」:技能结束时恢复 maxHp×hp_ratio)
  const endHealRatio = calcTalentEndHealRatio(op, slotData);
  if (endHealRatio > 0 && skillDuration > 0 && !isMedic && !isSummon) {
    result = { ...result, totalHeal: (result.totalHeal ?? 0) + panelHp * endHealRatio };
  }
  // 附带固定 DOT 天赋(深巡「细胞活性抑制剂」:攻击使目标 3s 每秒受 80 法伤;攻击间隔 1.2s<3s 全覆盖 → 等效常驻秒伤)
  // DOT 吃法抗、不吃攻击加成;常态(物理普攻+dot)与技能期(本体+dot 法伤档双色)均附加
  const flatDotDmg = calcTalentFlatDotDps(op, slotData);
  if (flatDotDmg > 0 && !isMedic && !isSummon) {
    const dotDps = calcArtsDamage(flatDotDmg, state.enemy.res);
    const dotDur = skillDuration > 0 ? skillDuration : (levelData.duration > 0 ? levelData.duration : 0);
    const dotTotal = dotDps * dotDur;
    result = {
      ...result,
      // 常态化列为 null(触发型 dur<=0 技能)时保持 null,不把 DOT 单独物化成常态值(同蓝毒 DOT 通道口径)
      normalDps: result.normalDps === null || result.normalDps === undefined ? result.normalDps : result.normalDps + dotDps,
      skillDps: (result.skillDps ?? 0) + dotDps,
      skillTotalDamage: (result.skillTotalDamage ?? 0) + dotTotal,
      dmgTypes: result.dmgTypes ? {
        ...result.dmgTypes,
        arts: {
          skillDps: (result.dmgTypes.arts?.skillDps ?? 0) + dotDps,
          skillTotalDamage: (result.dmgTypes.arts?.skillTotalDamage ?? 0) + dotTotal,
          cycleDps: null,
        },
      } : { arts: { skillDps: dotDps, skillTotalDamage: dotTotal, cycleDps: null } },
    };
  }

  // 秘术师(mystic)瞬间型技能(爱丽丝 S2/黑键 S2 等 dur 0 或 -1 一次性):技能期外照常普攻 →
  // 常态行按无技能态展示(与"特米米曾误置空"同类修正;维伊 S3 为弹药槽,按弹药口径保持 null)
  if (op.subProfessionId === 'mystic' && skillIndex >= 0 && (result.normalDps === null || result.normalDps === undefined)
      && !(op.id === 'char_4226_veen' && skillIndex === 2)) {
    const mNormI = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus);
    const mNorm = op.damageType === 'arts' ? calcArtsDamage(panelAtk, effRes) : calcPhysicalDamage(panelAtk, effDef);
    result = { ...result, normalDps: mNormI > 0 ? mNorm / mNormI : 0, normalDamageType: op.damageType };
  }

  // 轰击术师(blastcaster)技能期每击附带 DoT(伊芙利特 炎爆:命中目标 3s 内每秒受面板攻击力 33% 法伤):
  // 每跳吃法抗与天赋减抗;按充能周期计入技能期总伤与 cycleDps(与单次强化击同周期)
  if (op.subProfessionId === 'blastcaster' && skillIndex >= 0) {
    const bdCfg = (BLASTCASTER_HIT_DOT[op.id] || {})[skillIndex];
    if (bdCfg && typeof levelData[bdCfg.key] === 'number') {
      const bdRes = Math.max(0, ((state.enemy.res || 0) - (resPen || 0)) * calcTalentMrDebuffMul(op, slotData) * (hitMrMul || 1));
      const bdPerSec = calcArtsDamage(panelAtk * levelData[bdCfg.key], bdRes);
      const bdTotal = bdPerSec * (levelData[bdCfg.durKey] ?? 3);
      const bdSp = levelData.spCost > 0 ? levelData.spCost : 0;
      result = {
        ...result,
        skillTotalDamage: (result.skillTotalDamage ?? 0) + bdTotal,
        cycleDps: bdSp > 0 ? (result.cycleDps ?? 0) + bdTotal / bdSp : result.cycleDps,
        dmgTypes: result.dmgTypes ? {
          ...result.dmgTypes,
          arts: {
            ...(result.dmgTypes.arts || {}),
            skillTotalDamage: (result.dmgTypes.arts?.skillTotalDamage ?? 0) + bdTotal,
            cycleDps: result.dmgTypes.arts && result.dmgTypes.arts.cycleDps !== null && result.dmgTypes.arts.cycleDps !== undefined && bdSp > 0
              ? result.dmgTypes.arts.cycleDps + bdTotal / bdSp : (result.dmgTypes.arts?.cycleDps ?? null),
          },
        } : { arts: { skillDps: 0, skillTotalDamage: bdTotal, cycleDps: bdSp > 0 ? bdTotal / bdSp : null } },
      };
    }
  }

  // 轰击术师(blastcaster)瞬间/AUTO 型技能(伊芙利特 S2 炎爆、阿罗玛 S1 强效清洁、协律 S1 反拍重音等 dur≤0 点燃类):
  // 技能期外照常普攻 → 常态行按无技能态展示(与秘术师同类修正;谬因 S3 为弹药槽,技能期即耗弹出击 → 保持 null)
  if (op.subProfessionId === 'blastcaster' && skillIndex >= 0 && (result.normalDps === null || result.normalDps === undefined)
      && !(op.id === 'char_4229_aphris' && skillIndex === 2)) {
    const bNormI = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus);
    const bNorm = op.damageType === 'arts' ? calcArtsDamage(panelAtk, effRes) : calcPhysicalDamage(panelAtk, effDef);
    result = { ...result, normalDps: bNormI > 0 ? bNorm / bNormI : 0, normalDamageType: op.damageType };
  }

  // 塑灵术师(soulcaster):死芒「噩愿/折朽/冠死以冕」技能期伤害;召唤物增幅不在干员侧体现(用户口径)
  if (op.subProfessionId === 'soulcaster' && skillIndex >= 0 && op.id === 'char_450_necras') {
    const scRes = Math.max(0, ((state.enemy.res || 0) - (resPen || 0)) * calcTalentMrDebuffMul(op, slotData) * (hitMrMul || 1));
    if (skillIndex === 2) {
      // S3 冠死以冕:总伤 = 单次爆发(attack@atk_scale×攻击力) × 重复次数(attack@necras_s_3[attack_cnt].max_stack_cnt)
      const rep = levelData['attack@necras_s_3[attack_cnt].max_stack_cnt'] ?? 1;
      const one = calcArtsDamage(panelAtk * (levelData['attack@atk_scale'] ?? 1), scRes);
      const tot = one * rep;
      const delta = tot - (result.skillTotalDamage ?? 0);
      result = {
        ...result,
        skillTotalDamage: tot,
        skillDps: 0,
        cycleDps: (result.cycleDps === null || result.cycleDps === undefined) ? result.cycleDps : result.cycleDps + delta / (levelData.spCost > 0 ? levelData.spCost : 1),
        dmgTypes: result.dmgTypes ? { ...result.dmgTypes, arts: { ...(result.dmgTypes.arts || {}), skillTotalDamage: tot, skillDps: 0 } } : result.dmgTypes,
      };
    } else if (skillIndex === 1) {
      // S2 折朽:技能持续期间本体不普攻(用户口径 2026-09-16);沉睡目标每 interval 秒受 attack@atk_scale×攻击力 法伤,至多 max_target 名,持续 hit_duration
      const ticks = Math.floor((levelData.hit_duration ?? 0) / (levelData.interval || 1));
      const dt = ticks * (levelData.max_target ?? 1) * calcArtsDamage(panelAtk * (levelData.atk_scale ?? 1), scRes);
      const sp = levelData.spCost > 0 ? levelData.spCost : 0;
      result = {
        ...result,
        skillTotalDamage: dt,
        skillDps: skillDuration > 0 ? dt / skillDuration : result.skillDps,
        dmgTypes: result.dmgTypes ? {
          ...result.dmgTypes,
          arts: { ...(result.dmgTypes.arts || {}), skillTotalDamage: dt, skillDps: skillDuration > 0 ? dt / skillDuration : (result.dmgTypes.arts?.skillDps ?? 0) },
        } : result.dmgTypes,
      };
    }
  }
  // 塑灵术师:瞬间/永续型技能槽常态行——死芒噩愿/冠死以冕属「手动版点燃类」(无持续时间),
  // 按点燃类惯例常态行留空(null),总伤记单次爆发、技能期 DPS 为 0、周期 DPS 照算(用户口径 2026-09-16)
  if (op.subProfessionId === 'soulcaster' && skillIndex >= 0 && op.id !== 'char_450_necras'
      && (result.normalDps === null || result.normalDps === undefined)) {
    const sNormI = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus);
    const sNorm = op.damageType === 'arts' ? calcArtsDamage(panelAtk, effRes) : calcPhysicalDamage(panelAtk, effDef);
    result = { ...result, normalDps: sNormI > 0 ? sNorm / sNormI : 0, normalDamageType: op.damageType };
  }

  // 伊芙利特 Δ/D 模组「灼燃损伤」:①常态元素爆条平均 DPS 并入该槽常态行(与无技能态口径一致,
  // 否则破坏"槽常态 DPS = 无技能态 DPS"不变量);②技能期损伤事件流模拟 EP 爆条,元素伤害并入技能期档
  if (op.id === 'char_134_ifrit') {
    // ①常态行:法伤按爆条窗口(法抗-20)平均修正,并并入常态化元素爆条平均 DPS(与无技能态口径一致)
    if (result.normalDps !== null && result.normalDps !== undefined) {
      const nf = ifritNormalFields(op, slotData, panelAtk, calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus), effRes);
      result = { ...result, normalDps: result.normalDps * nf.factor + nf.elementDps };
    }
    if (skillIndex >= 0) {
      const epScale = ifritEpScale(op, slotData);
      if (epScale > 0) {
        const slot = ifritSlotEvents(levelData, { skillAtk, panelAtk, skillRealInterval, skillDuration, effRes, epScale, skillIndex });
        if (slot.events.length) {
          const fb = fireWindowBenefit({ grade: (state.enemy && state.enemy.grade) || 'normal', res: slot.res, events: slot.events });
          const dur = skillDuration > 0 ? skillDuration : 1;
          // 技能期法伤按爆条窗口平均法抗修正(用户口径:爆条降抗期间按降低后的法抗计算)
          const artsScale = (o) => (typeof o === 'number' ? o * fb.factor : o);
          result = {
            ...result,
            skillTotalDamage: artsScale(result.skillTotalDamage ?? 0) + fb.element,
            // 无持续时长的 AUTO 型技能(炎爆):元素爆条计入单次技能总伤,技能期 DPS 仍按 0(周期由 cycleDps 表达)
            skillDps: artsScale(result.skillDps ?? 0) + (skillDuration > 0 ? fb.element / dur : 0),
            cycleDps: result.cycleDps !== null && result.cycleDps !== undefined ? result.cycleDps * fb.factor : result.cycleDps,
            dmgTypes: {
              ...(result.dmgTypes || {}),
              ...(result.dmgTypes && result.dmgTypes.arts ? {
                arts: {
                  ...result.dmgTypes.arts,
                  skillTotalDamage: artsScale(result.dmgTypes.arts.skillTotalDamage ?? 0),
                  skillDps: artsScale(result.dmgTypes.arts.skillDps ?? 0),
                  cycleDps: result.dmgTypes.arts.cycleDps !== null && result.dmgTypes.arts.cycleDps !== undefined
                    ? result.dmgTypes.arts.cycleDps * fb.factor : result.dmgTypes.arts.cycleDps,
                },
              } : {}),
              ...(fb.element > 0 ? { element: { skillDps: skillDuration > 0 ? fb.element / dur : 0, skillTotalDamage: fb.element, cycleDps: null } } : {}),
            },
          };
        }
      }
    }
  }

  // 常态行比例扣减(技能结束后自身失能:按"失能时长/技能时长"折算常态输出,同 洛洛 S2 过载口径)
  // 本源术师(primcaster)元素损伤建模(用户口径 2026-09-16):损伤基数 = 该次攻击"实际造成的伤害"×比例
  // (吃法抗后的法伤,不是攻击力);统一爆条窗口口径(损伤事件流推进 EP→爆条→窗口内降抗/条件元素伤害按时间加权摊算,
  // 与伊芙利特 Δ/D 模组同源,见 primcaster-calc.js)。常态(无技能)不含元素(普攻不移交损伤)→ 常态行不变;仅自供槽位产生爆条。
  if (op.subProfessionId === 'primcaster') {
    result = calcPrimCasterSkill({
      op, slotData, levelData, panelAtk, skillAtk, skillRealInterval, skillDuration, effRes, skillIndex,
      grade: (state.enemy && state.enemy.grade) || 'normal', result,
    });
  }
  // 本源近卫(primguard)元素损伤建模(用户口径 2026-09-17:与本源术师同源处理)
  if (op.subProfessionId === 'primguard') {
    result = calcPrimGuardSkill({
      op, slotData, levelData, panelAtk, skillAtk, skillRealInterval, skillDuration, effRes, effDef, skillIndex,
      grade: (state.enemy && state.enemy.grade) || 'normal', result,
    });
  }

  const bNormMul = (NORMAL_ROW_MUL[op.id] || {})[skillIndex];
  if (bNormMul !== undefined && result.normalDps !== null && result.normalDps !== undefined) {
    result = { ...result, normalDps: result.normalDps * bNormMul };
  }

  // 秘术师(mystic)技能期必然生效的 DoT(每秒固定/比例法伤):只进技能期档,不动常态行
  // (保持"各技能槽常态 DPS = 无技能态常态 DPS"不变量)
  if (op.subProfessionId === 'mystic' && skillIndex >= 0) {
    const mDot = (MYSTIC_SKILL_DOT[op.id] || {})[skillIndex];
    if (mDot) {
      const perSec = mDot.dpsKey !== undefined ? levelData[mDot.dpsKey] : skillAtk * levelData[mDot.atkScaleKey];
      if (typeof perSec === 'number' && perSec > 0) {
        const mDps = calcArtsDamage(perSec, state.enemy.res);
        const mTot = skillDuration > 0 ? mDps * skillDuration : 0;
        result = {
          ...result,
          skillDps: (result.skillDps ?? 0) + mDps,
          skillTotalDamage: (result.skillTotalDamage ?? 0) + mTot,
          dmgTypes: result.dmgTypes ? {
            ...result.dmgTypes,
            arts: {
              skillDps: (result.dmgTypes.arts?.skillDps ?? 0) + mDps,
              skillTotalDamage: (result.dmgTypes.arts?.skillTotalDamage ?? 0) + mTot,
              cycleDps: null,
            },
          } : { arts: { skillDps: mDps, skillTotalDamage: mTot, cycleDps: null } },
        };
      }
    }
  }
  // 维伊 S3 弹药槽(dur -1):天赋 DOT 秒伤已由 TALENT_FLAT_DOT 附加,但总伤按 dur 0 计 → 按弹药窗口补回
  // (该槽无常态普攻展示:技能期即耗弹发射 → 常态行回置 null,与玛露西尔 S1 弹药口径一致)
  if (op.id === 'char_4226_veen' && skillIndex === 2) result = { ...result, normalDps: null };
  if (op.id === 'char_4226_veen' && skillIndex === 2 && flatDotDmg > 0) {
    const vIv2 = skillRealInterval > 0 ? skillRealInterval : 1;
    const vAmmo2 = Math.max(1, Math.round(levelData['attack@trigger_time'] ?? 1));
    const addTotal = calcArtsDamage(flatDotDmg, state.enemy.res) * vAmmo2 * vIv2;
    result = { ...result, skillTotalDamage: (result.skillTotalDamage ?? 0) + addTotal };
    if (result.dmgTypes && result.dmgTypes.arts) {
      result = { ...result, dmgTypes: { ...result.dmgTypes, arts: { ...result.dmgTypes.arts, skillTotalDamage: (result.dmgTypes.arts.skillTotalDamage ?? 0) + addTotal } } };
    }
  }

  if (skill.type === SkillType.HEAL) {
    const healPercent = levelData.heal_percent || 0;
    const hps = panelHp * (1 + healPercent) / (skillDuration || 1);
    return { type: 'heal', hps, totalHeal: hps * (skillDuration || 1), panelAtk };
  }

  // 伤害类型:技能内判定优先(calcDamage 对真实/物理/法术逐技能给出)。
  // 医疗无普攻伤害,伤害由技能决定(咒愈师、亚叶复合弹片为法术)。
  let damageType = result.damageType || null;
  if (isMedic) {
    if (!damageType && (isIncantationMedic || (levelData['attack@heal_scale'] !== undefined && levelData['attack@atk_scale'] !== undefined))) {
      damageType = 'arts';
    }
  } else if (damageType === null && !isSummon) {
    damageType = op.damageType || 'physical';
  }

  // 常驻每秒自回天赋注入:damage 型 normalHps 由 null 补值 → isHealType 归 heal 型,UI heal 分支显示常态 HPS
  // (桃金娘「浮光跃金」固定 25/s;凛御银灰「雪境先驱」每秒最大生命比例,满层翻倍口径)
  if (result.normalHps === null) {
    const talentHps = calcTalentHps(op, slotData);
    const pctRegen = calcTalentFlatDefPctRegen(op, slotData);
    const hps = talentHps + (pctRegen ? panelHp * pctRegen.ratio : 0);
    if (hps > 0) result = { ...result, normalHps: hps };
  }
  const isHealType = isMedic || (result.totalHeal !== null && result.totalHeal !== undefined) || (result.normalHps !== null && result.normalHps !== undefined) || (op.subProfessionId === 'blessing' && result.skillHps !== null && result.skillHps !== undefined)
    || (result.isPermanent === true && result.skillHps !== null && result.skillHps !== undefined);  // 孑 S2 刺身拼盘:常驻攻击强化附带每击治疗 → 按治疗型卡片展示
  // 吟游者/护佑者:技能期 ATK 就是自身面板攻击力(不受鼓舞比率/atk_scale 污染;skillAtk 会被技能里的 atk/attack@atk 乘坏)
  // basePanelAtk 为分支显式声明(如游击手 S2 的 atk_scale 是治疗比率,不含伤害倍率)
  const useBasePanelAtk = isBard || op.subProfessionId === 'blessing' || result.basePanelAtk === true;
  const { basePanelAtk: _basePanelAtkFlag, skillAtkOut: _skillAtkOutFlag, ...resultOut } = result;
  return { ...resultOut, type: isHealType ? 'heal' : 'damage', damageType, isToggle, isPermanent: ((PERMANENT_EXCLUDE[op.id] || []).includes(skillIndex) ? false : isPermanent), realInterval: result.realInterval ?? skillRealInterval, panelAtk: useBasePanelAtk ? panelAtk : (result.skillAtkOut !== undefined ? result.skillAtkOut : skillAtk) };
}

/**
 * 计算干员面板基础属性(精英化/等级/信赖/潜能加成后)
 * @returns {Object} { panelHp, panelAtk, panelDef, attackSpeed, baseAttackTime }
 */
// 召唤师召唤物的持有者面板攻击力(数据层 ownerRef 携带持有者 phases/信赖 → 与 ctx.ownerOp 无关,快照脚本也能算)
function summonerOwnerPanelAtk(op, slotData) {
  const ref = op.ownerRef;
  if (!ref || !ref.phases) return 0;
  const ownerOp = { ...op, id: ref.id || 'owner', phases: ref.phases, trustBonus: ref.trustBonus || { atk: 0, def: 0, maxHp: 0 }, ownerRef: null, modules: {} };
  return calcPanelStats(ownerOp, slotData).panelAtk;
}

function calcPanelStats(op, slotData) {
  const phase = op.phases[slotData.elite] || op.phases[op.phases.length - 1];
  const maxLevel = phase.maxLevel;
  const mod = calcModuleBonus(op, slotData);
  // PASSIVE 被动技能(星熊「荆棘」def+24%、森蚺「轻型挂斧」atk/def+20%):装备即常驻入面板,无技能期——
  // 与 calculateOperator 同口径,使白值面板(renderPanelStats)也体现被动加成(星熊 S2 加防肉眼可查)
  const equippedSkill = op.skills[slotData.skillIndex || 0];
  const isSummon = op.profession === 'TOKEN';
  // 限时被动判定用「生效时长」:PASSIVE 且 skillDuration>0(野鬃 S1 骑枪刺击/红 S1 处决模式/历阵锐枪芬 S2 执守阵线);
  // 另有部分数据把时长写在 blackboard.duration、skillDuration=-1(宴 S2 落地斩·破门、斯卡蒂 S2 跃浪击),
  // 同属"部署后生效 N 秒"的一次性强化 → 一并按限时被动走技能期,不再并入常驻面板。
  const passiveRaw = (!isSummon && equippedSkill && equippedSkill.levels[0]?.skillType === 'PASSIVE') ? getSkillLevelData(equippedSkill, slotData.skillLevel) : null;
  const passiveRawDur = passiveRaw ? (passiveRaw.skillDuration > 0 ? passiveRaw.skillDuration : (passiveRaw.duration > 0 ? passiveRaw.duration : 0)) : 0;
  const passiveLv = (passiveRaw && !(passiveRawDur > 0) && op.subProfessionId !== 'executor') ? passiveRaw : null;

  const baseAtk = interpolateAttr(phase.atk[0], phase.atk[1], slotData.level, maxLevel);
  const baseDef = interpolateAttr(phase.def[0], phase.def[1], slotData.level, maxLevel);
  const baseHp = interpolateAttr(phase.maxHp[0], phase.maxHp[1], slotData.level, maxLevel);

  const trustAtk = op.trustBonus.atk * (slotData.trustPercent / 100);
  const trustDef = op.trustBonus.def * (slotData.trustPercent / 100);

  let potAtk = 0, potDef = 0, potHp = 0;
  const potRank = slotData.potentialRank || 0;
  if (potRank > 0 && op.potentialRanks) {
    for (let i = 0; i < Math.min(potRank, op.potentialRanks.length); i++) {
      for (const m of (op.potentialRanks[i].modifiers || [])) {
        if (m.attr === 'ATK' && m.formula === 'ADDITION') potAtk += m.value;
        if (m.attr === 'DEF' && m.formula === 'ADDITION') potDef += m.value;
        if (m.attr === 'MAX_HP' && m.formula === 'ADDITION') potHp += m.value;
      }
    }
  }

  const rawAtk = baseAtk + trustAtk + potAtk + mod.atk;
  const pctTalent = calcTalentHpDefMul(op, slotData);
  const aura = calcSelfAuraFlat(op, slotData);  // 范围光环绝对值(自身必在范围)
  let talentAtk = calcTalentAtkBonus(op, slotData);
  if (passiveLv) {  // 被动技能乘区与天赋同区累加(装备即生效)
    if (passiveLv.atk !== undefined) talentAtk += passiveLv.atk;
    if (passiveLv.def !== undefined) pctTalent.defMul += passiveLv.def;
    if (passiveLv.max_hp !== undefined) pctTalent.hpMul += passiveLv.max_hp;
    // 非标准键名的被动属性加成(凯瑟琳 S1「岁月锻打」s1_atk/s1_def;装置默认不放置 → 只计自身)
    const pk = (PASSIVE_ATTR_KEYS[op.id] || {})[slotData.skillIndex ?? 0];
    if (pk) {
      if (pk.atk && typeof passiveLv[pk.atk] === 'number') talentAtk += passiveLv[pk.atk];
      if (pk.def && typeof passiveLv[pk.def] === 'number') pctTalent.defMul += passiveLv[pk.def];
    }
  }
  const enh = calcModuleTalentEnhance(op, slotData);
  const talentAspd = enh.attackSpeed !== null ? enh.attackSpeed : calcTalentAttackSpeed(op, slotData);
  const extraAtkMul = (enh.extraAtkMul && slotData.skillIndex === 1) ? enh.extraAtkMul : 0;
  const modUncond = calcModuleUncondAttr(op, slotData);  // 模组特性追加/常驻段无条件属性(号角 Y 攻速/def)
  const attackInterval = calcRealInterval(phase.baseAttackTime, 100 + talentAspd + mod.attackSpeed + modUncond.aspd);

  return {
    panelHp: Math.round((baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp + mod.maxHp) * (1 + pctTalent.hpMul)),
    panelAtk: Math.round(rawAtk * (1 + talentAtk + extraAtkMul + executorTraitAtkMul(op, slotData)) * (op.profession === 'PIONEER' && op.subProfessionId === 'tactician' ? 1.5 : 1)),
    panelDef: Math.round((baseDef + trustDef + potDef + mod.def) * (1 + pctTalent.defMul + modUncond.defMul) + aura.defFlat
      + ((calcTalentFlatDefPctRegen(op, slotData) || {}).flatDef || 0) + calcTalentFlatAttr(op, slotData).defFlat),
    magicResistance: (phase.magicResistance ?? 0) + mod.magicResistance + aura.resFlat + calcTalentFlatAttr(op, slotData).resFlat,
    baseAttackTime: phase.baseAttackTime,
    attackInterval
  };
}

export { calculateOperator, getSkillLevelData, calcPanelStats, calcTalentAtkBonus, calcTalentAttackSpeed, calcTalentHealScale, calcModuleTalentEnhance, calcTalentHpDefMul, calcTalentDmgMul, calcSelfAuraFlat, TALENT_ATK_DRIVERS, TALENT_HEAL_DRIVERS, TALENT_SPD_DRIVERS, TALENT_HP_DEF_DRIVERS, SELF_AURA_DRIVERS };
