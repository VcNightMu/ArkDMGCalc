// ArkDMGCalc - Main Calculation Entry
import { calcPhysicalDamage, calcArtsDamage, calcRealInterval, interpolateAttr, calcAttribute } from './calculator.js';
import { SkillType } from './operators.js';
import { state } from './state.js';
import { calcMedical, calcSummonHeal } from './medic-calc.js';
import { calcGuardian } from './guardian-calc.js';
import { calcDamage } from './damage-ops-calc.js';

function getSkillLevelData(skill, level) {
  const levels = skill.levels;
  return levels[level] || levels[levels.length - 1];
}

// 常驻攻击力天赋驱动表。
// 此类天赋的 blackboard.atk 为「直接乘算」加数(与技能的直接乘算累加,不连乘),
// 作用于常态与技能期,随精英化/等级/潜能强化取满足条件的最高档。
// key: 干员 id;value: 常驻加攻天赋在 op.talents 数组中的索引。
const TALENT_ATK_DRIVERS = {
  'char_120_hibisc': 0,  // 芙蓉「治疗力提升」:精1 Lv1 起 +4%,Lv55 起 +8%
  'char_4163_rosesa': 0, // 瑰盐:攻击 -5%(治疗代价换倍率,见 TALENT_HEAL_DRIVERS)
  'char_348_ceylon': 0,// 锡兰「湖畔漫步者」:只取默认档 [common].atk(+3%~6% 随精化/潜能5 增强),水地形 [map] 档不计
  'char_172_svrash': 0,   // 银灰「领袖」:攻击+5%/7%(精1)→+10%/12%(精2 潜4),自身常驻(编队再部署-5% 忽略)
  'char_010_chen': 1,     // 陈「持刀格斗术」精二:攻击+5%~6%(防御部分在 TALENT_HP_DEF_DRIVERS)
  'char_103_angel': 1,    // 能天使「天使的祝福」精二:自身攻击+6%~8%(随机友方同效不计)
  'char_180_amgoat': 0,   // 艾雅法拉「炎息」:在场全体术师攻+7%~16%,自身为术师必吃(同赫默光环先例)
  'char_202_demkni': 0,   // 塞雷娅「莱茵充能护服」:站场每20s叠1层×5(单层 atk+5~6%/def+4~5%),按满层处理 → atk+25~30%
};

// 常驻治疗倍率天赋驱动表(blackboard.heal_scale 为治疗量乘数)。
// 治疗干员所有治疗量(普攻/技能期/触发)都乘此倍率;无天赋/未解锁 → 1。
const TALENT_HEAL_DRIVERS = {
  'char_4163_rosesa': 0, // 瑰盐:治疗量 +5%~+17%(随精化/潜能5 增强)
  'char_148_nearl': 0,   // 临光「天马光环」:全图友方医疗效果+10~12%(自身治疗为友方医疗,光环先例自身必得)
  'char_4143_sensi': 0,  // 森西「十年魔物餐经验」:自身治疗量+10%(防御部分在 TALENT_HP_DEF_DRIVERS)
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
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const hs = cand.blackboard && typeof cand.blackboard.heal_scale === 'number' ? cand.blackboard.heal_scale : 0;
      if (hs > 0 && (scale === null || hs > scale)) scale = hs;
    }
  }
  return scale === null ? 1 : scale;
}

// 查驱动表,返回常驻加攻天赋在当前精英化/等级下的直接乘算加数(0 表示无此天赋或未生效)。
function calcTalentAtkBonus(op, slotData) {
  const talentIndex = TALENT_ATK_DRIVERS[op.id];
  if (talentIndex === undefined) return 0;
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 0;
  const elite = slotData.elite;
  const level = slotData.level;
  const pot = slotData.potentialRank || 0;
  let bonus = null;   // null=未匹配;负值天赋(如瑰盐 -5%)也必须采纳
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && level >= (cand.level || 1) && candPot <= pot) {
      let atk = 0;
      if (cand.blackboard) {
        // 特殊键天赋(锡兰「湖畔漫步者」ceylon_t_1[common].atk):只取默认档,忽略 [map] 等环境档
        const commonKey = Object.keys(cand.blackboard).find(k => k.endsWith('[common].atk'));
        if (commonKey !== undefined) atk = cand.blackboard[commonKey];
        else if (typeof cand.blackboard.atk === 'number') atk = cand.blackboard.atk;
        // 叠层天赋(塞雷娅「莱茵充能护服」每层值 × max_stack_cnt):按满层取
        if (typeof cand.blackboard.max_stack_cnt === 'number') atk = atk * cand.blackboard.max_stack_cnt;
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
};

// 查 HP/DEF 常驻百分比天赋,返回 { hpMul, defMul }(未解锁/无键为 0)
function calcTalentHpDefMul(op, slotData) {
  const talentIndex = TALENT_HP_DEF_DRIVERS[op.id];
  const out = { hpMul: 0, defMul: 0 };
  if (talentIndex === undefined) return out;
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return out;
  const elite = slotData.elite;
  const level = slotData.level;
  const pot = slotData.potentialRank || 0;
  for (const cand of talent.candidates) {
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

const MODULE_ATTR_MAP = { max_hp: 'maxHp', atk: 'atk', def: 'def', magic_resistance: 'magicResistance', attack_speed: 'attackSpeed' };

// 视作永续开关的技能:数据 skillDuration=-1 是弹药/结束机制占位,按指定口径不建模该机制。
// 流明「灯火不灭」:默认治疗单位无异常状态 → 耗弹强化(heal_scale×2)不计算,只留 atk+攻速 buff,技能无限持续(可手动关闭)。
const PERMANENT_OVERRIDES = {
  'char_4042_lumen': [2]
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
const SKILL_ATK_KEY_OVERRIDES = {
  'char_1020_reed2': { 2: 'reed2_skil_3[switch_mode].atk' },
  'char_2014_nian': { 2: 'nian_s_3[self].atk' },   // 年 S3「铁御」:自身攻击力增幅(友方 def/阻挡 buff 不计)
};

// 技能期普攻切换为法术伤害(驭法铁卫类机制,如年 S1「锡灼」普通攻击造成法术伤害):
// 技能期每击按法术结算(吃敌方法抗),常态普攻仍为物理。
const SKILL_ARTS_OVERRIDES = {
  'char_2014_nian': [0],   // 年 S1「锡灼」
};

/**
 * 模组面板加成:按当前装配的模组 id+等级取该级 attributeBlackboard(数据为该等级生效后的最终加成)。
 * 证章(INITIAL 无 levels)/无模组返回全 0;attackSpeed 为攻速值增量(100 基准上加算)。
 */
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
const TALENT_SPD_DRIVERS = {
  'char_147_shining': 1,  // 闪灵「法典」:精二起 攻速+10,潜能3 起 +13
  'char_108_silent': 0,// 赫默「医疗支援」:在场全体医疗攻速+6/8(精一),+12/14(精二);自身必得
  'char_103_angel': 0,    // 能天使「快速弹匣」:精一 Lv1 起攻速+6 自身常驻
  'char_4179_monstr': 1   // Mon3tr「战术协同」:自身/重构体造成治疗时攻速+10~22 持续10s无法叠加;
                          // 自身每 2.85s 治疗一次持续刷新 → 等效常驻(重构体默认不放不影响自身触发)
};

// 查驱动表,返回常驻攻速天赋的攻速加算值(0 表示无此天赋或未解锁)。
function calcTalentAttackSpeed(op, slotData) {
  const talentIndex = TALENT_SPD_DRIVERS[op.id];
  if (talentIndex === undefined) return 0;
  const talent = (op.talents || [])[talentIndex];
  if (!talent) return 0;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const aspd = cand.blackboard && typeof cand.blackboard.attack_speed === 'number' ? cand.blackboard.attack_speed : 0;
      if (aspd > best) best = aspd;
    }
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
    if (typeof bb.attack_speed === 'number' && (bestAspd === null || bb.attack_speed > bestAspd)) bestAspd = bb.attack_speed;
    if (typeof bb.atk === 'number' && bb.atk > extraAtk) extraAtk = bb.atk;
    // 天赋强化的治疗倍率(如夜莺 X 模组强化「白恶魔的庇护」:范围内友方受疗 +3%/+5%)。
    // 治疗目标必在攻击范围内才能被治疗,故该光环直接放大自身治疗数值。
    if (typeof bb.heal_scale === 'number' && bb.heal_scale > healScale) healScale = bb.heal_scale;
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
function calcTraitScale(op, slotData) {
  const base = (op.trait && op.trait.blackboard && typeof op.trait.blackboard.scale === 'number')
    ? op.trait.blackboard.scale : null;
  const lv = getModuleLevelData(op, slotData);
  if (lv && lv.traitEnhance) {
    for (const cand of lv.traitEnhance) {
      const s = cand.blackboard && cand.blackboard.scale;
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

// ===== 不屈者(unyield)及相关通用机制驱动表 =====
// base_attack_time 正小数按加算秒处理(引擎默认 (0,1)=乘算缩短;描述为"间隔增大"的技能例外)
const BAT_ADD_OVERRIDES = {
  'char_163_hpsts': { 1: true },   // 火神 S2 武力模式:攻击间隔略微增大(1.6+0.4=2.0s)
  'char_4065_judge': { 2: true },  // 斥罪 S3 披荆斩棘:攻击间隔增大(1.6+0.9=2.5s)
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
};
// AUTO 触发附加法伤(下次攻击=普攻物理+额外 X×atk 法伤,自然回充能周期;斥罪 S1 蓄力分支永不触发)
const TRIGGER_ARTS_ADD = {
  'char_4065_judge': { 0: { scaleKey: 'atk_scale_2' } },  // 斥罪 S1 一锤定音:额外 1.9×atk 法伤
};

// 技能开启期天赋自回比例(读 candidates 的 hp_recovery_per_sec_by_max_hp_ratio 当前档,未解锁→0)
function calcTalentSkillRecoverRatio(op, slotData) {
  const idx = TALENT_SKILL_RECOVER[op.id];
  if (idx === undefined) return 0;
  const talent = (op.talents || [])[idx];
  if (!talent) return 0;
  const elite = slotData.elite, pot = slotData.potentialRank || 0;
  let v = 0;
  for (const cand of talent.candidates) {
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
const STOP_ATTACK_SKILLS = {
  'char_2014_nian': [1],    // 年 S2「铜印」
  'char_325_bison': [1],    // 拜松 S2「深化阵线」
  'char_150_snakek': [1],   // 蛇屠箱 S2「壳状防御」
  'char_381_bubble': [1],   // 泡泡 S2「挨打」
  'char_304_zebra': [1],    // 暴雨 S2「群体迷彩」
};

function calculateOperator(op, slotData) {
  const phase = op.phases[slotData.elite] || op.phases[op.phases.length - 1];
  const maxLevel = phase.maxLevel;
  const mod = calcModuleBonus(op, slotData);
  const skillIndex = slotData.skillIndex || 0;
  const isSummon = op.profession === 'TOKEN';
  const equippedSkill = op.skills[skillIndex];
  // PASSIVE 被动技能(星熊「荆棘」def+24%、森蚺「轻型挂斧」atk/def+20%):装备即常驻入面板(与天赋同乘区累加),无技能期
  // (仅干员职业;召唤物的 skcom 被动型技能不在此列,走 summon 分支)
  const passiveLv = (!isSummon && equippedSkill && equippedSkill.levels[0]?.skillType === 'PASSIVE')
    ? getSkillLevelData(equippedSkill, slotData.skillLevel) : null;

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

  const rawAtk = baseAtk + trustAtk + potAtk + mod.atk;
  const rawDef = baseDef + trustDef + potDef + mod.def;
  let talentAtk = calcTalentAtkBonus(op, slotData);
  const pctTalent = calcTalentHpDefMul(op, slotData);  // 常驻生命/防御百分比天赋
  if (passiveLv) {  // 被动技能乘区与天赋同区累加(装备即生效)
    if (passiveLv.atk !== undefined) talentAtk += passiveLv.atk;
    if (passiveLv.def !== undefined) pctTalent.defMul += passiveLv.def;
    if (passiveLv.max_hp !== undefined) pctTalent.hpMul += passiveLv.max_hp;
  }
  // 模组天赋强化:X模组 L2 把「法典」攻速覆盖为 15/18;Y 模组走基础天赋(10/13)。
  const enh = calcModuleTalentEnhance(op, slotData);
  const talentAspd = enh.attackSpeed !== null ? enh.attackSpeed : calcTalentAttackSpeed(op, slotData);
  // 附加常态攻击乘算:闪灵 X模组≥2级 且装备 2技能(自动掩护)时,面板攻击 ×(1+0.15/0.25) 直接乘算。
  // 与携带技能的 atk 乘算互斥(带 atk 的信条/教条力场 ≠ 2技能),并入同乘区累加。
  const extraAtkMul = (enh.extraAtkMul && slotData.skillIndex === 1) ? enh.extraAtkMul : 0;
  let panelAtk = rawAtk * (1 + talentAtk + extraAtkMul);
  let panelDef = rawDef * (1 + pctTalent.defMul);
  const panelHp = (baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp + mod.maxHp) * (1 + pctTalent.hpMul);

  // ======== Skill Modifiers ========
  const skill = passiveLv ? null : equippedSkill;   // PASSIVE 无技能期:走 no-skill 路径(面板已含被动加成)
  const isMedic = op.profession === 'MEDIC';
  // 攻速总加成 = 天赋攻速(含模组覆盖)+ 模组白值攻速(100 基准上加算),再换算攻击间隔
  const baseAspdBonus = talentAspd + mod.attackSpeed;
  const realInterval = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus);

  // No skill: return normal stats only
  if (!skill) {
    const healScale = calcTalentHealScale(op, slotData) * (enh.healScale || 1);  // 无技能干员也乘常驻治疗倍率
    const healRatio = 1.0;
    if (isMedic) {
      // 咒愈师:常态普攻=法术伤害 + 治疗 scale×伤害(单目标模型默认治疗目标=自身,必在攻击范围)
      if (op.subProfessionId === 'incantationmedic') {
        const traitScale = calcTraitScale(op, slotData) ?? 0.5;
        const fragileMul = calcMagicFragileMul(op, slotData);  // 法脆必触发增伤(芙蓉:伤害×1.06~1.14)
        const normalHit = calcArtsDamage(panelAtk, state.enemy.res) * fragileMul;
        const hpsPerSec = normalHit * traitScale / realInterval;
        return { type: 'heal', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: normalHit / realInterval, skillHps: null, normalHps: hpsPerSec, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk, damageType: 'arts', normalDamageType: 'arts' };
      }
      const normalHeal = panelAtk * healRatio * healScale;
      return { type: 'heal', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null, skillHps: null, normalHps: normalHeal / realInterval, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk };
    }
    const isArts = op.damageType === 'arts';
    const normalDps = isArts ? calcArtsDamage(panelAtk, state.enemy.res) / realInterval : calcPhysicalDamage(panelAtk, state.enemy.def) / realInterval;
    return { type: 'damage', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps, skillHps: null, normalHps: null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk, damageType: isArts ? 'arts' : 'physical', normalDamageType: isArts ? 'arts' : 'physical' };
  }

  const levelData = getSkillLevelData(skill, slotData.skillLevel);

  // Mon3tr S2「超负荷」:第二天赋(战术协同)效果 ×talent_scale 放大--自身治疗持续刷新天赋 buff,
  // 技能期等效攻速 = 常驻天赋攻速 × talent_scale(无重构体也不影响自身触发)
  const skillAspdExtra = (levelData.talent_scale !== undefined && op.id === 'char_4179_monstr')
    ? talentAspd * (levelData.talent_scale - 1) : 0;

  let skillAtk = panelAtk;
  let skillDef = panelDef;
  let skillInterval = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus + skillAspdExtra);
  let skillDuration = levelData.skillDuration || 0;
  // 手动开启的限时增益(skillDuration=-1 + duration>0,自身必然获得,如华法琳「不稳定血浆」):
  // 视为持续型技能,技能期长度 = duration。
  if (skillDuration === -1 && levelData.duration > 0 && levelData.atk !== undefined && levelData.skillType === 'MANUAL') {
    skillDuration = levelData.duration;
  }
  // 前段延迟输出(泥岩 S3 秽壤的血脉:前 10s 沉睡无敌无输出,仅后 20s 攻击计算)
  const delayedSec = (DELAYED_OUTPUT[op.id] || {})[skillIndex];
  if (delayedSec) skillDuration = Math.max(0, skillDuration - delayedSec);

  const modifiers = [];
  // 技能攻击力增幅:顶层 atk;缺省时查前缀别名键(焰苇S3 reed2_skil_3[switch_mode].atk)
  const atkKey = (SKILL_ATK_KEY_OVERRIDES[op.id] || {})[skillIndex] || 'atk';
  if (levelData[atkKey] !== undefined) modifiers.push({ value: levelData[atkKey], operator: 'direct_mul' });
  // attack@atk:守望者普攻攻击力加成(风絮2技能"起飞"攻击力+X%)与顶层 atk 同乘区累加
  if (levelData['attack@atk'] !== undefined) modifiers.push({ value: levelData['attack@atk'], operator: 'direct_mul' });
  if (levelData.def !== undefined) modifiers.push({ value: levelData.def, operator: 'final_mul' });
  // atk_scale:输出技能的伤害/治疗倍率。图耶「水流环」的 atk_scale 是屏障吸收倍率,
  // 其治疗部分无倍率(= 普攻治疗),故触发型一次性普攻治疗时不用 atk_scale 算 skillAtk。
  // 限定:仅医疗、手动触发、带 blackboard 持续(duration)、无 atk 加成,
  // 以区分陈「赤霄·拔刀/绝影」(近卫,伤害倍率)与焰影苇草「枯荣共息」(行医,火球伤害倍率)。
  const isOneShotHeal = isMedic && levelData.skillType === 'MANUAL' && levelData.atk_scale !== undefined && levelData.duration !== undefined && levelData.heal_scale === undefined && levelData.atk === undefined;
  if (levelData.atk_scale !== undefined && !isOneShotHeal) skillAtk = panelAtk * levelData.atk_scale;
  if (levelData.attack_speed) skillInterval = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus + skillAspdExtra + levelData.attack_speed);
  // base_attack_time:负值=加算秒(白面鸮脑啡肽 -2.1 等);(0,1) 正小数=攻击间隔倍率("间隔缩短至 x 倍",
  // 清流涌泉 ×0.12、安洁莉娜微粒模式 ×0.15、风笛闭膛连发 ×0.7,官方描述均为"间隔(极)大幅度缩短")。
  // 描述为"间隔增大"却给正小数的技能(火神S2 +0.4s/斥罪S3 +0.9s)经 BAT_ADD_OVERRIDES 按加算秒处理。
  if (levelData.base_attack_time) {
    const bat = levelData.base_attack_time;
    const isAdd = (BAT_ADD_OVERRIDES[op.id] || {})[skillIndex] === true;
    skillInterval = (bat > 0 && bat < 1 && !isAdd)
      ? calcRealInterval(phase.baseAttackTime * bat, 100 + baseAspdBonus + skillAspdExtra)
      : calcRealInterval(phase.baseAttackTime + bat, 100 + baseAspdBonus + skillAspdExtra);
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
    ]);
    skillDef = calcAttribute(rawDef, modifiers.filter(m => m.operator === 'final_mul'));
  }

  // ======== Dispatch ========
  const isToggle = levelData.isToggle || false;
  const isPermanent = levelData.isPermanent === true || (PERMANENT_OVERRIDES[op.id] || []).includes(skillIndex);
  const skillRealInterval = skillInterval;
  const isIncantationMedic = op.subProfessionId === 'incantationmedic';
  const isArts = op.damageType === 'arts' || ((SKILL_ARTS_OVERRIDES[op.id] || []).includes(skillIndex));
  const incantMode = (INCANTATION_SPECIAL_MODES[op.id] || {})[skillIndex] || null;
  // 法脆必触发增伤:芙蓉常驻(×damage_scale);焰苇S3 灼痕 100% 触发(talent@prob=1)再乘灼痕档
  const fragileBase = calcMagicFragileMul(op, slotData);
  const fragileExtra = (incantMode === 'burning' && levelData['talent@prob'] === 1) ? calcMagicFragileMul(op, slotData, 0) : 1;

  const params = {
    panelAtk, baseAtk, rawAtk, talentAtk, skillAtk, panelHp, realInterval: skillRealInterval, baseInterval: phase.baseAttackTime, skillDuration,
    isToggle, isPermanent, levelData, isArts,
    isIncantationMedic, enemy: state.enemy,
    incantMode,
    traitScale: calcTraitScale(op, slotData),
    magicFragileMul: fragileBase * fragileExtra,
    isDotTick: (INCANTATION_DOT_OVERRIDES[op.id] || []).includes(skillIndex),
    healChain: (SKILL_HEAL_CHAIN[op.id] || {})[skillIndex] || 1,
    talentHealScale: calcTalentHealScale(op, slotData) * (enh.healScale || 1),  // 常驻治疗倍率(天赋 × 模组天赋强化,如瑰盐/夜莺X模组)
    sleepAtkMul: calcSleepAtkMul(op, slotData)  // 瑕光「仁慈」沉睡目标攻击倍率(仅 S2 必睡场景启用)
  };

  let result;
  // 召唤物路由:带独立技能(非 skcom_ 通用被动)的召唤物按技能语义走伤害/治疗计算
  // (如凯尔希·Mon3tr 攻击型召唤物,技能由持有者注入);无独立技能的召唤物(如医疗探机)走治疗型 calcSummonHeal。
  const hasRealSkills = (op.skills || []).some(s => s.skillId && !String(s.skillId).startsWith('skcom_'));
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
  if (isSummon && !hasRealSkills) {
    result = calcSummonHeal(params);
  } else if (isMedic) {
    result = calcMedical(params);
  } else if (isGuardianHealSkill) {
    result = calcGuardian(params);
  } else if (!isSummon && levelData.heal_scale !== undefined && levelData.skillDuration === 0) {
    // 自愈型一次性技能(非医疗,如卡缇 S1「生命回复·α」skcom_heal_self):立即恢复最大生命 heal_scale 比例
    const healAmount = panelHp * levelData.heal_scale;
    result = { skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null, skillHps: null, normalHps: null, totalHeal: healAmount };
  } else if (!isSummon && (PERIODIC_DOT[op.id] || {})[skillIndex]) {
    // 停攻 + 周期法术 DOT（把正常攻击改为周期性范围法伤）：
    // 露托 S2 强磁防卫每2s 0.8×atk（magic_atk_scale 键）；斥罪 S2 坚心苦修每秒 1.2×atk（skillAtk 已含 atk_scale）
    const dotCfg = (PERIODIC_DOT[op.id] || {})[skillIndex];
    const dotInterval = dotCfg.interval > 0 ? dotCfg.interval : 1;
    const dotHit = calcArtsDamage(dotCfg.atkScaleKey ? skillAtk * levelData[dotCfg.atkScaleKey] : skillAtk, state.enemy.res);
    const jumps = Math.floor(skillDuration / dotInterval);
    const dotTotal = dotHit * jumps;
    const normInterval = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1;
    const normDps = calcPhysicalDamage(panelAtk, state.enemy.def) / normInterval;
    result = {
      skillDps: skillDuration > 0 ? dotTotal / skillDuration : 0, skillTotalDamage: dotTotal,
      cycleDps: null, normalDps: normDps, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'arts', realInterval: dotInterval,
      dmgTypes: { arts: { skillDps: skillDuration > 0 ? dotTotal / skillDuration : 0, skillTotalDamage: dotTotal, cycleDps: null } },
    };
  } else if (!isSummon && (TRIGGER_ARTS_ADD[op.id] || {})[skillIndex]) {
    // AUTO 触发附加法伤（斥罪 S1 一锤定音，sp4 自然回）：下次攻击=普攻物理+额外 atk_scale_2×atk 法伤，
    // 混合单发（蓄力分支 judge_s_1_enhance_checker 设计上持续输出永远无法蓄力，不计）
    const trigCfg = (TRIGGER_ARTS_ADD[op.id] || {})[skillIndex];
    const artsScale = levelData[trigCfg.scaleKey] ?? 1;
    const triggerPhys = calcPhysicalDamage(panelAtk, state.enemy.def);
    const triggerArts = calcArtsDamage(panelAtk * artsScale, state.enemy.res);
    const spCost = levelData.spCost > 0 ? levelData.spCost : 1;
    const interval = skillRealInterval > 0 ? skillRealInterval : 1;
    const chargeAttacks = Math.floor(spCost / interval);              // 充能期普攻次数（自然回）
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
  } else {
    result = calcDamage(params);
  }

  // ======== 重装/防御通用修正 ========
  // 停止攻击:技能期伤害记 0(普攻停止,防御/面板变化仅展示)
  if ((STOP_ATTACK_SKILLS[op.id] || []).includes(skillIndex) && !isMedic && !isSummon) {
    result = { ...result, skillDps: 0, skillTotalDamage: 0, cycleDps: null };
  }
  // 受击回复触发型技能(INCREASE_WHEN_TAKEN_DAMAGE,无自然充能周期):不展示周期 DPS,仅保留单次技能总伤/总治疗
  if (levelData.spType === 'INCREASE_WHEN_TAKEN_DAMAGE' && !isMedic && !isSummon) {
    result = { ...result, cycleDps: null };
  }
  // 受击回复触发时的自疗(泥岩 S2 岩崩锤:触发时回 maxHp×hp_ratio 单发;常态普攻保留展示)
  if ((TAKEN_SELF_HEAL[op.id] || {})[skillIndex] === true && typeof levelData.hp_ratio === 'number') {
    const normI = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1;
    result = {
      ...result,
      totalHeal: panelHp * levelData.hp_ratio,
      normalDps: calcPhysicalDamage(panelAtk, state.enemy.def) / normI,
    };
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
  const hasSkillRegen = levelData.hp_recovery_per_sec !== undefined || levelData.hp_recovery_per_sec_by_max_hp_ratio !== undefined;
  if (!isMedic && !isSummon && (hasSkillRegen || skillRecoverRatio > 0)) {
    const perSec = (levelData.hp_recovery_per_sec ?? 0) + panelHp * ((levelData.hp_recovery_per_sec_by_max_hp_ratio ?? 0) + skillRecoverRatio);
    const dur = skillDuration > 0 ? skillDuration : (levelData.duration > 0 ? levelData.duration : 0);
    // AUTO 触发型自回(暴雨 S1「应急迷彩」:攻击触发给低血友方挂持续恢复):
    // 无技能期概念,输出归常态普攻(normalDps),治疗按单次触发量展示
    if (levelData.skillType === 'AUTO') {
      result = { ...result, skillDps: 0, skillTotalDamage: 0, skillHps: (result.skillHps ?? 0) + perSec, totalHeal: (result.totalHeal ?? 0) + perSec * dur };
    } else {
      result = { ...result, skillHps: (result.skillHps ?? 0) + perSec, totalHeal: (result.totalHeal ?? 0) + perSec * dur };
    }
  }
  // 技能结束回血(折桠「简易包扎」:技能结束时恢复 maxHp×hp_ratio)
  const endHealRatio = calcTalentEndHealRatio(op, slotData);
  if (endHealRatio > 0 && skillDuration > 0 && !isMedic && !isSummon) {
    result = { ...result, totalHeal: (result.totalHeal ?? 0) + panelHp * endHealRatio };
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

  const isHealType = isMedic || (result.totalHeal !== null && result.totalHeal !== undefined) || (result.normalHps !== null && result.normalHps !== undefined);
  return { ...result, type: isHealType ? 'heal' : 'damage', damageType, isToggle, isPermanent, realInterval: result.realInterval ?? skillRealInterval, panelAtk: skillAtk };
}

/**
 * 计算干员面板基础属性(精英化/等级/信赖/潜能加成后)
 * @returns {Object} { panelHp, panelAtk, panelDef, attackSpeed, baseAttackTime }
 */
function calcPanelStats(op, slotData) {
  const phase = op.phases[slotData.elite] || op.phases[op.phases.length - 1];
  const maxLevel = phase.maxLevel;
  const mod = calcModuleBonus(op, slotData);

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
  const talentAtk = calcTalentAtkBonus(op, slotData);
  const enh = calcModuleTalentEnhance(op, slotData);
  const talentAspd = enh.attackSpeed !== null ? enh.attackSpeed : calcTalentAttackSpeed(op, slotData);
  const extraAtkMul = (enh.extraAtkMul && slotData.skillIndex === 1) ? enh.extraAtkMul : 0;
  const attackInterval = calcRealInterval(phase.baseAttackTime, 100 + talentAspd + mod.attackSpeed);

  return {
    panelHp: Math.round((baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp + mod.maxHp) * (1 + pctTalent.hpMul)),
    panelAtk: Math.round(rawAtk * (1 + talentAtk + extraAtkMul)),
    panelDef: Math.round((baseDef + trustDef + potDef + mod.def) * (1 + pctTalent.defMul) + aura.defFlat),
    magicResistance: (phase.magicResistance ?? 0) + mod.magicResistance + aura.resFlat,
    baseAttackTime: phase.baseAttackTime,
    attackInterval
  };
}

export { calculateOperator, getSkillLevelData, calcPanelStats, calcTalentAtkBonus, calcTalentAttackSpeed, calcTalentHealScale, calcModuleTalentEnhance, calcTalentHpDefMul, calcSelfAuraFlat, TALENT_ATK_DRIVERS, TALENT_HEAL_DRIVERS, TALENT_SPD_DRIVERS, TALENT_HP_DEF_DRIVERS, SELF_AURA_DRIVERS };
