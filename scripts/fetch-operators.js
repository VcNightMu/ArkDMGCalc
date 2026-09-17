const fs = require('fs');
const path = require('path');

const EXCEL = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel';
const BASE = path.join(__dirname, '..', 'src', 'frontend', 'data');

// 升变/特殊形态干员：数据在 char_patch_table（不在 character_table 主表）。
// 显示名需与原型区分（半角括号与 prts 头像文件名一致，如「头像_阿米娅(医疗).png」）。
const PATCH_CHARS = {
  'char_1037_amiya3': '阿米娅(医疗)',   // 阿米娅升变·医疗形态（咒愈师）
  'char_1001_amiya2': '阿米娅(近卫)',   // 阿米娅升变·近卫形态（术战者，2技能：影霄·奔夜/绝影）
};

// 干员列表按 主职业 → 子职业 → 干员id 三层组织。
// 尚未拉取数据的子职业保留空列表，便于后续按职业补充。
const OPERATORS = {
  PIONEER: { // 先锋
    pioneer: [ // 尖兵
      'char_112_siege', 'char_362_saga', 'char_4026_vulpis', 'char_420_flamtl',   // 推进之王/嵯峨/忍冬/焰尾 6★
      'char_115_headbr', 'char_102_texas', 'char_349_chiave', 'char_488_buildr', 'char_4023_rfalcn', // 凛冬/德克萨斯/贾维/青枳/红隼 5★
      'char_198_blackd', 'char_149_scave',                              // 讯使/清道夫 4★
      'char_123_fang', 'char_240_wyvern',                               // 芬/香草 3★
      'char_502_nblade',                                                // 夜刀 2★
      'char_4188_confes',                                               // CONFESS-47 1★（拉特兰告解机器人，公招+签到可得）
    ], // 尖兵（不录：预备干员-先锋/预备干员-近战、郁金香=卫戍协议活动干员同Mechanist口径不录）
    charger: [ // 冲锋手
      'char_222_bpipe',                                                 // 风笛 6★
      'char_261_sddrag', 'char_496_wildmn', 'char_1036_fang2', 'char_220_grani', // 苇草/野鬃/历阵锐枪芬/格拉尼 5★
      'char_290_vigna',                                                 // 红豆 4★
      'char_192_falco',                                                 // 翎羽 3★
    ],
    tactician: [ // 战术家
      'char_427_vigil', 'char_249_mlyss', 'char_4228_closur',           // 伺夜/缪尔赛思/可露希尔 6★
      'char_476_blkngt', 'char_4147_mitm',                              // 夜半/渡桥 5★
      'char_452_bstalk',                                                // 豆苗 4★
      'char_4215_buddy',                                                // 罗德岛隐秘队 1★（怪猎联动活动赠送）
    ],
    bearer: [ // 执旗手
      'char_479_sleach',                                                // 琴柳 6★
      'char_401_elysm', 'char_4119_wanqin', 'char_4237_jcinta',         // 极境/万顷/嘉辛塔 5★
      'char_151_myrtle',                                                // 桃金娘 4★
    ],
    agent: [ // 情报官
      'char_4087_ines',                                                 // 伊内丝 6★
      'char_497_ctable', 'char_4017_puzzle', 'char_4144_chilc', 'char_4052_surfer', // 晓歌/谜图/齐尔查克/寻澜 5★
      'char_4208_wintim',                                               // 冬时 4★
    ],
    counsellor: [ // 策士
      'char_1045_svash2',                                               // 凛御银灰 6★（银灰异格，召唤风雪之眼）
      'char_4199_makiri',                                               // 松桐 5★
    ],
  },
  WARRIOR: { // 近卫
    centurion: [],                  // 强攻手
    fighter: [],                    // 斗士
    artsfghter: ['char_350_surtr', 'char_185_frncat', 'char_274_astesi', 'char_333_sidero', 'char_4098_vvana', 'char_1019_siege2', 'char_1050_chen3', 'char_1001_amiya2'], // 术战者：慕斯4/星极5/铸铁5/史尔特尔6/薇薇安娜6/维娜·维多利亚6(异格)/赤刃明霄陈6(异格)/阿米娅(近卫)5(升变)
    instructor: [],                 // 教官
    lord: ['char_172_svrash', 'char_293_thorns'], // 领主
    sword: ['char_010_chen'],       // 剑豪
    musha: [],                      // 武者
    fearless: [],                   // 无畏者
    reaper: [],                     // 收割者
    librator: [],                   // 解放者
    crusher: [],                    // 重剑手
    hammer: [],                     // 撼地者
    primguard: [],                  // 本源近卫
    mercenary: [],                  // 佣兵
  },
  TANK: { // 重装
    protector: [ // 铁卫
      'char_136_hsguma', 'char_2014_nian',                              // 星熊/年 6★
      'char_201_moeshd', 'char_325_bison', 'char_304_zebra',           // 可颂/拜松/暴雨 5★
      'char_199_yak', 'char_150_snakek', 'char_381_bubble',            // 角峰/蛇屠箱/泡泡 4★
      'char_209_ardign', 'char_122_beagle',                            // 卡缇/米格鲁 3★
      'char_500_noirc', 'char_4093_frston',                            // 黑角 2★ / Friston-3 1★
    ],
    guardian: [ // 守护者
      'char_202_demkni', 'char_423_blemsh', 'char_2025_shu',           // 塞雷娅/瑕光/黍 6★
      'char_148_nearl', 'char_226_hmau', 'char_4109_baslin', 'char_4143_sensi', // 临光/吽/深律/森西 5★
      'char_196_sunbr', 'char_284_spot',                               // 古米 4★ / 斑点 3★
    ],
    unyield: ['char_311_mudrok', 'char_4065_judge', 'char_163_hpsts', 'char_4207_branch', 'char_4130_luton'], // 不屈者（泥岩/斥罪 6★、火神/折桠 5★、露托 4★）
    artsprotector: [ // 驭法铁卫
      'char_1044_hsgma2',                                               // 斩业星熊 6★
      'char_378_asbest', 'char_4047_pianst', 'char_4025_aprot2',        // 石棉/车尔尼/暮落(VC07) 5★（旧版 512_aprot 占位不录）
      'char_260_durnar',                                                // 坚雷 4★
    ],
    duelist: ['char_416_zumama', 'char_422_aurora', 'char_464_cement'], // 决战者（森蚺 6★、极光/洋灰 5★）
    fortress: ['char_4039_horn', 'char_431_ashlok', 'char_493_firwhl'], // 要塞（号角 6★、灰毫/火哨 5★）
    shotprotector: [ // 哨戒铁卫
      'char_1034_jesca2', 'char_4194_rmixer', 'char_4230_mcnist',       // 涤火杰西卡/信仰搅拌机/机械师 6★
      'char_107_liskam', 'char_4137_udflow', 'char_457_blitz',          // 雷蛇/深巡/闪击 5★
    ],
    primprotector: [ // 本源铁卫
      'char_2026_yu', 'char_4235_thumpy',                               // 余/珊比 6★
      'char_4148_philae', 'char_4225_tanya', 'char_4214_cairn',         // 菲莱/裂响/响石 5★
    ],
  },
  SNIPER: { // 狙击
    fastshot: [ // 速射手
      'char_103_angel', 'char_332_archet', 'char_456_ash',              // 能天使/空弦/灰烬 6★
      'char_129_bluep', 'char_204_platnm', 'char_365_aprl', 'char_367_swllow', 'char_498_inside', 'char_1021_kroos2', // 蓝毒/白金/四月/灰喉/隐现 5★、寒芒克洛丝 5★（克洛丝异格）
      'char_126_shotst', 'char_133_mm', 'char_190_clour', 'char_235_jesica', // 流星/梅/红云/杰西卡 4★
      'char_124_kroos', 'char_211_adnach',                              // 克洛丝/安德切尔 3★
      'char_503_rang',                                                  // 巡林者 2★
      'char_4000_jnight',                                               // 正义骑士号 1★（拉特兰告解机器人，公招可得，同 CONFESS-47/Friston-3 口径）
    ], // 不录：预备干员-狙击（507_rsnipe/603_csnipe）与 Stormeye（511_asnipe/611_acnipe，集成战略限时形态，数据 isNotObtainable=true）
    closerange: [ // 重射手
      'char_340_shwaz', 'char_4055_bgsnow', 'char_1048_orchd2',           // 黑/鸿雪/焰狐龙梓兰(异格) 6★
      'char_145_prove', 'char_4006_melnte',                               // 普罗旺斯/玫拉 5★
      'char_366_acdrop',                                                  // 酸糖 4★
    ],
    aoesniper: [ // 炮手
      'char_113_cqbw', 'char_300_phenxi',                               // W/菲亚梅塔 6★
      'char_219_meteo', 'char_379_sesa', 'char_4078_bdhkgt',            // 陨星/慑砂/截云 5★
      'char_118_yuki',                                                  // 白雪 4★
      'char_282_catap',                                                 // 空爆 3★
    ],
    longrange: [ // 神射手
      'char_430_fartth', 'char_4193_lemuen',                              // 远牙/蕾缪安 6★
      'char_158_milu', 'char_218_cuttle', 'char_4014_lunacu',             // 守林人/安哲拉/子月 5★
      'char_302_glaze',                                                   // 安比尔 4★
    ],
    reaperrange: [ // 散射手
      'char_1013_chen2',                                                 // 假日威龙陈 6★(异格)
      'char_279_excu', 'char_346_aosta', 'char_4203_kichi',              // 送葬人/奥斯塔/吉星 5★
      'char_440_pinecn',                                                 // 松果 4★
    ],
    siegesniper: [ // 攻城手
      'char_197_poca', 'char_2012_typhon',                              // 早露/提丰 6★
      'char_363_toddi', 'char_4043_erato', 'char_4221_ju',              // 熔泉/埃拉托/矩 5★
      'char_4062_totter',                                               // 铅踝 4★
    ],
    bombarder: [],                  // 投掷手
    hunter: [],                     // 猎手
    loopshooter: [],                // 回环射手
    skybreaker: [],                 // 裂空炮手
  },
  CASTER: { // 术师
    corecaster: [ // 中坚术师
      'char_4133_logos', 'char_4027_heyak', 'char_2013_cerber', 'char_180_amgoat', // 逻各斯/霍尔海雅/刻俄柏/艾雅法拉 6★
      'char_002_amiya', 'char_164_nightm', 'char_466_qanik', 'char_411_tomimi', 'char_405_absin', // 阿米娅/夜魔/雪绒/特米米/苦艾 5★
      'char_141_nights',                                                         // 夜烟 4★
      'char_210_stward',                                                         // 史都华德 3★
      'char_501_durin',                                                          // 杜林 2★
      'char_4227_gallus',                                                        // GALLUS² 1★（公招+七周年签到，同CONFESS-47口径）
    ], // 不录：预备干员-术师（505_rcast/604_ccast）
    splashcaster: [ // 扩散术师
      'char_4141_marcil', 'char_2015_dusk', 'char_213_mostma',                   // 玛露西尔(迷宫饭联动)/夕/莫斯提马 6★
      'char_1011_lava2', 'char_4031_liesel', 'char_341_sntlla', 'char_373_lionhd', 'char_166_skfire', // 炎狱炎熔/复奏/寒檀/莱恩哈特/天火 5★
      'char_253_greyy', 'char_109_fmout',                                        // 格雷伊/远山 4★
      'char_121_lava', 'char_009_12fce',                                         // 炎熔 3★ / 12F 2★
    ], // 不录：Pith×2（509_acast=集成战略临时招募专属/612_accast=卫戍协议模式专属，同Mechanist/郁金香口径）
    funnel: [ // 驭械术师
      'char_1038_whitw2', 'char_377_gdglow',                                     // 荒芜拉普兰德/澄闪 6★
      'char_4236_tmslot', 'char_4054_malist', 'char_4040_rockr', 'char_4013_kjera', // 时隙/至简/洛洛/耶拉 5★
      'char_328_cammou',                                                         // 卡达 4★
    ],
    phalanx: [ // 阵法术师
      'char_1046_sbell2', 'char_4080_lin', 'char_426_billro',                    // 圣聆初雪(异格)/林/卡涅利安 6★
      'char_388_mint', 'char_344_beewax',                                        // 薄绿/蜜蜡 5★
    ],
    mystic: [ // 秘术师
      'char_4226_veen', 'char_4046_ebnhlz',                                      // 维伊/黑键 6★
      'char_4110_delphn', 'char_297_hamoni', 'char_338_iris',                    // 戴菲恩/和弦/爱丽丝 5★
      'char_469_indigo',                                                         // 深靛 4★
    ],
    chain: [ // 链术师
      'char_472_pasngr',                                                         // 异客 6★
      'char_135_halo', 'char_306_leizi',                                         // 星源/惊蛰 5★
      'char_4004_pudd',                                                          // 布丁 4★
    ],
    blastcaster: [ // 轰击术师
      'char_4229_aphris', 'char_134_ifrit',                                      // 谬因/伊芙利特 6★
      'char_446_aroma', 'char_489_serum',                                        // 阿罗玛/蚀清 5★
      'char_4051_akkord',                                                        // 协律 4★
    ],
    primcaster: [ // 本源术师
      'char_4204_mantra', 'char_1040_blaze2', 'char_4146_nymph',                 // 真言/烛煌(异格)/妮芙 6★
      'char_4198_christ', 'char_4081_warmy', 'char_499_kaitou',                  // Miss.Christine/温米/折光 5★
    ],
    soulcaster: [ // 塑灵术师
      'char_450_necras',                                                         // 死芒 6★
      'char_4164_tecno',                                                         // 特克诺 5★
    ],
  },
  MEDIC: { // 医疗
    physician: [
      'char_147_shining', 'char_003_kalts', 'char_108_silent', 'char_171_bldsk',
      'char_345_folnic', 'char_4196_reckpr', 'char_402_tuye', 'char_117_myrrh',
      'char_187_ccheal', 'char_298_susuro', 'char_120_hibisc', 'char_212_ansel',
      'char_285_medic2',
    ], // 医师
    ringhealer: ['char_128_plosis', 'char_179_cgbird', 'char_181_flower', 'char_275_breeze', 'char_4163_rosesa'], // 群愈师/瑰盐
    healer: ['char_385_finlpp', 'char_348_ceylon', 'char_436_whispr', 'char_4173_nowell', 'char_4042_lumen'],                     // 疗养师
    wandermedic: ['char_4041_chnut', 'char_473_mberry', 'char_449_glider', 'char_4114_harold', 'char_1016_agoat2'],                // 行医
    incantationmedic: ['char_1024_hbisc2', 'char_494_vendla', 'char_1020_reed2', 'char_4056_titi', 'char_1037_amiya3'], // 咒愈师（阿米娅医疗形态走 patch 表）
    chainhealer: ['char_4179_monstr', 'char_4071_peper', 'char_4139_papyrs', 'char_4224_turdus'], // 链愈师（Mon3tr干员本体/明椒/莎草/乌啾）
    watchman: ['char_4222_taraxa', 'char_1052_kalts2'],  // 守望者
  },
  SUPPORT: { // 辅助
    slower: ['char_291_aglina'],    // 凝滞师
    underminer: [],                 // 削弱者
    bard: [],                       // 吟游者
    blessing: [],                   // 护佑者
    summoner: [],                   // 召唤师
    craftsman: [],                  // 工匠
    ritualist: [],                  // 巫役
    supportiveranger: [],           // 游击手
  },
  SPECIAL: { // 特种
    executor: ['char_144_red'],     // 处决者
    pusher: [],                     // 推击手
    stalker: [],                    // 伏击客
    hookmaster: [],                 // 钩索师
    geek: [],                       // 怪杰
    merchant: [],                   // 行商
    traper: [],                     // 陷阱师
    dollkeeper: [],                 // 傀儡师
    alchemist: [],                  // 炼金师
    skywalker: [],                  // 巡空者
  },
  TOKEN: { // 特殊（干员附带单位/召唤物）
    notchar1: ['token_10000_silent_healrb', 'token_10002_kalts_mon3tr', 'token_10003_cgbird_bird', 'token_10032_jesca2_jckshd', 'token_10069_mcnist_mcgraf', 'token_10040_siege2_vlion', 'token_10014_bstalk_crab', 'token_10021_blkngt_hypnos', 'token_10028_vigil_wolf', 'token_10030_mlyss_wtrman', 'token_10037_mitm_trshrb', 'token_10057_svash2_eagle1', 'token_10057_svash2_eagle2', 'token_10057_svash2_eagle3', 'token_10063_buddy_bddg', 'token_10066_closur_ourbase', 'token_10043_necras_skeltn', 'token_10042_tecno_puppet'], // 干员附带单位（赫默·医疗探机 / 凯尔希·Mon3tr / 夜莺·幻影 / 涤火杰西卡·机动盾牌 / 机械师·结构性原理 / 维娜·黄金盟誓 / 豆苗·磐蟹护卫队 / 夜半·眠兽 / 伺夜·狼群 / 缪尔赛思·流形 / 渡桥·樱桃三号 / 凛御银灰·风雪之眼×3 / 罗德岛隐秘队·牙猎犬 / 可露希尔·指挥中心）
  },
};

// 展平嵌套结构，得到所有待拉取的干员 id。
// subFilter：可选子职业 id（如 'artsfghter'），传了则只返回该子职业下的干员。
function flattenOperators(subFilter) {
  const ids = [];
  for (const prof of Object.values(OPERATORS)) {
    for (const [subId, subList] of Object.entries(prof)) {
      if (subFilter && subId !== subFilter) continue;
      ids.push(...subList);
    }
  }
  return ids;
}

async function fetchJSON(url) {
  const once = async (u) => {
    const resp = await fetch(u, { headers: { 'User-Agent': 'ArkDMGCalc/1.0' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${u}`);
    return resp.json();
  };
  try {
    return await once(url);
  } catch (e) {
    // 镜像回退：raw.githubusercontent 在部分网络环境不可达（ECONNRESET）时改走 jsDelivr
    const mirror = url
      .replace('https://raw.githubusercontent.com/', 'https://cdn.jsdelivr.net/gh/')
      .replace('/master/', '@master/');
    console.log(`  [MIRROR] ${e.message} → ${mirror}`);
    return await once(mirror);
  }
}

function convertTalents(charData) {
  const phaseNum = { PHASE_0: 0, PHASE_1: 1, PHASE_2: 2 };
  const talents = [];
  for (const t of charData.talents || []) {
    const candidates = (t.candidates || []).map(c => {
      const bb = {};
      for (const b of c.blackboard || []) bb[b.key] = b.value;
      return {
        phase: phaseNum[c.unlockCondition?.phase] ?? 0,
        level: c.unlockCondition?.level ?? 1,
        potentialRank: c.requiredPotentialRank ?? 0,
        name: c.name,
        description: c.description,
        blackboard: bb,
        isHideTalent: c.isHideTalent ?? false
      };
    });
    if (candidates.length > 0) talents.push({ candidates });
  }
  return talents;
}

/**
 * 特性（trait）转换：咒愈师等职业的治疗/伤害由特性决定（如攻击时治疗相当于伤害量 scale%）。
 * 取无解锁条件的默认 candidate（PHASE_0），blackboard 存数值变量（如 scale=0.5），
 * 描述文本去掉富文本标签、将 {key:格式} 占位符替换为实际数值（如 {scale:0%} → 50%）。
 */
function convertTrait(charData) {
  const cands = charData.trait?.candidates || [];
  const cand = cands.find(c => (c.unlockCondition?.phase || 'PHASE_0') === 'PHASE_0' && !c.requiredPotentialRank) || cands[0];
  if (!cand) return null;
  const bb = {};
  for (const b of cand.blackboard || []) bb[b.key] = b.value;
  let desc = (cand.overrideDescripton || cand.traitName || '').replace(/<[^>]+>/g, '');
  desc = desc.replace(/\{([a-zA-Z_]+):([^}]*)\}/g, (m, key, fmt) => {
    const v = bb[key];
    if (v === undefined) return m;
    if (fmt.includes('%')) return `${Math.round(v * 100)}%`;
    if (fmt.startsWith('0.')) return String(v);
    return String(v);
  });
  return { description: desc, blackboard: bb };
}

/**
 * 干员模组挂载：从 uniequip_table（元数据）+ battle_equip_table（等级面板）组装。
 * charEquip[charId] 给出该干员全部模组（含 INITIAL 基础证章，order=0），按 charEquipOrder 排序。
 * 每个模组 levels 为 battle_equip phases（键 0/1/2 → 模组等级 1/2/3），
 * attributeBlackboard 为该等级生效后的最终面板加成（非逐级累加）。
 * 召唤物/三星干员无 charEquip 条目 → 不挂载。
 */
function attachModules(converted, charId, uniTable, battleTable) {
  const eq = uniTable.equipDict || {};
  const list = (uniTable.charEquip || {})[charId] || [];
  if (list.length === 0) return;
  const modules = list.map(eid => {
    const meta = eq[eid];
    if (!meta) return null;
    const phases = battleTable[eid]?.phases || {};
    const levels = Object.keys(phases).sort((a, b) => a - b).map(k => {
      const p = phases[k];
      const bb = {};
      for (const b of p.attributeBlackboard || []) bb[b.key] = b.value;
      // 模组对天赋/特性的强化（等级≥2 出现）：parts 中 target=TALENT/TALENT_DATA_ONLY 的候选，
      // 数值覆盖类（如闪灵X L2 法典攻速 10→15）与附加效果类（装备技能2 攻击+15%）都在这。
      const talentEnhance = [];
      for (const part of p.parts || []) {
        if (part.target !== 'TALENT' && part.target !== 'TALENT_DATA_ONLY') continue;
        const bundle = part.addOrOverrideTalentDataBundle || part.overrideTraitDataBundle;
        for (const c of (bundle && bundle.candidates) || []) {
          if (!c) continue;
          const tbb = {};
          for (const b of c.blackboard || []) tbb[b.key] = b.value;
          talentEnhance.push({
            name: c.name || null,
            requiredPotentialRank: c.requiredPotentialRank ?? 0,
            blackboard: tbb,
          });
        }
      }
      const out = { level: parseInt(k) + 1, attributeBlackboard: bb };
      if (talentEnhance.length > 0) out.talentEnhance = talentEnhance;
      // 特性强化（咒愈师模组把治疗比例 scale 0.5→0.6 等）：target=TRAIT_DATA_ONLY 的 overrideTraitDataBundle
      const traitEnhance = [];
      for (const part of p.parts || []) {
        if (part.target !== 'TRAIT' && part.target !== 'TRAIT_DATA_ONLY') continue;
        for (const c of (part.overrideTraitDataBundle && part.overrideTraitDataBundle.candidates) || []) {
          if (!c) continue;
          const tbb = {};
          for (const b of c.blackboard || []) tbb[b.key] = b.value;
          traitEnhance.push({ blackboard: tbb });
        }
      }
      if (traitEnhance.length > 0) out.traitEnhance = traitEnhance;
      return out;
    });
    return {
      id: eid,
      name: meta.uniEquipName,
      type: meta.type,                    // INITIAL 基础证章 / ADVANCED 效果模组
      typeName2: meta.typeName2 || null,  // 模组代号 X / Y / α 等，证章为 null
      isSpecialEquip: !!meta.isSpecialEquip,
      unlockLevel: meta.unlockLevel || 0, // 开启条件：精二后等级门槛（四星40/五星50/六星60）
      order: meta.charEquipOrder ?? 0,
      levels,
    };
  }).filter(Boolean);
  modules.sort((a, b) => a.order - b.order);
  converted.modules = modules;
}


/**
 * 召唤物技能注入：召唤物自身无技能（skills 为 null 占位）时，将持有者干员的技能注入，
 * 供攻击型召唤物使用（如凯尔希·Mon3tr：其 1/2/3 技能效果 = 凯尔希 1/2/3 技能）。
 * 持有者技能 blackboard 中带 attack@ 前缀的 key 是作用于召唤物的加成（attack@atk → atk，
 * 去前缀后作为召唤物自身的加成）；不带前缀的 key（自身防御/攻速/物格挡等）不注入。
 * 额外识别：描述含「逐渐降低/减少」→ atkDecay（攻击力增幅线性衰减）；
 * 含「伤害类型变为真实」→ trueDamage（真实伤害）。
 */
function convertSkillsForToken(ownerCharData, skillTable) {
  const skills = [];
  for (const skillRef of ownerCharData.skills || []) {
    const sid = skillRef.skillId;
    const st = skillTable[sid];
    if (!st) continue;
    const levels = [];
    for (const [lk, lv] of Object.entries(st.levels || {})) {
      const levelNum = parseInt(lk.replace('LEVEL_', ''));
      const bb = {};
      for (const b of lv.blackboard || []) {
        if (String(b.key).startsWith('attack@')) bb[b.key.slice('attack@'.length)] = b.value;
      }
      if (Object.keys(bb).length === 0) continue; // 该技能对召唤物无效果，不注入
      const desc = (lv.description || '').replace(/<[^>]+>/g, ''); // 剥离富文本标签后判断文案
      const isToggle = desc.includes('可以在下列状态和初始状态间切换');
      const isPermanent = !isToggle && desc.includes('持续时间无限');
      if (desc.includes('逐渐降低') || desc.includes('逐渐减少')) bb.atkDecay = true;
      if (desc.includes('伤害类型变为真实')) bb.trueDamage = true;
      levels.push({ ...bb, level: levelNum, spCost: 0, initialSp: 0, spType: 'INCREASE_WITH_TIME', skillDuration: lv.duration ?? 0, skillType: lv.skillType, isToggle, isPermanent });
    }
    if (levels.length === 0) continue;
    levels.sort((a, b) => a.level - b.level);
    const firstLevel = Object.values(st.levels || {})[0];
    skills.push({ skillId: sid, name: firstLevel?.name || sid, levels });
  }
  return skills;
}

function convertOperator(id, charData, skillTable, ownerOperatorId, ownerCharData) {
  const phases = [];
  for (const [, p] of Object.entries(charData.phases || {})) {
    const akf = p.attributesKeyFrames || [];
    if (akf.length === 0) continue;
    phases.push({
      eliteLevel: p.phases?.[0]?.eliteLevel ?? (phases.length),
      maxLevel: p.maxLevel,
      atk: [akf[0].data.atk, akf[akf.length - 1].data.atk],
      def: [akf[0].data.def, akf[akf.length - 1].data.def],
      maxHp: [akf[0].data.maxHp, akf[akf.length - 1].data.maxHp],
      magicResistance: akf[0].data.magicResistance ?? 0,
      baseAttackTime: akf[0].data.baseAttackTime || 1.0,
      attackSpeed: akf[0].data.attackSpeed || 100,
    });
  }
  phases.sort((a, b) => a.eliteLevel - b.eliteLevel);

  const favorKf = charData.favorKeyFrames || [];
  let trustBonus = { atk: 0, def: 0, maxHp: 0 };
  if (favorKf.length > 0) {
    const max = favorKf[favorKf.length - 1].data;
    trustBonus = { atk: max.atk || 0, def: max.def || 0, maxHp: max.maxHp || 0 };
  }

  const artsSubs = ['artsfghter','corecaster','splashcaster','blastcaster','funnel','mystic','chain','primcaster','soulcaster','phalanx','incantationmedic'];
  // 无攻击能力的召唤物（如夜莺幻影/鸟笼 atk=0）按法术色展示，DPS 按 0 攻计算
  const tokenArtsIds = ['token_10003_cgbird_bird'];
  // 真伤召唤物（如维娜·黄金盟誓：攻击造成真实伤害，无视防御法抗）
  const tokenTrueIds = ['token_10040_siege2_vlion'];
  const isNoAtkToken = String(id).startsWith('token_') && tokenArtsIds.includes(id);
  const isTrueToken = String(id).startsWith('token_') && tokenTrueIds.includes(id);
  const damageType = isTrueToken ? 'true' : ((artsSubs.includes(charData.subProfessionId) || isNoAtkToken) ? 'arts' : 'physical');

  const skills = [];
  // 剔除召唤物自带的占位/联动技能（结构性原理的 sktok_mcgraf_1/2 空占位、sktok_mcgraf_3 冲锋被动由持有者 S3 触发，
  // 独立查询时以常态普攻为准——与医疗探机同类无技能卡）；同时跳过持有者技能注入
  // （机械师技能的 attack@ 前缀键是机械师自身普攻改写，非结构体加成）
  const tokenDropNativeSkills = ['token_10069_mcnist_mcgraf', 'token_10032_jesca2_jckshd', 'token_10040_siege2_vlion'];
  const dropNative = String(id).startsWith('token_') && tokenDropNativeSkills.includes(id);
  const nativeRefs = (charData.skills || []).filter(sr => sr.skillId && skillTable[sr.skillId]);
  const nativeRefs2 = dropNative ? [] : nativeRefs;
  if (!dropNative && nativeRefs2.length === 0 && ownerCharData) {
    // 召唤物无自身技能（skills 为 null 占位）→ 注入持有者技能（attack@ 前缀剥离）
    skills.push(...convertSkillsForToken(ownerCharData, skillTable));
  }
  for (const skillRef of nativeRefs2) {
    const sid = skillRef.skillId;
    const st = skillTable[sid];
    if (!st) continue;
    const levels = [];
    for (const [lk, lv] of Object.entries(st.levels || {})) {
      const levelNum = parseInt(lk.replace('LEVEL_', ''));
      const bb = {};
      for (const b of lv.blackboard || []) bb[b.key] = b.value;
      const spData = lv.spData || {};
      const desc = lv.description || '';
      const isToggle = desc.includes('可以在下列状态和初始状态间切换');
      const isPermanent = !isToggle && desc.includes('持续时间无限');
      levels.push({ ...bb, level: levelNum, spCost: spData.spCost || 0, initialSp: spData.initSp || 0, spType: spData.spType || 'INCREASE_WITH_TIME', skillDuration: lv.duration, skillType: lv.skillType, isToggle, isPermanent });
    }
    levels.sort((a, b) => a.level - b.level);
    const firstLevel = Object.values(st.levels || {})[0];
    skills.push({ skillId: sid, name: firstLevel?.name || sid, levels });
  }

  return {
    id, name: PATCH_CHARS[id] || charData.name, rarity: charData.rarity,
    profession: charData.profession, subProfessionId: charData.subProfessionId,
    damageType,
    ownerOperatorId: ownerOperatorId || null,
    phases, trustBonus, skills, talents: convertTalents(charData), trait: convertTrait(charData),
    potentialRanks: (charData.potentialRanks || []).map(p => ({
      description: p.description,
      type: p.type,
      modifiers: p.buff?.attributes?.attributeModifiers?.map(m => ({
        attr: m.attributeType, formula: m.formulaItem, value: m.value
      })) || []
    }))
  };
}

async function main() {
  console.log('拉取 character_table.json ...');
  const charTable = await fetchJSON(`${EXCEL}/character_table.json`);
  // 升变/特殊形态（阿米娅近卫/医疗）数据在 char_patch_table.patchChars，并入主表供按 id 取用
  const patchTable = await fetchJSON(`${EXCEL}/char_patch_table.json`);
  for (const [pid, pdata] of Object.entries(patchTable.patchChars || {})) {
    if (!charTable[pid]) charTable[pid] = pdata;
  }
  console.log('拉取 skill_table.json ...');
  const skillTable = await fetchJSON(`${EXCEL}/skill_table.json`);
  console.log('拉取 uniequip_table.json ...');
  const uniequipTable = await fetchJSON(`${EXCEL}/uniequip_table.json`);
  console.log('拉取 battle_equip_table.json ...');
  const battleEquipTable = await fetchJSON(`${EXCEL}/battle_equip_table.json`);

  // Save sub-professions dictionary
  const subProfDict = uniequipTable.subProfDict || {};
  fs.writeFileSync(path.join(BASE, 'sub-professions.json'), JSON.stringify(subProfDict, null, 2), 'utf8');
  console.log('  → sub-professions.json');

  const index = [];

  // 收集干员 → 召唤物关联（干员技能的 overrideTokenKey → 干员 id）
  const subFilter = process.argv[2] || null;  // 可选：只拉指定子职业（node fetch-operators.js artsfghter）
  const allIds = flattenOperators(subFilter);
  const tokenOwners = {};
  // notchar1 模式：持有者（各主职业干员）不在本次 allIds 内，需扫全量非 TOKEN 白名单干员收集关联；
  // 否则重拉 TOKEN 会把 ownerOperatorId 清空并丢失持有者技能注入（Mon3tr 等）。
  const ownerScanIds = subFilter === 'notchar1' ? flattenOperators(null).filter(id => !String(id).startsWith('token_')) : allIds;
  for (const id of ownerScanIds) {
    const charData = charTable[id];
    if (!charData) continue;
    // 技能召唤（如赫默·医疗探机）
    for (const sk of (charData.skills || [])) {
      if (sk.overrideTokenKey) tokenOwners[sk.overrideTokenKey] = id;
    }
    // 天赋召唤（如凯尔希·Mon3tr：talent candidate 的 tokenKey）
    for (const t of (charData.talents || [])) {
      for (const c of (t.candidates || [])) {
        if (c.tokenKey) tokenOwners[c.tokenKey] = id;
      }
    }
    // 直接召唤（涤火杰西卡·机动盾牌 / 机械师·结构性原理：干员顶层 displayTokenDict 声明）
    for (const tokenId of Object.keys(charData.displayTokenDict || {})) {
      tokenOwners[tokenId] = id;
    }
  }
  // 静态兜底：subFilter 模式只拉 TOKEN 子职业时持有者不在本次 allIds，displayTokenDict 扫不到；
  // 显式登记（黄金盟誓 ← 维娜·维多利亚异格）
  const TOKEN_OWNER_FALLBACK = {
    'token_10040_siege2_vlion': 'char_1019_siege2',  // 维娜·维多利亚 S3 召唤
  };
  for (const [tokenId, ownerId] of Object.entries(TOKEN_OWNER_FALLBACK)) {
    tokenOwners[tokenId] = tokenOwners[tokenId] || ownerId;
  }

  for (const id of allIds) {
    const charData = charTable[id];
    if (!charData) { console.log(`  [SKIP] ${id} not found`); continue; }
    const ownerId = tokenOwners[id];
    const converted = convertOperator(id, charData, skillTable, ownerId, ownerId ? charTable[ownerId] : null);
    attachModules(converted, id, uniequipTable, battleEquipTable);
    // Directory: profession/subProfessionId/
    const dir = path.join(BASE, converted.profession, converted.subProfessionId);
    fs.mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, `${id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(converted, null, 2), 'utf8');
    const ownerName = ownerId ? (charTable[ownerId]?.name || '') : '';
    index.push({ id: converted.id, name: converted.name, rarity: converted.rarity, profession: converted.profession, subProfessionId: converted.subProfessionId, ownerOperatorId: ownerId || null, ownerName: ownerName || null });
    console.log(`  [OK] ${converted.name}: ${converted.phases.length} phases, ${converted.skills.length} skills → ${converted.profession}/${converted.subProfessionId}/`);
  }

  // 过滤模式（只拉单子职业）：index 与磁盘旧数据合并（本次条目 upsert，其余保留），避免覆盖全量索引
  if (subFilter) {
    const indexPath = path.join(BASE, 'index.json');
    let merged = [];
    try { merged = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch { merged = []; }
    for (const entry of index) {
      const i = merged.findIndex(e => e.id === entry.id);
      if (i >= 0) merged[i] = entry; else merged.push(entry);
    }
    index.length = 0;
    index.push(...merged);
  }

  // 显示名覆盖:数据文件手改的形态命名(index 由游戏原名构建,需对齐 json 内 name,防重跑回退)
  const NAME_OVERRIDES = {
    'token_10030_mlyss_wtrman': '流形·远程',  // 流形(游戏原名)→流形·远程:与派生条目流形·近战对称命名
  };
  for (const e of index) { if (NAME_OVERRIDES[e.id]) e.name = NAME_OVERRIDES[e.id]; }

  // 静态虚构条目合并:游戏数据中不存在的派生查询条目(缪尔赛思流形·近战——由流形基础数据派生,远程为原 token_10030),
  // 重跑抓取后需保持存在(数据文件由 setup 生成,若缺失则从远程形态复制派生)
  const VIRTUAL_TOKENS = [
    { id: 'token_10030_mlyss_melee', srcId: 'token_10030_mlyss_wtrman', name: '流形·近战', rarity: 'TIER_6', owner: 'char_249_mlyss', ownerName: '缪尔赛思' },
    // 小自在(夕的召唤物):游戏 token_10015 phases 为空(属性由持有者技能注入,非独立面板) → 静态代表档面板(E2 atk398/1.9s 法伤)
    { id: 'token_10015_dusk_drgn', name: '小自在', rarity: 'TIER_6', owner: 'char_2015_dusk', ownerName: '夕', panel: { maxHp: 1997, atk: 398, def: 302, magicResistance: 50, baseAttackTime: 1.9 } },
  ];
  for (const v of VIRTUAL_TOKENS) {
    if (!index.some(e => e.id === v.id)) {
      const entry = { id: v.id, name: v.name, rarity: v.rarity, profession: 'TOKEN', subProfessionId: 'notchar1', ownerOperatorId: v.owner, ownerName: v.ownerName };
      // 派生条目紧随源条目之后插入(形态条目相邻,选择器同星级按数据序排时不被其他召唤物隔开)
      const srcIdx = index.findIndex(e => e.id === v.srcId);
      if (srcIdx >= 0) index.splice(srcIdx + 1, 0, entry);
      else index.push(entry);
      const vDir = path.join(BASE, 'TOKEN', 'notchar1');
      const vPath = path.join(vDir, v.id + '.json');
      if (!fs.existsSync(vPath)) {
        if (v.panel) {
          const clone = { id: v.id, name: v.name, rarity: v.rarity, profession: 'TOKEN', subProfessionId: 'notchar1', damageType: 'arts', ownerOperatorId: v.owner, trustBonus: { atk: 0, def: 0, maxHp: 0 }, skills: [], talents: [], trait: null, potentialRanks: [] };
          clone.phases = [0, 1, 2].map(el => ({ eliteLevel: el, maxLevel: 90, atk: [v.panel.atk, v.panel.atk], def: [v.panel.def, v.panel.def], maxHp: [v.panel.maxHp, v.panel.maxHp], magicResistance: v.panel.magicResistance, baseAttackTime: v.panel.baseAttackTime, attackSpeed: 100 }));
          fs.writeFileSync(vPath, JSON.stringify(clone, null, 2), 'utf8');
          console.log('  [VIRTUAL-STATIC] ' + v.name + ' → TOKEN/notchar1/' + v.id + '.json');
        } else {
          const srcPath = path.join(vDir, v.srcId + '.json');
          if (fs.existsSync(srcPath)) {
            const base = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
            const clone = JSON.parse(JSON.stringify(base));
            clone.id = v.id;
            clone.name = v.name;
            clone.damageType = 'physical';
            clone.skills[1].name = '耦合·自回';
            clone.skills[2].name = '适应·拖拽';
            fs.writeFileSync(vPath, JSON.stringify(clone, null, 2), 'utf8');
            console.log('  [VIRTUAL] ' + v.name + ' → TOKEN/notchar1/' + v.id + '.json');
          }
        }
      }
    }
  }

  // 虚拟技能注入:无技能干员的天赋按"落地触发被动"建模(GALLUS²「来抓我啊」:部署后20s内攻击降低目标法抗15%(buff持续10s,覆盖窗口=20+10=30s,用户口径),
  // 游戏数据 skills 为空,引擎以 PASSIVE+duration20 限时被动技能位承载,技能期法伤按 ×0.85 抗性结算)。
  // 重跑抓取会重建 skills(空),此处对磁盘 json 补注入(levels 10 档同构,skillLevel 索引安全回退)。
  const VIRTUAL_SKILL_INJECT = {
    'char_4227_gallus': {
      skillId: 'skpas_gallus2_t',
      name: '“来抓我啊”',
      levels: (() => { const base = { skillType: 'PASSIVE', skillDuration: 30, magic_resistance: -0.15, level: 1 }; return Array.from({ length: 10 }, () => JSON.parse(JSON.stringify(base))); })(),
    },
  };
  for (const e of index) {
    const vskill = VIRTUAL_SKILL_INJECT[e.id];
    if (!vskill) continue;
    const dir = path.join(BASE, e.profession, e.subProfessionId);
    const jp = path.join(dir, e.id + '.json');
    if (!fs.existsSync(jp)) continue;
    const jo = JSON.parse(fs.readFileSync(jp, 'utf8'));
    if (!(jo.skills || []).some(s => s.skillId === vskill.skillId)) {
      jo.skills = jo.skills || [];
      jo.skills.push(JSON.parse(JSON.stringify(vskill)));
      fs.writeFileSync(jp, JSON.stringify(jo, null, 2), 'utf8');
      console.log('  [VIRTUAL-SKILL] ' + e.name + ' ← ' + vskill.name);
    }
  }

  // Save index
  fs.writeFileSync(path.join(BASE, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
  console.log(`\n完成: ${index.length} 个干员 + sub-professions.json → ${BASE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
