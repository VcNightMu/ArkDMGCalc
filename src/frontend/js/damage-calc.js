// ArkDMGCalc - Main Calculation Entry
import { calcPhysicalDamage, calcArtsDamage, calcTrueDamage, calcRealInterval, interpolateAttr, calcAttribute } from './calculator.js';
import { SkillType } from './operators.js';
import { state } from './state.js';
import { calcMedical, calcSummonHeal } from './medic-calc.js';
import { calcGuardian } from './guardian-calc.js';
import { calcDamage } from './damage-ops-calc.js';
import { calcPrimSkill, primNormalFields } from './primprotector-calc.js';
import { OPERATOR_ELEMENT } from './element-calc.js';

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
  'char_260_durnar': 0,    // 坚雷「攻守兼备」:攻击力+7%(防御部分在 TALENT_HP_DEF_DRIVERS)
  'char_4039_horn': 0,     // 号角「军事要塞」:在场所有重装干员攻击力+20%(自身为重装必得,同炎息先例)
  'char_431_ashlok': 0,    // 灰毫「炮术研习」:攻击力+8%(周身四格地面改+16% 条件版不计,取无条件档)
  'char_493_firwhl': 0,    // 火哨「进退自如」:未阻挡敌人时攻击力+12%(默认远程轰击位未阻挡;阻挡时 def+12% 承伤向不计)
  'char_1050_chen3': 0,   // 赤刃明霄陈「形意洞照」:攻击力+8/11%(精1)→+13/16%(精2 潜4);同天赋攻速在 TALENT_SPD_DRIVERS,弱点伤害另设开关
  // ---- 先锋(PIONEER) ----
  'char_240_wyvern': 0,  // 香草「攻击提升」:攻击力+4%(精1 Lv1)→+8%(精1 Lv55),无无条件档
  'char_149_scave': 0,   // 清道夫「单独行动者」:攻击+5~13%(精1 5%→精2 潜4 13%,周围四格无友军默认成立,防御在 TALENT_HP_DEF_DRIVERS)
  'char_112_siege': 0,   // 推进之王「万兽之王」:编队所有先锋攻/防+4~10%,自身为先锋必得(同炎息先例),防御在 TALENT_HP_DEF_DRIVERS
  'char_1001_amiya2': 0, // 阿米娅(近卫)「青色怒火」:全场友方攻/防+4%(精1)→+7%(精2),自身必得;技能开启期间效果加倍(见 SKILL_TALENT_ATK_MUL)
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
  'char_260_durnar': 0,  // 坚雷「攻守兼备」:防御力+7%(攻击部分在 TALENT_ATK_DRIVERS)
  'char_136_hsguma': 1,  // 星熊「特种作战策略」(天赋2,精二解锁):全场重装防御+6~8%,自身为重装必得(编队光环先例);天赋1 战术装甲伤害抵挡不建模
  // ---- 先锋(PIONEER) ----
  'char_149_scave': 0,   // 清道夫「单独行动者」:防御+5~13%(周围四格无友军默认成立,攻击部分在 TALENT_ATK_DRIVERS)
  'char_112_siege': 0,   // 推进之王「万兽之王」:防御+4~10%(先锋光环覆盖自身,攻击部分在 TALENT_ATK_DRIVERS)
  'char_1001_amiya2': 0, // 阿米娅(近卫)「青色怒火」:防御+4~7%(同天赋攻击,技能期加倍部分同 atk 口径只计攻击侧)
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
  'char_4042_lumen': [2],   // 流明 S3 灯火不灭：skillDuration=-1 弹药占位，实际永续
  'char_4230_mcnist': [1],  // 机械师 S2 协防术式：弹药仅屏障被摧毁时消耗（爆盾机制无受击模型）→ 永续
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
  'char_4026_vulpis': { 2: 90 },   // 忍冬 S3:平均 +90
};
const SKILL_ATK_KEY_OVERRIDES = {
  'char_1020_reed2': { 2: 'reed2_skil_3[switch_mode].atk' },
  'char_2014_nian': { 2: 'nian_s_3[self].atk' },   // 年 S3「铁御」:自身攻击力增幅(友方 def/阻挡 buff 不计)
};

// 技能期普攻切换为法术伤害(驭法铁卫类机制,如年 S1「锡灼」普通攻击造成法术伤害):
// 技能期每击按法术结算(吃敌方法抗),常态普攻仍为物理。
const SKILL_ARTS_OVERRIDES = {
  'char_2014_nian': [0],   // 年 S1「锡灼」
  'char_107_liskam': [1],  // 雷蛇 S2 反击电弧：攻击变为对最多 3 敌造成法术伤害（单目标=法伤）
  'char_4230_mcnist': [2], // 机械师 S3 工程学十字星：攻击变为十字范围法术伤害（召唤物轮再校冲锋口径）
  // ---- 先锋(PIONEER) ----
  'char_102_texas': [1],   // 德克萨斯 S2 剑雨:对周围敌人两次 1.7×atk 法术伤害(单目标全中)
  'char_349_chiave': [1],  // 贾维 S2 火焰剥离:对周围敌人 3.5×atk 法术伤害
  'char_4026_vulpis': [1], // 忍冬 S2 坠刃拷问:对周围最多6敌 3×atk 法术伤害
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
  'char_4179_monstr': 1,  // Mon3tr「战术协同」:自身/重构体造成治疗时攻速+10~22 持续10s无法叠加;
                          // 自身每 2.85s 治疗一次持续刷新 → 等效常驻(重构体默认不放不影响自身触发)
  'char_1050_chen3': 0,   // 赤刃明霄陈「形意洞照」:攻击速度+8/11(精1)→+13/16(精2 潜4),同源天赋 atk 在 TALENT_ATK_DRIVERS
  'char_274_astesi': 0,   // 星极「天体仪」:在场每20s叠1层攻速+3/5,最多5层(100s叠满)→等效常驻满层+15/25(用户口径同塞雷娅叠满先例)
};


// 固定法抗穿透(无视目标 X 法抗,法术伤害结算时敌人法抗直减;史尔特尔「熔火」12~22)
const TALENT_RES_PEN_DRIVERS = {
  'char_350_surtr': { talentIndex: 0, key: 'magic_resist_penetrate_fixed' },  // 熔火:精1 无视12/14(潜5)→精2 20/22(潜5),全法伤结算生效
};
// 查固定法抗穿透值(0 表示无或未解锁)
function calcTalentResPen(op, slotData) {
  const cfg = TALENT_RES_PEN_DRIVERS[op.id];
  if (!cfg) return 0;
  const talent = (op.talents || [])[cfg.talentIndex];
  if (!talent) return 0;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let best = 0;
  for (const cand of talent.candidates) {
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
      // 叠层攻速天赋(星极「天体仪」每层+3/5、最多5层):按满层等效常驻(同塞雷娅 HP/DEF 叠层口径)
      const stack = (cand.blackboard && typeof cand.blackboard.max_stack_cnt === 'number') ? cand.blackboard.max_stack_cnt : 1;
      if (aspd * stack > best) best = aspd * stack;
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

// ===== 常驻伤害乘区天赋驱动（通用，非白值加成：物理/法术/真伤一律乘，如森蚺「勇冠三军」满血时攻击造成 115% 伤害）=====
// 值：干员 id → { talentIndex, key }（blackboard 中伤害倍率所在键，各干员键名不一：damage_scale/atk_scale…）
const TALENT_DMG_MUL_DRIVERS = {
  'char_416_zumama': { talentIndex: 0, key: 'atk_scale' },  // 森蚺「勇冠三军」：hp>50% 时攻击伤害 ×1.15/1.17（默认满血必触发；≤50% 的庇护向不计）
  // 薇薇安娜「燃烛施明」:法术伤害加成 additive(damage_scale_m 0.05~0.09),攻击范围内有精英/领袖敌人时 super_scale 翻倍
  // (damage_resistance_pm 受击减伤为承伤向不计)——superGrades 按 state.enemy.grade 判定
  'char_4098_vvana': { talentIndex: 0, key: 'damage_scale_m', additive: true, superKey: 'super_scale', superGrades: ['elite', 'leader'] },
};
// 返回满足当前精化/潜能的最高伤害乘子（无 → 1）
function calcTalentDmgMul(op, slotData) {
  const cfg = TALENT_DMG_MUL_DRIVERS[op.id];
  if (!cfg) return 1;
  const talent = (op.talents || [])[cfg.talentIndex];
  if (!talent) return 1;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let mul = null;
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const bb = cand.blackboard || {};
      let v = typeof bb[cfg.key] === 'number' ? bb[cfg.key] : 0;
      // 条件翻倍:薇薇安娜攻击范围内存在精英/领袖敌人时法伤加成 ×super_scale
      if (v > 0 && cfg.superKey && typeof bb[cfg.superKey] === 'number' && (cfg.superGrades || []).includes(state.enemy?.grade)) {
        v = v * bb[cfg.superKey];
      }
      const use = cfg.additive ? (1 + v) : v;  // additive:键值是加成比例(0.05→×1.05);否则键值即完整乘子
      if (mul === null || use > mul) mul = use;
    }
  }
  return mul === null ? 1 : mul;
}

// ===== 不屈者(unyield)及相关通用机制驱动表 =====
// base_attack_time 正小数按加算秒处理(引擎默认 (0,1)=乘算缩短;描述为"间隔增大"的技能例外)
const BAT_ADD_OVERRIDES = {
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
// 每攻击多次连击(技能描述"二/三连击",单目标模型全中;value=连击数)
const MULTI_HIT = {
  'char_1044_hsgma2': { 2: 2 },    // 斩业星熊 S3 地狱变相:二连击打最多3敌(单目标=2连全中)
  'char_4194_rmixer': { 0: 3 },    // 信仰搅拌机 S1 铳骑主考官:下次攻击变三连击(每击 1.7×atk → 单次触发 5.1×atk)
  'char_1050_chen3': { 0: 2 },     // 赤刃明霄陈 S1 奔夜:攻击变为二连击(每击=技能期攻击力全额弱点,乘 2 连)
  'char_4098_vvana': { 0: 2, 2: 2 }, // 薇薇安娜 S1 光影迅捷剑:下次攻击连击两次(每击 atk_scale×atk);S3 明灭:攻击变为二连击(单目标 2 连全中)
  // ---- 先锋(PIONEER) ----
  'char_102_texas': { 1: 2 },  // 德克萨斯 S2 剑雨:造成两次 1.7×atk 法伤(单目标=2 段全中)
  'char_420_flamtl': { 1: 2 }, // 焰尾 S2 "红松林":造成两次 2.4×atk 物伤(单目标=2 段全中)
  'char_1001_amiya2': { 0: 2 },  // 阿米娅(近卫) S1 影霄·奔夜:攻击变为二连击(dur28 法伤)
};
// 仅攻击到一个敌人时的伤害倍率(单目标模型恒成立;读 attack@xxx[critical] 键,与 atk 加成相乘)
const SINGLE_CRIT_MUL = {
  'char_350_surtr': { 1: true },   // 史尔特尔 S2 熔核巨影:仅攻击到一个敌人时攻击力提升至 1.4~1.6
};
// atk_scale 不作为普攻倍率(技能结束爆炸等一次性伤害语义,如车尔尼 S2 结束时 2.1×atk 法伤)
const SKILL_ATK_SCALE_EXCLUDE = {
  'char_4047_pianst': { 1: true },  // 车尔尼 S2 曲惊四座：atk_scale 2.1 是技能结束爆炸，非普攻倍率
  'char_494_vendla': { 1: true },   // 刺玫 S2 荆藤庇荫：atk_scale 是受击反伤倍率（反伤不计），普攻只吃 atk 加攻
  'char_4230_mcnist': { 1: true, 2: true }, // 机械师 S2 atk_scale 2 是屏障被摧毁法伤（受击机制不计）；S3 atk_scale 3 是冲锋碰撞倍率（召唤物轮处理）
};
// 顶层 atk 不作为普攻加成(键值是受击叠层基值,默认不受击 0 层,如车尔尼 S2 每层 +26%)
const SKILL_ATK_EXCLUDE = {
  'char_4047_pianst': { 1: true },  // 车尔尼 S2:atk 0.26/层,默认不叠
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
  'char_4194_rmixer': [2],  // 信仰搅拌机 S3 退休前布道：停止主动攻击转受击反击（无受击模型，反击不计）
  'char_4148_philae': [1],  // 菲莱 S2 冥河诅咒：停止攻击转受击反伤挂凋亡（受击无模型，反伤/凋亡不计）
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
};
// 附带固定 DOT 天赋（每次攻击施加，攻击间隔<持续秒数 → 等效常驻秒伤）：深巡「细胞活性抑制剂」
// 攻击使目标 3s 每秒受 80 法伤（对海怪加倍不计），1.2s 间隔 < 3s 全覆盖 → 恒 80/s（吃法抗，不吃攻击加成）
const TALENT_FLAT_DOT = {
  'char_4137_udflow': { talentIndex: 0, key: 'damage', duration: 3 },
};
function calcTalentFlatDotDps(op, slotData) {
  const cfg = TALENT_FLAT_DOT[op.id];
  if (!cfg) return 0;
  const talent = (op.talents || [])[cfg.talentIndex];
  if (!talent) return 0;
  const elite = slotData.elite;
  const pot = slotData.potentialRank || 0;
  let dmg = 0;
  for (const cand of talent.candidates) {
    const candPot = cand.potentialRank ?? cand.requiredPotentialRank ?? 0;
    if (cand.phase <= elite && candPot <= pot) {
      const v = cand.blackboard && typeof cand.blackboard[cfg.key] === 'number' ? cand.blackboard[cfg.key] : 0;
      if (v > dmg) dmg = v;
    }
  }
  return dmg;
}

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
  // 固定法抗穿透(史尔特尔「熔火」):常态与技能期法伤结算统一吃有效法抗
  const resPen = calcTalentResPen(op, slotData);
  const effRes = Math.max(0, (state.enemy.res || 0) - resPen);
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
    // 弱点伤害干员(赤刃明霄陈 形意洞照,精1+):常态普攻逐击取物理/法伤更高值
    const isWeaknessOn = WEAKNESS_DAMAGE[op.id] === true && calcTalentAtkBonus(op, slotData) > 0;
    const normalDpsRaw = isWeaknessOn
      ? Math.max(calcPhysicalDamage(panelAtk, state.enemy.def), calcArtsDamage(panelAtk, effRes))
      : (isArts ? calcArtsDamage(panelAtk, effRes) : calcPhysicalDamage(panelAtk, state.enemy.def));
    // 本源铁卫 no-skill：天赋损伤源常驻（珊比每击侵蚀/余每秒灼燃+法伤/响石每秒神经），常态三档展示
    if (op.profession === 'TANK' && op.subProfessionId === 'primprotector' && primNormalFields) {
      const norm = primNormalFields(op, slotData, panelAtk, state.enemy);
      const isMed = op.id === 'char_2026_yu' && norm.normalTypes.arts; // 余常态含每秒法伤
      return { type: 'damage', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: norm.normalDps, normalTypes: norm.normalTypes, skillHps: null, normalHps: null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk, damageType: isMed ? 'physical' : 'physical', normalDamageType: 'physical' };
    }
    const normalDps = normalDpsRaw / realInterval;
    // 常驻伤害乘区（勇冠三军等）：常态普攻同步乘
    const normType = isWeaknessOn ? (calcPhysicalDamage(panelAtk, state.enemy.def) >= calcArtsDamage(panelAtk, state.enemy.res) ? 'physical' : 'arts') : (isArts ? 'arts' : 'physical');
    return { type: 'damage', skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: normalDps * calcTalentDmgMul(op, slotData), skillHps: null, normalHps: null, totalHeal: null, isToggle: false, isPermanent: false, realInterval, panelAtk, damageType: normType, normalDamageType: normType };
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
  if (asOverride !== undefined) { skillInterval = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus + skillAspdExtra + asOverride); }
  else if (levelData.attack_speed) skillInterval = calcRealInterval(phase.baseAttackTime, 100 + baseAspdBonus + skillAspdExtra + levelData.attack_speed);
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
  // atk_scale 输出倍率:在天赋/atk 重算之后乘(atk_scale 技能同时带常驻加攻天赋时不被重算覆盖,如号角 S1 2.4×+军事要塞20%)
  if (levelData.atk_scale !== undefined && !isOneShotHeal && !scaleExcluded) skillAtk = skillAtk * levelData.atk_scale;

  // ======== Dispatch ========
  const isToggle = levelData.isToggle || false;
  const isPermanent = levelData.isPermanent === true || (PERMANENT_OVERRIDES[op.id] || []).includes(skillIndex);
  const skillRealInterval = skillInterval;
  const isIncantationMedic = op.subProfessionId === 'incantationmedic';
  // 驭法铁卫特性:技能开启时普通攻击变为法术伤害(常态仍物理);技能期=有持续时间/常驻的技能
  const artsProtectorSkill = op.subProfessionId === 'artsprotector' && (skillDuration > 0 || isPermanent) && skillDuration !== 0;
  const isArts = op.damageType === 'arts' || ((SKILL_ARTS_OVERRIDES[op.id] || []).includes(skillIndex)) || artsProtectorSkill;
  // 弱点伤害:赤刃明霄陈「形意洞照」精1+ 所有物理/法术伤害逐击取物法更高(精0 无天赋全法术)
  const isWeaknessOn = WEAKNESS_DAMAGE[op.id] === true && calcTalentAtkBonus(op, slotData) > 0;
  // 技能期每击伤害乘子:暮落 S2 六连发(attack@atk_scale×attack@times)+ 斩业星熊 S3 二连击(MULTI_HIT)
  const hitMul = ((levelData['attack@atk_scale'] !== undefined && levelData['attack@times'] !== undefined)
    ? levelData['attack@atk_scale'] * levelData['attack@times'] : 1) * ((MULTI_HIT[op.id] || {})[skillIndex] || 1)
    * (((SINGLE_CRIT_MUL[op.id] || {})[skillIndex] && levelData['attack@surtr_s_2[critical].atk_scale']) || 1);
  const incantMode = (INCANTATION_SPECIAL_MODES[op.id] || {})[skillIndex] || null;
  // 法脆必触发增伤:芙蓉常驻(×damage_scale);焰苇S3 灼痕 100% 触发(talent@prob=1)再乘灼痕档
  const fragileBase = calcMagicFragileMul(op, slotData);
  const fragileExtra = (incantMode === 'burning' && levelData['talent@prob'] === 1) ? calcMagicFragileMul(op, slotData, 0) : 1;

  const params = {
    panelAtk, baseAtk, rawAtk, talentAtk, skillAtk, panelHp, realInterval: skillRealInterval, baseInterval: phase.baseAttackTime, skillDuration,
    isToggle, isPermanent, levelData, isArts, normalTypeArts: op.damageType === 'arts', hitMul,
    isIncantationMedic, enemy: state.enemy,
    incantMode,
    traitScale: calcTraitScale(op, slotData),
    magicFragileMul: fragileBase * fragileExtra,
    isDotTick: (INCANTATION_DOT_OVERRIDES[op.id] || []).includes(skillIndex),
    healChain: (SKILL_HEAL_CHAIN[op.id] || {})[skillIndex] || 1,
    talentHealScale: calcTalentHealScale(op, slotData) * (enh.healScale || 1),  // 常驻治疗倍率(天赋 × 模组天赋强化,如瑰盐/夜莺X模组)
    talentDmgMul: calcTalentDmgMul(op, slotData),  // 常驻伤害乘区(勇冠三军满血×1.15 等,calcDamage 内乘)
    sleepAtkMul: calcSleepAtkMul(op, slotData),  // 瑕光「仁慈」沉睡目标攻击倍率(仅 S2 必睡场景启用)
    resPen,  // 固定法抗穿透(史尔特尔熔火:法术结算时敌人法抗直减)
    isWeakness: isWeaknessOn  // 弱点伤害逐击取优(赤刃明霄陈,精1+)
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
  // ===== 术战者(artsfighter)特殊拦截:置于通用分支链最前,命中即结算 =====
  // 维娜·维多利亚 S1(AUTO 自然回 sp5):下次攻击对四周地面敌人额外造成 atk_scale×atk 真伤 + 普攻法伤照常
  // (斥罪 S1 同构但附加为真伤;普攻为术战者法伤),cycleDps 按自然回充能折算。
  if (op.id === 'char_1019_siege2' && skillIndex === 0) {
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
  } else if (isSummon && !hasRealSkills) {
    if (op.id === 'token_10069_mcnist_mcgraf') {
      // 机械师·结构性原理：攻击型附带单位无技能（冲锋由持有者 S3 触发已计入本体）→ 常态物理普攻
      const normInt = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1;
      const normHit = calcPhysicalDamage(panelAtk, state.enemy.def);
      result = {
        type: 'damage', skillDps: 0, skillTotalDamage: 0, cycleDps: null,
        normalDps: normHit / normInt, skillHps: null, normalHps: null, totalHeal: null,
        isToggle: false, isPermanent: false, realInterval: normInt, panelAtk,
        damageType: 'physical', normalDamageType: 'physical',
      };
    } else {
      result = calcSummonHeal(params);
    }
  } else if (isMedic) {
    result = calcMedical(params);
  } else if (isGuardianHealSkill) {
    result = calcGuardian(params);
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
    const frontHit = calcPhysicalDamage(panelAtk * 1.5, state.enemy.def);
    const overloadHit = calcPhysicalDamage(panelAtk * 2.0, state.enemy.def);
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
    const physPer = calcPhysicalDamage(panelAtk * 2, state.enemy.def);
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
    const trigPhys = calcPhysicalDamage(skillAtk, state.enemy.def);       // skillAtk 已含 atk_scale 1.6
    const dotHit = calcArtsDamage(panelAtk * 0.4, state.enemy.res);
    const dotTotal = dotHit * 4;                                          // 4 秒 4 跳
    const trigTotal = trigPhys + dotTotal;
    const int = skillRealInterval > 0 ? skillRealInterval : 1;
    const chargeAttacks = Math.floor(8 / int);                            // 自然回充能期普攻数（sp8）
    const cycleTime = 8;
    const normPhys = calcPhysicalDamage(panelAtk, state.enemy.def);
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
    const normHit = calcPhysicalDamage(panelAtk * (1 + 0.65), state.enemy.def);   // 普通发：atk 0.65 加攻
    const critHit = calcPhysicalDamage(panelAtk * 3.1, state.enemy.def);           // 暴击发：提高至 310%（替换非叠加）
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
    const physHit = calcPhysicalDamage(panelAtk, state.enemy.def);
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
    const perHit = calcPhysicalDamage(skillAtk, state.enemy.def);
    const firstShot = calcPhysicalDamage(skillAtk * (levelData['attack@extrabomb.atk_scale'] ?? 1), state.enemy.def);
    const ammoN = levelData.trigger_time ?? levelData['attack@trigger_time'] ?? 20;
    const total = perHit * ammoN + firstShot;
    const ammoTime = ammoN * (skillRealInterval > 0 ? skillRealInterval : 1);
    result = {
      skillDps: ammoTime > 0 ? total / ammoTime : 0, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
      dmgTypes: { physical: { skillDps: ammoTime > 0 ? total / ammoTime : 0, skillTotalDamage: total, cycleDps: null } },
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
    const perHit = calcPhysicalDamage(skillAtk * (levelData['attack@atk_scale'] ?? 1), state.enemy.def);
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
    const chargeHit = calcPhysicalDamage(skillAtk * (levelData.atk_scale ?? 1), state.enemy.def);
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
    const perHit = calcPhysicalDamage(panelAtk * (1 + 1.2), state.enemy.def);
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
    const leadHit = calcPhysicalDamage(panelAtk * 1.8, state.enemy.def);
    const stunHit = calcPhysicalDamage(panelAtk * 2.4, state.enemy.def);
    const hitInt = calcRealInterval(phase.baseAttackTime, 100 + 200);
    const stunAttacks = Math.floor(skillDuration / hitInt);
    const total = leadHit + stunHit * stunAttacks;
    result = {
      skillDps: total / skillDuration, skillTotalDamage: total, cycleDps: null,
      normalDps: null, skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: hitInt,
      dmgTypes: { physical: { skillDps: total / skillDuration, skillTotalDamage: total, cycleDps: null } },
    };
  } else if (!isSummon && (NORMAL_ATK_SKILLS[op.id] || []).includes(skillIndex)) {
    // 纯防御/控制技能（无输出增益，普攻照常）：雷蛇 S1 充能防御（受击自动 def）、闪击 S1 闪光护盾（眩晕控制）
    const normHit = calcPhysicalDamage(panelAtk, state.enemy.def);
    result = {
      skillDps: 0, skillTotalDamage: 0, cycleDps: null,
      normalDps: normHit / (phase.baseAttackTime > 0 ? phase.baseAttackTime : 1),
      skillHps: null, normalHps: null, totalHeal: null,
      damageType: 'physical', realInterval: skillRealInterval,
    };
  } else if (!isSummon && levelData.heal_scale !== undefined && levelData.skillDuration === 0) {
    // 自愈型一次性技能(非医疗,如卡缇 S1「生命回复·α」skcom_heal_self):立即恢复最大生命 heal_scale 比例
    const healAmount = panelHp * levelData.heal_scale;
    result = { skillDps: 0, skillTotalDamage: 0, cycleDps: null, normalDps: null, skillHps: null, normalHps: null, totalHeal: healAmount };
  } else if (!isSummon && (PERIODIC_DOT[op.id] || {})[skillIndex]) {
    // 停攻 + 周期法术 DOT(把正常攻击改为周期性范围法伤):
    // 露托 S2 强磁防卫每2s 0.8×atk(magic_atk_scale 键);斥罪 S2 坚心苦修每秒 1.2×atk(skillAtk 已含 atk_scale)
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
    // AUTO 触发附加法伤(斥罪 S1 一锤定音,sp4 自然回):下次攻击=普攻物理+额外 atk_scale_2×atk 法伤,
    // 混合单发(蓄力分支 judge_s_1_enhance_checker 设计上持续输出永远无法蓄力,不计)
    const trigCfg = (TRIGGER_ARTS_ADD[op.id] || {})[skillIndex];
    const artsScale = levelData[trigCfg.scaleKey] ?? 1;
    const triggerPhys = calcPhysicalDamage(panelAtk, state.enemy.def);
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
    const trigPhys = calcPhysicalDamage(panelAtk, state.enemy.def);
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
    const weakHit2 = (atk) => isWeaknessOn ? Math.max(calcPhysicalDamage(atk, state.enemy.def), calcArtsDamage(atk, state.enemy.res)) : calcArtsDamage(atk, state.enemy.res);
    const weakType2 = (atk) => (!isWeaknessOn || calcPhysicalDamage(atk, state.enemy.def) >= calcArtsDamage(atk, state.enemy.res)) ? 'physical' : 'arts';
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
    const weakHit3 = (atk) => isWeaknessOn ? Math.max(calcPhysicalDamage(atk, state.enemy.def), calcArtsDamage(atk, state.enemy.res)) : calcArtsDamage(atk, state.enemy.res);
    const weakType3 = (atk) => (!isWeaknessOn || calcPhysicalDamage(atk, state.enemy.def) >= calcArtsDamage(atk, state.enemy.res)) ? 'physical' : 'arts';
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
  } else if ((SKIP_SKILLS[op.id] || {})[skillIndex]) {
    // 技能不计算(斩业星熊 S2 无始无明:投盾系伤害不建模型)→ 技能期无增益,常态普攻照常展示
    const nI = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1;
    const isArtsOp = op.damageType === 'arts';
    result = {
      skillDps: 0, skillTotalDamage: 0, cycleDps: null,
      normalDps: isArtsOp ? calcArtsDamage(panelAtk, state.enemy.res) / nI : calcPhysicalDamage(panelAtk, state.enemy.def) / nI,
      skillHps: null, normalHps: null, totalHeal: null,
      damageType: isArtsOp ? 'arts' : 'physical', normalDamageType: isArtsOp ? 'arts' : 'physical',
      type: 'damage', realInterval: skillRealInterval,
    };
  } else {
    result = calcDamage(params);
  }

  // ======== 重装/防御通用修正 ========
  // 停止攻击:技能期伤害记 0(普攻停止,防御/面板变化仅展示)
  if ((STOP_ATTACK_SKILLS[op.id] || []).includes(skillIndex) && !isMedic && !isSummon) {
    result = { ...result, skillDps: 0, skillTotalDamage: 0, cycleDps: null };
  }
  // 受击回复触发型技能(INCREASE_WHEN_TAKEN_DAMAGE,无自然充能周期):不展示周期 DPS,仅保留单次技能总伤/总治疗；
  // 常态普攻照常展示——这类技能不停止攻击(可颂 S2 磁爆锤/泥岩 S2 岩崩锤等单发触发型 dur=0 走 calcDamage
  // else 分支 normalDps 为 null,此处统一按职业普攻口径补回;有持续时间的受击型(斥罪 S3)已有 normalDps 不覆盖)
  if (levelData.spType === 'INCREASE_WHEN_TAKEN_DAMAGE' && !isMedic && !isSummon) {
    const normI = phase.baseAttackTime > 0 ? phase.baseAttackTime : 1;
    const normTypeArts = op.damageType === 'arts';
    const normalDps = (normTypeArts ? calcArtsDamage(panelAtk, state.enemy.res) : calcPhysicalDamage(panelAtk, state.enemy.def)) / normI;
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
      normalDps: (result.normalDps ?? 0) + dotDps,
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
  // PASSIVE 被动技能(星熊「荆棘」def+24%、森蚺「轻型挂斧」atk/def+20%):装备即常驻入面板,无技能期——
  // 与 calculateOperator 同口径,使白值面板(renderPanelStats)也体现被动加成(星熊 S2 加防肉眼可查)
  const equippedSkill = op.skills[slotData.skillIndex || 0];
  const isSummon = op.profession === 'TOKEN';
  const passiveLv = (!isSummon && equippedSkill && equippedSkill.levels[0]?.skillType === 'PASSIVE')
    ? getSkillLevelData(equippedSkill, slotData.skillLevel) : null;

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
  }
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

export { calculateOperator, getSkillLevelData, calcPanelStats, calcTalentAtkBonus, calcTalentAttackSpeed, calcTalentHealScale, calcModuleTalentEnhance, calcTalentHpDefMul, calcTalentDmgMul, calcSelfAuraFlat, TALENT_ATK_DRIVERS, TALENT_HEAL_DRIVERS, TALENT_SPD_DRIVERS, TALENT_HP_DEF_DRIVERS, SELF_AURA_DRIVERS };
